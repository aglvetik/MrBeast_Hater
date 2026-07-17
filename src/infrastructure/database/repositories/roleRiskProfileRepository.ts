import { and, eq } from "drizzle-orm";

import type { MentionRiskLevel, RoleRiskProfile } from "../../../domain/policy/types.js";
import type { DatabaseClient } from "../client.js";
import { roleRiskProfilesTable } from "../schema.js";

export class RoleRiskProfileRepository {
  public constructor(private readonly database: DatabaseClient) {}

  public async listByGuildId(guildId: string): Promise<readonly RoleRiskProfile[]> {
    const rows = await this.database.db
      .select()
      .from(roleRiskProfilesTable)
      .where(eq(roleRiskProfilesTable.guildId, guildId));

    return rows.map((row) => ({
      guildId: row.guildId,
      roleId: row.roleId,
      riskLevel: row.riskLevel as MentionRiskLevel
    }));
  }

  public async upsert(guildId: string, roleId: string, riskLevel: MentionRiskLevel): Promise<void> {
    await this.database.db
      .insert(roleRiskProfilesTable)
      .values({
        guildId,
        roleId,
        riskLevel,
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: [roleRiskProfilesTable.guildId, roleRiskProfilesTable.roleId],
        set: {
          riskLevel,
          updatedAt: new Date()
        }
      });
  }

  public async remove(guildId: string, roleId: string): Promise<void> {
    await this.database.db
      .delete(roleRiskProfilesTable)
      .where(
        and(eq(roleRiskProfilesTable.guildId, guildId), eq(roleRiskProfilesTable.roleId, roleId))
      );
  }
}
