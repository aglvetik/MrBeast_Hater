import type { ActorActivityProfile, ChannelActivityProfile } from "../../domain/policy/types.js";
import type { ActivityRepository } from "../../infrastructure/database/repositories.js";

export interface ActivityMessageInput {
  readonly guildId: string;
  readonly actorId: string;
  readonly channelId: string;
  readonly happenedAt: Date;
  readonly protectedVisualCandidate: boolean;
  readonly legitimatePublisherPost: boolean;
  readonly confirmedIncident: boolean;
  readonly falsePositiveCorrection: boolean;
  readonly channelIsRestricted: boolean;
  readonly channelIsAnnouncement: boolean;
}

export interface ActivityTracker {
  recordMessage(input: ActivityMessageInput): void;
  getActorProfile(
    guildId: string,
    actorId: string,
    channelId: string
  ): Promise<ActorActivityProfile>;
  getChannelProfile(guildId: string, channelId: string): Promise<ChannelActivityProfile>;
  flush(): Promise<void>;
  stop(): Promise<void>;
}

interface PendingActorBucket {
  readonly guildId: string;
  readonly actorId: string;
  readonly bucketStart: Date;
  messageCount: number;
  protectedVisualCount: number;
  legitimatePublisherPosts: number;
  confirmedIncidentCount: number;
  falsePositiveCorrections: number;
  channelIds: Set<string>;
  lastChannelId: string | null;
  lastActivityAt: Date;
}

interface PendingChannelBucket {
  readonly guildId: string;
  readonly channelId: string;
  readonly bucketStart: Date;
  messageCount: number;
  protectedVisualCount: number;
  knownPublisherCount: number;
  lastProtectedVisualAt: Date | null;
  isRestricted: boolean;
  isAnnouncement: boolean;
}

function bucketStart(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function actorKey(input: ActivityMessageInput): string {
  return `${input.guildId}:${input.actorId}:${bucketStart(input.happenedAt).toISOString()}`;
}

function channelKey(input: ActivityMessageInput): string {
  return `${input.guildId}:${input.channelId}:${bucketStart(input.happenedAt).toISOString()}`;
}

export class BatchedActivityTracker implements ActivityTracker {
  private readonly actorBuckets = new Map<string, PendingActorBucket>();
  private readonly channelBuckets = new Map<string, PendingChannelBucket>();

  public constructor(
    private readonly repository: ActivityRepository,
    private readonly lookbackDays: number
  ) {}

  public recordMessage(input: ActivityMessageInput): void {
    const actorBucketKey = actorKey(input);
    const actorBucket = this.actorBuckets.get(actorBucketKey) ?? {
      guildId: input.guildId,
      actorId: input.actorId,
      bucketStart: bucketStart(input.happenedAt),
      messageCount: 0,
      protectedVisualCount: 0,
      legitimatePublisherPosts: 0,
      confirmedIncidentCount: 0,
      falsePositiveCorrections: 0,
      channelIds: new Set<string>(),
      lastChannelId: null,
      lastActivityAt: input.happenedAt
    };

    actorBucket.messageCount += 1;
    actorBucket.protectedVisualCount += input.protectedVisualCandidate ? 1 : 0;
    actorBucket.legitimatePublisherPosts += input.legitimatePublisherPost ? 1 : 0;
    actorBucket.confirmedIncidentCount += input.confirmedIncident ? 1 : 0;
    actorBucket.falsePositiveCorrections += input.falsePositiveCorrection ? 1 : 0;
    actorBucket.channelIds.add(input.channelId);
    actorBucket.lastChannelId = input.channelId;
    actorBucket.lastActivityAt = input.happenedAt;
    this.actorBuckets.set(actorBucketKey, actorBucket);

    const channelBucketKey = channelKey(input);
    const channelBucket = this.channelBuckets.get(channelBucketKey) ?? {
      guildId: input.guildId,
      channelId: input.channelId,
      bucketStart: bucketStart(input.happenedAt),
      messageCount: 0,
      protectedVisualCount: 0,
      knownPublisherCount: 0,
      lastProtectedVisualAt: null,
      isRestricted: input.channelIsRestricted,
      isAnnouncement: input.channelIsAnnouncement
    };

    channelBucket.messageCount += 1;
    channelBucket.protectedVisualCount += input.protectedVisualCandidate ? 1 : 0;
    channelBucket.knownPublisherCount += input.legitimatePublisherPost ? 1 : 0;
    channelBucket.lastProtectedVisualAt = input.protectedVisualCandidate
      ? input.happenedAt
      : channelBucket.lastProtectedVisualAt;
    channelBucket.isRestricted = input.channelIsRestricted;
    channelBucket.isAnnouncement = input.channelIsAnnouncement;
    this.channelBuckets.set(channelBucketKey, channelBucket);
  }

  public async getActorProfile(
    guildId: string,
    actorId: string,
    channelId: string
  ): Promise<ActorActivityProfile> {
    await this.flush();
    const since = new Date(Date.now() - this.lookbackDays * 24 * 60 * 60 * 1_000);
    return this.repository.getActorProfile(guildId, actorId, channelId, since, new Date());
  }

  public async getChannelProfile(
    guildId: string,
    channelId: string
  ): Promise<ChannelActivityProfile> {
    await this.flush();
    const since = new Date(Date.now() - this.lookbackDays * 24 * 60 * 60 * 1_000);
    return this.repository.getChannelProfile(guildId, channelId, since);
  }

  public async flush(): Promise<void> {
    const actorBuckets = [...this.actorBuckets.values()];
    this.actorBuckets.clear();
    for (const bucket of actorBuckets) {
      await this.repository.upsertActorBucket({
        guildId: bucket.guildId,
        actorId: bucket.actorId,
        bucketStart: bucket.bucketStart,
        messageCount: bucket.messageCount,
        protectedVisualCount: bucket.protectedVisualCount,
        legitimatePublisherPosts: bucket.legitimatePublisherPosts,
        confirmedIncidentCount: bucket.confirmedIncidentCount,
        falsePositiveCorrections: bucket.falsePositiveCorrections,
        channelIds: [...bucket.channelIds],
        lastChannelId: bucket.lastChannelId,
        lastActivityAt: bucket.lastActivityAt
      });
    }

    const channelBuckets = [...this.channelBuckets.values()];
    this.channelBuckets.clear();
    for (const bucket of channelBuckets) {
      await this.repository.upsertChannelBucket(bucket);
    }
  }

  public async stop(): Promise<void> {
    await this.flush();
  }
}
