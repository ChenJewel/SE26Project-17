import { Home, Users, Calendar, User } from "lucide-react";

interface BottomNavProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

const navItems = [
  { id: "home", icon: Home, label: "首页" },
  { id: "match", icon: Users, label: "匹配" },
  { id: "history", icon: Calendar, label: "记录" },
  { id: "profile", icon: User, label: "我的" },
];

export default function BottomNav({ currentPage, onNavigate }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-30">
      <div className="max-w-md mx-auto flex items-center justify-around py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors ${
                isActive ? "text-indigo-600" : "text-gray-400"
              }`}
            >
              <div className={`p-2 rounded-xl transition-colors ${isActive ? "bg-indigo-50" : ""}`}>
                <Icon className={`w-5 h-5 ${isActive ? "scale-110" : ""} transition-transform`} />
              </div>
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
