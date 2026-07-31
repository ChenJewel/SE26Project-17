/**
 * 社区页、帖子创作和帖子详情交互。
 *
 * 社区列表使用双列瀑布流；右下角加号只负责发布社区帖子。
 * 点开帖子后，文字/照片使用详情面板，视频使用沉浸式详情；点赞、收藏、评论会同步到共享互动状态。
 *
 * 帖子详情已统一使用 `components/post/PostDetailView`，社区和搜索/我的页共用同一套正文、媒体和评论视图。
 * TODO(componentize): 下一步可继续把本文件的大块 JSX 拆到 `PostCard` 和 `PostComposer`。
 *
 * TODO(media): PostVisual 使用 CSS 渐变模拟照片/视频，不是真实媒体资源。
 * 接后端或小程序媒体能力时，要替换为图片/视频组件和资源加载状态。
 */
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Camera,
  Check,
  Heart,
  Image,
  MapPin,
  Play,
  Plus,
  Save,
  Search,
  Send,
  Sparkles,
  Type,
  Video,
  X,
} from "lucide-react";
import type {
  CommunityChannel,
  CommunityComment,
  CommunityInteractionState,
  CommunityMediaSource,
  CommunityMediaType,
  CommunityPost,
  CommunityTopic,
} from "@/data/community";
import { PostDetailView } from "@/components/post/PostDetailView";

interface CommunityProps {
  posts: CommunityPost[];
  comments: CommunityComment[];
  interactions: CommunityInteractionState;
  onPostsChange: (posts: CommunityPost[]) => void;
  onCommentsChange: (comments: CommunityComment[]) => void;
  onInteractionsChange: (interactions: CommunityInteractionState) => void;
  onSearch: () => void;
  onOpenUser: (name: string) => void;
}

type ComposerStep = "choice" | "editor" | null;

const channels: CommunityChannel[] = ["推荐", "关注", "附近", "餐厅", "生活", "经验"];

const channelHint: Record<CommunityChannel, string> = {
  推荐: "算法个性化内容",
  关注: "关注用户的新动态",
  附近: "周边与校园附近",
  餐厅: "餐厅推荐与评价",
  生活: "日常发现与分享",
  经验: "大学经验与建议",
};

const tagClass: Record<CommunityTopic, string> = {
  餐厅: "bg-[rgba(255,247,215,0.9)] text-[#806636]",
  生活: "bg-[rgba(209,228,221,0.92)] text-[var(--pine)]",
  经验: "bg-[rgba(183,176,216,0.24)] text-[#625b98]",
};

