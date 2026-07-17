import { describe, expect, it } from "vitest";

import { detectVisualMassPing } from "../../src/domain/detection/engine.js";
import type { DetectionContext, ObservedMessage } from "../../src/domain/detection/types.js";

function message(overrides: Partial<ObservedMessage> = {}): ObservedMessage {
  return {
    guildId: "100",
    channelId: "200",
    messageId: "300",
    actorId: "400",
    content: "",
    mentionedEveryone: true,
    mentionedHere: false,
    mentionedRoleIds: [],
    attachments: [{ contentType: "image/png", fileName: "a.png" }],
    embeds: [],
    stickerCount: 0,
    createdTimestamp: 1_000,
    ...overrides
  };
}

function context(overrides: Partial<DetectionContext> = {}): DetectionContext {
  return {
    roleDetectionMode: "MANUAL",
    protectedRoleIds: new Set(["900"]),
    minVisualCount: 1,
    maxInformationChars: 40,
    burstWindowSeconds: 10,
    burstMessageCount: 2,
    linkRuleEnabled: true,
    recentSuspiciousMessages: [],
    ...overrides
  };
}

describe("detectVisualMassPing", () => {
  it("detects everyone plus an image and empty text", () => {
    const result = detectVisualMassPing(message(), context());

    expect(result.detected).toBe(true);
    expect(result.ruleId).toBe("LINK_VISUAL_MASS_PING");
    expect(result.media.imageAttachments).toBe(1);
  });

  it("detects here plus an embed image", () => {
    const result = detectVisualMassPing(
      message({
        mentionedEveryone: false,
        mentionedHere: true,
        attachments: [],
        embeds: [{ hasImage: true, hasThumbnail: false }]
      }),
      context()
    );

    expect(result.detected).toBe(true);
    expect(result.protectedMentions.map((mention) => mention.kind)).toContain("HERE");
  });

  it("detects protected role mentions in manual mode", () => {
    const result = detectVisualMassPing(
      message({
        mentionedEveryone: false,
        mentionedRoleIds: ["900"]
      }),
      context()
    );

    expect(result.detected).toBe(true);
    expect(result.protectedMentions).toEqual([{ kind: "ROLE", roleId: "900" }]);
  });

  it("detects any role mention in all roles mode", () => {
    const result = detectVisualMassPing(
      message({
        mentionedEveryone: false,
        mentionedRoleIds: ["901"]
      }),
      context({ roleDetectionMode: "ALL_ROLES" })
    );

    expect(result.detected).toBe(true);
  });

  it("does not detect ordinary user mentions", () => {
    const result = detectVisualMassPing(
      message({
        content: "<@123>",
        mentionedEveryone: false,
        attachments: [{ contentType: "image/jpeg", fileName: "a.jpg" }]
      }),
      context()
    );

    expect(result.detected).toBe(false);
  });

  it("does not detect mass ping without visual media", () => {
    const result = detectVisualMassPing(
      message({
        attachments: [],
        embeds: [],
        stickerCount: 0
      }),
      context()
    );

    expect(result.detected).toBe(false);
  });

  it("does not detect meaningful text", () => {
    const result = detectVisualMassPing(
      message({
        content:
          "@everyone We shipped the release notes with a detailed changelog and migration notes."
      }),
      context()
    );

    expect(result.detected).toBe(false);
  });

  it("detects multi-visual messages with more text tolerance", () => {
    const result = detectVisualMassPing(
      message({
        content: "@everyone short update with enough text to beat the base low information limit",
        attachments: [
          { contentType: "image/png", fileName: "a.png" },
          { contentType: "video/mp4", fileName: "b.mp4" }
        ]
      }),
      context({ maxInformationChars: 20 })
    );

    expect(result.detected).toBe(true);
    expect(result.ruleId).toBe("MULTI_VISUAL_MASS_PING");
  });

  it("detects bursts after a recent suspicious message", () => {
    const result = detectVisualMassPing(
      message({
        createdTimestamp: 5_000
      }),
      context({
        recentSuspiciousMessages: [{ createdTimestamp: 1_000 }]
      })
    );

    expect(result.detected).toBe(true);
    expect(result.ruleId).toBe("BURST_MASS_PING");
  });
});
