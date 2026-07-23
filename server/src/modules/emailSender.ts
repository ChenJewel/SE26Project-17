import nodemailer from "nodemailer";

type VerificationEmailPurpose = "register" | "password-reset";

type VerificationEmailInput = {
  email: string;
  code: string;
  school: string;
  expiresMinutes: number;
  purpose?: VerificationEmailPurpose;
};

export async function sendCampusVerificationEmail(input: VerificationEmailInput) {
  if (process.env.RESEND_API_KEY?.trim()) {
    await sendViaResend(input);
    return;
  }

  if (process.env.SMTP_HOST?.trim()) {
    await sendViaSmtp(input);
    return;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Email provider is not configured.");
  }

  console.info(`[ueat] ${readPurposeLabel(input.purpose)} code for ${input.email}: ${input.code}`);
}

async function sendViaSmtp(input: VerificationEmailInput) {
  const port = Number.parseInt(process.env.SMTP_PORT ?? "", 10) || 587;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    auth: process.env.SMTP_USER && process.env.SMTP_PASS ? {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    } : undefined,
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER || "U eat <no-reply@ueat.local>",
    to: input.email,
    subject: buildSubject(input),
    text: buildText(input),
    html: buildHtml(input),
  });
}

async function sendViaResend(input: VerificationEmailInput) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "U eat <onboarding@resend.dev>",
      to: input.email,
      subject: buildSubject(input),
      text: buildText(input),
      html: buildHtml(input),
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend email failed: ${response.status}`);
  }
}

function buildSubject(input: VerificationEmailInput) {
  return input.purpose === "password-reset" ? "U eat 重置密码验证码" : "U eat 校园邮箱验证码";
}

function buildText(input: VerificationEmailInput) {
  return [
    `你的 U eat ${readPurposeLabel(input.purpose)}验证码是：${input.code}`,
    "",
    `学校识别：${input.school}`,
    `验证码 ${input.expiresMinutes} 分钟内有效，请勿转发给他人。`,
  ].join("\n");
}

function buildHtml(input: VerificationEmailInput) {
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.6;color:#172b25">
      <p>你的 <b>U eat</b> ${escapeHtml(readPurposeLabel(input.purpose))}验证码是：</p>
      <p style="font-size:28px;font-weight:800;letter-spacing:6px;color:#24745f">${input.code}</p>
      <p>学校识别：${escapeHtml(input.school)}</p>
      <p>验证码 ${input.expiresMinutes} 分钟内有效，请勿转发给他人。</p>
    </div>
  `;
}

function readPurposeLabel(purpose: VerificationEmailPurpose | undefined) {
  return purpose === "password-reset" ? "重置密码" : "校园邮箱";
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  }[char] ?? char));
}
