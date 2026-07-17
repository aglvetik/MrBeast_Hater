import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  MessageFlags,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  type ButtonInteraction,
  type ChannelSelectMenuInteraction,
  type InteractionReplyOptions,
  type InteractionUpdateOptions,
  type RoleSelectMenuInteraction,
  type StringSelectMenuInteraction
} from "discord.js";

import { ALLOWED_MENTIONS } from "../../config/constants.js";
import { applyPreset } from "../../domain/policy/presets.js";
import type { GuildSettings, Locale, PunishmentType, Preset } from "../../domain/policy/types.js";
import { t } from "../../shared/i18n/messages.js";
import { parseSetupCustomId, setupCustomId } from "../interactions/customIds.js";
import {
  diagnosePermissions,
  ephemeral,
  hasManageAccess,
  refreshGuildGauge,
  type GuardInteraction
} from "../interactions/shared.js";
import type { DiscordAppContext } from "../runtime.js";

function toUpdateOptions(options: InteractionReplyOptions): InteractionUpdateOptions {
  const update: InteractionUpdateOptions = {};

  if (typeof options.content === "string" || options.content === null) {
    update.content = options.content;
  }

  if (options.allowedMentions) {
    update.allowedMentions = options.allowedMentions;
  }

  if (options.components) {
    update.components = options.components;
  }

  return update;
}

function renderSetupLocale(sessionId: string, locale: Locale): InteractionReplyOptions {
  return {
    content: `${t(locale, "setup.title")}\nSelect a language to continue.`,
    allowedMentions: ALLOWED_MENTIONS,
    flags: MessageFlags.Ephemeral,
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(setupCustomId(sessionId, "locale:en"))
          .setLabel("English")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(setupCustomId(sessionId, "locale:ru"))
          .setLabel("Russian")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(setupCustomId(sessionId, "cancel"))
          .setLabel("Cancel")
          .setStyle(ButtonStyle.Danger)
      )
    ]
  };
}

function renderSetupLogChannel(sessionId: string, locale: Locale): InteractionReplyOptions {
  return {
    content: `${t(locale, "setup.title")}\nChoose the moderation log channel.`,
    allowedMentions: ALLOWED_MENTIONS,
    flags: MessageFlags.Ephemeral,
    components: [
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
        new ChannelSelectMenuBuilder()
          .setCustomId(setupCustomId(sessionId, "log_channel"))
          .setPlaceholder("Select a mod-log channel")
          .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
          .setMinValues(1)
          .setMaxValues(1)
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(setupCustomId(sessionId, "cancel"))
          .setLabel("Cancel")
          .setStyle(ButtonStyle.Danger)
      )
    ]
  };
}

function renderSetupPreset(sessionId: string, locale: Locale): InteractionReplyOptions {
  return {
    content: `${t(locale, "setup.title")}\nChoose a preset.`,
    allowedMentions: ALLOWED_MENTIONS,
    flags: MessageFlags.Ephemeral,
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(setupCustomId(sessionId, "preset"))
          .setPlaceholder("Select a preset")
          .addOptions(
            { label: "BALANCED", value: "BALANCED", description: "Default production setup" },
            {
              label: "STRICT",
              value: "STRICT",
              description: "Broader detection and longer timeout"
            },
            { label: "MONITOR", value: "MONITOR", description: "Log only, no delete or punish" }
          )
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(setupCustomId(sessionId, "cancel"))
          .setLabel("Cancel")
          .setStyle(ButtonStyle.Danger)
      )
    ]
  };
}

function renderSetupRoles(
  sessionId: string,
  locale: Locale,
  selectedRoleCount: number
): InteractionReplyOptions {
  return {
    content: `${t(locale, "setup.title")}\nSelect protected roles. Current selection: ${selectedRoleCount}.`,
    allowedMentions: ALLOWED_MENTIONS,
    flags: MessageFlags.Ephemeral,
    components: [
      new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
        new RoleSelectMenuBuilder()
          .setCustomId(setupCustomId(sessionId, "roles"))
          .setPlaceholder("Select protected roles")
          .setMinValues(0)
          .setMaxValues(25)
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(setupCustomId(sessionId, "cancel"))
          .setLabel("Cancel")
          .setStyle(ButtonStyle.Danger)
      )
    ]
  };
}

function renderSetupMemberPunishment(sessionId: string, locale: Locale): InteractionReplyOptions {
  return {
    content: `${t(locale, "setup.title")}\nChoose the default member punishment.`,
    allowedMentions: ALLOWED_MENTIONS,
    flags: MessageFlags.Ephemeral,
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(setupCustomId(sessionId, "member_punishment"))
          .setPlaceholder("Select a member punishment")
          .addOptions(
            { label: "NONE", value: "NONE" },
            { label: "TIMEOUT", value: "TIMEOUT" },
            { label: "KICK", value: "KICK" },
            { label: "BAN", value: "BAN" }
          )
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(setupCustomId(sessionId, "cancel"))
          .setLabel("Cancel")
          .setStyle(ButtonStyle.Danger)
      )
    ]
  };
}

