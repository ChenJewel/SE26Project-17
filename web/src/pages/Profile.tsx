import { useEffect, useState } from "react";
import { Bookmark, Camera, Heart, MessageCircle, PenLine, Star, Trash2, UserPlus, Utensils, X } from "lucide-react";
import { PreferenceTagEditor } from "@/components/profile/PreferenceTagEditor";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { ProfileSection } from "@/components/profile/ProfileSection";
import type { CommunityComment, CommunityInteractionState, CommunityPost } from "@/data/community";
import type { fetchMyProfile } from "@/services/userApi";
import { uploadMedia } from "@/services/uploadApi";
import type { CurrentUser } from "@/types/auth";
import type { MealCard } from "@/types/meal";
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
  onAvatarTextChange: (avatarText: string) => void;
  onProfileUpdate: (input: { nickname?: string; school?: string; bio?: string; avatarUrl?: string; avatarText?: string }) => Promise<CurrentUser>;
  onTagOptionsChange: (tags: string[]) => void;
  followedUsers: UserSummary[];
  profileSnapshot: Awaited<ReturnType<typeof fetchMyProfile>> | null;
  onSettings: () => void;
  onLogout: () => void;
  onOpenUser: (name: string, userId?: string) => void;
  onOpenCard: (cardId: string) => void;
  onOpenPost: (postId: string, commentsOpen?: boolean) => void;
  onUpdateCard: (cardId: string, patch: Partial<MealCard>) => Promise<MealCard>;
  onDeleteCard: (cardId: string) => Promise<void>;
}