function toggleValue(list: string[], value: string) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export default function Community({
  posts,
  comments,
  interactions,
  onPostsChange,
  onCommentsChange,
  onInteractionsChange,
  onSearch,
  onOpenUser,
}: CommunityProps) {
  const [activeChannel, setActiveChannel] = useState<CommunityChannel>("推荐");
  const [composerStep, setComposerStep] = useState<ComposerStep>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftText, setDraftText] = useState("");
  const [draftPlace, setDraftPlace] = useState("");
  const [draftTopic, setDraftTopic] = useState<CommunityTopic>("生活");
  const [draftMediaType, setDraftMediaType] = useState<CommunityMediaType>("text");
  const [draftSource, setDraftSource] = useState<CommunityMediaSource>("text");
  const [draftVisibility, setDraftVisibility] = useState("公开");
  const [draftSaved, setDraftSaved] = useState(false);
  const [activePost, setActivePost] = useState<CommunityPost | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");

  const visiblePosts = useMemo(() => {
    if (activeChannel === "推荐") return [...posts].sort((a, b) => Number(Boolean(b.hot)) - Number(Boolean(a.hot)));
    if (activeChannel === "关注") return posts.filter((post) => post.followed);
    if (activeChannel === "附近") return posts.filter((post) => post.nearby);
    return posts.filter((post) => post.topic === activeChannel);
  }, [activeChannel, posts]);

  const canPublish = draftTitle.trim().length >= 4 && draftText.trim().length >= 6;

  const openComposer = (mediaType: CommunityMediaType, source: CommunityMediaSource) => {
    setDraftMediaType(mediaType);
    setDraftSource(source);
    setComposerStep("editor");
  };

  const closeComposer = () => {
    setComposerStep(null);
    setDraftTitle("");
    setDraftText("");
    setDraftPlace("");
    setDraftTopic("生活");
    setDraftMediaType("text");
    setDraftSource("text");
    setDraftVisibility("公开");
    setDraftSaved(false);
  };

  const publishPost = () => {
    if (!canPublish) return;

    const nextPost: CommunityPost = {
      id: `user-post-${Date.now()}`,
      title: draftTitle.trim(),
      text: draftText.trim(),
      author: "我",
      avatar: "我",
      channel: draftTopic,
      topic: draftTopic,
      mediaType: draftMediaType,
      mediaSource: draftSource,
      place: draftPlace.trim() || "校园",
      likes: "0",
      favorites: "0",
      comments: 0,
      shares: "0",
      imageTone: draftMediaType === "video" ? "road" : draftMediaType === "photo" ? "campus" : "note",
      verified: true,
      followed: true,
      nearby: true,
    };

    onPostsChange([nextPost, ...posts]);
    setActiveChannel("推荐");
    closeComposer();
    // Prototype flow: immediately open the newly-created post as its detail page.
    // A routed app would navigate to /posts/:id after the create API resolves.
    setActivePost(nextPost);
  };

  const togglePostLike = (postId: string) => {
    onInteractionsChange({ ...interactions, likedPostIds: toggleValue(interactions.likedPostIds, postId) });
  };

  const togglePostFavorite = (postId: string) => {
    onInteractionsChange({ ...interactions, favoritePostIds: toggleValue(interactions.favoritePostIds, postId) });
  };

  const toggleCommentLike = (commentId: string) => {
    onInteractionsChange({ ...interactions, likedCommentIds: toggleValue(interactions.likedCommentIds, commentId) });
  };

  const toggleCommentFavorite = (commentId: string) => {
    onInteractionsChange({ ...interactions, favoriteCommentIds: toggleValue(interactions.favoriteCommentIds, commentId) });
  };

  const reportComment = (commentId: string) => {
    if (interactions.reportedCommentIds.includes(commentId)) return;
    onInteractionsChange({ ...interactions, reportedCommentIds: [...interactions.reportedCommentIds, commentId] });
  };

  const publishComment = (post: CommunityPost) => {
    const text = commentDraft.trim();
    if (!text) return;

    const nextComment: CommunityComment = {
      id: `my-comment-${Date.now()}`,
      postId: post.id,
      author: "我",
      avatar: "我",
      text,
      likes: "0",
      time: "刚刚",
      mine: true,
    };

    onCommentsChange([nextComment, ...comments]);
    onInteractionsChange({
      ...interactions,
      userComments: [
        { id: nextComment.id, postId: post.id, postTitle: post.title, text, time: "刚刚" },
        ...interactions.userComments,
      ],
    });
    setCommentDraft("");
  };

  return (
    <div className="app-shell min-h-screen bg-[#f7faf5]">
      <header className="page-header sticky top-0 z-30">
        <div className="mx-auto max-w-md px-4 pb-2 pt-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[12px] font-bold uppercase text-[var(--pine)]">Community</p>
              <h1 className="display-cn text-[25px] leading-tight text-[var(--text-main)]">饭后社区</h1>
            </div>
            <button
              onClick={onSearch}
              className="safe-tap flex items-center justify-center rounded-lg bg-[rgba(251,253,249,0.86)] text-[var(--text-main)] shadow-sm ring-1 ring-[var(--line-soft)]"
              aria-label="搜索用户、卡片和帖子"
            >
              <Search className="h-[20px] w-[20px]" />
            </button>
          </div>

          <div className="mt-2 flex gap-6 overflow-x-auto px-1 no-scrollbar">
            {channels.map((channel) => {
              const selected = activeChannel === channel;
              return (
                <button
                  key={channel}
                  onClick={() => setActiveChannel(channel)}
                  className={`relative h-10 shrink-0 text-[17px] font-black transition ${
                    selected ? "text-[var(--text-main)]" : "text-[var(--text-faint)]"
                  }`}
                  aria-label={channelHint[channel]}
                >
                  {channel}
                  {selected && (
                    <span className="absolute bottom-0 left-1/2 h-[3px] w-7 -translate-x-1/2 rounded-full bg-[var(--pine)]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-2.5 pb-5 pt-3">
        <section className="columns-2 gap-2 [column-fill:_balance]">
          {visiblePosts.map((post) => (
            <PostCard key={post.id} post={post} liked={interactions.likedPostIds.includes(post.id)} onOpen={() => setActivePost(post)} />
          ))}
        </section>
      </main>

      <button
        onClick={() => setComposerStep("choice")}
        className="fixed bottom-[92px] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-[rgba(251,253,249,0.96)] bg-[var(--pine)] text-white shadow-[0_14px_30px_rgba(63,111,96,0.32)] min-[431px]:right-[calc(50%_-_208px)]"
        aria-label="发布社区帖子"
      >
        <Plus className="h-7 w-7" strokeWidth={2.6} />
      </button>

      {composerStep === "choice" && (
        <div className="fixed inset-0 z-50 flex items-end bg-[rgba(22,35,30,0.32)] px-3 pb-3">
          <section className="mx-auto w-full max-w-md rounded-lg bg-[var(--surface)] p-4 shadow-[0_22px_54px_rgba(23,38,32,0.28)]">
            <SheetTitle eyebrow="Create" title="发布社区帖子" onClose={closeComposer} />
            <div className="grid grid-cols-3 gap-2">
              <CreateOption icon={<Type />} title="纯文字" desc="写想法" onClick={() => openComposer("text", "text")} />
              <CreateOption icon={<Image />} title="相册" desc="照片/视频" onClick={() => openComposer("photo", "album")} />
              <CreateOption icon={<Camera />} title="拍照" desc="即时记录" onClick={() => openComposer("video", "camera")} />
            </div>
          </section>
        </div>
      )}

      {composerStep === "editor" && (
        <div className="fixed inset-0 z-50 flex items-end bg-[rgba(22,35,30,0.32)] px-3 pb-3">
          <section className="mx-auto w-full max-w-md rounded-lg bg-[var(--surface)] p-4 shadow-[0_22px_54px_rgba(23,38,32,0.28)]">
            <SheetTitle eyebrow={draftSource === "text" ? "Text" : draftSource === "album" ? "Album" : "Camera"} title="编辑帖子" onClose={closeComposer} />

            {draftSource === "album" && (
              <div className="mb-3 grid grid-cols-2 gap-2">
                {(["photo", "video"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setDraftMediaType(type)}
                    className={`flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-black ring-1 ${
                      draftMediaType === type
                        ? "bg-[var(--pine)] text-white ring-[var(--pine)]"
                        : "bg-[rgba(244,248,244,0.92)] text-[var(--text-muted)] ring-[var(--line-soft)]"
                    }`}
                  >
                    {draftMediaType === type && <Check className="h-4 w-4" />}
                    {type === "photo" ? "照片" : "视频"}
                  </button>
                ))}
              </div>
            )}

            {draftMediaType !== "text" && (
              <div className="mb-3 overflow-hidden rounded-lg ring-1 ring-[var(--line-soft)]">
                <PostVisual tone={draftMediaType === "video" ? "road" : "campus"} topic={draftTopic} mediaType={draftMediaType} compact />
              </div>
            )}

            <div className="space-y-3">
              <input
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                className="h-12 w-full rounded-lg bg-[rgba(244,248,244,0.92)] px-3 text-sm font-bold text-[var(--text-main)] outline-none ring-1 ring-[var(--line-soft)] placeholder:text-[var(--text-faint)] focus:ring-[var(--moss)]"
                placeholder="标题，比如：学校附近哪家店适合聚餐"
              />
              <textarea
                value={draftText}
                onChange={(event) => setDraftText(event.target.value)}
                className="min-h-24 w-full resize-none rounded-lg bg-[rgba(244,248,244,0.92)] px-3 py-3 text-sm font-semibold leading-6 text-[var(--text-main)] outline-none ring-1 ring-[var(--line-soft)] placeholder:text-[var(--text-faint)] focus:ring-[var(--moss)]"
                placeholder="写下餐厅评价、生活发现、大学经验或今天看到的小事。"
              />
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input
                  value={draftPlace}
                  onChange={(event) => setDraftPlace(event.target.value)}
                  className="h-11 min-w-0 rounded-lg bg-[rgba(244,248,244,0.92)] px-3 text-sm font-bold text-[var(--text-main)] outline-none ring-1 ring-[var(--line-soft)] placeholder:text-[var(--text-faint)] focus:ring-[var(--moss)]"
                  placeholder="地点"
                />
                <select
                  value={draftTopic}
                  onChange={(event) => setDraftTopic(event.target.value as CommunityTopic)}
                  className="h-11 rounded-lg bg-[rgba(244,248,244,0.92)] px-2 text-sm font-black text-[var(--text-main)] outline-none ring-1 ring-[var(--line-soft)]"
                >
                  <option value="餐厅">餐厅</option>
                  <option value="生活">生活</option>
                  <option value="经验">经验</option>
                </select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {["公开", "仅关注", "仅同校"].map((item) => (
                  <button
                    key={item}
                    onClick={() => setDraftVisibility(item)}
                    className={`h-10 rounded-lg text-sm font-black ring-1 ${
                      draftVisibility === item
                        ? "bg-[var(--pine)] text-white ring-[var(--pine)]"
                        : "bg-[rgba(244,248,244,0.92)] text-[var(--text-muted)] ring-[var(--line-soft)]"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setDraftSaved(true)}
              className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-white/82 text-sm font-black text-[var(--pine)] ring-1 ring-[var(--line-soft)]"
            >
              <Save className="h-4 w-4" />
              保存草稿
            </button>
            {draftSaved ? (
              <p className="mt-2 rounded-lg bg-[rgba(209,228,221,0.62)] px-3 py-2 text-center text-xs font-black text-[var(--pine)]">
                草稿已保存。正式版会进入草稿箱，并支持继续编辑或删除。
              </p>
            ) : null}

            <button
              onClick={publishPost}
              disabled={!canPublish}
              className={`mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-lg text-sm font-black transition ${
                canPublish
                  ? "bg-[var(--pine)] text-white shadow-[0_12px_26px_rgba(63,111,96,0.22)]"
                  : "bg-[rgba(180,207,194,0.56)] text-[rgba(102,121,112,0.7)]"
              }`}
            >
              <Send className="h-4 w-4" />
              发布帖子 · {draftVisibility}
            </button>
          </section>
        </div>
      )}

      {activePost && (
        <PostDetailView
          post={activePost}
          comments={comments.filter((comment) => comment.postId === activePost.id)}
          interactions={interactions}
          commentsOpen={commentsOpen}
          variant="overlay"
          commentDraft={commentDraft}
          onCommentDraftChange={setCommentDraft}
          onClose={() => {
            setActivePost(null);
            setCommentsOpen(false);
          }}
          onOpenComments={() => setCommentsOpen(true)}
          onCloseComments={() => setCommentsOpen(false)}
          onLikePost={() => togglePostLike(activePost.id)}
          onFavoritePost={() => togglePostFavorite(activePost.id)}
          onPublishComment={() => publishComment(activePost)}
          onLikeComment={toggleCommentLike}
          onFavoriteComment={toggleCommentFavorite}
          onReportComment={reportComment}
          onOpenUser={onOpenUser}
        />
      )}
    </div>
  );
}

function SheetTitle({ eyebrow, title, onClose }: { eyebrow: string; title: string; onClose: () => void }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div>
        <p className="text-xs font-bold uppercase text-[var(--pine)]">{eyebrow}</p>
        <h2 className="display-cn text-[22px] text-[var(--text-main)]">{title}</h2>
      </div>
      <button
        onClick={onClose}
        className="safe-tap flex items-center justify-center rounded-lg bg-[rgba(209,228,221,0.72)] text-[var(--pine)]"
        aria-label="关闭"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}

function CreateOption({ icon, title, desc, onClick }: { icon: ReactNode; title: string; desc: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex min-h-[104px] flex-col items-center justify-center rounded-lg bg-[rgba(244,248,244,0.92)] p-3 text-center ring-1 ring-[var(--line-soft)]"
    >
      <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(209,228,221,0.88)] text-[var(--pine)] [&>svg]:h-5 [&>svg]:w-5">
        {icon}
      </span>
      <span className="text-sm font-black text-[var(--text-main)]">{title}</span>
      <span className="mt-0.5 text-[11px] font-bold text-[var(--text-muted)]">{desc}</span>
    </button>
  );
}

function PostCard({ post, liked, onOpen }: { post: CommunityPost; liked: boolean; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="mb-2 inline-block w-full break-inside-avoid overflow-hidden rounded-lg bg-[rgba(251,253,249,0.94)] text-left align-top shadow-[0_8px_22px_rgba(76,112,97,0.11)] ring-1 ring-[var(--line-soft)]"
    >
      <PostVisual tone={post.imageTone} topic={post.topic} mediaType={post.mediaType} />
      <div className="p-2.5">
        <div className="mb-2 flex items-center gap-1.5">
          <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-black ${tagClass[post.topic]}`}>{post.topic}</span>
          {post.hot && (
            <span className="flex items-center gap-1 rounded-md bg-[rgba(217,154,136,0.18)] px-1.5 py-0.5 text-[10px] font-black text-[#9a5140]">
              <Sparkles className="h-3 w-3" />
              热门
            </span>
          )}
        </div>
        <h2 className="line-clamp-2 text-[15px] font-black leading-[1.35] text-[var(--text-main)]">{post.title}</h2>
        <p className="mt-1.5 line-clamp-3 text-[12px] font-semibold leading-[1.55] text-[var(--text-muted)]">{post.text}</p>
        <div className="mt-2 flex items-center gap-1 text-[11px] font-bold text-[var(--text-faint)]">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{post.place}</span>
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <Avatar text={post.avatar} size="sm" />
            <span className="truncate text-[12px] font-black text-[var(--text-main)]">{post.author}</span>
          </div>
          <span className={`flex shrink-0 items-center gap-0.5 text-[11px] font-bold ${liked ? "text-[#e94d68]" : "text-[var(--text-faint)]"}`}>
            <Heart className={liked ? "h-3.5 w-3.5 fill-current" : "h-3.5 w-3.5"} />
            {post.likes}
          </span>
        </div>
      </div>
    </button>
  );
}

function PostVisual({
  tone,
  topic,
  mediaType,
  compact,
  full,
}: {
  tone: CommunityPost["imageTone"];
  topic: CommunityTopic;
  mediaType: CommunityMediaType;
  compact?: boolean;
  full?: boolean;
}) {
  const visualMap: Record<CommunityPost["imageTone"], string> = {
    window:
      "bg-[linear-gradient(135deg,#d8eee5_0%,#f7faf5_44%,#f0d486_100%)] before:bg-[linear-gradient(90deg,rgba(63,111,96,0.24)_1px,transparent_1px),linear-gradient(0deg,rgba(63,111,96,0.18)_1px,transparent_1px)]",
    table:
      "bg-[linear-gradient(135deg,#f0d486_0%,#fbfdf9_52%,#92b8a7_100%)] before:bg-[radial-gradient(circle_at_30%_36%,rgba(63,111,96,0.32)_0_13%,transparent_14%),radial-gradient(circle_at_70%_68%,rgba(217,154,136,0.38)_0_12%,transparent_13%)]",
    note:
      "bg-[linear-gradient(145deg,#fff7d7_0%,#fbfdf9_58%,#d1e4dd_100%)] before:bg-[repeating-linear-gradient(0deg,rgba(90,130,114,0.18)_0_1px,transparent_1px_18px)]",
    walk:
      "bg-[linear-gradient(145deg,#d1e4dd_0%,#8fb9c7_48%,#f7faf5_100%)] before:bg-[linear-gradient(120deg,transparent_0_38%,rgba(255,255,255,0.72)_39%_45%,transparent_46%)]",
    safety:
      "bg-[linear-gradient(145deg,#21352d_0%,#3f6f60_52%,#d99a88_100%)] before:bg-[radial-gradient(circle_at_78%_22%,rgba(255,247,215,0.9)_0_8%,transparent_9%),linear-gradient(0deg,rgba(255,255,255,0.16)_1px,transparent_1px)]",
    quiet:
      "bg-[linear-gradient(145deg,#b7b0d8_0%,#fbfdf9_48%,#d1e4dd_100%)] before:bg-[radial-gradient(circle_at_28%_34%,rgba(255,255,255,0.72)_0_16%,transparent_17%),radial-gradient(circle_at_72%_66%,rgba(63,111,96,0.22)_0_15%,transparent_16%)]",
    campus:
      "bg-[linear-gradient(145deg,#8fb9c7_0%,#f7faf5_48%,#d5b66f_100%)] before:bg-[radial-gradient(circle_at_32%_42%,rgba(63,111,96,0.24)_0_12%,transparent_13%),radial-gradient(circle_at_72%_35%,rgba(255,255,255,0.8)_0_14%,transparent_15%)]",
    mountain:
      "bg-[linear-gradient(180deg,#8da1bd_0%,#f3f6fb_32%,#c4a04f_62%,#2f2f24_100%)] before:bg-[linear-gradient(145deg,transparent_0_42%,rgba(255,255,255,0.72)_43%_52%,transparent_53%),linear-gradient(24deg,transparent_0_47%,rgba(63,111,96,0.32)_48%_58%,transparent_59%)]",
    road:
      "bg-[linear-gradient(180deg,#59656f_0%,#d7c399_45%,#4d5b55_100%)] before:bg-[linear-gradient(90deg,transparent_0_46%,rgba(255,255,255,0.7)_47%_49%,transparent_50%),linear-gradient(18deg,transparent_0_40%,rgba(240,212,134,0.52)_41%_58%,transparent_59%)]",
  };

  const heightClass = full ? "h-full" : compact ? "h-40" : tone === "note" || tone === "safety" ? "h-44" : tone === "table" ? "h-36" : "h-40";

  return (
    <div className={`relative ${heightClass} overflow-hidden ${visualMap[tone]} before:absolute before:inset-0 before:bg-[length:34px_34px]`}>
      {mediaType === "video" && (
        <span className="absolute left-1/2 top-1/2 z-10 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[rgba(0,0,0,0.34)] text-white backdrop-blur">
          <Play className="h-5 w-5 fill-current" />
        </span>
      )}
      <div className="absolute inset-x-3 bottom-3 flex items-center justify-between">
        <span className="rounded-md bg-[rgba(251,253,249,0.78)] px-2 py-1 text-[11px] font-black text-[var(--text-main)] backdrop-blur">
          {topic}
        </span>
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[rgba(251,253,249,0.72)] text-[var(--pine)] backdrop-blur">
          {mediaType === "video" ? <Video className="h-4 w-4" /> : mediaType === "photo" ? <Image className="h-4 w-4" /> : <Type className="h-4 w-4" />}
        </span>
      </div>
    </div>
  );
}

function Avatar({ text, size = "md", ring }: { text: string; size?: "sm" | "md"; ring?: boolean }) {
  return (
    <span
      className={`display-cn flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#d1e4dd] via-[#d5b66f] to-[#92b8a7] text-[#28483f] ${
        size === "sm" ? "h-8 w-8 text-[13px]" : "h-12 w-12 text-[18px]"
      } ${ring ? "border border-white/70 text-white" : ""}`}
    >
      {text}
    </span>
  );
}
