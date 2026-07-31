/**
 * 注册/登录页。
 *
 * 当前接入云端 Auth API；后端仍是演示级 token，后续会升级为正式 JWT/session。
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowRight, BadgeCheck, Eye, EyeOff, GraduationCap, LockKeyhole, Mail, Sparkles, UserRound } from "lucide-react";
import { ApiError } from "@/services/apiClient";
import { resetPasswordWithEmail, sendEmailCode, sendPasswordResetCode } from "@/services/authApi";
import type { AuthDraft, AuthMode } from "@/types/auth";

const mbtiOptions = ["INTJ", "INTP", "ENTJ", "ENTP", "INFJ", "INFP", "ENFJ", "ENFP", "ISTJ", "ISFJ", "ESTJ", "ESFJ", "ISTP", "ISFP", "ESTP", "ESFP"];

export default function AuthPage({
  notice,
  onLogin,
  onRegister,
}: {
  notice: string;
  onLogin: (draft: AuthDraft) => Promise<boolean>;
  onRegister: (draft: AuthDraft) => Promise<boolean>;
}) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [mbti, setMbti] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [codeNotice, setCodeNotice] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  const schoolHint = useMemo(() => {
    if (!domain) return "输入校园邮箱后自动识别学校";
    if (domain.endsWith("fudan.edu.cn")) return "复旦大学 · 可校园认证";
    if (domain.endsWith("sjtu.edu.cn")) return "上海交通大学 · 可校园认证";
    if (domain.endsWith("tongji.edu.cn")) return "同济大学 · 可校园认证";
    if (domain.endsWith(".edu") || domain.endsWith(".edu.cn")) return "暂未加入白名单 · 请联系管理员添加学校邮箱";
    return "普通邮箱 · 不能发送验证码";
  }, [domain]);

  const campusEmail = useMemo(() => isCampusEmail(email), [email]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    const draft = { email: email.trim(), password, nickname: nickname.trim(), mbti: mbti.trim(), emailCode: emailCode.trim(), inviteCode: inviteCode.trim() };
    try {
      if (mode === "reset") {
        await resetPasswordWithEmail({ email: draft.email, password: draft.password, emailCode: draft.emailCode ?? "" });
        setMode("login");
        setPassword("");
        setEmailCode("");
        setInviteCode("");
        setCodeNotice("密码已重置，请用新密码登录。");
        return;
      }
      await (mode === "login" ? onLogin(draft) : onRegister(draft));
    } finally {
      setSubmitting(false);
    }
  };

  const requestCode = async () => {
    if (sendingCode || cooldown > 0) return;
    if (!campusEmail) {
      setCodeNotice("请先输入校园邮箱，普通邮箱不能发送验证码。");
      return;
    }

    setSendingCode(true);
    setCodeNotice("");
    try {
      const result = mode === "reset" ? await sendPasswordResetCode(email.trim()) : await sendEmailCode(email.trim());
      setCooldown(60);
      const prefix = mode === "reset" ? "如果该邮箱已注册，重置验证码会发送到" : "验证码已发送到";
      setCodeNotice(result.devCode ? `${prefix} ${result.school} 邮箱。开发验证码：${result.devCode}` : `${prefix} ${result.school} 邮箱。`);
    } catch (error) {
      if (mode === "register" && error instanceof ApiError && error.status === 409) {
        setCodeNotice("这个邮箱已经注册过了，请直接登录。");
      } else if (error instanceof ApiError && error.status === 429) {
        setCodeNotice("发送太频繁，请稍后再试。");
      } else {
        setCodeNotice(readApiMessage(error) || "验证码发送失败，请确认是校园邮箱。");
      }
    } finally {
      setSendingCode(false);
    }
  };
  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setPassword("");
    setEmailCode("");
    setInviteCode("");
    setCodeNotice("");
  };

  return (
    <main className="min-h-[100dvh] bg-[var(--page-bg)] px-5 py-6 text-[var(--text-main)]">
      <section className="mx-auto flex min-h-[calc(100dvh-48px)] max-w-md flex-col">
        <header className="pt-2">
          <div className="flex items-center gap-3">
            <span className="display-cn flex h-14 w-14 items-center justify-center rounded-lg bg-[var(--pine)] text-2xl text-white shadow-[0_14px_28px_rgba(63,111,96,0.24)]">
              U
            </span>
            <div>
              <p className="text-xs font-black uppercase text-[var(--pine)]">ueat</p>
              <h1 className="display-cn text-[30px] leading-tight">校园约饭，从邮箱开始</h1>
            </div>
          </div>
          <p className="mt-4 text-sm font-semibold leading-6 text-[var(--text-muted)]">
            注册会创建一个全新账号；已经注册过的邮箱请直接登录。
          </p>
        </header>

        <section className="mt-6 rounded-lg bg-white/86 p-4 shadow-sm ring-1 ring-[var(--line-soft)]">
          <div className="grid grid-cols-2 rounded-lg bg-[var(--surface-soft)] p-1">
            {(["login", "register"] as const).map((item) => (
              <button
                key={item}
                onClick={() => switchMode(item)}
                className={`h-10 rounded-lg text-sm font-black transition ${
                  mode === item || (mode === "reset" && item === "login") ? "bg-white text-[var(--pine)] shadow-sm" : "text-[var(--text-muted)]"
                }`}
              >
                {item === "login" ? "登录" : "注册"}
              </button>
            ))}
          </div>

          <div className="mt-5 space-y-3">
            {mode === "register" ? (
              <AuthField icon={<UserRound />} label="昵称">
                <input
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  className="h-full min-w-0 flex-1 bg-transparent text-sm font-bold outline-none placeholder:text-[var(--text-faint)]"
                  placeholder="例如：林同学"
                />
              </AuthField>
            ) : null}

            {mode === "register" ? (
              <label className="block">
                <span className="mb-2 block text-xs font-black text-[var(--text-muted)]">MBTI（可选）</span>
                <select
                  value={mbti}
                  onChange={(event) => setMbti(event.target.value)}
                  className="h-12 w-full rounded-lg bg-[var(--surface-soft)] px-3 text-sm font-bold text-[var(--text-main)] outline-none ring-1 ring-[var(--line-soft)] focus:ring-[var(--moss)]"
                >
                  <option value="">暂不填写</option>
                  {mbtiOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
            ) : null}

            <AuthField icon={<Mail />} label="邮箱">
              <input
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setCodeNotice("");
                }}
                className="h-full min-w-0 flex-1 bg-transparent text-sm font-bold outline-none placeholder:text-[var(--text-faint)]"
                placeholder="student@school.edu"
                type="email"
              />
            </AuthField>

            {mode !== "login" ? (
              <AuthField icon={<BadgeCheck />} label="邮箱验证码">
                <input
                  value={emailCode}
                  onChange={(event) => setEmailCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void submit();
                  }}
                  className="h-full min-w-0 flex-1 bg-transparent text-sm font-bold tracking-[0.18em] outline-none placeholder:tracking-normal placeholder:text-[var(--text-faint)]"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="6 位验证码"
                />
                <button
                  type="button"
                  onClick={requestCode}
                  disabled={!campusEmail || sendingCode || cooldown > 0}
                  className="h-8 shrink-0 rounded-md bg-[var(--pine)] px-3 text-xs font-black text-white transition disabled:bg-[var(--text-faint)] disabled:opacity-70"
                >
                  {sendingCode ? "发送中" : cooldown > 0 ? `${cooldown}s` : mode === "reset" ? "发送重置码" : "发送验证码"}
                </button>
              </AuthField>
            ) : null}

            {mode === "register" ? (
              <AuthField icon={<GraduationCap />} label="邀请码（可替代验证码）">
                <input
                  value={inviteCode}
                  onChange={(event) => setInviteCode(event.target.value.toUpperCase().replace(/\s/g, ""))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void submit();
                  }}
                  className="h-full min-w-0 flex-1 bg-transparent text-sm font-bold tracking-[0.08em] outline-none placeholder:tracking-normal placeholder:text-[var(--text-faint)]"
                  placeholder="UEAT-XXXXXX"
                />
              </AuthField>
            ) : null}

            <AuthField icon={<LockKeyhole />} label={mode === "reset" ? "新密码" : "密码"}>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void submit();
                }}
                className="h-full min-w-0 flex-1 bg-transparent text-sm font-bold outline-none placeholder:text-[var(--text-faint)]"
                placeholder="至少 6 位"
                type={showPassword ? "text" : "password"}
              />
              <button onClick={() => setShowPassword((value) => !value)} className="text-[var(--text-faint)]" aria-label="显示或隐藏密码">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </AuthField>

            {mode === "login" ? (
              <button
                type="button"
                onClick={() => switchMode("reset")}
                className="text-xs font-black text-[var(--pine)]"
              >
                忘记密码？用校园邮箱重置
              </button>
            ) : mode === "reset" ? (
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="text-xs font-black text-[var(--pine)]"
              >
                想起来了，返回登录
              </button>
            ) : null}
          </div>

          <div className="mt-4 rounded-lg bg-[rgba(209,228,221,0.56)] p-3">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-[var(--pine)]" />
              <p className="text-sm font-black text-[var(--text-main)]">校园认证</p>
            </div>
            <p className="mt-1 text-xs font-bold leading-5 text-[var(--text-muted)]">{schoolHint}</p>
            {mode === "register" ? (
              <p className="mt-1 text-xs font-bold leading-5 text-[var(--text-muted)]">
                只有白名单校园邮箱可以注册；可用邮箱验证码，或使用管理员发放的邀请码。
              </p>
            ) : mode === "reset" ? (
              <p className="mt-1 text-xs font-bold leading-5 text-[var(--text-muted)]">
                使用注册时的校园邮箱接收验证码，然后设置新密码。
              </p>
            ) : null}
          </div>

          {codeNotice ? (
            <p className="mt-3 rounded-lg bg-[rgba(209,228,221,0.5)] px-3 py-2 text-xs font-black leading-5 text-[var(--pine)]">
              {codeNotice}
            </p>
          ) : null}

          {notice ? (
            <p className="mt-3 rounded-lg bg-[rgba(255,247,215,0.8)] px-3 py-2 text-xs font-black text-[#806636]">
              {notice}
            </p>
          ) : null}

          <button
            onClick={submit}
            disabled={submitting}
            className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[var(--pine)] text-sm font-black text-white shadow-[0_12px_26px_rgba(63,111,96,0.22)] disabled:opacity-70"
          >
            {submitting ? "正在连接云端..." : mode === "login" ? "登录并进入 ueat" : mode === "reset" ? "重置密码" : "注册并进入 ueat"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </section>

        <section className="mt-4 grid grid-cols-3 gap-2">
          <AuthPromise icon={<BadgeCheck />} title="邮箱认证" />
          <AuthPromise icon={<Sparkles />} title="真实约饭" />
          <AuthPromise icon={<GraduationCap />} title="校园关系" />
        </section>
      </section>
    </main>
  );
}

function AuthField({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black text-[var(--text-muted)]">{label}</span>
      <span className="flex h-12 items-center gap-2 rounded-lg bg-[var(--surface-soft)] px-3 ring-1 ring-[var(--line-soft)] focus-within:ring-[var(--moss)]">
        <span className="text-[var(--pine)] [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
        {children}
      </span>
    </label>
  );
}

function AuthPromise({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="rounded-lg bg-white/76 p-3 text-center ring-1 ring-[var(--line-soft)]">
      <span className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-[rgba(209,228,221,0.7)] text-[var(--pine)] [&>svg]:h-4 [&>svg]:w-4">
        {icon}
      </span>
      <p className="mt-2 text-xs font-black text-[var(--text-main)]">{title}</p>
    </div>
  );
}

function isCampusEmail(value: string) {
  const emailValue = value.trim().toLowerCase();
  const domain = emailValue.split("@")[1] ?? "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue) || !domain) return false;

  const knownDomains = [
    "fudan.edu.cn",
    "m.fudan.edu.cn",
    "sjtu.edu.cn",
    "tongji.edu.cn",
    "pku.edu.cn",
    "stu.pku.edu.cn",
    "tsinghua.edu.cn",
    "mails.tsinghua.edu.cn",
    "zju.edu.cn",
    "mail.ustc.edu.cn",
    "ustc.edu.cn",
    "nju.edu.cn",
    "ruc.edu.cn",
    "buaa.edu.cn",
    "bupt.edu.cn",
    "ecnu.edu.cn",
    "shufe.edu.cn",
  ];

  return knownDomains.some((item) => domain === item || domain.endsWith(`.${item}`));
}

function readApiMessage(error: unknown) {
  if (!(error instanceof ApiError)) return "";
  const payload = error.payload as { error?: { message?: unknown } } | undefined;
  return typeof payload?.error?.message === "string" ? payload.error.message : "";
}
