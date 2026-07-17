import { describe, expect, it } from "vitest";

import { InMemoryActorLock } from "../../src/application/locks/inMemoryActorLock.js";
import { BurstTracker } from "../../src/application/services/burstTracker.js";
import type { ActionResult } from "../../src/application/services/actionTypes.js";
import type { CorrelationService } from "../../src/application/services/correlationService.js";
import {
  ProcessMessageService,
  type ModerationAdapter
} from "../../src/application/services/processMessageService.js";
import type { RaidSessionService } from "../../src/application/services/raidSessionService.js";
import type { GuildSettingsCache } from "../../src/application/services/settingsCache.js";
import { buildDefaultGuildSettings } from "../../src/config/constants.js";
import type { ObservedMessage } from "../../src/domain/detection/types.js";
import type {
  ActorContext,
  EscalationStep,
  GuildSettings,
  ProtectedRole,
  TrustedActor
} from "../../src/domain/policy/types.js";
import type {
  AuditRepository,
  ChannelPolicyRepository,
  EscalationRepository,
  GuildSettingsRepository,
  IncidentRepository,
  ProtectedRoleRepository,
  SanctionRepository,
  TrustedActorRepository
} from "../../src/infrastructure/database/repositories.js";
import { systemClock } from "../../src/shared/time/clock.js";

function action(status: ActionResult["status"], code: string): ActionResult {
  return { status, code, message: code };
}

function observedMessage(overrides: Partial<ObservedMessage> = {}): ObservedMessage {
  return {
    guildId: "100",
    channelId: "200",
    messageId: "300",
    actorId: "400",
    content: "@everyone",
    mentionedEveryone: true,
    mentionedHere: false,
    mentionedRoleIds: [],
    attachments: [{ contentType: "image/png", fileName: "a.png" }],
    embeds: [],
    stickerCount: 0,
    createdTimestamp: 1_000,
    ...overrides
  };
}

function actor(overrides: Partial<ActorContext> = {}): ActorContext {
  return {
    actorId: "400",
    actorKind: "USER",
    roleIds: [],
    isAdministrator: false,
    isGuildOwner: false,
    ...overrides
  };
}

function adapter(log: string[], overrides: Partial<ModerationAdapter> = {}): ModerationAdapter {
  return {
    deleteMessage(): Promise<ActionResult> {
      log.push("delete");
      return Promise.resolve(action("SUCCESS", "deleted"));
    },
    applyPunishment(): Promise<ActionResult> {
      log.push("punish");
      return Promise.resolve(action("SUCCESS", "punished"));
    },
    sendModLog(): Promise<ActionResult> {
      log.push("log");
      return Promise.resolve(action("SUCCESS", "logged"));
    },
    ...overrides
  };
}

