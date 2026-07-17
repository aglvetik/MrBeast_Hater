import { AttachmentBuilder, MessageFlags } from "discord.js";

import { ALLOWED_MENTIONS, buildDefaultGuildSettings } from "../../config/constants.js";
import { product } from "../../config/product.js";
import { clampTimeoutSeconds, choosePresetEscalation } from "../../domain/policy/escalation.js";
import type {
  ChannelPolicy,
  GuildSettings,
  Locale,
  OperationMode,
  PunishmentType,
  RoleDetectionMode
} from "../../domain/policy/types.js";
import { t } from "../../shared/i18n/messages.js";
import { handleDetectionCommand } from "./detection/handlers.js";
import { handleExceptionsCommand } from "./exceptions/handlers.js";
import { handlePublishersCommand } from "./publishers/handlers.js";
import { handleRaidCommand } from "./raid/handlers.js";
import { dataDeleteCustomId } from "../interactions/customIds.js";
import type { DiscordAppContext } from "../runtime.js";
import {
  createDefaultCustomEscalationSteps,
  diagnosePermissions,
  ephemeral,
  formatPunishment,
  formatStatus,
  getGuildSettings,
  type GuardInteraction,
  isOwnerOnly,
  refreshGuildGauge,
  saveGuildSettings
} from "../interactions/shared.js";

export async function handleGuardCommand(
  context: DiscordAppContext,
  interaction: GuardInteraction
): Promise<void> {
  const group = interaction.options.getSubcommandGroup(false);
  const subcommand = interaction.options.getSubcommand();

  if (!group && subcommand === "setup") {
    const { handleSetupCommand } = await import("../components/setupHandlers.js");
    await handleSetupCommand(context, interaction);
    return;
  }

  if (!group && subcommand === "status") {
    await handleStatusCommand(context, interaction);
    return;
  }

  if (group === "mode" && subcommand === "set") {
    await handleModeSet(context, interaction);
    return;
  }

  if (group === "roles") {
    await handleRolesCommand(context, interaction);
    return;
  }

  if (group === "channels") {
    await handleChannelsCommand(context, interaction);
    return;
  }

  if (group === "publishers") {
    await handlePublishersCommand(context, interaction);
    return;
  }

  if (group === "exceptions") {
    await handleExceptionsCommand(context, interaction);
    return;
  }

  if (group === "detection") {
    await handleDetectionCommand(context, interaction);
    return;
  }

  if (group === "punishment") {
    await handlePunishmentCommand(context, interaction);
    return;
  }

  if (group === "raid") {
    await handleRaidCommand(context, interaction);
    return;
  }

  if (group === "dry-run") {
    await handleDryRunCommand(context, interaction);
    return;
  }

  if (!group && subcommand === "diagnose") {
    await handleDiagnoseCommand(context, interaction);
    return;
  }

  if (!group && subcommand === "test") {
    await handleTestCommand(context, interaction);
    return;
  }

  if (group === "incidents") {
    await handleIncidentsCommand(context, interaction);
    return;
  }

  if (group === "data") {
    await handleDataCommand(context, interaction);
    return;
  }

  if (!group && subcommand === "reset") {
    await handleResetCommand(context, interaction);
    return;
  }

  if (!group && subcommand === "language") {
    await handleLanguageCommand(context, interaction);
    return;
  }

  if (!group && subcommand === "help") {
    await handleHelpCommand(context, interaction);
    return;
  }

  await interaction.reply(ephemeral("Unknown command path."));
}

async function handleStatusCommand(
  context: DiscordAppContext,
  interaction: GuardInteraction
): Promise<void> {
  const [settings, roles, channels] = await Promise.all([
    getGuildSettings(context, interaction.guildId),
    context.protectedRoleRepository.listByGuildId(interaction.guildId),
    context.channelPolicyRepository.listByGuildId(interaction.guildId)
  ]);

  await interaction.reply(ephemeral(formatStatus(settings, roles.length, channels.length)));
}

async function handleModeSet(
  context: DiscordAppContext,
  interaction: GuardInteraction
): Promise<void> {
  const operation = interaction.options.getString("operation", true) as OperationMode;
  const settings = await getGuildSettings(context, interaction.guildId);
  const nextSettings: GuildSettings = {
    ...settings,
    operationMode: operation,
    enabled: operation !== "MONITOR" ? settings.enabled : settings.enabled,
    updatedAt: context.clock.now()
  };

  await saveGuildSettings(context, nextSettings, interaction.user.id, "mode_set", { operation });
  await interaction.reply(ephemeral(`Operation mode set to ${operation}.`));
}

