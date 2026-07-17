import { randomUUID } from "node:crypto";

import { SETUP_SESSION_TTL_MS } from "../../config/constants.js";
import type { Locale, Preset, PunishmentType } from "../../domain/policy/types.js";
import { err, ok, type Result } from "../../shared/result.js";

export interface SetupDraft {
  readonly locale: Locale;
  readonly logChannelId: string | null;
  readonly preset: Preset;
  readonly protectedRoleIds: readonly string[];
  readonly memberPunishment: PunishmentType;
  readonly botPunishment: PunishmentType;
}

export interface SetupSession {
  readonly id: string;
  readonly guildId: string;
  readonly userId: string;
  readonly draft: SetupDraft;
  readonly createdAt: number;
  readonly expiresAt: number;
}

export type SetupSessionError =
  "guild_busy" | "not_found" | "expired" | "wrong_guild" | "wrong_user";

function createDefaultDraft(locale: Locale): SetupDraft {
  return {
    locale,
    logChannelId: null,
    preset: "BALANCED",
    protectedRoleIds: [],
    memberPunishment: "TIMEOUT",
    botPunishment: "NONE"
  };
}

export class SetupSessionStore {
  private readonly byId = new Map<string, SetupSession>();
  private readonly guildIndex = new Map<string, string>();

  public create(
    guildId: string,
    userId: string,
    locale: Locale
  ): Result<SetupSession, "guild_busy"> {
    this.cleanupExpired();

    const existingId = this.guildIndex.get(guildId);
    if (existingId && this.byId.has(existingId)) {
      return err("guild_busy");
    }

    const now = Date.now();
    const session: SetupSession = {
      id: randomUUID(),
      guildId,
      userId,
      draft: createDefaultDraft(locale),
      createdAt: now,
      expiresAt: now + SETUP_SESSION_TTL_MS
    };

    this.byId.set(session.id, session);
    this.guildIndex.set(guildId, session.id);

    return ok(session);
  }

  public claim(
    sessionId: string,
    guildId: string,
    userId: string
  ): Result<SetupSession, SetupSessionError> {
    const session = this.byId.get(sessionId);
    if (!session) {
      return err("not_found");
    }

    if (session.expiresAt <= Date.now()) {
      this.removeInternal(session);
      return err("expired");
    }

    if (session.guildId !== guildId) {
      return err("wrong_guild");
    }

    if (session.userId !== userId) {
      return err("wrong_user");
    }

    return ok(session);
  }

  public update(
    sessionId: string,
    updater: (draft: SetupDraft) => SetupDraft
  ): Result<SetupSession, SetupSessionError> {
    const session = this.byId.get(sessionId);
    if (!session) {
      return err("not_found");
    }

    if (session.expiresAt <= Date.now()) {
      this.removeInternal(session);
      return err("expired");
    }

    const nextSession: SetupSession = {
      ...session,
      draft: updater(session.draft)
    };

    this.byId.set(sessionId, nextSession);
    return ok(nextSession);
  }

  public complete(sessionId: string): void {
    const session = this.byId.get(sessionId);
    if (session) {
      this.removeInternal(session);
    }
  }

  public cancel(sessionId: string): void {
    const session = this.byId.get(sessionId);
    if (session) {
      this.removeInternal(session);
    }
  }

  public cleanupExpired(): void {
    const now = Date.now();
    for (const session of this.byId.values()) {
      if (session.expiresAt <= now) {
        this.removeInternal(session);
      }
    }
  }

  private removeInternal(session: SetupSession): void {
    this.byId.delete(session.id);
    if (this.guildIndex.get(session.guildId) === session.id) {
      this.guildIndex.delete(session.guildId);
    }
  }
}