const avatarOptions = ["我", "U", "饭", "约", "食", "友"];

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
  onAvatarTextChange,
  onProfileUpdate,
  onTagOptionsChange,
  followedUsers,
  profileSnapshot,
  onSettings,
  onLogout,
  onOpenUser,
  onOpenCard,
  onOpenPost,
  onUpdateCard,
  onDeleteCard,
}: ProfileProps) {
  const myUserId = currentUser?.id;
  const myPosts = posts.filter((post) => myUserId ? post.authorId === myUserId : post.author === currentUser?.nickname);
  const myCards = cards.filter((card) => Boolean(myUserId && card.userId === myUserId));
  const likedPosts = profileSnapshot?.likedPosts ?? posts.filter((post) => interactions.likedPostIds.includes(post.id));
  const favoritePosts = profileSnapshot?.favoritePosts ?? posts.filter((post) => interactions.favoritePostIds.includes(post.id));
  const likedComments = profileSnapshot?.likedComments ?? comments.filter((comment) => interactions.likedCommentIds.includes(comment.id));
  const favoriteComments = profileSnapshot?.favoriteComments ?? comments.filter((comment) => interactions.favoriteCommentIds.includes(comment.id));
  const userComments = profileSnapshot?.interactions.userComments ?? interactions.userComments;
  const stats = profileSnapshot?.stats;
  const visibleFollowedUsers = followedUsers.slice(0, 9);

  const [avatarText, setAvatarText] = useState(currentUser?.avatarText ?? "我");
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatarUrl);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [tagEditorOpen, setTagEditorOpen] = useState(false);
  const [followListOpen, setFollowListOpen] = useState<"followers" | "following" | null>(null);

  useEffect(() => {
    setAvatarText(currentUser?.avatarText ?? "我");
    setAvatarUrl(currentUser?.avatarUrl);
    setAvatarOpen(false);
    setProfileEditorOpen(false);
    setTagEditorOpen(false);
  }, [currentUser?.id, currentUser?.avatarText, currentUser?.avatarUrl]);

  return (
    <div className="app-shell min-h-[100dvh]">
      <main className="mx-auto max-w-md px-5 pt-5">
        <ProfileHeader
          nickname={currentUser?.nickname ?? "我"}
          authSummary={authSummary}
          avatarText={avatarText}
          avatarUrl={avatarUrl}
          postCount={stats?.postCount ?? myPosts.length}
          cardCount={stats?.cardCount ?? myCards.length}
          commentCount={stats?.commentCount ?? userComments.length}
          followerCount={stats?.followerCount ?? profileSnapshot?.followers.length ?? followedUsers.length}
          followingCount={stats?.followingCount ?? followedUsers.length}
          onAvatarOpen={() => setAvatarOpen(true)}
          onSettings={onSettings}
          onFollowersOpen={() => setFollowListOpen("followers")}
          onFollowingOpen={() => setFollowListOpen("following")}
        />

        <section className="mt-3 rounded-lg bg-white/82 p-3 ring-1 ring-[var(--line-soft)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase text-[var(--pine)]">Account</p>
              <p className="mt-1 truncate text-sm font-bold text-[var(--text-main)]">{currentUser?.email ?? "未绑定邮箱"}</p>
              <p className="mt-2 line-clamp-2 text-sm font-semibold text-[var(--text-muted)]">
                {currentUser?.bio || "还没有填写个人简介。"}
              </p>
            </div>
            <button onClick={() => setProfileEditorOpen(true)} className="h-9 shrink-0 rounded-lg bg-[rgba(209,228,221,0.72)] px-3 text-xs font-black text-[var(--pine)]">
              编辑资料
            </button>
          </div>
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
            {profileTags.length ? (
              profileTags.map((tag, index) => (
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
              ))
            ) : (
              <p className="text-sm font-semibold text-[var(--text-muted)]">还没有设置偏好。</p>
            )}
          </div>
        </section>

        <ProfileSection icon={<PenLine />} title="我发布的帖子" empty="还没有发布社区帖子">
          {myPosts.map((post) => <MiniPost key={post.id} post={post} onClick={() => onOpenPost(post.id)} />)}
        </ProfileSection>

        <ProfileSection icon={<Utensils />} title="我发布的约饭卡" empty="还没有创建约饭卡">
          {myCards.slice(0, 6).map((card) => (
            <MyMealCardRow
              key={card.id}
              card={card}
              expired={isMealCardExpired(card)}
              onOpen={() => onOpenCard(card.id)}
              onCloseCard={() => onUpdateCard(card.id, { status: "closed" })}
              onReopenCard={() => onUpdateCard(card.id, { status: "active" })}
              onDelete={() => onDeleteCard(card.id)}
            />
          ))}
        </ProfileSection>

        <ProfileSection icon={<MessageCircle />} title="我发布的评论" empty="还没有评论">
          {userComments.map((comment) => (
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
              <button key={user.userId ?? user.name} onClick={() => onOpenUser(user.name, user.userId)} className="rounded-lg bg-white/82 p-3 text-center ring-1 ring-[var(--line-soft)]">
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
        <AvatarEditor
          avatarText={avatarText}
          avatarUrl={avatarUrl}
          onChange={async (value) => {
            setAvatarText(value);
            setAvatarUrl(undefined);
            onAvatarTextChange(value);
            await onProfileUpdate({ avatarText: value, avatarUrl: "" });
          }}
          onUpload={async (file) => {
            const asset = await uploadMedia({
              fileName: file.name,
              mimeType: file.type || "image/jpeg",
              dataBase64: await fileToBase64(file),
              purpose: "avatar",
            });
            setAvatarUrl(asset.url);
            await onProfileUpdate({ avatarUrl: asset.url });
          }}
          onClose={() => setAvatarOpen(false)}
        />
      ) : null}

      {profileEditorOpen && currentUser ? (
        <ProfileInfoEditor
          currentUser={currentUser}
          onClose={() => setProfileEditorOpen(false)}
          onSave={async (input) => {
            await onProfileUpdate(input);
            setProfileEditorOpen(false);
          }}
        />
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

      {followListOpen ? (
        <FollowListSheet
          title={followListOpen === "followers" ? "粉丝" : "关注"}
          users={followListOpen === "followers" ? profileSnapshot?.followers ?? [] : profileSnapshot?.followedUsers ?? followedUsers}
          onClose={() => setFollowListOpen(null)}
          onOpenUser={(user) => {
            setFollowListOpen(null);
            onOpenUser(user.name, user.userId);
          }}
        />
      ) : null}
    </div>
  );
}

function MyMealCardRow({
  card,
  expired,
  onOpen,
  onCloseCard,
  onReopenCard,
  onDelete,
}: {
  card: MealCard;
  expired: boolean;
  onOpen: () => void;
  onCloseCard: () => void;
  onReopenCard: () => void;
  onDelete: () => void;
}) {
  const closed = card.status === "closed";
  return (
    <div className="rounded-lg bg-white/82 p-3 ring-1 ring-[var(--line-soft)]">
      <button onClick={onOpen} className="w-full text-left">
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 truncate font-black text-[var(--text-main)]">{card.place} · {card.time}</p>
          {closed || expired ? (
            <span className="shrink-0 rounded-md bg-[rgba(217,154,136,0.16)] px-2 py-1 text-[11px] font-black text-[var(--coral)]">
              {closed ? "已关闭" : "已过期"}
            </span>
          ) : (
            <span className="shrink-0 rounded-md bg-[rgba(209,228,221,0.72)] px-2 py-1 text-[11px] font-black text-[var(--pine)]">展示中</span>
          )}
        </div>
        <p className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-[var(--text-muted)]">{card.text}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {card.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-md bg-[rgba(209,228,221,0.72)] px-2 py-1 text-[11px] font-black text-[var(--pine)]">{tag}</span>
          ))}
        </div>
      </button>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={closed ? onReopenCard : onCloseCard}
          className="h-9 rounded-lg bg-[rgba(209,228,221,0.72)] text-xs font-black text-[var(--pine)]"
        >
          {closed ? "重新展示" : "关闭展示"}
        </button>
        <button
          onClick={onDelete}
          className="flex h-9 items-center justify-center gap-1 rounded-lg bg-[rgba(217,154,136,0.16)] text-xs font-black text-[var(--coral)]"
        >
          <Trash2 className="h-3.5 w-3.5" />
          删除
        </button>
      </div>
    </div>
  );
}

