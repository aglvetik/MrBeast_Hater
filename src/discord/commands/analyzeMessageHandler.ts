import type { MessageContextMenuCommandInteraction } from "discord.js";

import { detectVisualMassPing } from "../../domain/detection/engine.js";
import { evaluatePolicy } from "../../domain/policy/engine.js";
import { t } from "../../shared/i18n/messages.js";
import { ephemeral, getGuildSettings, hasManageAccess } from "../interactions/shared.js";
import { mapDiscordMessage } from "../mappers/messageMapper.js";
import type { DiscordAppContext } from "../runtime.js";

export async function handleAnalyzeMessage(
  context: DiscordAppContext,
  interaction: MessageContextMenuCommandInteraction<"cached">
): Promise<void> {
  if (!hasManageAccess(interaction)) {
    await interaction.reply(ephemeral(t(context.env.DEFAULT_LOCALE, "generic.no_permission")));
    return;
  }

  if (!interaction.targetMessage.inGuild()) {
    await interaction.reply(ephemeral(t(context.env.DEFAULT_LOCALE, "generic.guild_only")));
    return;
  }

  const selfUserId = interaction.client.user?.id;
  if (!selfUserId) {
    await interaction.reply(ephemeral("Client is not ready."));
    return;
  }

  const mapped = mapDiscordMessage(interaction.targetMessage, selfUserId);
  const [settings, protectedRoles, trustedActors, escalationSteps] = await Promise.all([
    getGuildSettings(context, interaction.guildId),
    context.protectedRoleRepository.listByGuildId(interaction.guildId),
    context.trustedActorRepository.listByGuildId(interaction.guildId),
    context.escalationRepository.listByGuildId(interaction.guildId)
  ]);

  const channelPolicy =
    (await context.channelPolicyRepository.getForChannel(
      interaction.guildId,
      interaction.channelId
    )) ?? "ENFORCE";

  const detection = detectVisualMassPing(mapped.observedMessage, {
    roleDetectionMode: settings.roleDetectionMode,
    protectedRoleIds: new Set(protectedRoles.map((entry) => entry.roleId)),
    minVisualCount: settings.minVisualCount,
    maxInformationChars: settings.maxInformationChars,
    burstWindowSeconds: settings.burstWindowSeconds,
    burstMessageCount: settings.burstMessageCount,
    linkRuleEnabled: settings.linkRuleEnabled,
    recentSuspiciousMessages: []
  });

  const plan = evaluatePolicy({
    settings,
    detection,
    actor: mapped.actor,
    channelPolicy,
    trustedActors,
    incidentCountWithinWindow: 1,
    escalationSteps
  });

  await interaction.reply(
    ephemeral(
      [
        `Detected: ${detection.detected ? "yes" : "no"}`,
        `Rule: ${detection.ruleId ?? "none"}`,
        `Confidence: ${detection.confidence}`,
        `Mentions: ${detection.protectedMentions.map((entry) => entry.kind).join(", ") || "none"}`,
        `Visuals: ${detection.media.totalVisualCount}`,
        `Info chars: ${detection.normalizedText.informationCharCount}`,
        `Would delete: ${plan.shouldDelete ? "yes" : "no"}`,
        `Would punish: ${plan.shouldPunish ? `yes (${plan.punishmentType})` : "no"}`,
        `Would log: ${plan.shouldLog ? "yes" : "no"}`
      ].join("\n")
    )
  );
}
