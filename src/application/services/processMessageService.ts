import { randomUUID } from "node:crypto";

import { detectVisualMassPing } from "../../domain/detection/engine.js";
import { evaluateRisk } from "../../domain/detection/riskEngine.js";
import type { DetectionResult, ObservedMessage } from "../../domain/detection/types.js";
import type { IncidentRecord } from "../../domain/incidents/types.js";
import { applyActionCaps } from "../../domain/policy/actionCaps.js";
import { choosePresetEscalation, clampTimeoutSeconds } from "../../domain/policy/escalation.js";
import {
  resolveEffectiveChannelPolicy,
  selectMatchingActorPolicy
} from "../../domain/policy/policyPrecedence.js";
import type {
  ActionPlan,
  ActorActivityProfile,
  ActorContext,
  ChannelActivityProfile,
  ScopedActorPolicy
} from "../../domain/policy/types.js";
import type { Clock } from "../../shared/time/clock.js";
import type { InMemoryActorLock } from "../locks/inMemoryActorLock.js";
import type { ActionExecutionResult, ActionResult } from "./actionTypes.js";
import type { ActivityTracker } from "./activityTracker.js";
import type { BurstTracker } from "./burstTracker.js";
import type { CorrelationService } from "./correlationService.js";
import type { RaidSessionService } from "./raidSessionService.js";
import type { GuildSettingsCache } from "./settingsCache.js";
import type {
  ActorPolicyRepository,
  AuditRepository,
  CategoryPolicyRepository,
  ChannelPolicyRepository,
  EscalationRepository,
  GuildSettingsRepository,
  IncidentRepository,
  ProtectedRoleRepository,
  RaidSessionRecord,
  RoleRiskProfileRepository,
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
  readonly matchedRaidSessionId: string | null;
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
  readonly roleRiskProfileRepository?: RoleRiskProfileRepository;
  readonly channelPolicyRepository: ChannelPolicyRepository;
  readonly categoryPolicyRepository?: CategoryPolicyRepository;
  readonly trustedActorRepository: TrustedActorRepository;
  readonly actorPolicyRepository?: ActorPolicyRepository;
  readonly escalationRepository: EscalationRepository;
  readonly incidentRepository: IncidentRepository;
  readonly sanctionRepository: SanctionRepository;
  readonly auditRepository: AuditRepository;
  readonly actorLock: InMemoryActorLock;
  readonly burstTracker: BurstTracker;
  readonly correlationService?: CorrelationService;
  readonly raidSessionService?: RaidSessionService;
  readonly activityTracker?: ActivityTracker;
  readonly clock: Clock;
}

