import { BadgeCheck, Bookmark, Heart, MessageCircle, PenLine, Star, UserPlus, Utensils } from "lucide-react";
import type { MealCard } from "@/pages/CreateCard";
import type { CommunityComment, CommunityInteractionState, CommunityPost } from "@/data/community";

interface ProfileProps {
  cards: MealCard[];
  posts: CommunityPost[];
  comments: CommunityComment[];
  interactions: CommunityInteractionState;
}

const preferences = ["晚饭更常用", "不吃辣", "安静一点", "二食堂", "社恐友好"];

export default function Profile({ cards, posts, comments, interactions }: ProfileProps) {
  const myPosts = posts.filter((post) => post.author === "我");
  const recentCards = cards.slice(0, 3);
  const likedPosts = posts.filter((post) => interactions.likedPostIds.includes(post.id));
  const favoritePosts = posts.filter((post) => interactions.favoritePostIds.includes(post.id));
  const followedUsers = Array.from(new Map(posts.filter((post) => post.followed).map((post) => [post.author, post])).values()).slice(0, 6);
  const likedComments = comments.filter((comment) => interactions.likedCommentIds.includes(comment.id));
  const favoriteComments = comments.filter((comment) => interactions.favoriteCommentIds.includes(comment.id));

  return (
    <div className="app-shell min-h-screen">
      <header className="page-header sticky top-0 z-20">
        <div className="mx-auto max-w-md px-5 py-4">
          <p className="text-[13px] font-bold text-[var(--pine)]">Profile</p>
          <h1 className="display-cn text-[25px] text-[var(--text-main)]">我的</h1>
        </div>
      </header>

      <main className="mx-auto max-w-md px-5 pt-5">
        <section className="meal-card rounded-lg p-5">
          <div className="card-content flex items-center gap-4">
            <div className="display-cn flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#fff7d7] via-[#d5b66f] to-[#92b8a7] text-3xl text-[#28483f]">
              我
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h2 className="display-cn text-[24px] text-[#fffdf3]">我</h2>
                <BadgeCheck className="h-5 w-5 fill-[#d5b66f] text-[#365d51]" />
              </div>
              <p className="mt-1 text-sm font-bold text-[#d8eade]">软件工程 · 大二 · 已校园认证</p>
            </div>
          </div>

          <div className="card-content mt-6 grid grid-cols-3 gap-3">
            <Stat value={String(myPosts.length)} label="已发帖子" />
            <Stat value={String(cards.length)} label="划卡卡片" />
            <Stat value={String(interactions.userComments.length)} label="我的评论" />
          </div>
        </section>

        <section className="mt-5">
          <div className="mb-3 flex items-center justify-between px-1">
            <h2 className="font-black text-[var(--text-main)]">我的偏好</h2>
            <button className="text-sm font-black text-[var(--pine)]">编辑</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {preferences.map((tag, index) => (
              <span
                key={tag}
                className={`rounded-lg px-3 py-1.5 text-sm font-black ${
                  index % 3 === 0
                    ? "bg-[rgba(209,228,221,0.9)] text-[var(--pine)]"
                    : index % 3 === 1
                      ? "bg-[rgba(255,247,215,0.86)] text-[#806636]"
                      : "bg-[rgba(183,176,216,0.18)] text-[#6f69a3]"
                }`}
              >
                {tag}
              </span>
            ))}
          </div>
        </section>

        <ProfileSection icon={<PenLine />} title="我发布的帖子" empty="还没有发布社区帖子">
          {(myPosts.length ? myPosts : posts.filter((post) => post.author !== "我").slice(0, 2)).map((post) => (
            <MiniPost key={post.id} post={post} muted={!myPosts.length} />
          ))}
        </ProfileSection>

        <ProfileSection icon={<Utensils />} title="最近创作的划卡" empty="还没有创建约饭卡">
          {recentCards.map((card) => (
            <div key={card.id} className="rounded-lg bg-white/82 p-3 ring-1 ring-[var(--line-soft)]">
              <p className="font-black text-[var(--text-main)]">{card.place} · {card.time}</p>
              <p className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-[var(--text-muted)]">{card.text}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {card.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="rounded-md bg-[rgba(209,228,221,0.72)] px-2 py-1 text-[11px] font-black text-[var(--pine)]">{tag}</span>
                ))}
              </div>
            </div>
          ))}
        </ProfileSection>

        <ProfileSection icon={<MessageCircle />} title="我发布的评论" empty="还没有评论">
          {interactions.userComments.map((comment) => (
            <div key={comment.id} className="rounded-lg bg-white/82 p-3 ring-1 ring-[var(--line-soft)]">
              <p className="text-xs font-bold text-[var(--text-faint)]">{comment.postTitle} · {comment.time}</p>
              <p className="mt-1 text-sm font-semibold text-[var(--text-main)]">{comment.text}</p>
            </div>
          ))}
        </ProfileSection>

        <ProfileSection icon={<Heart />} title="喜欢的帖子" empty="还没有喜欢的帖子">
          {likedPosts.map((post) => <MiniPost key={post.id} post={post} />)}
        </ProfileSection>

        <ProfileSection icon={<Bookmark />} title="收藏的帖子" empty="还没有收藏的帖子">
          {favoritePosts.map((post) => <MiniPost key={post.id} post={post} />)}
        </ProfileSection>

        <ProfileSection icon={<Star />} title="喜欢/收藏的评论" empty="还没有互动过评论">
          {[...likedComments, ...favoriteComments]
            .filter((comment, index, list) => list.findIndex((item) => item.id === comment.id) === index)
            .map((comment) => (
              <div key={comment.id} className="rounded-lg bg-white/82 p-3 ring-1 ring-[var(--line-soft)]">
                <p className="text-xs font-bold text-[var(--text-faint)]">{comment.author}</p>
                <p className="mt-1 text-sm font-semibold text-[var(--text-main)]">{comment.text}</p>
              </div>
            ))}
        </ProfileSection>

        <ProfileSection icon={<UserPlus />} title="关注的用户" empty="还没有关注用户">
          <div className="grid grid-cols-3 gap-2">
            {followedUsers.map((post) => (
              <div key={post.author} className="rounded-lg bg-white/82 p-3 text-center ring-1 ring-[var(--line-soft)]">
                <div className="display-cn mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#d1e4dd] via-[#d5b66f] to-[#92b8a7] text-[#28483f]">
                  {post.avatar}
                </div>
                <p className="mt-2 truncate text-xs font-black text-[var(--text-main)]">{post.author}</p>
              </div>
            ))}
          </div>
        </ProfileSection>
      </main>
    </div>
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

