import type {
  ButtonInteraction,
  ChannelSelectMenuInteraction,
  ChatInputCommandInteraction,
  MessageContextMenuCommandInteraction,
  RoleSelectMenuInteraction,
  StringSelectMenuInteraction
} from "discord.js";

import { handleAnalyzeMessage } from "../commands/analyzeMessageHandler.js";
import { handleGuardCommand } from "../commands/guardHandlers.js";
import { handleDataDeleteButton } from "../components/dataDeleteHandler.js";
import { handleIncidentActionButton } from "../components/incidentActionHandler.js";
import { handleSetupButton, handleSetupSelectMenu } from "../components/setupHandlers.js";
import type { DiscordAppContext } from "../runtime.js";
import { ephemeral, hasManageAccess } from "./shared.js";
import { t } from "../../shared/i18n/messages.js";

export async function handleInteractionCreate(
  context: DiscordAppContext,
  interaction:
    | ChatInputCommandInteraction
    | MessageContextMenuCommandInteraction
    | ButtonInteraction
    | StringSelectMenuInteraction
    | RoleSelectMenuInteraction
    | ChannelSelectMenuInteraction
): Promise<void> {
  if (interaction.isChatInputCommand()) {
    await handleChatInput(context, interaction);
    return;
  }

  if (interaction.isMessageContextMenuCommand()) {
    await handleMessageContext(context, interaction);
    return;
  }

  if (!interaction.inCachedGuild()) {
    await interaction.reply(ephemeral(t(context.env.DEFAULT_LOCALE, "generic.guild_only")));
    return;
  }

  if (interaction.isButton()) {
    await handleButton(context, interaction);
    return;
  }

  if (
    interaction.isStringSelectMenu() ||
    interaction.isRoleSelectMenu() ||
    interaction.isChannelSelectMenu()
  ) {
    await handleSetupSelectMenu(context, interaction);
  }
}

async function handleChatInput(
  context: DiscordAppContext,
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!interaction.inCachedGuild()) {
    await interaction.reply(ephemeral(t(context.env.DEFAULT_LOCALE, "generic.guild_only")));
    return;
  }

  if (interaction.commandName !== "guard") {
    return;
  }

  if (!hasManageAccess(interaction)) {
    await interaction.reply(ephemeral(t(context.env.DEFAULT_LOCALE, "generic.no_permission")));
    return;
  }

  await handleGuardCommand(context, interaction);
}

async function handleMessageContext(
  context: DiscordAppContext,
  interaction: MessageContextMenuCommandInteraction
): Promise<void> {
  if (!interaction.inCachedGuild()) {
    await interaction.reply(ephemeral(t(context.env.DEFAULT_LOCALE, "generic.guild_only")));
    return;
  }

  if (interaction.commandName !== "Analyze with PingGuard") {
    return;
  }

  await handleAnalyzeMessage(context, interaction);
}

async function handleButton(
  context: DiscordAppContext,
  interaction: ButtonInteraction<"cached">
): Promise<void> {
  if (await handleSetupButton(context, interaction)) {
    return;
  }

  if (await handleDataDeleteButton(context, interaction)) {
    return;
  }

  await handleIncidentActionButton(context, interaction);
}
