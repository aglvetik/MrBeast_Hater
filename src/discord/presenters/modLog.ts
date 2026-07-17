import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type MessageMentionOptions
} from "discord.js";

import { ALLOWED_MENTIONS } from "../../config/constants.js";
import { product } from "../../config/product.js";
import type { ModLogPayload } from "../../application/services/processMessageService.js";

export interface PresentedModLog {
  readonly embeds: [EmbedBuilder];
  readonly components: readonly ActionRowBuilder<ButtonBuilder>[];
  readonly allowedMentions: MessageMentionOptions;
}

function summarizeSignals(payload: ModLogPayload): string {
  return (
    payload.detection.signals.map((signal) => `${signal.id} (${signal.weight})`).join(", ") ||
    "none"
  );
}

function summarizeMentions(payload: ModLogPayload): string {
  return payload.detection.protectedMentions
    .map((mention) => {
      switch (mention.kind) {
        case "EVERYONE":
          return "@everyone";
        case "HERE":
          return "@here";
        case "ROLE":
          return mention.roleId ? `<@&${mention.roleId}>` : "role";
      }
    })
    .join(", ");
}

function describeAction(payload: ModLogPayload): string {
  if (payload.plan.decision === "QUARANTINE" || payload.plan.decision === "ENFORCE") {
    return payload.plan.punishmentDurationSeconds !== null
      ? `${payload.plan.decision.toLowerCase()} ${payload.plan.punishmentType.toLowerCase()} ${payload.plan.punishmentDurationSeconds}s`
      : `${payload.plan.decision.toLowerCase()} ${payload.plan.punishmentType.toLowerCase()}`;
  }

  return payload.plan.decision.toLowerCase();
}

function actorProfileLink(payload: ModLogPayload): string {
  return `[${payload.actor.actorId}](https://discord.com/users/${payload.actor.actorId})`;
}

function actionButtonId(
  action:
    | "remove-timeout"
    | "false-positive"
    | "open-settings"
    | "allow-user-channel"
    | "no-punish-user"
    | "ignore-channel",
  payload: ModLogPayload
): string {
  return `pingguard:${action}:${payload.observedMessage.guildId}:${payload.incidentId}:${payload.observedMessage.channelId}`;
}

export function presentModLog(payload: ModLogPayload): PresentedModLog {
  const embed = new EmbedBuilder()
    .setColor(product.primaryColor)
    .setTitle(`${product.name} incident ${payload.incidentId}`)
    .setDescription(
      [
        `Actor: ${actorProfileLink(payload)} (${payload.actor.actorKind})`,
        `Channel: <#${payload.observedMessage.channelId}>`,
        `Rule: ${payload.detection.ruleId ?? "none"} (${payload.detection.confidence})`,
        `Decision: ${describeAction(payload)}`,
        `Score: ${payload.plan.explanation.score}`,
        `Correlation: ${payload.plan.explanation.correlationStage}`
      ].join("\n")
    )
    .addFields(
      {
        name: "Signals",
        value: summarizeSignals(payload),
        inline: false
      },
      {
        name: "Protected mentions",
        value: summarizeMentions(payload) || "none",
        inline: false
      },
      {
        name: "Media",
        value: [
          `images ${payload.detection.media.imageAttachments}`,
          `gifs ${payload.detection.media.gifAttachments}`,
          `videos ${payload.detection.media.videoAttachments}`,
          `embeds ${payload.detection.media.embedImages + payload.detection.media.embedThumbnails}`,
          `stickers ${payload.detection.media.stickers}`
        ].join(" | "),
        inline: false
      },
      {
        name: "Publisher / exemptions",
        value: payload.plan.actorPolicy ?? "none",
        inline: true
      },
      {
        name: "Channel policy",
        value: payload.plan.channelPolicy,
        inline: true
      },
      {
        name: "Activity",
        value: payload.plan.explanation.activityClass,
        inline: true
      },
      {
        name: "Delete result",
        value: `${payload.results.delete.status}: ${payload.results.delete.code}`,
        inline: true
      },
      {
        name: "Punishment result",
        value: `${payload.results.punishment.status}: ${payload.results.punishment.code}`,
        inline: true
      },
      {
        name: "Policy caps",
        value: payload.plan.policyCaps.join(", ") || "none",
        inline: true
      },
      {
        name: "Previous incidents",
        value: `${payload.previousIncidentCount}`,
        inline: true
      }
    )
    .setTimestamp(payload.happenedAt);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(actionButtonId("remove-timeout", payload))
      .setLabel("Remove timeout")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(actionButtonId("false-positive", payload))
      .setLabel("Mark false positive")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(actionButtonId("allow-user-channel", payload))
      .setLabel("Allow user here")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(actionButtonId("no-punish-user", payload))
      .setLabel("No-punish here")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(actionButtonId("ignore-channel", payload))
      .setLabel("Ignore channel")
      .setStyle(ButtonStyle.Danger)
  );

  const settingsRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(actionButtonId("open-settings", payload))
      .setLabel("Open settings")
      .setStyle(ButtonStyle.Primary)
  );

  return {
    embeds: [embed],
    components: [row, settingsRow],
    allowedMentions: ALLOWED_MENTIONS
  };
}
