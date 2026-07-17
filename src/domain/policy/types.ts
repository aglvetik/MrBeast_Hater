export type ActorKind = "USER" | "BOT" | "WEBHOOK" | "SELF";
export type RoleDetectionMode = "MANUAL" | "ALL_ROLES";
export type ChannelGuardMode =
  | "INHERIT"
  | "ENFORCE"
  | "DELETE_ONLY"
  | "MONITOR_ONLY"
  | "NO_PUNISH"
  | "IGNORE_ALL"
  | "MONITOR"
  | "DISABLED";
export type ChannelPolicy = ChannelGuardMode;
export type MentionRiskLevel = "IGNORE" | "NORMAL" | "HIGH" | "CRITICAL";
export type ActorPolicy = "SCOPED_PUBLISHER" | "NO_PUNISH" | "MONITOR_ONLY" | "FULL_BYPASS";
export type ActorPolicyTargetType = "USER" | "ROLE" | "BOT" | "WEBHOOK";
export type PolicyScopeType = "GUILD" | "CATEGORY" | "CHANNEL";
export type PunishmentType = "NONE" | "TIMEOUT" | "KICK" | "BAN";
export type EscalationMode = "OFF" | "PRESET" | "CUSTOM";
export type Preset = "BALANCED" | "STRICT" | "CAUTIOUS" | "MONITOR";
export type Locale = "en" | "ru";
export type OperationMode = "ENFORCE" | "DELETE_ONLY" | "MONITOR";
export type ModerationDecision =
  "ALLOW" | "OBSERVE" | "LOG_ONLY" | "DELETE_ONLY" | "QUARANTINE" | "ENFORCE";
export type CorrelationStage = "NONE" | "FIRST" | "SECOND" | "CONFIRMED";
export type ActorActivityClass = "UNKNOWN" | "NEW" | "KNOWN" | "ESTABLISHED" | "DORMANT";
export type MessageEventSource = "CREATE" | "UPDATE";
export type FirstStrikeBehavior =
  "DELETE_ON_FIRST" | "MONITOR_ON_FIRST" | "QUARANTINE_HIGH_CONFIDENCE";

export interface RiskSignalBreakdown {
  readonly id: string;
  readonly weight: number;
  readonly explanation: string;
}

export interface RiskExplanation {
  readonly score: number;
  readonly signals: readonly RiskSignalBreakdown[];
  readonly positiveTotal: number;
  readonly negativeTotal: number;
  readonly activityClass: ActorActivityClass;
  readonly channelContext: string;
  readonly correlationStage: CorrelationStage;
  readonly policyCaps: readonly string[];
  readonly finalDecision: ModerationDecision;
}

export interface GuildSettings {
  readonly guildId: string;
  readonly enabled: boolean;
  readonly locale: Locale;
  readonly operationMode: OperationMode;
  readonly preset: Preset;
  readonly logChannelId: string | null;
  readonly roleDetectionMode: RoleDetectionMode;
  readonly memberPunishment: PunishmentType;
  readonly memberTimeoutSeconds: number | null;
  readonly botPunishment: PunishmentType;
  readonly minVisualCount: number;
  readonly maxInformationChars: number;
  readonly burstWindowSeconds: number;
  readonly burstMessageCount: number;
  readonly escalationMode: EscalationMode;
  readonly retentionDays: 7 | 30 | 90 | 180;
  readonly dryRunEnabled: boolean;
  readonly linkRuleEnabled: boolean;
  readonly sanctionCooldownSeconds: number;
  readonly firstStrikeBehavior: FirstStrikeBehavior;
  readonly warmupDays: number;
  readonly guildWarmupStartedAt: Date | null;
  readonly correlationWindowSeconds: number;
  readonly raidSessionDurationSeconds: number;
  readonly quarantineTimeoutSeconds: number;
  readonly newAccountMaxAgeHours: number;
  readonly newJoinMaxAgeHours: number;
  readonly meaningfulTextThreshold: number;
  readonly observeThreshold: number;
  readonly logOnlyThreshold: number;
  readonly deleteThreshold: number;
  readonly quarantineThreshold: number;
  readonly enforceThreshold: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletionRequestedAt: Date | null;
  readonly deletionGraceUntil: Date | null;
}

