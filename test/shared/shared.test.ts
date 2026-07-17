import { describe, expect, it } from "vitest";

import { err, ok } from "../../src/shared/result.js";
import { t } from "../../src/shared/i18n/messages.js";
import { isSnowflake } from "../../src/shared/validation/snowflake.js";
import { systemClock } from "../../src/shared/time/clock.js";

describe("shared helpers", () => {
  it("creates result values", () => {
    expect(ok(1)).toEqual({ ok: true, value: 1 });
    expect(err("bad")).toEqual({ ok: false, error: "bad" });
  });

  it("returns localized text with fallback-safe keys", () => {
    expect(t("en", "help.title")).toBe("PingGuard help");
    expect(t("ru", "help.title")).toContain("PingGuard");
  });

  it("validates snowflakes and exposes a clock", () => {
    expect(isSnowflake("123456789012345678")).toBe(true);
    expect(isSnowflake("abc")).toBe(false);
    expect(systemClock.now()).toBeInstanceOf(Date);
  });
});
