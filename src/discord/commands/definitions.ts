import {
  type RESTPostAPIApplicationCommandsJSONBody,
  ApplicationCommandType,
  ChannelType,
  ContextMenuCommandBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder
} from "discord.js";

export const GUARD_COMMAND_NAME = "guard";
export const ANALYZE_MESSAGE_COMMAND_NAME = "Analyze with PingGuard";

export function buildApplicationCommands(): readonly RESTPostAPIApplicationCommandsJSONBody[] {
  const guard = new SlashCommandBuilder()
    .setName(GUARD_COMMAND_NAME)
    .setDescription("Configure and inspect PingGuard")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) =>
      subcommand.setName("setup").setDescription("Run the guided PingGuard setup")
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("status").setDescription("Show current PingGuard status")
    )
    .addSubcommandGroup((group) =>
      group
        .setName("mode")
        .setDescription("Set operation mode")
        .addSubcommand((subcommand) =>
          subcommand
            .setName("set")
            .setDescription("Set the guild-wide operation mode")
            .addStringOption((option) =>
              option
                .setName("operation")
                .setDescription("Desired operation mode")
                .setRequired(true)
                .addChoices(
                  { name: "ENFORCE", value: "ENFORCE" },
                  { name: "DELETE_ONLY", value: "DELETE_ONLY" },
                  { name: "MONITOR", value: "MONITOR" }
                )
            )
        )
    )
    .addSubcommandGroup((group) =>
      group
        .setName("roles")
        .setDescription("Manage protected roles")
        .addSubcommand((subcommand) =>
          subcommand
            .setName("add")
            .setDescription("Add a protected role")
            .addRoleOption((option) =>
              option.setName("role").setDescription("Role to protect").setRequired(true)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("remove")
            .setDescription("Remove a protected role")
            .addRoleOption((option) =>
              option.setName("role").setDescription("Role to remove").setRequired(true)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand.setName("list").setDescription("List protected roles")
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("mode")
            .setDescription("Set role detection mode")
            .addStringOption((option) =>
              option
                .setName("value")
                .setDescription("Role detection mode")
                .setRequired(true)
                .addChoices(
                  { name: "MANUAL", value: "MANUAL" },
                  { name: "ALL_ROLES", value: "ALL_ROLES" }
                )
            )
        )
    )
    .addSubcommandGroup((group) =>
      group
        .setName("channels")
        .setDescription("Manage per-channel policies")
        .addSubcommand((subcommand) =>
          subcommand
            .setName("set")
            .setDescription("Set a channel policy")
            .addChannelOption((option) =>
              option
                .setName("channel")
                .setDescription("Channel to configure")
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            )
            .addStringOption((option) =>
              option
                .setName("policy")
                .setDescription("Policy to apply")
                .setRequired(true)
                .addChoices(
                  { name: "ENFORCE", value: "ENFORCE" },
                  { name: "DELETE_ONLY", value: "DELETE_ONLY" },
                  { name: "MONITOR", value: "MONITOR" },
                  { name: "DISABLED", value: "DISABLED" }
                )
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("remove")
            .setDescription("Remove a channel override")
            .addChannelOption((option) =>
              option
                .setName("channel")
                .setDescription("Channel to clear")
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand.setName("list").setDescription("List channel overrides")
        )
    )
    .addSubcommandGroup((group) =>
      group
        .setName("punishment")
        .setDescription("Manage punishments and escalation")
        .addSubcommand((subcommand) =>
          subcommand
            .setName("member")
            .setDescription("Set the default member punishment")
            .addStringOption((option) =>
              option
                .setName("type")
                .setDescription("Punishment type")
                .setRequired(true)
                .addChoices(
                  { name: "NONE", value: "NONE" },
                  { name: "TIMEOUT", value: "TIMEOUT" },
                  { name: "KICK", value: "KICK" },
                  { name: "BAN", value: "BAN" }
                )
            )
            .addIntegerOption((option) =>
              option
                .setName("duration_seconds")
                .setDescription("Timeout length in seconds when TIMEOUT is selected")
                .setMinValue(60)
                .setMaxValue(2_419_200)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("bot")
            .setDescription("Set the default bot punishment")
            .addStringOption((option) =>
              option
                .setName("type")
                .setDescription("Punishment type")
                .setRequired(true)
                .addChoices(
                  { name: "NONE", value: "NONE" },
                  { name: "KICK", value: "KICK" },
                  { name: "BAN", value: "BAN" }
                )
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("escalation")
            .setDescription("Set escalation mode")
            .addStringOption((option) =>
              option
                .setName("mode")
                .setDescription("Escalation mode")
                .setRequired(true)
                .addChoices(
                  { name: "OFF", value: "OFF" },
                  { name: "PRESET", value: "PRESET" },
                  { name: "CUSTOM", value: "CUSTOM" }
                )
            )
        )
    )
    .addSubcommandGroup((group) =>
      group
        .setName("dry-run")
        .setDescription("Toggle dry-run")
        .addSubcommand((subcommand) =>
          subcommand.setName("enable").setDescription("Enable dry-run mode")
        )
        .addSubcommand((subcommand) =>
          subcommand.setName("disable").setDescription("Disable dry-run mode")
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("diagnose").setDescription("Check setup and permissions")
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("test").setDescription("Run a lightweight runtime self-check")
    )
    .addSubcommandGroup((group) =>
      group
        .setName("incidents")
        .setDescription("Inspect stored incidents")
        .addSubcommand((subcommand) =>
          subcommand
            .setName("recent")
            .setDescription("Show recent incidents")
            .addIntegerOption((option) =>
              option
                .setName("limit")
                .setDescription("Number of incidents to show")
                .setMinValue(1)
                .setMaxValue(20)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("user")
            .setDescription("Show incidents for one user")
            .addUserOption((option) =>
              option.setName("user").setDescription("User to inspect").setRequired(true)
            )
            .addIntegerOption((option) =>
              option
                .setName("limit")
                .setDescription("Number of incidents to show")
                .setMinValue(1)
                .setMaxValue(20)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand.setName("stats").setDescription("Show incident statistics")
        )
    )
    .addSubcommandGroup((group) =>
      group
        .setName("data")
        .setDescription("Export or delete guild data")
        .addSubcommand((subcommand) =>
          subcommand.setName("export").setDescription("Export guild-scoped PingGuard data")
        )
        .addSubcommand((subcommand) =>
          subcommand.setName("delete").setDescription("Delete all guild-scoped PingGuard data")
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("reset").setDescription("Reset PingGuard configuration to defaults")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("language")
        .setDescription("Set the PingGuard language")
        .addStringOption((option) =>
          option
            .setName("locale")
            .setDescription("Locale to use")
            .setRequired(true)
            .addChoices({ name: "English", value: "en" }, { name: "Русский", value: "ru" })
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("help").setDescription("Show PingGuard help")
    );

  const analyzeMessage = new ContextMenuCommandBuilder()
    .setName(ANALYZE_MESSAGE_COMMAND_NAME)
    .setType(ApplicationCommandType.Message)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

  return [guard.toJSON(), analyzeMessage.toJSON()];
}
