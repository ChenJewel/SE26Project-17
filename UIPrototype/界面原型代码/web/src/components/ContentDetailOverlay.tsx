/**
 * 全局详情浮层。
 *
 * 这是原型阶段为了验证搜索/我的页跳转而保留的详情容器。
 * 帖子详情已与社区页统一使用 `components/post/PostDetailView`，避免两套帖子详情分叉。
 *
 * TODO(user-id): 用户详情当前通过 name 过滤卡片/帖子；正式版必须改成 userId。
 */
import { BadgeCheck, ShieldAlert, X } from "lucide-react";
import type { ReactNode } from "react";
import { PostDetailView } from "@/components/post/PostDetailView";
import UserAvatar from "@/components/UserAvatar";
import type { CommunityComment, CommunityPost } from "@/data/community";
import type { MealCard } from "@/types/meal";
import type { DetailTarget } from "@/types/navigation";
import type { UserSummary } from "@/types/user";

interface ContentDetailOverlayProps {
  target: DetailTarget | null;
  cards: MealCard[];
  posts: CommunityPost[];
  comments: CommunityComment[];
  followedUserNames: string[];
  onFollowUser: (user: UserSummary) => void;
  onOpenCard: (cardId: string) => void;
  onOpenPost: (postId: string, commentsOpen?: boolean) => void;
  onClose: () => void;
}

export default function ContentDetailOverlay({
  target,
  cards,
  posts,
  comments,
  followedUserNames,
  onFollowUser,
  onOpenCard,
  onOpenPost,
  onClose,
}: ContentDetailOverlayProps) {
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
          {target.type === "user" ? (
            <UserDetail
              name={userName}
              cards={cards}
              posts={posts}
              followed={followedUserNames.includes(userName)}
              onFollowUser={onFollowUser}
              onOpenCard={onOpenCard}
              onOpenPost={onOpenPost}
            />
          ) : null}
          {target.type === "card" && card ? <CardDetail card={card} /> : null}
          {target.type === "post" && post ? (
            <PostDetailView
              post={post}
              comments={comments.filter((comment) => comment.postId === post.id)}
              commentsOpen={target.commentsOpen}
              variant="embedded"
            />
          ) : null}
        </main>
      </section>
    </div>
  );
}

function UserDetail({
  name,
  cards,
  posts,
  followed,
  onFollowUser,
  onOpenCard,
  onOpenPost,
}: {
  name: string;
  cards: MealCard[];
  posts: CommunityPost[];
  followed: boolean;
  onFollowUser: (user: UserSummary) => void;
  onOpenCard: (cardId: string) => void;
  onOpenPost: (postId: string) => void;
}) {
  // TODO(user-id): 改为 `card.userId === userId` 和 `post.authorId === userId`。
  const userCards = cards.filter((card) => card.nickname === name);
  const userPosts = posts.filter((post) => post.author === name);
  const avatar = userCards[0]?.avatarText ?? userPosts[0]?.avatar ?? name.slice(0, 1);
  const tags = Array.from(new Set(userCards.flatMap((card) => card.tags).slice(0, 8)));
  const sharedTags = tags.filter((tag) => ["晚饭", "不吃辣", "二食堂", "喜欢安静", "社恐友好", "清淡"].includes(tag));
  const source = userCards[0] ? `${userCards[0].place} · ${userCards[0].time}` : userPosts[0]?.place ?? "校园用户";
  const relationScore = Math.min(98, 72 + userCards.length * 4 + userPosts.length * 3 + sharedTags.length * 2);

  return (
    <div className="space-y-5">
      <section className="meal-card rounded-lg p-5">
        <div className="card-content flex items-center gap-4">
          <UserAvatar text={avatar} size="lg" />
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
          <Stat value={name === "我" ? "已认证" : `${relationScore}%`} label="匹配" />
        </div>
        {name !== "我" ? (
          <div className="card-content mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => onFollowUser({ name, avatar, source, verified: true })}
              className={`h-11 rounded-lg text-sm font-black ${
                followed ? "bg-white/18 text-[#fffdf3]" : "bg-[#fff7d7] text-[#28483f]"
              }`}
            >
              {followed ? "已关注" : "关注"}
            </button>
            <button className="h-11 rounded-lg bg-white/18 text-sm font-black text-[#fffdf3]">私信</button>
          </div>
        ) : null}
      </section>

      <section className="grid grid-cols-3 gap-2">
        <ProfileMetric value={String(24 + userPosts.length * 5)} label="关注" />
        <ProfileMetric value={String(68 + userCards.length * 8)} label="粉丝" />
        <ProfileMetric value={name === "我" ? "本人" : "同校"} label="关系" />
      </section>

      {name !== "我" ? (
        <section className="grid grid-cols-3 gap-2">
          <button className="rounded-lg bg-white/82 p-3 text-center text-xs font-black text-[var(--pine)] ring-1 ring-[var(--line-soft)]">
            发起约饭
          </button>
          <button className="rounded-lg bg-white/82 p-3 text-center text-xs font-black text-[var(--pine)] ring-1 ring-[var(--line-soft)]">
            屏蔽
          </button>
          <button className="flex items-center justify-center gap-1 rounded-lg bg-white/82 p-3 text-center text-xs font-black text-[var(--coral)] ring-1 ring-[var(--line-soft)]">
            <ShieldAlert className="h-3.5 w-3.5" />
            举报
          </button>
        </section>
      ) : null}

      {sharedTags.length ? (
        <section>
          <h3 className="mb-2 px-1 font-black text-[var(--text-main)]">共同偏好</h3>
          <div className="flex flex-wrap gap-2">
            {sharedTags.map((tag) => (
              <span key={tag} className="rounded-lg bg-[rgba(255,247,215,0.86)] px-3 py-1.5 text-sm font-black text-[#806636]">
                {tag}
              </span>
            ))}
          </div>
        </section>
      ) : null}

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
          <button key={card.id} onClick={() => onOpenCard(card.id)} className="w-full rounded-lg bg-white/82 p-3 text-left ring-1 ring-[var(--line-soft)]">
            <p className="font-black text-[var(--text-main)]">{card.place} · {card.time}</p>
            <p className="mt-1 line-clamp-2 text-sm font-semibold text-[var(--text-muted)]">{card.text}</p>
          </button>
        ))}
      </ContentList>

      <ContentList title="发布的帖子">
        {userPosts.map((post) => (
          <button key={post.id} onClick={() => onOpenPost(post.id)} className="w-full rounded-lg bg-white/82 p-3 text-left ring-1 ring-[var(--line-soft)]">
            <p className="font-black text-[var(--text-main)]">{post.title}</p>
            <p className="mt-1 line-clamp-2 text-sm font-semibold text-[var(--text-muted)]">{post.text}</p>
          </button>
        ))}
      </ContentList>
    </div>
  );
}

function ProfileMetric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg bg-white/82 p-3 text-center ring-1 ring-[var(--line-soft)]">
      <p className="text-lg font-black text-[var(--text-main)]">{value}</p>
      <p className="mt-1 text-xs font-bold text-[var(--text-muted)]">{label}</p>
    </div>
  );
}

function CardDetail({ card }: { card: MealCard }) {
  return (
    <article className="meal-card rounded-lg p-5">
      <div className="card-content flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <UserAvatar text={card.avatarText} />
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
