import { performance } from "node:perf_hooks";

import type {
  ButtonInteraction,
  ChannelSelectMenuInteraction,
  ChatInputCommandInteraction,
  Interaction,
  Message,
  PartialMessage,
  MessageContextMenuCommandInteraction,
  RoleSelectMenuInteraction,
  StringSelectMenuInteraction
} from "discord.js";

import { MESSAGE_PROCESSING_BUDGET_MS } from "../../config/constants.js";
import type { ModerationAdapter } from "../../application/services/processMessageService.js";
import type { ActionPlan } from "../../domain/policy/types.js";
import type { ActionResult } from "../../application/services/actionTypes.js";
import { DiscordModerationAdapter } from "../adapters/actions.js";
import { mapDiscordMessage } from "../mappers/messageMapper.js";
import type { DiscordAppContext } from "../runtime.js";
import { handleInteractionCreate } from "../interactions/router.js";

type SupportedInteraction =
  | ChatInputCommandInteraction
  | MessageContextMenuCommandInteraction
  | ButtonInteraction
  | StringSelectMenuInteraction
  | RoleSelectMenuInteraction
  | ChannelSelectMenuInteraction;

class InstrumentedModerationAdapter implements ModerationAdapter {
  public constructor(
    private readonly inner: ModerationAdapter,
    private readonly context: DiscordAppContext
  ) {}

  public async deleteMessage(reason: string): Promise<ActionResult> {
    return this.observe("delete", () => this.inner.deleteMessage(reason));
  }

  public async applyPunishment(plan: ActionPlan, reason: string): Promise<ActionResult> {
    return this.observe("punishment", () => this.inner.applyPunishment(plan, reason));
  }

  public async sendModLog(
    payload: Parameters<ModerationAdapter["sendModLog"]>[0]
  ): Promise<ActionResult> {
    return this.observe("mod_log", () => this.inner.sendModLog(payload));
  }

  private async observe(action: string, work: () => Promise<ActionResult>): Promise<ActionResult> {
    const startedAt = performance.now();
    try {
      const result = await work();
      this.context.metrics.observeActionDuration(action, (performance.now() - startedAt) / 1_000);
      return result;
    } catch (error) {
      this.context.metrics.observeActionDuration(action, (performance.now() - startedAt) / 1_000);
      throw error;
    }
  }
}

function isSupportedInteraction(interaction: Interaction): interaction is SupportedInteraction {
  return (
    interaction.isChatInputCommand() ||
    interaction.isMessageContextMenuCommand() ||
    interaction.isButton() ||
    interaction.isStringSelectMenu() ||
    interaction.isRoleSelectMenu() ||
    interaction.isChannelSelectMenu()
  );
}

async function handleMessageCreate(context: DiscordAppContext, message: Message): Promise<void> {
  await handleMappedMessage(context, message, "CREATE");
}

function attachmentSignature(message: Message): string {
  return [...message.attachments.values()]
    .map(
      (attachment) =>
        `${attachment.name ?? "unknown"}:${attachment.contentType ?? "unknown"}:${attachment.size ?? 0}`
    )
    .sort()
    .join("|");
}

function embedSignature(message: Message): string {
  return message.embeds
    .map((embed) => `${Boolean(embed.image)}:${Boolean(embed.thumbnail)}`)
    .join("|");
}

function hasRelevantFeatureChange(
  previousMessage: Message | PartialMessage,
  currentMessage: Message
): boolean {
  if (previousMessage.partial) {
    return true;
  }

  return (
    previousMessage.content !== currentMessage.content ||
    previousMessage.mentions.everyone !== currentMessage.mentions.everyone ||
    [...previousMessage.mentions.roles.keys()].join(",") !==
      [...currentMessage.mentions.roles.keys()].join(",") ||
    previousMessage.stickers.size !== currentMessage.stickers.size ||
    attachmentSignature(previousMessage) !== attachmentSignature(currentMessage) ||
    embedSignature(previousMessage) !== embedSignature(currentMessage)
  );
}

async function resolveUpdatedMessage(message: Message | PartialMessage): Promise<Message | null> {
  if (!message.partial) {
    return message;
  }

  return message.fetch().catch(() => null);
}

async function handleMessageUpdate(
  context: DiscordAppContext,
  previousMessage: Message | PartialMessage,
  nextMessage: Message | PartialMessage
): Promise<void> {
  if (!nextMessage.inGuild()) {
    return;
  }

  const resolved = await resolveUpdatedMessage(nextMessage);
  if (!resolved || !resolved.inGuild()) {
    return;
  }

  if (!hasRelevantFeatureChange(previousMessage, resolved)) {
    return;
  }

  await handleMappedMessage(context, resolved, "UPDATE");
}

