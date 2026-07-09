import { BadgeCheck, Search } from "lucide-react";

const conversations = [
  {
    name: "林同学",
    avatar: "林",
    text: "可以呀，那我们 18:30 二食堂门口见？",
    time: "刚刚",
    unread: 1,
  },
  {
    name: "陈同学",
    avatar: "陈",
    text: "我也想吃清淡一点，可以看看一楼窗口。",
    time: "18:02",
    unread: 0,
  },
  {
    name: "系统助手",
    avatar: "U",
    text: "你可以用破冰话题开始：今天想试哪个窗口？",
    time: "昨天",
    unread: 0,
  },
];

export default function Chat({ activeName }: { activeName: string }) {
  const sorted = [...conversations].sort((a, b) => (a.name === activeName ? -1 : b.name === activeName ? 1 : 0));

  return (
    <div className="min-h-screen pb-28">
      <header className="sticky top-0 z-20 border-b border-white/70 bg-[#f5f7f2]/88 backdrop-blur-xl">
        <div className="mx-auto max-w-md px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium text-emerald-700">Messages</p>
              <h1 className="text-2xl font-bold text-slate-950">聊天</h1>
            </div>
            <button className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-800 shadow-sm ring-1 ring-slate-200">
              <Search className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-5 pt-5">
        <div className="rounded-[28px] bg-white p-3 shadow-sm ring-1 ring-slate-200">
          {sorted.map((item, index) => (
            <button
              key={item.name}
              className={`flex w-full items-center gap-3 rounded-[22px] p-3 text-left transition hover:bg-slate-50 ${
                index !== sorted.length - 1 ? "mb-1" : ""
              }`}
            >
              <div className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-200 to-orange-100 text-lg font-black text-emerald-900">
                {item.avatar}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="font-bold text-slate-950">{item.name}</p>
                  {item.name !== "系统助手" && <BadgeCheck className="h-4 w-4 fill-emerald-600 text-white" />}
                </div>
                <p className="mt-1 truncate text-sm text-slate-500">{item.text}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="text-xs text-slate-400">{item.time}</span>
                {item.unread > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-700 px-1 text-xs font-bold text-white">
                    {item.unread}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>

        <section className="mt-5 rounded-[28px] bg-slate-950 p-5 text-white">
          <p className="text-sm font-bold">破冰提示</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            匹配后先确认时间和地点，再用轻松问题开始，例如“你今天想吃哪个窗口？”。
          </p>
        </section>
      </main>
    </div>
  );
}
