import { PermissionFlagsBits, type Message } from "discord.js";

import type { ObservedMessage } from "../../domain/detection/types.js";
import type { ActorContext, ActorKind } from "../../domain/policy/types.js";

export interface DiscordMappedMessage {
  readonly observedMessage: ObservedMessage;
  readonly actor: ActorContext;
}

export function mapDiscordMessage(
  message: Message<true>,
  selfUserId: string
): DiscordMappedMessage {
  const actorKind = determineActorKind(message, selfUserId);
  const mentionedHere = /@here/u.test(message.content);

  return {
    observedMessage: {
      guildId: message.guildId,
      channelId: message.channelId,
      messageId: message.id,
      actorId: actorKind === "WEBHOOK" ? (message.webhookId as string) : message.author.id,
      content: message.content,
      mentionedEveryone: message.mentions.everyone && !mentionedHere,
      mentionedHere,
      mentionedRoleIds: [...message.mentions.roles.keys()],
      attachments: [...message.attachments.values()].map((attachment) => ({
        contentType: attachment.contentType ?? null,
        fileName: attachment.name ?? null
      })),
      embeds: message.embeds.map((embed) => ({
        hasImage: Boolean(embed.image),
        hasThumbnail: Boolean(embed.thumbnail)
      })),
      stickerCount: message.stickers.size,
      createdTimestamp: message.createdTimestamp
    },
    actor: {
      actorId: actorKind === "WEBHOOK" ? (message.webhookId as string) : message.author.id,
      actorKind,
      roleIds: [...(message.member?.roles.cache.keys() ?? [])],
      isAdministrator: message.member?.permissions.has(PermissionFlagsBits.Administrator) ?? false,
      isGuildOwner: message.author.id === message.guild.ownerId
    }
  };
}

function determineActorKind(message: Message<true>, selfUserId: string): ActorKind {
  if (message.author.id === selfUserId) {
    return "SELF";
  }

  if (message.webhookId) {
    return "WEBHOOK";
  }

  if (message.author.bot) {
    return "BOT";
  }

  return "USER";
}
