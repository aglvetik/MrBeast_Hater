export type ActorKind = "USER" | "BOT" | "WEBHOOK" | "SELF";
export type RoleDetectionMode = "MANUAL" | "ALL_ROLES";
export type ChannelPolicy = "ENFORCE" | "DELETE_ONLY" | "MONITOR" | "DISABLED";
export type TrustPolicy = "NO_PUNISH" | "MONITOR" | "ALLOW";
export type TrustActorType = "ROLE" | "BOT" | "WEBHOOK";
export type PunishmentType = "NONE" | "TIMEOUT" | "KICK" | "BAN";
export type EscalationMode = "OFF" | "PRESET" | "CUSTOM";
export type Preset = "BALANCED" | "STRICT" | "MONITOR";
export type Locale = "en" | "ru";
export type OperationMode = "ENFORCE" | "DELETE_ONLY" | "MONITOR";

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
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletionRequestedAt: Date | null;
  readonly deletionGraceUntil: Date | null;
}

export interface ProtectedRole {
  readonly guildId: string;
  readonly roleId: string;
}

export interface ChannelPolicyEntry {
  readonly guildId: string;
  readonly channelId: string;
  readonly policy: ChannelPolicy;
}

export interface TrustedActor {
  readonly guildId: string;
  readonly actorId: string;
  readonly actorType: TrustActorType;
  readonly policy: TrustPolicy;
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
  readonly isGuildOwner: boolean;
}

export interface ActionPlan {
  readonly shouldDelete: boolean;
  readonly shouldPunish: boolean;
  readonly punishmentType: PunishmentType;
  readonly punishmentDurationSeconds: number | null;
  readonly shouldLog: boolean;
  readonly dryRun: boolean;
  readonly channelPolicy: ChannelPolicy;
  readonly trustPolicy: TrustPolicy | null;
}
