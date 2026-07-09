import { useState } from "react";
import BottomNav, { type PageId } from "@/components/BottomNav";
import Home from "@/pages/Home";
import CreateCard, { type MealCard } from "@/pages/CreateCard";
import Community from "@/pages/Community";
import Chat from "@/pages/Chat";
import Profile from "@/pages/Profile";

const seedCards: MealCard[] = [
  {
    id: "lin",
    nickname: "林同学",
    avatarText: "林",
    verified: true,
    text: "今天 18:30 想在二食堂吃饭。复习周不太想一个人吃，想找个安静一点、可以简单聊两句的人。",
    time: "今天 18:30",
    place: "二食堂",
    people: "1 对 1",
    tags: ["晚饭", "二食堂", "考研党", "安静一点", "不吃辣"],
    matchScore: 82,
    reason: "时间、地点和 3 个标签重合",
  },
  {
    id: "chen",
    nickname: "陈同学",
    avatarText: "陈",
    verified: true,
    text: "刚下课，想找人一起去一食堂吃个轻松的晚饭。可以聊电影、课程，也可以安静吃饭。",
    time: "今天 17:50",
    place: "一食堂",
    people: "都可以",
    tags: ["一食堂", "电影", "社恐友好", "清淡", "刚下课"],
    matchScore: 76,
    reason: "地点接近，话题偏好相似",
  },
  {
    id: "xu",
    nickname: "许同学",
    avatarText: "许",
    verified: false,
    text: "想试试新开的窗口，最好能一起拼菜。饭后可以顺路去图书馆，聊天多少都可以。",
    time: "明天 12:10",
    place: "三食堂",
    people: "2-3 人",
    tags: ["午饭", "三食堂", "想尝新", "图书馆", "可以聊天"],
    matchScore: 69,
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
    matchScore: 73,
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
    matchScore: 88,
    reason: "食堂和相处状态高度匹配",
  },
  {
    id: "luo",
    nickname: "罗同学",
    avatarText: "罗",
    verified: false,
    text: "想找人一起吃午饭，顺便吐槽一下 ddl。吃饭节奏可以快一点，别太正式就好。",
    time: "明天 12:00",
    place: "一食堂",
    people: "2-3 人",
    tags: ["午饭", "赶 ddl", "一食堂", "快一点", "可以聊天"],
    matchScore: 71,
    reason: "饭点接近，话题标签相似",
  },
  {
    id: "tang",
    nickname: "唐同学",
    avatarText: "唐",
    verified: true,
    text: "想吃辣一点的窗口，但一个人点菜有点难选。希望对方也愿意尝新，吃完可以各自回去学习。",
    time: "今晚有空",
    place: "三食堂",
    people: "1 对 1",
    tags: ["能吃辣", "想尝新", "晚饭", "三食堂", "边界感"],
    matchScore: 67,
    reason: "饮食偏好部分匹配",
  },
  {
    id: "shen",
    nickname: "沈同学",
    avatarText: "沈",
    verified: true,
    text: "晚上想去校外吃面，想找一个不介意慢慢走过去的人。可以聊 MBTI，也可以聊最近看的剧。",
    time: "今天 19:20",
    place: "校外",
    people: "都可以",
    tags: ["校外", "散步", "MBTI", "电视剧", "慢热"],
    matchScore: 64,
    reason: "话题重合，地点稍远",
  },
];

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageId>("home");
  const [cards, setCards] = useState<MealCard[]>(seedCards);
  const [publishedCardId, setPublishedCardId] = useState<string | null>(null);
  const [activeChatName, setActiveChatName] = useState("林同学");

  const navigate = (page: PageId) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePublish = (card: MealCard) => {
    setCards((current) => [card, ...current]);
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
            publishedCardId={publishedCardId}
            onCreate={() => navigate("create")}
            onInvite={handleInvite}
          />
        );
      case "community":
        return <Community />;
      case "create":
        return <CreateCard onPublish={handlePublish} onCancel={() => navigate("home")} />;
      case "chat":
        return <Chat activeName={activeChatName} />;
      case "profile":
        return <Profile />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f7f2] text-slate-950">
      {renderPage()}
      <BottomNav currentPage={currentPage} onNavigate={navigate} />
    </div>
  );
}
