/**
 * 我的页面。
 *
 * 展示个人资料，以及用户发布/互动过的内容汇总：
 * 已发布帖子、最近划卡、评论、喜欢/收藏帖子、喜欢/收藏评论和关注用户。
 */
import { useState, type ReactNode } from "react";
import { BadgeCheck, Bookmark, Camera, Check, Heart, MessageCircle, PenLine, Plus, Settings, Star, UserPlus, Utensils, X } from "lucide-react";
import type { MealCard } from "@/pages/CreateCard";
import type { CommunityComment, CommunityInteractionState, CommunityPost } from "@/data/community";

interface ProfileProps {
  cards: MealCard[];
  posts: CommunityPost[];
  comments: CommunityComment[];
  interactions: CommunityInteractionState;
  tagOptions: string[];
  profileTags: string[];
  onProfileTagsChange: (tags: string[]) => void;
  onTagOptionsChange: (tags: string[]) => void;
  onSettings: () => void;
  onOpenUser: (name: string) => void;
  onOpenCard: (cardId: string) => void;
  onOpenPost: (postId: string, commentsOpen?: boolean) => void;
}

const avatarOptions = ["我", "U", "食", "饭", "约", "🍚"];

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export default function Profile({
  cards,
  posts,
  comments,
  interactions,
  tagOptions,
  profileTags,
  onProfileTagsChange,
  onTagOptionsChange,
  onSettings,
  onOpenUser,
  onOpenCard,
  onOpenPost,
}: ProfileProps) {
  const myPosts = posts.filter((post) => post.author === "我");
  const recentCards = cards.slice(0, 3);
  const likedPosts = posts.filter((post) => interactions.likedPostIds.includes(post.id));
  const favoritePosts = posts.filter((post) => interactions.favoritePostIds.includes(post.id));
  const followedUsers = Array.from(new Map(posts.filter((post) => post.followed).map((post) => [post.author, post])).values()).slice(0, 6);
  const likedComments = comments.filter((comment) => interactions.likedCommentIds.includes(comment.id));
  const favoriteComments = comments.filter((comment) => interactions.favoriteCommentIds.includes(comment.id));
  const [avatarText, setAvatarText] = useState("我");
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [tagEditorOpen, setTagEditorOpen] = useState(false);

  return (
    <div className="app-shell min-h-screen">
      <header className="page-header sticky top-0 z-20">
        <div className="mx-auto flex max-w-md items-center justify-between px-5 py-4">
          <div>
            <p className="text-[13px] font-bold text-[var(--pine)]">Profile</p>
            <h1 className="display-cn text-[25px] text-[var(--text-main)]">我的</h1>
          </div>
          <button
            aria-label="打开 ueat 设置"
            onClick={onSettings}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--line-soft)] bg-white/80 text-[var(--pine)] shadow-sm"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-md px-5 pt-5">
        <section className="meal-card rounded-lg p-5">
          <div className="card-content flex items-center gap-4">
            <button
              onClick={() => setAvatarOpen(true)}
              className="display-cn flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#fff7d7] via-[#d5b66f] to-[#92b8a7] text-3xl text-[#28483f]"
              aria-label="查看和编辑头像"
            >
              {avatarText}
            </button>
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
            {followedUsers.map((post) => (
              <button key={post.author} onClick={() => onOpenUser(post.author)} className="rounded-lg bg-white/82 p-3 text-center ring-1 ring-[var(--line-soft)]">
                <div className="display-cn mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#d1e4dd] via-[#d5b66f] to-[#92b8a7] text-[#28483f]">
                  {post.avatar}
                </div>
                <p className="mt-2 truncate text-xs font-black text-[var(--text-main)]">{post.author}</p>
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

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg bg-[rgba(255,255,255,0.12)] p-3 text-center ring-1 ring-[rgba(255,255,255,0.16)]">
      <p className="text-xl font-black text-[#fffdf3]">{value}</p>
      <p className="mt-1 text-xs font-bold text-[#d8eade]">{label}</p>
    </div>
  );
}

function ProfileSection({ icon, title, empty, children }: { icon: ReactNode; title: string; empty: string; children: ReactNode }) {
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

function PreferenceTagEditor({
  selectedTags,
  tagOptions,
  onSave,
  onClose,
}: {
  selectedTags: string[];
  tagOptions: string[];
  onSave: (selectedTags: string[], tagOptions: string[]) => void;
  onClose: () => void;
}) {
  const [draftTags, setDraftTags] = useState(selectedTags);
  const [draftOptions, setDraftOptions] = useState(() => uniqueValues([...tagOptions, ...selectedTags]));
  const [customTag, setCustomTag] = useState("");

  const toggleTag = (tag: string) => {
    setDraftTags((current) => (current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]));
  };

  const addTag = () => {
    const nextTag = customTag.trim();
    if (!nextTag) return;
    setDraftOptions((current) => uniqueValues([...current, nextTag]));
    setDraftTags((current) => uniqueValues([...current, nextTag]));
    setCustomTag("");
  };

  return (
    <div className="fixed inset-0 z-[75] flex items-end bg-[rgba(18,30,25,0.34)] px-3 pb-3">
      <section className="mx-auto flex max-h-[82dvh] w-full max-w-md flex-col rounded-lg bg-[var(--surface)] p-4 shadow-[0_22px_54px_rgba(23,38,32,0.28)]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-[var(--pine)]">Tags</p>
            <h2 className="display-cn text-[22px] text-[var(--text-main)]">编辑我的偏好</h2>
          </div>
          <button onClick={onClose} className="safe-tap flex items-center justify-center rounded-lg bg-[rgba(209,228,221,0.72)] text-[var(--pine)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-3 grid grid-cols-[1fr_auto] gap-2">
          <input
            value={customTag}
            onChange={(event) => setCustomTag(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") addTag();
            }}
            className="h-11 min-w-0 rounded-lg bg-[rgba(244,248,244,0.92)] px-4 text-sm font-bold text-[var(--text-main)] outline-none ring-1 ring-[var(--line-soft)] placeholder:text-[var(--text-faint)] focus:ring-[var(--moss)]"
            placeholder="创建新标签"
          />
          <button onClick={addTag} className="flex h-11 items-center gap-1 rounded-lg bg-[var(--pine)] px-4 text-sm font-black text-white">
            <Plus className="h-4 w-4" />
            添加
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex flex-wrap gap-2">
            {draftOptions.map((tag) => {
              const selected = draftTags.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-black transition ${
                    selected
                      ? "bg-[var(--pine)] text-white"
                      : "bg-white/82 text-[var(--text-muted)] ring-1 ring-[var(--line-soft)]"
                  }`}
                >
                  {selected ? <Check className="h-3.5 w-3.5" /> : null}
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={() => onSave(draftTags, draftOptions)}
          className="mt-4 h-12 rounded-lg bg-[var(--pine)] text-sm font-black text-white shadow-[0_12px_26px_rgba(63,111,96,0.22)]"
        >
          保存偏好
        </button>
      </section>
    </div>
  );
}
