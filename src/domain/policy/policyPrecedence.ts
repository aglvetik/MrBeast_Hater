import type {
  ActorContext,
  ChannelGuardMode,
  PolicyScopeType,
  ScopedActorPolicy
} from "./types.js";

export interface MessageScopeContext {
  readonly channelId: string;
  readonly categoryId: string | null;
}

function scopeMatches(
  scopeType: PolicyScopeType,
  scopeId: string | null,
  messageScope: MessageScopeContext
): boolean {
  switch (scopeType) {
    case "GUILD":
      return true;
    case "CATEGORY":
      return scopeId !== null && scopeId === messageScope.categoryId;
    case "CHANNEL":
      return scopeId !== null && scopeId === messageScope.channelId;
  }
}

function targetMatches(policy: ScopedActorPolicy, actor: ActorContext): boolean {
  switch (policy.targetType) {
    case "USER":
      return actor.actorKind === "USER" && policy.targetId === actor.actorId;
    case "BOT":
      return actor.actorKind === "BOT" && policy.targetId === actor.actorId;
    case "WEBHOOK":
      return actor.actorKind === "WEBHOOK" && policy.targetId === actor.actorId;
    case "ROLE":
      return actor.roleIds.includes(policy.targetId);
  }
}

function specificityRank(scopeType: PolicyScopeType): number {
  switch (scopeType) {
    case "CHANNEL":
      return 3;
    case "CATEGORY":
      return 2;
    case "GUILD":
      return 1;
  }
}

export function resolveEffectiveChannelPolicy(
  channelPolicy: ChannelGuardMode | null,
  categoryPolicy: ChannelGuardMode | null
): ChannelGuardMode {
  if (channelPolicy && channelPolicy !== "INHERIT") {
    return channelPolicy === "MONITOR"
      ? "MONITOR_ONLY"
      : channelPolicy === "DISABLED"
        ? "IGNORE_ALL"
        : channelPolicy;
  }

  if (categoryPolicy && categoryPolicy !== "INHERIT") {
    return categoryPolicy === "MONITOR"
      ? "MONITOR_ONLY"
      : categoryPolicy === "DISABLED"
        ? "IGNORE_ALL"
        : categoryPolicy;
  }

  return "ENFORCE";
}

export function selectMatchingActorPolicy(
  actor: ActorContext,
  policies: readonly ScopedActorPolicy[],
  messageScope: MessageScopeContext,
  now: Date
): ScopedActorPolicy | null {
  return (
    [...policies]
      .filter((policy) => {
        if (policy.expiresAt && policy.expiresAt.getTime() <= now.getTime()) {
          return false;
        }

        return (
          targetMatches(policy, actor) &&
          scopeMatches(policy.scopeType, policy.scopeId, messageScope)
        );
      })
      .sort(
        (left, right) => specificityRank(right.scopeType) - specificityRank(left.scopeType)
      )[0] ?? null
  );
}
