import { describe, expect, it } from "vitest";

import { buildDefaultGuildSettings } from "../../src/config/constants.js";
import { evaluatePolicy } from "../../src/domain/policy/engine.js";
import {
  chooseCustomEscalation,
  choosePresetEscalation,
  clampTimeoutSeconds
} from "../../src/domain/policy/escalation.js";
import type { DetectionResult } from "../../src/domain/detection/types.js";
import type {
  ActionPlan,
  ActorContext,
  GuildSettings,
  TrustedActor
} from "../../src/domain/policy/types.js";

const detection: DetectionResult = {
  detected: true,
  ruleId: "VISUAL_MASS_PING",
  confidence: "MEDIUM",
  signals: [],
  protectedMentions: [{ kind: "EVERYONE" }],
  media: {
    imageAttachments: 1,
    gifAttachments: 0,
    videoAttachments: 0,
    embedImages: 0,
    embedThumbnails: 0,
    stickers: 0,
    totalVisualCount: 1
  },
  normalizedText: {
    totalLength: 0,
    informationCharCount: 0,
    wordCount: 0,
    urlCount: 0,
    emojiCount: 0,
    punctuationRatio: 0,
    isLowInformation: true,
    onlyLinksEmojiPunctuationOrWhitespace: true
  }
};

function settings(overrides: Partial<GuildSettings> = {}): GuildSettings {
  return {
    ...buildDefaultGuildSettings("100"),
    enabled: true,
    ...overrides
  };
}

function actor(overrides: Partial<ActorContext> = {}): ActorContext {
  return {
    actorId: "400",
    actorKind: "USER",
    roleIds: [],
    isAdministrator: false,
    isGuildOwner: false,
    ...overrides
  };
}

function plan(options: {
  readonly settings?: Partial<GuildSettings>;
  readonly actor?: Partial<ActorContext>;
  readonly trustedActors?: readonly TrustedActor[];
  readonly channelPolicy?: "ENFORCE" | "DELETE_ONLY" | "MONITOR" | "DISABLED";
}): ActionPlan {
  return evaluatePolicy({
    settings: settings(options.settings),
    detection,
    actor: actor(options.actor),
    channelPolicy: options.channelPolicy ?? "ENFORCE",
    trustedActors: options.trustedActors ?? [],
    incidentCountWithinWindow: 1,
    escalationSteps: []
  });
}

