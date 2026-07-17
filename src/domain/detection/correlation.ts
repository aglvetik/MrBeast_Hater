import type { CorrelationEvent, CorrelationSummary, RiskSignalId } from "./types.js";

function absolutePositionDistance(left: CorrelationEvent, right: CorrelationEvent): number | null {
  if (
    left.categoryPosition === null ||
    right.categoryPosition === null ||
    left.channelPosition === null ||
    right.channelPosition === null
  ) {
    return null;
  }

  return (
    Math.abs(left.categoryPosition - right.categoryPosition) * 100 +
    Math.abs(left.channelPosition - right.channelPosition)
  );
}

function monotonicDirection(events: readonly CorrelationEvent[]): RiskSignalId | null {
  if (events.length < 3) {
    return null;
  }

  const ordered = [...events].sort(
    (left, right) => left.createdAt.getTime() - right.createdAt.getTime()
  );
  const positions = ordered
    .map((event) => {
      if (event.categoryPosition === null || event.channelPosition === null) {
        return null;
      }

      return event.categoryPosition * 100 + event.channelPosition;
    })
    .filter((value): value is number => value !== null);

  if (positions.length < 3) {
    return null;
  }

  let ascending = true;
  let descending = true;
  for (let index = 1; index < positions.length; index += 1) {
    const currentPosition = positions[index];
    const previousPosition = positions[index - 1];
    if (currentPosition === undefined || previousPosition === undefined) {
      return null;
    }

    if (currentPosition <= previousPosition) {
      ascending = false;
    }

    if (currentPosition >= previousPosition) {
      descending = false;
    }
  }

  if (ascending) return "CHANNEL_TRAVERSAL_ASCENDING";
  if (descending) return "CHANNEL_TRAVERSAL_DESCENDING";
  return null;
}

export function summarizeCorrelation(
  current: CorrelationEvent,
  recentEvents: readonly CorrelationEvent[]
): CorrelationSummary {
  const relatedEvents = recentEvents.filter((event) => {
    if (event.id === current.id) {
      return false;
    }

    if (current.exactFingerprint && event.exactFingerprint === current.exactFingerprint) {
      return true;
    }

    if (
      current.structuralFingerprint &&
      event.structuralFingerprint === current.structuralFingerprint
    ) {
      return true;
    }

    return Boolean(
      current.protectedMentionClass &&
      current.protectedMentionClass === event.protectedMentionClass &&
      Math.abs(current.score - event.score) <= 20
    );
  });

  const sameActorEvents = relatedEvents.filter((event) => event.actorId === current.actorId);
  const coordinatedActorIds = [
    ...new Set(
      relatedEvents.map((event) => event.actorId).filter((actorId) => actorId !== current.actorId)
    )
  ];
  const triggeredSignals: RiskSignalId[] = [];

  if (
    sameActorEvents.some(
      (event) => event.exactFingerprint && event.exactFingerprint === current.exactFingerprint
    )
  ) {
    triggeredSignals.push("SAME_ACTOR_EXACT_FINGERPRINT");
  } else if (
    sameActorEvents.some(
      (event) =>
        event.structuralFingerprint && event.structuralFingerprint === current.structuralFingerprint
    )
  ) {
    triggeredSignals.push("SAME_ACTOR_STRUCTURAL_FINGERPRINT");
  }

  if (sameActorEvents.some((event) => event.channelId !== current.channelId)) {
    triggeredSignals.push("SECOND_EVENT_OTHER_CHANNEL");
  }

  if (
    sameActorEvents.some((event) => {
      const distance = absolutePositionDistance(event, current);
      return distance !== null && distance <= 2;
    })
  ) {
    triggeredSignals.push("ADJACENT_CHANNEL_MOVEMENT");
  }

  const traversalSignal = monotonicDirection([...sameActorEvents, current]);
  if (traversalSignal) {
    triggeredSignals.push(traversalSignal);
  }

  if (coordinatedActorIds.length > 0) {
    triggeredSignals.push("COORDINATED_MULTI_ACTOR_RAID");
  }

  const stage =
    triggeredSignals.length === 0
      ? "FIRST"
      : sameActorEvents.length > 0 || coordinatedActorIds.length > 0
        ? "CONFIRMED"
        : "SECOND";

  return {
    stage,
    relatedEvents,
    coordinatedActorIds,
    triggeredSignals
  };
}
