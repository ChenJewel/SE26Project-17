import { useEffect, useState, type ReactNode } from "react";
import { Heart, Image, Play, Type, Video } from "lucide-react";
import UserAvatar from "@/components/UserAvatar";
import type { CommunityMediaType, CommunityPost, CommunityTopic } from "@/data/community";
import { resolveMediaUrl } from "@/lib/mediaUrl";

export function CommunityPostPreviewGrid({
  posts,
  onOpenPost,
  actionsForPost,
  isPostLiked,
}: {
  posts: CommunityPost[];
  onOpenPost: (post: CommunityPost) => void;
  actionsForPost?: (post: CommunityPost) => ReactNode;
  isPostLiked?: (post: CommunityPost) => boolean;
}) {
  return (
    // Community cards must stay masonry/self-sizing: two equal-width columns, variable vertical height by media aspect ratio, no fixed row height.
    <div className="columns-2 gap-2">
      {posts.map((post) => (
        <CommunityPostPreviewCard
          key={post.id}
          post={post}
          onOpen={() => onOpenPost(post)}
          liked={Boolean(isPostLiked?.(post))}
          actions={actionsForPost?.(post)}
        />
      ))}
    </div>
  );
}

export function CommunityPostPreviewCard({
  post,
  onOpen,
  liked = false,
  actions,
}: {
  post: CommunityPost;
  onOpen: () => void;
  liked?: boolean;
  actions?: ReactNode;
}) {
  return (
    <article className="mb-2 inline-block w-full break-inside-avoid overflow-hidden rounded-lg bg-transparent text-left align-top shadow-[0_8px_22px_rgba(76,112,97,0.11)] ring-1 ring-[var(--line-soft)]">
      <button
        type="button"
        onClick={onOpen}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpen();
          }
        }}
        className="block w-full text-left"
      >
        <CommunityPostPreviewVisual
          tone={post.imageTone}
          topic={post.topic}
          mediaType={post.mediaType}
          mediaUrl={post.mediaUrls?.[0] ?? post.mediaUrl}
        >
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/65 via-black/28 to-transparent px-2.5 pb-2 pt-10 text-white">
            <h2 className="line-clamp-1 text-[14px] font-semibold leading-[20px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">{post.title}</h2>
            <div className="mt-1 flex items-center gap-1.5">
              <UserAvatar
                text={post.avatar}
                imageUrl={post.avatarUrl}
                rounded="full"
                className="h-[20px] w-[20px] shrink-0 text-[9px] ring-1 ring-white/35"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-semibold leading-[15px] text-white/90">
                  {post.author}
                </span>
                <span className="block truncate text-[10px] font-medium leading-[12px] text-white/70">
                  {formatPostDate(post.createdAt)}
                </span>
              </span>
              <span className={`flex shrink-0 items-center gap-0.5 text-[10px] font-semibold ${liked ? "text-[#ff6f86]" : "text-white/82"}`}>
                <Heart className={`h-3.5 w-3.5 ${liked ? "fill-current" : ""}`} />
                {post.likes}
              </span>
            </div>
          </div>
        </CommunityPostPreviewVisual>
      </button>
      {actions ? <div className="border-t border-[var(--line-soft)] px-2 py-2">{actions}</div> : null}
    </article>
  );
}

function formatPostDate(value?: string) {
  if (!value) return "刚刚";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "刚刚";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return year === new Date().getFullYear() ? `${month}-${day}` : `${year}-${month}-${day}`;
}

function CommunityPostPreviewVisual({
  tone,
  topic,
  mediaType,
  mediaUrl,
  children,
}: {
  tone: CommunityPost["imageTone"];
  topic: CommunityTopic;
  mediaType: CommunityMediaType;
  mediaUrl?: string;
  children?: ReactNode;
}) {
  const [mediaAspectRatio, setMediaAspectRatio] = useState<string | null>(null);
  const resolvedMediaUrl = mediaUrl ? resolveMediaUrl(mediaUrl) : "";

  useEffect(() => {
    setMediaAspectRatio(null);
  }, [resolvedMediaUrl]);

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
  const fallbackMediaAspectRatio = mediaType === "video" ? "9 / 16" : "4 / 5";

  if (resolvedMediaUrl && mediaType !== "text") {
    return (
      <div
        className="relative w-full overflow-hidden bg-black/[0.03]"
        style={{ aspectRatio: mediaAspectRatio ?? fallbackMediaAspectRatio }}
      >
        {mediaType === "video" ? (
          <video
            src={resolvedMediaUrl}
            className="h-full w-full object-cover"
            muted
            playsInline
            preload="metadata"
            onLoadedMetadata={(event) => {
              const video = event.currentTarget;
              if (video.videoWidth && video.videoHeight) setMediaAspectRatio(`${video.videoWidth} / ${video.videoHeight}`);
            }}
          />
        ) : (
          <img
            src={resolvedMediaUrl}
            alt={topic}
            className="h-full w-full object-cover"
            loading="lazy"
            onLoad={(event) => {
              const image = event.currentTarget;
              if (image.naturalWidth && image.naturalHeight) setMediaAspectRatio(`${image.naturalWidth} / ${image.naturalHeight}`);
            }}
          />
        )}
        {mediaType === "video" ? (
          <span className="absolute left-1/2 top-1/2 z-10 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[rgba(0,0,0,0.34)] text-white backdrop-blur">
            <Play className="h-5 w-5 fill-current" />
          </span>
        ) : null}
        <PostTypeBadge mediaType={mediaType} />
        {children}
      </div>
    );
  }

  return (
    <div className={`relative h-40 overflow-hidden ${visualMap[tone]} before:absolute before:inset-0 before:bg-[length:34px_34px]`}>
      <PostTypeBadge mediaType={mediaType} />
      {children}
    </div>
  );
}

function PostTypeBadge({ mediaType }: { mediaType: CommunityMediaType }) {
  return (
    <span className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-md bg-[rgba(251,253,249,0.72)] text-[var(--pine)] backdrop-blur">
      {mediaType === "video" ? <Video className="h-4 w-4" /> : mediaType === "photo" ? <Image className="h-4 w-4" /> : <Type className="h-4 w-4" />}
    </span>
  );
}
