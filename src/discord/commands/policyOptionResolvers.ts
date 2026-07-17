import type {
  ActorPolicyTargetType,
  ChannelGuardMode,
  MentionRiskLevel,
  PolicyScopeType
} from "../../domain/policy/types.js";
import type { GuardInteraction } from "../interactions/shared.js";

export interface ResolvedActorTarget {
  readonly targetId: string;
  readonly targetType: ActorPolicyTargetType;
  readonly label: string;
}

export function resolveActorTarget(interaction: GuardInteraction): ResolvedActorTarget | null {
  const user = interaction.options.getUser("user");
  const role = interaction.options.getRole("role");
  const botId = interaction.options.getString("bot_id");
  const webhookId = interaction.options.getString("webhook_id");
  const candidates = [user ? 1 : 0, role ? 1 : 0, botId ? 1 : 0, webhookId ? 1 : 0].reduce(
    (sum, value) => sum + value,
    0
  );

  if (candidates !== 1) {
    return null;
  }

  if (user) {
    return {
      targetId: user.id,
      targetType: "USER",
      label: `<@${user.id}>`
    };
  }

  if (role) {
    return {
      targetId: role.id,
      targetType: "ROLE",
      label: `<@&${role.id}>`
    };
  }

  if (botId) {
    return {
      targetId: botId,
      targetType: "BOT",
      label: `bot ${botId}`
    };
  }

  return {
    targetId: webhookId as string,
    targetType: "WEBHOOK",
    label: `webhook ${webhookId}`
  };
}

export function resolveScope(interaction: GuardInteraction): {
  readonly scopeType: PolicyScopeType;
  readonly scopeId: string | null;
  readonly label: string;
} | null {
  const scopeType = interaction.options.getString("scope") as PolicyScopeType | null;
  if (!scopeType) {
    return null;
  }

  if (scopeType === "GUILD") {
    return {
      scopeType,
      scopeId: null,
      label: "guild"
    };
  }

  if (scopeType === "CHANNEL") {
    const channel = interaction.options.getChannel("channel");
    return channel
      ? {
          scopeType,
          scopeId: channel.id,
          label: `<#${channel.id}>`
        }
      : null;
  }

  const category = interaction.options.getChannel("category");
  return category
    ? {
        scopeType,
        scopeId: category.id,
        label: `${category.name}`
      }
    : null;
}

export function resolveExceptionMode(
  value: string | null
): ChannelGuardMode | MentionRiskLevel | null {
  if (!value) {
    return null;
  }

  return value as ChannelGuardMode | MentionRiskLevel;
}
