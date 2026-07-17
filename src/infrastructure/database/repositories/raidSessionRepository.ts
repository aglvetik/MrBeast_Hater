import { and, eq, gte, lte } from "drizzle-orm";

import type { DatabaseClient } from "../client.js";
import { raidSessionsTable } from "../schema.js";

export interface RaidSessionRecord {
  readonly id: string;
  readonly guildId: string;
  readonly state: string;
  readonly triggeringRule: string;
  readonly exactFingerprints: readonly string[];
  readonly structuralFingerprints: readonly string[];
  readonly protectedMentionClasses: readonly string[];
  readonly actorIds: readonly string[];
  readonly channelIds: readonly string[];
  readonly overridePayload: Record<string, unknown> | null;
  readonly startedAt: Date;
  readonly lastMatchedAt: Date;
  readonly expiresAt: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

function mapRow(row: typeof raidSessionsTable.$inferSelect): RaidSessionRecord {
  return {
    id: row.id,
    guildId: row.guildId,
    state: row.state,
    triggeringRule: row.triggeringRule,
    exactFingerprints: row.exactFingerprints,
    structuralFingerprints: row.structuralFingerprints,
    protectedMentionClasses: row.protectedMentionClasses,
    actorIds: row.actorIds,
    channelIds: row.channelIds,
    overridePayload: row.overridePayload ?? null,
    startedAt: row.startedAt,
    lastMatchedAt: row.lastMatchedAt,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export class RaidSessionRepository {
  public constructor(private readonly database: DatabaseClient) {}

  public async listActive(guildId: string, now: Date): Promise<readonly RaidSessionRecord[]> {
    const rows = await this.database.db
      .select()
      .from(raidSessionsTable)
      .where(
        and(
          eq(raidSessionsTable.guildId, guildId),
          eq(raidSessionsTable.state, "ACTIVE"),
          gte(raidSessionsTable.expiresAt, now)
        )
      );

    return rows.map(mapRow);
  }

  public async upsert(record: RaidSessionRecord): Promise<void> {
    await this.database.db
      .insert(raidSessionsTable)
      .values(record)
      .onConflictDoUpdate({
        target: raidSessionsTable.id,
        set: {
          state: record.state,
          exactFingerprints: record.exactFingerprints,
          structuralFingerprints: record.structuralFingerprints,
          protectedMentionClasses: record.protectedMentionClasses,
          actorIds: record.actorIds,
          channelIds: record.channelIds,
          overridePayload: record.overridePayload,
          lastMatchedAt: record.lastMatchedAt,
          expiresAt: record.expiresAt,
          updatedAt: new Date()
        }
      });
  }

  public async expireGuildSessions(guildId: string, now: Date): Promise<void> {
    await this.database.db
      .update(raidSessionsTable)
      .set({
        state: "STOPPED",
        updatedAt: now
      })
      .where(and(eq(raidSessionsTable.guildId, guildId), gte(raidSessionsTable.expiresAt, now)));
  }

  public async deleteExpired(now: Date): Promise<number> {
    const result = await this.database.db
      .delete(raidSessionsTable)
      .where(lte(raidSessionsTable.expiresAt, now));
    return result.rowCount ?? 0;
  }
}
