import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Bell,
  BellOff,
  ChevronRight,
  Database,
  Eye,
  EyeOff,
  HelpCircle,
  Info,
  KeyRound,
  LockKeyhole,
  LogOut,
  Mail,
  MessageCircle,
  Moon,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserRound,
  Utensils,
  Vibrate,
  X,
} from "lucide-react";
import { runtimeConfig } from "@/config/runtime";
import { resolveAvatarUrl } from "@/lib/mediaUrl";
import { fetchMySettings, updateMySettings } from "@/services/settingsApi";
import type { CurrentUser } from "@/types/auth";
import type { AppSettings, ToggleKey } from "@/types/settings";

type SheetState =
  | { type: "info"; title: string; body: string; primary?: string }
  | { type: "confirm"; title: string; body: string; action: () => void; danger?: boolean; primary: string };

const storageKey = "ueat-settings-v2";

const defaultSettings: AppSettings = {
  mealInvites: true,
  chatMessages: true,
  communityReplies: true,
  quietHours: false,
  profileVisible: true,
  searchable: true,
  followOnlyDm: false,
  blurSensitive: true,
  haptics: true,
  compactCards: false,
  reduceMotion: false,
  darkMode: false,
  reminderMinutes: 15,
  locationPrecision: "restaurant",
  defaultHomeFilter: "matching",
};

