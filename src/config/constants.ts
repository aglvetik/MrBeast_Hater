import type { MessageMentionOptions } from "discord.js";

import {
  type EscalationMode,
  type FirstStrikeBehavior,
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
export const DEFAULT_FIRST_STRIKE_BEHAVIOR: FirstStrikeBehavior = "DELETE_ON_FIRST";

export const PRESET_TIMEOUTS: Readonly<Record<Preset, number>> = {
  BALANCED: 86_400,
  STRICT: 604_800,
  CAUTIOUS: 600,
  MONITOR: 0
};

export const PRESET_MEMBER_PUNISHMENT: Readonly<Record<Preset, PunishmentType>> = {
  BALANCED: "TIMEOUT",
  STRICT: "TIMEOUT",
  CAUTIOUS: "TIMEOUT",
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
    firstStrikeBehavior: DEFAULT_FIRST_STRIKE_BEHAVIOR,
    warmupDays: 7,
    guildWarmupStartedAt: now,
    correlationWindowSeconds: 30,
    raidSessionDurationSeconds: 300,
    quarantineTimeoutSeconds: 60,
    newAccountMaxAgeHours: 24 * 30,
    newJoinMaxAgeHours: 24 * 7,
    meaningfulTextThreshold: 80,
    observeThreshold: 35,
    logOnlyThreshold: 50,
    deleteThreshold: 70,
    quarantineThreshold: 90,
    enforceThreshold: 110,
    createdAt: now,
    updatedAt: now,
    deletionRequestedAt: null,
    deletionGraceUntil: null
  };
}