export interface ProcessMessageOutcome {
  readonly incidentId: string | null;
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

function legacyTrustedActorPolicies(
  trustedActors: Awaited<ReturnType<TrustedActorRepository["listByGuildId"]>>
): readonly ScopedActorPolicy[] {
  return trustedActors.map((entry) => ({
    id: `${entry.guildId}:${entry.actorType}:${entry.actorId}`,
    guildId: entry.guildId,
    targetId: entry.actorId,
    targetType: entry.actorType === "ROLE" ? "ROLE" : entry.actorType,
    policy:
      entry.policy === "ALLOW"
        ? "FULL_BYPASS"
        : entry.policy === "MONITOR"
          ? "MONITOR_ONLY"
          : "NO_PUNISH",
    scopeType: "GUILD",
    scopeId: null,
    expiresAt: null,
    createdAt: new Date(0),
    updatedAt: new Date(0)
  }));
}

function baseActionResults(): ActionExecutionResult {
  return {
    delete: skipped("delete_pending", "Delete not attempted yet"),
    punishment: skipped("punishment_pending", "Punishment not attempted yet"),
    persistence: skipped("persistence_pending", "Persistence not finalized yet"),
    modLog: skipped("mod_log_pending", "Mod log not attempted yet")
  };
}

interface LegacyIncidentInsertRepository {
  insert(record: IncidentRecord): Promise<{ readonly inserted: boolean }>;
}

function hasLegacyIncidentInsertRepository(
  incidentRepository: IncidentRepository | LegacyIncidentInsertRepository
): incidentRepository is LegacyIncidentInsertRepository {
  const candidate = (incidentRepository as { insert?: unknown }).insert;
  return typeof candidate === "function";
}

async function countConfirmedIncidents(
  incidentRepository: IncidentRepository,
  guildId: string,
  actorId: string,
  since: Date
): Promise<number> {
  if (
    "countConfirmedByActorWithinWindow" in incidentRepository &&
    typeof incidentRepository.countConfirmedByActorWithinWindow === "function"
  ) {
    return incidentRepository.countConfirmedByActorWithinWindow(guildId, actorId, since);
  }

  return 0;
}

async function reserveIncident(
  incidentRepository: IncidentRepository | LegacyIncidentInsertRepository,
  record: IncidentRecord
): Promise<{ readonly inserted: boolean }> {
  if ("reserve" in incidentRepository && typeof incidentRepository.reserve === "function") {
    return incidentRepository.reserve(record);
  }

  if (hasLegacyIncidentInsertRepository(incidentRepository)) {
    return incidentRepository.insert(record);
  }

  return { inserted: false };
}

async function finalizeIncident(
  incidentRepository: IncidentRepository,
  guildId: string,
  incidentId: string,
  update: {
    readonly actionResults: ActionExecutionResult;
    readonly sanctionId: string | null;
    readonly processingState: IncidentRecord["processingState"];
  }
): Promise<void> {
  if ("finalize" in incidentRepository && typeof incidentRepository.finalize === "function") {
    await incidentRepository.finalize(guildId, incidentId, update);
  }
}

function exactMessageSignature(detection: DetectionResult): string | null {
  return (
    detection.exactFingerprint ??
    detection.structuralFingerprint ??
    detection.normalizedText.normalizedHash ??
    null
  );
}

function emptyActorProfile(actorId: string): ActorActivityProfile {
  return {
    actorId,
    firstObservedAt: null,
    lastObservedAt: null,
    activeDays: 0,
    messageCount: 0,
    recentUniqueChannels: 0,
    priorLegitimatePublisherPosts: 0,
    priorConfirmedIncidents: 0,
    priorFalsePositiveCorrections: 0,
    lastActivityInChannelAt: null,
    activityClass: "UNKNOWN"
  };
}

function emptyChannelProfile(
  channelId: string,
  observedMessage: ObservedMessage
): ChannelActivityProfile {
  return {
    channelId,
    messageCount: 0,
    protectedVisualCount: 0,
    knownPublisherCount: 0,
    lastProtectedVisualAt: null,
    isRestricted: observedMessage.channelIsRestricted ?? false,
    isAnnouncement: observedMessage.channelIsAnnouncement ?? false,
    isQuiet: true,
    contextLabel: "unclassified channel"
  };
}

function defaultActivityTracker(input: ProcessMessageInput): ActivityTracker {
  return {
    recordMessage(): void {},
    getActorProfile(): Promise<ActorActivityProfile> {
      return Promise.resolve(emptyActorProfile(input.observedMessage.actorId));
    },
    getChannelProfile(): Promise<ChannelActivityProfile> {
      return Promise.resolve(
        emptyChannelProfile(input.observedMessage.channelId, input.observedMessage)
      );
    },
    flush(): Promise<void> {
      return Promise.resolve();
    },
    stop(): Promise<void> {
      return Promise.resolve();
    }
  };
}

function defaultCorrelationService(): CorrelationService {
  return {
    summarize(payload: Parameters<CorrelationService["summarize"]>[0]) {
      return Promise.resolve({
        current: {
          ...payload,
          id: randomUUID()
        },
        summary: {
          stage: "FIRST",
          relatedEvents: [],
          coordinatedActorIds: [],
          triggeredSignals: []
        }
      });
    },
    record(): Promise<void> {
      return Promise.resolve();
    },
    deleteExpired(): Promise<number> {
      return Promise.resolve(0);
    }
  } as unknown as CorrelationService;
}

function defaultRaidSessionService(): RaidSessionService {
  return {
    findMatching(): Promise<RaidSessionRecord | null> {
      return Promise.resolve(null);
    },
    absorbEvent(): Promise<RaidSessionRecord | null> {
      return Promise.resolve(null);
    },
    stopGuildSessions(): Promise<void> {
      return Promise.resolve();
    },
    deleteExpired(): Promise<number> {
      return Promise.resolve(0);
    }
  } as unknown as RaidSessionService;
}

async function resolveEscalatedPlan(
  plan: ActionPlan,
  actor: ActorContext,
  confirmedCountBeforeCurrent: number,
  settings: NonNullable<Awaited<ReturnType<GuildSettingsCache["get"]>>>,
  escalationSteps: readonly Awaited<ReturnType<EscalationRepository["listByGuildId"]>>[number][],
  incidentRepository: IncidentRepository,
  guildId: string,
  actorId: string,
  now: Date
): Promise<ActionPlan> {
  if (plan.decision !== "ENFORCE" || !plan.shouldPunish) {
    return plan;
  }

  if (settings.escalationMode === "PRESET" && actor.actorKind === "USER") {
    const escalation = choosePresetEscalation(confirmedCountBeforeCurrent + 1);
    return {
      ...plan,
      punishmentType: escalation.punishmentType,
      punishmentDurationSeconds: escalation.durationSeconds
    };
  }

  if (settings.escalationMode === "CUSTOM") {
    let selected = null;
    for (const step of [...escalationSteps].sort(
      (left, right) => left.orderIndex - right.orderIndex
    )) {
      if (!step.enabled) {
        continue;
      }

      const countWithinWindow = await countConfirmedIncidents(
        incidentRepository,
        guildId,
        actorId,
        new Date(now.getTime() - step.windowDays * 24 * 60 * 60 * 1_000)
      );
      if (countWithinWindow + 1 >= step.thresholdCount) {
        selected = step;
      }
    }

    if (selected) {
      return {
        ...plan,
        punishmentType: selected.punishmentType,
        punishmentDurationSeconds:
          selected.punishmentType === "TIMEOUT" && selected.durationSeconds !== null
            ? clampTimeoutSeconds(selected.durationSeconds)
            : selected.durationSeconds
      };
    }
  }

  return plan;
}

export class ProcessMessageService {
  public constructor(private readonly deps: ProcessMessageServiceDependencies) {}

