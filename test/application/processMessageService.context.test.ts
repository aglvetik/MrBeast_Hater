import { describe, expect, it } from "vitest";

import { InMemoryActorLock } from "../../src/application/locks/inMemoryActorLock.js";
import { BurstTracker } from "../../src/application/services/burstTracker.js";
import type { ActionResult } from "../../src/application/services/actionTypes.js";
import type { ActivityTracker } from "../../src/application/services/activityTracker.js";
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
  ActorActivityProfile,
  ActorContext,
  ChannelActivityProfile,
  GuildSettings,
  ProtectedRole,
  RoleRiskProfile,
  ScopedActorPolicy
} from "../../src/domain/policy/types.js";
import type {
  ActorPolicyRepository,
  AuditRepository,
  ChannelPolicyRepository,
  EscalationRepository,
  GuildSettingsRepository,
  IncidentRepository,
  ProtectedRoleRepository,
  RaidSessionRecord,
  RoleRiskProfileRepository,
  SanctionRepository,
  TrustedActorRepository
} from "../../src/infrastructure/database/repositories.js";

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
    channelIsAnnouncement: true,
    channelIsRestricted: true,
    ...overrides
  };
}

function actor(overrides: Partial<ActorContext> = {}): ActorContext {
  return {
    actorId: "400",
    actorKind: "USER",
    roleIds: [],
    isAdministrator: false,
    canManageGuild: false,
    isGuildOwner: false,
    createdTimestamp: null,
    joinedTimestamp: null,
    ...overrides
  };
}

function adapter(log: string[]): ModerationAdapter {
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
    }
  };
}

function activityProfile(overrides: Partial<ActorActivityProfile> = {}): ActorActivityProfile {
  return {
    actorId: "400",
    firstObservedAt: null,
    lastObservedAt: null,
    activeDays: 0,
    messageCount: 0,
    recentUniqueChannels: 0,
    priorLegitimatePublisherPosts: 0,
    priorConfirmedIncidents: 0,
    priorFalsePositiveCorrections: 0,
    lastActivityInChannelAt: null,
    activityClass: "UNKNOWN",
    ...overrides
  };
}

function channelProfile(overrides: Partial<ChannelActivityProfile> = {}): ChannelActivityProfile {
  return {
    channelId: "200",
    messageCount: 0,
    protectedVisualCount: 0,
    knownPublisherCount: 0,
    lastProtectedVisualAt: null,
    isRestricted: true,
    isAnnouncement: true,
    isQuiet: true,
    contextLabel: "announcement channel",
    ...overrides
  };
}

function scopedPublisherPolicy(): ScopedActorPolicy {
  const now = new Date("2026-07-17T12:00:00.000Z");
  return {
    id: "policy-1",
    guildId: "100",
    targetId: "400",
    targetType: "USER",
    policy: "SCOPED_PUBLISHER",
    scopeType: "CHANNEL",
    scopeId: "200",
    expiresAt: null,
    createdAt: now,
    updatedAt: now
  };
}

function raidSessionRecord(): RaidSessionRecord {
  const now = new Date("2026-07-17T12:00:00.000Z");
  return {
    id: "raid-1",
    guildId: "100",
    state: "ACTIVE",
    triggeringRule: "RAID_SESSION_MATCH",
    exactFingerprints: ["fp-1"],
    structuralFingerprints: ["sf-1"],
    protectedMentionClasses: ["ROLE:HIGH:900"],
    actorIds: ["401"],
    channelIds: ["200"],
    overridePayload: null,
    startedAt: now,
    lastMatchedAt: now,
    expiresAt: new Date(now.getTime() + 300_000),
    createdAt: now,
    updatedAt: now
  };
}

