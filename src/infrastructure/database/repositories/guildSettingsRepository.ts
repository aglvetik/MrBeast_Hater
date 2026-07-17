import { eq, sql } from "drizzle-orm";

import type { GuildSettings } from "../../../domain/policy/types.js";
import type { DatabaseClient } from "../client.js";
import { guildSettingsTable } from "../schema.js";

export function mapGuildSettings(row: typeof guildSettingsTable.$inferSelect): GuildSettings {
  return {
    guildId: row.guildId,
    enabled: row.enabled,
    locale: row.locale as GuildSettings["locale"],
    operationMode: row.operationMode as GuildSettings["operationMode"],
    preset: row.preset as GuildSettings["preset"],
    logChannelId: row.logChannelId,
    roleDetectionMode: row.roleDetectionMode as GuildSettings["roleDetectionMode"],
    memberPunishment: row.memberPunishment as GuildSettings["memberPunishment"],
    memberTimeoutSeconds: row.memberTimeoutSeconds,
    botPunishment: row.botPunishment as GuildSettings["botPunishment"],
    minVisualCount: row.minVisualCount,
    maxInformationChars: row.maxInformationChars,
    burstWindowSeconds: row.burstWindowSeconds,
    burstMessageCount: row.burstMessageCount,
    escalationMode: row.escalationMode as GuildSettings["escalationMode"],
    retentionDays: row.retentionDays as GuildSettings["retentionDays"],
    dryRunEnabled: row.dryRunEnabled,
    linkRuleEnabled: row.linkRuleEnabled,
    sanctionCooldownSeconds: row.sanctionCooldownSeconds,
    firstStrikeBehavior: row.firstStrikeBehavior as GuildSettings["firstStrikeBehavior"],
    warmupDays: row.warmupDays,
    guildWarmupStartedAt: row.guildWarmupStartedAt,
    correlationWindowSeconds: row.correlationWindowSeconds,
    raidSessionDurationSeconds: row.raidSessionDurationSeconds,
    quarantineTimeoutSeconds: row.quarantineTimeoutSeconds,
    newAccountMaxAgeHours: row.newAccountMaxAgeHours,
    newJoinMaxAgeHours: row.newJoinMaxAgeHours,
    meaningfulTextThreshold: row.meaningfulTextThreshold,
    observeThreshold: row.observeThreshold,
    logOnlyThreshold: row.logOnlyThreshold,
    deleteThreshold: row.deleteThreshold,
    quarantineThreshold: row.quarantineThreshold,
    enforceThreshold: row.enforceThreshold,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletionRequestedAt: row.deletionRequestedAt,
    deletionGraceUntil: row.deletionGraceUntil
  };
}

export function guildSettingsInsertValues(
  settings: GuildSettings
): typeof guildSettingsTable.$inferInsert {
  return {
    ...settings,
    logChannelId: settings.logChannelId,
    memberTimeoutSeconds: settings.memberTimeoutSeconds
  };
}

export function guildSettingsUpdateValues(
  settings: GuildSettings
): Partial<typeof guildSettingsTable.$inferInsert> {
  return {
    enabled: settings.enabled,
    locale: settings.locale,
    operationMode: settings.operationMode,
    preset: settings.preset,
    logChannelId: settings.logChannelId,
    roleDetectionMode: settings.roleDetectionMode,
    memberPunishment: settings.memberPunishment,
    memberTimeoutSeconds: settings.memberTimeoutSeconds,
    botPunishment: settings.botPunishment,
    minVisualCount: settings.minVisualCount,
    maxInformationChars: settings.maxInformationChars,
    burstWindowSeconds: settings.burstWindowSeconds,
    burstMessageCount: settings.burstMessageCount,
    escalationMode: settings.escalationMode,
    retentionDays: settings.retentionDays,
    dryRunEnabled: settings.dryRunEnabled,
    linkRuleEnabled: settings.linkRuleEnabled,
    sanctionCooldownSeconds: settings.sanctionCooldownSeconds,
    firstStrikeBehavior: settings.firstStrikeBehavior,
    warmupDays: settings.warmupDays,
    guildWarmupStartedAt: settings.guildWarmupStartedAt,
    correlationWindowSeconds: settings.correlationWindowSeconds,
    raidSessionDurationSeconds: settings.raidSessionDurationSeconds,
    quarantineTimeoutSeconds: settings.quarantineTimeoutSeconds,
    newAccountMaxAgeHours: settings.newAccountMaxAgeHours,
    newJoinMaxAgeHours: settings.newJoinMaxAgeHours,
    meaningfulTextThreshold: settings.meaningfulTextThreshold,
    observeThreshold: settings.observeThreshold,
    logOnlyThreshold: settings.logOnlyThreshold,
    deleteThreshold: settings.deleteThreshold,
    quarantineThreshold: settings.quarantineThreshold,
    enforceThreshold: settings.enforceThreshold,
    deletionRequestedAt: settings.deletionRequestedAt,
    deletionGraceUntil: settings.deletionGraceUntil,
    updatedAt: settings.updatedAt
  };
}

export class GuildSettingsRepository {
  public constructor(private readonly database: DatabaseClient) {}

  public async getByGuildId(guildId: string): Promise<GuildSettings | null> {
    const row = await this.database.db.query.guildSettingsTable.findFirst({
      where: eq(guildSettingsTable.guildId, guildId)
    });

    return row ? mapGuildSettings(row) : null;
  }

  public async upsert(settings: GuildSettings): Promise<void> {
    await this.database.db
      .insert(guildSettingsTable)
      .values(guildSettingsInsertValues(settings))
      .onConflictDoUpdate({
        target: guildSettingsTable.guildId,
        set: guildSettingsUpdateValues(settings)
      });
  }

  public async countEnabledGuilds(): Promise<number> {
    const result = await this.database.db
      .select({ count: sql<number>`count(*)` })
      .from(guildSettingsTable)
      .where(eq(guildSettingsTable.enabled, true));

    return Number(result[0]?.count ?? 0);
  }
}
