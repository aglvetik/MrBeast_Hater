import { and, eq, gte, lte, sql } from "drizzle-orm";

import type {
  ActorActivityProfile,
  ActorActivityClass,
  ChannelActivityProfile
} from "../../../domain/policy/types.js";
import type { DatabaseClient } from "../client.js";
import { actorActivityBucketsTable, channelActivityBucketsTable } from "../schema.js";

export interface ActorActivityBucketInput {
  readonly guildId: string;
  readonly actorId: string;
  readonly bucketStart: Date;
  readonly messageCount: number;
  readonly protectedVisualCount: number;
  readonly legitimatePublisherPosts: number;
  readonly confirmedIncidentCount: number;
  readonly falsePositiveCorrections: number;
  readonly channelIds: readonly string[];
  readonly lastChannelId: string | null;
  readonly lastActivityAt: Date;
}

export interface ChannelActivityBucketInput {
  readonly guildId: string;
  readonly channelId: string;
  readonly bucketStart: Date;
  readonly messageCount: number;
  readonly protectedVisualCount: number;
  readonly knownPublisherCount: number;
  readonly lastProtectedVisualAt: Date | null;
  readonly isRestricted: boolean;
  readonly isAnnouncement: boolean;
}

function classifyActivity(input: {
  readonly messageCount: number;
  readonly activeDays: number;
  readonly lastObservedAt: Date | null;
  readonly now: Date;
}): ActorActivityClass {
  if (input.messageCount === 0) {
    return "UNKNOWN";
  }

  if (
    input.lastObservedAt &&
    input.now.getTime() - input.lastObservedAt.getTime() > 30 * 24 * 60 * 60 * 1_000
  ) {
    return "DORMANT";
  }

  if (input.messageCount < 5 || input.activeDays <= 1) {
    return "NEW";
  }

  if (input.messageCount >= 25 && input.activeDays >= 7) {
    return "ESTABLISHED";
  }

  return "KNOWN";
}

export class ActivityRepository {
  public constructor(private readonly database: DatabaseClient) {}

  public async upsertActorBucket(input: ActorActivityBucketInput): Promise<void> {
    await this.database.db
      .insert(actorActivityBucketsTable)
      .values({
        ...input,
        channelIds: [...new Set(input.channelIds)]
      })
      .onConflictDoUpdate({
        target: [
          actorActivityBucketsTable.guildId,
          actorActivityBucketsTable.actorId,
          actorActivityBucketsTable.bucketStart
        ],
        set: {
          messageCount: sql`${actorActivityBucketsTable.messageCount} + ${input.messageCount}`,
          protectedVisualCount: sql`${actorActivityBucketsTable.protectedVisualCount} + ${input.protectedVisualCount}`,
          legitimatePublisherPosts: sql`${actorActivityBucketsTable.legitimatePublisherPosts} + ${input.legitimatePublisherPosts}`,
          confirmedIncidentCount: sql`${actorActivityBucketsTable.confirmedIncidentCount} + ${input.confirmedIncidentCount}`,
          falsePositiveCorrections: sql`${actorActivityBucketsTable.falsePositiveCorrections} + ${input.falsePositiveCorrections}`,
          channelIds: sql`(
            select jsonb_agg(distinct value)
            from jsonb_array_elements_text(coalesce(${actorActivityBucketsTable.channelIds}, '[]'::jsonb) || ${JSON.stringify(input.channelIds)}::jsonb)
          )`,
          lastChannelId: input.lastChannelId,
          lastActivityAt: input.lastActivityAt
        }
      });
  }

  public async upsertChannelBucket(input: ChannelActivityBucketInput): Promise<void> {
    await this.database.db
      .insert(channelActivityBucketsTable)
      .values(input)
      .onConflictDoUpdate({
        target: [
          channelActivityBucketsTable.guildId,
          channelActivityBucketsTable.channelId,
          channelActivityBucketsTable.bucketStart
        ],
        set: {
          messageCount: sql`${channelActivityBucketsTable.messageCount} + ${input.messageCount}`,
          protectedVisualCount: sql`${channelActivityBucketsTable.protectedVisualCount} + ${input.protectedVisualCount}`,
          knownPublisherCount: sql`${channelActivityBucketsTable.knownPublisherCount} + ${input.knownPublisherCount}`,
          lastProtectedVisualAt: input.lastProtectedVisualAt,
          isRestricted: input.isRestricted,
          isAnnouncement: input.isAnnouncement
        }
      });
  }

