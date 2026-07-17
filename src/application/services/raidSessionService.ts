import { randomUUID } from "node:crypto";

import type { CorrelationSummary } from "../../domain/detection/types.js";
import type {
  RaidSessionRepository,
  RaidSessionRecord
} from "../../infrastructure/database/repositories.js";

export class RaidSessionService {
  public constructor(private readonly repository: RaidSessionRepository) {}

  public async findMatching(
    guildId: string,
    now: Date,
    exactFingerprint: string | null,
    structuralFingerprint: string | null,
    protectedMentionClass: string | null
  ): Promise<RaidSessionRecord | null> {
    const active = await this.repository.listActive(guildId, now);
    return (
      active.find((session) => {
        if (exactFingerprint && session.exactFingerprints.includes(exactFingerprint)) {
          return true;
        }

        if (
          structuralFingerprint &&
          session.structuralFingerprints.includes(structuralFingerprint)
        ) {
          return true;
        }

        return Boolean(
          protectedMentionClass && session.protectedMentionClasses.includes(protectedMentionClass)
        );
      }) ?? null
    );
  }

  public async absorbEvent(input: {
    readonly guildId: string;
    readonly now: Date;
    readonly durationSeconds: number;
    readonly correlation: CorrelationSummary;
    readonly exactFingerprint: string | null;
    readonly structuralFingerprint: string | null;
    readonly protectedMentionClass: string | null;
    readonly actorId: string;
    readonly channelId: string;
    readonly triggeringRule: string;
  }): Promise<RaidSessionRecord | null> {
    const existing = await this.findMatching(
      input.guildId,
      input.now,
      input.exactFingerprint,
      input.structuralFingerprint,
      input.protectedMentionClass
    );

    if (
      !existing &&
      input.correlation.coordinatedActorIds.length === 0 &&
      input.correlation.stage !== "CONFIRMED"
    ) {
      return null;
    }

    const expiresAt = new Date(input.now.getTime() + input.durationSeconds * 1_000);
    const record: RaidSessionRecord = existing
      ? {
          ...existing,
          exactFingerprints: [
            ...new Set([
              ...existing.exactFingerprints,
              ...(input.exactFingerprint ? [input.exactFingerprint] : [])
            ])
          ],
          structuralFingerprints: [
            ...new Set([
              ...existing.structuralFingerprints,
              ...(input.structuralFingerprint ? [input.structuralFingerprint] : [])
            ])
          ],
          protectedMentionClasses: [
            ...new Set([
              ...existing.protectedMentionClasses,
              ...(input.protectedMentionClass ? [input.protectedMentionClass] : [])
            ])
          ],
          actorIds: [
            ...new Set([
              ...existing.actorIds,
              input.actorId,
              ...input.correlation.coordinatedActorIds
            ])
          ],
          channelIds: [...new Set([...existing.channelIds, input.channelId])],
          state: "ACTIVE",
          lastMatchedAt: input.now,
          expiresAt,
          updatedAt: input.now
        }
      : {
          id: randomUUID(),
          guildId: input.guildId,
          state: "ACTIVE",
          triggeringRule: input.triggeringRule,
          exactFingerprints: input.exactFingerprint ? [input.exactFingerprint] : [],
          structuralFingerprints: input.structuralFingerprint ? [input.structuralFingerprint] : [],
          protectedMentionClasses: input.protectedMentionClass ? [input.protectedMentionClass] : [],
          actorIds: [input.actorId, ...input.correlation.coordinatedActorIds],
          channelIds: [input.channelId],
          overridePayload: null,
          startedAt: input.now,
          lastMatchedAt: input.now,
          expiresAt,
          createdAt: input.now,
          updatedAt: input.now
        };

    await this.repository.upsert(record);
    return record;
  }

  public async stopGuildSessions(guildId: string, now: Date): Promise<void> {
    await this.repository.expireGuildSessions(guildId, now);
  }

  public async deleteExpired(now: Date): Promise<number> {
    return this.repository.deleteExpired(now);
  }
}
