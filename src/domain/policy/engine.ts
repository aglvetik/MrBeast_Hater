import {
  chooseCustomEscalation,
  choosePresetEscalation,
  clampTimeoutSeconds
} from "./escalation.js";
import type {
  ActionPlan,
  ActorContext,
  ChannelPolicy,
  EscalationStep,
  GuildSettings,
  PunishmentType,
  TrustedActor
} from "./types.js";
import type { DetectionResult } from "../detection/types.js";

type LegacyTrustPolicy = "NO_PUNISH" | "MONITOR_ONLY" | "FULL_BYPASS" | null;

export interface PolicyEvaluationInput {
  readonly settings: GuildSettings;
  readonly detection: DetectionResult;
  readonly actor: ActorContext;
  readonly channelPolicy: ChannelPolicy;
  readonly trustedActors: readonly TrustedActor[];
  readonly incidentCountWithinWindow: number;
  readonly escalationSteps: readonly EscalationStep[];
}

function ensureExplanation(detection: DetectionResult): ActionPlan["explanation"] {
  return (
    detection.explanation ?? {
      score: detection.score ?? 0,
      signals: detection.signals,
      positiveTotal: detection.signals
        .filter((signal) => signal.weight > 0)
        .reduce((sum, signal) => sum + signal.weight, 0),
      negativeTotal: Math.abs(
        detection.signals
          .filter((signal) => signal.weight < 0)
          .reduce((sum, signal) => sum + signal.weight, 0)
      ),
      activityClass: "UNKNOWN",
      channelContext: "unclassified channel",
      correlationStage: detection.correlationStage ?? "NONE",
      policyCaps: [],
      finalDecision: detection.suggestedDecision ?? "ALLOW"
    }
  );
}

function deriveTrustPolicy(
  actor: ActorContext,
  trustedActors: readonly TrustedActor[]
): LegacyTrustPolicy {
  let selected: LegacyTrustPolicy = null;

  for (const entry of trustedActors) {
    if (entry.actorType === "BOT" && actor.actorKind === "BOT" && entry.actorId === actor.actorId) {
      selected =
        entry.policy === "ALLOW"
          ? "FULL_BYPASS"
          : entry.policy === "MONITOR"
            ? "MONITOR_ONLY"
            : "NO_PUNISH";
    }

    if (
      entry.actorType === "WEBHOOK" &&
      actor.actorKind === "WEBHOOK" &&
      entry.actorId === actor.actorId
    ) {
      selected =
        entry.policy === "ALLOW"
          ? "FULL_BYPASS"
          : entry.policy === "MONITOR"
            ? "MONITOR_ONLY"
            : "NO_PUNISH";
    }

    if (entry.actorType === "ROLE" && actor.roleIds.includes(entry.actorId)) {
      selected =
        entry.policy === "ALLOW"
          ? "FULL_BYPASS"
          : entry.policy === "MONITOR"
            ? "MONITOR_ONLY"
            : "NO_PUNISH";
    }
  }

  return selected;
}

function resolveBasePunishment(settings: GuildSettings, actor: ActorContext): PunishmentType {
  switch (actor.actorKind) {
    case "USER":
      return settings.memberPunishment;
    case "BOT":
      return settings.botPunishment;
    case "WEBHOOK":
      return "NONE";
    case "SELF":
      return "NONE";
  }
}

function resolvePunishment(
  settings: GuildSettings,
  actor: ActorContext,
  incidentCountWithinWindow: number,
  escalationSteps: readonly EscalationStep[]
): { readonly type: PunishmentType; readonly durationSeconds: number | null } {
  const fallbackType = resolveBasePunishment(settings, actor);

  if (fallbackType === "NONE" || actor.actorKind === "WEBHOOK") {
    return { type: "NONE", durationSeconds: null };
  }

  if (
    fallbackType === "TIMEOUT" &&
    (actor.actorKind !== "USER" || actor.isGuildOwner || actor.isAdministrator)
  ) {
    return { type: "NONE", durationSeconds: null };
  }

  if (settings.escalationMode === "CUSTOM") {
    const custom = chooseCustomEscalation(escalationSteps, incidentCountWithinWindow);
    if (custom) {
      return { type: custom.punishmentType, durationSeconds: custom.durationSeconds };
    }
  }

  if (settings.escalationMode === "PRESET" && actor.actorKind === "USER") {
    const preset = choosePresetEscalation(incidentCountWithinWindow);
    return { type: preset.punishmentType, durationSeconds: preset.durationSeconds };
  }

  if (fallbackType === "TIMEOUT" && settings.memberTimeoutSeconds !== null) {
    return {
      type: "TIMEOUT",
      durationSeconds: clampTimeoutSeconds(settings.memberTimeoutSeconds)
    };
  }

  return { type: fallbackType, durationSeconds: null };
}