  public async getActorProfile(
    guildId: string,
    actorId: string,
    channelId: string,
    since: Date,
    now: Date
  ): Promise<ActorActivityProfile> {
    const rows = await this.database.db
      .select()
      .from(actorActivityBucketsTable)
      .where(
        and(
          eq(actorActivityBucketsTable.guildId, guildId),
          eq(actorActivityBucketsTable.actorId, actorId),
          gte(actorActivityBucketsTable.bucketStart, since)
        )
      );

    const messageCount = rows.reduce((sum, row) => sum + row.messageCount, 0);
    const activeDays = rows.length;
    const lastObservedAt =
      rows
        .map((row) => row.lastActivityAt)
        .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;
    const firstObservedAt =
      rows
        .map((row) => row.bucketStart)
        .sort((left, right) => left.getTime() - right.getTime())[0] ?? null;
    const recentUniqueChannels = new Set(rows.flatMap((row) => row.channelIds)).size;
    const lastActivityInChannelAt =
      rows
        .filter((row) => row.lastChannelId === channelId)
        .map((row) => row.lastActivityAt)
        .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;

    return {
      actorId,
      firstObservedAt,
      lastObservedAt,
      activeDays,
      messageCount,
      recentUniqueChannels,
      priorLegitimatePublisherPosts: rows.reduce(
        (sum, row) => sum + row.legitimatePublisherPosts,
        0
      ),
      priorConfirmedIncidents: rows.reduce((sum, row) => sum + row.confirmedIncidentCount, 0),
      priorFalsePositiveCorrections: rows.reduce(
        (sum, row) => sum + row.falsePositiveCorrections,
        0
      ),
      lastActivityInChannelAt,
      activityClass: classifyActivity({
        messageCount,
        activeDays,
        lastObservedAt,
        now
      })
    };
  }

  public async getChannelProfile(
    guildId: string,
    channelId: string,
    since: Date
  ): Promise<ChannelActivityProfile> {
    const rows = await this.database.db
      .select()
      .from(channelActivityBucketsTable)
      .where(
        and(
          eq(channelActivityBucketsTable.guildId, guildId),
          eq(channelActivityBucketsTable.channelId, channelId),
          gte(channelActivityBucketsTable.bucketStart, since)
        )
      );

    const messageCount = rows.reduce((sum, row) => sum + row.messageCount, 0);
    const protectedVisualCount = rows.reduce((sum, row) => sum + row.protectedVisualCount, 0);
    const knownPublisherCount = rows.reduce((sum, row) => sum + row.knownPublisherCount, 0);
    const isAnnouncement = rows.some((row) => row.isAnnouncement);
    const isRestricted = rows.some((row) => row.isRestricted);
    const lastProtectedVisualAt =
      rows
        .map((row) => row.lastProtectedVisualAt)
        .filter((value): value is Date => value !== null)
        .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;

    return {
      channelId,
      messageCount,
      protectedVisualCount,
      knownPublisherCount,
      lastProtectedVisualAt,
      isRestricted,
      isAnnouncement,
      isQuiet: messageCount < 20,
      contextLabel: isAnnouncement ? "announcement channel" : "text channel"
    };
  }

  public async deleteExpired(since: Date): Promise<number> {
    const actorResult = await this.database.db
      .delete(actorActivityBucketsTable)
      .where(lte(actorActivityBucketsTable.bucketStart, since));
    const channelResult = await this.database.db
      .delete(channelActivityBucketsTable)
      .where(lte(channelActivityBucketsTable.bucketStart, since));

    return (actorResult.rowCount ?? 0) + (channelResult.rowCount ?? 0);
  }
}