async function handleRolesCommand(
  context: DiscordAppContext,
  interaction: GuardInteraction
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "add") {
    const role = interaction.options.getRole("role", true);
    await context.protectedRoleRepository.add(interaction.guildId, role.id);
    await context.auditRepository.append(interaction.guildId, interaction.user.id, "role_added", {
      roleId: role.id
    });
    await interaction.reply(ephemeral(`Added protected role <@&${role.id}>.`));
    return;
  }

  if (subcommand === "remove") {
    const role = interaction.options.getRole("role", true);
    await context.protectedRoleRepository.remove(interaction.guildId, role.id);
    await context.auditRepository.append(interaction.guildId, interaction.user.id, "role_removed", {
      roleId: role.id
    });
    await interaction.reply(ephemeral(`Removed protected role <@&${role.id}>.`));
    return;
  }

  if (subcommand === "list") {
    const roles = await context.protectedRoleRepository.listByGuildId(interaction.guildId);
    await interaction.reply(
      ephemeral(
        roles.length === 0
          ? "No protected roles configured."
          : `Protected roles:\n${roles.map((entry) => `<@&${entry.roleId}>`).join("\n")}`
      )
    );
    return;
  }

  if (subcommand === "risk") {
    const role = interaction.options.getRole("role", true);
    const risk = interaction.options.getString("risk", true) as
      "IGNORE" | "NORMAL" | "HIGH" | "CRITICAL";
    await context.roleRiskProfileRepository.upsert(interaction.guildId, role.id, risk);
    await context.auditRepository.append(
      interaction.guildId,
      interaction.user.id,
      "role_risk_set",
      {
        roleId: role.id,
        risk
      }
    );
    await interaction.reply(ephemeral(`Set <@&${role.id}> risk level to ${risk}.`));
    return;
  }

  const value = interaction.options.getString("value", true) as RoleDetectionMode;
  const settings = await getGuildSettings(context, interaction.guildId);
  const nextSettings: GuildSettings = {
    ...settings,
    roleDetectionMode: value,
    updatedAt: context.clock.now()
  };

  await saveGuildSettings(context, nextSettings, interaction.user.id, "role_mode_set", { value });
  const warning = value === "ALL_ROLES" ? "\nWarning: ALL_ROLES can increase false positives." : "";
  await interaction.reply(ephemeral(`Role detection mode set to ${value}.${warning}`));
}

async function handleChannelsCommand(
  context: DiscordAppContext,
  interaction: GuardInteraction
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "set") {
    const channel = interaction.options.getChannel("channel", true);
    const policy = interaction.options.getString("policy", true) as ChannelPolicy;
    await context.channelPolicyRepository.upsert(interaction.guildId, channel.id, policy);
    await context.auditRepository.append(
      interaction.guildId,
      interaction.user.id,
      "channel_policy_set",
      {
        channelId: channel.id,
        policy
      }
    );
    await interaction.reply(ephemeral(`Set <#${channel.id}> to ${policy}.`));
    return;
  }

  if (subcommand === "remove") {
    const channel = interaction.options.getChannel("channel", true);
    await context.channelPolicyRepository.remove(interaction.guildId, channel.id);
    await context.auditRepository.append(
      interaction.guildId,
      interaction.user.id,
      "channel_policy_removed",
      {
        channelId: channel.id
      }
    );
    await interaction.reply(ephemeral(`Removed override for <#${channel.id}>.`));
    return;
  }

  const entries = await context.channelPolicyRepository.listByGuildId(interaction.guildId);
  await interaction.reply(
    ephemeral(
      entries.length === 0
        ? "No channel overrides configured."
        : `Channel overrides:\n${entries.map((entry) => `<#${entry.channelId}> -> ${entry.policy}`).join("\n")}`
    )
  );
}

