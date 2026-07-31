/**
 * 设置页的配置化数据。
 *
 * Settings 页面只负责渲染和切换 active key；具体分组、条目和详情放在这里。
 * 后续如果设置项由后端或平台能力决定，可以把这里替换成配置接口。
 */
export type SettingKey = "account" | "general" | "notifications" | "privacy" | "support" | "about" | "switch" | "logout";

export type SettingRowType = "toggle" | "danger" | "check";

export type SettingDetailRow = {
  label: string;
  description?: string;
  value?: string;
  type?: SettingRowType;
};

export type SettingDetailSection = {
  title: string;
  rows: SettingDetailRow[];
};

export type SettingDetailContent = {
  title: string;
  description: string;
  sections: SettingDetailSection[];
};

export type SettingIndexItem = {
  key: SettingKey;
  label: string;
  value?: string;
};

export const settingDetailContent: Record<SettingKey, SettingDetailContent> = {
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

export const settingGroups: SettingIndexItem[][] = [
  [
    { key: "account", label: "账号与安全" },
    { key: "general", label: "通用设置" },
    { key: "notifications", label: "通知设置" },
    { key: "privacy", label: "隐私设置" },
  ],
  [
    { key: "support", label: "帮助与客服" },
    { key: "about", label: "关于 ueat" },
  ],
  [
    { key: "switch", label: "切换账号" },
    { key: "logout", label: "退出登录" },
  ],
];
