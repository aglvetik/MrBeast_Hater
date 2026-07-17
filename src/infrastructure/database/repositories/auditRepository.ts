import { randomUUID } from "node:crypto";

import type { DatabaseClient } from "../client.js";
import { configAuditEventsTable } from "../schema.js";

export class AuditRepository {
  public constructor(private readonly database: DatabaseClient) {}

  public async append(
    guildId: string,
    actorId: string,
    eventType: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    await this.database.db.insert(configAuditEventsTable).values({
      id: randomUUID(),
      guildId,
      actorId,
      eventType,
      payload
    });
  }
}
