import type { ButtonInteraction } from "discord.js";

import { ALLOWED_MENTIONS } from "../../config/constants.js";
import { t } from "../../shared/i18n/messages.js";
import { parseDataDeleteCustomId } from "../interactions/customIds.js";
import { ephemeral, isOwnerOnly, refreshGuildGauge } from "../interactions/shared.js";
import type { DiscordAppContext } from "../runtime.js";

export async function handleDataDeleteButton(
  context: DiscordAppContext,
  interaction: ButtonInteraction<"cached">
): Promise<boolean> {
  const parsed = parseDataDeleteCustomId(interaction.customId);
  if (!parsed) {
    return false;
  }

  if (
    parsed.guildId !== interaction.guildId ||
    parsed.userId !== interaction.user.id ||
    !isOwnerOnly(interaction)
  ) {
    await interaction.reply(ephemeral("Only the requesting guild owner can use this action."));
    return true;
  }

  if (parsed.action === "cancel") {
    await interaction.update({
      content: "Guild data deletion cancelled.",
      allowedMentions: ALLOWED_MENTIONS,
      components: []
    });
    return true;
  }

  await context.guildDataRepository.deleteGuildData(interaction.guildId);
  context.settingsCache.invalidate(interaction.guildId);
  await refreshGuildGauge(context);

  await interaction.update({
    content: t(context.env.DEFAULT_LOCALE, "data.delete.done"),
    allowedMentions: ALLOWED_MENTIONS,
    components: []
  });
  return true;
}
