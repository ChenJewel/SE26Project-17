import { createWriteStream } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Router } from "express";
import { sendFailure, sendSuccess } from "../common/http.js";
import { getCurrentUserId, requiredString } from "../common/request.js";
import { makeId } from "../data/store.js";
import { normalizeUploadedMedia } from "./mediaTranscode.js";

const uploadRoot = process.env.UPLOAD_DIR ?? join(process.cwd(), "data", "uploads");
const publicBaseUrl = process.env.PUBLIC_BASE_URL ?? "";
const maxRawMediaBytes = 1024 * 1024 * 1024;
const allowedDocumentMimeTypes = new Set([
  "application/octet-stream",
  "application/pdf",
  "application/zip",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

export const uploadsRouter = Router();

uploadsRouter.post("/raw", async (req, res) => {
  const userId = getCurrentUserId(req);
  const fileName = typeof req.query.fileName === "string" ? req.query.fileName : "";
  const rawMimeType = typeof req.query.mimeType === "string" ? req.query.mimeType : req.header("content-type") ?? "";

  if (!requiredString(fileName) || !requiredString(rawMimeType)) {
    sendFailure(res, 400, "INVALID_UPLOAD", "fileName and mimeType are required.");
    return;
  }

  const mimeType = normalizeMimeType(rawMimeType.trim().toLowerCase());
  if (!isAllowedUploadMimeType(mimeType)) {
    sendFailure(res, 400, "UNSUPPORTED_MEDIA_TYPE", "This media type is not supported.");
    return;
  }

  const contentLength = Number(req.header("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > maxRawMediaBytes) {
    sendFailure(res, 413, "INVALID_UPLOAD_SIZE", "The uploaded media is too large.");
    return;
  }

  const extension = storedExtension(fileName, mimeType);
  const purpose = typeof req.query.purpose === "string" && req.query.purpose.trim()
    ? req.query.purpose.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-")
    : "media";
  const objectKey = `${purpose}/${userId}/${makeId("media")}${extension}`;
  const absolutePath = join(uploadRoot, objectKey);
  let size = 0;

  await mkdir(join(uploadRoot, purpose, userId), { recursive: true });

  try {
    await pipeline(
      req,
      new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          size += chunk.length;
          if (size > maxRawMediaBytes) {
            callback(new Error("UPLOAD_TOO_LARGE"));
            return;
          }
          callback(null, chunk);
        },
      }),
      createWriteStream(absolutePath)
    );
  } catch (error) {
    await unlink(absolutePath).catch(() => undefined);
    if (error instanceof Error && error.message === "UPLOAD_TOO_LARGE") {
      sendFailure(res, 413, "INVALID_UPLOAD_SIZE", "The uploaded media is too large.");
      return;
    }
    throw error;
  }

  if (!size) {
    await unlink(absolutePath).catch(() => undefined);
    sendFailure(res, 400, "INVALID_UPLOAD_SIZE", "The uploaded media is empty.");
    return;
  }

  const normalized = await normalizeUploadedMedia({ uploadRoot, absolutePath, objectKey, mimeType, purpose });
  const urlPath = toUploadUrlPath(normalized.objectKey);
  sendSuccess(
    res,
    {
      asset: {
        id: normalized.objectKey,
        storage: "local",
        url: publicBaseUrl ? `${publicBaseUrl}${urlPath}` : urlPath,
        mimeType: normalized.mimeType,
        size,
        purpose,
        posterUrl: normalized.posterObjectKey ? withPublicBaseUrl(toUploadUrlPath(normalized.posterObjectKey)) : undefined,
        originalUrl: normalized.originalObjectKey ? withPublicBaseUrl(toUploadUrlPath(normalized.originalObjectKey)) : undefined,
        transcodeStatus: normalized.transcodeStatus,
      },
    },
    201
  );
});

