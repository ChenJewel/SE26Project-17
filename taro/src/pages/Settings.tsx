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
  MessageCircleWarning,
  Moon,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Trash2,
  UserRound,
} from "lucide-react";

type SettingKey = "account" | "general" | "notifications" | "privacy" | "support" | "about" | "switch" | "logout";

type DetailRow = {
  label: string;
  description?: string;
  value?: string;
  type?: "toggle" | "danger" | "check";
};

type DetailSection = {
  title: string;
  rows: DetailRow[];
};

type DetailContent = {
  title: string;
  description: string;
  sections: DetailSection[];
};

const detailContent: Record<SettingKey, DetailContent> = {
  account: {
    title: "账号与安全",
    description: "管理登录方式、账号绑定和设备安全。",
    sections: [
      {
        title: "账号信息",
        rows: [
          { label: "ueat ID", value: "ueat_2026" },
          { label: "手机号", description: "用于登录验证和找回账号", value: "已绑定" },
          { label: "校园邮箱", description: "用于学生身份与通知", value: "待验证" },
        ],
      },
      {
        title: "安全",
        rows: [
          { label: "修改登录密码", description: "建议定期更新密码" },
          { label: "登录设备管理", description: "查看最近登录过的手机和浏览器", value: "2 台" },
          { label: "账号注销", description: "注销前会清除约饭卡、聊天和社区内容", type: "danger" },
        ],
      },
    ],
  },
  general: {
    title: "通用设置",
    description: "调整界面显示、交互反馈和首页默认行为。",
    sections: [
      {
        title: "显示",
        rows: [
          { label: "深色模式", description: "跟随系统外观自动切换", value: "跟随系统" },
          { label: "字体大小", value: "标准" },
          { label: "首页默认标签", description: "打开 ueat 时优先展示的标签", value: "全部" },
        ],
      },
      {
        title: "体验",
        rows: [
          { label: "滑卡触感反馈", description: "左右切换卡片时轻微震动", type: "toggle" },
          { label: "自动折叠标签栏", description: "回到首页时保持一行标签", type: "toggle" },
        ],
      },
    ],
  },
  notifications: {
    title: "通知设置",
    description: "控制约饭邀请、聊天和社区互动提醒。",
    sections: [
      {
        title: "约饭",
        rows: [
          { label: "新的约饭邀请", type: "toggle" },
          { label: "对方接受邀请", type: "toggle" },
          { label: "饭点前提醒", description: "默认提前 15 分钟提醒", value: "15 分钟" },
        ],
      },
      {
        title: "消息与社区",
        rows: [
          { label: "聊天消息", type: "toggle" },
          { label: "评论与回复", type: "toggle" },
          { label: "免打扰时段", value: "23:00-08:00" },
        ],
      },
    ],
  },
  privacy: {
    title: "隐私设置",
    description: "决定别人能看到什么，以及如何使用你的位置与资料。",
    sections: [
      {
        title: "可见范围",
        rows: [
          { label: "约饭卡可见范围", value: "同校可见" },
          { label: "个人主页展示饭卡", type: "toggle" },
          { label: "允许通过昵称搜索到我", type: "toggle" },
        ],
      },
      {
        title: "安全互动",
        rows: [
          { label: "黑名单", description: "被加入黑名单的人无法向你发起约饭", value: "0 人" },
          { label: "位置精度", description: "仅展示餐厅/校区，不展示实时位置", value: "粗略" },
          { label: "举报与屏蔽记录", value: "查看" },
        ],
      },
    ],
  },
  support: {
    title: "帮助与客服",
    description: "查看常见问题，或者把遇到的问题反馈给 ueat。",
    sections: [
      {
        title: "常见问题",
        rows: [
          { label: "如何发布约饭卡？" },
          { label: "如何处理不舒服的聊天？" },
          { label: "匹配分是怎么计算的？" },
        ],
      },
      {
        title: "反馈",
        rows: [
          { label: "联系客服", description: "工作日 10:00-18:00" },
          { label: "提交问题截图", description: "帮助我们更快定位原型问题" },
          { label: "举报不当内容", type: "danger" },
        ],
      },
    ],
  },
  about: {
    title: "关于 ueat",
    description: "查看版本、协议、隐私政策和项目说明。",
    sections: [
      {
        title: "应用信息",
        rows: [
          { label: "ueat", description: "校园约饭社交原型", value: "v0.1.0" },
          { label: "版本更新", value: "已是最新" },
          { label: "开源许可", value: "查看" },
        ],
      },
      {
        title: "协议",
        rows: [
          { label: "用户服务协议" },
          { label: "隐私政策" },
          { label: "个人信息收集清单" },
          { label: "第三方信息共享清单" },
        ],
      },
    ],
  },
  switch: {
    title: "切换账号",
    description: "在不同校园身份之间切换，聊天和约饭记录会按账号保存。",
    sections: [
      {
        title: "当前账号",
        rows: [
          { label: "当前登录", description: "林同学 · ueat_2026", type: "check" },
          { label: "添加另一个账号", description: "使用手机号或校园邮箱登录" },
        ],
      },
      {
        title: "安全提示",
        rows: [{ label: "切换前同步本机草稿", description: "避免未发布的约饭卡丢失", type: "toggle" }],
      },
    ],
  },
  logout: {
    title: "退出登录",
    description: "退出后仍会保留本机基础设置，再次登录后同步你的账号数据。",
    sections: [
      {
        title: "退出前确认",
        rows: [
          { label: "保留本机草稿", description: "下次登录后继续编辑", type: "toggle" },
          { label: "退出当前账号", description: "需要重新验证手机号或校园邮箱", type: "danger" },
        ],
      },
    ],
  },
};

const groups: Array<Array<{ key: SettingKey; label: string; value?: string; icon: ReactElement }>> = [
  [
    { key: "account", label: "账号与安全", icon: <UserRound /> },
    { key: "general", label: "通用设置", icon: <SlidersHorizontal /> },
    { key: "notifications", label: "通知设置", icon: <Bell /> },
    { key: "privacy", label: "隐私设置", icon: <LockKeyhole /> },
  ],
  [
    { key: "support", label: "帮助与客服", icon: <Headphones /> },
    { key: "about", label: "关于 ueat", icon: <Info /> },
  ],
  [
    { key: "switch", label: "切换账号", icon: <RefreshCw /> },
    { key: "logout", label: "退出登录", icon: <LogOut /> },
  ],
];

export default function SettingsPage({ onBack }: { onBack: () => void }) {
  const [activeKey, setActiveKey] = useState<SettingKey | null>(null);
  const activeDetail = activeKey ? detailContent[activeKey] : null;

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
      {groups.map((group, groupIndex) => (
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
                {item.icon}
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

function SettingDetail({ detail }: { detail: DetailContent }) {
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
              <DetailRowView key={row.label} row={row} separated={index > 0} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function DetailRowView({ row, separated }: { row: DetailRow; separated: boolean }) {
  return (
    <button
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
