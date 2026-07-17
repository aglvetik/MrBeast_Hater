import { randomUUID } from "node:crypto";

import { summarizeCorrelation } from "../../domain/detection/correlation.js";
import type { CorrelationEvent, CorrelationSummary } from "../../domain/detection/types.js";
import type { RecentDetectionEventRepository } from "../../infrastructure/database/repositories.js";

export class CorrelationService {
  public constructor(private readonly repository: RecentDetectionEventRepository) {}

  public async summarize(
    input: Omit<CorrelationEvent, "id" | "createdAt"> & {
      readonly createdAt: Date;
      readonly windowSeconds: number;
    }
  ): Promise<{ readonly current: CorrelationEvent; readonly summary: CorrelationSummary }> {
    const current: CorrelationEvent = {
      ...input,
      id: randomUUID()
    };
    const since = new Date(input.createdAt.getTime() - input.windowSeconds * 1_000);
    const recent = await this.repository.listMatchingRecent(
      input.guildId,
      since,
      input.exactFingerprint,
      input.structuralFingerprint,
      input.protectedMentionClass
    );

    return {
      current,
      summary: summarizeCorrelation(current, recent)
    };
  }

  public async record(event: CorrelationEvent, windowSeconds: number): Promise<void> {
    const expiresAt = new Date(event.createdAt.getTime() + windowSeconds * 1_000);
    await this.repository.insert(event, expiresAt);
  }

  public async deleteExpired(now: Date): Promise<number> {
    return this.repository.deleteExpired(now);
  }
}
