import { describe, expect, it } from "vitest";

import { buildDefaultGuildSettings } from "../../src/config/constants.js";
import { applyActionCaps, type ActionCapInput } from "../../src/domain/policy/actionCaps.js";
import { applyPreset } from "../../src/domain/policy/presets.js";
import {
  resolveEffectiveChannelPolicy,
  selectMatchingActorPolicy
} from "../../src/domain/policy/policyPrecedence.js";
import type {
  ActorContext,
  GuildSettings,
  RiskExplanation,
  ScopedActorPolicy
} from "../../src/domain/policy/types.js";

function settings(overrides: Partial<GuildSettings> = {}): GuildSettings {
  return {
    ...buildDefaultGuildSettings("guild-1"),
    enabled: true,
    ...overrides
  };
}

function actor(overrides: Partial<ActorContext> = {}): ActorContext {
  return {
    actorId: "actor-1",
    actorKind: "USER",
    roleIds: [],
    isAdministrator: false,
    canManageGuild: false,
    isGuildOwner: false,
    createdTimestamp: null,
    joinedTimestamp: null,
    ...overrides
  };
}

function explanation(overrides: Partial<RiskExplanation> = {}): RiskExplanation {
  return {
    score: 120,
    signals: [],
    positiveTotal: 120,
    negativeTotal: 0,
    activityClass: "UNKNOWN",
    channelContext: "text channel",
    correlationStage: "FIRST",
    policyCaps: [],
    finalDecision: "ENFORCE",
    ...overrides
  };
}

function actionCapInput(overrides: Partial<ActionCapInput> = {}): ActionCapInput {
  return {
    settings: settings(),
    actor: actor(),
    explanation: explanation(),
    desiredDecision: "ENFORCE",
    correlationStage: "CONFIRMED",
    actorActivityClass: "UNKNOWN",
    authorizedPublisherInScope: false,
    actorPolicy: null,
    channelPolicy: "ENFORCE",
    categoryPolicy: null,
    activeRaidMatch: false,
    warmupActive: false,
    strongIdentitySignal: false,
    ...overrides
  };
}

