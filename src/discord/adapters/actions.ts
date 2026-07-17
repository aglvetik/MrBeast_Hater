import { PermissionFlagsBits, type GuildMember, type Message } from "discord.js";

import type { ActionPlan } from "../../domain/policy/types.js";
import type { ActionResult } from "../../application/services/actionTypes.js";
import type {
  ModLogPayload,
  ModerationAdapter
} from "../../application/services/processMessageService.js";
import { presentModLog } from "../presenters/modLog.js";

function success(code: string, message: string): ActionResult {
  return { status: "SUCCESS", code, message };
}

function failure(code: string, message: string): ActionResult {
  return { status: "FAILED", code, message };
}

export class DiscordModerationAdapter implements ModerationAdapter {
  public constructor(
    private readonly message: Message<true>,
    private readonly logChannelId: string | null
  ) {}

  public async deleteMessage(reason: string): Promise<ActionResult> {
    try {
      await this.message.delete();
      return success("message_deleted", reason);
    } catch {
      return failure("delete_failed", "Discord API delete request failed");
    }
  }

  public async applyPunishment(plan: ActionPlan, reason: string): Promise<ActionResult> {
    const target = this.message.member;

    if (!target) {
      return failure("member_unavailable", "Target member is unavailable");
    }

    switch (plan.punishmentType) {
      case "NONE":
        return success("no_punishment", "No punishment requested");
      case "TIMEOUT":
        return this.applyTimeout(target, plan.punishmentDurationSeconds, reason);
      case "KICK":
        return this.applyKick(target, reason);
      case "BAN":
        return this.applyBan(target, reason);
    }
  }

  public async sendModLog(payload: ModLogPayload): Promise<ActionResult> {
    if (!this.logChannelId) {
      return failure("log_channel_missing", "No moderation log channel configured");
    }

    try {
      const channel = await this.message.client.channels.fetch(this.logChannelId);
      if (!channel?.isTextBased() || !("send" in channel)) {
        return failure("log_channel_unavailable", "Configured log channel is unavailable");
      }

      const presented = presentModLog(payload);
      await channel.send(presented);
      return success("mod_log_sent", "Moderation log sent");
    } catch {
      return failure("mod_log_failed", "Discord API mod-log request failed");
    }
  }

  private async applyTimeout(
    target: GuildMember,
    durationSeconds: number | null,
    reason: string
  ): Promise<ActionResult> {
    if (durationSeconds === null) {
      return failure("timeout_duration_missing", "Timeout duration is missing");
    }

    if (target.user.bot) {
      return failure("timeout_not_allowed", "Bots cannot be timed out");
    }

    if (target.id === target.guild.ownerId) {
      return failure("owner_not_allowed", "Guild owner cannot be timed out");
    }

    if (target.permissions.has(PermissionFlagsBits.Administrator)) {
      return failure("administrator_not_allowed", "Administrators cannot be timed out");
    }

    if (!target.moderatable) {
      return failure("hierarchy_blocked", "Role hierarchy or permissions prevent timeout");
    }

    try {
      await target.timeout(durationSeconds * 1_000, reason);
      return success("timeout_applied", `Timeout applied for ${durationSeconds}s`);
    } catch {
      return failure("timeout_failed", "Discord API timeout request failed");
    }
  }

  private async applyKick(target: GuildMember, reason: string): Promise<ActionResult> {
    if (!target.kickable) {
      return failure("kick_not_allowed", "Role hierarchy or permissions prevent kick");
    }

    try {
      await target.kick(reason);
      return success("kick_applied", "Kick applied");
    } catch {
      return failure("kick_failed", "Discord API kick request failed");
    }
  }

  private async applyBan(target: GuildMember, reason: string): Promise<ActionResult> {
    if (!target.bannable) {
      return failure("ban_not_allowed", "Role hierarchy or permissions prevent ban");
    }

    try {
      await target.ban({ reason });
      return success("ban_applied", "Ban applied");
    } catch {
      return failure("ban_failed", "Discord API ban request failed");
    }
  }
}
