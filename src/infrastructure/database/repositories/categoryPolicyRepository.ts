import { and, eq } from "drizzle-orm";

import type { CategoryPolicyEntry, ChannelGuardMode } from "../../../domain/policy/types.js";
import type { DatabaseClient } from "../client.js";
import { categoryPoliciesTable } from "../schema.js";

export class CategoryPolicyRepository {
  public constructor(private readonly database: DatabaseClient) {}

  public async getForCategory(
    guildId: string,
    categoryId: string | null
  ): Promise<ChannelGuardMode | null> {
    if (!categoryId) {
      return null;
    }

    const row = await this.database.db.query.categoryPoliciesTable.findFirst({
      where: and(
        eq(categoryPoliciesTable.guildId, guildId),
        eq(categoryPoliciesTable.categoryId, categoryId)
      )
    });

    return row ? (row.policy as ChannelGuardMode) : null;
  }

  public async listByGuildId(guildId: string): Promise<readonly CategoryPolicyEntry[]> {
    const rows = await this.database.db
      .select()
      .from(categoryPoliciesTable)
      .where(eq(categoryPoliciesTable.guildId, guildId));

    return rows.map((row) => ({
      guildId: row.guildId,
      categoryId: row.categoryId,
      policy: row.policy as ChannelGuardMode
    }));
  }

  public async upsert(
    guildId: string,
    categoryId: string,
    policy: ChannelGuardMode
  ): Promise<void> {
    await this.database.db
      .insert(categoryPoliciesTable)
      .values({
        guildId,
        categoryId,
        policy,
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: [categoryPoliciesTable.guildId, categoryPoliciesTable.categoryId],
        set: {
          policy,
          updatedAt: new Date()
        }
      });
  }

  public async remove(guildId: string, categoryId: string): Promise<void> {
    await this.database.db
      .delete(categoryPoliciesTable)
      .where(
        and(
          eq(categoryPoliciesTable.guildId, guildId),
          eq(categoryPoliciesTable.categoryId, categoryId)
        )
      );
  }
}
