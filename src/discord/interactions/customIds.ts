export function setupCustomId(sessionId: string, action: string): string {
  return `pingguard:setup:${sessionId}:${action}`;
}

export function dataDeleteCustomId(
  guildId: string,
  userId: string,
  action: "confirm" | "cancel"
): string {
  return `pingguard:data_delete:${guildId}:${userId}:${action}`;
}

export function parseSetupCustomId(
  customId: string
): { readonly sessionId: string; readonly action: string } | null {
  const parts = customId.split(":");
  if (parts.length < 4 || parts[0] !== "pingguard" || parts[1] !== "setup") {
    return null;
  }

  const sessionId = parts[2];
  if (!sessionId) {
    return null;
  }

  return {
    sessionId,
    action: parts.slice(3).join(":")
  };
}

export function parseDataDeleteCustomId(customId: string): {
  readonly guildId: string;
  readonly userId: string;
  readonly action: "confirm" | "cancel";
} | null {
  const parts = customId.split(":");
  if (parts.length !== 5 || parts[0] !== "pingguard" || parts[1] !== "data_delete") {
    return null;
  }

  const guildId = parts[2];
  const userId = parts[3];
  const action = parts[4];
  if (!guildId || !userId || (action !== "confirm" && action !== "cancel")) {
    return null;
  }

  return { guildId, userId, action };
}

export function parseIncidentActionCustomId(customId: string): {
  readonly action: string;
  readonly guildId: string;
  readonly incidentId: string;
  readonly channelId: string;
} | null {
  const parts = customId.split(":");
  if (parts.length !== 5 || parts[0] !== "pingguard") {
    return null;
  }

  const action = parts[1];
  const guildId = parts[2];
  const incidentId = parts[3];
  const channelId = parts[4];
  if (
    !action ||
    !guildId ||
    !incidentId ||
    !channelId ||
    !["remove-timeout", "false-positive", "open-settings", "delete-only"].includes(action)
  ) {
    return null;
  }

  return {
    action,
    guildId,
    incidentId,
    channelId
  };
}