function service(
  settings: GuildSettings | null,
  options: {
    readonly inserted?: boolean;
    readonly channelPolicy?: "ENFORCE" | "DELETE_ONLY" | "MONITOR" | "DISABLED";
    readonly activeSanctionId?: string;
    readonly protectedRoles?: readonly ProtectedRole[];
    readonly trustedActors?: readonly TrustedActor[];
    readonly correlationStage?: "FIRST" | "CONFIRMED";
    readonly triggeredSignals?: readonly (
      | "SAME_ACTOR_EXACT_FINGERPRINT"
      | "SAME_ACTOR_STRUCTURAL_FINGERPRINT"
      | "SECOND_EVENT_OTHER_CHANNEL"
    )[];
    readonly escalationSteps?: readonly EscalationStep[];
    readonly confirmedCountResolver?: (since: Date) => number;
    readonly clockNow?: Date;
  } = {}
): {
  readonly sanctions: unknown[];
  readonly audits: unknown[];
  readonly incidents: unknown[];
  readonly instance: ProcessMessageService;
} {
  const sanctions: unknown[] = [];
  const audits: unknown[] = [];
  const incidents: unknown[] = [];

  return {
    sanctions,
    audits,
    incidents,
    instance: new ProcessMessageService({
      settingsRepository: {} as unknown as GuildSettingsRepository,
      settingsCache: {
        get(): Promise<GuildSettings | null> {
          return Promise.resolve(settings);
        }
      } as unknown as GuildSettingsCache,
      protectedRoleRepository: {
        listByGuildId(): Promise<readonly ProtectedRole[]> {
          return Promise.resolve(options.protectedRoles ?? []);
        }
      } as unknown as ProtectedRoleRepository,
      channelPolicyRepository: {
        getForChannel(): Promise<"ENFORCE" | "DELETE_ONLY" | "MONITOR" | "DISABLED"> {
          return Promise.resolve(options.channelPolicy ?? "ENFORCE");
        }
      } as unknown as ChannelPolicyRepository,
      trustedActorRepository: {
        listByGuildId(): Promise<readonly TrustedActor[]> {
          return Promise.resolve(options.trustedActors ?? []);
        }
      } as unknown as TrustedActorRepository,
      escalationRepository: {
        listByGuildId(): Promise<readonly EscalationStep[]> {
          return Promise.resolve(options.escalationSteps ?? []);
        }
      } as unknown as EscalationRepository,
      incidentRepository: {
        countConfirmedByActorWithinWindow(
          _guildId: string,
          _actorId: string,
          since: Date
        ): Promise<number> {
          return Promise.resolve(
            options.confirmedCountResolver
              ? options.confirmedCountResolver(since)
              : options.correlationStage === "CONFIRMED"
                ? 1
                : 0
          );
        },
        countRecentByActor(): Promise<number> {
          return Promise.resolve(0);
        },
        insert(record: unknown): Promise<{ readonly inserted: boolean }> {
          incidents.push(record);
          return Promise.resolve({ inserted: options.inserted ?? true });
        }
      } as unknown as IncidentRepository,
      sanctionRepository: {
        findActiveCooldown(): Promise<{ readonly id: string } | null> {
          return Promise.resolve(
            options.activeSanctionId ? { id: options.activeSanctionId } : null
          );
        },
        insert(record: unknown): Promise<void> {
          sanctions.push(record);
          return Promise.resolve();
        }
      } as unknown as SanctionRepository,
      auditRepository: {
        append(...args: unknown[]): Promise<void> {
          audits.push(args);
          return Promise.resolve();
        }
      } as unknown as AuditRepository,
      actorLock: new InMemoryActorLock(),
      burstTracker: new BurstTracker(),
      correlationService: {
        summarize(payload: Parameters<CorrelationService["summarize"]>[0]) {
          return Promise.resolve({
            current: {
              ...payload,
              id: "corr-1"
            },
            summary: {
              stage: options.correlationStage ?? "FIRST",
              relatedEvents: [],
              coordinatedActorIds: [],
              triggeredSignals: [...(options.triggeredSignals ?? [])]
            }
          });
        },
        record(): Promise<void> {
          return Promise.resolve();
        },
        deleteExpired(): Promise<number> {
          return Promise.resolve(0);
        }
      } as unknown as CorrelationService,
      raidSessionService: {
        findMatching(): Promise<null> {
          return Promise.resolve(null);
        },
        absorbEvent(): Promise<null> {
          return Promise.resolve(null);
        },
        stopGuildSessions(): Promise<void> {
          return Promise.resolve();
        },
        deleteExpired(): Promise<number> {
          return Promise.resolve(0);
        }
      } as unknown as RaidSessionService,
      clock: {
        now(): Date {
          return options.clockNow ?? systemClock.now();
        }
      }
    })
  };
}

