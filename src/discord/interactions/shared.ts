import { randomUUID } from "node:crypto";

import {
  MessageFlags,
  PermissionFlagsBits,
  type ButtonInteraction,
  type ChannelSelectMenuInteraction,
  type ChatInputCommandInteraction,
  type InteractionReplyOptions,
  type MessageContextMenuCommandInteraction,
  type RoleSelectMenuInteraction,
  type StringSelectMenuInteraction
} from "discord.js";

import { ALLOWED_MENTIONS, buildDefaultGuildSettings } from "../../config/constants.js";
import { product } from "../../config/product.js";
import type { EscalationStep, GuildSettings, PunishmentType } from "../../domain/policy/types.js";
import type { DiscordAppContext } from "../runtime.js";

export type GuardInteraction = ChatInputCommandInteraction<"cached">;

export type ManagedInteraction =
  | GuardInteraction
  | MessageContextMenuCommandInteraction<"cached">
  | ButtonInteraction<"cached">
  | StringSelectMenuInteraction<"cached">
  | RoleSelectMenuInteraction<"cached">
  | ChannelSelectMenuInteraction<"cached">;

export type SetupComponentInteraction =
  | ButtonInteraction<"cached">
  | StringSelectMenuInteraction<"cached">
  | RoleSelectMenuInteraction<"cached">
  | ChannelSelectMenuInteraction<"cached">;

export function ephemeral(content: string): InteractionReplyOptions {
  return {
    content,
    allowedMentions: ALLOWED_MENTIONS,
    flags: MessageFlags.Ephemeral
  };
}

export function hasManageAccess(interaction: ManagedInteraction): boolean {
  return (
    interaction.user.id === interaction.guild.ownerId ||
    interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild) ||
    interaction.memberPermissions.has(PermissionFlagsBits.Administrator)
  );
}

export function isOwnerOnly(interaction: GuardInteraction | ButtonInteraction<"cached">): boolean {
  return interaction.user.id === interaction.guild.ownerId;
}

export async function refreshGuildGauge(context: DiscordAppContext): Promise<void> {
  const enabled = await context.settingsRepository.countEnabledGuilds();
  context.metrics.guildsTotal.set(enabled);
}

export async function getGuildSettings(
  context: DiscordAppContext,
  guildId: string
): Promise<GuildSettings> {
  const existing = await context.settingsRepository.getByGuildId(guildId);
  return existing ?? buildDefaultGuildSettings(guildId, context.env.DEFAULT_LOCALE);
}

export async function saveGuildSettings(
  context: DiscordAppContext,
  settings: GuildSettings,
  actorId: string,
  eventType: string,
  payload: Record<string, unknown>
): Promise<void> {
  await context.settingsRepository.upsert(settings);
  context.settingsCache.invalidate(settings.guildId);
  await context.auditRepository.append(settings.guildId, actorId, eventType, payload);
  await refreshGuildGauge(context);
}

export function formatPunishment(type: PunishmentType, durationSeconds: number | null): string {
  if (type !== "TIMEOUT") {
    return type;
  }

  return durationSeconds !== null ? `${type} (${durationSeconds}s)` : type;
}

export function formatStatus(
  settings: GuildSettings,
  protectedRoleCount: number,
  channelPolicyCount: number
): string {
  return [
    `**${product.name}**`,
    `Enabled: ${settings.enabled ? "yes" : "no"}`,
    `Locale: ${settings.locale}`,
    `Preset: ${settings.preset}`,
    `Mode: ${settings.operationMode}`,
    `Role detection: ${settings.roleDetectionMode}`,
    `Log channel: ${settings.logChannelId ? `<#${settings.logChannelId}>` : "not set"}`,
    `Member punishment: ${formatPunishment(settings.memberPunishment, settings.memberTimeoutSeconds)}`,
    `Bot punishment: ${settings.botPunishment}`,
    `Escalation: ${settings.escalationMode}`,
    `Dry run: ${settings.dryRunEnabled ? "enabled" : "disabled"}`,
    `Protected roles: ${protectedRoleCount}`,
    `Channel overrides: ${channelPolicyCount}`,
    `Retention: ${settings.retentionDays} days`
  ].join("\n");
}

export function createDefaultCustomEscalationSteps(guildId: string): readonly EscalationStep[] {
  return [
    {
      id: randomUUID(),
      guildId,
      orderIndex: 0,
      thresholdCount: 1,
      windowDays: 30,
      punishmentType: "TIMEOUT",
      durationSeconds: 3_600,
      enabled: true
    },
    {
      id: randomUUID(),
      guildId,
      orderIndex: 1,
      thresholdCount: 2,
      windowDays: 30,
      punishmentType: "TIMEOUT",
      durationSeconds: 86_400,
      enabled: true
    },
    {
      id: randomUUID(),
      guildId,
      orderIndex: 2,
      thresholdCount: 3,
      windowDays: 30,
      punishmentType: "TIMEOUT",
      durationSeconds: 604_800,
      enabled: true
    },
    {
      id: randomUUID(),
      guildId,
      orderIndex: 3,
      thresholdCount: 4,
      windowDays: 30,
      punishmentType: "TIMEOUT",
      durationSeconds: 2_419_200,
      enabled: true
    }
  ];
}

export function diagnosePermissions(
  interaction: GuardInteraction | SetupComponentInteraction,
  logChannelId: string | null
): string {
  const me = interaction.guild.members.me;
  if (!me) {
    return "Bot member cache is unavailable.";
  }

  const required = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.ManageMessages,
    PermissionFlagsBits.ModerateMembers
  ];

  const missingGuildPerms = required.filter((permission) => !me.permissions.has(permission));
  const logChannel = logChannelId ? interaction.guild.channels.cache.get(logChannelId) : null;
  const missingChannelPerms =
    logChannel && logChannel.isTextBased()
      ? [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.EmbedLinks
        ].filter((permission) => !(logChannel.permissionsFor(me)?.has(permission) ?? false))
      : [];

  return [
    missingGuildPerms.length === 0
      ? "Guild permissions: OK"
      : `Guild permissions missing: ${missingGuildPerms.map((value) => value.toString()).join(", ")}`,
    !logChannelId
      ? "Log channel: not selected"
      : missingChannelPerms.length === 0
        ? "Log channel permissions: OK"
        : `Log channel permissions missing: ${missingChannelPerms.map((value) => value.toString()).join(", ")}`
  ].join("\n");
}
