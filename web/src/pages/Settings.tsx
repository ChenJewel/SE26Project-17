import { useMemo, useState, type ReactElement } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Bell,
  ChevronRight,
  CircleHelp,
  EyeOff,
  Headphones,
  Info,
  KeyRound,
  LockKeyhole,
  LogOut,
  Moon,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserRound,
} from "lucide-react";
import {
  settingDetailContent,
  settingGroups,
  type SettingDetailContent,
  type SettingDetailRow,
  type SettingKey,
} from "@/data/settings";

const settingIcons: Record<SettingKey, ReactElement> = {
  account: <UserRound />,
  general: <SlidersHorizontal />,
  notifications: <Bell />,
  privacy: <LockKeyhole />,
  support: <Headphones />,
  about: <Info />,
  switch: <RefreshCw />,
  logout: <LogOut />,
};

export default function SettingsPage({ onBack }: { onBack: () => void }) {
  const [activeKey, setActiveKey] = useState<SettingKey | null>(null);
  const activeDetail = activeKey ? settingDetailContent[activeKey] : null;

  return (
    <main className="app-shell min-h-[100dvh] pb-8 text-[var(--text-main)]">
      <section className="mx-auto max-w-md px-4 pt-4">
        <header className="page-header relative -mx-4 mb-4 flex h-16 items-center justify-center px-4">
          <button
            aria-label={activeDetail ? "返回设置" : "返回首页"}
            onClick={activeDetail ? () => setActiveKey(null) : onBack}
            className="absolute left-4 flex h-11 w-11 items-center justify-center rounded-lg text-[var(--pine)]"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="display-cn text-[23px] text-[var(--text-main)]">{activeDetail?.title ?? "设置"}</h1>
        </header>

        {activeDetail ? <SettingDetail detail={activeDetail} /> : <SettingIndex onOpen={setActiveKey} />}
      </section>
    </main>
  );
}

