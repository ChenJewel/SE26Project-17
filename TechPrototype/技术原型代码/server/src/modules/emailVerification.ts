import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { postgresPool } from "../data/postgres.js";
import { normalizeEmail, resolveCampusEmail } from "./campusEmail.js";
import { sendCampusVerificationEmail } from "./emailSender.js";

const purposeRegister = "register";
const purposePasswordReset = "password-reset";
const codeTtlMinutes = 10;
const sendCooldownMs = 60_000;
const maxAttempts = 5;
const defaultDailySendLimit = 40;

type EmailCodePurpose = typeof purposeRegister | typeof purposePasswordReset;

export async function sendRegisterEmailCode(emailValue: unknown) {
  return sendEmailCodeForPurpose(emailValue, purposeRegister);
}

export async function sendPasswordResetEmailCode(emailValue: unknown) {
  return sendEmailCodeForPurpose(emailValue, purposePasswordReset);
}

export async function verifyRegisterEmailCode(emailValue: unknown, codeValue: unknown, consume = true) {
  return verifyEmailCodeForPurpose(emailValue, codeValue, purposeRegister, consume);
}

export async function verifyPasswordResetEmailCode(emailValue: unknown, codeValue: unknown, consume = true) {
  return verifyEmailCodeForPurpose(emailValue, codeValue, purposePasswordReset, consume);
}

