import { and, eq } from "drizzle-orm";

import type { ChannelPolicy, ChannelPolicyEntry } from "../../../domain/policy/types.js";
import type { DatabaseClient } from "../client.js";
import { channelPoliciesTable } from "../schema.js";

export class ChannelPolicyRepository {
  public constructor(private readonly database: DatabaseClient) {}

  public async getForChannel(guildId: string, channelId: string): Promise<ChannelPolicy | null> {
    const row = await this.database.db.query.channelPoliciesTable.findFirst({
      where: and(
        eq(channelPoliciesTable.guildId, guildId),
        eq(channelPoliciesTable.channelId, channelId)
      )
    });

    return row ? (row.policy as ChannelPolicy) : null;
  }

  public async listByGuildId(guildId: string): Promise<readonly ChannelPolicyEntry[]> {
    const rows = await this.database.db
      .select()
      .from(channelPoliciesTable)
      .where(eq(channelPoliciesTable.guildId, guildId));

    return rows.map((row) => ({
      guildId: row.guildId,
      channelId: row.channelId,
      policy: row.policy as ChannelPolicy
    }));
  }

  public async upsert(guildId: string, channelId: string, policy: ChannelPolicy): Promise<void> {
    await this.database.db
      .insert(channelPoliciesTable)
      .values({
        guildId,
        channelId,
        policy,
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: [channelPoliciesTable.guildId, channelPoliciesTable.channelId],
        set: {
          policy,
          updatedAt: new Date()
        }
      });
  }

  public async remove(guildId: string, channelId: string): Promise<void> {
    await this.database.db
      .delete(channelPoliciesTable)
      .where(
        and(
          eq(channelPoliciesTable.guildId, guildId),
          eq(channelPoliciesTable.channelId, channelId)
        )
      );
  }
}
