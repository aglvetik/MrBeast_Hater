import { randomUUID } from "node:crypto";

import { and, eq, isNotNull, lte } from "drizzle-orm";

import type { GuildSettings } from "../../../domain/policy/types.js";
import type { DatabaseClient } from "../client.js";
import {
  channelPoliciesTable,
  configAuditEventsTable,
  escalationStepsTable,
  guildSettingsTable,
  incidentsTable,
  protectedRolesTable,
  sanctionsTable,
  trustedActorsTable
} from "../schema.js";
import { guildSettingsInsertValues, guildSettingsUpdateValues } from "./guildSettingsRepository.js";

export class GuildDataRepository {
  public constructor(private readonly database: DatabaseClient) {}

  public async deleteGuildData(guildId: string): Promise<void> {
    await this.database.db.transaction(async (transaction) => {
      await transaction
        .delete(configAuditEventsTable)
        .where(eq(configAuditEventsTable.guildId, guildId));
      await transaction.delete(incidentsTable).where(eq(incidentsTable.guildId, guildId));
      await transaction.delete(sanctionsTable).where(eq(sanctionsTable.guildId, guildId));
      await transaction.delete(trustedActorsTable).where(eq(trustedActorsTable.guildId, guildId));
      await transaction
        .delete(channelPoliciesTable)
        .where(eq(channelPoliciesTable.guildId, guildId));
      await transaction.delete(protectedRolesTable).where(eq(protectedRolesTable.guildId, guildId));
      await transaction
        .delete(escalationStepsTable)
        .where(eq(escalationStepsTable.guildId, guildId));
      await transaction.delete(guildSettingsTable).where(eq(guildSettingsTable.guildId, guildId));
    });
  }

  public async resetGuildConfiguration(settings: GuildSettings): Promise<void> {
    await this.database.db.transaction(async (transaction) => {
      await transaction
        .delete(trustedActorsTable)
        .where(eq(trustedActorsTable.guildId, settings.guildId));
      await transaction
        .delete(channelPoliciesTable)
        .where(eq(channelPoliciesTable.guildId, settings.guildId));
      await transaction
        .delete(protectedRolesTable)
        .where(eq(protectedRolesTable.guildId, settings.guildId));
      await transaction
        .delete(escalationStepsTable)
        .where(eq(escalationStepsTable.guildId, settings.guildId));

      await transaction
        .insert(guildSettingsTable)
        .values(guildSettingsInsertValues(settings))
        .onConflictDoUpdate({
          target: guildSettingsTable.guildId,
          set: guildSettingsUpdateValues(settings)
        });
    });
  }

  public async completeSetupConfiguration(
    settings: GuildSettings,
    protectedRoleIds: readonly string[],
    actorId: string,
    auditPayload: Record<string, unknown>
  ): Promise<void> {
    await this.database.db.transaction(async (transaction) => {
      await transaction
        .insert(guildSettingsTable)
        .values(guildSettingsInsertValues(settings))
        .onConflictDoUpdate({
          target: guildSettingsTable.guildId,
          set: guildSettingsUpdateValues(settings)
        });

      await transaction
        .delete(protectedRolesTable)
        .where(eq(protectedRolesTable.guildId, settings.guildId));

      const uniqueRoleIds = [...new Set(protectedRoleIds)];
      if (uniqueRoleIds.length > 0) {
        await transaction.insert(protectedRolesTable).values(
          uniqueRoleIds.map((roleId) => ({
            guildId: settings.guildId,
            roleId
          }))
        );
      }

      await transaction.insert(configAuditEventsTable).values({
        id: randomUUID(),
        guildId: settings.guildId,
        actorId,
        eventType: "setup_completed",
        payload: auditPayload
      });
    });
  }

  public async markGuildForDeletion(guildId: string, graceUntil: Date): Promise<void> {
    await this.database.db
      .update(guildSettingsTable)
      .set({
        enabled: false,
        deletionRequestedAt: new Date(),
        deletionGraceUntil: graceUntil,
        updatedAt: new Date()
      })
      .where(eq(guildSettingsTable.guildId, guildId));
  }

  public async listDeletionCandidates(now: Date): Promise<readonly string[]> {
    const rows = await this.database.db
      .select({ guildId: guildSettingsTable.guildId })
      .from(guildSettingsTable)
      .where(
        and(
          eq(guildSettingsTable.enabled, false),
          isNotNull(guildSettingsTable.deletionRequestedAt),
          lte(guildSettingsTable.deletionGraceUntil, now)
        )
      );

    return rows.map((row) => row.guildId);
  }
}
