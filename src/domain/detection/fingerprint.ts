import { createHash } from "node:crypto";

import type {
  DetectionResult,
  MediaSummary,
  NormalizedTextSummary,
  ProtectedMention
} from "./types.js";

function hashParts(parts: readonly string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32);
}

export function buildProtectedMentionClass(
  protectedMentions: readonly ProtectedMention[]
): string | null {
  if (protectedMentions.length === 0) {
    return null;
  }

  const kinds = protectedMentions
    .map((mention) =>
      mention.kind === "ROLE"
        ? `ROLE:${mention.riskLevel ?? "NORMAL"}:${mention.roleId ?? "unknown"}`
        : mention.kind
    )
    .sort();

  return kinds.join(",");
}

function visualCountBucket(totalVisualCount: number): string {
  if (totalVisualCount <= 1) return "one";
  if (totalVisualCount <= 3) return "few";
  return "many";
}

export function buildExactFingerprint(input: {
  readonly protectedMentionClass: string | null;
  readonly media: MediaSummary;
  readonly normalizedText: NormalizedTextSummary;
}): string | null {
  if (!input.protectedMentionClass || input.media.totalVisualCount === 0) {
    return null;
  }

  return hashParts([
    input.protectedMentionClass,
    input.normalizedText.normalizedHash ?? "none",
    `${input.media.attachmentCount ?? 0}`,
    (input.media.extensionSummary ?? []).join(","),
    (input.media.sizeBucketSummary ?? []).join(","),
    (input.normalizedText.linkHostnameHashes ?? []).join(","),
    `${input.media.imageAttachments}:${input.media.gifAttachments}:${input.media.videoAttachments}`,
    `${input.media.embedImages}:${input.media.embedThumbnails}:${input.media.stickers}`,
    `${input.media.totalVisualCount}`
  ]);
}

export function buildStructuralFingerprint(input: {
  readonly protectedMentionClass: string | null;
  readonly media: MediaSummary;
  readonly normalizedText: NormalizedTextSummary;
}): string | null {
  if (!input.protectedMentionClass || input.media.totalVisualCount === 0) {
    return null;
  }

  return hashParts([
    input.protectedMentionClass,
    input.normalizedText.textClass ?? "VISUAL_ONLY",
    visualCountBucket(input.media.totalVisualCount),
    [
      input.media.imageAttachments > 0 ? "image" : "",
      input.media.gifAttachments > 0 ? "gif" : "",
      input.media.videoAttachments > 0 ? "video" : "",
      input.media.embedImages + input.media.embedThumbnails > 0 ? "embed" : "",
      input.media.stickers > 0 ? "sticker" : ""
    ]
      .filter(Boolean)
      .join(","),
    (input.normalizedText.linkHostnameHashes ?? []).join(",")
  ]);
}

export function detectionConfidence(score: number): DetectionResult["confidence"] {
  if (score >= 90) {
    return "HIGH";
  }

  if (score >= 50) {
    return "MEDIUM";
  }

  return "LOW";
}
