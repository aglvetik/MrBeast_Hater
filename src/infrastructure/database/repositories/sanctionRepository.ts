import { and, desc, eq, gte } from "drizzle-orm";

import type { DatabaseClient } from "../client.js";
import { sanctionsTable } from "../schema.js";

export interface SanctionRecord {
  readonly id: string;
  readonly guildId: string;
  readonly actorId: string;
  readonly actorKind: string;
  readonly punishmentType: string;
  readonly durationSeconds: number | null;
  readonly applied: boolean;
  readonly activeUntil: Date | null;
  readonly cooldownUntil: Date | null;
  readonly sourceIncidentId: string | null;
  readonly actionResult: Record<string, unknown>;
  readonly createdAt: Date;
}

export class SanctionRepository {
  public constructor(private readonly database: DatabaseClient) {}

  public async findActiveCooldown(
    guildId: string,
    actorId: string,
    punishmentType: string,
    now: Date
  ): Promise<SanctionRecord | null> {
    const row = await this.database.db.query.sanctionsTable.findFirst({
      where: and(
        eq(sanctionsTable.guildId, guildId),
        eq(sanctionsTable.actorId, actorId),
        eq(sanctionsTable.punishmentType, punishmentType),
        gte(sanctionsTable.cooldownUntil, now)
      ),
      orderBy: [desc(sanctionsTable.createdAt)]
    });

    return row ?? null;
  }

  public async insert(record: SanctionRecord): Promise<void> {
    await this.database.db.insert(sanctionsTable).values(record);
  }
}
