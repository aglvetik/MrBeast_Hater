import type { GuildSettings, Locale, Preset } from "./types.js";

import { buildDefaultGuildSettings } from "../../config/constants.js";

export function applyPreset(guildId: string, preset: Preset, locale: Locale): GuildSettings {
  const base = buildDefaultGuildSettings(guildId, locale);

  switch (preset) {
    case "BALANCED":
      return {
        ...base,
        preset,
        roleDetectionMode: "MANUAL",
        minVisualCount: 1,
        maxInformationChars: 40,
        burstMessageCount: 2,
        burstWindowSeconds: 10,
        memberPunishment: "TIMEOUT",
        memberTimeoutSeconds: 86_400,
        botPunishment: "NONE",
        operationMode: "ENFORCE",
        linkRuleEnabled: true
      };
    case "STRICT":
      return {
        ...base,
        preset,
        roleDetectionMode: "ALL_ROLES",
        minVisualCount: 1,
        maxInformationChars: 120,
        burstMessageCount: 2,
        burstWindowSeconds: 15,
        memberPunishment: "TIMEOUT",
        memberTimeoutSeconds: 604_800,
        botPunishment: "NONE",
        operationMode: "ENFORCE",
        linkRuleEnabled: true
      };
    case "MONITOR":
      return {
        ...base,
        preset,
        operationMode: "MONITOR",
        memberPunishment: "NONE",
        memberTimeoutSeconds: null,
        botPunishment: "NONE"
      };
  }
}
