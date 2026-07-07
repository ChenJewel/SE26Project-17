import { useState } from "react";
import { User, Edit3, Settings, Shield, Bell, HelpCircle, ChevronRight, Calendar, MapPin, Award } from "lucide-react";

const mockProfile = {
  name: "我",
  avatar: "https://neeko-copilot.bytedance.net/api/text2image?prompt=young%20asian%20college%20student%20friendly%20portrait&image_size=square",
  major: "软件工程",
  grade: "大二",
  school: "上海交通大学",
  tags: ["编程", "音乐", "电影", "健身"],
  bio: "热爱技术，喜欢探索新事物。希望通过约饭认识更多有趣的人！",
  matchingCount: 12,
  mealCount: 8,
};

const menuItems = [
  { icon: Bell, label: "消息通知", badge: 3 },
  { icon: Shield, label: "隐私安全" },
  { icon: Settings, label: "设置" },
  { icon: HelpCircle, label: "帮助与反馈" },
];

export default function Profile() {
  const [profile] = useState(mockProfile);
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-gradient-primary pt-12 pb-8 px-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-4">
            <div className="relative">
              <img
                src={profile.avatar}
                alt={profile.name}
                className="w-20 h-20 rounded-2xl object-cover ring-4 ring-white/50"
              />
              <button className="absolute -bottom-1 -right-1 bg-white rounded-full p-2 shadow-lg">
                <Edit3 className="w-4 h-4 text-indigo-600" />
              </button>
            </div>
            <div className="text-white">
              <h2 className="text-xl font-bold">{profile.name}</h2>
              <p className="text-sm opacity-90">{profile.school}</p>
            </div>
          </div>

          <div className="flex items-center gap-6 mt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{profile.matchingCount}</p>
              <p className="text-xs text-white/80">匹配成功</p>
            </div>
            <div className="w-px h-8 bg-white/30"></div>
            <div className="text-center">
              <p className="text-2xl font-bold text-white">{profile.mealCount}</p>
              <p className="text-xs text-white/80">已约饭</p>
            </div>
            <div className="w-px h-8 bg-white/30"></div>
            <div className="text-center">
              <p className="text-2xl font-bold text-white">5.0</p>
              <p className="text-xs text-white/80">评分</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 -mt-4">
        <div className="bg-white rounded-2xl p-5 card-shadow mb-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">个人资料</h3>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="text-xs text-indigo-500 flex items-center gap-1"
            >
              <Edit3 className="w-3 h-3" />
              {isEditing ? "保存" : "编辑"}
            </button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Award className="w-5 h-5 text-gray-400" />
              <div className="flex-1">
                <p className="text-xs text-gray-500">专业</p>
                <p className="text-sm font-medium text-gray-800">{profile.major}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-gray-400" />
              <div className="flex-1">
                <p className="text-xs text-gray-500">年级</p>
                <p className="text-sm font-medium text-gray-800">{profile.grade}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-gray-400" />
              <div className="flex-1">
                <p className="text-xs text-gray-500">学校</p>
                <p className="text-sm font-medium text-gray-800">{profile.school}</p>
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-2">自我介绍</p>
              <p className="text-sm text-gray-700">{profile.bio}</p>
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-2">兴趣标签</p>
              <div className="flex flex-wrap gap-2">
                {profile.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl overflow-hidden card-shadow">
          {menuItems.map((item, index) => (
            <button
              key={item.label}
              className={`w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors ${
                index !== menuItems.length - 1 ? "border-b border-gray-100" : ""
              }`}
            >
              <item.icon className="w-5 h-5 text-gray-400" />
              <span className="flex-1 text-left text-sm font-medium text-gray-800">
                {item.label}
              </span>
              {item.badge && (
                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {item.badge}
                </span>
              )}
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
          ))}
        </div>

        <div className="mt-6 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-5 text-white">
          <h3 className="font-semibold mb-2">校园认证</h3>
          <p className="text-sm opacity-90 mb-4">完成校园认证可获得更多匹配机会和安全保障</p>
          <button className="bg-white text-indigo-600 text-sm font-medium px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors">
            立即认证
          </button>
        </div>
      </main>
    </div>
  );
}