export async function getEmailCodeDailyStats(dayKey = getEmailDayKey()) {
  await ensureEmailVerificationTables();
  const result = await postgresPool.query<{
    sent_count: string | number;
    failed_count: string | number;
    unique_recipients: string | number;
  }>(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'sent') AS sent_count,
       COUNT(*) FILTER (WHERE status = 'failed') AS failed_count,
       COUNT(DISTINCT email) FILTER (WHERE status = 'sent') AS unique_recipients
     FROM email_send_logs
     WHERE day_key = $1`,
    [dayKey]
  );
  const purposeRows = (await postgresPool.query<{ purpose: string; sent_count: string | number; failed_count: string | number }>(
    `SELECT purpose,
       COUNT(*) FILTER (WHERE status = 'sent') AS sent_count,
       COUNT(*) FILTER (WHERE status = 'failed') AS failed_count
     FROM email_send_logs
     WHERE day_key = $1
     GROUP BY purpose
     ORDER BY purpose ASC`,
    [dayKey]
  )).rows;
  const row = result.rows[0];
  const sentCount = Number(row?.sent_count ?? 0);
  const failedCount = Number(row?.failed_count ?? 0);
  const uniqueRecipients = Number(row?.unique_recipients ?? 0);
  const limit = readDailySendLimit();
  return {
    dayKey,
    timeZone: getEmailLimitTimeZone(),
    limit,
    sentCount,
    failedCount,
    uniqueRecipients,
    remaining: Math.max(0, limit - sentCount),
    byPurpose: purposeRows.map((item) => ({
      purpose: item.purpose,
      sentCount: Number(item.sent_count ?? 0),
      failedCount: Number(item.failed_count ?? 0),
    })),
  };
}

export async function ensureEmailVerificationTables() {
  await postgresPool.query(`
    CREATE TABLE IF NOT EXISTS email_verification_codes (
      email TEXT NOT NULL,
      purpose TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      school TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      sent_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      consumed_at TEXT,
      PRIMARY KEY (email, purpose)
    )
  `);
  await postgresPool.query("CREATE INDEX IF NOT EXISTS idx_email_verification_codes_expires ON email_verification_codes(expires_at)");
  await postgresPool.query(`
    CREATE TABLE IF NOT EXISTS email_send_logs (
      id BIGSERIAL PRIMARY KEY,
      day_key TEXT NOT NULL,
      purpose TEXT NOT NULL,
      email TEXT NOT NULL,
      school TEXT NOT NULL,
      provider TEXT NOT NULL,
      status TEXT NOT NULL,
      error_code TEXT,
      created_at TEXT NOT NULL
    )
  `);
  await postgresPool.query("CREATE INDEX IF NOT EXISTS idx_email_send_logs_day_purpose ON email_send_logs(day_key, purpose)");
  await postgresPool.query("CREATE INDEX IF NOT EXISTS idx_email_send_logs_email ON email_send_logs(email)");
}

async function sendEmailCodeForPurpose(emailValue: unknown, purpose: EmailCodePurpose) {
  const campus = resolveCampusEmail(emailValue);
  if (!campus.valid) {
    return { ok: false as const, code: "NOT_CAMPUS_EMAIL", message: "请使用白名单内的校园邮箱。" };
  }

  await ensureEmailVerificationTables();
  const dailyStats = await getEmailCodeDailyStats();
  if (dailyStats.sentCount >= dailyStats.limit) {
    return { ok: false as const, code: "EMAIL_CODE_DAILY_LIMIT_REACHED", message: "今日验证码发送名额已满，请明天再试。" };
  }

  const existing = await readActiveCode(campus.email, purpose);
  if (existing && Date.now() - new Date(existing.sent_at).getTime() < sendCooldownMs) {
    return { ok: false as const, code: "EMAIL_CODE_TOO_FREQUENT", message: "发送太频繁，请稍后再试。" };
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + codeTtlMinutes * 60_000);
  await postgresPool.query(
    `INSERT INTO email_verification_codes (email, purpose, code_hash, school, attempts, sent_at, expires_at, consumed_at)
     VALUES ($1, $2, $3, $4, 0, $5, $6, NULL)
     ON CONFLICT (email, purpose) DO UPDATE SET
       code_hash = EXCLUDED.code_hash,
       school = EXCLUDED.school,
       attempts = 0,
       sent_at = EXCLUDED.sent_at,
       expires_at = EXCLUDED.expires_at,
       consumed_at = NULL`,
    [campus.email, purpose, hashCode(campus.email, purpose, code), campus.school, now.toISOString(), expiresAt.toISOString()]
  );

  try {
    await sendCampusVerificationEmail({
      email: campus.email,
      code,
      school: campus.school,
      expiresMinutes: codeTtlMinutes,
      purpose,
    });
  } catch (error) {
    await logEmailSend({
      email: campus.email,
      school: campus.school,
      purpose,
      status: "failed",
      errorCode: error instanceof Error ? error.message.slice(0, 180) : "UNKNOWN_EMAIL_SEND_ERROR",
    });
    console.error("[ueat] Failed to send campus verification email.", error);
    return { ok: false as const, code: "EMAIL_CODE_DELIVERY_FAILED", message: "验证码邮件发送失败，请稍后再试。" };
  }

  await logEmailSend({ email: campus.email, school: campus.school, purpose, status: "sent" });
  const nextStats = await getEmailCodeDailyStats();

  return {
    ok: true as const,
    email: campus.email,
    school: campus.school,
    expiresInSeconds: codeTtlMinutes * 60,
    dailyRemaining: nextStats.remaining,
    devCode: shouldExposeDevCode() ? code : undefined,
  };
}

async function verifyEmailCodeForPurpose(emailValue: unknown, codeValue: unknown, purpose: EmailCodePurpose, consume = true) {
  const campus = resolveCampusEmail(emailValue);
  const email = normalizeEmail(emailValue);
  const code = typeof codeValue === "string" ? codeValue.trim() : "";
  if (!campus.valid) {
    return { ok: false as const, code: "NOT_CAMPUS_EMAIL", message: "请使用白名单内的校园邮箱。" };
  }
  if (!/^\d{6}$/.test(code)) {
    return { ok: false as const, code: "INVALID_EMAIL_CODE", message: "请输入 6 位邮箱验证码。" };
  }

  await ensureEmailVerificationTables();
  const existing = await readActiveCode(email, purpose);
  if (!existing || existing.consumed_at) {
    return { ok: false as const, code: "EMAIL_CODE_NOT_FOUND", message: "请先获取邮箱验证码。" };
  }
  if (new Date(existing.expires_at).getTime() < Date.now()) {
    return { ok: false as const, code: "EMAIL_CODE_EXPIRED", message: "验证码已过期，请重新获取。" };
  }
  if (existing.attempts >= maxAttempts) {
    return { ok: false as const, code: "EMAIL_CODE_LOCKED", message: "验证码尝试次数过多，请重新获取。" };
  }

  const expected = Buffer.from(existing.code_hash);
  const actual = Buffer.from(hashCode(email, purpose, code));
  const matches = expected.length === actual.length && timingSafeEqual(expected, actual);
  if (!matches) {
    await postgresPool.query(
      "UPDATE email_verification_codes SET attempts = attempts + 1 WHERE email = $1 AND purpose = $2",
      [email, purpose]
    );
    return { ok: false as const, code: "EMAIL_CODE_MISMATCH", message: "验证码不正确。" };
  }

  if (consume) {
    await postgresPool.query(
      "UPDATE email_verification_codes SET consumed_at = $1 WHERE email = $2 AND purpose = $3",
      [new Date().toISOString(), email, purpose]
    );
  }

  return { ok: true as const, email, school: existing.school || campus.school };
}

type EmailCodeRow = {
  email: string;
  purpose: string;
  code_hash: string;
  school: string;
  attempts: number;
  sent_at: string;
  expires_at: string;
  consumed_at: string | null;
};

async function readActiveCode(email: string, purpose: string) {
  const row = (await postgresPool.query<EmailCodeRow>(
    "SELECT * FROM email_verification_codes WHERE email = $1 AND purpose = $2",
    [email, purpose]
  )).rows[0];
  return row ?? null;
}

async function logEmailSend(input: { email: string; school: string; purpose: EmailCodePurpose; status: "sent" | "failed"; errorCode?: string }) {
  await postgresPool.query(
    `INSERT INTO email_send_logs (day_key, purpose, email, school, provider, status, error_code, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      getEmailDayKey(),
      input.purpose,
      input.email,
      input.school,
      readEmailProviderName(),
      input.status,
      input.errorCode ?? null,
      new Date().toISOString(),
    ]
  );
}

function hashCode(email: string, purpose: EmailCodePurpose, code: string) {
  const secret = process.env.EMAIL_CODE_SECRET || process.env.AUTH_TOKEN_SECRET || "ueat-email-code-dev-secret";
  return createHash("sha256").update(`${secret}:${purpose}:${email}:${code}`).digest("hex");
}

function shouldExposeDevCode() {
  return process.env.EMAIL_CODE_EXPOSE_DEV_CODE === "true" || (!process.env.SMTP_HOST && !process.env.RESEND_API_KEY && process.env.NODE_ENV !== "production");
}

function readDailySendLimit() {
  const value = Number.parseInt(process.env.EMAIL_CODE_DAILY_SEND_LIMIT ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : defaultDailySendLimit;
}

function getEmailLimitTimeZone() {
  return process.env.EMAIL_CODE_DAILY_LIMIT_TIME_ZONE || "Asia/Shanghai";
}

function getEmailDayKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: getEmailLimitTimeZone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function readEmailProviderName() {
  if (process.env.RESEND_API_KEY?.trim()) return "resend";
  if (process.env.SMTP_HOST?.trim()) return `smtp:${process.env.SMTP_HOST}`;
  return "console";
}