export default function SettingsPage({
  currentUser,
  authSummary,
  onBack,
  onLogout,
}: {
  currentUser: CurrentUser | null;
  authSummary: string;
  onBack: () => void;
  onLogout: () => void;
}) {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [cacheCleared, setCacheCleared] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSettingsLoaded(false);
    fetchMySettings()
      .then((result) => {
        if (cancelled) return;
        setSettings({ ...defaultSettings, ...result.settings });
        setSettingsLoaded(true);
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn("Failed to load cloud settings, using local fallback.", error);
        setSettingsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id]);

  useEffect(() => {
    if (!settingsLoaded) return;
    document.documentElement.classList.toggle("reduce-motion", settings.reduceMotion);
    window.localStorage.setItem(storageKey, JSON.stringify(settings));
    const timer = window.setTimeout(() => {
      updateMySettings(settings).catch((error) => console.warn("Failed to save cloud settings.", error));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [settings, settingsLoaded]);

  const accountInitial = currentUser?.avatarText || currentUser?.nickname?.slice(0, 1) || "U";
  const apiHost = useMemo(() => {
    try {
      return new URL(runtimeConfig.apiBaseUrl).host;
    } catch {
      return runtimeConfig.apiBaseUrl;
    }
  }, []);

  const setToggle = (key: ToggleKey) => {
    setSettings((current) => ({ ...current, [key]: !current[key] }));
  };

  const clearCache = () => {
    ["ueat-search-history", "ueat-card-draft", "ueat-post-draft", "ueat-last-open-tab"].forEach((key) => {
      window.localStorage.removeItem(key);
    });
    window.sessionStorage.clear();
    setCacheCleared(true);
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
    setCacheCleared(false);
  };

  const cycleReminder = () => {
    const values = [0, 10, 15, 30, 60];
    setSettings((current) => {
      const index = values.indexOf(current.reminderMinutes);
      return { ...current, reminderMinutes: values[(index + 1) % values.length] };
    });
  };

  const cycleLocation = () => {
    const next = settings.locationPrecision === "restaurant" ? "campus" : settings.locationPrecision === "campus" ? "off" : "restaurant";
    setSettings((current) => ({ ...current, locationPrecision: next }));
  };

  const cycleHomeFilter = () => {
    const next = settings.defaultHomeFilter === "matching" ? "nearby" : settings.defaultHomeFilter === "nearby" ? "all" : "matching";
    setSettings((current) => ({ ...current, defaultHomeFilter: next }));
  };

  return (
    <main className="app-shell frosted-page-shell min-h-[100dvh] pb-8 text-[var(--text-main)]">
      <section className="mx-auto max-w-md px-4 pt-4">
        <header className="page-header relative -mx-4 mb-4 flex h-16 items-center justify-center px-4">
          <button
            aria-label="返回我的"
            onClick={onBack}
            className="absolute left-4 flex h-11 w-11 items-center justify-center rounded-lg text-[var(--pine)]"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="display-cn text-[23px] text-[var(--text-main)]">设置</h1>
        </header>

        <section className="meal-card rounded-lg p-5">
          <div className="card-content flex items-center gap-4">
            <div className="display-cn flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-[#fff7d7] via-[#d5b66f] to-[#92b8a7] text-3xl text-[#28483f]">
              {currentUser?.avatarUrl ? <img src={resolveAvatarUrl(currentUser.avatarUrl)} alt="头像" className="h-full w-full object-cover" /> : accountInitial}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h2 className="display-cn truncate text-[24px] text-[#fffdf3]">{currentUser?.nickname ?? "未登录"}</h2>
                {currentUser?.campusVerified ? <BadgeCheck className="h-5 w-5 shrink-0 fill-[#d5b66f] text-[#365d51]" /> : null}
              </div>
              <p className="mt-1 truncate text-sm font-bold text-[#d8eade]">{authSummary}</p>
              <p className="mt-1 truncate text-xs font-semibold text-[#d8eade]/80">{currentUser?.email ?? "暂无账号邮箱"}</p>
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-lg bg-white/82 p-3 text-sm font-semibold leading-6 text-[var(--text-muted)] ring-1 ring-[var(--line-soft)]">
          当前设置开关先保存为本机偏好；消息免打扰、资料可见性、昵称搜索等后端权限接口尚未接入，页面不会再把这些开关当成云端已生效状态。
        </section>

        <section className="mt-2 rounded-lg bg-[rgba(129,186,194,0.24)] p-3 text-sm font-semibold leading-6 text-[var(--pine)] ring-1 ring-[var(--line-soft)]">
          设置会保存到云端账户，并保留本机缓存作为离线兜底。
        </section>

        <div className="mt-5 space-y-5">
          <SettingGroup title="账号">
            <ActionRow icon={<UserRound />} label="个人资料" value={currentUser?.schoolName ?? "待完善"} onClick={() => setSheet({
              type: "info",
              title: "个人资料",
              body: "昵称、头像、学校和简介现在在“我的”页面编辑。这里保留账号状态和资料入口，避免两个地方同时改同一份资料。",
            })} />
            <ActionRow icon={<Mail />} label="校园邮箱" value={currentUser?.campusVerified ? "已认证" : "待认证"} onClick={() => setSheet({
              type: "info",
              title: "校园邮箱",
              body: currentUser?.campusVerified
                ? "当前账号已经通过邮箱状态识别。后续可以继续接学校 SSO 或验证码复核。"
                : "当前账号还没有完整校园认证。后续可以接邮箱验证码、学校 SSO 或学生证审核。",
            })} />
            <ActionRow icon={<KeyRound />} label="登录安全" value="密码登录" onClick={() => setSheet({
              type: "info",
              title: "登录安全",
              body: "当前版本使用邮箱和密码登录。生产版建议升级为 JWT/Cookie 会话、刷新 token、设备管理和密码重置流程。",
            })} />
          </SettingGroup>

          <SettingGroup title="通知">
            <ToggleRow icon={<Utensils />} label="新的约饭邀请" enabled={settings.mealInvites} onToggle={() => setToggle("mealInvites")} />
            <ToggleRow icon={<MessageCircle />} label="聊天消息" enabled={settings.chatMessages} onToggle={() => setToggle("chatMessages")} />
            <ToggleRow icon={<Bell />} label="评论、点赞和收藏" enabled={settings.communityReplies} onToggle={() => setToggle("communityReplies")} />
            <ActionRow icon={<BellOff />} label="饭点提醒" value={settings.reminderMinutes ? `${settings.reminderMinutes} 分钟前` : "关闭"} onClick={cycleReminder} />
            <ToggleRow icon={<Moon />} label="免打扰时段" description="23:00-08:00 不弹强提醒" enabled={settings.quietHours} onToggle={() => setToggle("quietHours")} />
          </SettingGroup>

          <SettingGroup title="隐私与安全">
            <ToggleRow icon={<Eye />} label="个人主页可见" enabled={settings.profileVisible} onToggle={() => setToggle("profileVisible")} />
            <ToggleRow icon={<SlidersHorizontal />} label="允许通过昵称搜索到我" enabled={settings.searchable} onToggle={() => setToggle("searchable")} />
            <ToggleRow icon={<LockKeyhole />} label="只允许关注的人私信" enabled={settings.followOnlyDm} onToggle={() => setToggle("followOnlyDm")} />
            <ToggleRow icon={<EyeOff />} label="模糊敏感媒体预览" enabled={settings.blurSensitive} onToggle={() => setToggle("blurSensitive")} />
            <ActionRow icon={<ShieldAlert />} label="黑名单与举报记录" value="0 人" onClick={() => setSheet({
              type: "info",
              title: "黑名单与举报记录",
              body: "这里会汇总被你屏蔽的用户、被举报的帖子/评论/约饭卡，以及管理员处理状态。",
            })} />
          </SettingGroup>

          <SettingGroup title="显示与体验">
            <ActionRow icon={<SlidersHorizontal />} label="首页默认筛选" value={homeFilterLabel(settings.defaultHomeFilter)} onClick={cycleHomeFilter} />
            <ActionRow icon={<ShieldCheck />} label="位置精度" value={locationLabel(settings.locationPrecision)} onClick={cycleLocation} />
            <ToggleRow icon={<Vibrate />} label="滑卡触感反馈" enabled={settings.haptics} onToggle={() => setToggle("haptics")} />
            <ToggleRow icon={<Database />} label="紧凑卡片列表" enabled={settings.compactCards} onToggle={() => setToggle("compactCards")} />
            <ToggleRow icon={<RefreshCw />} label="减少动效" enabled={settings.reduceMotion} onToggle={() => setToggle("reduceMotion")} />
            <ToggleRow icon={<Moon />} label="深色模式" description="当前先保存偏好，后续接全局主题" enabled={settings.darkMode} onToggle={() => setToggle("darkMode")} />
          </SettingGroup>

          <SettingGroup title="数据">
            <ActionRow icon={<Database />} label="清理本地缓存" value={cacheCleared ? "已清理" : "草稿/搜索缓存"} onClick={() => setSheet({
              type: "confirm",
              title: "清理本地缓存",
              body: "会清理搜索历史、未发布草稿和临时页面状态，不会退出登录，也不会删除云端帖子、约饭卡或聊天记录。",
              primary: "清理",
              action: clearCache,
            })} />
            <ActionRow icon={<RefreshCw />} label="恢复默认设置" value="重置本页偏好" onClick={() => setSheet({
              type: "confirm",
              title: "恢复默认设置",
              body: "会把通知、隐私、显示和体验偏好恢复到默认值。",
              primary: "恢复默认",
              action: resetSettings,
            })} />
            <ActionRow icon={<Trash2 />} label="注销账号" danger onClick={() => setSheet({
              type: "info",
              title: "注销账号",
              body: "注销账号需要后端提供数据删除和冷静期流程。当前版本先保留入口，不会直接删除你的云端数据。",
            })} />
          </SettingGroup>

          <SettingGroup title="帮助与关于">
            <ActionRow icon={<HelpCircle />} label="帮助中心" value="约饭/聊天/社区" onClick={() => setSheet({
              type: "info",
              title: "帮助中心",
              body: "常见问题包括：如何发布约饭卡、如何私信、如何举报、为什么首页不展示自己的卡、过期卡片如何保留在主页。",
            })} />
            <ActionRow icon={<Info />} label="应用信息" value="v0.1.0" onClick={() => setSheet({
              type: "info",
              title: "应用信息",
              body: `ueat 校园约饭社交原型。API: ${apiHost}。当前环境: ${runtimeConfig.appTarget}。`,
            })} />
            <ActionRow icon={<ShieldCheck />} label="隐私政策与服务协议" value="查看" onClick={() => setSheet({
              type: "info",
              title: "隐私政策与服务协议",
              body: "正式上线前这里应接完整文档，包括个人信息收集清单、第三方共享清单、用户服务协议和隐私政策。",
            })} />
          </SettingGroup>

          <button
            onClick={() => setSheet({
              type: "confirm",
              title: "退出登录",
              body: "退出后会保留本机设置。再次登录后会重新同步你的云端资料、帖子、约饭卡和聊天。",
              primary: "退出登录",
              danger: true,
              action: onLogout,
            })}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[rgba(217,154,136,0.16)] text-sm font-black text-[var(--coral)] ring-1 ring-[rgba(217,154,136,0.2)]"
          >
            <LogOut className="h-4 w-4" />
            退出登录
          </button>
        </div>
      </section>

      {sheet ? <SettingSheet sheet={sheet} onClose={() => setSheet(null)} /> : null}
    </main>
  );
}

function SettingGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="px-1 pb-2 text-xs font-black uppercase tracking-wide text-[var(--text-muted)]">{title}</h2>
      <div className="overflow-hidden rounded-lg bg-white/82 shadow-sm ring-1 ring-[var(--line-soft)]">{children}</div>
    </section>
  );
}

function RowShell({ icon, children, danger, onClick }: { icon: ReactNode; children: ReactNode; danger?: boolean; onClick?: () => void }) {
  const Component = onClick ? "button" : "div";
  return (
    <Component
      onClick={onClick}
      className="flex w-full items-center gap-3 border-b border-[var(--line-soft)] px-4 py-4 text-left last:border-b-0"
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg [&>svg]:h-5 [&>svg]:w-5 ${
        danger ? "bg-[rgba(221,67,80,0.14)] text-[var(--coral)]" : "bg-[rgba(129,186,194,0.24)] text-[var(--pine)]"
      }`}>
        {icon}
      </span>
      {children}
    </Component>
  );
}

function ActionRow({
  icon,
  label,
  value,
  description,
  danger,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value?: string;
  description?: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <RowShell icon={icon} danger={danger} onClick={onClick}>
      <span className="min-w-0 flex-1">
        <span className={`block text-[15px] font-black ${danger ? "text-[var(--coral)]" : "text-[var(--text-main)]"}`}>{label}</span>
        {description ? <span className="mt-1 block text-xs font-semibold leading-5 text-[var(--text-muted)]">{description}</span> : null}
      </span>
      {value ? <span className="max-w-[118px] truncate text-right text-xs font-bold text-[var(--text-faint)]">{value}</span> : null}
      <ChevronRight className="h-5 w-5 shrink-0 text-[var(--text-faint)]" />
    </RowShell>
  );
}

function ToggleRow({
  icon,
  label,
  description,
  enabled,
  onToggle,
}: {
  icon: ReactNode;
  label: string;
  description?: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <RowShell icon={icon} onClick={onToggle}>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-black text-[var(--text-main)]">{label}</span>
        {description ? <span className="mt-1 block text-xs font-semibold leading-5 text-[var(--text-muted)]">{description}</span> : null}
      </span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full p-1 transition ${enabled ? "bg-[var(--pine)]" : "bg-[rgba(159,174,166,0.34)]"}`}>
        <span className={`app-toggle-knob block h-5 w-5 rounded-full bg-white shadow-sm ${enabled ? "translate-x-5" : ""}`} />
      </span>
    </RowShell>
  );
}

