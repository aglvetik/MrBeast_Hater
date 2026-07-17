import { and, eq, gte, lte, or, sql } from "drizzle-orm";

import type { CorrelationEvent } from "../../../domain/detection/types.js";
import type { DatabaseClient } from "../client.js";
import { recentDetectionEventsTable } from "../schema.js";

function mapRow(row: typeof recentDetectionEventsTable.$inferSelect): CorrelationEvent {
  return {
    id: row.id,
    guildId: row.guildId,
    actorId: row.actorId,
    channelId: row.channelId,
    categoryId: row.categoryId,
    categoryPosition: row.categoryPosition,
    parentPosition: row.parentPosition,
    channelPosition: row.channelPosition,
    exactFingerprint: row.exactFingerprint,
    structuralFingerprint: row.structuralFingerprint,
    protectedMentionClass: row.protectedMentionClass,
    score: row.score,
    decision: row.decision as CorrelationEvent["decision"],
    eventSource: row.eventSource as CorrelationEvent["eventSource"],
    createdAt: row.createdAt
  };
}

export class RecentDetectionEventRepository {
  public constructor(private readonly database: DatabaseClient) {}

  public async listMatchingRecent(
    guildId: string,
    since: Date,
    exactFingerprint: string | null,
    structuralFingerprint: string | null,
    protectedMentionClass: string | null
  ): Promise<readonly CorrelationEvent[]> {
    if (!exactFingerprint && !structuralFingerprint && !protectedMentionClass) {
      return [];
    }

    const rows = await this.database.db
      .select()
      .from(recentDetectionEventsTable)
      .where(
        and(
          eq(recentDetectionEventsTable.guildId, guildId),
          gte(recentDetectionEventsTable.createdAt, since),
          or(
            exactFingerprint
              ? eq(recentDetectionEventsTable.exactFingerprint, exactFingerprint)
              : sql`false`,
            structuralFingerprint
              ? eq(recentDetectionEventsTable.structuralFingerprint, structuralFingerprint)
              : sql`false`,
            protectedMentionClass
              ? eq(recentDetectionEventsTable.protectedMentionClass, protectedMentionClass)
              : sql`false`
          )
        )
      );

    return rows.map(mapRow);
  }

  public async insert(event: CorrelationEvent, expiresAt: Date): Promise<void> {
    await this.database.db.insert(recentDetectionEventsTable).values({
      ...event,
      expiresAt
    });
  }

  public async deleteExpired(now: Date): Promise<number> {
    const result = await this.database.db
      .delete(recentDetectionEventsTable)
      .where(lte(recentDetectionEventsTable.expiresAt, now));

    return result.rowCount ?? 0;
  }
}
