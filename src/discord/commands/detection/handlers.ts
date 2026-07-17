import { applyPreset } from "../../../domain/policy/presets.js";
import type { FirstStrikeBehavior, GuildSettings, Preset } from "../../../domain/policy/types.js";
import {
  ephemeral,
  getGuildSettings,
  saveGuildSettings,
  type GuardInteraction
} from "../../interactions/shared.js";
import type { DiscordAppContext } from "../../runtime.js";

export async function handleDetectionCommand(
  context: DiscordAppContext,
  interaction: GuardInteraction
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();
  const current = await getGuildSettings(context, interaction.guildId);

  if (subcommand === "preset") {
    const preset = interaction.options.getString("value", true) as Preset;
    const base = applyPreset(interaction.guildId, preset, current.locale);
    const nextSettings: GuildSettings = {
      ...current,
      ...base,
      enabled: current.enabled,
      logChannelId: current.logChannelId,
      createdAt: current.createdAt,
      updatedAt: context.clock.now()
    };
    await saveGuildSettings(context, nextSettings, interaction.user.id, "detection_preset_set", {
      preset
    });
    await interaction.reply(ephemeral(`Detection preset set to ${preset}.`));
    return;
  }

  if (subcommand === "first-strike") {
    const value = interaction.options.getString("value", true) as FirstStrikeBehavior;
    const nextSettings: GuildSettings = {
      ...current,
      firstStrikeBehavior: value,
      updatedAt: context.clock.now()
    };
    await saveGuildSettings(
      context,
      nextSettings,
      interaction.user.id,
      "first_strike_behavior_set",
      { value }
    );
    await interaction.reply(ephemeral(`First-strike behavior set to ${value}.`));
    return;
  }

  const nextSettings: GuildSettings = {
    ...current,
    observeThreshold: interaction.options.getInteger("observe") ?? current.observeThreshold,
    logOnlyThreshold: interaction.options.getInteger("log_only") ?? current.logOnlyThreshold,
    deleteThreshold: interaction.options.getInteger("delete") ?? current.deleteThreshold,
    quarantineThreshold:
      interaction.options.getInteger("quarantine") ?? current.quarantineThreshold,
    enforceThreshold: interaction.options.getInteger("enforce") ?? current.enforceThreshold,
    updatedAt: context.clock.now()
  };
  await saveGuildSettings(context, nextSettings, interaction.user.id, "thresholds_set", {
    observeThreshold: nextSettings.observeThreshold,
    logOnlyThreshold: nextSettings.logOnlyThreshold,
    deleteThreshold: nextSettings.deleteThreshold,
    quarantineThreshold: nextSettings.quarantineThreshold,
    enforceThreshold: nextSettings.enforceThreshold
  });
  await interaction.reply(ephemeral("Detection thresholds updated."));
}
