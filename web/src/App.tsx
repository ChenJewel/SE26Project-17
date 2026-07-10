/**
 * 应用状态与页面路由入口。
 *
 * 这里集中维护初版原型的共享数据：约饭卡、社区帖子、评论、互动状态和全局标签池。
 * 当前项目没有接后端，所以发布卡片、发评论、点赞收藏等行为都先存在 React state 中；
 * 后续接接口时，优先把这里的 seed 数据和 state 更新函数替换成 API/store 调用。
 */
import { useState } from "react";
import BottomNav, { type PageId } from "./components/BottomNav";
import SearchOverlay from "./components/SearchOverlay";
import Home from "./pages/Home";
import CreateCard, { type MealCard } from "./pages/CreateCard";
import Community from "./pages/Community";
import {
  initialCommunityComments,
  initialCommunityInteractions,
  initialCommunityPosts,
  type CommunityComment,
  type CommunityInteractionState,
  type CommunityPost,
} from "./data/community";
import Chat from "./pages/Chat";
import Profile from "./pages/Profile";

const defaultTagOptions = [
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
  "健身",
  "跑步",
  "电影",
  "音乐",
  "读书",
  "游戏",
  "MBTI",
  "INTJ",
  "INTP",
  "ENTJ",
  "ENTP",
  "INFJ",
  "INFP",
  "ENFJ",
  "ENFP",
  "ISTJ",
  "ISFJ",
  "ESTJ",
  "ESFJ",
  "ISTP",
  "ISFP",
  "ESTP",
  "ESFP",
  "一食堂",
  "二食堂",
  "三食堂",
  "四食堂",
  "校外",
  "附近",
  "随便",
];

function uniqueTags(tags: string[]) {
  return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));
}

const seedCards: MealCard[] = [
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
    reason: "时间、地点和相处节奏都很接近",
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
    reason: "地点接近，聊天偏好相似",
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
    reason: "饮食偏好和校园动线匹配",
  },
  {
    id: "zhou",
    nickname: "周同学",
    avatarText: "周",
    verified: true,
    text: "晚上想吃热一点的，但不太能吃辣。希望对方也不赶时间，吃完可以散步回宿舍。",
    time: "今天 19:00",
    place: "四食堂",
    people: "1 对 1",
    tags: ["晚饭", "不吃辣", "慢热", "散步", "四食堂"],
    matchScore: 83,
    reason: "饭点一致，饮食限制相近",
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
    reason: "餐厅和相处状态高度匹配",
  },
];

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageId>("home");
  const [cards, setCards] = useState<MealCard[]>(seedCards);
  const [tagOptions, setTagOptions] = useState<string[]>(() =>
    uniqueTags([...defaultTagOptions, ...seedCards.flatMap((card) => card.tags)])
  );
  const [posts, setPosts] = useState<CommunityPost[]>(initialCommunityPosts);
  const [comments, setComments] = useState<CommunityComment[]>(initialCommunityComments);
  const [interactions, setInteractions] = useState<CommunityInteractionState>(initialCommunityInteractions);
  const [publishedCardId, setPublishedCardId] = useState<string | null>(null);
  const [activeChatName, setActiveChatName] = useState("林同学");
  const [searchOpen, setSearchOpen] = useState(false);

  const navigate = (page: PageId) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePublish = (card: MealCard) => {
    setCards((current) => [card, ...current]);
    setTagOptions((current) => uniqueTags([...current, ...card.tags]));
    setPublishedCardId(card.id);
    navigate("home");
  };

  const handleInvite = (card: MealCard) => {
    setActiveChatName(card.nickname);
    navigate("chat");
  };

  const renderPage = () => {
    switch (currentPage) {
      case "home":
        return (
          <Home
            cards={cards}
            tagOptions={tagOptions}
            publishedCardId={publishedCardId}
            onCreate={() => navigate("create")}
            onInvite={handleInvite}
            onSearch={() => setSearchOpen(true)}
          />
        );
      case "community":
        return (
          <Community
            posts={posts}
            comments={comments}
            interactions={interactions}
            onPostsChange={setPosts}
            onCommentsChange={setComments}
            onInteractionsChange={setInteractions}
            onSearch={() => setSearchOpen(true)}
          />
        );
      case "create":
        return <CreateCard tagOptions={tagOptions} onPublish={handlePublish} onCancel={() => navigate("home")} />;
      case "chat":
        return <Chat activeName={activeChatName} />;
      case "profile":
        return <Profile cards={cards} posts={posts} comments={comments} interactions={interactions} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[var(--page-bg)] text-[var(--text-main)]">
      {renderPage()}
      <BottomNav currentPage={currentPage} onNavigate={navigate} />
      <SearchOverlay open={searchOpen} cards={cards} posts={posts} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
