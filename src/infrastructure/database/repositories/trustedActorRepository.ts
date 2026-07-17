import { and, eq } from "drizzle-orm";

import type { TrustedActor } from "../../../domain/policy/types.js";
import type { DatabaseClient } from "../client.js";
import { trustedActorsTable } from "../schema.js";

export class TrustedActorRepository {
  public constructor(private readonly database: DatabaseClient) {}

  public async listByGuildId(guildId: string): Promise<readonly TrustedActor[]> {
    const rows = await this.database.db
      .select()
      .from(trustedActorsTable)
      .where(eq(trustedActorsTable.guildId, guildId));

    return rows.map((row) => ({
      guildId: row.guildId,
      actorId: row.actorId,
      actorType: row.actorType as TrustedActor["actorType"],
      policy: row.policy as TrustedActor["policy"]
    }));
  }

  public async upsert(entry: TrustedActor): Promise<void> {
    await this.database.db
      .insert(trustedActorsTable)
      .values(entry)
      .onConflictDoUpdate({
        target: [
          trustedActorsTable.guildId,
          trustedActorsTable.actorId,
          trustedActorsTable.actorType
        ],
        set: {
          policy: entry.policy,
          updatedAt: new Date()
        }
      });
  }

  public async remove(
    guildId: string,
    actorId: string,
    actorType: TrustedActor["actorType"]
  ): Promise<void> {
    await this.database.db
      .delete(trustedActorsTable)
      .where(
        and(
          eq(trustedActorsTable.guildId, guildId),
          eq(trustedActorsTable.actorId, actorId),
          eq(trustedActorsTable.actorType, actorType)
        )
      );
  }
}