  public async process(input: ProcessMessageInput): Promise<ProcessMessageOutcome | null> {
    const settings = await this.deps.settingsCache.get(input.observedMessage.guildId);
    if (!settings || !settings.enabled) {
      return null;
    }

    const activityTracker = this.deps.activityTracker ?? defaultActivityTracker(input);
    const correlationService = this.deps.correlationService ?? defaultCorrelationService();
    const raidSessionService = this.deps.raidSessionService ?? defaultRaidSessionService();
    const adapter = input.adapterFactory(settings.logChannelId);
    const now = this.deps.clock.now();

    const [
      channelPolicy,
      categoryPolicy,
      protectedRoles,
      roleRiskProfiles,
      trustedActors,
      actorPolicies,
      escalationSteps,
      actorProfile,
      channelProfile
    ] = await Promise.all([
      this.deps.channelPolicyRepository.getForChannel(
        input.observedMessage.guildId,
        input.observedMessage.channelId
      ),
      this.deps.categoryPolicyRepository?.getForCategory(
        input.observedMessage.guildId,
        input.observedMessage.parentCategoryId ?? null
      ) ?? Promise.resolve(null),
      this.deps.protectedRoleRepository.listByGuildId(input.observedMessage.guildId),
      this.deps.roleRiskProfileRepository?.listByGuildId(input.observedMessage.guildId) ??
        Promise.resolve([]),
      this.deps.trustedActorRepository.listByGuildId(input.observedMessage.guildId),
      this.deps.actorPolicyRepository?.listByGuildId(input.observedMessage.guildId) ??
        Promise.resolve([]),
      this.deps.escalationRepository.listByGuildId(input.observedMessage.guildId),
      activityTracker.getActorProfile(
        input.observedMessage.guildId,
        input.observedMessage.actorId,
        input.observedMessage.channelId
      ),
      activityTracker.getChannelProfile(
        input.observedMessage.guildId,
        input.observedMessage.channelId
      )
    ]);

    const effectiveChannelPolicy = resolveEffectiveChannelPolicy(channelPolicy, categoryPolicy);
    if (effectiveChannelPolicy === "IGNORE_ALL") {
      return null;
    }

    const roleRiskById = Object.fromEntries(
      roleRiskProfiles.map((entry) => [entry.roleId, entry.riskLevel])
    );
    const recentMessages = this.deps.burstTracker.getRecent(
      input.observedMessage.guildId,
      input.observedMessage.actorId,
      settings.burstWindowSeconds,
      input.observedMessage.createdTimestamp
    );
    const baseDetection = detectVisualMassPing(input.observedMessage, {
      roleDetectionMode: settings.roleDetectionMode,
      protectedRoleIds: new Set(protectedRoles.map((entry) => entry.roleId)),
      roleRiskById,
      minVisualCount: settings.minVisualCount,
      maxInformationChars: settings.maxInformationChars,
      burstWindowSeconds: settings.burstWindowSeconds,
      burstMessageCount: settings.burstMessageCount,
      linkRuleEnabled: settings.linkRuleEnabled,
      recentSuspiciousMessages: recentMessages
    });

    if (!baseDetection.candidate) {
      activityTracker.recordMessage({
        guildId: input.observedMessage.guildId,
        actorId: input.observedMessage.actorId,
        channelId: input.observedMessage.channelId,
        happenedAt: now,
        protectedVisualCandidate: false,
        legitimatePublisherPost: false,
        confirmedIncident: false,
        falsePositiveCorrection: false,
        channelIsRestricted: input.observedMessage.channelIsRestricted ?? false,
        channelIsAnnouncement: input.observedMessage.channelIsAnnouncement ?? false
      });
      return null;
    }

    const matchedActorPolicy = selectMatchingActorPolicy(
      input.actor,
      [...actorPolicies, ...legacyTrustedActorPolicies(trustedActors)],
      {
        channelId: input.observedMessage.channelId,
        categoryId: input.observedMessage.parentCategoryId ?? null
      },
      now
    );
    if (matchedActorPolicy?.policy === "FULL_BYPASS") {
      return null;
    }

    const correlationCandidate = await correlationService.summarize({
      guildId: input.observedMessage.guildId,
      actorId: input.observedMessage.actorId,
      channelId: input.observedMessage.channelId,
      categoryId: input.observedMessage.parentCategoryId ?? null,
      categoryPosition: input.observedMessage.categoryPosition ?? null,
      parentPosition: input.observedMessage.parentPosition ?? null,
      channelPosition: input.observedMessage.channelPosition ?? null,
      exactFingerprint: baseDetection.exactFingerprint ?? null,
      structuralFingerprint: baseDetection.structuralFingerprint ?? null,
      protectedMentionClass: baseDetection.protectedMentionClass ?? null,
      score: baseDetection.score ?? 0,
      decision: baseDetection.suggestedDecision ?? "OBSERVE",
      eventSource: input.observedMessage.eventSource ?? "CREATE",
      createdAt: now,
      windowSeconds: settings.correlationWindowSeconds
    });
    const matchingRaidSession = await raidSessionService.findMatching(
      input.observedMessage.guildId,
      now,
      baseDetection.exactFingerprint ?? null,
      baseDetection.structuralFingerprint ?? null,
      baseDetection.protectedMentionClass ?? null
    );
    const authorizedPublisherInScope = matchedActorPolicy?.policy === "SCOPED_PUBLISHER";
    const accountIsObjectivelyNew =
      input.actor.createdTimestamp !== null &&
      input.actor.createdTimestamp !== undefined &&
      now.getTime() - input.actor.createdTimestamp <= settings.newAccountMaxAgeHours * 3_600_000;
    const joinIsObjectivelyNew =
      input.actor.joinedTimestamp !== null &&
      input.actor.joinedTimestamp !== undefined &&
      now.getTime() - input.actor.joinedTimestamp <= settings.newJoinMaxAgeHours * 3_600_000;
    const risk = evaluateRisk({
      baseDetection,
      settings,
      actorProfile,
      channelProfile,
      authorizedPublisherInScope,
      correlation: correlationCandidate.summary,
      activeRaidMatch: Boolean(matchingRaidSession),
      now,
      accountIsObjectivelyNew,
      joinIsObjectivelyNew
    });

    const detection: DetectionResult = {
      ...baseDetection,
      detected:
        (risk.score ?? 0) >= settings.observeThreshold ||
        authorizedPublisherInScope ||
        correlationCandidate.summary.stage !== "FIRST" ||
        Boolean(matchingRaidSession),
      ruleId: correlationCandidate.summary.triggeredSignals.includes("COORDINATED_MULTI_ACTOR_RAID")
        ? "COORDINATED_MULTI_ACTOR_RAID"
        : correlationCandidate.summary.triggeredSignals.includes("CHANNEL_TRAVERSAL_ASCENDING")
          ? "CHANNEL_TRAVERSAL_ASCENDING"
          : correlationCandidate.summary.triggeredSignals.includes("CHANNEL_TRAVERSAL_DESCENDING")
            ? "CHANNEL_TRAVERSAL_DESCENDING"
            : matchingRaidSession
              ? "RAID_SESSION_MATCH"
              : correlationCandidate.summary.triggeredSignals.length > 0
                ? "CORRELATED_REPEAT"
                : baseDetection.ruleId,
      confidence: risk.confidence,
      signals: risk.signals,
      score: risk.score,
      explanation: {
        ...risk.explanation,
        correlationStage: correlationCandidate.summary.stage
      },
      correlationStage: correlationCandidate.summary.stage,
      suggestedDecision: risk.suggestedDecision
    };

    const strongIdentitySignal =
      accountIsObjectivelyNew ||
      joinIsObjectivelyNew ||
      Boolean(matchingRaidSession) ||
      correlationCandidate.summary.coordinatedActorIds.length > 0;
    const warmupStartedAt = settings.guildWarmupStartedAt ?? settings.createdAt;
    const warmupActive =
      now.getTime() - warmupStartedAt.getTime() < settings.warmupDays * 24 * 60 * 60 * 1_000;

    let plan = applyActionCaps({
      settings,
      actor: input.actor,
      explanation: detection.explanation ?? baseDetection.explanation!,
      desiredDecision: detection.suggestedDecision ?? "OBSERVE",
      correlationStage: detection.correlationStage ?? "FIRST",
      actorActivityClass: actorProfile.activityClass,
      authorizedPublisherInScope,
      actorPolicy: matchedActorPolicy?.policy ?? null,
      channelPolicy: effectiveChannelPolicy,
      categoryPolicy,
      activeRaidMatch: Boolean(matchingRaidSession),
      warmupActive,
      strongIdentitySignal
    });
    const confirmedCountBeforeCurrent = await countConfirmedIncidents(
      this.deps.incidentRepository,
      input.observedMessage.guildId,
      input.observedMessage.actorId,
      new Date(now.getTime() - 30 * 24 * 60 * 60 * 1_000)
    );
    plan = await resolveEscalatedPlan(
      plan,
      input.actor,
      confirmedCountBeforeCurrent,
      settings,
      escalationSteps,
      this.deps.incidentRepository,
      input.observedMessage.guildId,
      input.observedMessage.actorId,
      now
    );

    if (plan.shouldObserve || detection.detected) {
      this.deps.burstTracker.record(
        input.observedMessage.guildId,
        input.observedMessage.actorId,
        input.observedMessage.createdTimestamp
      );
      await correlationService.record(
        correlationCandidate.current,
        settings.correlationWindowSeconds
      );
    }

    if (plan.decision === "ALLOW" || plan.decision === "OBSERVE") {
      activityTracker.recordMessage({
        guildId: input.observedMessage.guildId,
        actorId: input.observedMessage.actorId,
        channelId: input.observedMessage.channelId,
        happenedAt: now,
        protectedVisualCandidate: true,
        legitimatePublisherPost: authorizedPublisherInScope && plan.decision === "ALLOW",
        confirmedIncident: false,
        falsePositiveCorrection: false,
        channelIsRestricted: input.observedMessage.channelIsRestricted ?? false,
        channelIsAnnouncement: input.observedMessage.channelIsAnnouncement ?? false
      });
      return null;
    }

    const previousIncidentCount = await this.deps.incidentRepository.countRecentByActor(
      input.observedMessage.guildId,
      input.observedMessage.actorId,
      new Date(now.getTime() - 30 * 24 * 60 * 60 * 1_000)
    );
    const lockKey = `${input.observedMessage.guildId}:${input.observedMessage.actorId}`;

    return this.deps.actorLock.run(lockKey, async () => {
      const incidentId = randomUUID();
      const reason = `PingGuard ${detection.ruleId ?? "DETECTION"}`;
      const reservedRecord: IncidentRecord = {
        id: incidentId,
        guildId: input.observedMessage.guildId,
        messageId: input.observedMessage.messageId,
        channelId: input.observedMessage.channelId,
        actorId: input.observedMessage.actorId,
        actorKind: input.actor.actorKind,
        eventSource: input.observedMessage.eventSource ?? "CREATE",
        messageSignatureHash: exactMessageSignature(detection),
        ruleId: detection.ruleId,
        confidence: detection.confidence,
        signals: detection.signals,
        mentionedRoleIds: detection.protectedMentions
          .filter((mention) => mention.kind === "ROLE" && mention.roleId)
          .map((mention) => mention.roleId as string),
        mediaSummary: detection.media,
        decision: plan.decision,
        actionRequested:
          plan.decision === "ENFORCE" || plan.decision === "QUARANTINE"
            ? plan.punishmentType
            : plan.decision === "DELETE_ONLY"
              ? "DELETE_ONLY"
              : "MONITOR",
        actionResults: baseActionResults(),
        explanation: plan.explanation,
        correlationStage: detection.correlationStage ?? "FIRST",
        exactFingerprint: detection.exactFingerprint ?? null,
        structuralFingerprint: detection.structuralFingerprint ?? null,
        protectedMentionClass: detection.protectedMentionClass ?? null,
        processingState: "RESERVED",
        confirmedStrike: plan.isConfirmedStrike,
        dryRun: plan.dryRun,
        falsePositive: false,
        createdAt: now,
        sanctionId: null
      };
      const reserved = await reserveIncident(this.deps.incidentRepository, reservedRecord);
      if (!reserved.inserted) {
        return {
          incidentId: null,
          detection,
          plan,
          results: {
            delete: skipped("duplicate_incident", "Delete skipped because event is duplicate"),
            punishment: skipped(
              "duplicate_incident",
              "Punishment skipped because event is duplicate"
            ),
            persistence: skipped("duplicate_incident", "Incident already reserved"),
            modLog: skipped("duplicate_incident", "Mod log skipped because event is duplicate")
          },
          previousIncidentCount,
          sanctionId: null
        };
      }

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
          now
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
                ? new Date(now.getTime() + plan.punishmentDurationSeconds * 1_000)
                : null,
            cooldownUntil: new Date(now.getTime() + settings.sanctionCooldownSeconds * 1_000),
            sourceIncidentId: incidentId,
            actionResult: actionResultToJson(punishmentResult),
            createdAt: now
          } satisfies SanctionRecord);
        }
      }

