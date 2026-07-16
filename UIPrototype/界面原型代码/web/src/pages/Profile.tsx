/**
 * 我的页面。
 *
 * 展示个人资料，以及用户发布/互动过的内容汇总。
 *
 * 已拆出的结构：
 * - ProfileHeader: 顶部资料和设置入口
 * - PreferenceTagEditor: 我的偏好标签编辑
 * - ProfileSection: 通用内容分区容器
 *
 * 仍留在本文件的 AvatarEditor/MiniPost 是原型展示组件；未来接真实用户资料和帖子详情页时可继续外拆。
 *
 * 数据仍有昵称匹配的原型痕迹，例如关注用户点击打开 name；正式版应统一改成 userId。
 * 已发布帖子、最近划卡、评论、喜欢/收藏帖子、喜欢/收藏评论和关注用户。
 */
import { useState } from "react";
import { Bookmark, Camera, Heart, MessageCircle, PenLine, Star, UserPlus, Utensils, X } from "lucide-react";
import { PreferenceTagEditor } from "@/components/profile/PreferenceTagEditor";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { ProfileSection } from "@/components/profile/ProfileSection";
import type { CommunityComment, CommunityInteractionState, CommunityPost } from "@/data/community";
import type { MealCard } from "@/types/meal";
import type { CurrentUser } from "@/types/auth";
import type { UserSummary } from "@/types/user";

interface ProfileProps {
  currentUser: CurrentUser | null;
  authSummary: string;
  cards: MealCard[];
  posts: CommunityPost[];
  comments: CommunityComment[];
  interactions: CommunityInteractionState;
  tagOptions: string[];
  profileTags: string[];
  onProfileTagsChange: (tags: string[]) => void;
  onTagOptionsChange: (tags: string[]) => void;
  followedUsers: UserSummary[];
  onSettings: () => void;
  onLogout: () => void;
  onOpenUser: (name: string) => void;
  onOpenCard: (cardId: string) => void;
  onOpenPost: (postId: string, commentsOpen?: boolean) => void;
}

const avatarOptions = ["我", "U", "食", "饭", "约", "🍚"];

