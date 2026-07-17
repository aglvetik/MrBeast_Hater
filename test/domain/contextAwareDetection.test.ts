import { describe, expect, it } from "vitest";

import { buildDefaultGuildSettings } from "../../src/config/constants.js";
import { assessActivity, describeChannelContext } from "../../src/domain/detection/activity.js";
import { summarizeCorrelation } from "../../src/domain/detection/correlation.js";
import { evaluateRisk } from "../../src/domain/detection/riskEngine.js";
import type { CorrelationEvent, DetectionResult } from "../../src/domain/detection/types.js";
import type {
  ActorActivityProfile,
  ChannelActivityProfile,
  GuildSettings
} from "../../src/domain/policy/types.js";

function settings(overrides: Partial<GuildSettings> = {}): GuildSettings {
  return {
    ...buildDefaultGuildSettings("guild-1"),
    enabled: true,
    ...overrides
  };
}

function actorProfile(overrides: Partial<ActorActivityProfile> = {}): ActorActivityProfile {
  return {
    actorId: "actor-1",
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
    channelId: "channel-1",
    messageCount: 0,
    protectedVisualCount: 0,
    knownPublisherCount: 0,
    lastProtectedVisualAt: null,
    isRestricted: false,
    isAnnouncement: false,
    isQuiet: true,
    contextLabel: "text channel",
    ...overrides
  };
}

function detection(overrides: Partial<DetectionResult> = {}): DetectionResult {
  return {
    detected: true,
    candidate: true,
    ruleId: "VISUAL_MASS_PING",
    confidence: "MEDIUM",
    signals: [],
    protectedMentions: [],
    protectedMentionClass: null,
    media: {
      imageAttachments: 1,
      gifAttachments: 0,
      videoAttachments: 0,
      embedImages: 0,
      embedThumbnails: 0,
      stickers: 0,
      totalVisualCount: 1,
      attachmentCount: 1,
      extensionSummary: ["png"],
      sizeBucketSummary: ["small"]
    },
    normalizedText: {
      totalLength: 0,
      informationCharCount: 0,
      wordCount: 0,
      urlCount: 0,
      emojiCount: 0,
      punctuationRatio: 0,
      isLowInformation: true,
      onlyLinksEmojiPunctuationOrWhitespace: true
    },
    ...overrides
  };
}

function event(overrides: Partial<CorrelationEvent> = {}): CorrelationEvent {
  return {
    id: "event-1",
    guildId: "guild-1",
    actorId: "actor-1",
    channelId: "channel-1",
    categoryId: "category-1",
    categoryPosition: 1,
    parentPosition: 1,
    channelPosition: 1,
    exactFingerprint: "exact-1",
    structuralFingerprint: "struct-1",
    protectedMentionClass: "EVERYONE",
    score: 80,
    decision: "DELETE_ONLY",
    eventSource: "CREATE",
    createdAt: new Date("2026-07-17T12:00:00.000Z"),
    ...overrides
  };
}

