import { ephemeral, type GuardInteraction } from "../../interactions/shared.js";
import type { DiscordAppContext } from "../../runtime.js";

export async function handleRaidCommand(
  context: DiscordAppContext,
  interaction: GuardInteraction
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === "stop") {
    await context.raidSessionService.stopGuildSessions(interaction.guildId, context.clock.now());
    await context.auditRepository.append(interaction.guildId, interaction.user.id, "raid_stop", {});
    await interaction.reply(ephemeral("Stopped active raid sessions."));
    return;
  }

  const sessions = await context.raidSessionRepository.listActive(
    interaction.guildId,
    context.clock.now()
  );
  await interaction.reply(
    ephemeral(
      sessions.length === 0
        ? "No active raid sessions."
        : `Active raid sessions:\n${sessions
            .map(
              (session) =>
                `${session.id} | actors ${session.actorIds.length} | channels ${session.channelIds.length} | expires ${session.expiresAt.toISOString()}`
            )
            .join("\n")}`
    )
  );
}
