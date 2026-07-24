import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const tokenPrefix = "ueat.v1";
const defaultTokenTtlMs = 1000 * 60 * 60 * 24 * 30;
const generatedSecretPath = join(process.cwd(), "data", ".auth-token-secret");

interface AuthTokenPayload {
  sub: string;
  iat: number;
  exp: number;
}

let cachedSecret: string | undefined;

export function createAuthToken(userId: string, now = Date.now()) {
  const payload: AuthTokenPayload = {
    sub: userId,
    iat: now,
    exp: now + readTokenTtlMs(),
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encodedPayload);

  return `${tokenPrefix}.${encodedPayload}.${signature}`;
}

export function verifyAuthToken(token: string | undefined) {
  if (!token) return undefined;
  const parts = token.split(".");
  if (parts.length !== 4 || `${parts[0]}.${parts[1]}` !== tokenPrefix) return undefined;

  const encodedPayload = parts[2];
  const signature = parts[3];
  if (!encodedPayload || !signature || !signatureMatches(encodedPayload, signature)) return undefined;

  const payload = readPayload(encodedPayload);
  if (!payload || payload.exp <= Date.now() || !payload.sub.trim()) return undefined;

  return payload.sub.trim();
}

function readTokenTtlMs() {
  const configuredDays = Number(process.env.AUTH_TOKEN_TTL_DAYS ?? "30");
  if (Number.isFinite(configuredDays) && configuredDays > 0) {
    return Math.floor(configuredDays * 24 * 60 * 60 * 1000);
  }

  return defaultTokenTtlMs;
}

function sign(encodedPayload: string) {
  return createHmac("sha256", getAuthTokenSecret()).update(encodedPayload).digest("base64url");
}

function signatureMatches(encodedPayload: string, signature: string) {
  const expected = sign(encodedPayload);
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);

  return expectedBuffer.length === signatureBuffer.length && timingSafeEqual(expectedBuffer, signatureBuffer);
}

function readPayload(encodedPayload: string): AuthTokenPayload | undefined {
  try {
    const parsed = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Partial<AuthTokenPayload>;
    if (typeof parsed.sub !== "string" || typeof parsed.iat !== "number" || typeof parsed.exp !== "number") {
      return undefined;
    }
    return { sub: parsed.sub, iat: parsed.iat, exp: parsed.exp };
  } catch {
    return undefined;
  }
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function getAuthTokenSecret() {
  if (cachedSecret) return cachedSecret;

  const configuredSecret = process.env.AUTH_TOKEN_SECRET || process.env.JWT_SECRET || process.env.SESSION_SECRET;
  if (configuredSecret?.trim()) {
    cachedSecret = configuredSecret.trim();
    return cachedSecret;
  }

  cachedSecret = readOrCreateGeneratedSecret();
  return cachedSecret;
}

function readOrCreateGeneratedSecret() {
  if (existsSync(generatedSecretPath)) {
    return readFileSync(generatedSecretPath, "utf8").trim();
  }

  const secret = randomBytes(32).toString("base64url");
  mkdirSync(dirname(generatedSecretPath), { recursive: true });
  writeFileSync(generatedSecretPath, `${secret}\n`, { encoding: "utf8", flag: "wx" });
  return secret;
}