describe("context-aware detection helpers", () => {
  it("assesses warmup, strong identity, dormant history, and channel context", () => {
    const now = new Date("2026-07-17T12:00:00.000Z");
    const warmupAssessment = assessActivity(
      settings({
        guildWarmupStartedAt: new Date("2026-07-16T12:00:00.000Z"),
        warmupDays: 7
      }),
      {
        actorId: "actor-1",
        actorKind: "USER",
        roleIds: [],
        isAdministrator: false,
        canManageGuild: false,
        isGuildOwner: false,
        createdTimestamp: now.getTime() - 60 * 60 * 1_000,
        joinedTimestamp: now.getTime() - 60 * 60 * 1_000
      },
      actorProfile({ messageCount: 1 }),
      now
    );

    expect(warmupAssessment.warmupActive).toBe(true);
    expect(warmupAssessment.hasStrongIdentitySignal).toBe(true);
    expect(warmupAssessment.lowActivityAfterWarmup).toBe(false);
    expect(warmupAssessment.noChannelHistoryAfterWarmup).toBe(false);

    const dormantAssessment = assessActivity(
      settings({
        guildWarmupStartedAt: new Date("2026-06-01T12:00:00.000Z"),
        warmupDays: 7
      }),
      {
        actorId: "actor-1",
        actorKind: "USER",
        roleIds: [],
        isAdministrator: false,
        canManageGuild: false,
        isGuildOwner: false,
        createdTimestamp: now.getTime() - 90 * 24 * 60 * 60 * 1_000,
        joinedTimestamp: now.getTime() - 45 * 24 * 60 * 60 * 1_000
      },
      actorProfile({
        messageCount: 4,
        lastObservedAt: new Date("2026-06-01T12:00:00.000Z"),
        lastActivityInChannelAt: null,
        activityClass: "ESTABLISHED"
      }),
      now
    );

    expect(dormantAssessment.warmupActive).toBe(false);
    expect(dormantAssessment.lowActivityAfterWarmup).toBe(true);
    expect(dormantAssessment.noChannelHistoryAfterWarmup).toBe(true);
    expect(dormantAssessment.dormantActor).toBe(true);
    expect(dormantAssessment.establishedActor).toBe(true);

    expect(
      describeChannelContext(channelProfile({ isAnnouncement: true, isRestricted: true }))
    ).toBe("restricted announcement channel");
    expect(describeChannelContext(channelProfile({ isQuiet: true }))).toBe("quiet channel");
    expect(describeChannelContext(channelProfile({ isQuiet: false, isRestricted: false }))).toBe(
      "open general channel"
    );
    expect(
      describeChannelContext(
        channelProfile({
          isQuiet: false,
          isRestricted: true,
          contextLabel: "forum thread"
        })
      )
    ).toBe("forum thread");
  });

  it("summarizes same-actor correlation, traversal, and coordinated actors", () => {
    const firstSummary = summarizeCorrelation(event(), []);
    expect(firstSummary.stage).toBe("FIRST");
    expect(firstSummary.triggeredSignals).toEqual([]);

    const nearbyRepeat = summarizeCorrelation(event({ channelPosition: 3 }), [
      event({
        id: "event-2",
        channelId: "channel-2",
        channelPosition: 2
      })
    ]);
    expect(nearbyRepeat.stage).toBe("CONFIRMED");
    expect(nearbyRepeat.triggeredSignals).toEqual(
      expect.arrayContaining([
        "SAME_ACTOR_EXACT_FINGERPRINT",
        "SECOND_EVENT_OTHER_CHANNEL",
        "ADJACENT_CHANNEL_MOVEMENT"
      ])
    );

    const ascendingTraversal = summarizeCorrelation(event({ channelPosition: 3 }), [
      event({
        id: "event-3",
        exactFingerprint: null,
        structuralFingerprint: "struct-1",
        channelPosition: 1,
        createdAt: new Date("2026-07-17T11:59:40.000Z")
      }),
      event({
        id: "event-4",
        exactFingerprint: null,
        structuralFingerprint: "struct-1",
        channelPosition: 2,
        createdAt: new Date("2026-07-17T11:59:50.000Z")
      })
    ]);
    expect(ascendingTraversal.triggeredSignals).toContain("CHANNEL_TRAVERSAL_ASCENDING");
    expect(ascendingTraversal.triggeredSignals).toContain("SAME_ACTOR_STRUCTURAL_FINGERPRINT");

    const descendingTraversal = summarizeCorrelation(event({ channelPosition: 1 }), [
      event({
        id: "event-5",
        exactFingerprint: null,
        structuralFingerprint: "struct-1",
        channelPosition: 3,
        createdAt: new Date("2026-07-17T11:59:40.000Z")
      }),
      event({
        id: "event-6",
        exactFingerprint: null,
        structuralFingerprint: "struct-1",
        channelPosition: 2,
        createdAt: new Date("2026-07-17T11:59:50.000Z")
      })
    ]);
    expect(descendingTraversal.triggeredSignals).toContain("CHANNEL_TRAVERSAL_DESCENDING");

    const coordinated = summarizeCorrelation(event(), [
      event({
        id: "event-7",
        actorId: "actor-2",
        channelId: "channel-9"
      })
    ]);
    expect(coordinated.coordinatedActorIds).toEqual(["actor-2"]);
    expect(coordinated.triggeredSignals).toContain("COORDINATED_MULTI_ACTOR_RAID");
  });

  it("evaluates high-risk repeated raids and low-risk authorized announcements", () => {
    const now = new Date("2026-07-17T12:00:00.000Z");
    const repeatedRaid = evaluateRisk({
      baseDetection: detection({
        protectedMentions: [
          { kind: "EVERYONE" },
          { kind: "ROLE", roleId: "role-1", riskLevel: "HIGH" }
        ],
        normalizedText: {
          totalLength: 0,
          informationCharCount: 0,
          wordCount: 0,
          urlCount: 0,
          emojiCount: 0,
          punctuationRatio: 0,
          isLowInformation: true,
          onlyLinksEmojiPunctuationOrWhitespace: true,
          textClass: "VISUAL_ONLY",
          normalizedHash: "hash-1",
          linkHostnameHashes: ["domain-1"]
        },
        media: {
          imageAttachments: 2,
          gifAttachments: 1,
          videoAttachments: 1,
          embedImages: 0,
          embedThumbnails: 0,
          stickers: 0,
          totalVisualCount: 4,
          attachmentCount: 4,
          extensionSummary: ["gif", "png"],
          sizeBucketSummary: ["large"]
        }
      }),
      settings: settings(),
      actorProfile: actorProfile({
        messageCount: 1,
        lastObservedAt: new Date("2026-06-01T12:00:00.000Z"),
        activityClass: "NEW"
      }),
      channelProfile: channelProfile({
        isRestricted: false,
        isAnnouncement: false,
        isQuiet: true
      }),
      authorizedPublisherInScope: false,
      correlation: {
        stage: "CONFIRMED",
        relatedEvents: [],
        coordinatedActorIds: [],
        triggeredSignals: ["SAME_ACTOR_EXACT_FINGERPRINT", "SECOND_EVENT_OTHER_CHANNEL"]
      },
      activeRaidMatch: true,
      now,
      accountIsObjectivelyNew: true,
      joinIsObjectivelyNew: true
    });

    expect(repeatedRaid.suggestedDecision).toBe("ENFORCE");
    expect(repeatedRaid.score).toBeGreaterThanOrEqual(110);
    expect(repeatedRaid.explanation.positiveTotal).toBeGreaterThan(
      repeatedRaid.explanation.negativeTotal
    );
    expect(repeatedRaid.signals.map((signal) => signal.id)).toEqual(
      expect.arrayContaining([
        "MENTION_EVERYONE",
        "MENTION_ROLE_HIGH",
        "MULTIPLE_PROTECTED_TARGETS",
        "VISUAL_ONLY_TEXT",
        "MULTI_VISUAL",
        "LARGE_VISUAL_SET",
        "UNAUTHORIZED_SCOPE",
        "NEW_ACCOUNT",
        "RECENT_GUILD_JOIN",
        "DORMANT_ACTOR",
        "OPEN_GENERAL_CHANNEL",
        "QUIET_CHANNEL",
        "SAME_ACTOR_EXACT_FINGERPRINT",
        "SECOND_EVENT_OTHER_CHANNEL",
        "ACTIVE_RAID_SESSION"
      ])
    );

    const announcement = evaluateRisk({
      baseDetection: detection({
        protectedMentions: [{ kind: "HERE" }],
        normalizedText: {
          totalLength: 120,
          informationCharCount: 120,
          wordCount: 18,
          urlCount: 0,
          emojiCount: 0,
          punctuationRatio: 0.1,
          isLowInformation: false,
          onlyLinksEmojiPunctuationOrWhitespace: false,
          textClass: "MEANINGFUL",
          normalizedHash: "hash-2"
        }
      }),
      settings: settings(),
      actorProfile: actorProfile({
        messageCount: 40,
        activeDays: 12,
        lastObservedAt: new Date("2026-07-16T12:00:00.000Z"),
        lastActivityInChannelAt: new Date("2026-07-16T12:00:00.000Z"),
        activityClass: "ESTABLISHED"
      }),
      channelProfile: channelProfile({
        isAnnouncement: true,
        isRestricted: true,
        isQuiet: false
      }),
      authorizedPublisherInScope: true,
      correlation: {
        stage: "FIRST",
        relatedEvents: [],
        coordinatedActorIds: [],
        triggeredSignals: []
      },
      activeRaidMatch: false,
      now,
      accountIsObjectivelyNew: false,
      joinIsObjectivelyNew: false
    });

    expect(announcement.suggestedDecision).toBe("ALLOW");
    expect(announcement.explanation.channelContext).toBe("restricted announcement channel");
    expect(announcement.signals.map((signal) => signal.id)).toEqual(
      expect.arrayContaining([
        "MENTION_HERE",
        "SCOPED_PUBLISHER_IN_SCOPE",
        "MEANINGFUL_TEXT",
        "ESTABLISHED_ACTIVITY",
        "RESTRICTED_ANNOUNCEMENT_CHANNEL"
      ])
    );
  });

  it("maps threshold decisions across observe, log, delete, quarantine, and enforce", () => {
    const now = new Date("2026-07-17T12:00:00.000Z");
    const input = {
      baseDetection: detection({
        normalizedText: {
          totalLength: 4,
          informationCharCount: 4,
          wordCount: 1,
          urlCount: 0,
          emojiCount: 0,
          punctuationRatio: 0,
          isLowInformation: false,
          onlyLinksEmojiPunctuationOrWhitespace: false
        }
      }),
      actorProfile: actorProfile({
        messageCount: 20,
        activeDays: 3,
        lastObservedAt: new Date("2026-07-16T12:00:00.000Z"),
        lastActivityInChannelAt: new Date("2026-07-16T12:00:00.000Z"),
        activityClass: "KNOWN"
      }),
      channelProfile: channelProfile({
        isRestricted: false,
        isAnnouncement: false,
        isQuiet: true
      }),
      authorizedPublisherInScope: false,
      correlation: {
        stage: "FIRST" as const,
        relatedEvents: [],
        coordinatedActorIds: [],
        triggeredSignals: []
      },
      activeRaidMatch: false,
      now,
      accountIsObjectivelyNew: false,
      joinIsObjectivelyNew: false
    };

    const cases = [
      {
        thresholds: {
          observeThreshold: 50,
          logOnlyThreshold: 60,
          deleteThreshold: 70,
          quarantineThreshold: 80,
          enforceThreshold: 90
        },
        expected: "ALLOW"
      },
      {
        thresholds: {
          observeThreshold: 20,
          logOnlyThreshold: 60,
          deleteThreshold: 70,
          quarantineThreshold: 80,
          enforceThreshold: 90
        },
        expected: "OBSERVE"
      },
      {
        thresholds: {
          observeThreshold: 10,
          logOnlyThreshold: 20,
          deleteThreshold: 70,
          quarantineThreshold: 80,
          enforceThreshold: 90
        },
        expected: "LOG_ONLY"
      },
      {
        thresholds: {
          observeThreshold: 10,
          logOnlyThreshold: 15,
          deleteThreshold: 20,
          quarantineThreshold: 80,
          enforceThreshold: 90
        },
        expected: "DELETE_ONLY"
      },
      {
        thresholds: {
          observeThreshold: 10,
          logOnlyThreshold: 15,
          deleteThreshold: 30,
          quarantineThreshold: 20,
          enforceThreshold: 90
        },
        expected: "QUARANTINE"
      },
      {
        thresholds: {
          observeThreshold: 10,
          logOnlyThreshold: 15,
          deleteThreshold: 30,
          quarantineThreshold: 40,
          enforceThreshold: 20
        },
        expected: "ENFORCE"
      }
    ] as const;

    for (const testCase of cases) {
      expect(
        evaluateRisk({
          ...input,
          settings: settings(testCase.thresholds)
        }).suggestedDecision
      ).toBe(testCase.expected);
    }
  });
});
