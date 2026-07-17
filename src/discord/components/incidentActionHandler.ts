import type { ButtonInteraction } from "discord.js";

import { t } from "../../shared/i18n/messages.js";
import { parseIncidentActionCustomId } from "../interactions/customIds.js";
import {
  ephemeral,
  formatStatus,
  getGuildSettings,
  hasManageAccess
} from "../interactions/shared.js";
import type { DiscordAppContext } from "../runtime.js";

export async function handleIncidentActionButton(
  context: DiscordAppContext,
  interaction: ButtonInteraction<"cached">
): Promise<boolean> {
  const parsed = parseIncidentActionCustomId(interaction.customId);
  if (!parsed) {
    return false;
  }

  if (!hasManageAccess(interaction) || parsed.guildId !== interaction.guildId) {
    await interaction.reply(ephemeral(t(context.env.DEFAULT_LOCALE, "generic.no_permission")));
    return true;
  }

  const incident = await context.incidentRepository.getById(interaction.guildId, parsed.incidentId);
  if (!incident) {
    await interaction.reply(ephemeral("Incident not found."));
    return true;
  }

  if (parsed.action === "false-positive") {
    await context.incidentRepository.markFalsePositive(
      interaction.guildId,
      parsed.incidentId,
      true
    );
    await context.auditRepository.append(
      interaction.guildId,
      interaction.user.id,
      "incident_false_positive",
      {
        incidentId: parsed.incidentId
      }
    );
    context.metrics.recordFalsePositive();
    const member = await interaction.guild.members.fetch(incident.actorId).catch(() => null);
    if (member) {
      await member
        .timeout(null, `PingGuard false-positive correction for incident ${parsed.incidentId}`)
        .catch(() => null);
    }
    await interaction.reply(
      ephemeral("Incident marked as false positive and active timeout removal was attempted.")
    );
    return true;
  }

  if (parsed.action === "open-settings") {
    const [settings, roles, channels] = await Promise.all([
      getGuildSettings(context, interaction.guildId),
      context.protectedRoleRepository.listByGuildId(interaction.guildId),
      context.channelPolicyRepository.listByGuildId(interaction.guildId)
    ]);
    await interaction.reply(ephemeral(formatStatus(settings, roles.length, channels.length)));
    return true;
  }

  if (parsed.action === "allow-user-channel" || parsed.action === "no-punish-user") {
    await context.actorPolicyRepository.upsert({
      id: `${interaction.guildId}:${incident.actorId}:${parsed.channelId}:${parsed.action}`,
      guildId: interaction.guildId,
      targetId: incident.actorId,
      targetType:
        incident.actorKind === "BOT"
          ? "BOT"
          : incident.actorKind === "WEBHOOK"
            ? "WEBHOOK"
            : "USER",
      policy: parsed.action === "allow-user-channel" ? "SCOPED_PUBLISHER" : "NO_PUNISH",
      scopeType: "CHANNEL",
      scopeId: parsed.channelId,
      expiresAt: null,
      createdAt: context.clock.now(),
      updatedAt: context.clock.now()
    });
    await context.auditRepository.append(
      interaction.guildId,
      interaction.user.id,
      parsed.action === "allow-user-channel" ? "publisher_added" : "actor_no_punish_added",
      {
        incidentId: parsed.incidentId,
        actorId: incident.actorId,
        channelId: parsed.channelId
      }
    );
    await interaction.reply(
      ephemeral(
        parsed.action === "allow-user-channel"
          ? `Allowed ${incident.actorId} in <#${parsed.channelId}>.`
          : `Added a no-punish rule for ${incident.actorId} in <#${parsed.channelId}>.`
      )
    );
    return true;
  }

  if (parsed.action === "ignore-channel") {
    if (incident.channelId !== parsed.channelId) {
      await interaction.reply(ephemeral("Incident channel mismatch."));
      return true;
    }

    await context.channelPolicyRepository.upsert(
      interaction.guildId,
      parsed.channelId,
      "IGNORE_ALL"
    );
    await context.auditRepository.append(
      interaction.guildId,
      interaction.user.id,
      "channel_policy_set",
      {
        channelId: parsed.channelId,
        policy: "IGNORE_ALL"
      }
    );
    await interaction.reply(ephemeral(`Channel <#${parsed.channelId}> is now ignored.`));
    return true;
  }

  const member = await interaction.guild.members.fetch(incident.actorId).catch(() => null);
  if (!member) {
    await interaction.reply(ephemeral("Target member is no longer available."));
    return true;
  }

  try {
    await member.timeout(
      null,
      `PingGuard manual timeout removal for incident ${parsed.incidentId}`
    );
    await context.auditRepository.append(
      interaction.guildId,
      interaction.user.id,
      "timeout_removed",
      {
        incidentId: parsed.incidentId,
        actorId: member.id
      }
    );
    await interaction.reply(ephemeral("Timeout removed."));
  } catch (error) {
    await interaction.reply(
      ephemeral(
        error instanceof Error
          ? `Failed to remove timeout: ${error.message}`
          : "Failed to remove timeout."
      )
    );
  }

  return true;
}