export interface ProtectedRole {
  readonly guildId: string;
  readonly roleId: string;
}

export interface RoleRiskProfile {
  readonly guildId: string;
  readonly roleId: string;
  readonly riskLevel: MentionRiskLevel;
}

export interface ChannelPolicyEntry {
  readonly guildId: string;
  readonly channelId: string;
  readonly policy: ChannelGuardMode;
}

export interface CategoryPolicyEntry {
  readonly guildId: string;
  readonly categoryId: string;
  readonly policy: ChannelGuardMode;
}

export interface ScopedActorPolicy {
  readonly id: string;
  readonly guildId: string;
  readonly targetId: string;
  readonly targetType: ActorPolicyTargetType;
  readonly policy: ActorPolicy;
  readonly scopeType: PolicyScopeType;
  readonly scopeId: string | null;
  readonly expiresAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface TrustedActor {
  readonly guildId: string;
  readonly actorId: string;
  readonly actorType: "ROLE" | "BOT" | "WEBHOOK";
  readonly policy: "NO_PUNISH" | "MONITOR" | "ALLOW";
}

export interface EscalationStep {
  readonly id: string;
  readonly guildId: string;
  readonly orderIndex: number;
  readonly thresholdCount: number;
  readonly windowDays: number;
  readonly punishmentType: PunishmentType;
  readonly durationSeconds: number | null;
  readonly enabled: boolean;
}

export interface ActorContext {
  readonly actorId: string;
  readonly actorKind: ActorKind;
  readonly roleIds: readonly string[];
  readonly isAdministrator: boolean;
  readonly canManageGuild?: boolean;
  readonly isGuildOwner: boolean;
  readonly createdTimestamp?: number | null;
  readonly joinedTimestamp?: number | null;
}

export interface ActorActivityProfile {
  readonly actorId: string;
  readonly firstObservedAt: Date | null;
  readonly lastObservedAt: Date | null;
  readonly activeDays: number;
  readonly messageCount: number;
  readonly recentUniqueChannels: number;
  readonly priorLegitimatePublisherPosts: number;
  readonly priorConfirmedIncidents: number;
  readonly priorFalsePositiveCorrections: number;
  readonly lastActivityInChannelAt: Date | null;
  readonly activityClass: ActorActivityClass;
}

export interface ChannelActivityProfile {
  readonly channelId: string;
  readonly messageCount: number;
  readonly protectedVisualCount: number;
  readonly knownPublisherCount: number;
  readonly lastProtectedVisualAt: Date | null;
  readonly isRestricted: boolean;
  readonly isAnnouncement: boolean;
  readonly isQuiet: boolean;
  readonly contextLabel: string;
}

export interface ActionPlan {
  readonly decision: ModerationDecision;
  readonly shouldDelete: boolean;
  readonly shouldPunish: boolean;
  readonly punishmentType: PunishmentType;
  readonly punishmentDurationSeconds: number | null;
  readonly shouldLog: boolean;
  readonly shouldObserve: boolean;
  readonly dryRun: boolean;
  readonly channelPolicy: ChannelGuardMode;
  readonly categoryPolicy: ChannelGuardMode | null;
  readonly actorPolicy: ActorPolicy | null;
  readonly trustPolicy?: "NO_PUNISH" | "MONITOR" | "ALLOW" | null;
  readonly policyCaps: readonly string[];
  readonly explanation: RiskExplanation;
  readonly isConfirmedStrike: boolean;
  readonly removePunishmentOnFalsePositive: boolean;
}
