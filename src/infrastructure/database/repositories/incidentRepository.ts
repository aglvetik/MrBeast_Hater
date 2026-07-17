import { and, desc, eq, gte, sql } from "drizzle-orm";

import type { ActionExecutionResult } from "../../../application/services/actionTypes.js";
import type { IncidentRecord } from "../../../domain/incidents/types.js";
import type { DatabaseClient } from "../client.js";
import {
  actorActivityBucketsTable,
  categoryPoliciesTable,
  channelActivityBucketsTable,
  channelPoliciesTable,
  configAuditEventsTable,
  escalationStepsTable,
  guildSettingsTable,
  incidentsTable,
  protectedRolesTable,
  raidSessionsTable,
  recentDetectionEventsTable,
  roleRiskProfilesTable,
  sanctionsTable,
  trustedActorsTable,
  actorPoliciesTable
} from "../schema.js";

function actionResultsToJson(results: ActionExecutionResult): Record<string, unknown> {
  return {
    delete: {
      status: results.delete.status,
      code: results.delete.code,
      message: results.delete.message
    },
    punishment: {
      status: results.punishment.status,
      code: results.punishment.code,
      message: results.punishment.message
    },
    persistence: {
      status: results.persistence.status,
      code: results.persistence.code,
      message: results.persistence.message
    },
    modLog: {
      status: results.modLog.status,
      code: results.modLog.code,
      message: results.modLog.message
    }
  };
}

function explanationToJson(explanation: IncidentRecord["explanation"]): Record<string, unknown> {
  return {
    score: explanation.score,
    signals: explanation.signals.map((signal) => ({
      id: signal.id,
      weight: signal.weight,
      explanation: signal.explanation
    })),
    positiveTotal: explanation.positiveTotal,
    negativeTotal: explanation.negativeTotal,
    activityClass: explanation.activityClass,
    channelContext: explanation.channelContext,
    correlationStage: explanation.correlationStage,
    policyCaps: [...explanation.policyCaps],
    finalDecision: explanation.finalDecision
  };
}

function mediaSummaryToJson(summary: IncidentRecord["mediaSummary"]): Record<string, unknown> {
  return {
    imageAttachments: summary.imageAttachments,
    gifAttachments: summary.gifAttachments,
    videoAttachments: summary.videoAttachments,
    embedImages: summary.embedImages,
    embedThumbnails: summary.embedThumbnails,
    stickers: summary.stickers,
    totalVisualCount: summary.totalVisualCount,
    attachmentCount: summary.attachmentCount,
    extensionSummary: [...(summary.extensionSummary ?? [])],
    sizeBucketSummary: [...(summary.sizeBucketSummary ?? [])]
  };
}

function mapRecord(record: IncidentRecord): typeof incidentsTable.$inferInsert {
  return {
    ...record,
    signals: record.signals.map((signal) => ({
      id: signal.id,
      weight: signal.weight,
      explanation: signal.explanation
    })),
    mentionedRoleIds: [...record.mentionedRoleIds],
    mediaSummary: mediaSummaryToJson(record.mediaSummary),
    actionResults: actionResultsToJson(record.actionResults),
    explanation: explanationToJson(record.explanation),
    updatedAt: record.createdAt
  };
}

export class IncidentRepository {
  public constructor(private readonly database: DatabaseClient) {}

  public async reserve(record: IncidentRecord): Promise<{ readonly inserted: boolean }> {
    const result = await this.database.db
      .insert(incidentsTable)
      .values(mapRecord(record))
      .onConflictDoNothing({
        target: [
          incidentsTable.guildId,
          incidentsTable.messageId,
          incidentsTable.eventSource,
          incidentsTable.messageSignatureHash
        ]
      })
      .returning({ id: incidentsTable.id });

    return {
      inserted: result.length > 0
    };
  }

  public async finalize(
    guildId: string,
    incidentId: string,
    update: {
      readonly actionResults: ActionExecutionResult;
      readonly sanctionId: string | null;
      readonly falsePositive?: boolean;
      readonly processingState?: IncidentRecord["processingState"];
    }
  ): Promise<void> {
    await this.database.db
      .update(incidentsTable)
      .set({
        actionResults: actionResultsToJson(update.actionResults),
        sanctionId: update.sanctionId,
        falsePositive: update.falsePositive ?? false,
        processingState: update.processingState ?? "COMPLETED",
        updatedAt: new Date()
      })
      .where(and(eq(incidentsTable.guildId, guildId), eq(incidentsTable.id, incidentId)));
  }

  public async countConfirmedByActorWithinWindow(
    guildId: string,
    actorId: string,
    since: Date
  ): Promise<number> {
    const result = await this.database.db
      .select({ count: sql<number>`count(*)` })
      .from(incidentsTable)
      .where(
        and(
          eq(incidentsTable.guildId, guildId),
          eq(incidentsTable.actorId, actorId),
          eq(incidentsTable.confirmedStrike, true),
          eq(incidentsTable.falsePositive, false),
          gte(incidentsTable.createdAt, since)
        )
      );

    return Number(result[0]?.count ?? 0);
  }

  public async countRecentByActor(guildId: string, actorId: string, since: Date): Promise<number> {
    const result = await this.database.db
      .select({ count: sql<number>`count(*)` })
      .from(incidentsTable)
      .where(
        and(
          eq(incidentsTable.guildId, guildId),
          eq(incidentsTable.actorId, actorId),
          eq(incidentsTable.falsePositive, false),
          gte(incidentsTable.createdAt, since)
        )
      );

    return Number(result[0]?.count ?? 0);
  }

