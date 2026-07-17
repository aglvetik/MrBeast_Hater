import { summarizeMedia } from "./media.js";
import { summarizeText } from "./normalize.js";
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
    mentions.push({ kind: "EVERYONE" });
  }

  if (message.mentionedHere) {
    mentions.push({ kind: "HERE" });
  }

  for (const roleId of message.mentionedRoleIds) {
    if (context.roleDetectionMode === "ALL_ROLES" || context.protectedRoleIds.has(roleId)) {
      mentions.push({ kind: "ROLE", roleId });
    }
  }

  return mentions;
}

function buildSignals(
  protectedMentions: readonly ProtectedMention[],
  mediaTotal: number,
  lowInformation: boolean,
  multiVisual: boolean,
  linkNoise: boolean,
  burstHit: boolean
): readonly DetectionSignal[] {
  const signals: DetectionSignal[] = [];

  if (protectedMentions.length > 0) {
    signals.push({ kind: "PROTECTED_MENTION", detail: `${protectedMentions.length}` });
  }

  if (mediaTotal > 0) {
    signals.push({ kind: "VISUAL_CONTENT", detail: `${mediaTotal}` });
  }

  if (lowInformation) {
    signals.push({ kind: "LOW_INFORMATION_TEXT", detail: "true" });
  }

  if (multiVisual) {
    signals.push({ kind: "MULTI_VISUAL", detail: "true" });
  }

  if (linkNoise) {
    signals.push({ kind: "LINK_ONLY_NOISE", detail: "true" });
  }

  if (burstHit) {
    signals.push({ kind: "BURST_WINDOW", detail: "true" });
  }

  return signals;
}

function createResult(
  detected: boolean,
  ruleId: DetectionRuleId | null,
  confidence: DetectionResult["confidence"],
  signals: readonly DetectionSignal[],
  protectedMentions: readonly ProtectedMention[],
  media: DetectionResult["media"],
  normalizedText: DetectionResult["normalizedText"]
): DetectionResult {
  return {
    detected,
    ruleId,
    confidence,
    signals,
    protectedMentions,
    media,
    normalizedText
  };
}

export function detectVisualMassPing(
  message: ObservedMessage,
  context: DetectionContext
): DetectionResult {
  const media = summarizeMedia(message.attachments, message.embeds, message.stickerCount);
  const normalizedText = summarizeText(message.content, context.maxInformationChars);
  const protectedMentions = collectProtectedMentions(message, context);
  const multiVisual = media.totalVisualCount >= 2;
  const burstHit =
    context.recentSuspiciousMessages.filter(
      (recent) =>
        message.createdTimestamp - recent.createdTimestamp <= context.burstWindowSeconds * 1_000
    ).length +
      1 >=
    context.burstMessageCount;

  const signals = buildSignals(
    protectedMentions,
    media.totalVisualCount,
    normalizedText.isLowInformation,
    multiVisual,
    normalizedText.onlyLinksEmojiPunctuationOrWhitespace,
    burstHit
  );

  if (protectedMentions.length === 0 || media.totalVisualCount < context.minVisualCount) {
    return createResult(false, null, "LOW", signals, protectedMentions, media, normalizedText);
  }

  if (burstHit) {
    return createResult(
      true,
      "BURST_MASS_PING",
      "HIGH",
      signals,
      protectedMentions,
      media,
      normalizedText
    );
  }

  if (multiVisual && normalizedText.informationCharCount <= context.maxInformationChars + 40) {
    return createResult(
      true,
      "MULTI_VISUAL_MASS_PING",
      "HIGH",
      signals,
      protectedMentions,
      media,
      normalizedText
    );
  }

  if (
    context.linkRuleEnabled &&
    media.totalVisualCount >= 1 &&
    normalizedText.onlyLinksEmojiPunctuationOrWhitespace
  ) {
    return createResult(
      true,
      "LINK_VISUAL_MASS_PING",
      "MEDIUM",
      signals,
      protectedMentions,
      media,
      normalizedText
    );
  }

  if (normalizedText.isLowInformation) {
    return createResult(
      true,
      "VISUAL_MASS_PING",
      "MEDIUM",
      signals,
      protectedMentions,
      media,
      normalizedText
    );
  }

  return createResult(false, null, "LOW", signals, protectedMentions, media, normalizedText);
}
