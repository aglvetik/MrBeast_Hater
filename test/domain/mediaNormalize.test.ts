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

  it("accepts attachment sizes across every bucket without affecting totals", () => {
    const summary = summarizeMedia(
      [
        { contentType: "image/png", fileName: "small.png", sizeBytes: 128_000 },
        { contentType: "image/png", fileName: "medium.png", sizeBytes: 512_000 },
        { contentType: "image/png", fileName: "large.png", sizeBytes: 2_000_000 },
        { contentType: "image/png", fileName: "huge.png", sizeBytes: 6_000_000 },
        { contentType: null, fileName: null, sizeBytes: Number.NaN }
      ],
      [],
      0
    );

    expect(summary.imageAttachments).toBe(4);
    expect(summary.totalVisualCount).toBe(4);
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
