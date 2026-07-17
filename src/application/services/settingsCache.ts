import { SETTINGS_CACHE_TTL_MS } from "../../config/constants.js";
import type { GuildSettings } from "../../domain/policy/types.js";
import type { GuildSettingsRepository } from "../../infrastructure/database/repositories.js";

interface CacheEntry {
  readonly value: GuildSettings | null;
  readonly expiresAt: number;
}

export class GuildSettingsCache {
  private readonly entries = new Map<string, CacheEntry>();

  public constructor(private readonly repository: GuildSettingsRepository) {}

  public async get(guildId: string): Promise<GuildSettings | null> {
    const cached = this.entries.get(guildId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const settings = await this.repository.getByGuildId(guildId);
    this.entries.set(guildId, {
      value: settings,
      expiresAt: Date.now() + SETTINGS_CACHE_TTL_MS
    });
    return settings;
  }

  public invalidate(guildId: string): void {
    this.entries.delete(guildId);
  }
}
