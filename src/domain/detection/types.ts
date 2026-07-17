import type {
  ActorActivityClass,
  ChannelGuardMode,
  CorrelationStage,
  MentionRiskLevel,
  MessageEventSource,
  ModerationDecision,
  RiskExplanation,
  RoleDetectionMode
} from "../policy/types.js";

export type DetectionRuleId =
  | "VISUAL_MASS_PING"
  | "MULTI_VISUAL_MASS_PING"
  | "LINK_VISUAL_MASS_PING"
  | "BURST_MASS_PING"
  | "CORRELATED_REPEAT"
  | "CHANNEL_TRAVERSAL_ASCENDING"
  | "CHANNEL_TRAVERSAL_DESCENDING"
  | "COORDINATED_MULTI_ACTOR_RAID"
  | "RAID_SESSION_MATCH";

export type RiskSignalId =
  | "MENTION_EVERYONE"
  | "MENTION_HERE"
  | "MENTION_ROLE_NORMAL"
  | "MENTION_ROLE_HIGH"
  | "MENTION_ROLE_CRITICAL"
  | "MULTIPLE_PROTECTED_TARGETS"
  | "VISUAL_ONLY_TEXT"
  | "LINK_NOISE_TEXT"
  | "VERY_SHORT_TEXT"
  | "MULTI_VISUAL"
  | "LARGE_VISUAL_SET"
  | "UNAUTHORIZED_SCOPE"
  | "NEW_ACCOUNT"
  | "RECENT_GUILD_JOIN"
  | "LOW_ACTIVITY"
  | "NO_CHANNEL_HISTORY"
  | "DORMANT_ACTOR"
  | "OPEN_GENERAL_CHANNEL"
  | "QUIET_CHANNEL"
  | "RESTRICTED_ANNOUNCEMENT_CHANNEL"
  | "SCOPED_PUBLISHER_IN_SCOPE"
  | "MEANINGFUL_TEXT"
  | "ESTABLISHED_ACTIVITY"
  | "SAME_ACTOR_EXACT_FINGERPRINT"
  | "SAME_ACTOR_STRUCTURAL_FINGERPRINT"
  | "SECOND_EVENT_OTHER_CHANNEL"
  | "ADJACENT_CHANNEL_MOVEMENT"
  | "CHANNEL_TRAVERSAL_ASCENDING"
  | "CHANNEL_TRAVERSAL_DESCENDING"
  | "COORDINATED_MULTI_ACTOR_RAID"
  | "ACTIVE_RAID_SESSION";

export interface MediaSummary {
  readonly imageAttachments: number;
  readonly gifAttachments: number;
  readonly videoAttachments: number;
  readonly embedImages: number;
  readonly embedThumbnails: number;
  readonly stickers: number;
  readonly totalVisualCount: number;
  readonly attachmentCount?: number;
  readonly extensionSummary?: readonly string[];
  readonly sizeBucketSummary?: readonly string[];
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
  readonly meaningfulText?: string;
  readonly normalizedHash?: string;
  readonly textClass?: "VISUAL_ONLY" | "LINK_NOISE" | "SHORT" | "MEANINGFUL";
  readonly linkHostnameHashes?: readonly string[];
}

export interface ProtectedMention {
  readonly kind: "EVERYONE" | "HERE" | "ROLE";
  readonly roleId?: string;
  readonly riskLevel?: MentionRiskLevel;
}

export interface DetectionSignal {
  readonly id: RiskSignalId;
  readonly weight: number;
  readonly explanation: string;
}

export interface DetectionResult {
  readonly detected: boolean;
  readonly candidate?: boolean;
  readonly ruleId: DetectionRuleId | null;
  readonly confidence: "LOW" | "MEDIUM" | "HIGH";
  readonly signals: readonly DetectionSignal[];
  readonly protectedMentions: readonly ProtectedMention[];
  readonly protectedMentionClass?: string | null;
  readonly media: MediaSummary;
  readonly normalizedText: NormalizedTextSummary;
  readonly exactFingerprint?: string | null;
  readonly structuralFingerprint?: string | null;
  readonly score?: number;
  readonly explanation?: RiskExplanation;
  readonly correlationStage?: CorrelationStage;
  readonly suggestedDecision?: ModerationDecision;
}

export interface VisualAttachment {
  readonly contentType: string | null;
  readonly fileName: string | null;
  readonly sizeBytes?: number | null;
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
  readonly eventSource?: MessageEventSource;
  readonly content: string;
  readonly mentionedEveryone: boolean;
  readonly mentionedHere: boolean;
  readonly mentionedRoleIds: readonly string[];
  readonly attachments: readonly VisualAttachment[];
  readonly embeds: readonly EmbedSummary[];
  readonly stickerCount: number;
  readonly createdTimestamp: number;
  readonly editedTimestamp?: number | null;
  readonly parentCategoryId?: string | null;
  readonly parentChannelId?: string | null;
  readonly categoryPosition?: number | null;
  readonly parentPosition?: number | null;
  readonly channelPosition?: number | null;
  readonly channelIsAnnouncement?: boolean;
  readonly channelIsRestricted?: boolean;
}

export interface RecentSuspiciousMessage {
  readonly createdTimestamp: number;
}

export interface DetectionContext {
  readonly roleDetectionMode: RoleDetectionMode;
  readonly protectedRoleIds: ReadonlySet<string>;
  readonly roleRiskById?: Readonly<Record<string, MentionRiskLevel>>;
  readonly minVisualCount: number;
  readonly maxInformationChars: number;
  readonly burstWindowSeconds: number;
  readonly burstMessageCount: number;
  readonly linkRuleEnabled: boolean;
  readonly recentSuspiciousMessages: readonly RecentSuspiciousMessage[];
}

export interface CorrelationEvent {
  readonly id: string;
  readonly guildId: string;
  readonly actorId: string;
  readonly channelId: string;
  readonly categoryId: string | null;
  readonly categoryPosition: number | null;
  readonly parentPosition: number | null;
  readonly channelPosition: number | null;
  readonly exactFingerprint: string | null;
  readonly structuralFingerprint: string | null;
  readonly protectedMentionClass: string | null;
  readonly score: number;
  readonly decision: ModerationDecision;
  readonly eventSource: MessageEventSource;
  readonly createdAt: Date;
}

export interface CorrelationSummary {
  readonly stage: CorrelationStage;
  readonly relatedEvents: readonly CorrelationEvent[];
  readonly coordinatedActorIds: readonly string[];
  readonly triggeredSignals: readonly RiskSignalId[];
}

export interface RiskContext {
  readonly actorActivityClass: ActorActivityClass;
  readonly channelContext: string;
  readonly channelPolicy: ChannelGuardMode;
}
