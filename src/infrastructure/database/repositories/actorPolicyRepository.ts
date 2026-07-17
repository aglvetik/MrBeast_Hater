import { and, eq, isNull } from "drizzle-orm";

import type { ScopedActorPolicy } from "../../../domain/policy/types.js";
import type { DatabaseClient } from "../client.js";
import { actorPoliciesTable } from "../schema.js";

function mapRow(row: typeof actorPoliciesTable.$inferSelect): ScopedActorPolicy {
  return {
    id: row.id,
    guildId: row.guildId,
    targetId: row.targetId,
    targetType: row.targetType as ScopedActorPolicy["targetType"],
    policy: row.policy as ScopedActorPolicy["policy"],
    scopeType: row.scopeType as ScopedActorPolicy["scopeType"],
    scopeId: row.scopeId,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export class ActorPolicyRepository {
  public constructor(private readonly database: DatabaseClient) {}

  public async listByGuildId(guildId: string): Promise<readonly ScopedActorPolicy[]> {
    const rows = await this.database.db
      .select()
      .from(actorPoliciesTable)
      .where(eq(actorPoliciesTable.guildId, guildId));

    return rows.map(mapRow);
  }

  public async upsert(entry: ScopedActorPolicy): Promise<void> {
    await this.database.db
      .insert(actorPoliciesTable)
      .values(entry)
      .onConflictDoUpdate({
        target: [
          actorPoliciesTable.guildId,
          actorPoliciesTable.targetId,
          actorPoliciesTable.targetType,
          actorPoliciesTable.scopeType,
          actorPoliciesTable.scopeId
        ],
        set: {
          policy: entry.policy,
          expiresAt: entry.expiresAt,
          updatedAt: new Date()
        }
      });
  }

  public async remove(
    guildId: string,
    targetId: string,
    targetType: ScopedActorPolicy["targetType"],
    scopeType: ScopedActorPolicy["scopeType"],
    scopeId: string | null
  ): Promise<void> {
    await this.database.db
      .delete(actorPoliciesTable)
      .where(
        and(
          eq(actorPoliciesTable.guildId, guildId),
          eq(actorPoliciesTable.targetId, targetId),
          eq(actorPoliciesTable.targetType, targetType),
          eq(actorPoliciesTable.scopeType, scopeType),
          scopeId === null
            ? isNull(actorPoliciesTable.scopeId)
            : eq(actorPoliciesTable.scopeId, scopeId)
        )
      );
  }
}