      let results: ActionExecutionResult = {
        delete: deleteResult,
        punishment: punishmentResult,
        persistence: {
          status: "SUCCESS",
          code: "incident_reserved",
          message: "Incident reserved before actions"
        },
        modLog: skipped("mod_log_not_sent", "Mod log not attempted")
      };

      if (plan.shouldLog) {
        results = {
          ...results,
          modLog: await adapter.sendModLog({
            incidentId,
            observedMessage: input.observedMessage,
            actor: input.actor,
            detection,
            plan,
            results,
            previousIncidentCount,
            sanctionId,
            happenedAt: now,
            matchedRaidSessionId: matchingRaidSession?.id ?? null
          })
        };
      }

      await finalizeIncident(
        this.deps.incidentRepository,
        input.observedMessage.guildId,
        incidentId,
        {
          actionResults: results,
          sanctionId,
          processingState: "COMPLETED"
        }
      );
      await raidSessionService.absorbEvent({
        guildId: input.observedMessage.guildId,
        now,
        durationSeconds: settings.raidSessionDurationSeconds,
        correlation: correlationCandidate.summary,
        exactFingerprint: detection.exactFingerprint ?? null,
        structuralFingerprint: detection.structuralFingerprint ?? null,
        protectedMentionClass: detection.protectedMentionClass ?? null,
        actorId: input.observedMessage.actorId,
        channelId: input.observedMessage.channelId,
        triggeringRule: detection.ruleId ?? "VISUAL_MASS_PING"
      });
      activityTracker.recordMessage({
        guildId: input.observedMessage.guildId,
        actorId: input.observedMessage.actorId,
        channelId: input.observedMessage.channelId,
        happenedAt: now,
        protectedVisualCandidate: true,
        legitimatePublisherPost: false,
        confirmedIncident: plan.isConfirmedStrike,
        falsePositiveCorrection: false,
        channelIsRestricted: input.observedMessage.channelIsRestricted ?? false,
        channelIsAnnouncement: input.observedMessage.channelIsAnnouncement ?? false
      });
      await this.deps.auditRepository.append(
        input.observedMessage.guildId,
        input.observedMessage.actorId,
        "message_processed",
        {
          incidentId,
          ruleId: detection.ruleId,
          decision: plan.decision,
          delete: deleteResult.status,
          punishment: punishmentResult.status,
          modLog: results.modLog.status,
          raidSessionId: matchingRaidSession?.id ?? null
        }
      );

      return {
        incidentId,
        detection,
        plan,
        results: {
          ...results,
          persistence: {
            status: "SUCCESS",
            code: "incident_finalized",
            message: "Incident stored with final action results"
          }
        },
        previousIncidentCount,
        sanctionId
      };
    });
  }
}
