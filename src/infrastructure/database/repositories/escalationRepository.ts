import { randomUUID } from "node:crypto";

import { asc, eq } from "drizzle-orm";

import type { EscalationStep, PunishmentType } from "../../../domain/policy/types.js";
import type { DatabaseClient } from "../client.js";
import { escalationStepsTable } from "../schema.js";

export class EscalationRepository {
  public constructor(private readonly database: DatabaseClient) {}

  public async listByGuildId(guildId: string): Promise<readonly EscalationStep[]> {
    const rows = await this.database.db
      .select()
      .from(escalationStepsTable)
      .where(eq(escalationStepsTable.guildId, guildId))
      .orderBy(asc(escalationStepsTable.orderIndex));

    return rows.map((row) => ({
      id: row.id,
      guildId: row.guildId,
      orderIndex: row.orderIndex,
      thresholdCount: row.thresholdCount,
      windowDays: row.windowDays,
      punishmentType: row.punishmentType as PunishmentType,
      durationSeconds: row.durationSeconds,
      enabled: row.enabled
    }));
  }

  public async replaceAll(guildId: string, steps: readonly EscalationStep[]): Promise<void> {
    await this.database.db.transaction(async (transaction) => {
      await transaction
        .delete(escalationStepsTable)
        .where(eq(escalationStepsTable.guildId, guildId));

      if (steps.length > 0) {
        await transaction.insert(escalationStepsTable).values(
          steps.map((step) => ({
            ...step,
            id: step.id || randomUUID()
          }))
        );
      }
    });
  }
}