function SettingIndex({ onOpen }: { onOpen: (key: SettingKey) => void }) {
  return (
    <div className="space-y-5">
      {settingGroups.map((group, groupIndex) => (
        <section key={groupIndex} className="overflow-hidden rounded-lg bg-white/82 shadow-sm ring-1 ring-[var(--line-soft)]">
          {group.map((item, itemIndex) => (
            <button
              key={item.key}
              onClick={() => onOpen(item.key)}
              className={`flex w-full items-center gap-4 px-4 py-5 text-left ${
                itemIndex ? "border-t border-[var(--line-soft)]" : ""
              }`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[rgba(209,228,221,0.72)] text-[var(--pine)] [&>svg]:h-5 [&>svg]:w-5">
                {settingIcons[item.key]}
              </span>
              <span className="min-w-0 flex-1 text-[17px] font-medium">{item.label}</span>
              {item.value ? <span className="text-sm text-[var(--text-faint)]">{item.value}</span> : null}
              <ChevronRight className="h-5 w-5 shrink-0 text-[var(--text-faint)]" />
            </button>
          ))}
        </section>
      ))}

      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 px-4 pt-2 text-sm font-black text-[var(--pine)]">
        <button>《个人信息收集清单》</button>
        <button>《第三方信息共享清单》</button>
        <button>《ueat 用户服务协议》</button>
        <button>《ueat 用户隐私政策》</button>
      </div>
    </div>
  );
}

function SettingDetail({ detail }: { detail: SettingDetailContent }) {
  const [activeRow, setActiveRow] = useState<SettingDetailRow | null>(null);
  const leadingIcon = useMemo(() => {
    if (detail.title.includes("安全")) return <ShieldCheck className="h-6 w-6" />;
    if (detail.title.includes("通知")) return <Bell className="h-6 w-6" />;
    if (detail.title.includes("隐私")) return <EyeOff className="h-6 w-6" />;
    if (detail.title.includes("帮助")) return <CircleHelp className="h-6 w-6" />;
    if (detail.title.includes("关于")) return <BadgeCheck className="h-6 w-6" />;
    if (detail.title.includes("退出")) return <Trash2 className="h-6 w-6" />;
    if (detail.title.includes("账号")) return <KeyRound className="h-6 w-6" />;
    return <Moon className="h-6 w-6" />;
  }, [detail.title]);

  return (
    <div className="space-y-5">
      <section className="soft-panel rounded-lg px-5 py-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[rgba(209,228,221,0.72)] text-[var(--pine)]">{leadingIcon}</div>
        <h2 className="mt-4 text-2xl font-bold">{detail.title}</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{detail.description}</p>
      </section>

      {detail.sections.map((section) => (
        <section key={section.title}>
          <h3 className="px-1 pb-2 text-xs font-black text-[var(--text-muted)]">{section.title}</h3>
          <div className="overflow-hidden rounded-lg bg-white/82 shadow-sm ring-1 ring-[var(--line-soft)]">
            {section.rows.map((row, index) => (
              <DetailRowView key={row.label} row={row} separated={index > 0} onOpen={() => setActiveRow(row)} />
            ))}
          </div>
        </section>
      ))}
      {activeRow ? <SettingActionSheet row={activeRow} onClose={() => setActiveRow(null)} /> : null}
    </div>
  );
}

function DetailRowView({ row, separated, onOpen }: { row: SettingDetailRow; separated: boolean; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className={`flex w-full items-center gap-3 px-4 py-4 text-left ${separated ? "border-t border-[var(--line-soft)]" : ""}`}
    >
      <span className="min-w-0 flex-1">
        <span className={`block text-[16px] font-bold ${row.type === "danger" ? "text-[var(--coral)]" : "text-[var(--text-main)]"}`}>
          {row.label}
        </span>
        {row.description ? <span className="mt-1 block text-xs leading-5 text-[var(--text-muted)]">{row.description}</span> : null}
      </span>
      {row.type === "toggle" ? <span className="h-7 w-12 rounded-full bg-[var(--pine)] p-1"><span className="block h-5 w-5 translate-x-5 rounded-full bg-white" /></span> : null}
      {row.type === "check" ? <BadgeCheck className="h-5 w-5 text-[var(--pine)]" /> : null}
      {row.value ? <span className="shrink-0 text-sm text-[var(--text-faint)]">{row.value}</span> : null}
      {row.type !== "toggle" && row.type !== "check" ? <ChevronRight className="h-5 w-5 shrink-0 text-[var(--text-faint)]" /> : null}
    </button>
  );
}

function SettingActionSheet({ row, onClose }: { row: SettingDetailRow; onClose: () => void }) {
  const danger = row.type === "danger";
  const primaryText = row.type === "toggle" ? "切换开关" : row.type === "check" ? "查看当前状态" : danger ? "继续处理" : "进入配置";

  return (
    <div className="fixed inset-0 z-[86] flex items-end bg-[rgba(18,30,25,0.32)] px-3 pb-3">
      <section className="mx-auto w-full max-w-md rounded-lg bg-[var(--surface)] p-4 shadow-[0_22px_54px_rgba(23,38,32,0.28)]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase text-[var(--pine)]">Setting</p>
            <h2 className="mt-1 text-xl font-black text-[var(--text-main)]">{row.label}</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-[var(--text-muted)]">
              {row.description ?? "这里是该设置项的原型入口。正式版会接账号、隐私、通知或帮助服务。"}
            </p>
          </div>
          <button onClick={onClose} className="safe-tap flex items-center justify-center rounded-lg bg-[rgba(209,228,221,0.72)] text-[var(--pine)]">
            <XIcon />
          </button>
        </div>
        {row.value ? (
          <div className="mb-3 rounded-lg bg-white/82 px-3 py-3 text-sm font-black text-[var(--text-main)] ring-1 ring-[var(--line-soft)]">
            当前状态：{row.value}
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onClose} className="h-11 rounded-lg bg-white/82 text-sm font-black text-[var(--text-muted)] ring-1 ring-[var(--line-soft)]">
            取消
          </button>
          <button
            onClick={onClose}
            className={`h-11 rounded-lg text-sm font-black text-white ${danger ? "bg-[var(--coral)]" : "bg-[var(--pine)]"}`}
          >
            {primaryText}
          </button>
        </div>
      </section>
    </div>
  );
}

function XIcon() {
  return <span className="text-lg font-black leading-none">×</span>;
}