function renderSetupBotPunishment(sessionId: string, locale: Locale): InteractionReplyOptions {
  return {
    content: `${t(locale, "setup.title")}\nChoose the default bot punishment.`,
    allowedMentions: ALLOWED_MENTIONS,
    flags: MessageFlags.Ephemeral,
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(setupCustomId(sessionId, "bot_punishment"))
          .setPlaceholder("Select a bot punishment")
          .addOptions(
            { label: "NONE", value: "NONE" },
            { label: "KICK", value: "KICK" },
            { label: "BAN", value: "BAN" }
          )
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(setupCustomId(sessionId, "cancel"))
          .setLabel("Cancel")
          .setStyle(ButtonStyle.Danger)
      )
    ]
  };
}

function renderSetupConfirmation(
  sessionId: string,
  locale: Locale,
  diagnosis: string,
  summary: string
): InteractionReplyOptions {
  return {
    content: `${t(locale, "setup.title")}\n${summary}\n\n${diagnosis}`,
    allowedMentions: ALLOWED_MENTIONS,
    flags: MessageFlags.Ephemeral,
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(setupCustomId(sessionId, "confirm"))
          .setLabel("Save")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(setupCustomId(sessionId, "cancel"))
          .setLabel("Cancel")
          .setStyle(ButtonStyle.Danger)
      )
    ]
  };
}

export async function handleSetupCommand(
  context: DiscordAppContext,
  interaction: GuardInteraction
): Promise<void> {
  const session = context.setupSessions.create(
    interaction.guildId,
    interaction.user.id,
    context.env.DEFAULT_LOCALE
  );

  if (!session.ok) {
    await interaction.reply(ephemeral(t(context.env.DEFAULT_LOCALE, "setup.busy")));
    return;
  }

  await interaction.reply(renderSetupLocale(session.value.id, session.value.draft.locale));
}

function claimSetupSession(
  context: DiscordAppContext,
  interaction:
    | ButtonInteraction<"cached">
    | StringSelectMenuInteraction<"cached">
    | RoleSelectMenuInteraction<"cached">
    | ChannelSelectMenuInteraction<"cached">,
  sessionId: string
): Promise<ReturnType<DiscordAppContext["setupSessions"]["claim"]>> {
  context.setupSessions.cleanupExpired();
  return Promise.resolve(
    context.setupSessions.claim(sessionId, interaction.guildId, interaction.user.id)
  );
}

export async function handleSetupButton(
  context: DiscordAppContext,
  interaction: ButtonInteraction<"cached">
): Promise<boolean> {
  const parsed = parseSetupCustomId(interaction.customId);
  if (!parsed) {
    return false;
  }

  const claimed = await claimSetupSession(context, interaction, parsed.sessionId);
  if (!claimed.ok) {
    await interaction.reply(ephemeral(t(context.env.DEFAULT_LOCALE, "setup.expired")));
    return true;
  }

  if (!hasManageAccess(interaction)) {
    await interaction.reply(ephemeral(t(context.env.DEFAULT_LOCALE, "generic.no_permission")));
    return true;
  }

  if (parsed.action === "cancel") {
    context.setupSessions.cancel(parsed.sessionId);
    await interaction.update({
      content: t(claimed.value.draft.locale, "setup.cancelled"),
      allowedMentions: ALLOWED_MENTIONS,
      components: []
    });
    return true;
  }

  if (parsed.action.startsWith("locale:")) {
    const locale = parsed.action.slice("locale:".length) as Locale;
    const updated = context.setupSessions.update(parsed.sessionId, (draft) => ({
      ...draft,
      locale
    }));

    if (!updated.ok) {
      await interaction.reply(ephemeral(t(context.env.DEFAULT_LOCALE, "setup.expired")));
      return true;
    }

    await interaction.update(toUpdateOptions(renderSetupLogChannel(parsed.sessionId, locale)));
    return true;
  }

  if (parsed.action === "confirm") {
    const draft = claimed.value.draft;
    let selectedChannelId: string | null = draft.logChannelId;

    if (selectedChannelId) {
      const logChannel = await interaction.guild.channels
        .fetch(selectedChannelId)
        .catch(() => null);
      if (!logChannel?.isTextBased()) {
        selectedChannelId = null;
      }
    }

    const validRoleIds = draft.protectedRoleIds.filter((roleId) =>
      interaction.guild.roles.cache.has(roleId)
    );
    const base = applyPreset(interaction.guildId, draft.preset, draft.locale);
    const previous = await context.settingsRepository.getByGuildId(interaction.guildId);
    const timeoutSeconds =
      draft.memberPunishment === "TIMEOUT" ? (base.memberTimeoutSeconds ?? 86_400) : null;
    const settings: GuildSettings = {
      ...base,
      enabled: true,
      logChannelId: selectedChannelId,
      memberPunishment: draft.memberPunishment,
      memberTimeoutSeconds: timeoutSeconds,
      botPunishment: draft.botPunishment,
      createdAt: previous?.createdAt ?? context.clock.now(),
      updatedAt: context.clock.now()
    };

    await context.guildDataRepository.completeSetupConfiguration(
      settings,
      validRoleIds,
      interaction.user.id,
      {
        preset: draft.preset,
        locale: draft.locale,
        logChannelId: selectedChannelId,
        protectedRoleCount: validRoleIds.length,
        memberPunishment: draft.memberPunishment,
        botPunishment: draft.botPunishment
      }
    );
    context.settingsCache.invalidate(interaction.guildId);
    context.setupSessions.complete(parsed.sessionId);
    await refreshGuildGauge(context);

    await interaction.update({
      content: t(draft.locale, "setup.saved"),
      allowedMentions: ALLOWED_MENTIONS,
      components: []
    });
    return true;
  }

  return false;
}

