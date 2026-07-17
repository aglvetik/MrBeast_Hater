import type { EmbedSummary, MediaSummary, VisualAttachment } from "./types.js";

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".bmp", ".heic"];
const GIF_EXTENSIONS = [".gif"];
const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov", ".mkv"];

function endsWithAny(value: string, suffixes: readonly string[]): boolean {
  return suffixes.some((suffix) => value.endsWith(suffix));
}

function classifyAttachment(attachment: VisualAttachment): "IMAGE" | "GIF" | "VIDEO" | "NONE" {
  const contentType = attachment.contentType?.toLowerCase() ?? "";
  const fileName = attachment.fileName?.toLowerCase() ?? "";

  if (contentType.startsWith("image/gif")) return "GIF";
  if (contentType.startsWith("image/")) return "IMAGE";
  if (contentType.startsWith("video/")) return "VIDEO";

  if (endsWithAny(fileName, GIF_EXTENSIONS)) return "GIF";
  if (endsWithAny(fileName, IMAGE_EXTENSIONS)) return "IMAGE";
  if (endsWithAny(fileName, VIDEO_EXTENSIONS)) return "VIDEO";
  return "NONE";
}

export function summarizeMedia(
  attachments: readonly VisualAttachment[],
  embeds: readonly EmbedSummary[],
  stickerCount: number
): MediaSummary {
  let imageAttachments = 0;
  let gifAttachments = 0;
  let videoAttachments = 0;

  for (const attachment of attachments) {
    switch (classifyAttachment(attachment)) {
      case "IMAGE":
        imageAttachments += 1;
        break;
      case "GIF":
        gifAttachments += 1;
        break;
      case "VIDEO":
        videoAttachments += 1;
        break;
      case "NONE":
        break;
    }
  }

  const embedImages = embeds.filter((embed) => embed.hasImage).length;
  const embedThumbnails = embeds.filter((embed) => embed.hasThumbnail).length;
  const totalVisualCount =
    imageAttachments +
    gifAttachments +
    videoAttachments +
    embedImages +
    embedThumbnails +
    stickerCount;

  return {
    imageAttachments,
    gifAttachments,
    videoAttachments,
    embedImages,
    embedThumbnails,
    stickers: stickerCount,
    totalVisualCount
  };
}
