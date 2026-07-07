import { useState } from "react";
import { Filter, Clock, MapPin, Users, Sparkles, Check, ChevronRight } from "lucide-react";

const majors = [
  "计算机科学",
  "软件工程",
  "英语专业",
  "机械工程",
  "视觉传达",
  "数学",
  "物理",
  "化学",
  "生物",
  "经济学",
];

const grades = ["大一", "大二", "大三", "大四", "研一", "研二", "研三"];

const timeSlots = [
  { id: "breakfast", label: "早餐", time: "7:00-9:00" },
  { id: "lunch", label: "午餐", time: "11:00-13:00" },
  { id: "dinner", label: "晚餐", time: "17:00-19:00" },
  { id: "supper", label: "夜宵", time: "21:00-23:00" },
];

const locations = ["一餐", "二餐", "三餐", "四餐", "五餐", "外卖", "校外餐厅"];

const interests = [
  "编程",
  "音乐",
  "电影",
  "阅读",
  "旅行",
  "摄影",
  "美食",
  "健身",
  "绘画",
  "设计",
  "游戏",
  "学习",
];

export default function MatchSettings() {
  const [selectedMajors, setSelectedMajors] = useState<string[]>([]);
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
  const [selectedTimes, setSelectedTimes] = useState<string[]>(["lunch", "dinner"]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>(["一餐", "二餐"]);
  const [selectedInterests, setSelectedInterests] = useState<string[]>(["编程", "音乐"]);
  const [matchMode, setMatchMode] = useState<"interest" | "major" | "random">("interest");

  const toggleMajor = (major: string) => {
    setSelectedMajors((prev) =>
      prev.includes(major) ? prev.filter((m) => m !== major) : [...prev, major]
    );
  };

  const toggleGrade = (grade: string) => {
    setSelectedGrades((prev) =>
      prev.includes(grade) ? prev.filter((g) => g !== grade) : [...prev, grade]
    );
  };

  const toggleTime = (id: string) => {
    setSelectedTimes((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const toggleLocation = (location: string) => {
    setSelectedLocations((prev) =>
      prev.includes(location) ? prev.filter((l) => l !== location) : [...prev, location]
    );
  };

  const toggleInterest = (interest: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white sticky top-0 z-10 border-b border-gray-100">
        <div className="max-w-md mx-auto px-4 py-4">
          <h1 className="text-lg font-bold text-gray-800">匹配设置</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6">
        <section className="mb-6">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-500" />
            匹配模式
          </h3>
          <div className="bg-white rounded-xl p-4 card-shadow">
            <div className="space-y-3">
              {[
                { value: "interest" as const, label: "兴趣匹配", desc: "优先匹配兴趣相似的人" },
                { value: "major" as const, label: "专业匹配", desc: "优先匹配同专业或不同专业" },
                { value: "random" as const, label: "随机匹配", desc: "随机匹配，惊喜相遇" },
              ].map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => setMatchMode(mode.value)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors ${
                    matchMode === mode.value
                      ? "bg-indigo-50 ring-2 ring-indigo-500"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <div className="text-left">
                    <p className="font-medium text-gray-800">{mode.label}</p>
                    <p className="text-xs text-gray-500">{mode.desc}</p>
                  </div>
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      matchMode === mode.value ? "bg-indigo-500" : "bg-gray-200"
                    }`}
                  >
                    {matchMode === mode.value && <Check className="w-4 h-4 text-white" />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="mb-6">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-500" />
            筛选条件
          </h3>

          <div className="bg-white rounded-xl p-4 card-shadow mb-4">
            <p className="text-sm font-medium text-gray-700 mb-3">专业</p>
            <div className="flex flex-wrap gap-2">
              {majors.map((major) => (
                <button
                  key={major}
                  onClick={() => toggleMajor(major)}
                  className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                    selectedMajors.includes(major)
                      ? "bg-indigo-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {major}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 card-shadow mb-4">
            <p className="text-sm font-medium text-gray-700 mb-3">年级</p>
            <div className="flex flex-wrap gap-2">
              {grades.map((grade) => (
                <button
                  key={grade}
                  onClick={() => toggleGrade(grade)}
                  className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                    selectedGrades.includes(grade)
                      ? "bg-indigo-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {grade}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 card-shadow mb-4">
            <p className="text-sm font-medium text-gray-700 mb-3">兴趣标签</p>
            <div className="flex flex-wrap gap-2">
              {interests.map((interest) => (
                <button
                  key={interest}
                  onClick={() => toggleInterest(interest)}
                  className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                    selectedInterests.includes(interest)
                      ? "bg-pink-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {interest}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="mb-6">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-500" />
            可用时间
          </h3>
          <div className="bg-white rounded-xl p-4 card-shadow">
            <div className="grid grid-cols-2 gap-3">
              {timeSlots.map((slot) => (
                <button
                  key={slot.id}
                  onClick={() => toggleTime(slot.id)}
                  className={`p-3 rounded-xl text-left transition-colors ${
                    selectedTimes.includes(slot.id)
                      ? "bg-indigo-50 border-2 border-indigo-500"
                      : "bg-gray-50 border-2 border-transparent hover:bg-gray-100"
                  }`}
                >
                  <p className="font-medium text-gray-800 text-sm">{slot.label}</p>
                  <p className="text-xs text-gray-500">{slot.time}</p>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="mb-6">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-indigo-500" />
            常用地点
          </h3>
          <div className="bg-white rounded-xl p-4 card-shadow">
            <div className="flex flex-wrap gap-2">
              {locations.map((location) => (
                <button
                  key={location}
                  onClick={() => toggleLocation(location)}
                  className={`text-sm px-4 py-2 rounded-xl transition-colors ${
                    selectedLocations.includes(location)
                      ? "bg-green-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {location}
                </button>
              ))}
            </div>
          </div>
        </section>

        <button className="w-full bg-gradient-primary text-white font-medium py-3 rounded-xl hover:opacity-90 transition-opacity">
          保存设置
        </button>
      </main>
    </div>
  );
}
