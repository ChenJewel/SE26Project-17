import { BadgeCheck, Bookmark, Heart, MapPin, MessageCircle, Send, Utensils, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { MealCard } from "@/pages/CreateCard";
import type { CommunityComment, CommunityPost } from "@/data/community";
import type { DetailTarget } from "@/types/navigation";

interface ContentDetailOverlayProps {
  target: DetailTarget | null;
  cards: MealCard[];
  posts: CommunityPost[];
  comments: CommunityComment[];
  onClose: () => void;
}

export default function ContentDetailOverlay({ target, cards, posts, comments, onClose }: ContentDetailOverlayProps) {
  if (!target) return null;

  // Prototype resolver: look up local mock/state data by id/name.
  // In a real app this component would receive already-loaded route data or request it by route params.
  const card = target.type === "card" ? cards.find((item) => item.id === target.cardId) : null;
  const post = target.type === "post" ? posts.find((item) => item.id === target.postId) : null;
  const userName =
    target.type === "user"
      ? target.name
      : card?.nickname ?? post?.author ?? "";

  return (
    <div className="fixed inset-0 z-[80] bg-[rgba(18,30,25,0.36)]">
      <section className="mx-auto flex h-full max-w-md flex-col bg-[var(--surface)] shadow-[0_20px_60px_rgba(18,30,25,0.24)]">
        <header className="page-header flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-xs font-bold uppercase text-[var(--pine)]">
              {target.type === "user" ? "User" : target.type === "card" ? "Meal Card" : "Post"}
            </p>
            <h1 className="display-cn text-[22px] text-[var(--text-main)]">
              {target.type === "user" ? `${userName}的主页` : target.type === "card" ? "约饭卡片详情" : "帖子详情"}
            </h1>
          </div>
          <button
            onClick={onClose}
            className="safe-tap flex items-center justify-center rounded-lg bg-[rgba(209,228,221,0.72)] text-[var(--pine)]"
            aria-label="关闭详情"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {target.type === "user" ? <UserDetail name={userName} cards={cards} posts={posts} /> : null}
          {target.type === "card" && card ? <CardDetail card={card} /> : null}
          {target.type === "post" && post ? (
            <PostDetail post={post} comments={comments.filter((comment) => comment.postId === post.id)} commentsOpen={target.commentsOpen} />
          ) : null}
        </main>
      </section>
    </div>
  );
}

function UserDetail({ name, cards, posts }: { name: string; cards: MealCard[]; posts: CommunityPost[] }) {
  const userCards = cards.filter((card) => card.nickname === name);
  const userPosts = posts.filter((post) => post.author === name);
  const avatar = userCards[0]?.avatarText ?? userPosts[0]?.avatar ?? name.slice(0, 1);
  const tags = Array.from(new Set(userCards.flatMap((card) => card.tags).slice(0, 8)));

  return (
    <div className="space-y-5">
      <section className="meal-card rounded-lg p-5">
        <div className="card-content flex items-center gap-4">
          <Avatar text={avatar} large />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h2 className="display-cn text-[25px] text-[#fffdf3]">{name}</h2>
              <BadgeCheck className="h-5 w-5 fill-[#d5b66f] text-[#365d51]" />
            </div>
            <p className="mt-1 text-sm font-bold text-[#d8eade]">
              {name === "我" ? "我的 ueat 主页" : "校园认证 · 可发起约饭"}
            </p>
          </div>
        </div>
        <div className="card-content mt-5 grid grid-cols-3 gap-3">
          <Stat value={String(userCards.length)} label="约饭卡" />
          <Stat value={String(userPosts.length)} label="帖子" />
          <Stat value={name === "我" ? "已认证" : "同校"} label="关系" />
        </div>
      </section>

      {tags.length ? (
        <section>
          <h3 className="mb-2 px-1 font-black text-[var(--text-main)]">常用标签</h3>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span key={tag} className="rounded-lg bg-[rgba(209,228,221,0.8)] px-3 py-1.5 text-sm font-black text-[var(--pine)]">
                {tag}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <ContentList title="约饭卡片">
        {userCards.map((card) => (
          <div key={card.id} className="rounded-lg bg-white/82 p-3 ring-1 ring-[var(--line-soft)]">
            <p className="font-black text-[var(--text-main)]">{card.place} · {card.time}</p>
            <p className="mt-1 line-clamp-2 text-sm font-semibold text-[var(--text-muted)]">{card.text}</p>
          </div>
        ))}
      </ContentList>

      <ContentList title="发布的帖子">
        {userPosts.map((post) => (
          <div key={post.id} className="rounded-lg bg-white/82 p-3 ring-1 ring-[var(--line-soft)]">
            <p className="font-black text-[var(--text-main)]">{post.title}</p>
            <p className="mt-1 line-clamp-2 text-sm font-semibold text-[var(--text-muted)]">{post.text}</p>
          </div>
        ))}
      </ContentList>
    </div>
  );
}

function CardDetail({ card }: { card: MealCard }) {
  return (
    <article className="meal-card rounded-lg p-5">
      <div className="card-content flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar text={card.avatarText} />
          <div className="min-w-0">
            <h2 className="display-cn truncate text-[23px] text-[#fffdf3]">{card.nickname}</h2>
            <p className="text-xs font-bold text-[#d8eade]">{card.reason}</p>
          </div>
        </div>
        <span className="rounded-lg bg-white/14 px-3 py-2 text-xl font-black">{card.matchScore}%</span>
      </div>
      <p className="card-content mt-6 text-xl font-black leading-[1.55] text-[#fffdf3]">{card.text}</p>
      <div className="card-content mt-5 grid grid-cols-3 gap-2">
        <Meta label={card.time} />
        <Meta label={card.place} />
        <Meta label={card.people} />
      </div>
      <div className="card-content mt-5 flex flex-wrap gap-2">
        {card.tags.map((tag) => (
          <span key={tag} className="rounded-lg bg-white/15 px-3 py-1.5 text-sm font-bold text-white/88">
            {tag}
          </span>
        ))}
      </div>
    </article>
  );
}

function PostDetail({ post, comments, commentsOpen }: { post: CommunityPost; comments: CommunityComment[]; commentsOpen?: boolean }) {
  const [photoOpen, setPhotoOpen] = useState(false);

  return (
    <article className="space-y-4">
      <section className="overflow-hidden rounded-lg bg-white/86 ring-1 ring-[var(--line-soft)]">
        <div className="flex items-center gap-3 border-b border-[var(--line-soft)] p-3">
          <Avatar text={post.avatar} />
          <div className="min-w-0 flex-1">
            <p className="font-black text-[var(--text-main)]">{post.author}</p>
            <p className="flex items-center gap-1 text-xs font-bold text-[var(--text-muted)]">
              <MapPin className="h-3.5 w-3.5" />
              {post.place}
            </p>
          </div>
        </div>
        <div className="p-4">
          {post.mediaType === "photo" ? (
            <button
              onClick={() => setPhotoOpen(true)}
              className="mb-4 flex h-44 w-full items-end justify-between overflow-hidden rounded-lg bg-[linear-gradient(145deg,#8fb9c7_0%,#f7faf5_48%,#d5b66f_100%)] p-3 text-left ring-1 ring-[var(--line-soft)]"
            >
              <span className="rounded-md bg-white/78 px-2 py-1 text-xs font-black text-[var(--pine)]">点开查看照片</span>
              <span className="rounded-md bg-white/78 px-2 py-1 text-xs font-black text-[var(--text-main)]">{post.topic}</span>
            </button>
          ) : null}
          <span className="rounded-md bg-[rgba(209,228,221,0.86)] px-2 py-1 text-xs font-black text-[var(--pine)]">
            {post.topic}
          </span>
          <h2 className="mt-3 text-[22px] font-black leading-tight text-[var(--text-main)]">{post.title}</h2>
          <p className="mt-3 text-[15px] font-semibold leading-7 text-[var(--text-muted)]">{post.text}</p>
          <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs font-black text-[var(--text-muted)]">
            <PostStat icon={<Heart />} value={post.likes} label="喜欢" />
            <PostStat icon={<Bookmark />} value={post.favorites} label="收藏" />
            <PostStat icon={<MessageCircle />} value={String(post.comments)} label="评论" />
            <PostStat icon={<Utensils />} value={post.channel} label="频道" />
          </div>
        </div>
      </section>

      <section className="rounded-lg bg-white/86 p-4 ring-1 ring-[var(--line-soft)]">
        <h3 className="mb-3 font-black text-[var(--text-main)]">{commentsOpen ? "评论区" : "热门评论"}</h3>
        <div className="space-y-4">
          {comments.length ? (
            comments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                <Avatar text={comment.avatar} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-[var(--text-faint)]">{comment.author} · {comment.time}</p>
                  <p className="mt-1 text-sm font-semibold leading-5 text-[var(--text-main)]">{comment.text}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm font-semibold text-[var(--text-muted)]">暂时还没有评论。</p>
          )}
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-[var(--surface-soft)] px-3 py-2 ring-1 ring-[var(--line-soft)]">
          <input className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none" placeholder="写评论..." />
          <Send className="h-4 w-4 text-[var(--pine)]" />
        </div>
      </section>
      {photoOpen ? (
        <div className="fixed inset-0 z-[90] bg-black">
          <div className="h-full bg-[linear-gradient(145deg,#8fb9c7_0%,#f7faf5_48%,#d5b66f_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.42)_0%,transparent_28%,transparent_66%,rgba(0,0,0,0.54)_100%)]" />
          <button
            onClick={() => setPhotoOpen(false)}
            className="absolute right-4 top-8 safe-tap flex items-center justify-center rounded-full bg-black/28 text-white"
            aria-label="关闭照片"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="absolute inset-x-0 bottom-8 px-4 text-white">
            <p className="text-sm font-black">{post.author}</p>
            <h2 className="mt-1 text-xl font-black leading-tight">{post.title}</h2>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function ContentList({ title, children }: { title: string; children: ReactNode }) {
  const hasContent = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <section>
      <h3 className="mb-2 px-1 font-black text-[var(--text-main)]">{title}</h3>
      <div className="space-y-2">
        {hasContent ? children : (
          <div className="rounded-lg bg-white/72 p-4 text-center text-sm font-semibold text-[var(--text-muted)] ring-1 ring-[var(--line-soft)]">
            暂时没有内容
          </div>
        )}
      </div>
    </section>
  );
}

function Avatar({ text, large }: { text: string; large?: boolean }) {
  return (
    <span
      className={`display-cn flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#d1e4dd] via-[#d5b66f] to-[#92b8a7] text-[#28483f] ${
        large ? "h-[72px] w-[72px] text-3xl" : "h-11 w-11 text-lg"
      }`}
    >
      {text}
    </span>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg bg-[rgba(255,255,255,0.12)] p-3 text-center ring-1 ring-[rgba(255,255,255,0.16)]">
      <p className="text-xl font-black text-[#fffdf3]">{value}</p>
      <p className="mt-1 text-xs font-bold text-[#d8eade]">{label}</p>
    </div>
  );
}

function Meta({ label }: { label: string }) {
  return <span className="rounded-lg bg-white/12 px-3 py-2 text-center text-xs font-black text-white/86">{label}</span>;
}

function PostStat({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-lg bg-[var(--surface-soft)] p-2">
      <span className="mx-auto flex h-5 w-5 items-center justify-center text-[var(--pine)] [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      <p className="mt-1 truncate">{value}</p>
      <p className="text-[11px] text-[var(--text-faint)]">{label}</p>
    </div>
  );
}
