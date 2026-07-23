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
  Keyboard,
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
import { AdminPanel } from "@/components/AdminPanel";
import { useAppUpdatePrompt } from "@/hooks/useAppUpdate";
import { useOnboardingHints } from "@/hooks/useOnboardingHints";
import { resolveAvatarUrl } from "@/lib/mediaUrl";
import { fetchMySettings, updateMySettings } from "@/services/settingsApi";
import { fetchBlockedUsers, unblockUser, type BlockedUser } from "@/services/userApi";
import type { AppUpdateCheckResult } from "@/types/appUpdate";
import type { CurrentUser } from "@/types/auth";
import type { AppSettings, ToggleKey } from "@/types/settings";

type SheetState =
  | { type: "info"; title: string; body: string; primary?: string }
  | { type: "confirm"; title: string; body: string; action: () => void | Promise<void>; danger?: boolean; primary: string }
  | { type: "blocks"; title: string; body: string };

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
  aiIcebreaker: true,
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
  onDeleteAccount,
}: {
  currentUser: CurrentUser | null;
  authSummary: string;
  onBack: () => void;
  onLogout: () => void | Promise<void>;
  onDeleteAccount: () => void | Promise<void>;
}) {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [cacheCleared, setCacheCleared] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [blockStatus, setBlockStatus] = useState("");
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);
  const appUpdate = useAppUpdatePrompt(false);
  const { resetOnboardingHints } = useOnboardingHints(currentUser?.id);

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

  const loadBlockedUsers = async () => {
    try {
      const users = await fetchBlockedUsers();
      setBlockedUsers(users);
      setBlockStatus(users.length ? `已屏蔽 ${users.length} 人` : "黑名单为空");
    } catch (error) {
      console.warn("Failed to load blocked users.", error);
      setBlockStatus("黑名单加载失败，请稍后再试");
    }
  };

  useEffect(() => {
    if (!currentUser?.id) {
      setBlockedUsers([]);
      setBlockStatus("");
      return;
    }
    void loadBlockedUsers();
  }, [currentUser?.id]);

  const accountInitial = currentUser?.avatarText || currentUser?.nickname?.slice(0, 1) || "U";
  const apiHost = useMemo(() => {
    try {
      return new URL(runtimeConfig.apiBaseUrl).host;
    } catch {
      return runtimeConfig.apiBaseUrl;
    }
  }, []);

  const setToggle = (key: ToggleKey) => setSettings((current) => ({ ...current, [key]: !current[key] }));
  const clearCache = () => {
    ["ueat-search-history", "ueat-card-draft", "ueat-post-draft", "ueat-last-open-tab"].forEach((key) => window.localStorage.removeItem(key));
    window.sessionStorage.clear();
    setCacheCleared(true);
  };
  const resetSettings = () => {
    setSettings(defaultSettings);
    setCacheCleared(false);
  };
  const replayOnboardingHints = () => {
    resetOnboardingHints();
    setSheet({
      type: "info",
      title: "新手指导已恢复",
      body: "回到首页、我的页、聊天设置或桌宠衣柜时，对应的新手提示会重新出现。",
      primary: "知道了",
    });
  };
  const cycleReminder = () => {
    const values = [0, 10, 15, 30, 60];
    setSettings((current) => ({ ...current, reminderMinutes: values[(values.indexOf(current.reminderMinutes) + 1) % values.length] }));
  };
  const cycleLocation = () => {
    const next = settings.locationPrecision === "restaurant" ? "campus" : settings.locationPrecision === "campus" ? "off" : "restaurant";
    setSettings((current) => ({ ...current, locationPrecision: next }));
  };
  const cycleHomeFilter = () => {
    const next = settings.defaultHomeFilter === "matching" ? "nearby" : settings.defaultHomeFilter === "nearby" ? "all" : "matching";
    setSettings((current) => ({ ...current, defaultHomeFilter: next }));
  };
  const openBlockedUsers = () => {
    setSheet({ type: "blocks", title: "黑名单 / 屏蔽", body: "被你屏蔽的人不会出现在消息、饭卡、帖子、评论和桌宠里。" });
    void loadBlockedUsers();
  };
  const checkAppUpdate = async () => {
    try {
      const result = await appUpdate.checkForUpdate();
      if (!result.version) {
        setSheet({
          type: "info",
          title: "请在手机 App 内检查",
          body: "当前环境没有检测到 UeatNative App 壳，网页端无法读取 APK 版本。手机 App 内会自动读取当前安装版本。",
          primary: "知道了",
        });
        return;
      }

      if (result.version.latestVersionCode <= 0) {
        setSheet({
          type: "info",
          title: "版本中心未配置",
          body: "服务端更新接口已经可用，但还没有配置最新 APK 的版本号、下载地址和校验值。配置完成后这里会显示真实更新状态。",
          primary: "知道了",
        });
        return;
      }

      if (!result.updateAvailable) {
        setSheet({
          type: "info",
          title: "当前已是最新版本",
          body: `当前版本 ${result.appInfo.versionName}（${result.appInfo.versionCode}），最新版本 ${result.version.latestVersionName}（${result.version.latestVersionCode}）。`,
          primary: "知道了",
        });
        return;
      }

      setSheet({
        type: "confirm",
        title: `发现新版本 ${result.version.latestVersionName}`,
        body: formatUpdateSheetBody(result),
        primary: result.version.downloadEnabled ? "立即下载" : "暂无安装包",
        action: () => appUpdate.installUpdate(result),
      });
    } catch (error) {
      console.warn("Failed to check app update manually.", error);
      setSheet({
        type: "info",
        title: "检查更新失败",
        body: "暂时无法连接版本中心，请稍后再试。",
        primary: "知道了",
      });
    }
  };

  const removeBlockedUser = async (userId: string) => {
    const previous = blockedUsers;
    setBlockedUsers((current) => current.filter((user) => user.id !== userId));
    setBlockStatus("已解除屏蔽，正在同步…");
    try {
      await unblockUser(userId);
      await loadBlockedUsers();
    } catch (error) {
      console.warn("Failed to unblock user.", error);
      setBlockedUsers(previous);
      setBlockStatus("解除失败，请稍后再试");
    }
  };

  return (
    <main className="app-shell min-h-[100dvh] bg-[var(--page-bg)] pb-8 text-[var(--text-main)]">
      <section className="mx-auto max-w-md px-4 pt-4">
        <header className="page-header relative -mx-4 mb-4 flex h-16 items-center justify-center px-4">
          <button aria-label="返回我的" onClick={onBack} className="absolute left-4 flex h-11 w-11 items-center justify-center rounded-lg text-[var(--pine)]">
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

        <div className="mt-5 space-y-5">
          <SettingGroup title="账号">
            <ActionRow icon={<UserRound />} label="个人资料" value={currentUser?.schoolName ?? "待完善"} onClick={() => setSheet({ type: "info", title: "个人资料", body: "昵称、头像、学校和简介现在在“我的”页面编辑。" })} />
            <ActionRow icon={<Mail />} label="校园邮箱" value={currentUser?.campusVerified ? "已认证" : "待认证"} onClick={() => setSheet({ type: "info", title: "校园邮箱", body: currentUser?.campusVerified ? "当前账号已通过校园邮箱识别。" : "当前账号还没有完整校园认证。" })} />
            <ActionRow icon={<KeyRound />} label="登录安全" value="密码登录" onClick={() => setSheet({ type: "info", title: "登录安全", body: "当前版本使用邮箱和密码登录。" })} />
          </SettingGroup>

          {currentUser?.role === "admin" ? (
            <SettingGroup title={"\u7ba1\u7406\u5458"}>
              <ActionRow icon={<ShieldCheck />} label={"\u7ba1\u7406\u5458\u9762\u677f"} value={"\u9a8c\u8bc1\u7801/\u9080\u8bf7\u7801/\u4e3e\u62a5"} onClick={() => setAdminPanelOpen(true)} />
            </SettingGroup>
          ) : null}

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
            <ToggleRow icon={<Keyboard />} label="AI 破冰助手" description="聊天键盘推荐话题和回复" enabled={settings.aiIcebreaker} onToggle={() => setToggle("aiIcebreaker")} />
            <ActionRow icon={<ShieldAlert />} label="黑名单 / 屏蔽" value={`${blockedUsers.length} 人`} onClick={openBlockedUsers} />
          </SettingGroup>

          <SettingGroup title="显示与体验">
            <ActionRow icon={<SlidersHorizontal />} label="首页默认筛选" value={homeFilterLabel(settings.defaultHomeFilter)} onClick={cycleHomeFilter} />
            <ActionRow icon={<ShieldCheck />} label="位置精度" value={locationLabel(settings.locationPrecision)} onClick={cycleLocation} />
            <ToggleRow icon={<Vibrate />} label="滑卡触感反馈" enabled={settings.haptics} onToggle={() => setToggle("haptics")} />
            <ToggleRow icon={<Database />} label="紧凑卡片列表" enabled={settings.compactCards} onToggle={() => setToggle("compactCards")} />
            <ToggleRow icon={<RefreshCw />} label="减少动效" enabled={settings.reduceMotion} onToggle={() => setToggle("reduceMotion")} />
            <ToggleRow icon={<Moon />} label="深色模式" enabled={settings.darkMode} onToggle={() => setToggle("darkMode")} />
          </SettingGroup>

          <SettingGroup title="数据">
            <ActionRow icon={<Database />} label="清理本地缓存" value={cacheCleared ? "已清理" : "草稿/搜索缓存"} onClick={() => setSheet({ type: "confirm", title: "清理本地缓存", body: "会清理搜索历史、未发布草稿和临时页面状态。", primary: "清理", action: clearCache })} />
            <ActionRow icon={<RefreshCw />} label="恢复默认设置" value="重置本页偏好" onClick={() => setSheet({ type: "confirm", title: "恢复默认设置", body: "会把通知、隐私、显示和体验偏好恢复到默认值。", primary: "恢复默认", action: resetSettings })} />
            <ActionRow icon={<Trash2 />} label="注销账号" danger onClick={() => setSheet({ type: "confirm", title: "确认永久注销账号？", body: "注销后会删除你的云端账号数据，操作完成后会自动退出登录。", primary: "永久注销", danger: true, action: onDeleteAccount })} />
          </SettingGroup>

          <SettingGroup title="帮助与关于">
            <ActionRow icon={<HelpCircle />} label="重新显示新手指导" value="首页/桌宠/衣柜/背景" onClick={() => setSheet({ type: "confirm", title: "重新显示新手指导？", body: "会清除本账号本机的新手提示已读记录。之后回到相关页面时，提示会按场景重新出现。", primary: "重新显示", action: replayOnboardingHints })} />
            <ActionRow icon={<HelpCircle />} label="帮助中心" value="约饭/聊天/社区" onClick={() => setSheet({ type: "info", title: "帮助中心", body: "常见问题包括：如何发布约饭卡、如何私信、如何举报和如何管理黑名单。" })} />
            <ActionRow icon={<Info />} label="应用信息" value="v0.1.0" onClick={() => setSheet({ type: "info", title: "应用信息", body: `ueat 校园约饭社交原型。API: ${apiHost}。当前环境：${runtimeConfig.appTarget}。` })} />
          </SettingGroup>

          <SettingGroup title="应用更新">
            <ActionRow icon={<RefreshCw />} label="检查更新" value={appUpdate.checking ? "检查中..." : "App 版本"} onClick={checkAppUpdate} />
          </SettingGroup>

          <button onClick={() => setSheet({ type: "confirm", title: "退出登录", body: "退出后会保留本地设置。", primary: "退出登录", danger: true, action: onLogout })} className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[rgba(217,154,136,0.16)] text-sm font-black text-[var(--coral)] ring-1 ring-[rgba(217,154,136,0.2)]">
            <LogOut className="h-4 w-4" />
            退出登录
          </button>
        </div>
      </section>

      {sheet ? <SettingSheet sheet={sheet} blockedUsers={blockedUsers} blockStatus={blockStatus} onUnblock={removeBlockedUser} onClose={() => setSheet(null)} /> : null}
      {adminPanelOpen ? <AdminPanel onClose={() => setAdminPanelOpen(false)} /> : null}
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
    <Component onClick={onClick} className="flex w-full items-center gap-3 border-b border-[var(--line-soft)] px-4 py-4 text-left last:border-b-0">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg [&>svg]:h-5 [&>svg]:w-5 ${danger ? "bg-[rgba(217,154,136,0.16)] text-[var(--coral)]" : "bg-[rgba(209,228,221,0.72)] text-[var(--pine)]"}`}>
        {icon}
      </span>
      {children}
    </Component>
  );
}

function ActionRow({ icon, label, value, description, danger, onClick }: { icon: ReactNode; label: string; value?: string; description?: string; danger?: boolean; onClick: () => void }) {
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

function ToggleRow({ icon, label, description, enabled, onToggle }: { icon: ReactNode; label: string; description?: string; enabled: boolean; onToggle: () => void }) {
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

function SettingSheet({ sheet, blockedUsers, blockStatus, onUnblock, onClose }: { sheet: SheetState; blockedUsers: BlockedUser[]; blockStatus: string; onUnblock: (userId: string) => Promise<void>; onClose: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const runAction = async () => {
    if (sheet.type !== "confirm" || submitting) return;
    setSubmitting(true);
    try {
      await sheet.action();
      onClose();
    } finally {
      setSubmitting(false);
    }
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
          <button data-sheet-dismiss onClick={onClose} disabled={submitting} className="safe-tap flex items-center justify-center rounded-lg bg-[rgba(209,228,221,0.72)] text-[var(--pine)] disabled:opacity-60">
            <X className="h-5 w-5" />
          </button>
        </div>

        {sheet.type === "blocks" ? (
          <div className="mb-4 max-h-[52dvh] space-y-2 overflow-y-auto pr-1">
            {blockStatus ? <p className="rounded-lg bg-[rgba(209,228,221,0.62)] px-3 py-2 text-xs font-black text-[var(--pine)]">{blockStatus}</p> : null}
            {blockedUsers.length ? blockedUsers.map((user) => (
              <div key={user.id} className="flex items-center gap-3 rounded-lg bg-white/86 p-3 ring-1 ring-[var(--line-soft)]">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[rgba(209,228,221,0.72)] text-sm font-black text-[var(--pine)]">
                  {user.avatarUrl ? <img src={resolveAvatarUrl(user.avatarUrl)} alt={user.nickname} className="h-full w-full object-cover" /> : user.avatarText}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-[var(--text-main)]">{user.nickname}</p>
                  <p className="truncate text-xs font-semibold text-[var(--text-muted)]">{user.school ?? user.bio ?? "已屏蔽用户"}</p>
                </div>
                <button
                  onClick={async () => {
                    if (unblockingId) return;
                    setUnblockingId(user.id);
                    try {
                      await onUnblock(user.id);
                    } finally {
                      setUnblockingId(null);
                    }
                  }}
                  disabled={Boolean(unblockingId)}
                  className="h-9 shrink-0 rounded-lg bg-[rgba(217,154,136,0.16)] px-3 text-xs font-black text-[var(--coral)] ring-1 ring-[rgba(217,154,136,0.24)] disabled:opacity-60"
                >
                  {unblockingId === user.id ? "同步中" : "解除"}
                </button>
              </div>
            )) : (
              <p className="rounded-lg bg-white/82 p-4 text-center text-sm font-semibold text-[var(--text-muted)] ring-1 ring-[var(--line-soft)]">还没有屏蔽任何人。</p>
            )}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <button data-sheet-dismiss onClick={onClose} disabled={submitting} className="h-11 rounded-lg bg-white/82 text-sm font-black text-[var(--text-muted)] ring-1 ring-[var(--line-soft)] disabled:opacity-60">
            取消
          </button>
          <button onClick={sheet.type === "confirm" ? runAction : onClose} disabled={submitting} className={`h-11 rounded-lg text-sm font-black text-white disabled:opacity-70 ${sheet.type === "confirm" && sheet.danger ? "bg-[var(--coral)]" : "bg-[var(--pine)]"}`}>
            {submitting ? "处理中..." : sheet.type === "confirm" ? sheet.primary : "知道了"}
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

function formatUpdateSheetBody(result: AppUpdateCheckResult) {
  const version = result.version;
  if (!version) return "当前没有可用更新。";
  const notes = version.releaseNotes.length ? version.releaseNotes.map((note) => `· ${note}`).join("\n") : "· 优化体验与稳定性。";
  const forceText = version.forceUpdate ? "这是必要更新，安装后才能继续稳定使用。" : "你也可以稍后再更新，本版本不会重复主动提醒。";
  return `当前版本 ${result.appInfo.versionName}（${result.appInfo.versionCode}）\n最新版本 ${version.latestVersionName}（${version.latestVersionCode}）\n\n${notes}\n\n${forceText}`;
}