function FollowListSheet({
  title,
  users,
  onClose,
  onOpenUser,
}: {
  title: string;
  users: UserSummary[];
  onClose: () => void;
  onOpenUser: (user: UserSummary) => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end bg-[rgba(18,30,25,0.34)] px-3">
      <section className="mx-auto max-h-[78dvh] w-full max-w-md overflow-hidden rounded-lg bg-[var(--surface)] shadow-[0_22px_54px_rgba(23,38,32,0.28)]">
        <header className="flex items-center justify-between border-b border-[var(--line-soft)] px-4 py-3">
          <h2 className="display-cn text-[22px] text-[var(--text-main)]">{title}</h2>
          <button onClick={onClose} className="safe-tap flex items-center justify-center rounded-lg bg-[rgba(209,228,221,0.72)] text-[var(--pine)]">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="max-h-[64dvh] overflow-y-auto p-4">
          {users.length ? (
            <div className="space-y-2">
              {users.map((user) => (
                <button key={user.userId ?? user.name} onClick={() => onOpenUser(user)} className="flex w-full items-center gap-3 rounded-lg bg-white/82 p-3 text-left ring-1 ring-[var(--line-soft)]">
                  <div className="display-cn flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#d1e4dd] via-[#d5b66f] to-[#92b8a7] text-[#28483f]">
                    {user.avatar}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-black text-[var(--text-main)]">{user.name}</p>
                    <p className="mt-0.5 truncate text-sm font-semibold text-[var(--text-muted)]">{user.school ?? user.source ?? "校园用户"}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="rounded-lg bg-white/72 p-4 text-center text-sm font-semibold text-[var(--text-muted)]">暂时还没有用户</p>
          )}
        </div>
      </section>
    </div>
  );
}

function isMealCardExpired(card: MealCard) {
  const explicitDate = card.time.trim().match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
  if (!explicitDate) return false;
  const cardDate = new Date(Number(explicitDate[1]), Number(explicitDate[2]) - 1, Number(explicitDate[3]) + 1).getTime();
  return Number.isFinite(cardDate) && cardDate < Date.now();
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
  avatarUrl,
  onChange,
  onUpload,
  onClose,
}: {
  avatarText: string;
  avatarUrl?: string;
  onChange: (value: string) => void | Promise<void>;
  onUpload: (file: File) => Promise<void>;
  onClose: () => void;
}) {
  const [uploading, setUploading] = useState(false);

  return (
    <div className="app-bottom-sheet fixed inset-0 z-[75] flex items-end bg-[rgba(18,30,25,0.34)] px-3">
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
          <div className="display-cn flex h-28 w-28 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-[#fff7d7] via-[#d5b66f] to-[#92b8a7] text-5xl text-[#28483f] shadow-[0_14px_30px_rgba(90,130,114,0.18)]">
            {avatarUrl ? <img src={avatarUrl} alt="头像预览" className="h-full w-full object-cover" /> : avatarText}
          </div>
          <label className="mt-3 flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-[rgba(209,228,221,0.72)] px-4 text-sm font-black text-[var(--pine)]">
            <Camera className="h-4 w-4" />
            {uploading ? "上传中..." : "从相册更换"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setUploading(true);
                try {
                  await onUpload(file);
                } finally {
                  setUploading(false);
                  event.target.value = "";
                }
              }}
            />
          </label>
        </div>

        <div className="mt-5 grid grid-cols-6 gap-2">
          {avatarOptions.map((option) => {
            const selected = !avatarUrl && avatarText === option;
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

function ProfileInfoEditor({
  currentUser,
  onClose,
  onSave,
}: {
  currentUser: CurrentUser;
  onClose: () => void;
  onSave: (input: { nickname: string; school: string; bio: string }) => Promise<void>;
}) {
  const [nickname, setNickname] = useState(currentUser.nickname);
  const [school, setSchool] = useState(currentUser.schoolName);
  const [bio, setBio] = useState(currentUser.bio ?? "");
  const [saving, setSaving] = useState(false);

  return (
    <div className="app-bottom-sheet fixed inset-0 z-[75] flex items-end bg-[rgba(18,30,25,0.34)] px-3">
      <section className="mx-auto w-full max-w-md rounded-lg bg-[var(--surface)] p-4 shadow-[0_22px_54px_rgba(23,38,32,0.28)]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-[var(--pine)]">Profile</p>
            <h2 className="display-cn text-[22px] text-[var(--text-main)]">编辑资料</h2>
          </div>
          <button onClick={onClose} className="safe-tap flex items-center justify-center rounded-lg bg-[rgba(209,228,221,0.72)] text-[var(--pine)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <Field label="昵称" value={nickname} onChange={setNickname} maxLength={24} />
          <Field label="学校" value={school} onChange={setSchool} maxLength={40} />
          <label className="block">
            <span className="mb-1 block text-xs font-black text-[var(--text-muted)]">个人简介</span>
            <textarea
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              maxLength={120}
              className="min-h-24 w-full resize-none rounded-lg bg-white px-3 py-2 text-sm font-semibold text-[var(--text-main)] outline-none ring-1 ring-[var(--line-soft)]"
              placeholder="写一点你喜欢的口味、饭点和聊天方式"
            />
          </label>
        </div>

        <button
          disabled={saving || !nickname.trim()}
          onClick={async () => {
            setSaving(true);
            try {
              await onSave({ nickname: nickname.trim(), school: school.trim(), bio: bio.trim() });
            } finally {
              setSaving(false);
            }
          }}
          className="mt-4 h-11 w-full rounded-lg bg-[var(--pine)] text-sm font-black text-white disabled:opacity-50"
        >
          {saving ? "保存中..." : "保存资料"}
        </button>
      </section>
    </div>
  );
}

function Field({ label, value, onChange, maxLength }: { label: string; value: string; onChange: (value: string) => void; maxLength: number }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-black text-[var(--text-muted)]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={maxLength}
        className="h-11 w-full rounded-lg bg-white px-3 text-sm font-semibold text-[var(--text-main)] outline-none ring-1 ring-[var(--line-soft)]"
      />
    </label>
  );
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
