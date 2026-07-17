import { ChannelType, PermissionFlagsBits, type Message } from "discord.js";

import type { ObservedMessage } from "../../domain/detection/types.js";
import type { ActorContext, ActorKind } from "../../domain/policy/types.js";

export interface DiscordMappedMessage {
  readonly observedMessage: ObservedMessage;
  readonly actor: ActorContext;
}

export function mapDiscordMessage(
  message: Message<true>,
  selfUserId: string,
  eventSource: ObservedMessage["eventSource"] = "CREATE"
): DiscordMappedMessage {
  const actorKind = determineActorKind(message, selfUserId);
  const mentionedHere = /@here/u.test(message.content);
  const channel = message.channel;
  const parentChannel = channel.isThread() ? channel.parent : null;
  const effectiveChannel = parentChannel ?? channel;
  const parentCategory = "parentId" in effectiveChannel ? effectiveChannel.parent : null;
  const permissionTargets = message.guild.roles.everyone;
  const sendAllowed = effectiveChannel
    .permissionsFor(permissionTargets)
    ?.has(PermissionFlagsBits.SendMessages);
  const channelIsRestricted = sendAllowed === false;
  const effectiveType = effectiveChannel.type;

  return {
    observedMessage: {
      guildId: message.guildId,
      channelId: message.channelId,
      messageId: message.id,
      actorId: actorKind === "WEBHOOK" ? (message.webhookId as string) : message.author.id,
      eventSource,
      content: message.content,
      mentionedEveryone: message.mentions.everyone && !mentionedHere,
      mentionedHere,
      mentionedRoleIds: [...message.mentions.roles.keys()],
      attachments: [...message.attachments.values()].map((attachment) => ({
        contentType: attachment.contentType ?? null,
        fileName: attachment.name ?? null,
        sizeBytes: attachment.size ?? null
      })),
      embeds: message.embeds.map((embed) => ({
        hasImage: Boolean(embed.image),
        hasThumbnail: Boolean(embed.thumbnail)
      })),
      stickerCount: message.stickers.size,
      createdTimestamp: message.createdTimestamp,
      editedTimestamp: message.editedTimestamp ?? null,
      parentCategoryId: parentCategory?.id ?? null,
      parentChannelId: parentChannel?.id ?? null,
      categoryPosition: parentCategory?.position ?? null,
      parentPosition: parentChannel?.position ?? null,
      channelPosition: "position" in effectiveChannel ? effectiveChannel.position : null,
      channelIsAnnouncement:
        effectiveType === ChannelType.GuildAnnouncement ||
        effectiveType === ChannelType.AnnouncementThread,
      channelIsRestricted
    },
    actor: {
      actorId: actorKind === "WEBHOOK" ? (message.webhookId as string) : message.author.id,
      actorKind,
      roleIds: [...(message.member?.roles.cache.keys() ?? [])],
      isAdministrator: message.member?.permissions.has(PermissionFlagsBits.Administrator) ?? false,
      canManageGuild: message.member?.permissions.has(PermissionFlagsBits.ManageGuild) ?? false,
      isGuildOwner: message.author.id === message.guild.ownerId,
      createdTimestamp: message.author.createdTimestamp ?? null,
      joinedTimestamp: message.member?.joinedTimestamp ?? null
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