async function handlePunishmentCommand(
  context: DiscordAppContext,
  interaction: GuardInteraction
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();
  const settings = await getGuildSettings(context, interaction.guildId);

  if (subcommand === "member") {
    const type = interaction.options.getString("type", true) as PunishmentType;
    const duration = interaction.options.getInteger("duration_seconds");
    const nextSettings: GuildSettings = {
      ...settings,
      memberPunishment: type,
      memberTimeoutSeconds:
        type === "TIMEOUT"
          ? clampTimeoutSeconds(duration ?? settings.memberTimeoutSeconds ?? 86_400)
          : null,
      updatedAt: context.clock.now()
    };

    await saveGuildSettings(context, nextSettings, interaction.user.id, "member_punishment_set", {
      type,
      durationSeconds: nextSettings.memberTimeoutSeconds
    });
    await interaction.reply(
      ephemeral(
        `Member punishment set to ${formatPunishment(type, nextSettings.memberTimeoutSeconds)}.`
      )
    );
    return;
  }

  if (subcommand === "bot") {
    const type = interaction.options.getString("type", true) as PunishmentType;
    const nextSettings: GuildSettings = {
      ...settings,
      botPunishment: type,
      updatedAt: context.clock.now()
    };

    await saveGuildSettings(context, nextSettings, interaction.user.id, "bot_punishment_set", {
      type
    });
    await interaction.reply(ephemeral(`Bot punishment set to ${type}.`));
    return;
  }

  const mode = interaction.options.getString("mode", true) as GuildSettings["escalationMode"];
  const nextSettings: GuildSettings = {
    ...settings,
    escalationMode: mode,
    updatedAt: context.clock.now()
  };

  if (mode === "CUSTOM") {
    await context.escalationRepository.replaceAll(
      interaction.guildId,
      createDefaultCustomEscalationSteps(interaction.guildId)
    );
  }

  await saveGuildSettings(context, nextSettings, interaction.user.id, "escalation_mode_set", {
    mode
  });
  await interaction.reply(ephemeral(`Escalation mode set to ${mode}.`));
}

async function handleDryRunCommand(
  context: DiscordAppContext,
  interaction: GuardInteraction
): Promise<void> {
  const enabled = interaction.options.getSubcommand() === "enable";
  const settings = await getGuildSettings(context, interaction.guildId);
  const nextSettings: GuildSettings = {
    ...settings,
    dryRunEnabled: enabled,
    updatedAt: context.clock.now()
  };

  await saveGuildSettings(context, nextSettings, interaction.user.id, "dry_run_set", { enabled });
  await interaction.reply(ephemeral(`Dry-run ${enabled ? "enabled" : "disabled"}.`));
}

async function handleDiagnoseCommand(
  context: DiscordAppContext,
  interaction: GuardInteraction
): Promise<void> {
  const settings = await getGuildSettings(context, interaction.guildId);
  await interaction.reply(ephemeral(diagnosePermissions(interaction, settings.logChannelId)));
}

async function handleTestCommand(
  context: DiscordAppContext,
  interaction: GuardInteraction
): Promise<void> {
  const settings = await getGuildSettings(context, interaction.guildId);
  const escalationPreview =
    settings.escalationMode === "PRESET"
      ? choosePresetEscalation(2)
      : {
          punishmentType: settings.memberPunishment,
          durationSeconds: settings.memberTimeoutSeconds
        };
  await interaction.reply(
    ephemeral(
      [
        `${product.name} command path is working.`,
        `Current mode: ${settings.operationMode}`,
        `Role detection: ${settings.roleDetectionMode}`,
        `Escalation preview: ${formatPunishment(escalationPreview.punishmentType, escalationPreview.durationSeconds)}`
      ].join("\n")
    )
  );
}

