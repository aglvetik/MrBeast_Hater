import {
  buildExactFingerprint,
  buildProtectedMentionClass,
  buildStructuralFingerprint,
  detectionConfidence
} from "./fingerprint.js";
import { summarizeMedia } from "./media.js";
import { summarizeText } from "./normalize.js";
import type { ModerationDecision } from "../policy/types.js";
import type {
  DetectionContext,
  DetectionResult,
  DetectionRuleId,
  DetectionSignal,
  ObservedMessage,
  ProtectedMention
} from "./types.js";

function collectProtectedMentions(
  message: ObservedMessage,
  context: DetectionContext
): readonly ProtectedMention[] {
  const mentions: ProtectedMention[] = [];

  if (message.mentionedEveryone) {
    mentions.push({ kind: "EVERYONE", riskLevel: "CRITICAL" });
  }

  if (message.mentionedHere) {
    mentions.push({ kind: "HERE", riskLevel: "CRITICAL" });
  }

  for (const roleId of message.mentionedRoleIds) {
    if (context.roleDetectionMode === "ALL_ROLES" || context.protectedRoleIds.has(roleId)) {
      const riskLevel = context.roleRiskById?.[roleId] ?? "NORMAL";
      mentions.push({
        kind: "ROLE",
        roleId,
        ...(riskLevel === "NORMAL" ? {} : { riskLevel })
      });
    }
  }

  return mentions;
}

function contentSignals(result: {
  readonly protectedMentions: readonly ProtectedMention[];
  readonly mediaTotal: number;
  readonly textClass: DetectionResult["normalizedText"]["textClass"];
}): readonly DetectionSignal[] {
  const signals: DetectionSignal[] = [];

  for (const mention of result.protectedMentions) {
    if (mention.kind === "EVERYONE") {
      signals.push({
        id: "MENTION_EVERYONE",
        weight: 30,
        explanation: "@everyone was used"
      });
    } else if (mention.kind === "HERE") {
      signals.push({
        id: "MENTION_HERE",
        weight: 30,
        explanation: "@here was used"
      });
    } else {
      signals.push({
        id:
          mention.riskLevel === "CRITICAL"
            ? "MENTION_ROLE_CRITICAL"
            : mention.riskLevel === "HIGH"
              ? "MENTION_ROLE_HIGH"
              : "MENTION_ROLE_NORMAL",
        weight: mention.riskLevel === "CRITICAL" ? 25 : mention.riskLevel === "HIGH" ? 20 : 12,
        explanation: "A protected role was mentioned"
      });
    }
  }

  if (result.protectedMentions.length >= 2) {
    signals.push({
      id: "MULTIPLE_PROTECTED_TARGETS",
      weight: 10,
      explanation: "Multiple protected targets were mentioned"
    });
  }

  if (result.textClass === "VISUAL_ONLY") {
    signals.push({
      id: "VISUAL_ONLY_TEXT",
      weight: 25,
      explanation: "The message is visual-only or mention-only"
    });
  } else if (result.textClass === "LINK_NOISE") {
    signals.push({
      id: "LINK_NOISE_TEXT",
      weight: 18,
      explanation: "The text is mostly link or emoji noise"
    });
  } else if (result.textClass === "SHORT") {
    signals.push({
      id: "VERY_SHORT_TEXT",
      weight: 10,
      explanation: "The message has very little meaningful text"
    });
  }

  if (result.mediaTotal >= 2) {
    signals.push({
      id: "MULTI_VISUAL",
      weight: 8,
      explanation: "The message includes multiple visuals"
    });
  }

  if (result.mediaTotal >= 4) {
    signals.push({
      id: "LARGE_VISUAL_SET",
      weight: 8,
      explanation: "The message includes an unusually large number of visuals"
    });
  }

  return signals;
}

function initialDecision(score: number): ModerationDecision {
  if (score >= 110) return "ENFORCE";
  if (score >= 90) return "QUARANTINE";
  if (score >= 70) return "DELETE_ONLY";
  if (score >= 50) return "LOG_ONLY";
  if (score >= 35) return "OBSERVE";
  return "ALLOW";
}

function chooseRuleId(input: {
  readonly candidate: boolean;
  readonly mediaTotal: number;
  readonly textClass: DetectionResult["normalizedText"]["textClass"];
  readonly burstHit: boolean;
}): DetectionRuleId | null {
  if (!input.candidate) {
    return null;
  }

  if (input.burstHit) {
    return "BURST_MASS_PING";
  }

  if (input.mediaTotal >= 2) {
    return "MULTI_VISUAL_MASS_PING";
  }

  if (input.textClass === "LINK_NOISE" || input.textClass === "VISUAL_ONLY") {
    return "LINK_VISUAL_MASS_PING";
  }

  return "VISUAL_MASS_PING";
}

export function detectVisualMassPing(
  message: ObservedMessage,
  context: DetectionContext
): DetectionResult {
  const media = summarizeMedia(message.attachments, message.embeds, message.stickerCount);
  const normalizedText = summarizeText(message.content, context.maxInformationChars);
  const protectedMentions = collectProtectedMentions(message, context);
  const candidate =
    protectedMentions.length > 0 && media.totalVisualCount >= context.minVisualCount;
  const burstHit =
    context.recentSuspiciousMessages.filter(
      (recent) =>
        message.createdTimestamp - recent.createdTimestamp <= context.burstWindowSeconds * 1_000
    ).length +
      1 >=
    context.burstMessageCount;
  const protectedMentionClass = buildProtectedMentionClass(protectedMentions);
  const exactFingerprint = buildExactFingerprint({
    protectedMentionClass,
    media,
    normalizedText
  });
  const structuralFingerprint = buildStructuralFingerprint({
    protectedMentionClass,
    media,
    normalizedText
  });
  const signals = contentSignals({
    protectedMentions,
    mediaTotal: media.totalVisualCount,
    textClass: normalizedText.textClass
  });
  const score = signals.reduce((total, signal) => total + signal.weight, 0);
  const suggestedDecision = initialDecision(score);
  const ruleId = chooseRuleId({
    candidate,
    mediaTotal: media.totalVisualCount,
    textClass: normalizedText.textClass,
    burstHit
  });
  const detected = candidate && (burstHit || score >= 35);

  return {
    detected,
    candidate,
    ruleId,
    confidence: detectionConfidence(score),
    signals,
    protectedMentions,
    protectedMentionClass,
    media,
    normalizedText,
    exactFingerprint,
    structuralFingerprint,
    score,
    explanation: {
      score,
      signals,
      positiveTotal: signals
        .filter((signal) => signal.weight > 0)
        .reduce((sum, signal) => sum + signal.weight, 0),
      negativeTotal: Math.abs(
        signals
          .filter((signal) => signal.weight < 0)
          .reduce((sum, signal) => sum + signal.weight, 0)
      ),
      activityClass: "UNKNOWN",
      channelContext: "unclassified channel",
      correlationStage: candidate ? "FIRST" : "NONE",
      policyCaps: [],
      finalDecision: suggestedDecision
    },
    correlationStage: candidate ? "FIRST" : "NONE",
    suggestedDecision
  };
}