uploadsRouter.post("/", async (req, res) => {
  const userId = getCurrentUserId(req);
  const body = req.body as Record<string, unknown>;

  if (!requiredString(body.fileName) || !requiredString(body.mimeType) || !requiredString(body.dataBase64)) {
    sendFailure(res, 400, "INVALID_UPLOAD", "fileName, mimeType and dataBase64 are required.");
    return;
  }

  const mimeType = normalizeMimeType(body.mimeType.trim().toLowerCase());
  if (!isAllowedUploadMimeType(mimeType)) {
    sendFailure(res, 400, "UNSUPPORTED_MEDIA_TYPE", "This media type is not supported.");
    return;
  }

  const buffer = Buffer.from(body.dataBase64.replace(/^data:[^;]+;base64,/, ""), "base64");
  const maxBytes = mimeType.startsWith("video/")
    ? 120 * 1024 * 1024
    : mimeType.startsWith("audio/")
      ? 30 * 1024 * 1024
      : 30 * 1024 * 1024;
  if (!buffer.length || buffer.length > maxBytes) {
    sendFailure(res, 400, "INVALID_UPLOAD_SIZE", "The uploaded media is empty or too large.");
    return;
  }

  const extension = storedExtension(body.fileName, mimeType);
  const purpose = requiredString(body.purpose) ? body.purpose.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-") : "media";
  const objectKey = `${purpose}/${userId}/${makeId("media")}${extension}`;
  const absolutePath = join(uploadRoot, objectKey);

  await mkdir(join(uploadRoot, purpose, userId), { recursive: true });
  await writeFile(absolutePath, buffer);

  const normalized = await normalizeUploadedMedia({ uploadRoot, absolutePath, objectKey, mimeType, purpose });
  const urlPath = toUploadUrlPath(normalized.objectKey);
  sendSuccess(
    res,
    {
      asset: {
        id: normalized.objectKey,
        storage: "local",
        url: publicBaseUrl ? `${publicBaseUrl}${urlPath}` : urlPath,
        mimeType: normalized.mimeType,
        size: buffer.length,
        purpose,
        posterUrl: normalized.posterObjectKey ? withPublicBaseUrl(toUploadUrlPath(normalized.posterObjectKey)) : undefined,
        originalUrl: normalized.originalObjectKey ? withPublicBaseUrl(toUploadUrlPath(normalized.originalObjectKey)) : undefined,
        transcodeStatus: normalized.transcodeStatus,
      },
    },
    201
  );
});

function safeExtension(fileName: string) {
  const extension = extname(basename(fileName)).toLowerCase();
  return extension && /^[.][a-z0-9]+$/.test(extension) ? extension : "";
}

function toUploadUrlPath(objectKey: string) {
  return `/uploads/${objectKey.replace(/\\/g, "/")}`;
}

function withPublicBaseUrl(urlPath: string) {
  return publicBaseUrl ? `${publicBaseUrl}${urlPath}` : urlPath;
}

function storedExtension(fileName: string, mimeType: string) {
  if (mimeType.startsWith("image/") || mimeType.startsWith("video/") || mimeType.startsWith("audio/")) {
    return extensionFromMimeType(mimeType) || safeExtension(fileName);
  }
  return safeExtension(fileName) || extensionFromMimeType(mimeType);
}

function normalizeMimeType(value: string) {
  if (value === "image/jpg" || value === "image/pjpeg") return "image/jpeg";
  if (value === "video/mov") return "video/quicktime";
  return value;
}

function isAllowedUploadMimeType(mimeType: string) {
  return (
    mimeType.startsWith("image/") ||
    mimeType.startsWith("video/") ||
    mimeType.startsWith("audio/") ||
    allowedDocumentMimeTypes.has(mimeType)
  );
}

function extensionFromMimeType(mimeType: string) {
  const extensionByMimeType: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/heic": ".heic",
    "image/heif": ".heif",
    "image/avif": ".avif",
    "image/bmp": ".bmp",
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "video/webm": ".webm",
    "video/x-m4v": ".m4v",
    "video/x-msvideo": ".avi",
    "video/x-matroska": ".mkv",
    "video/3gpp": ".3gp",
    "video/3gpp2": ".3g2",
    "audio/mpeg": ".mp3",
    "audio/mp4": ".m4a",
    "audio/webm": ".webm",
    "audio/aac": ".aac",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/ogg": ".ogg",
  };
  return extensionByMimeType[mimeType] ?? "";
}
