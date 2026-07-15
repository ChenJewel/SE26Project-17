/**
 * 社区模块的类型和初始数据。
 *
 * 这里定义社区频道、帖子、评论和互动状态的数据结构。
 * 初版原型使用本地 mock 数据；接后端时可以保留这些 TypeScript 类型作为接口字段约束。
 *
 * TODO(media): `imageTone` 是 CSS 占位视觉，不是真实媒体资源。
 * 正式版应替换为 mediaAssets/videoUrl/imageUrls/loadingState 等字段。
 */
export type CommunityChannel = "推荐" | "关注" | "附近" | "餐厅" | "生活" | "经验";
export type CommunityTopic = "餐厅" | "生活" | "经验";
export type CommunityMediaType = "text" | "photo" | "video";
export type CommunityMediaSource = "text" | "album" | "camera";

export type CommunityPost = {
  id: string;
  /** TODO: 正式版使用 authorId 跳转用户主页；author 只作为展示昵称。 */
  authorId?: string;
  title: string;
  text: string;
  author: string;
  avatar: string;
  channel: CommunityChannel;
  topic: CommunityTopic;
  mediaType: CommunityMediaType;
  mediaSource: CommunityMediaSource;
  mediaUrl?: string;
  mediaUrls?: string[];
  mediaMimeType?: string;
  place: string;
  likes: string;
  favorites: string;
  comments: number;
  shares: string;
  imageTone: "window" | "table" | "note" | "walk" | "safety" | "quiet" | "campus" | "mountain" | "road";
  verified?: boolean;
  hot?: boolean;
  followed?: boolean;
  nearby?: boolean;
};

export type CommunityComment = {
  id: string;
  postId: string;
  /** TODO: 正式版使用 authorId 跳转评论作者主页。 */
  authorId?: string;
  author: string;
  avatar: string;
  text: string;
  parentCommentId?: string;
  replyToUserId?: string;
  replyToAuthor?: string;
  likes: string;
  favorites?: string;
  time: string;
  mine?: boolean;
};

export type UserComment = {
  id: string;
  postId: string;
  postTitle: string;
  text: string;
  time: string;
};

export type CommunityInteractionState = {
  likedPostIds: string[];
  favoritePostIds: string[];
  likedCommentIds: string[];
  favoriteCommentIds: string[];
  reportedCommentIds: string[];
  userComments: UserComment[];
};