export default function Profile({
  currentUser,
  authSummary,
  cards,
  posts,
  comments,
  interactions,
  tagOptions,
  profileTags,
  onProfileTagsChange,
  onTagOptionsChange,
  followedUsers,
  onSettings,
  onLogout,
  onOpenUser,
  onOpenCard,
  onOpenPost,
}: ProfileProps) {
  const myPosts = posts.filter((post) => post.author === "我");
  const recentCards = cards.slice(0, 3);
  const likedPosts = posts.filter((post) => interactions.likedPostIds.includes(post.id));
  const favoritePosts = posts.filter((post) => interactions.favoritePostIds.includes(post.id));
  const seededFollowedUsers: UserSummary[] = posts
    .filter((post) => post.followed)
    .map((post) => ({ name: post.author, avatar: post.avatar, source: `${post.channel} · ${post.place}`, verified: post.verified }));
  const visibleFollowedUsers = Array.from(
    new Map([...followedUsers, ...seededFollowedUsers].map((user) => [user.name, user])).values()
  ).slice(0, 9);
  const likedComments = comments.filter((comment) => interactions.likedCommentIds.includes(comment.id));
  const favoriteComments = comments.filter((comment) => interactions.favoriteCommentIds.includes(comment.id));
  const [avatarText, setAvatarText] = useState(currentUser?.avatarText ?? "我");
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [tagEditorOpen, setTagEditorOpen] = useState(false);

  return (
    <div className="app-shell min-h-screen">
      <main className="mx-auto max-w-md px-5 pt-5">
        <ProfileHeader
          nickname={currentUser?.nickname ?? "我"}
          authSummary={authSummary}
          avatarText={avatarText}
          postCount={myPosts.length}
          cardCount={cards.length}
          commentCount={interactions.userComments.length}
          onAvatarOpen={() => setAvatarOpen(true)}
          onSettings={onSettings}
        />

        <section className="mt-3 rounded-lg bg-white/82 p-3 ring-1 ring-[var(--line-soft)]">
          <p className="text-xs font-black uppercase text-[var(--pine)]">Account</p>
          <p className="mt-1 truncate text-sm font-bold text-[var(--text-main)]">{currentUser?.email ?? "未绑定邮箱"}</p>
          <button onClick={onLogout} className="mt-3 h-10 w-full rounded-lg bg-[rgba(217,154,136,0.16)] text-sm font-black text-[var(--coral)]">
            退出登录
          </button>
        </section>

        <section className="mt-5">
          <div className="mb-3 flex items-center justify-between px-1">
            <h2 className="font-black text-[var(--text-main)]">我的偏好</h2>
            <button onClick={() => setTagEditorOpen(true)} className="text-sm font-black text-[var(--pine)]">编辑</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {profileTags.map((tag, index) => (
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
            <MiniPost key={post.id} post={post} muted={!myPosts.length} onClick={() => onOpenPost(post.id)} />
          ))}
        </ProfileSection>

        <ProfileSection icon={<Utensils />} title="最近创作的划卡" empty="还没有创建约饭卡">
          {recentCards.map((card) => (
            <button key={card.id} onClick={() => onOpenCard(card.id)} className="w-full rounded-lg bg-white/82 p-3 text-left ring-1 ring-[var(--line-soft)]">
              <p className="font-black text-[var(--text-main)]">{card.place} · {card.time}</p>
              <p className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-[var(--text-muted)]">{card.text}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {card.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="rounded-md bg-[rgba(209,228,221,0.72)] px-2 py-1 text-[11px] font-black text-[var(--pine)]">{tag}</span>
                ))}
              </div>
            </button>
          ))}
        </ProfileSection>

        <ProfileSection icon={<MessageCircle />} title="我发布的评论" empty="还没有评论">
          {interactions.userComments.map((comment) => (
            <button key={comment.id} onClick={() => onOpenPost(comment.postId, true)} className="w-full rounded-lg bg-white/82 p-3 text-left ring-1 ring-[var(--line-soft)]">
              <p className="text-xs font-bold text-[var(--text-faint)]">{comment.postTitle} · {comment.time}</p>
              <p className="mt-1 text-sm font-semibold text-[var(--text-main)]">{comment.text}</p>
            </button>
          ))}
        </ProfileSection>

        <ProfileSection icon={<Heart />} title="喜欢的帖子" empty="还没有喜欢的帖子">
          {likedPosts.map((post) => <MiniPost key={post.id} post={post} onClick={() => onOpenPost(post.id)} />)}
        </ProfileSection>

        <ProfileSection icon={<Bookmark />} title="收藏的帖子" empty="还没有收藏的帖子">
          {favoritePosts.map((post) => <MiniPost key={post.id} post={post} onClick={() => onOpenPost(post.id)} />)}
        </ProfileSection>

        <ProfileSection icon={<Star />} title="喜欢/收藏的评论" empty="还没有互动过评论">
          {[...likedComments, ...favoriteComments]
            .filter((comment, index, list) => list.findIndex((item) => item.id === comment.id) === index)
            .map((comment) => (
              <button key={comment.id} onClick={() => onOpenPost(comment.postId, true)} className="w-full rounded-lg bg-white/82 p-3 text-left ring-1 ring-[var(--line-soft)]">
                <p className="text-xs font-bold text-[var(--text-faint)]">{comment.author}</p>
                <p className="mt-1 text-sm font-semibold text-[var(--text-main)]">{comment.text}</p>
              </button>
            ))}
        </ProfileSection>

        <ProfileSection icon={<UserPlus />} title="关注的用户" empty="还没有关注用户">
          <div className="grid grid-cols-3 gap-2">
            {visibleFollowedUsers.map((user) => (
              <button key={user.name} onClick={() => onOpenUser(user.name)} className="rounded-lg bg-white/82 p-3 text-center ring-1 ring-[var(--line-soft)]">
                <div className="display-cn mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#d1e4dd] via-[#d5b66f] to-[#92b8a7] text-[#28483f]">
                  {user.avatar}
                </div>
                <p className="mt-2 truncate text-xs font-black text-[var(--text-main)]">{user.name}</p>
              </button>
            ))}
          </div>
        </ProfileSection>
      </main>

      {avatarOpen ? (
        <AvatarEditor avatarText={avatarText} onChange={setAvatarText} onClose={() => setAvatarOpen(false)} />
      ) : null}

      {tagEditorOpen ? (
        <PreferenceTagEditor
          selectedTags={profileTags}
          tagOptions={tagOptions}
          onClose={() => setTagEditorOpen(false)}
          onSave={(nextTags, nextOptions) => {
            onProfileTagsChange(nextTags);
            onTagOptionsChange(nextOptions);
            setTagEditorOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function MiniPost({ post, muted, onClick }: { post: CommunityPost; muted?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`w-full rounded-lg bg-white/82 p-3 text-left ring-1 ring-[var(--line-soft)] ${muted ? "opacity-70" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-md bg-[rgba(209,228,221,0.82)] px-2 py-1 text-[11px] font-black text-[var(--pine)]">{post.topic}</span>
        <span className="text-xs font-bold text-[var(--text-faint)]">{post.mediaType === "video" ? "视频" : post.mediaType === "photo" ? "照片" : "文字"}</span>
      </div>
      <p className="mt-2 line-clamp-2 font-black text-[var(--text-main)]">{post.title}</p>
      <p className="mt-1 line-clamp-2 text-sm font-semibold text-[var(--text-muted)]">{post.text}</p>
    </button>
  );
}

function AvatarEditor({
  avatarText,
  onChange,
  onClose,
}: {
  avatarText: string;
  onChange: (value: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[75] flex items-end bg-[rgba(18,30,25,0.34)] px-3 pb-3">
      <section className="mx-auto w-full max-w-md rounded-lg bg-[var(--surface)] p-4 shadow-[0_22px_54px_rgba(23,38,32,0.28)]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-[var(--pine)]">Avatar</p>
            <h2 className="display-cn text-[22px] text-[var(--text-main)]">查看和更换头像</h2>
          </div>
          <button onClick={onClose} className="safe-tap flex items-center justify-center rounded-lg bg-[rgba(209,228,221,0.72)] text-[var(--pine)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col items-center">
          <div className="display-cn flex h-28 w-28 items-center justify-center rounded-lg bg-gradient-to-br from-[#fff7d7] via-[#d5b66f] to-[#92b8a7] text-5xl text-[#28483f] shadow-[0_14px_30px_rgba(90,130,114,0.18)]">
            {avatarText}
          </div>
          <button className="mt-3 flex h-10 items-center gap-2 rounded-lg bg-[rgba(209,228,221,0.72)] px-4 text-sm font-black text-[var(--pine)]">
            <Camera className="h-4 w-4" />
            从相册更换
          </button>
        </div>

        <div className="mt-5 grid grid-cols-6 gap-2">
          {avatarOptions.map((option) => {
            const selected = avatarText === option;
            return (
              <button
                key={option}
                onClick={() => onChange(option)}
                className={`display-cn flex h-12 items-center justify-center rounded-lg text-xl font-black ring-1 ${
                  selected
                    ? "bg-[var(--pine)] text-white ring-[var(--pine)]"
                    : "bg-white/82 text-[var(--pine)] ring-[var(--line-soft)]"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
