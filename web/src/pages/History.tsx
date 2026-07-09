import { useState } from "react";
import { Calendar, MapPin, Star, Check, Clock, X } from "lucide-react";

const mockHistory = [
  {
    id: 1,
    name: "张小明",
    avatar: "https://neeko-copilot.bytedance.net/api/text2image?prompt=young%20asian%20male%20college%20student%20friendly%20smile%20portrait&image_size=square",
    date: "2026-07-05",
    time: "12:00",
    location: "一餐二楼",
    status: "completed" as const,
    rating: 5,
    feedback: "聊得很开心，期待下次再约！",
  },
  {
    id: 2,
    name: "李婷婷",
    avatar: "https://neeko-copilot.bytedance.net/api/text2image?prompt=young%20asian%20female%20college%20student%20warm%20smile%20portrait&image_size=square",
    date: "2026-07-08",
    time: "18:00",
    location: "二餐三楼",
    status: "upcoming" as const,
  },
  {
    id: 3,
    name: "王浩然",
    avatar: "https://neeko-copilot.bytedance.net/api/text2image?prompt=young%20asian%20male%20college%20student%20sporty%20energetic%20portrait&image_size=square",
    date: "2026-07-03",
    time: "18:30",
    location: "三餐一楼",
    status: "completed" as const,
    rating: 4,
    feedback: "很有趣的一次聊天，学到了很多！",
  },
  {
    id: 4,
    name: "陈思思",
    avatar: "https://neeko-copilot.bytedance.net/api/text2image?prompt=young%20asian%20female%20college%20student%20artistic%20creative%20portrait&image_size=square",
    date: "2026-07-01",
    time: "12:30",
    location: "一餐三楼",
    status: "cancelled" as const,
    reason: "时间冲突",
  },
];

type TabType = "all" | "completed" | "upcoming" | "cancelled";

export default function History() {
  const [history] = useState(mockHistory);
  const [activeTab, setActiveTab] = useState<TabType>("all");

  const tabs = [
    { value: "all", label: "全部", count: history.length },
    { value: "completed", label: "已完成", count: history.filter((h) => h.status === "completed").length },
    { value: "upcoming", label: "待确认", count: history.filter((h) => h.status === "upcoming").length },
    { value: "cancelled", label: "已取消", count: history.filter((h) => h.status === "cancelled").length },
  ] as const;

  const filteredHistory = history.filter((h) => {
    if (activeTab === "all") return true;
    return h.status === activeTab;
  });

  const getStatusBadge = (status: typeof mockHistory[0]["status"]) => {
    switch (status) {
      case "completed":
        return (
          <span className="flex items-center gap-1 text-green-500 text-xs font-medium">
            <Check className="w-3 h-3" />
            已完成
          </span>
        );
      case "upcoming":
        return (
          <span className="flex items-center gap-1 text-blue-500 text-xs font-medium">
            <Clock className="w-3 h-3" />
            待确认
          </span>
        );
      case "cancelled":
        return (
          <span className="flex items-center gap-1 text-gray-500 text-xs font-medium">
            <X className="w-3 h-3" />
            已取消
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white sticky top-0 z-10 border-b border-gray-100">
        <div className="max-w-md mx-auto px-4 py-4">
          <h1 className="text-lg font-bold text-gray-800">约饭记录</h1>
        </div>
      </header>

      <div className="bg-white border-b border-gray-100">
        <div className="max-w-md mx-auto px-4">
          <div className="flex gap-2 py-2">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === tab.value
                    ? "bg-indigo-50 text-indigo-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-md mx-auto px-4 py-6">
        {filteredHistory.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500">暂无约饭记录</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredHistory.map((item) => (
              <div
                key={item.id}
                className={`bg-white rounded-xl p-4 card-shadow ${
                  item.status === "cancelled" ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-start gap-4">
                  <img
                    src={item.avatar}
                    alt={item.name}
                    className="w-14 h-14 rounded-xl object-cover"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-gray-800">{item.name}</h4>
                      {getStatusBadge(item.status)}
                    </div>

                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>{item.date}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        <span>{item.location}</span>
                      </div>
                    </div>

                    {item.status === "completed" && item.rating && (
                      <div className="flex items-center gap-2 mt-3">
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-4 h-4 ${
                                star <= item.rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300"
                              }`}
                            />
                          ))}
                        </div>
                        <p className="text-xs text-gray-500">{item.feedback}</p>
                      </div>
                    )}

                    {item.status === "cancelled" && item.reason && (
                      <p className="text-xs text-gray-500 mt-2">取消原因：{item.reason}</p>
                    )}

                    {item.status === "upcoming" && (
                      <div className="flex gap-2 mt-3">
                        <button className="flex-1 bg-indigo-50 text-indigo-600 text-sm font-medium py-2 rounded-lg hover:bg-indigo-100 transition-colors">
                          确认赴约
                        </button>
                        <button className="flex-1 bg-gray-100 text-gray-600 text-sm font-medium py-2 rounded-lg hover:bg-gray-200 transition-colors">
                          修改时间
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