export const initialCommunityPosts: CommunityPost[] = [
  {
    id: "p-1",
    title: "二食堂靠窗位很适合第一次约饭",
    text: "光线比较舒服，人流也不会一直贴着桌边走。第一次见面可以约这里，吃完顺路去图书馆方向散步。",
    author: "林同学",
    avatar: "林",
    channel: "餐厅",
    topic: "餐厅",
    mediaType: "photo",
    mediaSource: "album",
    place: "二食堂 2F",
    likes: "128",
    favorites: "36",
    comments: 18,
    shares: "12",
    imageTone: "window",
    verified: true,
    hot: true,
    followed: true,
    nearby: true,
  },
  {
    id: "p-2",
    title: "学校东门这家粉面店适合下课后去",
    text: "不是食堂，但离教学楼很近。人均不高，出餐快，适合不想排大队的时候和朋友简单吃一顿。",
    author: "陈同学",
    avatar: "陈",
    channel: "餐厅",
    topic: "餐厅",
    mediaType: "photo",
    mediaSource: "album",
    place: "东门附近",
    likes: "76",
    favorites: "18",
    comments: 9,
    shares: "8",
    imageTone: "table",
    nearby: true,
  },
  {
    id: "p-3",
    title: "和陌生同学吃饭前，我会先确认三件事",
    text: "时间、具体见面点、是否接受安静吃饭。提前说清楚，现场就会轻松很多。",
    author: "许同学",
    avatar: "许",
    channel: "经验",
    topic: "经验",
    mediaType: "text",
    mediaSource: "text",
    place: "校园通用",
    likes: "203",
    favorites: "61",
    comments: 31,
    shares: "19",
    imageTone: "note",
    verified: true,
    followed: true,
  },
  {
    id: "p-4",
    title: "晚饭后从三食堂回宿舍，这条路灯更亮",
    text: "从主路走会多两分钟，但晚上人更多。单独回宿舍可以优先选这一段，安全感会好很多。",
    author: "周同学",
    avatar: "周",
    channel: "生活",
    topic: "生活",
    mediaType: "video",
    mediaSource: "camera",
    place: "三食堂东门",
    likes: "1.1k",
    favorites: "182",
    comments: 64,
    shares: "86",
    imageTone: "road",
    hot: true,
    nearby: true,
  },
  {
    id: "p-5",
    title: "适合不尬聊的约饭开场",
    text: "可以先问“你今天想快点吃完，还是慢慢吃？”这个问题不太冒犯，也能自然决定节奏。",
    author: "何同学",
    avatar: "何",
    channel: "经验",
    topic: "经验",
    mediaType: "text",
    mediaSource: "text",
    place: "话题建议",
    likes: "342",
    favorites: "98",
    comments: 27,
    shares: "23",
    imageTone: "quiet",
    hot: true,
  },
  {
    id: "p-6",
    title: "南区草坪下午看到一只猫",
    text: "在长椅旁边晒太阳，很亲人但不要随便喂。路过可以看看，心情会变好一点。",
    author: "吴同学",
    avatar: "吴",
    channel: "生活",
    topic: "生活",
    mediaType: "photo",
    mediaSource: "album",
    place: "南区草坪",
    likes: "518",
    favorites: "144",
    comments: 42,
    shares: "35",
    imageTone: "campus",
    verified: true,
    followed: true,
    nearby: true,
  },
  {
    id: "p-7",
    title: "新生选课前可以先问学长学姐这几个点",
    text: "不用只问“这门课难不难”，可以问作业节奏、课堂互动和期末形式，得到的信息会更有用。",
    author: "叶同学",
    avatar: "叶",
    channel: "经验",
    topic: "经验",
    mediaType: "text",
    mediaSource: "text",
    place: "大学经验",
    likes: "289",
    favorites: "73",
    comments: 22,
    shares: "17",
    imageTone: "note",
    hot: true,
  },
  {
    id: "p-8",
    title: "60 秒看完学校附近的秋天路",
    text: "下课后绕远一点回宿舍，路过这里真的很像电影画面。",
    author: "Mark",
    avatar: "M",
    channel: "生活",
    topic: "生活",
    mediaType: "video",
    mediaSource: "camera",
    place: "南门外环路",
    likes: "1.9M",
    favorites: "182.2K",
    comments: 6741,
    shares: "275.9K",
    imageTone: "mountain",
    hot: true,
    nearby: true,
  },
];

export const initialCommunityComments: CommunityComment[] = [
  { id: "c-1", postId: "p-8", author: "alexsmith", avatar: "A", text: "这个地方看起来太适合散步了。", likes: "36.9K", time: "1d" },
  { id: "c-2", postId: "p-8", author: "Michael", avatar: "M", text: "原来附近还有这种路，下次下课去看看。", likes: "11.5K", time: "1d" },
  { id: "c-3", postId: "p-8", author: "milja", avatar: "米", text: "好像电影截图，秋天氛围太强了。", likes: "4.2K", time: "1d" },
  { id: "c-4", postId: "p-1", author: "鱼鳞", avatar: "鱼", text: "靠窗位真的不压迫，第一次见面会自然很多。", likes: "162", time: "2h" },
];

export const initialCommunityInteractions: CommunityInteractionState = {
  likedPostIds: [],
  favoritePostIds: [],
  likedCommentIds: [],
  favoriteCommentIds: [],
  reportedCommentIds: [],
  userComments: [],
};
