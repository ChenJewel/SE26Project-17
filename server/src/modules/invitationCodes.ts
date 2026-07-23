import { createHash, randomBytes } from "node:crypto";
import { postgresPool } from "../data/postgres.js";
import { makeId } from "../data/store.js";

const defaultMaxUses = 10;
const defaultExpiresInDays = 14;

export type InvitationCodeSummary = {
  id: string;
  label: string;
  codePrefix: string;
  maxUses: number;
  usedCount: number;
  remaining: number;
  active: boolean;
  expired: boolean;
  expiresAt: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
};

type InvitationCodeRow = {
  id: string;
  label: string;
  code_prefix: string;
  max_uses: number;
  used_count: number;
  active: boolean;
  expires_at: string;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
};

export async function ensureInvitationCodeTables() {
  await postgresPool.query(`
    CREATE TABLE IF NOT EXISTS invitation_codes (
      id TEXT PRIMARY KEY,
      code_hash TEXT NOT NULL UNIQUE,
      code_prefix TEXT NOT NULL,
      label TEXT NOT NULL,
      max_uses INTEGER NOT NULL DEFAULT 10,
      used_count INTEGER NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      expires_at TEXT NOT NULL,
      created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  await postgresPool.query(`
    CREATE TABLE IF NOT EXISTS invitation_code_redemptions (
      id TEXT PRIMARY KEY,
      invitation_id TEXT NOT NULL REFERENCES invitation_codes(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      used_at TEXT NOT NULL,
      UNIQUE (invitation_id, user_id),
      UNIQUE (invitation_id, email)
    )
  `);
  await postgresPool.query("CREATE INDEX IF NOT EXISTS idx_invitation_codes_active_expires ON invitation_codes(active, expires_at)");
  await postgresPool.query("CREATE INDEX IF NOT EXISTS idx_invitation_redemptions_email ON invitation_code_redemptions(email)");
}

export async function createInvitationCode(input: {
  createdByUserId: string;
  label?: string;
  maxUses?: number;
  expiresAt?: string;
  expiresInDays?: number;
}) {
  await ensureInvitationCodeTables();
  const now = new Date();
  const maxUses = clampInteger(input.maxUses, 1, 500, defaultMaxUses);
  const expiresAt = resolveExpiresAt(input.expiresAt, input.expiresInDays, now);
  const code = generateInviteCode();
  const row = (await postgresPool.query<InvitationCodeRow>(
    `INSERT INTO invitation_codes (id, code_hash, code_prefix, label, max_uses, used_count, active, expires_at, created_by_user_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, 0, TRUE, $6, $7, $8, $8)
     RETURNING id, label, code_prefix, max_uses, used_count, active, expires_at, created_by_user_id, created_at, updated_at`,
    [
      makeId("invite"),
      hashInviteCode(code),
      code.slice(0, 7),
      normalizeLabel(input.label),
      maxUses,
      expiresAt.toISOString(),
      input.createdByUserId,
      now.toISOString(),
    ]
  )).rows[0];
  return { invitation: toSummary(row), code };
}

export async function listInvitationCodes() {
  await ensureInvitationCodeTables();
  const rows = (await postgresPool.query<InvitationCodeRow>(
    `SELECT id, label, code_prefix, max_uses, used_count, active, expires_at, created_by_user_id, created_at, updated_at
     FROM invitation_codes
     ORDER BY created_at DESC
     LIMIT 100`
  )).rows;
  return rows.map(toSummary);
}

export async function updateInvitationCode(id: string, patch: {
  label?: string;
  active?: boolean;
  maxUses?: number;
  expiresAt?: string;
}) {
  await ensureInvitationCodeTables();
  const current = await findInvitationById(id);
  if (!current) return null;

  const maxUses = patch.maxUses === undefined ? current.max_uses : Math.max(current.used_count, clampInteger(patch.maxUses, 1, 500, current.max_uses));
  const expiresAt = patch.expiresAt ? new Date(patch.expiresAt) : new Date(current.expires_at);
  const row = (await postgresPool.query<InvitationCodeRow>(
    `UPDATE invitation_codes
     SET label = $1, active = $2, max_uses = $3, expires_at = $4, updated_at = $5
     WHERE id = $6
     RETURNING id, label, code_prefix, max_uses, used_count, active, expires_at, created_by_user_id, created_at, updated_at`,
    [
      patch.label === undefined ? current.label : normalizeLabel(patch.label),
      patch.active === undefined ? current.active : patch.active,
      maxUses,
      Number.isNaN(expiresAt.getTime()) ? current.expires_at : expiresAt.toISOString(),
      new Date().toISOString(),
      id,
    ]
  )).rows[0];
  return row ? toSummary(row) : null;
}

export async function redeemInvitationCode(codeValue: unknown, input: { email: string; userId: string }) {
  const code = normalizeInviteCode(codeValue);
  if (!code) {
    return { ok: false as const, code: "INVALID_INVITATION_CODE", message: "请输入有效邀请码。" };
  }

  await ensureInvitationCodeTables();
  const client = await postgresPool.connect();
  try {
    await client.query("BEGIN");
    const now = new Date().toISOString();
    const row = (await client.query<InvitationCodeRow>(
      `UPDATE invitation_codes
       SET used_count = used_count + 1, updated_at = $1
       WHERE code_hash = $2
         AND active = TRUE
         AND used_count < max_uses
         AND expires_at > $1
       RETURNING id, label, code_prefix, max_uses, used_count, active, expires_at, created_by_user_id, created_at, updated_at`,
      [now, hashInviteCode(code)]
    )).rows[0];

    if (!row) {
      await client.query("ROLLBACK");
      return { ok: false as const, code: "INVITATION_CODE_UNAVAILABLE", message: "邀请码无效、已过期或使用次数已满。" };
    }

    await client.query(
      `INSERT INTO invitation_code_redemptions (id, invitation_id, user_id, email, used_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [makeId("invite-use"), row.id, input.userId, input.email, now]
    );
    await client.query("COMMIT");
    return { ok: true as const, invitation: toSummary(row) };
  } catch (error) {
    await client.query("ROLLBACK");
    if (isUniqueViolation(error)) {
      return { ok: false as const, code: "INVITATION_CODE_ALREADY_USED", message: "这个邮箱已经使用过该邀请码。" };
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function releaseInvitationRedemption(input: { userId: string; email: string }) {
  await ensureInvitationCodeTables();
  const rows = (await postgresPool.query<{ invitation_id: string }>(
    "DELETE FROM invitation_code_redemptions WHERE user_id = $1 AND email = $2 RETURNING invitation_id",
    [input.userId, input.email]
  )).rows;
  for (const row of rows) {
    await postgresPool.query(
      "UPDATE invitation_codes SET used_count = GREATEST(0, used_count - 1), updated_at = $1 WHERE id = $2",
      [new Date().toISOString(), row.invitation_id]
    );
  }
}

async function findInvitationById(id: string) {
  return (await postgresPool.query<InvitationCodeRow>(
    `SELECT id, label, code_prefix, max_uses, used_count, active, expires_at, created_by_user_id, created_at, updated_at
     FROM invitation_codes WHERE id = $1`,
    [id]
  )).rows[0] ?? null;
}

function toSummary(row: InvitationCodeRow): InvitationCodeSummary {
  const expired = new Date(row.expires_at).getTime() <= Date.now();
  return {
    id: row.id,
    label: row.label,
    codePrefix: row.code_prefix,
    maxUses: row.max_uses,
    usedCount: row.used_count,
    remaining: Math.max(0, row.max_uses - row.used_count),
    active: row.active,
    expired,
    expiresAt: row.expires_at,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function generateInviteCode() {
  return `UEAT-${randomBytes(6).toString("base64url").toUpperCase()}`;
}

function hashInviteCode(code: string) {
  const secret = process.env.INVITATION_CODE_SECRET || process.env.AUTH_TOKEN_SECRET || "ueat-invitation-code-dev-secret";
  return createHash("sha256").update(`${secret}:${normalizeInviteCode(code)}`).digest("hex");
}

function normalizeInviteCode(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase().replace(/\s+/g, "") : "";
}

function normalizeLabel(value: unknown) {
  const label = typeof value === "string" ? value.trim() : "";
  return label || "内测邀请码";
}

function clampInteger(value: unknown, min: number, max: number, fallback: number) {
  const numeric = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(numeric)));
}

function resolveExpiresAt(expiresAtValue: unknown, expiresInDaysValue: unknown, now: Date) {
  if (typeof expiresAtValue === "string" && expiresAtValue.trim()) {
    const expiresAt = new Date(expiresAtValue);
    if (!Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() > now.getTime()) return expiresAt;
  }
  const expiresInDays = clampInteger(expiresInDaysValue, 1, 365, defaultExpiresInDays);
  return new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000);
}

function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === "object" && (error as { code?: unknown }).code === "23505");
}