export function evaluatePolicy(input: PolicyEvaluationInput): ActionPlan {
  const trustPolicy = deriveTrustPolicy(input.actor, input.trustedActors);
  const normalizedChannelPolicy =
    input.channelPolicy === "MONITOR"
      ? "MONITOR_ONLY"
      : input.channelPolicy === "DISABLED"
        ? "IGNORE_ALL"
        : input.channelPolicy;

  if (
    !input.detection.detected ||
    normalizedChannelPolicy === "IGNORE_ALL" ||
    trustPolicy === "FULL_BYPASS"
  ) {
    const explanation = ensureExplanation(input.detection);
    return {
      decision: "ALLOW",
      shouldDelete: false,
      shouldPunish: false,
      punishmentType: "NONE",
      punishmentDurationSeconds: null,
      shouldLog: false,
      shouldObserve: false,
      dryRun: input.settings.dryRunEnabled,
      channelPolicy: normalizedChannelPolicy,
      categoryPolicy: null,
      actorPolicy: trustPolicy === "FULL_BYPASS" ? "FULL_BYPASS" : null,
      trustPolicy:
        trustPolicy === "FULL_BYPASS"
          ? "ALLOW"
          : trustPolicy === "MONITOR_ONLY"
            ? "MONITOR"
            : trustPolicy,
      policyCaps: trustPolicy ? [trustPolicy.toLowerCase()] : [],
      explanation: {
        ...explanation,
        finalDecision: "ALLOW",
        policyCaps: trustPolicy ? [trustPolicy.toLowerCase()] : []
      },
      isConfirmedStrike: false,
      removePunishmentOnFalsePositive: false
    };
  }

  if (
    normalizedChannelPolicy === "MONITOR_ONLY" ||
    trustPolicy === "MONITOR_ONLY" ||
    input.settings.operationMode === "MONITOR"
  ) {
    const explanation = ensureExplanation(input.detection);
    return {
      decision: "LOG_ONLY",
      shouldDelete: false,
      shouldPunish: false,
      punishmentType: "NONE",
      punishmentDurationSeconds: null,
      shouldLog: true,
      shouldObserve: false,
      dryRun: input.settings.dryRunEnabled,
      channelPolicy: normalizedChannelPolicy,
      categoryPolicy: null,
      actorPolicy: trustPolicy === "MONITOR_ONLY" ? "MONITOR_ONLY" : null,
      trustPolicy: trustPolicy === "MONITOR_ONLY" ? "MONITOR" : null,
      policyCaps: ["monitor_only"],
      explanation: {
        ...explanation,
        finalDecision: "LOG_ONLY",
        policyCaps: ["monitor_only"]
      },
      isConfirmedStrike: false,
      removePunishmentOnFalsePositive: false
    };
  }

  const punishment = resolvePunishment(
    input.settings,
    input.actor,
    input.incidentCountWithinWindow,
    input.escalationSteps
  );

  const shouldDelete =
    normalizedChannelPolicy === "ENFORCE" ||
    normalizedChannelPolicy === "DELETE_ONLY" ||
    normalizedChannelPolicy === "NO_PUNISH" ||
    input.settings.operationMode === "DELETE_ONLY" ||
    input.settings.operationMode === "ENFORCE";

  const shouldPunish =
    !input.settings.dryRunEnabled &&
    normalizedChannelPolicy === "ENFORCE" &&
    input.settings.operationMode === "ENFORCE" &&
    trustPolicy !== "NO_PUNISH" &&
    punishment.type !== "NONE";

  const decision = shouldPunish ? "ENFORCE" : shouldDelete ? "DELETE_ONLY" : "LOG_ONLY";
  const policyCaps = trustPolicy === "NO_PUNISH" ? ["no_punish"] : [];
  const explanation = ensureExplanation(input.detection);

  return {
    decision,
    shouldDelete: shouldDelete && !input.settings.dryRunEnabled,
    shouldPunish,
    punishmentType: shouldPunish ? punishment.type : "NONE",
    punishmentDurationSeconds: shouldPunish ? punishment.durationSeconds : null,
    shouldLog: true,
    shouldObserve: false,
    dryRun: input.settings.dryRunEnabled,
    channelPolicy: normalizedChannelPolicy,
    categoryPolicy: null,
    actorPolicy: trustPolicy === "NO_PUNISH" ? "NO_PUNISH" : null,
    trustPolicy: trustPolicy === "NO_PUNISH" ? "NO_PUNISH" : null,
    policyCaps,
    explanation: {
      ...explanation,
      finalDecision: decision,
      policyCaps
    },
    isConfirmedStrike: shouldPunish,
    removePunishmentOnFalsePositive: shouldPunish
  };
}
