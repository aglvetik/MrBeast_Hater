import { describe, expect, it } from "vitest";
import { PermissionFlagsBits, PermissionsBitField } from "discord.js";

import { InMemoryActorLock } from "../../src/application/locks/inMemoryActorLock.js";
import { BurstTracker } from "../../src/application/services/burstTracker.js";
import { GuildSettingsCache } from "../../src/application/services/settingsCache.js";
import { buildDefaultGuildSettings } from "../../src/config/constants.js";
import {
  dataDeleteCustomId,
  parseDataDeleteCustomId,
  parseIncidentActionCustomId,
  parseSetupCustomId,
  setupCustomId
} from "../../src/discord/interactions/customIds.js";
import { hasManageAccess, type ManagedInteraction } from "../../src/discord/interactions/shared.js";
import { SetupSessionStore } from "../../src/discord/components/setupStore.js";
import type { GuildSettingsRepository } from "../../src/infrastructure/database/repositories.js";

describe("application utilities", () => {
  it("allows runtime configuration access for owner, Manage Guild, or Administrator", () => {
    const interaction = (
      userId: string,
      ownerId: string,
      permissions: bigint
    ): ManagedInteraction =>
      ({
        user: { id: userId },
        guild: { ownerId },
        memberPermissions: new PermissionsBitField(permissions)
      }) as ManagedInteraction;

    expect(hasManageAccess(interaction("owner", "owner", 0n))).toBe(true);
    expect(hasManageAccess(interaction("manager", "owner", PermissionFlagsBits.ManageGuild))).toBe(
      true
    );
    expect(hasManageAccess(interaction("admin", "owner", PermissionFlagsBits.Administrator))).toBe(
      true
    );
    expect(hasManageAccess(interaction("member", "owner", 0n))).toBe(false);
  });

  it("serializes work for the same actor lock key", async () => {
    const lock = new InMemoryActorLock();
    const events: string[] = [];

    await Promise.all([
      lock.run("guild:actor", async () => {
        events.push("first:start");
        await Promise.resolve();
        events.push("first:end");
      }),
      lock.run("guild:actor", async () => {
        events.push("second:start");
        await Promise.resolve();
        events.push("second:end");
      })
    ]);

    expect(events).toEqual(["first:start", "first:end", "second:start", "second:end"]);
  });

  it("runs isolated actor lock work immediately after a completed single run", async () => {
    const lock = new InMemoryActorLock();
    let calls = 0;

    await lock.run("guild:actor", () => {
      calls += 1;
      return Promise.resolve();
    });
    await lock.run("guild:actor", () => {
      calls += 1;
      return Promise.resolve();
    });

    expect(calls).toBe(2);
  });

  it("tracks recent burst entries by guild and actor", () => {
    const tracker = new BurstTracker();
    tracker.record("1", "2", 1_000);
    tracker.record("1", "2", 20_000);

    expect(tracker.getRecent("1", "2", 10, 20_000).map((entry) => entry.createdTimestamp)).toEqual([
      20_000
    ]);
    expect(tracker.getRecent("1", "3", 10, 20_000)).toEqual([]);
  });

  it("caches guild settings until invalidated", async () => {
    let calls = 0;
    const repository = {
      getByGuildId(guildId: string) {
        calls += 1;
        return Promise.resolve(buildDefaultGuildSettings(guildId));
      }
    } as unknown as GuildSettingsRepository;
    const cache = new GuildSettingsCache(repository);

    await cache.get("100");
    await cache.get("100");
    cache.invalidate("100");
    await cache.get("100");

    expect(calls).toBe(2);
  });

  it("creates, claims, updates, and completes setup sessions", () => {
    const store = new SetupSessionStore();
    const created = store.create("100", "200", "en");

    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const claimed = store.claim(created.value.id, "100", "200");
    expect(claimed.ok).toBe(true);

    const updated = store.update(created.value.id, (draft) => ({ ...draft, preset: "STRICT" }));
    expect(updated.ok).toBe(true);
    expect(updated.ok ? updated.value.draft.preset : null).toBe("STRICT");

    store.complete(created.value.id);
    expect(store.claim(created.value.id, "100", "200").ok).toBe(false);
  });

  it("rejects duplicate, wrong, and missing setup sessions", () => {
    const store = new SetupSessionStore();
    const created = store.create("100", "200", "en");

    expect(store.create("100", "201", "en")).toEqual({ ok: false, error: "guild_busy" });
    if (!created.ok) return;

    expect(store.claim(created.value.id, "101", "200")).toEqual({
      ok: false,
      error: "wrong_guild"
    });
    expect(store.claim(created.value.id, "100", "201")).toEqual({
      ok: false,
      error: "wrong_user"
    });
    store.cancel(created.value.id);
    expect(store.claim(created.value.id, "100", "200")).toEqual({
      ok: false,
      error: "not_found"
    });
  });

  it("parses custom IDs defensively", () => {
    expect(setupCustomId("abc", "confirm")).toBe("pingguard:setup:abc:confirm");
    expect(parseSetupCustomId("pingguard:setup:abc:locale:en")).toEqual({
      sessionId: "abc",
      action: "locale:en"
    });
    expect(parseSetupCustomId("pingguard:setup::confirm")).toBeNull();
    expect(dataDeleteCustomId("100", "200", "confirm")).toBe(
      "pingguard:data_delete:100:200:confirm"
    );
    expect(parseDataDeleteCustomId("pingguard:data_delete:100:200:cancel")).toEqual({
      guildId: "100",
      userId: "200",
      action: "cancel"
    });
    expect(parseDataDeleteCustomId("pingguard:data_delete:100::cancel")).toBeNull();
    expect(parseDataDeleteCustomId("pingguard:data_delete:100:200:anything")).toBeNull();
    expect(parseIncidentActionCustomId("pingguard:false-positive:100:incident:200")).toEqual({
      action: "false-positive",
      guildId: "100",
      incidentId: "incident",
      channelId: "200"
    });
    expect(parseIncidentActionCustomId("bad:false-positive:100:incident:200")).toBeNull();
    expect(parseIncidentActionCustomId("pingguard:unknown:100:incident:200")).toBeNull();
  });
});
