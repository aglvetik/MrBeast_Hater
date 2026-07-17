import type {
  ActorActivityProfile,
  ChannelActivityProfile,
  GuildSettings,
  ModerationDecision,
  RiskExplanation
} from "../policy/types.js";
import type {
  CorrelationSummary,
  DetectionSignal,
  DetectionResult,
  ProtectedMention,
  RiskSignalId
} from "./types.js";
import { detectionConfidence } from "./fingerprint.js";
import { assessActivity, describeChannelContext } from "./activity.js";

const SIGNAL_WEIGHTS: Readonly<Record<RiskSignalId, number>> = {
  MENTION_EVERYONE: 30,
  MENTION_HERE: 30,
  MENTION_ROLE_NORMAL: 12,
  MENTION_ROLE_HIGH: 20,
  MENTION_ROLE_CRITICAL: 25,
  MULTIPLE_PROTECTED_TARGETS: 10,
  VISUAL_ONLY_TEXT: 25,
  LINK_NOISE_TEXT: 18,
  VERY_SHORT_TEXT: 10,
  MULTI_VISUAL: 8,
  LARGE_VISUAL_SET: 8,
  UNAUTHORIZED_SCOPE: 10,
  NEW_ACCOUNT: 15,
  RECENT_GUILD_JOIN: 15,
  LOW_ACTIVITY: 10,
  NO_CHANNEL_HISTORY: 5,
  DORMANT_ACTOR: 8,
  OPEN_GENERAL_CHANNEL: 5,
  QUIET_CHANNEL: 5,
  RESTRICTED_ANNOUNCEMENT_CHANNEL: -10,
  SCOPED_PUBLISHER_IN_SCOPE: -60,
  MEANINGFUL_TEXT: -20,
  ESTABLISHED_ACTIVITY: -15,
  SAME_ACTOR_EXACT_FINGERPRINT: 45,
  SAME_ACTOR_STRUCTURAL_FINGERPRINT: 35,
  SECOND_EVENT_OTHER_CHANNEL: 35,
  ADJACENT_CHANNEL_MOVEMENT: 15,
  CHANNEL_TRAVERSAL_ASCENDING: 25,
  CHANNEL_TRAVERSAL_DESCENDING: 25,
  COORDINATED_MULTI_ACTOR_RAID: 45,
  ACTIVE_RAID_SESSION: 50
};

export interface RiskEvaluationInput {
  readonly baseDetection: DetectionResult;
  readonly settings: GuildSettings;
  readonly actorProfile: ActorActivityProfile;
  readonly channelProfile: ChannelActivityProfile;
  readonly authorizedPublisherInScope: boolean;
  readonly correlation: CorrelationSummary;
  readonly activeRaidMatch: boolean;
  readonly now: Date;
  readonly accountIsObjectivelyNew: boolean;
  readonly joinIsObjectivelyNew: boolean;
}

export interface RiskEvaluationResult {
  readonly score: number;
  readonly signals: readonly DetectionSignal[];
  readonly confidence: DetectionResult["confidence"];
  readonly explanation: RiskExplanation;
  readonly suggestedDecision: ModerationDecision;
}

function signal(id: RiskSignalId, explanation: string): DetectionSignal {
  return {
    id,
    weight: SIGNAL_WEIGHTS[id],
    explanation
  };
}

function mentionSignals(
  protectedMentions: readonly ProtectedMention[]
): readonly DetectionSignal[] {
  const signals: DetectionSignal[] = [];

  for (const mention of protectedMentions) {
    switch (mention.kind) {
      case "EVERYONE":
        signals.push(signal("MENTION_EVERYONE", "@everyone was used"));
        break;
      case "HERE":
        signals.push(signal("MENTION_HERE", "@here was used"));
        break;
      case "ROLE":
        signals.push(
          signal(
            mention.riskLevel === "CRITICAL"
              ? "MENTION_ROLE_CRITICAL"
              : mention.riskLevel === "HIGH"
                ? "MENTION_ROLE_HIGH"
                : "MENTION_ROLE_NORMAL",
            "A protected role was mentioned"
          )
        );
        break;
    }
  }

  if (protectedMentions.length >= 2) {
    signals.push(signal("MULTIPLE_PROTECTED_TARGETS", "Multiple protected targets were mentioned"));
  }

  return signals;
}

function thresholdDecision(settings: GuildSettings, score: number): ModerationDecision {
  if (score >= settings.enforceThreshold) return "ENFORCE";
  if (score >= settings.quarantineThreshold) return "QUARANTINE";
  if (score >= settings.deleteThreshold) return "DELETE_ONLY";
  if (score >= settings.logOnlyThreshold) return "LOG_ONLY";
  if (score >= settings.observeThreshold) return "OBSERVE";
  return "ALLOW";
}