describe("policy engine", () => {
  it("enforces by deleting, punishing, and logging", () => {
    const result = plan({});

    expect(result.shouldDelete).toBe(true);
    expect(result.shouldPunish).toBe(true);
    expect(result.shouldLog).toBe(true);
    expect(result.punishmentType).toBe("TIMEOUT");
  });

  it("delete-only channel policy suppresses punishment", () => {
    const result = plan({ channelPolicy: "DELETE_ONLY" });

    expect(result.shouldDelete).toBe(true);
    expect(result.shouldPunish).toBe(false);
    expect(result.shouldLog).toBe(true);
  });

  it("monitor policy only logs", () => {
    const result = plan({ channelPolicy: "MONITOR" });

    expect(result.shouldDelete).toBe(false);
    expect(result.shouldPunish).toBe(false);
    expect(result.shouldLog).toBe(true);
  });

  it("disabled channel policy skips every action", () => {
    const result = plan({ channelPolicy: "DISABLED" });

    expect(result.shouldDelete).toBe(false);
    expect(result.shouldPunish).toBe(false);
    expect(result.shouldLog).toBe(false);
  });

  it("allow trust skips processing", () => {
    const result = plan({
      trustedActors: [{ guildId: "100", actorId: "777", actorType: "ROLE", policy: "ALLOW" }],
      actor: { roleIds: ["777"] }
    });

    expect(result.shouldDelete).toBe(false);
    expect(result.shouldLog).toBe(false);
  });

  it("monitor trust logs without destructive actions", () => {
    const result = plan({
      trustedActors: [{ guildId: "100", actorId: "777", actorType: "BOT", policy: "MONITOR" }],
      actor: { actorKind: "BOT", actorId: "777" }
    });

    expect(result.shouldDelete).toBe(false);
    expect(result.shouldPunish).toBe(false);
    expect(result.shouldLog).toBe(true);
    expect(result.trustPolicy).toBe("MONITOR");
  });

  it("no-punish trust still deletes and logs", () => {
    const result = plan({
      trustedActors: [{ guildId: "100", actorId: "777", actorType: "ROLE", policy: "NO_PUNISH" }],
      actor: { roleIds: ["777"] }
    });

    expect(result.shouldDelete).toBe(true);
    expect(result.shouldPunish).toBe(false);
    expect(result.shouldLog).toBe(true);
  });

  it("does not timeout administrators or bots", () => {
    expect(plan({ actor: { isAdministrator: true } }).shouldPunish).toBe(false);
    expect(plan({ actor: { isGuildOwner: true } }).shouldPunish).toBe(false);
    expect(plan({ actor: { actorKind: "BOT" } }).punishmentType).toBe("NONE");
  });

  it("supports explicit bot kick and webhook monitor semantics", () => {
    expect(
      plan({
        settings: { botPunishment: "KICK" },
        actor: { actorKind: "BOT" }
      }).punishmentType
    ).toBe("KICK");
    expect(plan({ actor: { actorKind: "WEBHOOK" } }).shouldPunish).toBe(false);
  });

  it("returns no action for a non-detected result", () => {
    const result = evaluatePolicy({
      settings: settings(),
      detection: { ...detection, detected: false },
      actor: actor(),
      channelPolicy: "ENFORCE",
      trustedActors: [],
      incidentCountWithinWindow: 1,
      escalationSteps: []
    });

    expect(result.shouldDelete).toBe(false);
    expect(result.shouldPunish).toBe(false);
    expect(result.shouldLog).toBe(false);
  });

  it("uses custom escalation steps when configured", () => {
    const result = evaluatePolicy({
      settings: settings({ escalationMode: "CUSTOM" }),
      detection,
      actor: actor(),
      channelPolicy: "ENFORCE",
      trustedActors: [],
      incidentCountWithinWindow: 2,
      escalationSteps: [
        {
          id: "step",
          guildId: "100",
          orderIndex: 0,
          thresholdCount: 2,
          windowDays: 30,
          punishmentType: "KICK",
          durationSeconds: null,
          enabled: true
        }
      ]
    });

    expect(result.shouldPunish).toBe(true);
    expect(result.punishmentType).toBe("KICK");
  });

  it("dry-run logs without destructive actions", () => {
    const result = plan({ settings: { dryRunEnabled: true } });

    expect(result.shouldDelete).toBe(false);
    expect(result.shouldPunish).toBe(false);
    expect(result.shouldLog).toBe(true);
  });

  it("clamps timeout values and selects preset escalation", () => {
    expect(clampTimeoutSeconds(1)).toBe(60);
    expect(clampTimeoutSeconds(9_999_999)).toBe(2_419_200);
    expect(choosePresetEscalation(1).durationSeconds).toBe(3_600);
    expect(choosePresetEscalation(2).durationSeconds).toBe(86_400);
    expect(choosePresetEscalation(3).durationSeconds).toBe(604_800);
    expect(choosePresetEscalation(4).durationSeconds).toBe(2_419_200);
    expect(
      chooseCustomEscalation(
        [
          {
            id: "1",
            guildId: "100",
            orderIndex: 0,
            thresholdCount: 1,
            windowDays: 30,
            punishmentType: "TIMEOUT",
            durationSeconds: 1,
            enabled: true
          },
          {
            id: "2",
            guildId: "100",
            orderIndex: 1,
            thresholdCount: 2,
            windowDays: 30,
            punishmentType: "KICK",
            durationSeconds: null,
            enabled: true
          }
        ],
        2
      )
    ).toEqual({ punishmentType: "KICK", durationSeconds: null });
    expect(chooseCustomEscalation([], 1)).toBeNull();
  });
});
