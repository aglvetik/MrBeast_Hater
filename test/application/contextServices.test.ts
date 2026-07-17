import { describe, expect, it, vi } from "vitest";

import { BatchedActivityTracker } from "../../src/application/services/activityTracker.js";
import { CorrelationService } from "../../src/application/services/correlationService.js";
import { RaidSessionService } from "../../src/application/services/raidSessionService.js";
import type {
  ActivityRepository,
  RaidSessionRecord,
  RaidSessionRepository,
  RecentDetectionEventRepository
} from "../../src/infrastructure/database/repositories.js";

describe("context-aware application services", () => {
  it("batches activity updates, flushes before reads, and stops cleanly", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-17T12:00:00.000Z"));

    const actorUpserts: unknown[] = [];
    const channelUpserts: unknown[] = [];
    const getActorProfile = vi.fn().mockResolvedValue({
      actorId: "actor-1",
      firstObservedAt: null,
      lastObservedAt: null,
      activeDays: 1,
      messageCount: 2,
      recentUniqueChannels: 1,
      priorLegitimatePublisherPosts: 1,
      priorConfirmedIncidents: 1,
      priorFalsePositiveCorrections: 1,
      lastActivityInChannelAt: null,
      activityClass: "KNOWN"
    });
    const getChannelProfile = vi.fn().mockResolvedValue({
      channelId: "channel-1",
      messageCount: 2,
      protectedVisualCount: 1,
      knownPublisherCount: 1,
      lastProtectedVisualAt: new Date("2026-07-17T11:59:00.000Z"),
      isRestricted: true,
      isAnnouncement: true,
      isQuiet: true,
      contextLabel: "announcement channel"
    });
    const repository = {
      upsertActorBucket(input: unknown): Promise<void> {
        actorUpserts.push(input);
        return Promise.resolve();
      },
      upsertChannelBucket(input: unknown): Promise<void> {
        channelUpserts.push(input);
        return Promise.resolve();
      },
      getActorProfile,
      getChannelProfile
    } as unknown as ActivityRepository;

    const tracker = new BatchedActivityTracker(repository, 30);
    tracker.recordMessage({
      guildId: "guild-1",
      actorId: "actor-1",
      channelId: "channel-1",
      happenedAt: new Date("2026-07-17T11:59:00.000Z"),
      protectedVisualCandidate: true,
      legitimatePublisherPost: true,
      confirmedIncident: true,
      falsePositiveCorrection: false,
      channelIsRestricted: true,
      channelIsAnnouncement: true
    });
    tracker.recordMessage({
      guildId: "guild-1",
      actorId: "actor-1",
      channelId: "channel-1",
      happenedAt: new Date("2026-07-17T11:59:30.000Z"),
      protectedVisualCandidate: false,
      legitimatePublisherPost: false,
      confirmedIncident: false,
      falsePositiveCorrection: true,
      channelIsRestricted: false,
      channelIsAnnouncement: false
    });

    const actorProfile = await tracker.getActorProfile("guild-1", "actor-1", "channel-1");
    const channelProfile = await tracker.getChannelProfile("guild-1", "channel-1");

    expect(actorProfile.activityClass).toBe("KNOWN");
    expect(channelProfile.channelId).toBe("channel-1");
    expect(actorUpserts).toHaveLength(1);
    expect(channelUpserts).toHaveLength(1);
    expect(actorUpserts[0]).toMatchObject({
      guildId: "guild-1",
      actorId: "actor-1",
      messageCount: 2,
      protectedVisualCount: 1,
      legitimatePublisherPosts: 1,
      confirmedIncidentCount: 1,
      falsePositiveCorrections: 1,
      lastChannelId: "channel-1"
    });
    expect(channelUpserts[0]).toMatchObject({
      guildId: "guild-1",
      channelId: "channel-1",
      messageCount: 2,
      protectedVisualCount: 1,
      knownPublisherCount: 1,
      isRestricted: false,
      isAnnouncement: false
    });
    expect(getActorProfile).toHaveBeenCalledWith(
      "guild-1",
      "actor-1",
      "channel-1",
      new Date("2026-06-17T12:00:00.000Z"),
      new Date("2026-07-17T12:00:00.000Z")
    );
    expect(getChannelProfile).toHaveBeenCalledWith(
      "guild-1",
      "channel-1",
      new Date("2026-06-17T12:00:00.000Z")
    );

    await tracker.flush();
    expect(actorUpserts).toHaveLength(1);
    expect(channelUpserts).toHaveLength(1);

    tracker.recordMessage({
      guildId: "guild-1",
      actorId: "actor-1",
      channelId: "channel-2",
      happenedAt: new Date("2026-07-17T12:00:00.000Z"),
      protectedVisualCandidate: false,
      legitimatePublisherPost: false,
      confirmedIncident: false,
      falsePositiveCorrection: false,
      channelIsRestricted: false,
      channelIsAnnouncement: false
    });
    await tracker.stop();
    expect(actorUpserts).toHaveLength(2);
    expect(channelUpserts).toHaveLength(2);

    vi.useRealTimers();
  });

  it("summarizes correlation windows and persists expiry times", async () => {
    const listMatchingRecent = vi.fn().mockResolvedValue([
      {
        id: "recent-1",
        guildId: "guild-1",
        actorId: "actor-1",
        channelId: "channel-2",
        categoryId: "category-1",
        categoryPosition: 1,
        parentPosition: 1,
        channelPosition: 1,
        exactFingerprint: "exact-1",
        structuralFingerprint: "struct-1",
        protectedMentionClass: "EVERYONE",
        score: 85,
        decision: "DELETE_ONLY",
        eventSource: "CREATE",
        createdAt: new Date("2026-07-17T11:59:45.000Z")
      }
    ]);
    const insert = vi.fn().mockResolvedValue(undefined);
    const deleteExpired = vi.fn().mockResolvedValue(3);
    const repository = {
      listMatchingRecent,
      insert,
      deleteExpired
    } as unknown as RecentDetectionEventRepository;

    const service = new CorrelationService(repository);
    const createdAt = new Date("2026-07-17T12:00:00.000Z");
    const summarized = await service.summarize({
      guildId: "guild-1",
      actorId: "actor-1",
      channelId: "channel-3",
      categoryId: "category-1",
      categoryPosition: 1,
      parentPosition: 1,
      channelPosition: 2,
      exactFingerprint: "exact-1",
      structuralFingerprint: "struct-1",
      protectedMentionClass: "EVERYONE",
      score: 90,
      decision: "DELETE_ONLY",
      eventSource: "UPDATE",
      createdAt,
      windowSeconds: 30
    });

    expect(listMatchingRecent).toHaveBeenCalledWith(
      "guild-1",
      new Date("2026-07-17T11:59:30.000Z"),
      "exact-1",
      "struct-1",
      "EVERYONE"
    );
    expect(summarized.current.id).toBeTruthy();
    expect(summarized.summary.triggeredSignals).toEqual(
      expect.arrayContaining([
        "SAME_ACTOR_EXACT_FINGERPRINT",
        "SECOND_EVENT_OTHER_CHANNEL",
        "ADJACENT_CHANNEL_MOVEMENT"
      ])
    );

    await service.record(summarized.current, 45);
    expect(insert).toHaveBeenCalledWith(summarized.current, new Date(createdAt.getTime() + 45_000));
    expect(await service.deleteExpired(createdAt)).toBe(3);
  });

  it("matches, creates, updates, and expires raid sessions", async () => {
    const now = new Date("2026-07-17T12:00:00.000Z");
    const existingSession: RaidSessionRecord = {
      id: "session-1",
      guildId: "guild-1",
      state: "ACTIVE",
      triggeringRule: "CORRELATED_REPEAT",
      exactFingerprints: ["exact-1"],
      structuralFingerprints: ["struct-1"],
      protectedMentionClasses: ["EVERYONE"],
      actorIds: ["actor-1"],
      channelIds: ["channel-1"],
      overridePayload: null,
      startedAt: new Date("2026-07-17T11:58:00.000Z"),
      lastMatchedAt: new Date("2026-07-17T11:59:00.000Z"),
      expiresAt: new Date("2026-07-17T12:03:00.000Z"),
      createdAt: new Date("2026-07-17T11:58:00.000Z"),
      updatedAt: new Date("2026-07-17T11:59:00.000Z")
    };

    const listActive = vi.fn().mockResolvedValue([existingSession]);
    const upsert = vi.fn().mockResolvedValue(undefined);
    const expireGuildSessions = vi.fn().mockResolvedValue(undefined);
    const deleteExpired = vi.fn().mockResolvedValue(2);
    const repository = {
      listActive,
      upsert,
      expireGuildSessions,
      deleteExpired
    } as unknown as RaidSessionRepository;

    const service = new RaidSessionService(repository);
    expect(await service.findMatching("guild-1", now, "exact-1", null, null)).toEqual(
      existingSession
    );
    expect(await service.findMatching("guild-1", now, null, "struct-1", null)).toEqual(
      existingSession
    );
    expect(await service.findMatching("guild-1", now, null, null, "EVERYONE")).toEqual(
      existingSession
    );

    listActive.mockResolvedValueOnce([]);
    expect(
      await service.absorbEvent({
        guildId: "guild-1",
        now,
        durationSeconds: 300,
        correlation: {
          stage: "FIRST",
          relatedEvents: [],
          coordinatedActorIds: [],
          triggeredSignals: []
        },
        exactFingerprint: "exact-2",
        structuralFingerprint: "struct-2",
        protectedMentionClass: "HERE",
        actorId: "actor-2",
        channelId: "channel-2",
        triggeringRule: "VISUAL_MASS_PING"
      })
    ).toBeNull();

    listActive.mockResolvedValueOnce([]);
    const createdSession = await service.absorbEvent({
      guildId: "guild-1",
      now,
      durationSeconds: 300,
      correlation: {
        stage: "CONFIRMED",
        relatedEvents: [],
        coordinatedActorIds: ["actor-3"],
        triggeredSignals: ["COORDINATED_MULTI_ACTOR_RAID"]
      },
      exactFingerprint: "exact-3",
      structuralFingerprint: "struct-3",
      protectedMentionClass: "EVERYONE",
      actorId: "actor-2",
      channelId: "channel-2",
      triggeringRule: "COORDINATED_MULTI_ACTOR_RAID"
    });
    expect(createdSession?.actorIds).toEqual(["actor-2", "actor-3"]);
    expect(createdSession?.channelIds).toEqual(["channel-2"]);

    listActive.mockResolvedValueOnce([existingSession]);
    const updatedSession = await service.absorbEvent({
      guildId: "guild-1",
      now,
      durationSeconds: 300,
      correlation: {
        stage: "CONFIRMED",
        relatedEvents: [],
        coordinatedActorIds: ["actor-4"],
        triggeredSignals: ["SAME_ACTOR_EXACT_FINGERPRINT"]
      },
      exactFingerprint: "exact-9",
      structuralFingerprint: "struct-9",
      protectedMentionClass: "EVERYONE",
      actorId: "actor-2",
      channelId: "channel-4",
      triggeringRule: "RAID_SESSION_MATCH"
    });
    expect(updatedSession?.exactFingerprints).toEqual(["exact-1", "exact-9"]);
    expect(updatedSession?.structuralFingerprints).toEqual(["struct-1", "struct-9"]);
    expect(updatedSession?.protectedMentionClasses).toEqual(["EVERYONE"]);
    expect(updatedSession?.actorIds).toEqual(["actor-1", "actor-2", "actor-4"]);
    expect(updatedSession?.channelIds).toEqual(["channel-1", "channel-4"]);
    expect(upsert).toHaveBeenCalledTimes(2);

    await service.stopGuildSessions("guild-1", now);
    expect(expireGuildSessions).toHaveBeenCalledWith("guild-1", now);
    expect(await service.deleteExpired(now)).toBe(2);
  });
});