function createService(
  settings: GuildSettings,
  options: {
    readonly actorPolicies?: readonly ScopedActorPolicy[];
    readonly protectedRoles?: readonly ProtectedRole[];
    readonly roleRiskProfiles?: readonly RoleRiskProfile[];
    readonly activityTracker?: ActivityTracker;
    readonly correlationService?: CorrelationService;
    readonly raidSessionService?: RaidSessionService;
    readonly useDefaultCorrelationService?: boolean;
    readonly useDefaultRaidSessionService?: boolean;
    readonly now?: Date;
  } = {}
): {
  readonly burstTracker: BurstTracker;
  readonly incidents: unknown[];
  readonly sanctions: unknown[];
  readonly instance: ProcessMessageService;
} {
  const incidents: unknown[] = [];
  const sanctions: unknown[] = [];
  const burstTracker = new BurstTracker();

  const fallbackCorrelationService = {
    summarize(payload: Parameters<CorrelationService["summarize"]>[0]) {
      return Promise.resolve({
        current: {
          ...payload,
          id: "corr-1"
        },
        summary: {
          stage: "FIRST" as const,
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

  const fallbackRaidSessionService = {
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

  const dependencies = {
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
    roleRiskProfileRepository: {
      listByGuildId(): Promise<readonly RoleRiskProfile[]> {
        return Promise.resolve(options.roleRiskProfiles ?? []);
      }
    } as unknown as RoleRiskProfileRepository,
    channelPolicyRepository: {
      getForChannel(): Promise<"ENFORCE"> {
        return Promise.resolve("ENFORCE");
      }
    } as unknown as ChannelPolicyRepository,
    trustedActorRepository: {
      listByGuildId(): Promise<readonly []> {
        return Promise.resolve([]);
      }
    } as unknown as TrustedActorRepository,
    actorPolicyRepository: {
      listByGuildId(): Promise<readonly ScopedActorPolicy[]> {
        return Promise.resolve(options.actorPolicies ?? []);
      }
    } as unknown as ActorPolicyRepository,
    escalationRepository: {
      listByGuildId(): Promise<readonly []> {
        return Promise.resolve([]);
      }
    } as unknown as EscalationRepository,
    incidentRepository: {
      countConfirmedByActorWithinWindow(): Promise<number> {
        return Promise.resolve(0);
      },
      countRecentByActor(): Promise<number> {
        return Promise.resolve(0);
      },
      reserve(record: unknown): Promise<{ readonly inserted: boolean }> {
        incidents.push(record);
        return Promise.resolve({ inserted: true });
      },
      finalize(): Promise<void> {
        return Promise.resolve();
      }
    } as unknown as IncidentRepository,
    sanctionRepository: {
      findActiveCooldown(): Promise<null> {
        return Promise.resolve(null);
      },
      insert(record: unknown): Promise<void> {
        sanctions.push(record);
        return Promise.resolve();
      }
    } as unknown as SanctionRepository,
    auditRepository: {
      append(): Promise<void> {
        return Promise.resolve();
      }
    } as unknown as AuditRepository,
    actorLock: new InMemoryActorLock(),
    burstTracker,
    clock: {
      now(): Date {
        return options.now ?? new Date("2026-07-17T12:00:00.000Z");
      }
    },
    ...(options.activityTracker ? { activityTracker: options.activityTracker } : {}),
    ...(!options.useDefaultCorrelationService
      ? {
          correlationService: options.correlationService ?? fallbackCorrelationService
        }
      : {}),
    ...(!options.useDefaultRaidSessionService
      ? {
          raidSessionService: options.raidSessionService ?? fallbackRaidSessionService
        }
      : {})
  } as ConstructorParameters<typeof ProcessMessageService>[0];

  return {
    burstTracker,
    incidents,
    sanctions,
    instance: new ProcessMessageService(dependencies)
  };
}

describe("ProcessMessageService context-aware behavior", () => {
  it("allows scoped publishers in-scope with default correlation and raid services", async () => {
    const recordedMessages: unknown[] = [];
    const tracker = {
      recordMessage(input: unknown): void {
        recordedMessages.push(input);
      },
      getActorProfile(): Promise<ActorActivityProfile> {
        return Promise.resolve(
          activityProfile({
            messageCount: 20,
            activeDays: 10,
            lastObservedAt: new Date("2026-07-16T12:00:00.000Z"),
            lastActivityInChannelAt: new Date("2026-07-16T12:00:00.000Z"),
            activityClass: "ESTABLISHED"
          })
        );
      },
      getChannelProfile(): Promise<ChannelActivityProfile> {
        return Promise.resolve(
          channelProfile({
            isRestricted: true,
            isAnnouncement: true,
            isQuiet: false
          })
        );
      },
      flush(): Promise<void> {
        return Promise.resolve();
      },
      stop(): Promise<void> {
        return Promise.resolve();
      }
    } as ActivityTracker;
    const calls: string[] = [];
    const harness = createService(
      {
        ...buildDefaultGuildSettings("100"),
        enabled: true
      },
      {
        actorPolicies: [scopedPublisherPolicy()],
        activityTracker: tracker,
        useDefaultCorrelationService: true,
        useDefaultRaidSessionService: true
      }
    );

    const outcome = await harness.instance.process({
      observedMessage: observedMessage(),
      actor: actor(),
      adapterFactory: () => adapter(calls)
    });

    expect(outcome).toBeNull();
    expect(calls).toEqual([]);
    expect(harness.incidents).toHaveLength(0);
    expect(harness.sanctions).toHaveLength(0);
    expect(harness.burstTracker.getRecent("100", "400", 30, 1_000)).toHaveLength(1);
    expect(recordedMessages).toContainEqual(
      expect.objectContaining({
        protectedVisualCandidate: true,
        legitimatePublisherPost: true
      })
    );
  });

  it("keeps first suspicious publisher posts at observation-only even when role risk is high", async () => {
    const recordedMessages: unknown[] = [];
    const tracker = {
      recordMessage(input: unknown): void {
        recordedMessages.push(input);
      },
      getActorProfile(): Promise<ActorActivityProfile> {
        return Promise.resolve(activityProfile({ activityClass: "KNOWN" }));
      },
      getChannelProfile(): Promise<ChannelActivityProfile> {
        return Promise.resolve(
          channelProfile({
            isRestricted: false,
            isAnnouncement: false,
            isQuiet: true
          })
        );
      },
      flush(): Promise<void> {
        return Promise.resolve();
      },
      stop(): Promise<void> {
        return Promise.resolve();
      }
    } as ActivityTracker;
    const harness = createService(
      {
        ...buildDefaultGuildSettings("100"),
        enabled: true
      },
      {
        actorPolicies: [scopedPublisherPolicy()],
        protectedRoles: [{ guildId: "100", roleId: "900" }],
        roleRiskProfiles: [{ guildId: "100", roleId: "900", riskLevel: "HIGH" }],
        activityTracker: tracker
      }
    );

    const outcome = await harness.instance.process({
      observedMessage: observedMessage({
        mentionedRoleIds: ["900"],
        attachments: [
          { contentType: "image/png", fileName: "a.png" },
          { contentType: "image/gif", fileName: "b.gif" },
          { contentType: "video/mp4", fileName: "c.mp4" },
          { contentType: "image/png", fileName: "d.png" }
        ]
      }),
      actor: actor(),
      adapterFactory: () => adapter([])
    });

    expect(outcome).toBeNull();
    expect(harness.incidents).toHaveLength(0);
    expect(harness.burstTracker.getRecent("100", "400", 30, 1_000)).toHaveLength(1);
    expect(recordedMessages).toContainEqual(
      expect.objectContaining({
        protectedVisualCandidate: true,
        legitimatePublisherPost: false
      })
    );
  });

  it("uses role risk profiles and raid-session matches to quarantine strong first-time actors", async () => {
    const calls: string[] = [];
    const harness = createService(
      {
        ...buildDefaultGuildSettings("100"),
        enabled: true,
        firstStrikeBehavior: "QUARANTINE_HIGH_CONFIDENCE",
        quarantineThreshold: 90,
        enforceThreshold: 200
      },
      {
        protectedRoles: [{ guildId: "100", roleId: "900" }],
        roleRiskProfiles: [{ guildId: "100", roleId: "900", riskLevel: "HIGH" }],
        correlationService: {
          summarize(payload: Parameters<CorrelationService["summarize"]>[0]) {
            return Promise.resolve({
              current: {
                ...payload,
                id: "corr-2"
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
        } as unknown as CorrelationService,
        raidSessionService: {
          findMatching(): Promise<RaidSessionRecord | null> {
            return Promise.resolve(raidSessionRecord());
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
        } as unknown as RaidSessionService
      }
    );

    const outcome = await harness.instance.process({
      observedMessage: observedMessage({
        mentionedEveryone: false,
        mentionedRoleIds: ["900"],
        channelIsAnnouncement: false,
        channelIsRestricted: false
      }),
      actor: actor({
        createdTimestamp: new Date("2026-07-16T12:00:00.000Z").getTime(),
        joinedTimestamp: new Date("2026-07-16T12:00:00.000Z").getTime()
      }),
      adapterFactory: () => adapter(calls)
    });

    expect(outcome?.plan.decision).toBe("QUARANTINE");
    expect(outcome?.results.delete.status).toBe("SUCCESS");
    expect(outcome?.results.punishment.status).toBe("SUCCESS");
    expect(outcome?.detection.ruleId).toBe("RAID_SESSION_MATCH");
    expect(outcome?.detection.signals.map((signal) => signal.id)).toEqual(
      expect.arrayContaining(["MENTION_ROLE_HIGH", "ACTIVE_RAID_SESSION"])
    );
    expect(harness.sanctions).toHaveLength(1);
    expect(calls).toEqual(["delete", "punish", "log"]);
  });
});
