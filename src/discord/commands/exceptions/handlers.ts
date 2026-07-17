import { randomUUID } from "node:crypto";

import type { ActorPolicy, ChannelGuardMode } from "../../../domain/policy/types.js";
import { ephemeral, isOwnerOnly, type GuardInteraction } from "../../interactions/shared.js";
import type { DiscordAppContext } from "../../runtime.js";
import { resolveActorTarget, resolveScope } from "../policyOptionResolvers.js";

function actorPolicyFromMode(mode: string): ActorPolicy | null {
  switch (mode) {
    case "MONITOR_ONLY":
      return "MONITOR_ONLY";
    case "NO_PUNISH":
      return "NO_PUNISH";
    case "FULL_BYPASS":
      return "FULL_BYPASS";
    default:
      return null;
  }
}

export async function handleExceptionsCommand(
  context: DiscordAppContext,
  interaction: GuardInteraction
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "list") {
    const [actorPolicies, channelPolicies, categoryPolicies] = await Promise.all([
      context.actorPolicyRepository.listByGuildId(interaction.guildId),
      context.channelPolicyRepository.listByGuildId(interaction.guildId),
      context.categoryPolicyRepository.listByGuildId(interaction.guildId)
    ]);
    const actorLines = actorPolicies
      .filter((entry) => entry.policy !== "SCOPED_PUBLISHER")
      .map(
        (entry) =>
          `${entry.policy}: ${entry.targetType} ${entry.targetId} -> ${entry.scopeType}${entry.scopeId ? ` (${entry.scopeId})` : ""}`
      );
    const channelLines = channelPolicies.map((entry) => `<#${entry.channelId}> -> ${entry.policy}`);
    const categoryLines = categoryPolicies.map(
      (entry) => `category ${entry.categoryId} -> ${entry.policy}`
    );

    await interaction.reply(
      ephemeral(
        [...actorLines, ...channelLines, ...categoryLines].length === 0
          ? "No exceptions configured."
          : `Exceptions:\n${[...actorLines, ...channelLines, ...categoryLines].join("\n")}`
      )
    );
    return;
  }

  const mode = interaction.options.getString("mode");
  const channel = interaction.options.getChannel("channel");
  const category = interaction.options.getChannel("category");
  const target = resolveActorTarget(interaction);
  const scope = resolveScope(interaction);

  if (subcommand === "add") {
    if (channel) {
      await context.channelPolicyRepository.upsert(
        interaction.guildId,
        channel.id,
        mode as ChannelGuardMode
      );
      await interaction.reply(ephemeral(`Set <#${channel.id}> to ${mode}.`));
      return;
    }

    if (category) {
      await context.categoryPolicyRepository.upsert(
        interaction.guildId,
        category.id,
        mode as ChannelGuardMode
      );
      await interaction.reply(ephemeral(`Set category ${category.name} to ${mode}.`));
      return;
    }

    if (!target || !scope || !mode) {
      await interaction.reply(
        ephemeral("Select exactly one target and include the scope for actor exceptions.")
      );
      return;
    }

    const policy = actorPolicyFromMode(mode);
    if (!policy) {
      await interaction.reply(ephemeral("That mode only applies to channels or categories."));
      return;
    }

    if (policy === "FULL_BYPASS" && scope.scopeType === "GUILD" && !isOwnerOnly(interaction)) {
      await interaction.reply(
        ephemeral("Guild-wide FULL_BYPASS is owner-only because it disables automatic protection.")
      );
      return;
    }

    await context.actorPolicyRepository.upsert({
      id: randomUUID(),
      guildId: interaction.guildId,
      targetId: target.targetId,
      targetType: target.targetType,
      policy,
      scopeType: scope.scopeType,
      scopeId: scope.scopeId,
      expiresAt: null,
      createdAt: context.clock.now(),
      updatedAt: context.clock.now()
    });
    await interaction.reply(ephemeral(`Added ${policy} for ${target.label} in ${scope.label}.`));
    return;
  }

  if (channel) {
    await context.channelPolicyRepository.remove(interaction.guildId, channel.id);
    await interaction.reply(ephemeral(`Removed exception for <#${channel.id}>.`));
    return;
  }

  if (category) {
    await context.categoryPolicyRepository.remove(interaction.guildId, category.id);
    await interaction.reply(ephemeral(`Removed exception for category ${category.name}.`));
    return;
  }

  if (!target || !scope) {
    await interaction.reply(ephemeral("Select exactly one target and scope to remove."));
    return;
  }

  await context.actorPolicyRepository.remove(
    interaction.guildId,
    target.targetId,
    target.targetType,
    scope.scopeType,
    scope.scopeId
  );
  await interaction.reply(ephemeral(`Removed actor exception for ${target.label}.`));
}
