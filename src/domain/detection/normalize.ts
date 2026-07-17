import { createHash } from "node:crypto";

import type { NormalizedTextSummary } from "./types.js";

const ZERO_WIDTH_PATTERN = /[\u200B-\u200D\u2060\uFEFF]/gu;
const CONTROL_PATTERN = /[\p{Cc}\p{Cf}]/gu;
const VARIATION_SELECTOR_PATTERN = /[\uFE00-\uFE0F]/gu;
const USER_MENTION_PATTERN = /<@!?\d+>/gu;
const ROLE_MENTION_PATTERN = /<@&\d+>/gu;
const URL_PATTERN = /\bhttps?:\/\/[^\s]+/giu;
const MARKDOWN_PATTERN = /[*_~`>|#[\]()]|```[\s\S]*?```/gu;
const EMOJI_PATTERN = /\p{Extended_Pictographic}/gu;
const HOST_REPLACEMENT = " URL ";

function shortHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

function extractHostnameHashes(content: string): readonly string[] {
  const unique = new Set<string>();
  const matches = content.match(URL_PATTERN) ?? [];

  for (const value of matches) {
    try {
      const host = new URL(value).hostname.toLowerCase();
      if (host) {
        unique.add(shortHash(host));
      }
    } catch {
      continue;
    }
  }

  return [...unique].sort();
}

export function summarizeText(content: string, maxInformationChars: number): NormalizedTextSummary {
  let normalized = content
    .replace(ZERO_WIDTH_PATTERN, "")
    .replace(CONTROL_PATTERN, "")
    .replace(VARIATION_SELECTOR_PATTERN, "");

  normalized = normalized
    .normalize("NFKC")
    .replace(USER_MENTION_PATTERN, " ")
    .replace(ROLE_MENTION_PATTERN, " ")
    .replace(/@everyone/giu, " ")
    .replace(/@here/giu, " ");

  const urlMatches = normalized.match(URL_PATTERN) ?? [];
  const linkHostnameHashes = extractHostnameHashes(normalized);
  normalized = normalized.replace(URL_PATTERN, HOST_REPLACEMENT);
  normalized = normalized.replace(MARKDOWN_PATTERN, " ");
  normalized = normalized.replace(/\s+/gu, " ").trim();

  const emojiMatches = normalized.match(EMOJI_PATTERN) ?? [];
  const informationChars = normalized.match(/[\p{Letter}\p{Number}]/gu) ?? [];
  const punctuationChars = normalized.match(/[\p{Punctuation}\p{Symbol}]/gu) ?? [];
  const words = normalized.split(/\s+/u).filter((part) => /[\p{Letter}\p{Number}]/u.test(part));
  const visibleChars = normalized.replace(/\s+/gu, "");
  const punctuationRatio =
    visibleChars.length === 0 ? 1 : punctuationChars.length / visibleChars.length;
  const onlyLinksNoise =
    normalized
      .replace(/\bURL\b/gu, "")
      .replace(EMOJI_PATTERN, "")
      .replace(/[\p{Punctuation}\p{Symbol}\s]/gu, "").length === 0;
  const meaningfulText = normalized
    .replace(/\bURL\b/gu, " ")
    .replace(EMOJI_PATTERN, " ")
    .replace(/\s+/gu, " ")
    .trim();
  const textClass =
    meaningfulText.length === 0
      ? "VISUAL_ONLY"
      : onlyLinksNoise
        ? "LINK_NOISE"
        : informationChars.length <= maxInformationChars
          ? "SHORT"
          : "MEANINGFUL";

  return {
    totalLength: normalized.length,
    informationCharCount: informationChars.length,
    wordCount: words.length,
    urlCount: urlMatches.length,
    emojiCount: emojiMatches.length,
    punctuationRatio,
    isLowInformation: informationChars.length <= maxInformationChars,
    onlyLinksEmojiPunctuationOrWhitespace: onlyLinksNoise,
    meaningfulText,
    normalizedHash: shortHash(normalized),
    textClass,
    linkHostnameHashes
  };
}