function SettingSheet({ sheet, onClose }: { sheet: SheetState; onClose: () => void }) {
  const runAction = () => {
    if (sheet.type === "confirm") sheet.action();
    onClose();
  };

  return (
    <div className="app-bottom-sheet fixed inset-0 z-[86] flex items-end bg-[rgba(18,30,25,0.32)] px-3">
      <section className="mx-auto w-full max-w-md rounded-lg bg-[var(--surface)] p-4 shadow-[0_22px_54px_rgba(23,38,32,0.28)]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase text-[var(--pine)]">{sheet.type === "confirm" ? "Confirm" : "Setting"}</p>
            <h2 className="mt-1 text-xl font-black text-[var(--text-main)]">{sheet.title}</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-[var(--text-muted)]">{sheet.body}</p>
          </div>
          <button data-sheet-dismiss onClick={onClose} className="safe-tap flex items-center justify-center rounded-lg bg-[rgba(129,186,194,0.24)] text-[var(--pine)]">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button data-sheet-dismiss onClick={onClose} className="h-11 rounded-lg bg-white/82 text-sm font-black text-[var(--text-muted)] ring-1 ring-[var(--line-soft)]">
            取消
          </button>
          <button
            onClick={sheet.type === "confirm" ? runAction : onClose}
            className={`h-11 rounded-lg text-sm font-black text-white ${sheet.type === "confirm" && sheet.danger ? "bg-[var(--coral)]" : "bg-[var(--pine)]"}`}
          >
            {sheet.type === "confirm" ? sheet.primary : sheet.primary ?? "知道了"}
          </button>
        </div>
      </section>
    </div>
  );
}

function loadSettings(): AppSettings {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return defaultSettings;
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return defaultSettings;
  }
}

function homeFilterLabel(value: AppSettings["defaultHomeFilter"]) {
  if (value === "nearby") return "附近优先";
  if (value === "all") return "全部";
  return "匹配优先";
}

function locationLabel(value: AppSettings["locationPrecision"]) {
  if (value === "off") return "关闭";
  if (value === "campus") return "仅校区";
  return "餐厅/校区";
}
