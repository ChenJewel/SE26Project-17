/**
 * 注册/登录页。
 *
 * 当前接入云端 Auth API；后端仍是演示级 token，后续会升级为正式 JWT/session。
 */
import { useMemo, useState, type ReactNode } from "react";
import { ArrowRight, BadgeCheck, Eye, EyeOff, GraduationCap, LockKeyhole, Mail, Sparkles, UserRound } from "lucide-react";
import type { AuthDraft, AuthMode } from "@/types/auth";

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
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  const schoolHint = useMemo(() => {
    if (!domain) return "输入校园邮箱后自动识别学校";
    if (domain.endsWith("fudan.edu.cn")) return "复旦大学 · 可校园认证";
    if (domain.endsWith("sjtu.edu.cn")) return "上海交通大学 · 可校园认证";
    if (domain.endsWith("tongji.edu.cn")) return "同济大学 · 可校园认证";
    if (domain.endsWith("edu") || domain.endsWith("edu.cn")) return "校园邮箱 · 待匹配学校库";
    return "普通邮箱 · 后续可补校园认证";
  }, [domain]);

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    const draft = { email: email.trim(), password, nickname: nickname.trim() };
    await (mode === "login" ? onLogin(draft) : onRegister(draft));
    setSubmitting(false);
  };

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setPassword("");
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
                  mode === item ? "bg-white text-[var(--pine)] shadow-sm" : "text-[var(--text-muted)]"
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

            <AuthField icon={<Mail />} label="邮箱">
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-full min-w-0 flex-1 bg-transparent text-sm font-bold outline-none placeholder:text-[var(--text-faint)]"
                placeholder="student@school.edu"
                type="email"
              />
            </AuthField>

            <AuthField icon={<LockKeyhole />} label="密码">
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
          </div>

          <div className="mt-4 rounded-lg bg-[rgba(209,228,221,0.56)] p-3">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-[var(--pine)]" />
              <p className="text-sm font-black text-[var(--text-main)]">校园认证</p>
            </div>
            <p className="mt-1 text-xs font-bold leading-5 text-[var(--text-muted)]">{schoolHint}</p>
          </div>

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
            {submitting ? "正在连接云端..." : mode === "login" ? "登录并进入 ueat" : "注册并进入 ueat"}
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
