import { MessageSquareText, Star, Utensils } from "lucide-react";

const posts = [
  {
    title: "二食堂新窗口适合安静约饭",
    text: "今天和饭搭子试了新出的砂锅，排队不久，桌距也比较舒服。",
    meta: "饭后评价 · 18:40",
    score: "4.8",
  },
  {
    title: "第一次约饭可以选靠窗的位置",
    text: "光线好、比较不尴尬，吃完也方便自然结束或继续散步。",
    meta: "低压力建议 · 昨天",
    score: "4.6",
  },
  {
    title: "考研周搭子更适合提前约时间",
    text: "约饭文案写清楚饭点和自习安排，匹配效率会高很多。",
    meta: "经验分享 · 周一",
    score: "4.9",
  },
];

export default function Community() {
  return (
    <div className="min-h-screen pb-28">
      <header className="sticky top-0 z-20 border-b border-white/70 bg-[#f5f7f2]/88 backdrop-blur-xl">
        <div className="mx-auto max-w-md px-5 py-4">
          <p className="text-[13px] font-medium text-emerald-700">Community</p>
          <h1 className="text-2xl font-bold text-slate-950">饭后社区</h1>
        </div>
      </header>

      <main className="mx-auto max-w-md px-5 pt-5">
        <section className="rounded-[30px] bg-white p-5 shadow-lg shadow-slate-900/8 ring-1 ring-slate-200">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <Utensils className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-black text-slate-950">这里不是泛社交广场</h2>
              <p className="mt-1 text-sm text-slate-500">主要用于饭后评价、食堂体验和安全感建设。</p>
            </div>
          </div>
        </section>

        <section className="mt-5 space-y-3">
          {posts.map((post) => (
            <article key={post.title} className="rounded-[26px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-emerald-700">{post.meta}</p>
                  <h2 className="mt-2 text-lg font-black leading-tight text-slate-950">{post.title}</h2>
                </div>
                <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  {post.score}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-500">{post.text}</p>
              <button className="mt-4 flex items-center gap-2 text-sm font-bold text-slate-700">
                <MessageSquareText className="h-4 w-4" />
                查看反馈
              </button>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
