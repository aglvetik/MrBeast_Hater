import type { RoleDetectionMode } from "../policy/types.js";

export type DetectionRuleId =
  "VISUAL_MASS_PING" | "MULTI_VISUAL_MASS_PING" | "LINK_VISUAL_MASS_PING" | "BURST_MASS_PING";

export interface MediaSummary {
  readonly imageAttachments: number;
  readonly gifAttachments: number;
  readonly videoAttachments: number;
  readonly embedImages: number;
  readonly embedThumbnails: number;
  readonly stickers: number;
  readonly totalVisualCount: number;
}

export interface NormalizedTextSummary {
  readonly totalLength: number;
  readonly informationCharCount: number;
  readonly wordCount: number;
  readonly urlCount: number;
  readonly emojiCount: number;
  readonly punctuationRatio: number;
  readonly isLowInformation: boolean;
  readonly onlyLinksEmojiPunctuationOrWhitespace: boolean;
}

export interface ProtectedMention {
  readonly kind: "EVERYONE" | "HERE" | "ROLE";
  readonly roleId?: string;
}

export interface DetectionSignal {
  readonly kind:
    | "PROTECTED_MENTION"
    | "VISUAL_CONTENT"
    | "LOW_INFORMATION_TEXT"
    | "MULTI_VISUAL"
    | "LINK_ONLY_NOISE"
    | "BURST_WINDOW";
  readonly detail: string;
}

export interface DetectionResult {
  readonly detected: boolean;
  readonly ruleId: DetectionRuleId | null;
  readonly confidence: "LOW" | "MEDIUM" | "HIGH";
  readonly signals: readonly DetectionSignal[];
  readonly protectedMentions: readonly ProtectedMention[];
  readonly media: MediaSummary;
  readonly normalizedText: NormalizedTextSummary;
}

export interface VisualAttachment {
  readonly contentType: string | null;
  readonly fileName: string | null;
}

export interface EmbedSummary {
  readonly hasImage: boolean;
  readonly hasThumbnail: boolean;
}

export interface ObservedMessage {
  readonly guildId: string;
  readonly channelId: string;
  readonly messageId: string;
  readonly actorId: string;
  readonly content: string;
  readonly mentionedEveryone: boolean;
  readonly mentionedHere: boolean;
  readonly mentionedRoleIds: readonly string[];
  readonly attachments: readonly VisualAttachment[];
  readonly embeds: readonly EmbedSummary[];
  readonly stickerCount: number;
  readonly createdTimestamp: number;
}

export interface RecentSuspiciousMessage {
  readonly createdTimestamp: number;
}

export interface DetectionContext {
  readonly roleDetectionMode: RoleDetectionMode;
  readonly protectedRoleIds: ReadonlySet<string>;
  readonly minVisualCount: number;
  readonly maxInformationChars: number;
  readonly burstWindowSeconds: number;
  readonly burstMessageCount: number;
  readonly linkRuleEnabled: boolean;
  readonly recentSuspiciousMessages: readonly RecentSuspiciousMessage[];
}
