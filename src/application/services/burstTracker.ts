import { BURST_BUFFER_LIMIT } from "../../config/constants.js";
import type { RecentSuspiciousMessage } from "../../domain/detection/types.js";

interface BurstEntry {
  readonly guildId: string;
  readonly actorId: string;
  readonly createdTimestamp: number;
}

export class BurstTracker {
  private readonly entries = new Map<string, BurstEntry[]>();

  public getRecent(
    guildId: string,
    actorId: string,
    windowSeconds: number,
    nowMs: number
  ): readonly RecentSuspiciousMessage[] {
    const key = `${guildId}:${actorId}`;
    const entries = this.entries.get(key) ?? [];
    const threshold = nowMs - windowSeconds * 1_000;
    const filtered = entries.filter((entry) => entry.createdTimestamp >= threshold);
    this.entries.set(key, filtered);
    return filtered;
  }

  public record(guildId: string, actorId: string, createdTimestamp: number): void {
    const key = `${guildId}:${actorId}`;
    const entries = this.entries.get(key) ?? [];
    const next = [...entries, { guildId, actorId, createdTimestamp }].slice(-BURST_BUFFER_LIMIT);
    this.entries.set(key, next);
  }
}
