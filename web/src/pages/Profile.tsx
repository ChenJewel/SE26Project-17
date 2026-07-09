import { BadgeCheck, Bell, ChevronRight, ShieldCheck, SlidersHorizontal, UserRound } from "lucide-react";

const preferences = ["晚饭更常用", "不吃辣", "安静一点", "二食堂", "社恐友好"];

export default function Profile() {
  return (
    <div className="min-h-screen pb-28">
      <header className="sticky top-0 z-20 border-b border-white/70 bg-[#f5f7f2]/88 backdrop-blur-xl">
        <div className="mx-auto max-w-md px-5 py-4">
          <p className="text-[13px] font-medium text-emerald-700">Profile</p>
          <h1 className="text-2xl font-bold text-slate-950">我的</h1>
        </div>
      </header>

      <main className="mx-auto max-w-md px-5 pt-5">
        <section className="rounded-[32px] bg-slate-950 p-5 text-white shadow-xl shadow-slate-900/15">
          <div className="flex items-center gap-4">
            <div className="flex h-[72px] w-[72px] items-center justify-center rounded-[24px] bg-gradient-to-br from-emerald-200 to-orange-100 text-2xl font-black text-emerald-900">
              你
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <h2 className="text-xl font-black">你</h2>
                <BadgeCheck className="h-5 w-5 fill-emerald-500 text-slate-950" />
              </div>
              <p className="mt-1 text-sm text-slate-300">软件工程 · 大二 · 已校园认证</p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <Stat value="12" label="收到邀请" />
            <Stat value="8" label="完成约饭" />
            <Stat value="4.9" label="饭后评价" />
          </div>
        </section>

        <section className="mt-5 rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="font-black text-slate-950">我的偏好</h2>
            <button className="text-sm font-bold text-emerald-700">编辑</button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {preferences.map((tag) => (
              <span key={tag} className="rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-800">
                {tag}
              </span>
            ))}
          </div>
        </section>

        <section className="mt-5 overflow-hidden rounded-[28px] bg-white shadow-sm ring-1 ring-slate-200">
          <MenuItem icon={<ShieldCheck />} title="校园认证与安全" desc="认证状态、黑名单、紧急联系人" />
          <MenuItem icon={<SlidersHorizontal />} title="匹配偏好" desc="饭点、食堂、标签优先级" />
          <MenuItem icon={<Bell />} title="通知设置" desc="邀请、确认、饭后反馈提醒" />
          <MenuItem icon={<UserRound />} title="个人资料" desc="昵称、院系、展示标签" last />
        </section>
      </main>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-white/8 p-3 text-center">
      <p className="text-xl font-black">{value}</p>
      <p className="mt-1 text-xs text-slate-300">{label}</p>
    </div>
  );
}

function MenuItem({
  icon,
  title,
  desc,
  last,
}: {
  icon: React.ReactElement;
  title: string;
  desc: string;
  last?: boolean;
}) {
  return (
    <button
      className={`flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-slate-50 ${
        last ? "" : "border-b border-slate-100"
      }`}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-50 text-emerald-700 [&>svg]:h-5 [&>svg]:w-5">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold text-slate-950">{title}</span>
        <span className="mt-0.5 block truncate text-sm text-slate-500">{desc}</span>
      </span>
      <ChevronRight className="h-5 w-5 text-slate-300" />
    </button>
  );
}