function ProfileSection({ icon, title, empty, children }: { icon: React.ReactNode; title: string; empty: string; children: React.ReactNode }) {
  const hasContent = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <section className="mt-5">
      <div className="mb-3 flex items-center gap-2 px-1">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[rgba(209,228,221,0.72)] text-[var(--pine)] [&>svg]:h-4 [&>svg]:w-4">
          {icon}
        </span>
        <h2 className="font-black text-[var(--text-main)]">{title}</h2>
      </div>
      <div className="space-y-2">
        {hasContent ? children : (
          <div className="rounded-lg bg-white/72 p-4 text-center text-sm font-semibold text-[var(--text-muted)] ring-1 ring-[var(--line-soft)]">
            {empty}
          </div>
        )}
      </div>
    </section>
  );
}

function MiniPost({ post, muted }: { post: CommunityPost; muted?: boolean }) {
  return (
    <div className={`rounded-lg bg-white/82 p-3 ring-1 ring-[var(--line-soft)] ${muted ? "opacity-70" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-md bg-[rgba(209,228,221,0.82)] px-2 py-1 text-[11px] font-black text-[var(--pine)]">{post.topic}</span>
        <span className="text-xs font-bold text-[var(--text-faint)]">{post.mediaType === "video" ? "视频" : post.mediaType === "photo" ? "照片" : "文字"}</span>
      </div>
      <p className="mt-2 line-clamp-2 font-black text-[var(--text-main)]">{post.title}</p>
      <p className="mt-1 line-clamp-2 text-sm font-semibold text-[var(--text-muted)]">{post.text}</p>
    </div>
  );
}