async function handleIncidentsCommand(
  context: DiscordAppContext,
  interaction: GuardInteraction
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "recent") {
    const limit = interaction.options.getInteger("limit") ?? 10;
    const incidents = await context.incidentRepository.getRecent(interaction.guildId, limit);
    await interaction.reply(
      ephemeral(
        incidents.length === 0
          ? "No incidents recorded."
          : `Recent incidents:\n${incidents
              .map(
                (incident) =>
                  `${incident.createdAt.toISOString()} | ${incident.ruleId ?? "none"} | actor ${incident.actorId} | dry-run ${incident.dryRun ? "yes" : "no"}`
              )
              .join("\n")}`
      )
    );
    return;
  }

  if (subcommand === "user") {
    const user = interaction.options.getUser("user", true);
    const limit = interaction.options.getInteger("limit") ?? 10;
    const incidents = await context.incidentRepository.getByActor(
      interaction.guildId,
      user.id,
      limit
    );
    await interaction.reply(
      ephemeral(
        incidents.length === 0
          ? "No incidents recorded for that user."
          : `Incidents for ${user.id}:\n${incidents
              .map(
                (incident) => `${incident.createdAt.toISOString()} | ${incident.ruleId ?? "none"}`
              )
              .join("\n")}`
      )
    );
    return;
  }

  if (subcommand === "explain") {
    const incidentId = interaction.options.getString("incident_id", true);
    const incident = await context.incidentRepository.getById(interaction.guildId, incidentId);
    await interaction.reply(
      ephemeral(
        !incident
          ? "Incident not found."
          : [
              `Incident: ${incident.id}`,
              `Decision: ${incident.decision}`,
              `Rule: ${incident.ruleId ?? "none"}`,
              `Source: ${incident.eventSource}`,
              `Correlation: ${incident.correlationStage}`,
              `False positive: ${incident.falsePositive ? "yes" : "no"}`
            ].join("\n")
      )
    );
    return;
  }

  const stats = await context.incidentRepository.getStats(interaction.guildId);
  const byRule = Object.entries(stats.byRule)
    .map(([ruleId, count]) => `${ruleId}: ${count}`)
    .join("\n");
  await interaction.reply(
    ephemeral(
      [
        `Total incidents: ${stats.total}`,
        `False positives: ${stats.falsePositives}`,
        byRule ? `By rule:\n${byRule}` : "By rule: none"
      ].join("\n")
    )
  );
}

async function handleDataCommand(
  context: DiscordAppContext,
  interaction: GuardInteraction
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "export") {
    const payload = await context.incidentRepository.exportGuildData(interaction.guildId);
    const attachment = new AttachmentBuilder(
      Buffer.from(JSON.stringify(payload, null, 2), "utf8"),
      {
        name: `pingguard-export-${interaction.guildId}.json`
      }
    );

    await interaction.reply({
      content: "Guild-scoped PingGuard export.",
      allowedMentions: ALLOWED_MENTIONS,
      flags: MessageFlags.Ephemeral,
      files: [attachment]
    });
    return;
  }

  if (!isOwnerOnly(interaction)) {
    await interaction.reply(ephemeral("Only the guild owner can delete PingGuard data."));
    return;
  }

  await interaction.reply({
    content: t(
      (await getGuildSettings(context, interaction.guildId)).locale,
      "data.delete.confirm"
    ),
    allowedMentions: ALLOWED_MENTIONS,
    flags: MessageFlags.Ephemeral,
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            custom_id: dataDeleteCustomId(interaction.guildId, interaction.user.id, "confirm"),
            label: "Delete data",
            style: 4
          },
          {
            type: 2,
            custom_id: dataDeleteCustomId(interaction.guildId, interaction.user.id, "cancel"),
            label: "Cancel",
            style: 2
          }
        ]
      }
    ]
  });
}

async function handleResetCommand(
  context: DiscordAppContext,
  interaction: GuardInteraction
): Promise<void> {
  const current = await getGuildSettings(context, interaction.guildId);
  const replacement: GuildSettings = {
    ...buildDefaultGuildSettings(interaction.guildId, current.locale),
    createdAt: current.createdAt,
    updatedAt: context.clock.now()
  };

  await context.guildDataRepository.resetGuildConfiguration(replacement);
  context.settingsCache.invalidate(interaction.guildId);
  await context.auditRepository.append(
    interaction.guildId,
    interaction.user.id,
    "configuration_reset",
    {}
  );
  await refreshGuildGauge(context);

  await interaction.reply(ephemeral("PingGuard configuration reset to defaults."));
}

async function handleLanguageCommand(
  context: DiscordAppContext,
  interaction: GuardInteraction
): Promise<void> {
  const locale = interaction.options.getString("locale", true) as Locale;
  const settings = await getGuildSettings(context, interaction.guildId);
  const nextSettings: GuildSettings = {
    ...settings,
    locale,
    updatedAt: context.clock.now()
  };

  await saveGuildSettings(context, nextSettings, interaction.user.id, "language_set", { locale });
  await interaction.reply(ephemeral(`Language set to ${locale}.`));
}

async function handleHelpCommand(
  context: DiscordAppContext,
  interaction: GuardInteraction
): Promise<void> {
  const settings = await getGuildSettings(context, interaction.guildId);
  await interaction.reply(
    ephemeral(
      `${t(settings.locale, "help.body")}\nUse /guard status to inspect the active configuration.`
    )
  );
}
