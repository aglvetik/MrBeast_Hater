import { randomUUID } from "node:crypto";

import { detectVisualMassPing } from "../../domain/detection/engine.js";
import type { DetectionResult, ObservedMessage } from "../../domain/detection/types.js";
import type { IncidentRecord } from "../../domain/incidents/types.js";
import { evaluatePolicy } from "../../domain/policy/engine.js";
import type { ActionPlan, ActorContext } from "../../domain/policy/types.js";
import type { Clock } from "../../shared/time/clock.js";
import type { InMemoryActorLock } from "../locks/inMemoryActorLock.js";
import type { ActionExecutionResult, ActionResult } from "./actionTypes.js";
import type { BurstTracker } from "./burstTracker.js";
import type { GuildSettingsCache } from "./settingsCache.js";
import type {
  AuditRepository,
  ChannelPolicyRepository,
  EscalationRepository,
  GuildSettingsRepository,
  IncidentRepository,
  ProtectedRoleRepository,
  SanctionRecord,
  SanctionRepository,
  TrustedActorRepository
} from "../../infrastructure/database/repositories.js";

export interface ModerationAdapter {
  deleteMessage(reason: string): Promise<ActionResult>;
  applyPunishment(plan: ActionPlan, reason: string): Promise<ActionResult>;
  sendModLog(payload: ModLogPayload): Promise<ActionResult>;
}

export interface ModLogPayload {
  readonly incidentId: string;
  readonly observedMessage: ObservedMessage;
  readonly actor: ActorContext;
  readonly detection: DetectionResult;
  readonly plan: ActionPlan;
  readonly results: ActionExecutionResult;
  readonly previousIncidentCount: number;
  readonly sanctionId: string | null;
  readonly happenedAt: Date;
}

export interface ProcessMessageInput {
  readonly observedMessage: ObservedMessage;
  readonly actor: ActorContext;
  readonly adapterFactory: (logChannelId: string | null) => ModerationAdapter;
}

export interface ProcessMessageServiceDependencies {
  readonly settingsRepository: GuildSettingsRepository;
  readonly settingsCache: GuildSettingsCache;
  readonly protectedRoleRepository: ProtectedRoleRepository;
  readonly channelPolicyRepository: ChannelPolicyRepository;
  readonly trustedActorRepository: TrustedActorRepository;
  readonly escalationRepository: EscalationRepository;
  readonly incidentRepository: IncidentRepository;
  readonly sanctionRepository: SanctionRepository;
  readonly auditRepository: AuditRepository;
  readonly actorLock: InMemoryActorLock;
  readonly burstTracker: BurstTracker;
  readonly clock: Clock;
}

export interface ProcessMessageOutcome {
  readonly incidentId: string;
  readonly detection: DetectionResult;
  readonly plan: ActionPlan;
  readonly results: ActionExecutionResult;
  readonly previousIncidentCount: number;
  readonly sanctionId: string | null;
}

function skipped(code: string, message: string): ActionResult {
  return { status: "SKIPPED", code, message };
}

function actionResultToJson(result: ActionResult): Record<string, unknown> {
  return {
    status: result.status,
    code: result.code,
    message: result.message
  };
}

export class ProcessMessageService {
  public constructor(private readonly deps: ProcessMessageServiceDependencies) {}

