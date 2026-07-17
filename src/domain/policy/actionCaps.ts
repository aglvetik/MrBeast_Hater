import type {
  ActionPlan,
  ActorActivityClass,
  ActorContext,
  ActorPolicy,
  ChannelGuardMode,
  CorrelationStage,
  GuildSettings,
  ModerationDecision,
  PunishmentType,
  RiskExplanation
} from "./types.js";

const DECISION_ORDER: readonly ModerationDecision[] = [
  "ALLOW",
  "OBSERVE",
  "LOG_ONLY",
  "DELETE_ONLY",
  "QUARANTINE",
  "ENFORCE"
];

function minDecision(left: ModerationDecision, right: ModerationDecision): ModerationDecision {
  return DECISION_ORDER.indexOf(left) <= DECISION_ORDER.indexOf(right) ? left : right;
}

function punishmentFromDecision(
  settings: GuildSettings,
  actor: ActorContext,
  decision: ModerationDecision
): { readonly type: PunishmentType; readonly durationSeconds: number | null } {
  if (decision === "QUARANTINE") {
    return {
      type: "TIMEOUT",
      durationSeconds: settings.quarantineTimeoutSeconds
    };
  }

  if (decision !== "ENFORCE") {
    return {
      type: "NONE",
      durationSeconds: null
    };
  }

  if (actor.actorKind === "BOT") {
    return {
      type: settings.botPunishment,
      durationSeconds: null
    };
  }

  if (settings.memberPunishment !== "TIMEOUT") {
    return {
      type: settings.memberPunishment,
      durationSeconds: null
    };
  }

  return {
    type: "TIMEOUT",
    durationSeconds: settings.memberTimeoutSeconds
  };
}

export interface ActionCapInput {
  readonly settings: GuildSettings;
  readonly actor: ActorContext;
  readonly explanation: RiskExplanation;
  readonly desiredDecision: ModerationDecision;
  readonly correlationStage: CorrelationStage;
  readonly actorActivityClass: ActorActivityClass;
  readonly authorizedPublisherInScope: boolean;
  readonly actorPolicy: ActorPolicy | null;
  readonly channelPolicy: ChannelGuardMode;
  readonly categoryPolicy: ChannelGuardMode | null;
  readonly activeRaidMatch: boolean;
  readonly warmupActive: boolean;
  readonly strongIdentitySignal: boolean;
}

export function applyActionCaps(input: ActionCapInput): ActionPlan {
  let finalDecision = input.desiredDecision;
  const policyCaps: string[] = [];

  if (input.channelPolicy === "IGNORE_ALL" || input.actorPolicy === "FULL_BYPASS") {
    finalDecision = "ALLOW";
    policyCaps.push("absolute_bypass");
  } else if (input.channelPolicy === "MONITOR_ONLY" || input.actorPolicy === "MONITOR_ONLY") {
    finalDecision = minDecision(finalDecision, "LOG_ONLY");
    policyCaps.push("monitor_only_scope");
  } else if (input.channelPolicy === "NO_PUNISH" || input.actorPolicy === "NO_PUNISH") {
    finalDecision = minDecision(finalDecision, "DELETE_ONLY");
    policyCaps.push("no_punish_scope");
  } else if (
    input.channelPolicy === "DELETE_ONLY" ||
    input.settings.operationMode === "DELETE_ONLY"
  ) {
    finalDecision = minDecision(finalDecision, "DELETE_ONLY");
    policyCaps.push("delete_only_scope");
  }

  if (input.actor.isGuildOwner) {
    finalDecision = minDecision(finalDecision, "DELETE_ONLY");
    policyCaps.push("guild_owner_never_auto_punished");
  }

  if (input.actor.isAdministrator || input.actor.canManageGuild) {
    if (finalDecision === "ENFORCE" && input.settings.memberPunishment !== "TIMEOUT") {
      finalDecision = "QUARANTINE";
      policyCaps.push("admin_enforcement_downgraded");
    } else {
      finalDecision = minDecision(finalDecision, "DELETE_ONLY");
      policyCaps.push("administrator_first_strike_cap");
    }
  }

  if (input.correlationStage === "FIRST") {
    if (input.authorizedPublisherInScope) {
      finalDecision = minDecision(finalDecision, "OBSERVE");
      policyCaps.push("scoped_publisher_first_event");
    } else if (input.settings.firstStrikeBehavior === "MONITOR_ON_FIRST") {
      finalDecision = minDecision(finalDecision, "LOG_ONLY");
      policyCaps.push("cautious_first_strike");
    } else if (
      (input.actorActivityClass === "ESTABLISHED" || input.actorActivityClass === "KNOWN") &&
      !input.strongIdentitySignal
    ) {
      finalDecision = minDecision(finalDecision, "DELETE_ONLY");
      policyCaps.push("established_first_event_cap");
    } else if (input.warmupActive && !input.strongIdentitySignal) {
      finalDecision = minDecision(finalDecision, "DELETE_ONLY");
      policyCaps.push("guild_warmup_cap");
    } else if (
      input.settings.firstStrikeBehavior !== "QUARANTINE_HIGH_CONFIDENCE" ||
      !input.strongIdentitySignal
    ) {
      finalDecision = minDecision(finalDecision, "DELETE_ONLY");
      policyCaps.push("first_event_no_long_punishment");
    }
  }

  if (input.activeRaidMatch && input.correlationStage === "FIRST" && input.strongIdentitySignal) {
    finalDecision =
      DECISION_ORDER.indexOf(finalDecision) < DECISION_ORDER.indexOf("QUARANTINE")
        ? "QUARANTINE"
        : finalDecision;
    policyCaps.push("active_raid_quarantine_floor");
  }

  if (input.settings.dryRunEnabled || input.settings.operationMode === "MONITOR") {
    finalDecision = minDecision(finalDecision, "LOG_ONLY");
    policyCaps.push(input.settings.dryRunEnabled ? "dry_run" : "global_monitor_mode");
  }

  const punishment = punishmentFromDecision(input.settings, input.actor, finalDecision);
  const shouldDelete =
    !input.settings.dryRunEnabled &&
    ["DELETE_ONLY", "QUARANTINE", "ENFORCE"].includes(finalDecision);
  const shouldPunish =
    !input.settings.dryRunEnabled &&
    (finalDecision === "QUARANTINE" || finalDecision === "ENFORCE") &&
    punishment.type !== "NONE";

  const explanation: RiskExplanation = {
    ...input.explanation,
    policyCaps,
    finalDecision
  };

  return {
    decision: finalDecision,
    shouldDelete,
    shouldPunish,
    punishmentType: shouldPunish ? punishment.type : "NONE",
    punishmentDurationSeconds: shouldPunish ? punishment.durationSeconds : null,
    shouldLog: finalDecision !== "ALLOW" || input.authorizedPublisherInScope,
    shouldObserve: finalDecision === "OBSERVE" || input.authorizedPublisherInScope,
    dryRun: input.settings.dryRunEnabled,
    channelPolicy: input.channelPolicy,
    categoryPolicy: input.categoryPolicy,
    actorPolicy: input.actorPolicy,
    policyCaps,
    explanation,
    isConfirmedStrike: finalDecision === "ENFORCE",
    removePunishmentOnFalsePositive: finalDecision === "QUARANTINE" || finalDecision === "ENFORCE"
  };
}
