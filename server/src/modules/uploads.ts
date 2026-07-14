import { mkdir, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { Router } from "express";
import { sendFailure, sendSuccess } from "../common/http.js";
import { getCurrentUserId, requiredString } from "../common/request.js";
import { makeId } from "../data/store.js";

const uploadRoot = process.env.UPLOAD_DIR ?? join(process.cwd(), "data", "uploads");
const publicBaseUrl = process.env.PUBLIC_BASE_URL ?? "";
const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/mp4",
  "audio/webm",
]);

export const uploadsRouter = Router();

uploadsRouter.post("/", async (req, res) => {
  const userId = getCurrentUserId(req);
  const body = req.body as Record<string, unknown>;

  if (!requiredString(body.fileName) || !requiredString(body.mimeType) || !requiredString(body.dataBase64)) {
    sendFailure(res, 400, "INVALID_UPLOAD", "fileName, mimeType and dataBase64 are required.");
    return;
  }

  const mimeType = body.mimeType.trim().toLowerCase();
  if (!allowedMimeTypes.has(mimeType)) {
    sendFailure(res, 400, "UNSUPPORTED_MEDIA_TYPE", "This media type is not supported.");
    return;
  }

  const buffer = Buffer.from(body.dataBase64.replace(/^data:[^;]+;base64,/, ""), "base64");
  const maxBytes = mimeType.startsWith("video/") ? 50 * 1024 * 1024 : 8 * 1024 * 1024;
  if (!buffer.length || buffer.length > maxBytes) {
    sendFailure(res, 400, "INVALID_UPLOAD_SIZE", "The uploaded media is empty or too large.");
    return;
  }

  const extension = safeExtension(body.fileName);
  const purpose = requiredString(body.purpose) ? body.purpose.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-") : "media";
  const objectKey = `${purpose}/${userId}/${makeId("media")}${extension}`;
  const absolutePath = join(uploadRoot, objectKey);

  await mkdir(join(uploadRoot, purpose, userId), { recursive: true });
  await writeFile(absolutePath, buffer);

  const urlPath = `/uploads/${objectKey.replace(/\\/g, "/")}`;
  sendSuccess(
    res,
    {
      asset: {
        id: objectKey,
        storage: "local",
        url: publicBaseUrl ? `${publicBaseUrl}${urlPath}` : urlPath,
        mimeType,
        size: buffer.length,
        purpose,
      },
    },
    201
  );
});

function safeExtension(fileName: string) {
  const extension = extname(basename(fileName)).toLowerCase();
  return extension && /^[.][a-z0-9]+$/.test(extension) ? extension : "";
}