async function handleMappedMessage(
  context: DiscordAppContext,
  message: Message,
  eventSource: "CREATE" | "UPDATE"
): Promise<void> {
  if (!message.inGuild()) {
    return;
  }

  const selfUserId = context.client.user?.id;
  if (!selfUserId) {
    return;
  }

  context.metrics.recordMessageScanned();

  const mapped = mapDiscordMessage(message, selfUserId, eventSource);
  if (mapped.actor.actorKind === "SELF") {
    return;
  }

  const startedAt = performance.now();

  try {
    const outcome = await context.processMessageService.process({
      observedMessage: mapped.observedMessage,
      actor: mapped.actor,
      adapterFactory: (logChannelId) =>
        new InstrumentedModerationAdapter(
          new DiscordModerationAdapter(message, logChannelId),
          context
        )
    });

    const durationSeconds = (performance.now() - startedAt) / 1_000;
    context.metrics.observeDetectionDuration(durationSeconds, outcome !== null);

    if (outcome) {
      context.metrics.recordIncident(outcome.detection, mapped.actor.actorKind);

      if (outcome.plan.shouldDelete) {
        context.metrics.recordDelete(outcome.results.delete);
      }

      if (outcome.plan.shouldPunish) {
        context.metrics.recordPunishment(outcome.plan.punishmentType, outcome.results.punishment);
      }

      if (outcome.results.modLog.status === "FAILED") {
        context.metrics.recordActionFailure("mod_log", outcome.results.modLog.code);
        context.metrics.recordDiscordError("mod_log");
      }

      if (outcome.results.persistence.status === "FAILED") {
        context.metrics.recordActionFailure("persistence", outcome.results.persistence.code);
        context.metrics.recordDatabaseError("persistence");
      }
    }

    if (durationSeconds * 1_000 > MESSAGE_PROCESSING_BUDGET_MS) {
      context.logger.warn(
        {
          event: "message_processing_budget_exceeded",
          guildId: mapped.observedMessage.guildId,
          channelId: mapped.observedMessage.channelId,
          messageId: mapped.observedMessage.messageId,
          actorId: mapped.observedMessage.actorId,
          actorKind: mapped.actor.actorKind,
          durationMs: Math.round(durationSeconds * 1_000)
        },
        "Message processing exceeded budget"
      );
    }
  } catch (error) {
    context.metrics.recordDatabaseError("process_message");
    context.logger.error(
      {
        event: "message_processing_failed",
        guildId: mapped.observedMessage.guildId,
        channelId: mapped.observedMessage.channelId,
        messageId: mapped.observedMessage.messageId,
        actorId: mapped.observedMessage.actorId,
        actorKind: mapped.actor.actorKind,
        error: error instanceof Error ? error.message : "Unknown processing error"
      },
      "Failed to process message"
    );
  }
}

export function registerDiscordEventHandlers(context: DiscordAppContext): void {
  context.client.once("ready", () => {
    context.readiness.markDiscordReady(true);
    void context.settingsRepository
      .countEnabledGuilds()
      .then((enabledGuilds) => {
        context.metrics.guildsTotal.set(enabledGuilds);
      })
      .catch((error: unknown) => {
        context.metrics.recordDatabaseError("guild_count");
        context.logger.warn(
          {
            event: "guild_count_failed",
            error: error instanceof Error ? error.message : "Unknown guild count error"
          },
          "Failed to refresh enabled guild gauge"
        );
      });

    context.logger.info(
      {
        event: "discord_ready",
        shardId: 0,
        userId: context.client.user?.id ?? null
      },
      "Discord client is ready"
    );
  });

  context.client.on("messageCreate", (message) => {
    void handleMessageCreate(context, message);
  });

  context.client.on("interactionCreate", (interaction) => {
    if (!isSupportedInteraction(interaction)) {
      return;
    }

    void handleInteractionCreate(context, interaction).catch((error: unknown) => {
      context.metrics.recordDiscordError("interaction_handler");
      context.logger.error(
        {
          event: "interaction_handler_failed",
          error: error instanceof Error ? error.message : "Unknown interaction error",
          interactionId: interaction.id
        },
        "Interaction handler failed"
      );
    });
  });

  context.client.on("messageUpdate", (previousMessage, nextMessage) => {
    void handleMessageUpdate(context, previousMessage, nextMessage);
  });

  context.client.on("guildDelete", (guild) => {
    const graceUntil = new Date(
      context.clock.now().getTime() + context.env.RETENTION_GRACE_HOURS * 60 * 60 * 1_000
    );

    void context.guildDataRepository
      .markGuildForDeletion(guild.id, graceUntil)
      .catch((error: unknown) => {
        context.metrics.recordDatabaseError("mark_guild_for_deletion");
        context.logger.warn(
          {
            event: "mark_guild_for_deletion_failed",
            guildId: guild.id,
            error: error instanceof Error ? error.message : "Unknown guild deletion error"
          },
          "Failed to mark guild for deletion"
        );
      });
  });

  context.client.on("error", (error) => {
    context.metrics.recordDiscordError("client_error");
    context.logger.error(
      {
        event: "discord_client_error",
        error: error.message
      },
      "Discord client error"
    );
  });

  context.client.on("warn", (message) => {
    context.logger.warn(
      {
        event: "discord_client_warn",
        message
      },
      "Discord client warning"
    );
  });
}