function scopedPolicy(overrides: Partial<ScopedActorPolicy> = {}): ScopedActorPolicy {
  const now = new Date("2026-07-17T12:00:00.000Z");
  return {
    id: "policy-1",
    guildId: "guild-1",
    targetId: "actor-1",
    targetType: "USER",
    policy: "SCOPED_PUBLISHER",
    scopeType: "GUILD",
    scopeId: null,
    expiresAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

describe("policy controls", () => {
  it("applies presets for balanced, strict, cautious, and monitor modes", () => {
    const balanced = applyPreset("guild-1", "BALANCED", "en");
    expect(balanced.firstStrikeBehavior).toBe("DELETE_ON_FIRST");
    expect(balanced.quarantineTimeoutSeconds).toBe(60);

    const strict = applyPreset("guild-1", "STRICT", "en");
    expect(strict.firstStrikeBehavior).toBe("QUARANTINE_HIGH_CONFIDENCE");
    expect(strict.deleteThreshold).toBe(60);
    expect(strict.memberTimeoutSeconds).toBe(3_600);

    const cautious = applyPreset("guild-1", "CAUTIOUS", "ru");
    expect(cautious.locale).toBe("ru");
    expect(cautious.firstStrikeBehavior).toBe("MONITOR_ON_FIRST");
    expect(cautious.quarantineThreshold).toBe(999);

    const monitor = applyPreset("guild-1", "MONITOR", "en");
    expect(monitor.operationMode).toBe("MONITOR");
    expect(monitor.memberPunishment).toBe("NONE");
  });

  it("normalizes effective channel policies across explicit, inherited, and legacy values", () => {
    expect(resolveEffectiveChannelPolicy("DELETE_ONLY", "NO_PUNISH")).toBe("DELETE_ONLY");
    expect(resolveEffectiveChannelPolicy("MONITOR", "ENFORCE")).toBe("MONITOR_ONLY");
    expect(resolveEffectiveChannelPolicy("DISABLED", "ENFORCE")).toBe("IGNORE_ALL");
    expect(resolveEffectiveChannelPolicy("INHERIT", "NO_PUNISH")).toBe("NO_PUNISH");
    expect(resolveEffectiveChannelPolicy(null, "MONITOR")).toBe("MONITOR_ONLY");
    expect(resolveEffectiveChannelPolicy(null, "DISABLED")).toBe("IGNORE_ALL");
    expect(resolveEffectiveChannelPolicy("INHERIT", "INHERIT")).toBe("ENFORCE");
  });

  it("selects actor policies by target type, scope match, specificity, and expiry", () => {
    const now = new Date("2026-07-17T12:00:00.000Z");
    const matchedRolePolicy = selectMatchingActorPolicy(
      actor({ roleIds: ["role-1"] }),
      [
        scopedPolicy({
          id: "guild-role",
          targetId: "role-1",
          targetType: "ROLE",
          scopeType: "GUILD"
        }),
        scopedPolicy({
          id: "channel-role",
          targetId: "role-1",
          targetType: "ROLE",
          scopeType: "CHANNEL",
          scopeId: "channel-9"
        })
      ],
      {
        channelId: "channel-9",
        categoryId: "category-1"
      },
      now
    );
    expect(matchedRolePolicy?.id).toBe("channel-role");

    expect(
      selectMatchingActorPolicy(
        actor({ actorId: "bot-1", actorKind: "BOT" }),
        [
          scopedPolicy({
            id: "bot-category",
            targetId: "bot-1",
            targetType: "BOT",
            policy: "MONITOR_ONLY",
            scopeType: "CATEGORY",
            scopeId: "category-1"
          })
        ],
        {
          channelId: "channel-2",
          categoryId: "category-1"
        },
        now
      )?.policy
    ).toBe("MONITOR_ONLY");

    expect(
      selectMatchingActorPolicy(
        actor({ actorId: "webhook-1", actorKind: "WEBHOOK" }),
        [
          scopedPolicy({
            id: "webhook-global",
            targetId: "webhook-1",
            targetType: "WEBHOOK",
            policy: "FULL_BYPASS",
            scopeType: "GUILD"
          }),
          scopedPolicy({
            id: "expired-user",
            targetId: "actor-1",
            expiresAt: new Date("2026-07-16T12:00:00.000Z")
          })
        ],
        {
          channelId: "channel-2",
          categoryId: null
        },
        now
      )?.policy
    ).toBe("FULL_BYPASS");

    expect(
      selectMatchingActorPolicy(
        actor(),
        [
          scopedPolicy({
            id: "wrong-channel",
            scopeType: "CHANNEL",
            scopeId: "other-channel"
          })
        ],
        {
          channelId: "channel-2",
          categoryId: "category-1"
        },
        now
      )
    ).toBeNull();
  });

  it("caps absolute bypass, monitor-only, no-punish, and delete-only scopes", () => {
    expect(
      applyActionCaps(
        actionCapInput({
          channelPolicy: "IGNORE_ALL"
        })
      ).decision
    ).toBe("ALLOW");

    expect(
      applyActionCaps(
        actionCapInput({
          actorPolicy: "MONITOR_ONLY"
        })
      ).decision
    ).toBe("LOG_ONLY");

    expect(
      applyActionCaps(
        actionCapInput({
          actorPolicy: "NO_PUNISH"
        })
      ).decision
    ).toBe("DELETE_ONLY");

    expect(
      applyActionCaps(
        actionCapInput({
          settings: settings({ operationMode: "DELETE_ONLY" })
        })
      ).decision
    ).toBe("DELETE_ONLY");
  });

  it("protects owners and administrators from automatic long punishment", () => {
    const ownerPlan = applyActionCaps(
      actionCapInput({
        actor: actor({ isGuildOwner: true })
      })
    );
    expect(ownerPlan.decision).toBe("DELETE_ONLY");
    expect(ownerPlan.shouldPunish).toBe(false);

    const adminTimeoutPlan = applyActionCaps(
      actionCapInput({
        actor: actor({ isAdministrator: true }),
        settings: settings({ memberPunishment: "TIMEOUT" })
      })
    );
    expect(adminTimeoutPlan.decision).toBe("DELETE_ONLY");
    expect(adminTimeoutPlan.shouldPunish).toBe(false);

    const adminBanPlan = applyActionCaps(
      actionCapInput({
        actor: actor({ canManageGuild: true }),
        settings: settings({ memberPunishment: "BAN" })
      })
    );
    expect(adminBanPlan.decision).toBe("QUARANTINE");
    expect(adminBanPlan.shouldPunish).toBe(true);
    expect(adminBanPlan.punishmentType).toBe("TIMEOUT");
  });

  it("caps first events for publishers, cautious mode, warmup, established actors, and ordinary first strikes", () => {
    const publisherPlan = applyActionCaps(
      actionCapInput({
        correlationStage: "FIRST",
        authorizedPublisherInScope: true
      })
    );
    expect(publisherPlan.decision).toBe("OBSERVE");
    expect(publisherPlan.shouldObserve).toBe(true);

    expect(
      applyActionCaps(
        actionCapInput({
          correlationStage: "FIRST",
          settings: settings({ firstStrikeBehavior: "MONITOR_ON_FIRST" })
        })
      ).decision
    ).toBe("LOG_ONLY");

    expect(
      applyActionCaps(
        actionCapInput({
          correlationStage: "FIRST",
          actorActivityClass: "ESTABLISHED"
        })
      ).decision
    ).toBe("DELETE_ONLY");

    expect(
      applyActionCaps(
        actionCapInput({
          correlationStage: "FIRST",
          warmupActive: true
        })
      ).decision
    ).toBe("DELETE_ONLY");

    expect(
      applyActionCaps(
        actionCapInput({
          correlationStage: "FIRST",
          actorActivityClass: "UNKNOWN",
          settings: settings({ firstStrikeBehavior: "DELETE_ON_FIRST" })
        })
      ).decision
    ).toBe("DELETE_ONLY");
  });

  it("supports active-raid quarantine floors, dry-run mode, monitor mode, and punishment selection", () => {
    const raidPlan = applyActionCaps(
      actionCapInput({
        desiredDecision: "LOG_ONLY",
        correlationStage: "FIRST",
        activeRaidMatch: true,
        strongIdentitySignal: true,
        settings: settings({
          firstStrikeBehavior: "QUARANTINE_HIGH_CONFIDENCE"
        })
      })
    );
    expect(raidPlan.decision).toBe("QUARANTINE");
    expect(raidPlan.shouldDelete).toBe(true);
    expect(raidPlan.shouldPunish).toBe(true);
    expect(raidPlan.removePunishmentOnFalsePositive).toBe(true);

    const dryRunPlan = applyActionCaps(
      actionCapInput({
        settings: settings({ dryRunEnabled: true })
      })
    );
    expect(dryRunPlan.decision).toBe("LOG_ONLY");
    expect(dryRunPlan.shouldDelete).toBe(false);

    const monitorPlan = applyActionCaps(
      actionCapInput({
        settings: settings({ operationMode: "MONITOR" })
      })
    );
    expect(monitorPlan.decision).toBe("LOG_ONLY");

    const botPlan = applyActionCaps(
      actionCapInput({
        actor: actor({ actorKind: "BOT" }),
        settings: settings({ botPunishment: "KICK" })
      })
    );
    expect(botPlan.punishmentType).toBe("KICK");

    const banPlan = applyActionCaps(
      actionCapInput({
        settings: settings({ memberPunishment: "BAN" })
      })
    );
    expect(banPlan.punishmentType).toBe("BAN");
  });
});
