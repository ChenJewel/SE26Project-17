import { mkdir } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { spawn } from "node:child_process";

type TranscodeStatus = "original" | "transcoded" | "failed" | "skipped";

export interface MediaTranscodeResult {
  objectKey: string;
  mimeType: string;
  posterObjectKey?: string;
  originalObjectKey?: string;
  transcodeStatus: TranscodeStatus;
}

interface NormalizeInput {
  uploadRoot: string;
  absolutePath: string;
  objectKey: string;
  mimeType: string;
  purpose: string;
}

const normalizedPurposes = new Set(["post", "meal-card", "chat-image", "chat-video"]);

export async function normalizeUploadedMedia(input: NormalizeInput): Promise<MediaTranscodeResult> {
  if (!shouldNormalize(input.purpose, input.mimeType)) {
    return {
      objectKey: input.objectKey,
      mimeType: input.mimeType,
      transcodeStatus: "skipped",
    };
  }

  try {
    if (input.mimeType.startsWith("image/")) return await normalizeImage(input);
    if (input.mimeType.startsWith("video/")) return await normalizeVideo(input);
  } catch (error) {
    console.warn("Media transcode failed, keeping original upload.", error);
    return {
      objectKey: input.objectKey,
      mimeType: input.mimeType,
      transcodeStatus: "failed",
    };
  }

  return {
    objectKey: input.objectKey,
    mimeType: input.mimeType,
    transcodeStatus: "original",
  };
}

function shouldNormalize(purpose: string, mimeType: string) {
  if (!normalizedPurposes.has(purpose)) return false;
  if (mimeType === "image/gif") return false;
  return mimeType.startsWith("image/") || mimeType.startsWith("video/");
}

async function normalizeImage(input: NormalizeInput): Promise<MediaTranscodeResult> {
  if (input.mimeType === "image/jpeg") {
    return {
      objectKey: input.objectKey,
      mimeType: input.mimeType,
      transcodeStatus: "original",
    };
  }

  const targetObjectKey = replaceExtension(input.objectKey, "-compatible.jpg");
  const targetPath = join(input.uploadRoot, targetObjectKey);
  await mkdir(dirname(targetPath), { recursive: true });
  await runFfmpeg([
    "-y",
    "-i",
    input.absolutePath,
    "-frames:v",
    "1",
    "-q:v",
    "3",
    targetPath,
  ]);

  return {
    objectKey: targetObjectKey,
    originalObjectKey: input.objectKey,
    mimeType: "image/jpeg",
    transcodeStatus: "transcoded",
  };
}

async function normalizeVideo(input: NormalizeInput): Promise<MediaTranscodeResult> {
  const targetObjectKey = replaceExtension(input.objectKey, "-compatible.mp4");
  const posterObjectKey = replaceExtension(input.objectKey, "-poster.jpg");
  const targetPath = join(input.uploadRoot, targetObjectKey);
  const posterPath = join(input.uploadRoot, posterObjectKey);
  await mkdir(dirname(targetPath), { recursive: true });

  await runFfmpeg([
    "-y",
    "-i",
    input.absolutePath,
    "-map",
    "0:v:0",
    "-map",
    "0:a?",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-pix_fmt",
    "yuv420p",
    "-vf",
    "scale='trunc(min(iw,1080)/2)*2':-2",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    targetPath,
  ], 8 * 60 * 1000);

  const posterCreated = await createPoster(targetPath, posterPath);

  return {
    objectKey: targetObjectKey,
    posterObjectKey: posterCreated ? posterObjectKey : undefined,
    originalObjectKey: input.objectKey,
    mimeType: "video/mp4",
    transcodeStatus: "transcoded",
  };
}

async function createPoster(videoPath: string, posterPath: string) {
  try {
    await runFfmpeg(["-y", "-ss", "0.8", "-i", videoPath, "-frames:v", "1", "-q:v", "3", posterPath]);
    return true;
  } catch {
    try {
      await runFfmpeg(["-y", "-ss", "0", "-i", videoPath, "-frames:v", "1", "-q:v", "3", posterPath]);
      return true;
    } catch (error) {
      console.warn("Video poster generation failed.", error);
      return false;
    }
  }
}

function replaceExtension(objectKey: string, suffixWithExtension: string) {
  const extension = extname(objectKey);
  return extension ? `${objectKey.slice(0, -extension.length)}${suffixWithExtension}` : `${objectKey}${suffixWithExtension}`;
}

function runFfmpeg(args: string[], timeoutMs = 3 * 60 * 1000) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("FFMPEG_TIMEOUT"));
    }, timeoutMs);

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk).slice(0, 2000);
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`FFMPEG_EXIT_${code}: ${stderr.slice(-2000)}`));
    });
  });
}