export async function handleSetupSelectMenu(
  context: DiscordAppContext,
  interaction:
    | StringSelectMenuInteraction<"cached">
    | RoleSelectMenuInteraction<"cached">
    | ChannelSelectMenuInteraction<"cached">
): Promise<boolean> {
  const parsed = parseSetupCustomId(interaction.customId);
  if (!parsed) {
    return false;
  }

  const claimed = await claimSetupSession(context, interaction, parsed.sessionId);
  if (!claimed.ok) {
    await interaction.reply(ephemeral(t(context.env.DEFAULT_LOCALE, "setup.expired")));
    return true;
  }

  if (!hasManageAccess(interaction)) {
    await interaction.reply(ephemeral(t(context.env.DEFAULT_LOCALE, "generic.no_permission")));
    return true;
  }

  if (parsed.action === "log_channel" && interaction.isChannelSelectMenu()) {
    const updated = context.setupSessions.update(parsed.sessionId, (draft) => ({
      ...draft,
      logChannelId: interaction.values[0] ?? null
    }));

    if (!updated.ok) {
      await interaction.reply(ephemeral(t(context.env.DEFAULT_LOCALE, "setup.expired")));
      return true;
    }

    await interaction.update(
      toUpdateOptions(renderSetupPreset(parsed.sessionId, updated.value.draft.locale))
    );
    return true;
  }

  if (parsed.action === "preset" && interaction.isStringSelectMenu()) {
    const preset = interaction.values[0] as Preset;
    const updated = context.setupSessions.update(parsed.sessionId, (draft) => ({
      ...draft,
      preset
    }));

    if (!updated.ok) {
      await interaction.reply(ephemeral(t(context.env.DEFAULT_LOCALE, "setup.expired")));
      return true;
    }

    await interaction.update(
      toUpdateOptions(
        renderSetupRoles(
          parsed.sessionId,
          updated.value.draft.locale,
          updated.value.draft.protectedRoleIds.length
        )
      )
    );
    return true;
  }

  if (parsed.action === "roles" && interaction.isRoleSelectMenu()) {
    const updated = context.setupSessions.update(parsed.sessionId, (draft) => ({
      ...draft,
      protectedRoleIds: [...interaction.values]
    }));

    if (!updated.ok) {
      await interaction.reply(ephemeral(t(context.env.DEFAULT_LOCALE, "setup.expired")));
      return true;
    }

    await interaction.update(
      toUpdateOptions(renderSetupMemberPunishment(parsed.sessionId, updated.value.draft.locale))
    );
    return true;
  }

  if (parsed.action === "member_punishment" && interaction.isStringSelectMenu()) {
    const updated = context.setupSessions.update(parsed.sessionId, (draft) => ({
      ...draft,
      memberPunishment: interaction.values[0] as PunishmentType
    }));

    if (!updated.ok) {
      await interaction.reply(ephemeral(t(context.env.DEFAULT_LOCALE, "setup.expired")));
      return true;
    }

    await interaction.update(
      toUpdateOptions(renderSetupBotPunishment(parsed.sessionId, updated.value.draft.locale))
    );
    return true;
  }

  if (parsed.action === "bot_punishment" && interaction.isStringSelectMenu()) {
    const updated = context.setupSessions.update(parsed.sessionId, (draft) => ({
      ...draft,
      botPunishment: interaction.values[0] as PunishmentType
    }));

    if (!updated.ok) {
      await interaction.reply(ephemeral(t(context.env.DEFAULT_LOCALE, "setup.expired")));
      return true;
    }

    const diagnosis = diagnosePermissions(interaction, updated.value.draft.logChannelId);
    const summary = [
      `Locale: ${updated.value.draft.locale}`,
      `Preset: ${updated.value.draft.preset}`,
      `Log channel: ${updated.value.draft.logChannelId ? `<#${updated.value.draft.logChannelId}>` : "not set"}`,
      `Protected roles: ${updated.value.draft.protectedRoleIds.length}`,
      `Member punishment: ${updated.value.draft.memberPunishment}`,
      `Bot punishment: ${updated.value.draft.botPunishment}`
    ].join("\n");

    await interaction.update(
      toUpdateOptions(
        renderSetupConfirmation(parsed.sessionId, updated.value.draft.locale, diagnosis, summary)
      )
    );
    return true;
  }

  return false;
}
