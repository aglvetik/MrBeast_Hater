import { and, eq } from "drizzle-orm";

import type { ProtectedRole } from "../../../domain/policy/types.js";
import type { DatabaseClient } from "../client.js";
import { protectedRolesTable } from "../schema.js";

export class ProtectedRoleRepository {
  public constructor(private readonly database: DatabaseClient) {}

  public async listByGuildId(guildId: string): Promise<readonly ProtectedRole[]> {
    return this.database.db
      .select()
      .from(protectedRolesTable)
      .where(eq(protectedRolesTable.guildId, guildId));
  }

  public async add(guildId: string, roleId: string): Promise<void> {
    await this.database.db
      .insert(protectedRolesTable)
      .values({ guildId, roleId })
      .onConflictDoNothing();
  }

  public async remove(guildId: string, roleId: string): Promise<void> {
    await this.database.db
      .delete(protectedRolesTable)
      .where(and(eq(protectedRolesTable.guildId, guildId), eq(protectedRolesTable.roleId, roleId)));
  }

  public async replaceAll(guildId: string, roleIds: readonly string[]): Promise<void> {
    await this.database.db.transaction(async (transaction) => {
      await transaction.delete(protectedRolesTable).where(eq(protectedRolesTable.guildId, guildId));

      if (roleIds.length > 0) {
        await transaction.insert(protectedRolesTable).values(
          roleIds.map((roleId) => ({
            guildId,
            roleId
          }))
        );
      }
    });
  }
}
