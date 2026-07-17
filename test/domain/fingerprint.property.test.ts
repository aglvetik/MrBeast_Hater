import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  buildExactFingerprint,
  buildProtectedMentionClass,
  buildStructuralFingerprint
} from "../../src/domain/detection/fingerprint.js";

const PROPERTY_RUNS = 100;

const protectedMentionArbitrary = fc.oneof(
  fc.constant({ kind: "EVERYONE" as const }),
  fc.constant({ kind: "HERE" as const }),
  fc.record({
    kind: fc.constant("ROLE" as const),
    roleId: fc.string({ unit: "grapheme-ascii", minLength: 1, maxLength: 8 }),
    riskLevel: fc.constantFrom("NORMAL" as const, "HIGH" as const, "CRITICAL" as const)
  })
);

describe("fingerprint properties", () => {
  it("builds a protected mention class that is stable across mention ordering", () => {
    fc.assert(
      fc.property(fc.array(protectedMentionArbitrary, { maxLength: 5 }), (protectedMentions) => {
        expect(buildProtectedMentionClass(protectedMentions)).toBe(
          buildProtectedMentionClass([...protectedMentions].reverse())
        );
      }),
      { numRuns: PROPERTY_RUNS }
    );
  });

  it("creates deterministic exact and structural fingerprints for the same input", () => {
    fc.assert(
      fc.property(
        fc.option(fc.string({ unit: "grapheme-ascii", minLength: 1, maxLength: 20 }), {
          nil: null
        }),
        fc.integer({ min: 0, max: 5 }),
        fc.integer({ min: 0, max: 5 }),
        fc.integer({ min: 0, max: 5 }),
        fc.integer({ min: 0, max: 2 }),
        fc.integer({ min: 0, max: 2 }),
        fc.integer({ min: 0, max: 2 }),
        fc.constantFrom("VISUAL_ONLY" as const, "LINK_NOISE" as const, "SHORT" as const),
        fc.array(fc.string({ unit: "grapheme-ascii", minLength: 1, maxLength: 5 }), {
          maxLength: 3
        }),
        (
          protectedMentionClass,
          imageAttachments,
          gifAttachments,
          videoAttachments,
          embedImages,
          embedThumbnails,
          stickers,
          textClass,
          linkHostnameHashes
        ) => {
          const totalVisualCount =
            imageAttachments +
            gifAttachments +
            videoAttachments +
            embedImages +
            embedThumbnails +
            stickers;
          const input = {
            protectedMentionClass,
            media: {
              imageAttachments,
              gifAttachments,
              videoAttachments,
              embedImages,
              embedThumbnails,
              stickers,
              totalVisualCount,
              attachmentCount: imageAttachments + gifAttachments + videoAttachments,
              extensionSummary: ["png", "gif"],
              sizeBucketSummary: ["small"]
            },
            normalizedText: {
              totalLength: 0,
              informationCharCount: 0,
              wordCount: 0,
              urlCount: 0,
              emojiCount: 0,
              punctuationRatio: 0,
              isLowInformation: true,
              onlyLinksEmojiPunctuationOrWhitespace: true,
              normalizedHash: "hash-1",
              textClass,
              linkHostnameHashes
            }
          };

          expect(buildExactFingerprint(input)).toBe(buildExactFingerprint(input));
          expect(buildStructuralFingerprint(input)).toBe(buildStructuralFingerprint(input));

          if (protectedMentionClass === null || totalVisualCount === 0) {
            expect(buildExactFingerprint(input)).toBeNull();
            expect(buildStructuralFingerprint(input)).toBeNull();
          }
        }
      ),
      { numRuns: PROPERTY_RUNS }
    );
  });
});
