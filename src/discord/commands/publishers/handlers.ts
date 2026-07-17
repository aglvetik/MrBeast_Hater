import { randomUUID } from "node:crypto";

import { ephemeral, type GuardInteraction } from "../../interactions/shared.js";
import type { DiscordAppContext } from "../../runtime.js";
import { resolveActorTarget, resolveScope } from "../policyOptionResolvers.js";

export async function handlePublishersCommand(
  context: DiscordAppContext,
  interaction: GuardInteraction
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "list") {
    const policies = await context.actorPolicyRepository.listByGuildId(interaction.guildId);
    const publishers = policies.filter((entry) => entry.policy === "SCOPED_PUBLISHER");
    await interaction.reply(
      ephemeral(
        publishers.length === 0
          ? "No scoped publishers configured."
          : `Scoped publishers:\n${publishers
              .map(
                (entry) =>
                  `${entry.targetType} ${entry.targetId} -> ${entry.scopeType}${entry.scopeId ? ` (${entry.scopeId})` : ""}`
              )
              .join("\n")}`
      )
    );
    return;
  }

  const target = resolveActorTarget(interaction);
  const scope = resolveScope(interaction);
  if (!target || !scope) {
    await interaction.reply(
      ephemeral("Select exactly one target and provide the matching scope details.")
    );
    return;
  }

  if (subcommand === "add") {
    await context.actorPolicyRepository.upsert({
      id: randomUUID(),
      guildId: interaction.guildId,
      targetId: target.targetId,
      targetType: target.targetType,
      policy: "SCOPED_PUBLISHER",
      scopeType: scope.scopeType,
      scopeId: scope.scopeId,
      expiresAt: null,
      createdAt: context.clock.now(),
      updatedAt: context.clock.now()
    });
    await context.auditRepository.append(
      interaction.guildId,
      interaction.user.id,
      "publisher_added",
      {
        targetId: target.targetId,
        targetType: target.targetType,
        scopeType: scope.scopeType,
        scopeId: scope.scopeId
      }
    );
    await interaction.reply(ephemeral(`Authorized ${target.label} in ${scope.label}.`));
    return;
  }

  await context.actorPolicyRepository.remove(
    interaction.guildId,
    target.targetId,
    target.targetType,
    scope.scopeType,
    scope.scopeId
  );
  await context.auditRepository.append(
    interaction.guildId,
    interaction.user.id,
    "publisher_removed",
    {
      targetId: target.targetId,
      targetType: target.targetType,
      scopeType: scope.scopeType,
      scopeId: scope.scopeId
    }
  );
  await interaction.reply(ephemeral(`Removed publisher authorization for ${target.label}.`));
}
