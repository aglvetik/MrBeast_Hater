import { describe, expect, it } from "vitest";

import { summarizeMedia } from "../../src/domain/detection/media.js";
import { summarizeText } from "../../src/domain/detection/normalize.js";
import { applyPreset } from "../../src/domain/policy/presets.js";

describe("media and text summaries", () => {
  it("classifies media by mime type and extension fallback", () => {
    const summary = summarizeMedia(
      [
        { contentType: "image/jpeg", fileName: "a.bin" },
        { contentType: "image/gif", fileName: "b.bin" },
        { contentType: "video/mp4", fileName: "c.bin" },
        { contentType: null, fileName: "fallback.webp" }
      ],
      [{ hasImage: true, hasThumbnail: true }],
      2
    );

    expect(summary).toEqual({
      imageAttachments: 2,
      gifAttachments: 1,
      videoAttachments: 1,
      embedImages: 1,
      embedThumbnails: 1,
      stickers: 2,
      totalVisualCount: 8
    });
  });

  it("classifies video extension fallback and ignores unknown attachments", () => {
    const summary = summarizeMedia(
      [
        { contentType: null, fileName: "clip.MOV" },
        { contentType: null, fileName: "archive.zip" },
        { contentType: "application/octet-stream", fileName: null }
      ],
      [{ hasImage: false, hasThumbnail: false }],
      0
    );

    expect(summary.videoAttachments).toBe(1);
    expect(summary.totalVisualCount).toBe(1);
  });

  it("normalizes mentions, urls, markdown, and low-information text", () => {
    const summary = summarizeText("**<@123> @everyone https://example.com !!!**", 5);

    expect(summary.urlCount).toBe(1);
    expect(summary.informationCharCount).toBeLessThanOrEqual(5);
    expect(summary.isLowInformation).toBe(true);
    expect(summary.onlyLinksEmojiPunctuationOrWhitespace).toBe(true);
  });

  it("applies presets", () => {
    expect(applyPreset("100", "BALANCED", "en").maxInformationChars).toBe(40);
    expect(applyPreset("100", "STRICT", "en").roleDetectionMode).toBe("ALL_ROLES");
    expect(applyPreset("100", "MONITOR", "en").operationMode).toBe("MONITOR");
  });
});