  public async process(input: ProcessMessageInput): Promise<ProcessMessageOutcome | null> {
    const settings = await this.deps.settingsCache.get(input.observedMessage.guildId);
    if (!settings || !settings.enabled) {
      return null;
    }

    const adapter = input.adapterFactory(settings.logChannelId);

    const channelPolicy =
      (await this.deps.channelPolicyRepository.getForChannel(
        input.observedMessage.guildId,
        input.observedMessage.channelId
      )) ?? "ENFORCE";

    if (channelPolicy === "DISABLED") {
      return null;
    }

    const [protectedRoles, trustedActors, escalationSteps] = await Promise.all([
      this.deps.protectedRoleRepository.listByGuildId(input.observedMessage.guildId),
      this.deps.trustedActorRepository.listByGuildId(input.observedMessage.guildId),
      this.deps.escalationRepository.listByGuildId(input.observedMessage.guildId)
    ]);

    const recentMessages = this.deps.burstTracker.getRecent(
      input.observedMessage.guildId,
      input.observedMessage.actorId,
      settings.burstWindowSeconds,
      input.observedMessage.createdTimestamp
    );

    const detection = detectVisualMassPing(input.observedMessage, {
      roleDetectionMode: settings.roleDetectionMode,
      protectedRoleIds: new Set(protectedRoles.map((entry) => entry.roleId)),
      minVisualCount: settings.minVisualCount,
      maxInformationChars: settings.maxInformationChars,
      burstWindowSeconds: settings.burstWindowSeconds,
      burstMessageCount: settings.burstMessageCount,
      linkRuleEnabled: settings.linkRuleEnabled,
      recentSuspiciousMessages: recentMessages
    });

    if (detection.protectedMentions.length > 0 && detection.media.totalVisualCount > 0) {
      this.deps.burstTracker.record(
        input.observedMessage.guildId,
        input.observedMessage.actorId,
        input.observedMessage.createdTimestamp
      );
    }

    if (!detection.detected) {
      return null;
    }

    const previousIncidentCount = await this.deps.incidentRepository.countRecentByActor(
      input.observedMessage.guildId,
      input.observedMessage.actorId,
      new Date(this.deps.clock.now().getTime() - 30 * 24 * 60 * 60 * 1_000)
    );

    const plan = evaluatePolicy({
      settings,
      detection,
      actor: input.actor,
      channelPolicy,
      trustedActors,
      incidentCountWithinWindow: previousIncidentCount + 1,
      escalationSteps
    });

    if (!plan.shouldDelete && !plan.shouldPunish && !plan.shouldLog) {
      return null;
    }

    const lockKey = `${input.observedMessage.guildId}:${input.observedMessage.actorId}`;

    return this.deps.actorLock.run(lockKey, async () => {
      const incidentId = randomUUID();
      const reason = `PingGuard ${detection.ruleId ?? "DETECTION"}`;
      let sanctionId: string | null = null;

      const deleteResult = plan.shouldDelete
        ? await adapter.deleteMessage(reason)
        : skipped("delete_not_requested", "Delete not requested by policy");

      let punishmentResult: ActionResult = skipped(
        "punishment_not_requested",
        "Punishment not requested by policy"
      );
      if (plan.shouldPunish && plan.punishmentType !== "NONE") {
        const activeSanction = await this.deps.sanctionRepository.findActiveCooldown(
          input.observedMessage.guildId,
          input.observedMessage.actorId,
          plan.punishmentType,
          this.deps.clock.now()
        );

        if (activeSanction) {
          sanctionId = activeSanction.id;
          punishmentResult = skipped("cooldown_active", "Equivalent sanction already active");
        } else {
          punishmentResult = await adapter.applyPunishment(plan, reason);
          sanctionId = randomUUID();
          await this.deps.sanctionRepository.insert({
            id: sanctionId,
            guildId: input.observedMessage.guildId,
            actorId: input.observedMessage.actorId,
            actorKind: input.actor.actorKind,
            punishmentType: plan.punishmentType,
            durationSeconds: plan.punishmentDurationSeconds,
            applied: punishmentResult.status === "SUCCESS",
            activeUntil:
              punishmentResult.status === "SUCCESS" && plan.punishmentDurationSeconds !== null
                ? new Date(this.deps.clock.now().getTime() + plan.punishmentDurationSeconds * 1_000)
                : null,
            cooldownUntil: new Date(
              this.deps.clock.now().getTime() + settings.sanctionCooldownSeconds * 1_000
            ),
            sourceIncidentId: incidentId,
            actionResult: actionResultToJson(punishmentResult),
            createdAt: this.deps.clock.now()
          } satisfies SanctionRecord);
        }
      }

      const persistenceRecord: IncidentRecord = {
        id: incidentId,
        guildId: input.observedMessage.guildId,
        messageId: input.observedMessage.messageId,
        channelId: input.observedMessage.channelId,
        actorId: input.observedMessage.actorId,
        actorKind: input.actor.actorKind,
        ruleId: detection.ruleId,
        confidence: detection.confidence,
        signals: detection.signals,
        mentionedRoleIds: detection.protectedMentions
          .filter((mention) => mention.kind === "ROLE" && mention.roleId)
          .map((mention) => mention.roleId as string),
        mediaSummary: detection.media,
        actionRequested: plan.shouldPunish
          ? plan.punishmentType
          : plan.shouldDelete
            ? "DELETE_ONLY"
            : "MONITOR",
        actionResults: {
          delete: deleteResult,
          punishment: punishmentResult,
          persistence: skipped("pending", "Pending persistence"),
          modLog: skipped("pending", "Pending mod log")
        },
        dryRun: plan.dryRun,
        falsePositive: false,
        createdAt: this.deps.clock.now(),
        sanctionId
      };

      const persisted = await this.deps.incidentRepository.insert(persistenceRecord);
      const persistenceResult: ActionResult = persisted.inserted
        ? { status: "SUCCESS", code: "incident_saved", message: "Incident stored" }
        : skipped("duplicate_incident", "Incident already recorded");

      let results: ActionExecutionResult = {
        delete: deleteResult,
        punishment: punishmentResult,
        persistence: persistenceResult,
        modLog: skipped("mod_log_not_sent", "Mod log not attempted")
      };

      if (persisted.inserted && plan.shouldLog) {
        const modLogResult = await adapter.sendModLog({
          incidentId,
          observedMessage: input.observedMessage,
          actor: input.actor,
          detection,
          plan,
          results,
          previousIncidentCount,
          sanctionId,
          happenedAt: this.deps.clock.now()
        });
        results = {
          ...results,
          modLog: modLogResult
        };
      }

      await this.deps.auditRepository.append(
        input.observedMessage.guildId,
        input.observedMessage.actorId,
        "message_processed",
        {
          incidentId,
          ruleId: detection.ruleId,
          delete: deleteResult.status,
          punishment: punishmentResult.status,
          persisted: persistenceResult.status,
          modLog: results.modLog.status
        }
      );

      return {
        incidentId,
        detection,
        plan,
        results,
        previousIncidentCount,
        sanctionId
      };
    });
  }
}
