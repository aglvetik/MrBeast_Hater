import type {
  ActorActivityProfile,
  ActorContext,
  ChannelActivityProfile,
  GuildSettings
} from "../policy/types.js";

export interface ActivityAssessment {
  readonly actorActivityClass: ActorActivityProfile["activityClass"];
  readonly warmupActive: boolean;
  readonly hasStrongIdentitySignal: boolean;
  readonly lowActivityAfterWarmup: boolean;
  readonly noChannelHistoryAfterWarmup: boolean;
  readonly dormantActor: boolean;
  readonly establishedActor: boolean;
}

export function assessActivity(
  settings: GuildSettings,
  actor: ActorContext,
  profile: ActorActivityProfile,
  now: Date
): ActivityAssessment {
  const warmupStartedAt = settings.guildWarmupStartedAt ?? settings.createdAt;
  const warmupActive =
    now.getTime() - warmupStartedAt.getTime() < settings.warmupDays * 24 * 60 * 60 * 1_000;
  const accountAgeHours =
    actor.createdTimestamp === null || actor.createdTimestamp === undefined
      ? Number.POSITIVE_INFINITY
      : (now.getTime() - actor.createdTimestamp) / 3_600_000;
  const joinAgeHours =
    actor.joinedTimestamp === null || actor.joinedTimestamp === undefined
      ? Number.POSITIVE_INFINITY
      : (now.getTime() - actor.joinedTimestamp) / 3_600_000;
  const hasStrongIdentitySignal =
    accountAgeHours <= settings.newAccountMaxAgeHours ||
    joinAgeHours <= settings.newJoinMaxAgeHours;
  const lowActivityAfterWarmup = !warmupActive && profile.messageCount < 10;
  const noChannelHistoryAfterWarmup = !warmupActive && profile.lastActivityInChannelAt === null;
  const dormantActor =
    profile.lastObservedAt !== null &&
    now.getTime() - profile.lastObservedAt.getTime() > 30 * 24 * 60 * 60 * 1_000;

  return {
    actorActivityClass: profile.activityClass,
    warmupActive,
    hasStrongIdentitySignal,
    lowActivityAfterWarmup,
    noChannelHistoryAfterWarmup,
    dormantActor,
    establishedActor: profile.activityClass === "ESTABLISHED"
  };
}

export function describeChannelContext(profile: ChannelActivityProfile): string {
  if (profile.isAnnouncement && profile.isRestricted) {
    return "restricted announcement channel";
  }

  if (profile.isQuiet) {
    return "quiet channel";
  }

  if (!profile.isRestricted) {
    return "open general channel";
  }

  return profile.contextLabel;
}
