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
        memberTimeoutSeconds: 600,
        botPunishment: "NONE",
        operationMode: "ENFORCE",
        linkRuleEnabled: true,
        firstStrikeBehavior: "DELETE_ON_FIRST",
        quarantineTimeoutSeconds: 60,
        correlationWindowSeconds: 30,
        enforceThreshold: 110,
        quarantineThreshold: 90,
        deleteThreshold: 70
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
        memberTimeoutSeconds: 3_600,
        botPunishment: "NONE",
        operationMode: "ENFORCE",
        linkRuleEnabled: true,
        firstStrikeBehavior: "QUARANTINE_HIGH_CONFIDENCE",
        quarantineTimeoutSeconds: 300,
        correlationWindowSeconds: 45,
        deleteThreshold: 60,
        quarantineThreshold: 80,
        enforceThreshold: 100
      };
    case "CAUTIOUS":
      return {
        ...base,
        preset,
        roleDetectionMode: "MANUAL",
        minVisualCount: 1,
        maxInformationChars: 40,
        burstMessageCount: 2,
        burstWindowSeconds: 15,
        memberPunishment: "TIMEOUT",
        memberTimeoutSeconds: 600,
        botPunishment: "NONE",
        operationMode: "ENFORCE",
        linkRuleEnabled: true,
        firstStrikeBehavior: "MONITOR_ON_FIRST",
        quarantineTimeoutSeconds: 60,
        deleteThreshold: 75,
        quarantineThreshold: 999,
        enforceThreshold: 110
      };
    case "MONITOR":
      return {
        ...base,
        preset,
        operationMode: "MONITOR",
        memberPunishment: "NONE",
        memberTimeoutSeconds: null,
        botPunishment: "NONE",
        firstStrikeBehavior: "MONITOR_ON_FIRST"
      };
  }
}
