import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { summarizeText } from "../../src/domain/detection/normalize.js";

const PROPERTY_RUNS = 100;

describe("text normalization properties", () => {
  it("summarizes arbitrary Unicode without throwing or leaking invalid numbers", () => {
    fc.assert(
      fc.property(fc.string({ unit: "binary", maxLength: 200 }), (content) => {
        const summary = summarizeText(content, 40);

        expect(summary.totalLength).toBeGreaterThanOrEqual(0);
        expect(summary.informationCharCount).toBeGreaterThanOrEqual(0);
        expect(summary.wordCount).toBeGreaterThanOrEqual(0);
        expect(summary.urlCount).toBeGreaterThanOrEqual(0);
        expect(summary.emojiCount).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(summary.punctuationRatio)).toBe(true);
      }),
      { numRuns: PROPERTY_RUNS }
    );
  });

  it("ignores inserted zero-width characters", () => {
    fc.assert(
      fc.property(fc.string({ unit: "grapheme", maxLength: 100 }), (content) => {
        const withZeroWidth = [...content].join("\u200B");

        expect(summarizeText(withZeroWidth, 40).informationCharCount).toBe(
          summarizeText(content, 40).informationCharCount
        );
      }),
      { numRuns: PROPERTY_RUNS }
    );
  });

  it("does not count markdown wrappers as meaningful content", () => {
    fc.assert(
      fc.property(fc.string({ unit: "grapheme", maxLength: 100 }), (content) => {
        const plain = summarizeText(content, 1_000);
        const wrapped = summarizeText(`**__~~${content}~~__**`, 1_000);

        expect(wrapped.informationCharCount).toBe(plain.informationCharCount);
      }),
      { numRuns: PROPERTY_RUNS }
    );
  });

  it("strips mixed Discord mentions before counting meaningful content", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100_000_000, max: 999_999_999 }),
        fc.string({ unit: "grapheme-ascii", maxLength: 80 }),
        (id, tail) => {
          const withMentions = summarizeText(
            `<@${id}> <@!${id}> <@&${id}> @everyone @here ${tail}`,
            40
          );
          const withoutMentions = summarizeText(tail, 40);

          expect(withMentions.informationCharCount).toBe(withoutMentions.informationCharCount);
        }
      ),
      { numRuns: PROPERTY_RUNS }
    );
  });
});
