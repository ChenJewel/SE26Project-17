/**
 * 消息页的演示数据与数据查找函数。
 *
 * Chat 页面保留交互状态和渲染结构；这里集中放会话、聊天记录、最近搜索。
 * 后续接后端时，可以让这些导出项改为接口返回值或状态管理 selector。
 */
export type Conversation = {
  id: string;
  name: string;
  avatar: string;
  preview: string;
  time: string;
  unread: number;
  online?: boolean;
  verified?: boolean;
  group?: boolean;
};

export type ChatItem =
  | { id: string; type: "message"; from: "me" | "them"; text: string; time: string; read?: boolean }
  | { id: string; type: "call"; from: "me" | "them"; title: string; subtitle: string; time: string; missed?: boolean }
  | { id: string; type: "divider"; text: string }
  | { id: string; type: "notice"; text: string };

export const conversations: Conversation[] = [
  { id: "lin", name: "林同学", avatar: "林", preview: "可以呀，那我们 18:30 二食堂东门见。", time: "刚刚", unread: 1, online: true, verified: true },
  { id: "chen", name: "陈同学", avatar: "陈", preview: "我也想吃清淡一点，可以看看一楼窗口。", time: "18:02", unread: 0, online: true, verified: true },
  { id: "movie", name: "富万贯观影团 3 群", avatar: "影", preview: "[群主发言] 周末电影报名开始了。", time: "下午3:35", unread: 1, group: true },
  { id: "food", name: "上海特卖小灵通87群", avatar: "群", preview: "[9条] 小羽毛：人广附近新开甜品店。", time: "下午3:09", unread: 1, group: true },
  { id: "system", name: "系统消息", avatar: "U", preview: "你的社区帖子收到新的评论。", time: "上午11:39", unread: 1, verified: true },
];

export const chatItems: ChatItem[] = [
  { id: "d-1", type: "divider", text: "昨天" },
  { id: "n-1", type: "notice", text: "消息和通话仅用于确认约饭信息。见面前请先确认时间、地点和公开场所。" },
  { id: "m-1", type: "message", from: "me", text: "今天 18:30 二食堂可以吗？我想吃清淡一点。", time: "4:37 PM", read: true },
  { id: "m-2", type: "message", from: "them", text: "可以呀，我刚好也在附近。", time: "4:37 PM" },
  { id: "m-3", type: "message", from: "them", text: "我也不太能吃辣。", time: "4:38 PM" },
  { id: "d-2", type: "divider", text: "今天" },
  { id: "c-1", type: "call", from: "me", title: "语音通话", subtitle: "32 秒", time: "9:00 AM" },
  { id: "c-2", type: "call", from: "them", title: "未接语音通话", subtitle: "点按回拨", time: "9:01 AM", missed: true },
  { id: "m-4", type: "message", from: "me", text: "那我们在二食堂东门见？靠窗的位置人少一点。", time: "9:03 AM", read: true },
  { id: "m-5", type: "message", from: "them", text: "好，我下课过去。", time: "9:14 AM" },
];

export const recentSearches = [
  { name: "林同学", avatar: "林" },
  { name: "陈同学", avatar: "陈" },
  { name: "富万贯观影团", avatar: "影" },
  { name: "二食堂聊天记录", avatar: "记" },
];

export function findInitialConversation(activeName: string) {
  return conversations.find((item) => item.name === activeName);
}
