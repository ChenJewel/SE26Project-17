import { Download, ShieldCheck, X } from "lucide-react";
import type { AppUpdateCheckResult } from "@/types/appUpdate";

export function AppUpdatePrompt({
  result,
  notice,
  downloading,
  onDismiss,
  onInstall,
}: {
  result: AppUpdateCheckResult | null;
  notice?: string;
  downloading?: boolean;
  onDismiss: () => void;
  onInstall: () => void | Promise<void>;
}) {
  if (!result?.version?.updateAvailable) return null;

  const version = result.version;
  const canClose = !version.forceUpdate;

  return (
    <div className="app-bottom-sheet fixed inset-0 z-[150] flex items-end bg-[rgba(18,30,25,0.36)] px-3">
      <section className="mx-auto w-full max-w-md rounded-t-[28px] bg-[var(--surface)] p-5 shadow-[0_24px_62px_rgba(23,38,32,0.3)] ring-1 ring-[var(--line-soft)]">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[rgba(209,228,221,0.82)] text-[var(--pine)]">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--moss)]">U eat update</p>
            <h2 className="mt-1 text-xl font-black text-[var(--text-main)]">{"\u53d1\u73b0\u65b0\u7248\u672c "}{version.latestVersionName}</h2>
            <p className="mt-1 text-sm font-semibold text-[var(--text-muted)]">
              {"\u5f53\u524d\u7248\u672c "}{result.appInfo.versionName || result.appInfo.versionCode}{"\uff0c\u66f4\u65b0\u540e\u4f53\u9a8c\u4f1a\u66f4\u7a33\u5b9a\u3002"}
            </p>
          </div>
          {canClose ? (
            <button data-sheet-dismiss onClick={onDismiss} className="safe-tap flex items-center justify-center rounded-xl bg-[rgba(209,228,221,0.72)] text-[var(--pine)]" aria-label={"\u5173\u95ed\u66f4\u65b0\u63d0\u793a"}>
              <X className="h-5 w-5" />
            </button>
          ) : null}
        </div>

        <div className="mt-4 rounded-2xl bg-white/78 p-3 ring-1 ring-[var(--line-soft)]">
          <p className="text-sm font-black text-[var(--text-main)]">{version.forceUpdate ? "\u6b64\u7248\u672c\u9700\u8981\u66f4\u65b0\u540e\u7ee7\u7eed\u4f7f\u7528" : "\u66f4\u65b0\u5185\u5bb9"}</p>
          <ul className="mt-2 space-y-1.5 text-sm font-semibold leading-5 text-[var(--text-muted)]">
            {version.releaseNotes.map((note) => <li key={note}>{"\u00b7 "}{note}</li>)}
          </ul>
        </div>

        {notice ? <p className="mt-3 rounded-2xl bg-[rgba(209,228,221,0.62)] px-3 py-2 text-xs font-black text-[var(--pine)]">{notice}</p> : null}

        <div className={`mt-4 grid gap-2 ${canClose ? "grid-cols-2" : "grid-cols-1"}`}>
          {canClose ? (
            <button data-sheet-dismiss onClick={onDismiss} disabled={downloading} className="h-12 rounded-2xl bg-white/82 text-sm font-black text-[var(--text-muted)] ring-1 ring-[var(--line-soft)] disabled:opacity-60">
              {"\u7a0d\u540e\u518d\u8bf4"}
            </button>
          ) : null}
          <button onClick={() => void onInstall()} disabled={downloading || !version.downloadEnabled} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--pine)] text-sm font-black text-white shadow-[0_12px_28px_rgba(36,116,95,0.22)] disabled:opacity-60">
            <Download className="h-4 w-4" />
            {downloading ? "\u6b63\u5728\u542f\u52a8\u4e0b\u8f7d..." : "\u7acb\u5373\u66f4\u65b0"}
          </button>
        </div>
      </section>
    </div>
  );
}
