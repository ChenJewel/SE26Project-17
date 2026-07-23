import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, CheckCircle2, Copy, RefreshCw, ShieldAlert, TicketCheck, XCircle } from "lucide-react";
import {
  createInvitationCode,
  fetchAdminReports,
  fetchEmailCodeStats,
  fetchInvitationCodes,
  updateAdminReportStatus,
  updateInvitationCode,
  type EmailCodeStats,
  type InvitationCodeSummary,
  type ReportSummary,
} from "@/services/adminApi";

const reportAutoRefreshMs = 30_000;

export function AdminPanel({ onClose }: { onClose: () => void }) {
  const [stats, setStats] = useState<EmailCodeStats | null>(null);
  const [invitations, setInvitations] = useState<InvitationCodeSummary[]>([]);
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [newCode, setNewCode] = useState("");
  const [label, setLabel] = useState("内测邀请码");
  const [maxUses, setMaxUses] = useState(10);
  const [expiresInDays, setExpiresInDays] = useState(14);
  const [lastReportRefreshAt, setLastReportRefreshAt] = useState<Date | null>(null);

  const pendingReports = useMemo(() => reports.filter((report) => report.status === "pending"), [reports]);

  const refreshReportsOnly = useCallback(async () => {
    const nextReports = await fetchAdminReports();
    setReports(nextReports);
    setLastReportRefreshAt(new Date());
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setNotice("");
    try {
      const [nextStats, nextInvitations, nextReports] = await Promise.all([
        fetchEmailCodeStats(),
        fetchInvitationCodes(),
        fetchAdminReports(),
      ]);
      setStats(nextStats);
      setInvitations(nextInvitations);
      setReports(nextReports);
      setLastReportRefreshAt(new Date());
    } catch (error) {
      console.warn("Failed to load admin panel.", error);
      setNotice("管理员数据加载失败，请确认当前账号仍是管理员。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      refreshReportsOnly().catch((error) => console.warn("Failed to auto refresh reports.", error));
    }, reportAutoRefreshMs);
    return () => window.clearInterval(timer);
  }, [refreshReportsOnly]);

  const createCode = async () => {
    setLoading(true);
    setNotice("");
    try {
      const result = await createInvitationCode({ label, maxUses, expiresInDays });
      setNewCode(result.code);
      await refresh();
      setNotice("邀请码已创建，请立刻复制保存；完整邀请码之后不会再次显示。");
    } catch (error) {
      console.warn("Failed to create invitation code.", error);
      setNotice("邀请码创建失败，请稍后再试。");
    } finally {
      setLoading(false);
    }
  };

  const toggleInvitation = async (invitation: InvitationCodeSummary) => {
    setLoading(true);
    try {
      await updateInvitationCode(invitation.id, { active: !invitation.active });
      await refresh();
    } catch (error) {
      console.warn("Failed to update invitation code.", error);
      setNotice("邀请码状态更新失败。");
    } finally {
      setLoading(false);
    }
  };

  const updateReport = async (report: ReportSummary, status: ReportSummary["status"]) => {
    setLoading(true);
    try {
      await updateAdminReportStatus(report.id, status);
      await refreshReportsOnly();
    } catch (error) {
      console.warn("Failed to update report.", error);
      setNotice("举报状态更新失败。");
    } finally {
      setLoading(false);
    }
  };

  const copyNewCode = async () => {
    if (!newCode) return;
    await navigator.clipboard?.writeText(newCode).catch(() => undefined);
    setNotice("邀请码已复制。");
  };

  return (
    <main className="fixed inset-0 z-[90] overflow-y-auto bg-[var(--page-bg)] text-[var(--text-main)]">
      <section className="mx-auto max-w-md px-4 pb-8 pt-4">
        <header className="page-header relative -mx-4 mb-4 flex h-16 items-center justify-center px-4">
          <button aria-label="返回设置" onClick={onClose} className="absolute left-4 flex h-11 w-11 items-center justify-center rounded-lg text-[var(--pine)]">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="display-cn text-[23px] text-[var(--text-main)]">管理员面板</h1>
          <button aria-label="刷新管理员数据" onClick={refresh} disabled={loading} className="absolute right-4 flex h-11 w-11 items-center justify-center rounded-lg text-[var(--pine)] disabled:opacity-60">
            <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </header>

        {notice ? <p className="mb-3 rounded-lg bg-[rgba(209,228,221,0.66)] px-3 py-2 text-xs font-black leading-5 text-[var(--pine)]">{notice}</p> : null}

        <section className="rounded-lg bg-white/86 p-4 shadow-sm ring-1 ring-[var(--line-soft)]">
          <div className="flex items-center gap-2">
            <TicketCheck className="h-5 w-5 text-[var(--pine)]" />
            <h2 className="text-base font-black">验证码额度</h2>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Stat label="今日已发" value={stats ? `${stats.sentCount}` : "-"} />
            <Stat label="剩余额度" value={stats ? `${stats.remaining}` : "-"} />
            <Stat label="每日上限" value={stats ? `${stats.limit}` : "-"} />
          </div>
          <p className="mt-2 text-xs font-semibold text-[var(--text-muted)]">统计日期：{stats?.dayKey ?? "-"} · {stats?.timeZone ?? "Asia/Shanghai"}</p>
        </section>

        <section className="mt-4 rounded-lg bg-white/86 p-4 shadow-sm ring-1 ring-[var(--line-soft)]">
          <div className="flex items-center gap-2">
            <TicketCheck className="h-5 w-5 text-[var(--pine)]" />
            <h2 className="text-base font-black">创建邀请码</h2>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <LabeledInput label="备注名称" className="col-span-2">
              <input value={label} onChange={(event) => setLabel(event.target.value)} className="h-11 w-full rounded-lg bg-[var(--surface-soft)] px-3 text-sm font-bold outline-none ring-1 ring-[var(--line-soft)]" placeholder="例如：内测邀请码" />
            </LabeledInput>
            <LabeledInput label="可注册人数上限">
              <input value={maxUses} onChange={(event) => setMaxUses(Number(event.target.value) || 10)} className="h-11 w-full rounded-lg bg-[var(--surface-soft)] px-3 text-sm font-bold outline-none ring-1 ring-[var(--line-soft)]" inputMode="numeric" placeholder="默认 10 人" />
            </LabeledInput>
            <LabeledInput label="有效天数">
              <input value={expiresInDays} onChange={(event) => setExpiresInDays(Number(event.target.value) || 14)} className="h-11 w-full rounded-lg bg-[var(--surface-soft)] px-3 text-sm font-bold outline-none ring-1 ring-[var(--line-soft)]" inputMode="numeric" placeholder="默认 14 天" />
            </LabeledInput>
          </div>
          <p className="mt-2 text-xs font-semibold leading-5 text-[var(--text-muted)]">
            例如：`10` 表示最多注册 10 个用户，`14` 表示 14 天后过期。
          </p>
          <button onClick={createCode} disabled={loading} className="mt-3 h-11 w-full rounded-lg bg-[var(--pine)] text-sm font-black text-white disabled:opacity-60">
            生成邀请码
          </button>
          {newCode ? (
            <button onClick={copyNewCode} className="mt-3 flex w-full items-center justify-between rounded-lg bg-[rgba(255,247,215,0.82)] px-3 py-3 text-left ring-1 ring-[rgba(213,182,111,0.28)]">
              <span>
                <span className="block text-xs font-black text-[#806636]">新邀请码，只显示一次</span>
                <span className="mt-1 block text-sm font-black tracking-[0.08em] text-[var(--text-main)]">{newCode}</span>
              </span>
              <Copy className="h-5 w-5 text-[#806636]" />
            </button>
          ) : null}
        </section>

        <section className="mt-4 rounded-lg bg-white/86 p-4 shadow-sm ring-1 ring-[var(--line-soft)]">
          <h2 className="text-base font-black">邀请码列表</h2>
          <p className="mt-1 text-xs font-semibold leading-5 text-[var(--text-muted)]">
            列表只显示前缀，完整邀请码只在创建成功后显示一次，防止泄露。
          </p>
          <div className="mt-3 space-y-2">
            {invitations.length ? invitations.map((invitation) => (
              <div key={invitation.id} className="rounded-lg bg-[var(--surface-soft)] p-3 ring-1 ring-[var(--line-soft)]">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black">{invitation.label}</p>
                    <p className="mt-1 text-xs font-bold text-[var(--text-muted)]">前缀：{invitation.codePrefix}</p>
                    <p className="mt-1 text-xs font-bold text-[var(--text-muted)]">已用 / 上限：{invitation.usedCount}/{invitation.maxUses} · 剩余：{invitation.remaining}</p>
                    <p className="mt-1 text-xs font-bold text-[var(--text-muted)]">过期时间：{formatDate(invitation.expiresAt)}</p>
                  </div>
                  <button onClick={() => toggleInvitation(invitation)} disabled={loading} className={`h-8 rounded-md px-3 text-xs font-black text-white disabled:opacity-60 ${invitation.active && !invitation.expired ? "bg-[var(--coral)]" : "bg-[var(--pine)]"}`}>
                    {invitation.active && !invitation.expired ? "停用" : "启用"}
                  </button>
                </div>
              </div>
            )) : <p className="text-sm font-semibold text-[var(--text-muted)]">暂无邀请码。</p>}
          </div>
        </section>

        <section className="mt-4 rounded-lg bg-white/86 p-4 shadow-sm ring-1 ring-[var(--line-soft)]">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-[var(--pine)]" />
            <h2 className="text-base font-black">举报处理</h2>
          </div>
          <p className="mt-1 text-xs font-bold leading-5 text-[var(--text-muted)]">
            用户提交举报后会同步到这里；当前每 30 秒自动刷新一次，也可以点右上角刷新。
          </p>
          <p className="mt-1 text-xs font-bold text-[var(--text-muted)]">待处理 {pendingReports.length} 条，最近显示前 20 条。{lastReportRefreshAt ? `最近同步：${formatTime(lastReportRefreshAt)}` : ""}</p>
          <div className="mt-3 space-y-2">
            {reports.slice(0, 20).map((report) => (
              <div key={report.id} className="rounded-lg bg-[var(--surface-soft)] p-3 ring-1 ring-[var(--line-soft)]">
                <p className="text-xs font-black text-[var(--pine)]">{formatTargetType(report.targetType)} · {formatReportStatus(report.status)}</p>
                <p className="mt-1 text-sm font-bold text-[var(--text-main)]">{report.reason}</p>
                <p className="mt-1 truncate text-xs font-semibold text-[var(--text-muted)]">目标 ID：{report.targetId}</p>
                {report.status === "pending" ? (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button onClick={() => updateReport(report, "approved")} className="flex h-9 items-center justify-center gap-1 rounded-lg bg-[var(--pine)] text-xs font-black text-white">
                      <CheckCircle2 className="h-4 w-4" /> 通过
                    </button>
                    <button onClick={() => updateReport(report, "rejected")} className="flex h-9 items-center justify-center gap-1 rounded-lg bg-[var(--coral)] text-xs font-black text-white">
                      <XCircle className="h-4 w-4" /> 驳回
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
            {!reports.length ? <p className="text-sm font-semibold text-[var(--text-muted)]">暂无举报。</p> : null}
          </div>
        </section>
      </section>
    </main>
  );
}

function LabeledInput({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-black text-[var(--text-muted)]">{label}</span>
      {children}
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[var(--surface-soft)] p-3 ring-1 ring-[var(--line-soft)]">
      <p className="text-lg font-black text-[var(--pine)]">{value}</p>
      <p className="mt-1 text-[11px] font-bold text-[var(--text-muted)]">{label}</p>
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未知时间";
  return date.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function formatTime(value: Date) {
  return value.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatTargetType(value: ReportSummary["targetType"]) {
  const labels: Record<ReportSummary["targetType"], string> = {
    post: "帖子",
    comment: "评论",
    "meal-card": "约饭卡",
    user: "用户",
  };
  return labels[value];
}

function formatReportStatus(value: ReportSummary["status"]) {
  const labels: Record<ReportSummary["status"], string> = {
    pending: "待处理",
    approved: "已通过",
    rejected: "已驳回",
  };
  return labels[value];
}
