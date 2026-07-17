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
        .addSubcommand((subcommand) =>
          subcommand
            .setName("risk")
            .setDescription("Set the risk level for a protected role")
            .addRoleOption((option) =>
              option.setName("role").setDescription("Role to update").setRequired(true)
            )
            .addStringOption((option) =>
              option
                .setName("risk")
                .setDescription("Risk level for the role")
                .setRequired(true)
                .addChoices(
                  { name: "IGNORE", value: "IGNORE" },
                  { name: "NORMAL", value: "NORMAL" },
                  { name: "HIGH", value: "HIGH" },
                  { name: "CRITICAL", value: "CRITICAL" }
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
                  { name: "INHERIT", value: "INHERIT" },
                  { name: "ENFORCE", value: "ENFORCE" },
                  { name: "DELETE_ONLY", value: "DELETE_ONLY" },
                  { name: "MONITOR_ONLY", value: "MONITOR_ONLY" },
                  { name: "NO_PUNISH", value: "NO_PUNISH" },
                  { name: "IGNORE_ALL", value: "IGNORE_ALL" }
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
        .setName("publishers")
        .setDescription("Manage scoped publishers")
        .addSubcommand((subcommand) =>
          subcommand
            .setName("add")
            .setDescription("Authorize a scoped publisher")
            .addUserOption((option) => option.setName("user").setDescription("User to authorize"))
            .addRoleOption((option) => option.setName("role").setDescription("Role to authorize"))
            .addStringOption((option) =>
              option.setName("bot_id").setDescription("Bot user ID to authorize")
            )
            .addStringOption((option) =>
              option.setName("webhook_id").setDescription("Webhook ID to authorize")
            )
            .addStringOption((option) =>
              option
                .setName("scope")
                .setDescription("Authorization scope")
                .setRequired(true)
                .addChoices(
                  { name: "GUILD", value: "GUILD" },
                  { name: "CHANNEL", value: "CHANNEL" },
                  { name: "CATEGORY", value: "CATEGORY" }
                )
            )
            .addChannelOption((option) =>
              option
                .setName("channel")
                .setDescription("Channel scope when CHANNEL is selected")
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            )
            .addChannelOption((option) =>
              option
                .setName("category")
                .setDescription("Category scope when CATEGORY is selected")
                .addChannelTypes(ChannelType.GuildCategory)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("remove")
            .setDescription("Remove a scoped publisher")
            .addUserOption((option) => option.setName("user").setDescription("User to remove"))
            .addRoleOption((option) => option.setName("role").setDescription("Role to remove"))
            .addStringOption((option) =>
              option.setName("bot_id").setDescription("Bot user ID to remove")
            )
            .addStringOption((option) =>
              option.setName("webhook_id").setDescription("Webhook ID to remove")
            )
            .addStringOption((option) =>
              option
                .setName("scope")
                .setDescription("Authorization scope")
                .setRequired(true)
                .addChoices(
                  { name: "GUILD", value: "GUILD" },
                  { name: "CHANNEL", value: "CHANNEL" },
                  { name: "CATEGORY", value: "CATEGORY" }
                )
            )
            .addChannelOption((option) =>
              option
                .setName("channel")
                .setDescription("Channel scope when CHANNEL is selected")
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            )
            .addChannelOption((option) =>
              option
                .setName("category")
                .setDescription("Category scope when CATEGORY is selected")
                .addChannelTypes(ChannelType.GuildCategory)
            )
        )
        .addSubcommand((subcommand) =>
          subcommand.setName("list").setDescription("List scoped publishers")
        )
    )
    .addSubcommandGroup((group) =>
      group
        .setName("exceptions")
        .setDescription("Manage explicit exceptions")
        .addSubcommand((subcommand) =>
          subcommand
            .setName("add")
            .setDescription("Add an exception")
            .addChannelOption((option) =>
              option
                .setName("channel")
                .setDescription("Channel exception target")
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            )
            .addChannelOption((option) =>
              option
                .setName("category")
                .setDescription("Category exception target")
                .addChannelTypes(ChannelType.GuildCategory)
            )
            .addUserOption((option) =>
              option.setName("user").setDescription("User exception target")
            )
            .addRoleOption((option) =>
              option.setName("role").setDescription("Role exception target")
            )
            .addStringOption((option) =>
              option.setName("bot_id").setDescription("Bot user ID exception target")
            )
            .addStringOption((option) =>
              option.setName("webhook_id").setDescription("Webhook ID exception target")
            )
            .addStringOption((option) =>
              option
                .setName("mode")
                .setDescription("Exception mode")
                .setRequired(true)
                .addChoices(
                  { name: "MONITOR_ONLY", value: "MONITOR_ONLY" },
                  { name: "NO_PUNISH", value: "NO_PUNISH" },
                  { name: "DELETE_ONLY", value: "DELETE_ONLY" },
                  { name: "IGNORE_ALL", value: "IGNORE_ALL" },
                  { name: "FULL_BYPASS", value: "FULL_BYPASS" }
                )
            )
            .addStringOption((option) =>
              option
                .setName("scope")
                .setDescription("Actor scope when targeting a user/role/bot/webhook")
                .addChoices(
                  { name: "GUILD", value: "GUILD" },
                  { name: "CHANNEL", value: "CHANNEL" },
                  { name: "CATEGORY", value: "CATEGORY" }
                )
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("remove")
            .setDescription("Remove an exception")
            .addChannelOption((option) =>
              option
                .setName("channel")
                .setDescription("Channel exception target")
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            )
            .addChannelOption((option) =>
              option
                .setName("category")
                .setDescription("Category exception target")
                .addChannelTypes(ChannelType.GuildCategory)
            )
            .addUserOption((option) =>
              option.setName("user").setDescription("User exception target")
            )
            .addRoleOption((option) =>
              option.setName("role").setDescription("Role exception target")
            )
            .addStringOption((option) =>
              option.setName("bot_id").setDescription("Bot user ID exception target")
            )
            .addStringOption((option) =>
              option.setName("webhook_id").setDescription("Webhook ID exception target")
            )
            .addStringOption((option) =>
              option
                .setName("scope")
                .setDescription("Actor scope when targeting a user/role/bot/webhook")
                .addChoices(
                  { name: "GUILD", value: "GUILD" },
                  { name: "CHANNEL", value: "CHANNEL" },
                  { name: "CATEGORY", value: "CATEGORY" }
                )
            )
        )
        .addSubcommand((subcommand) =>
          subcommand.setName("list").setDescription("List configured exceptions")
        )
    )
    .addSubcommandGroup((group) =>
      group
        .setName("detection")
        .setDescription("Manage presets, first-strike behavior, and thresholds")
        .addSubcommand((subcommand) =>
          subcommand
            .setName("preset")
            .setDescription("Set the detection preset")
            .addStringOption((option) =>
              option
                .setName("value")
                .setDescription("Preset to apply")
                .setRequired(true)
                .addChoices(
                  { name: "BALANCED", value: "BALANCED" },
                  { name: "STRICT", value: "STRICT" },
                  { name: "CAUTIOUS", value: "CAUTIOUS" }
                )
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("first-strike")
            .setDescription("Set first-strike behavior")
            .addStringOption((option) =>
              option
                .setName("value")
                .setDescription("First-strike behavior")
                .setRequired(true)
                .addChoices(
                  { name: "DELETE_ON_FIRST", value: "DELETE_ON_FIRST" },
                  { name: "MONITOR_ON_FIRST", value: "MONITOR_ON_FIRST" },
                  {
                    name: "QUARANTINE_HIGH_CONFIDENCE",
                    value: "QUARANTINE_HIGH_CONFIDENCE"
                  }
                )
            )
        )
        .addSubcommand((subcommand) =>
          subcommand
            .setName("thresholds")
            .setDescription("Override decision thresholds")
            .addIntegerOption((option) =>
              option.setName("observe").setDescription("Observe threshold").setMinValue(0)
            )
            .addIntegerOption((option) =>
              option.setName("log_only").setDescription("Log-only threshold").setMinValue(0)
            )
            .addIntegerOption((option) =>
              option.setName("delete").setDescription("Delete threshold").setMinValue(0)
            )
            .addIntegerOption((option) =>
              option.setName("quarantine").setDescription("Quarantine threshold").setMinValue(0)
            )
            .addIntegerOption((option) =>
              option.setName("enforce").setDescription("Enforce threshold").setMinValue(0)
            )
        )
    )
    .addSubcommandGroup((group) =>
      group
        .setName("punishment")
        .setDescription("Manage punishments and escalation")
        .addSubcommand((subcommand) =>
          subcommand
            .setName("member")
            .setDescription("Set the default confirmed-attack member punishment")
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
        .setName("raid")
        .setDescription("Inspect or stop temporary raid sessions")
        .addSubcommand((subcommand) =>
          subcommand.setName("status").setDescription("Show active raid sessions")
        )
        .addSubcommand((subcommand) =>
          subcommand.setName("stop").setDescription("Stop all active raid sessions")
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
          subcommand
            .setName("explain")
            .setDescription("Explain one incident")
            .addStringOption((option) =>
              option
                .setName("incident_id")
                .setDescription("Incident ID to explain")
                .setRequired(true)
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
            .addChoices({ name: "English", value: "en" }, { name: "Russian", value: "ru" })
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
