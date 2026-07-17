import type { MessageMentionOptions } from "discord.js";

import {
  type EscalationMode,
  type GuildSettings,
  type Locale,
  type Preset,
  type PunishmentType
} from "../domain/policy/types.js";

export const ALLOWED_MENTIONS: MessageMentionOptions = {
  parse: [],
  users: [],
  roles: [],
  repliedUser: false
};

export const DEFAULT_LOCALE: Locale = "en";
export const RETENTION_DAY_OPTIONS = [7, 30, 90, 180] as const;
export const DEFAULT_RETENTION_DAYS = 90;
export const SETTINGS_CACHE_TTL_MS = 60_000;
export const SETUP_SESSION_TTL_MS = 15 * 60_000;
export const SANCTION_COOLDOWN_MS = 60_000;
export const BURST_BUFFER_LIMIT = 20;
export const MESSAGE_PROCESSING_BUDGET_MS = 2_000;

export const DEFAULT_ESCALATION_MODE: EscalationMode = "PRESET";

export const PRESET_TIMEOUTS: Readonly<Record<Preset, number>> = {
  BALANCED: 86_400,
  STRICT: 604_800,
  MONITOR: 0
};

export const PRESET_MEMBER_PUNISHMENT: Readonly<Record<Preset, PunishmentType>> = {
  BALANCED: "TIMEOUT",
  STRICT: "TIMEOUT",
  MONITOR: "NONE"
};

export function buildDefaultGuildSettings(
  guildId: string,
  locale: Locale = DEFAULT_LOCALE
): GuildSettings {
  const now = new Date();

  return {
    guildId,
    enabled: false,
    locale,
    operationMode: "ENFORCE",
    preset: "BALANCED",
    logChannelId: null,
    roleDetectionMode: "MANUAL",
    memberPunishment: "TIMEOUT",
    memberTimeoutSeconds: 86_400,
    botPunishment: "NONE",
    minVisualCount: 1,
    maxInformationChars: 40,
    burstWindowSeconds: 10,
    burstMessageCount: 2,
    escalationMode: DEFAULT_ESCALATION_MODE,
    retentionDays: DEFAULT_RETENTION_DAYS,
    dryRunEnabled: false,
    linkRuleEnabled: true,
    sanctionCooldownSeconds: 60,
    createdAt: now,
    updatedAt: now,
    deletionRequestedAt: null,
    deletionGraceUntil: null
  };
}
