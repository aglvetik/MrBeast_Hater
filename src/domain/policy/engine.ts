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
  TrustedActor,
  TrustPolicy
} from "./types.js";
import type { DetectionResult } from "../detection/types.js";

export interface PolicyEvaluationInput {
  readonly settings: GuildSettings;
  readonly detection: DetectionResult;
  readonly actor: ActorContext;
  readonly channelPolicy: ChannelPolicy;
  readonly trustedActors: readonly TrustedActor[];
  readonly incidentCountWithinWindow: number;
  readonly escalationSteps: readonly EscalationStep[];
}

function deriveTrustPolicy(
  actor: ActorContext,
  trustedActors: readonly TrustedActor[]
): TrustPolicy | null {
  let selected: TrustPolicy | null = null;

  for (const entry of trustedActors) {
    if (entry.actorType === "BOT" && actor.actorKind === "BOT" && entry.actorId === actor.actorId) {
      selected = entry.policy;
    }

    if (
      entry.actorType === "WEBHOOK" &&
      actor.actorKind === "WEBHOOK" &&
      entry.actorId === actor.actorId
    ) {
      selected = entry.policy;
    }

    if (entry.actorType === "ROLE" && actor.roleIds.includes(entry.actorId)) {
      selected = entry.policy;
    }
  }

  if (selected === "ALLOW") return "ALLOW";
  if (selected === "MONITOR") return "MONITOR";
  if (selected === "NO_PUNISH") return "NO_PUNISH";
  return null;
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

  if (!input.detection.detected || input.channelPolicy === "DISABLED" || trustPolicy === "ALLOW") {
    return {
      shouldDelete: false,
      shouldPunish: false,
      punishmentType: "NONE",
      punishmentDurationSeconds: null,
      shouldLog: false,
      dryRun: input.settings.dryRunEnabled,
      channelPolicy: input.channelPolicy,
      trustPolicy
    };
  }

  if (
    input.channelPolicy === "MONITOR" ||
    trustPolicy === "MONITOR" ||
    input.settings.operationMode === "MONITOR"
  ) {
    return {
      shouldDelete: false,
      shouldPunish: false,
      punishmentType: "NONE",
      punishmentDurationSeconds: null,
      shouldLog: true,
      dryRun: input.settings.dryRunEnabled,
      channelPolicy: input.channelPolicy,
      trustPolicy
    };
  }

  const punishment = resolvePunishment(
    input.settings,
    input.actor,
    input.incidentCountWithinWindow,
    input.escalationSteps
  );

  const shouldDelete =
    input.channelPolicy === "ENFORCE" ||
    input.channelPolicy === "DELETE_ONLY" ||
    input.settings.operationMode === "DELETE_ONLY" ||
    input.settings.operationMode === "ENFORCE";

  const shouldPunish =
    !input.settings.dryRunEnabled &&
    input.channelPolicy === "ENFORCE" &&
    input.settings.operationMode === "ENFORCE" &&
    trustPolicy !== "NO_PUNISH" &&
    punishment.type !== "NONE";

  return {
    shouldDelete: shouldDelete && !input.settings.dryRunEnabled,
    shouldPunish,
    punishmentType: shouldPunish ? punishment.type : "NONE",
    punishmentDurationSeconds: shouldPunish ? punishment.durationSeconds : null,
    shouldLog: true,
    dryRun: input.settings.dryRunEnabled,
    channelPolicy: input.channelPolicy,
    trustPolicy
  };
}