  public async getRecent(
    guildId: string,
    limit: number
  ): Promise<readonly (typeof incidentsTable.$inferSelect)[]> {
    return this.database.db
      .select()
      .from(incidentsTable)
      .where(eq(incidentsTable.guildId, guildId))
      .orderBy(desc(incidentsTable.createdAt))
      .limit(limit);
  }

  public async getByActor(
    guildId: string,
    actorId: string,
    limit: number
  ): Promise<readonly (typeof incidentsTable.$inferSelect)[]> {
    return this.database.db
      .select()
      .from(incidentsTable)
      .where(and(eq(incidentsTable.guildId, guildId), eq(incidentsTable.actorId, actorId)))
      .orderBy(desc(incidentsTable.createdAt))
      .limit(limit);
  }

  public async getById(
    guildId: string,
    incidentId: string
  ): Promise<typeof incidentsTable.$inferSelect | null> {
    const row = await this.database.db.query.incidentsTable.findFirst({
      where: and(eq(incidentsTable.guildId, guildId), eq(incidentsTable.id, incidentId))
    });

    return row ?? null;
  }

  public async getStats(guildId: string): Promise<{
    readonly total: number;
    readonly falsePositives: number;
    readonly byRule: Readonly<Record<string, number>>;
  }> {
    const rows = await this.database.db
      .select({
        ruleId: incidentsTable.ruleId,
        falsePositive: incidentsTable.falsePositive,
        count: sql<number>`count(*)`
      })
      .from(incidentsTable)
      .where(eq(incidentsTable.guildId, guildId))
      .groupBy(incidentsTable.ruleId, incidentsTable.falsePositive);

    let total = 0;
    let falsePositives = 0;
    const byRule: Record<string, number> = {};

    for (const row of rows) {
      const count = Number(row.count);
      total += count;
      if (row.falsePositive) {
        falsePositives += count;
      }

      const key = row.ruleId ?? "none";
      byRule[key] = (byRule[key] ?? 0) + count;
    }

    return {
      total,
      falsePositives,
      byRule
    };
  }

  public async markFalsePositive(
    guildId: string,
    incidentId: string,
    falsePositive: boolean
  ): Promise<void> {
    await this.database.db
      .update(incidentsTable)
      .set({ falsePositive, updatedAt: new Date() })
      .where(and(eq(incidentsTable.guildId, guildId), eq(incidentsTable.id, incidentId)));
  }

  public async deleteExpired(now: Date): Promise<number> {
    const result = await this.database.db.execute(sql`
      delete from incidents i
      using guild_settings g
      where i.guild_id = g.guild_id
        and i.created_at < ${now} - (g.retention_days || ' days')::interval
    `);

    return result.rowCount ?? 0;
  }

  public async exportGuildData(guildId: string): Promise<Record<string, unknown>> {
    const [
      settings,
      protectedRoles,
      roleRiskProfiles,
      channelPolicies,
      categoryPolicies,
      trustedActors,
      actorPolicies,
      incidents,
      sanctions,
      recentDetectionEvents,
      raidSessions,
      actorActivityBuckets,
      channelActivityBuckets,
      escalationSteps,
      auditEvents
    ] = await Promise.all([
      this.database.db
        .select()
        .from(guildSettingsTable)
        .where(eq(guildSettingsTable.guildId, guildId)),
      this.database.db
        .select()
        .from(protectedRolesTable)
        .where(eq(protectedRolesTable.guildId, guildId)),
      this.database.db
        .select()
        .from(roleRiskProfilesTable)
        .where(eq(roleRiskProfilesTable.guildId, guildId)),
      this.database.db
        .select()
        .from(channelPoliciesTable)
        .where(eq(channelPoliciesTable.guildId, guildId)),
      this.database.db
        .select()
        .from(categoryPoliciesTable)
        .where(eq(categoryPoliciesTable.guildId, guildId)),
      this.database.db
        .select()
        .from(trustedActorsTable)
        .where(eq(trustedActorsTable.guildId, guildId)),
      this.database.db
        .select()
        .from(actorPoliciesTable)
        .where(eq(actorPoliciesTable.guildId, guildId)),
      this.database.db.select().from(incidentsTable).where(eq(incidentsTable.guildId, guildId)),
      this.database.db.select().from(sanctionsTable).where(eq(sanctionsTable.guildId, guildId)),
      this.database.db
        .select()
        .from(recentDetectionEventsTable)
        .where(eq(recentDetectionEventsTable.guildId, guildId)),
      this.database.db
        .select()
        .from(raidSessionsTable)
        .where(eq(raidSessionsTable.guildId, guildId)),
      this.database.db
        .select()
        .from(actorActivityBucketsTable)
        .where(eq(actorActivityBucketsTable.guildId, guildId)),
      this.database.db
        .select()
        .from(channelActivityBucketsTable)
        .where(eq(channelActivityBucketsTable.guildId, guildId)),
      this.database.db
        .select()
        .from(escalationStepsTable)
        .where(eq(escalationStepsTable.guildId, guildId)),
      this.database.db
        .select()
        .from(configAuditEventsTable)
        .where(eq(configAuditEventsTable.guildId, guildId))
    ]);

    return {
      guildId,
      settings,
      protectedRoles,
      roleRiskProfiles,
      channelPolicies,
      categoryPolicies,
      trustedActors,
      actorPolicies,
      incidents,
      sanctions,
      recentDetectionEvents,
      raidSessions,
      actorActivityBuckets,
      channelActivityBuckets,
      escalationSteps,
      auditEvents
    };
  }
}
