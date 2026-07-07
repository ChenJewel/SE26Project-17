import { useState } from "react";
import { MessageCircle, Calendar, MapPin, Sparkles, Heart, User } from "lucide-react";

const mockUsers = [
  {
    id: 1,
    name: "张小明",
    avatar: "https://neeko-copilot.bytedance.net/api/text2image?prompt=young%20asian%20male%20college%20student%20friendly%20smile%20portrait&image_size=square",
    major: "计算机科学",
    grade: "大二",
    tags: ["编程", "音乐", "电影"],
    description: "喜欢分享技术心得，周末常去图书馆",
    matchingScore: 85,
    location: "一餐二楼",
  },
  {
    id: 2,
    name: "李婷婷",
    avatar: "https://neeko-copilot.bytedance.net/api/text2image?prompt=young%20asian%20female%20college%20student%20warm%20smile%20portrait&image_size=square",
    major: "英语专业",
    grade: "大三",
    tags: ["阅读", "旅行", "咖啡"],
    description: "热爱文学，正在备考雅思",
    matchingScore: 78,
    location: "二餐三楼",
  },
  {
    id: 3,
    name: "王浩然",
    avatar: "https://neeko-copilot.bytedance.net/api/text2image?prompt=young%20asian%20male%20college%20student%20sporty%20energetic%20portrait&image_size=square",
    major: "机械工程",
    grade: "研一",
    tags: ["运动", "摄影", "美食"],
    description: "健身爱好者，喜欢探索校园周边美食",
    matchingScore: 72,
    location: "三餐一楼",
  },
  {
    id: 4,
    name: "陈思思",
    avatar: "https://neeko-copilot.bytedance.net/api/text2image?prompt=young%20asian%20female%20college%20student%20artistic%20creative%20portrait&image_size=square",
    major: "视觉传达",
    grade: "大二",
    tags: ["绘画", "设计", "展览"],
    description: "艺术爱好者，喜欢逛各种展览",
    matchingScore: 88,
    location: "一餐三楼",
  },
];

const iceBreakers = [
  "最近看了什么好看的电影？",
  "最喜欢学校哪家食堂的菜？",
  "周末一般怎么安排？",
  "有没有特别想尝试的事情？",
];

export default function Home() {
  const [users] = useState(mockUsers);
  const [selectedUser, setSelectedUser] = useState<typeof mockUsers[0] | null>(null);
  const [currentIceBreaker, setCurrentIceBreaker] = useState(0);

  const handleMatch = () => {
    if (selectedUser) {
      alert(`已向 ${selectedUser.name} 发送约饭邀请！`);
      setSelectedUser(null);
    }
  };

  const handleChat = () => {
    if (selectedUser) {
      alert(`开始与 ${selectedUser.name} 聊天！\n破冰话题：${iceBreakers[currentIceBreaker]}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-pink-50 pb-20">
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-10 border-b border-gray-100">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gradient">Ueat</h1>
              <p className="text-xs text-gray-500">校园约饭搭子</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6">
        <section className="mb-6">
          <div className="bg-gradient-primary rounded-2xl p-6 text-white">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5" />
              <h2 className="text-lg font-semibold">今日推荐</h2>
            </div>
            <p className="text-sm opacity-90 mb-4">发现与你志同道合的同学，一起享受美食时光</p>
            <button className="w-full bg-white text-indigo-600 font-medium py-3 rounded-xl hover:bg-gray-50 transition-colors">
              开始匹配
            </button>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">推荐搭子</h3>
            <span className="text-xs text-indigo-500">查看全部</span>
          </div>

          <div className="space-y-4">
            {users.map((user) => (
              <div
                key={user.id}
                className={`bg-white rounded-xl p-4 card-shadow hover-lift cursor-pointer transition-all ${
                  selectedUser?.id === user.id ? "ring-2 ring-indigo-500" : ""
                }`}
                onClick={() => setSelectedUser(user)}
              >
                <div className="flex items-start gap-4">
                  <div className="relative">
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-16 h-16 rounded-xl object-cover"
                    />
                    <div className="absolute -bottom-1 -right-1 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                      在线
                    </div>
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-gray-800">{user.name}</h4>
                        <div className="flex items-center gap-1 text-indigo-500">
                          <Heart className="w-4 h-4" />
                          <span className="text-xs font-medium">{user.matchingScore}%</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                      <span>{user.major}</span>
                      <span>·</span>
                      <span>{user.grade}</span>
                    </div>

                    <p className="text-sm text-gray-600 mt-2 line-clamp-2">{user.description}</p>

                    <div className="flex flex-wrap gap-2 mt-3">
                      {user.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 mt-3 text-xs text-gray-400">
                      <MapPin className="w-3 h-3" />
                      <span>{user.location}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <div className="bg-white rounded-xl p-4 card-shadow">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800">破冰话题</h3>
              <button
                onClick={() => setCurrentIceBreaker((prev) => (prev + 1) % iceBreakers.length)}
                className="text-xs text-indigo-500 hover:text-indigo-600"
              >
                换一个
              </button>
            </div>
            <div className="bg-gradient-to-r from-indigo-50 to-pink-50 rounded-xl p-4">
              <p className="text-gray-700 italic">{iceBreakers[currentIceBreaker]}</p>
            </div>
          </div>
        </section>
      </main>

      {selectedUser && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 z-20">
          <div className="max-w-md mx-auto flex items-center gap-3">
            <img
              src={selectedUser.avatar}
              alt={selectedUser.name}
              className="w-12 h-12 rounded-xl object-cover"
            />
            <div className="flex-1">
              <p className="font-medium text-gray-800">{selectedUser.name}</p>
              <p className="text-xs text-gray-500">匹配度 {selectedUser.matchingScore}%</p>
            </div>
            <button
              onClick={handleChat}
              className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-xl hover:bg-gray-200 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="text-sm font-medium">聊天</span>
            </button>
            <button
              onClick={handleMatch}
              className="flex items-center gap-2 bg-gradient-primary text-white px-4 py-2 rounded-xl hover:opacity-90 transition-opacity"
            >
              <Calendar className="w-4 h-4" />
              <span className="text-sm font-medium">约饭</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