export function evaluateRisk(input: RiskEvaluationInput): RiskEvaluationResult {
  const activity = assessActivity(
    input.settings,
    {
      actorId: input.actorProfile.actorId,
      actorKind: "USER",
      roleIds: [],
      isAdministrator: false,
      canManageGuild: false,
      isGuildOwner: false,
      createdTimestamp: null,
      joinedTimestamp: null
    },
    input.actorProfile,
    input.now
  );
  const channelContext = describeChannelContext(input.channelProfile);
  const signals: DetectionSignal[] = [...mentionSignals(input.baseDetection.protectedMentions)];

  if (input.baseDetection.normalizedText.textClass === "VISUAL_ONLY") {
    signals.push(signal("VISUAL_ONLY_TEXT", "The message is effectively visual-only"));
  } else if (input.baseDetection.normalizedText.textClass === "LINK_NOISE") {
    signals.push(signal("LINK_NOISE_TEXT", "The text is mostly links, emoji, or punctuation"));
  } else if (input.baseDetection.normalizedText.textClass === "SHORT") {
    signals.push(signal("VERY_SHORT_TEXT", "The message has very little meaningful text"));
  } else if (
    input.baseDetection.normalizedText.informationCharCount >=
    input.settings.meaningfulTextThreshold
  ) {
    signals.push(signal("MEANINGFUL_TEXT", "The message contains substantial meaningful text"));
  }

  if (input.baseDetection.media.totalVisualCount >= 2) {
    signals.push(signal("MULTI_VISUAL", "The message includes multiple visuals"));
  }

  if (input.baseDetection.media.totalVisualCount >= 4) {
    signals.push(
      signal("LARGE_VISUAL_SET", "The message includes an unusually large number of visuals")
    );
  }

  if (!input.authorizedPublisherInScope) {
    signals.push(signal("UNAUTHORIZED_SCOPE", "The actor is not authorized in this scope"));
  } else {
    signals.push(
      signal("SCOPED_PUBLISHER_IN_SCOPE", "The actor is an authorized publisher in this scope")
    );
  }

  if (input.accountIsObjectivelyNew) {
    signals.push(signal("NEW_ACCOUNT", "The Discord account is objectively new"));
  }

  if (input.joinIsObjectivelyNew) {
    signals.push(signal("RECENT_GUILD_JOIN", "The guild join is recent"));
  }

  if (activity.lowActivityAfterWarmup) {
    signals.push(signal("LOW_ACTIVITY", "The actor has little established activity after warmup"));
  }

  if (activity.noChannelHistoryAfterWarmup) {
    signals.push(signal("NO_CHANNEL_HISTORY", "The actor has no recent history in this channel"));
  }

  if (activity.dormantActor) {
    signals.push(signal("DORMANT_ACTOR", "A dormant actor returned with a suspicious post"));
  }

  if (activity.establishedActor) {
    signals.push(signal("ESTABLISHED_ACTIVITY", "The actor has substantial established activity"));
  }

  if (input.channelProfile.isAnnouncement && input.channelProfile.isRestricted) {
    signals.push(
      signal("RESTRICTED_ANNOUNCEMENT_CHANNEL", "This is a restricted announcement channel")
    );
  } else if (!input.channelProfile.isRestricted) {
    signals.push(signal("OPEN_GENERAL_CHANNEL", "This is an unrestricted general-purpose channel"));
  }

  if (input.channelProfile.isQuiet) {
    signals.push(
      signal("QUIET_CHANNEL", "Protected-mention visuals are unusual in this quiet channel")
    );
  }

  for (const id of input.correlation.triggeredSignals) {
    signals.push(signal(id, `Correlation matched ${id.toLowerCase().replaceAll("_", " ")}`));
  }

  if (input.activeRaidMatch) {
    signals.push(signal("ACTIVE_RAID_SESSION", "An active raid session matches this event"));
  }

  const score = signals.reduce((total, entry) => total + entry.weight, 0);
  const positiveTotal = signals
    .filter((entry) => entry.weight > 0)
    .reduce((sum, entry) => sum + entry.weight, 0);
  const negativeTotal = Math.abs(
    signals.filter((entry) => entry.weight < 0).reduce((sum, entry) => sum + entry.weight, 0)
  );
  const suggestedDecision = thresholdDecision(input.settings, score);
  const explanation: RiskExplanation = {
    score,
    signals,
    positiveTotal,
    negativeTotal,
    activityClass: input.actorProfile.activityClass,
    channelContext,
    correlationStage: input.correlation.stage,
    policyCaps: [],
    finalDecision: suggestedDecision
  };

  return {
    score,
    signals,
    confidence: detectionConfidence(score),
    explanation,
    suggestedDecision
  };
}
