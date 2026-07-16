export type PageId = "home" | "community" | "create" | "chat" | "profile" | "settings";

export type MealCard = {
  id: string;
  nickname: string;
  avatarText: string;
  verified: boolean;
  text: string;
  time: string;
  place: string;
  people: string;
  tags: string[];
  matchScore: number;
  reason: string;
};

export const defaultTagOptions = [
  "全部",
  "晚饭",
  "午饭",
  "早餐",
  "宵夜",
  "考研党",
  "新生",
  "喜欢吃辣",
  "不吃辣",
  "清淡",
  "想尝新",
  "社恐友好",
  "喜欢安静",
  "可以聊天",
  "慢热",
  "运动",
  "电影",
  "音乐",
  "读书",
  "游戏",
  "一食堂",
  "二食堂",
  "三食堂",
  "四食堂",
  "校外",
  "附近"
];

export function uniqueTags(tags: string[]) {
  return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));
}

export const seedCards: MealCard[] = [
  {
    id: "lin",
    nickname: "林同学",
    avatarText: "林",
    verified: true,
    text: "今天 18:30 想在二食堂吃饭。复习周不太想一个人吃，希望找一个安静一点、可以简单聊两句的人。",
    time: "今天 18:30",
    place: "二食堂",
    people: "1 对 1",
    tags: ["晚饭", "二食堂", "考研党", "安静一点", "不吃辣"],
    matchScore: 92,
    reason: "时间、地点和相处节奏都很接近"
  },
  {
    id: "chen",
    nickname: "陈同学",
    avatarText: "陈",
    verified: true,
    text: "刚下课，想去一食堂吃个轻松的晚饭。可以聊电影、课程，也可以安静吃完各自回去。",
    time: "今天 17:50",
    place: "一食堂",
    people: "都可以",
    tags: ["一食堂", "电影", "社恐友好", "清淡", "刚下课"],
    matchScore: 86,
    reason: "地点接近，聊天偏好相似"
  },
  {
    id: "xu",
    nickname: "许同学",
    avatarText: "许",
    verified: false,
    text: "想试试三食堂新开的窗口，最好能一起拼菜。饭后可以顺路去图书馆，聊天多少都可以。",
    time: "明天 12:10",
    place: "三食堂",
    people: "2-3 人",
    tags: ["午饭", "三食堂", "想尝新", "图书馆", "可以聊天"],
    matchScore: 79,
    reason: "饮食偏好和校园动线匹配"
  },
  {
    id: "he",
    nickname: "何同学",
    avatarText: "何",
    verified: true,
    text: "今天想在二食堂吃点清淡的，最好是同样刚从图书馆出来的人。可以聊学习，也可以只安静吃完。",
    time: "今天 18:10",
    place: "二食堂",
    people: "都可以",
    tags: ["图书馆", "清淡", "晚饭", "安静一点", "二食堂"],
    matchScore: 95,
    reason: "餐厅和相处状态高度匹配"
  }
];