describe("ProcessMessageService", () => {
  it("deletes and logs a first suspicious event without punishing", async () => {
    const settings = {
      ...buildDefaultGuildSettings("100"),
      enabled: true,
      logChannelId: "500"
    };
    const calls: string[] = [];
    const harness = service(settings);

    const outcome = await harness.instance.process({
      observedMessage: observedMessage(),
      actor: actor(),
      adapterFactory: () => adapter(calls)
    });

    expect(outcome?.results.delete.status).toBe("SUCCESS");
    expect(outcome?.results.punishment.status).toBe("SKIPPED");
    expect(outcome?.results.modLog.status).toBe("SUCCESS");
    expect(calls).toEqual(["delete", "log"]);
    expect(harness.incidents).toHaveLength(1);
    expect(harness.sanctions).toHaveLength(0);
    expect(harness.audits).toHaveLength(1);
  });

  it("ignores disabled guild settings", async () => {
    const calls: string[] = [];
    const harness = service({ ...buildDefaultGuildSettings("100"), enabled: false });

    const outcome = await harness.instance.process({
      observedMessage: observedMessage(),
      actor: actor(),
      adapterFactory: () => adapter(calls)
    });

    expect(outcome).toBeNull();
    expect(calls).toEqual([]);
  });

  it("ignores disabled channel policy", async () => {
    const calls: string[] = [];
    const harness = service(
      { ...buildDefaultGuildSettings("100"), enabled: true },
      {
        channelPolicy: "DISABLED"
      }
    );

    const outcome = await harness.instance.process({
      observedMessage: observedMessage(),
      actor: actor(),
      adapterFactory: () => adapter(calls)
    });

    expect(outcome).toBeNull();
    expect(calls).toEqual([]);
  });

  it("logs monitor policy incidents without delete or punishment", async () => {
    const calls: string[] = [];
    const harness = service(
      { ...buildDefaultGuildSettings("100"), enabled: true },
      {
        channelPolicy: "MONITOR"
      }
    );

    const outcome = await harness.instance.process({
      observedMessage: observedMessage(),
      actor: actor(),
      adapterFactory: () => adapter(calls)
    });

    expect(outcome?.results.delete.code).toBe("delete_not_requested");
    expect(outcome?.results.punishment.code).toBe("punishment_not_requested");
    expect(outcome?.results.modLog.status).toBe("SUCCESS");
    expect(calls).toEqual(["log"]);
    expect(harness.sanctions).toHaveLength(0);
  });

  it("skips equivalent punishment when a confirmed repeat hits an active sanction cooldown", async () => {
    const calls: string[] = [];
    const harness = service(
      { ...buildDefaultGuildSettings("100"), enabled: true },
      {
        activeSanctionId: "existing-sanction",
        correlationStage: "CONFIRMED",
        triggeredSignals: ["SAME_ACTOR_EXACT_FINGERPRINT"]
      }
    );

    const outcome = await harness.instance.process({
      observedMessage: observedMessage(),
      actor: actor(),
      adapterFactory: () => adapter(calls)
    });

    expect(outcome?.sanctionId).toBe("existing-sanction");
    expect(outcome?.results.punishment.code).toBe("cooldown_active");
    expect(calls).toEqual(["delete", "log"]);
    expect(harness.sanctions).toHaveLength(0);
  });

  it("keeps actions independent when delete fails and confirmed-repeat punishment succeeds", async () => {
    const calls: string[] = [];
    const harness = service(
      { ...buildDefaultGuildSettings("100"), enabled: true },
      {
        correlationStage: "CONFIRMED",
        triggeredSignals: ["SAME_ACTOR_EXACT_FINGERPRINT"]
      }
    );

    const outcome = await harness.instance.process({
      observedMessage: observedMessage(),
      actor: actor(),
      adapterFactory: () =>
        adapter(calls, {
          deleteMessage(): Promise<ActionResult> {
            calls.push("delete");
            return Promise.resolve(action("FAILED", "delete_failed"));
          }
        })
    });

    expect(outcome?.results.delete.status).toBe("FAILED");
    expect(outcome?.results.punishment.status).toBe("SUCCESS");
    expect(outcome?.results.modLog.status).toBe("SUCCESS");
    expect(calls).toEqual(["delete", "punish", "log"]);
  });

  it("deduplicates before destructive actions for duplicate incidents", async () => {
    const settings = { ...buildDefaultGuildSettings("100"), enabled: true };
    const calls: string[] = [];
    const harness = service(settings, { inserted: false });

    const outcome = await harness.instance.process({
      observedMessage: observedMessage(),
      actor: actor(),
      adapterFactory: () => adapter(calls)
    });

    expect(outcome?.results.persistence.code).toBe("duplicate_incident");
    expect(calls).toEqual([]);
  });

  it("returns null when detection does not match", async () => {
    const settings = { ...buildDefaultGuildSettings("100"), enabled: true };
    const harness = service(settings);

    const outcome = await harness.instance.process({
      observedMessage: observedMessage({
        mentionedEveryone: false,
        content: "ordinary message"
      }),
      actor: actor(),
      adapterFactory: () => adapter([])
    });

    expect(outcome).toBeNull();
  });

  it("persists protected role mention IDs for manual role detection", async () => {
    const settings = { ...buildDefaultGuildSettings("100"), enabled: true };
    const harness = service(settings, {
      protectedRoles: [{ guildId: "100", roleId: "900" }]
    });

    const outcome = await harness.instance.process({
      observedMessage: observedMessage({
        mentionedEveryone: false,
        mentionedRoleIds: ["900"]
      }),
      actor: actor(),
      adapterFactory: () => adapter([])
    });

    expect(outcome?.detection.detected).toBe(true);
    expect(harness.incidents).toHaveLength(1);
    expect(
      (harness.incidents[0] as { mentionedRoleIds: readonly string[] }).mentionedRoleIds
    ).toEqual(["900"]);
  });

  it("skips every action for explicit ALLOW trust policy", async () => {
    const calls: string[] = [];
    const settings = { ...buildDefaultGuildSettings("100"), enabled: true };
    const harness = service(settings, {
      trustedActors: [{ guildId: "100", actorId: "trusted", actorType: "ROLE", policy: "ALLOW" }]
    });

    const outcome = await harness.instance.process({
      observedMessage: observedMessage(),
      actor: actor({ roleIds: ["trusted"] }),
      adapterFactory: () => adapter(calls)
    });

    expect(outcome).toBeNull();
    expect(calls).toEqual([]);
    expect(harness.incidents).toHaveLength(0);
  });

  it("uses each custom escalation step window when choosing confirmed punishment", async () => {
    const now = new Date("2026-07-17T12:00:00.000Z");
    const settings: GuildSettings = {
      ...buildDefaultGuildSettings("100"),
      enabled: true,
      escalationMode: "CUSTOM"
    };
    const harness = service(settings, {
      correlationStage: "CONFIRMED",
      triggeredSignals: ["SAME_ACTOR_EXACT_FINGERPRINT"],
      clockNow: now,
      escalationSteps: [
        {
          id: "step-1",
          guildId: "100",
          orderIndex: 0,
          thresholdCount: 2,
          windowDays: 1,
          punishmentType: "TIMEOUT",
          durationSeconds: 60,
          enabled: true
        },
        {
          id: "step-2",
          guildId: "100",
          orderIndex: 1,
          thresholdCount: 2,
          windowDays: 30,
          punishmentType: "KICK",
          durationSeconds: null,
          enabled: true
        }
      ],
      confirmedCountResolver: (since) =>
        since.getTime() >= now.getTime() - 2 * 24 * 60 * 60 * 1_000 ? 0 : 1
    });

    const outcome = await harness.instance.process({
      observedMessage: observedMessage(),
      actor: actor(),
      adapterFactory: () => adapter([])
    });

    expect(outcome?.plan.punishmentType).toBe("KICK");
  });
});
