import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { GripVertical, Image, PenLine, Save, Trash2, Video, X } from "lucide-react";
import type { CommunityMediaSource, CommunityMediaType, CommunityTopic } from "@/data/community";
import { useSheetDragToClose } from "@/hooks/useSheetDragToClose";
import { maxPostImageCount } from "./communityUtils";
export function PostManagementActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={onEdit}
        className="flex h-8 w-8 items-center justify-center rounded-md bg-[rgba(209,228,221,0.78)] text-[var(--pine)]"
        aria-label="编辑帖子"
      >
        <PenLine className="h-4 w-4" />
      </button>
      <button
        onClick={onDelete}
        className="flex h-8 w-8 items-center justify-center rounded-md bg-[rgba(217,154,136,0.16)] text-[var(--coral)]"
        aria-label="删除帖子"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export function EditPostSheet({
  title,
  text,
  place,
  topic,
  mediaType,
  previewUrl,
  previewUrls,
  fileName,
  error,
  saving,
  onTitleChange,
  onTextChange,
  onPlaceChange,
  onTopicChange,
  onMediaTypeChange,
  onFileChange,
  onFilesChange,
  onReorder,
  onRemove,
  onClearMedia,
  onClose,
  onSave,
}: {
  title: string;
  text: string;
  place: string;
  topic: CommunityTopic;
  mediaType: CommunityMediaType;
  previewUrl: string;
  previewUrls?: string[];
  fileName?: string;
  error: string;
  saving: boolean;
  onTitleChange: (value: string) => void;
  onTextChange: (value: string) => void;
  onPlaceChange: (value: string) => void;
  onTopicChange: (value: CommunityTopic) => void;
  onMediaTypeChange: (value: CommunityMediaType) => void;
  onFileChange: (file: File | null) => void;
  onFilesChange?: (files: File[]) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  onRemove?: (index: number) => void;
  onClearMedia: () => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const { sheetProps } = useSheetDragToClose(onClose);

  return (
    <div className={`app-bottom-sheet fixed inset-0 z-[85] flex items-end bg-[rgba(22,35,30,0.32)] px-3 ${sheetProps.className}`}>
      <section {...sheetProps} className="mx-auto w-full max-w-md rounded-lg bg-[var(--surface)] p-4 shadow-[0_22px_54px_rgba(23,38,32,0.28)]">
        <SheetTitle eyebrow="Edit" title="编辑帖子" onClose={onClose} />
        <div className="mb-3 grid grid-cols-2 gap-2">
          {(["photo", "video"] as const).map((type) => (
            <button
              key={type}
              onClick={() => onMediaTypeChange(type)}
              className={`h-10 rounded-lg text-sm font-black ring-1 ${
                mediaType === type
                  ? "bg-[var(--pine)] text-white ring-[var(--pine)]"
                  : "bg-[rgba(244,248,244,0.92)] text-[var(--text-muted)] ring-[var(--line-soft)]"
              }`}
            >
              {type === "photo" ? "Photo" : "Video"}
            </button>
          ))}
        </div>
        {mediaType !== "text" ? (
          <MediaPicker
            mediaType={mediaType}
            source="album"
            previewUrl={previewUrl}
            previewUrls={previewUrls}
            fileName={fileName}
            error=""
            onFileChange={onFileChange}
            onFilesChange={onFilesChange}
            onReorder={onReorder}
            onRemove={onRemove}
            multiple={mediaType === "photo"}
            onClear={onClearMedia}
          />
        ) : null}
        <div className="space-y-3">
          <input value={title} onChange={(event) => onTitleChange(event.target.value)} className="h-12 w-full rounded-lg bg-[rgba(244,248,244,0.92)] px-3 text-sm font-bold outline-none ring-1 ring-[var(--line-soft)]" />
          <textarea value={text} onChange={(event) => onTextChange(event.target.value)} className="min-h-24 w-full resize-none rounded-lg bg-[rgba(244,248,244,0.92)] px-3 py-3 text-sm font-semibold leading-6 outline-none ring-1 ring-[var(--line-soft)]" />
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input value={place} onChange={(event) => onPlaceChange(event.target.value)} className="h-11 min-w-0 rounded-lg bg-[rgba(244,248,244,0.92)] px-3 text-sm font-bold outline-none ring-1 ring-[var(--line-soft)]" />
            <select value={topic} onChange={(event) => onTopicChange(event.target.value as CommunityTopic)} className="h-11 rounded-lg bg-[rgba(244,248,244,0.92)] px-2 text-sm font-black outline-none ring-1 ring-[var(--line-soft)]">
              <option value="餐厅">餐厅</option>
              <option value="生活">生活</option>
              <option value="经验">经验</option>
            </select>
          </div>
        </div>
        {error ? <p className="mt-3 rounded-lg bg-[rgba(217,154,136,0.16)] px-3 py-2 text-center text-xs font-black text-[var(--coral)]">{error}</p> : null}
        <button onClick={onSave} disabled={saving} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[var(--pine)] text-sm font-black text-white disabled:opacity-50">
          <Save className="h-4 w-4" />
          {saving ? "保存中..." : "保存修改"}
        </button>
      </section>
    </div>
  );
}

export function MediaPicker({
  mediaType,
  source,
  previewUrl,
  previewUrls,
  fileName,
  error,
  onFileChange,
  onFilesChange,
  onReorder,
  onRemove,
  multiple,
  onClear,
}: {
  mediaType: CommunityMediaType;
  source: CommunityMediaSource;
  previewUrl: string;
  previewUrls?: string[];
  fileName?: string;
  error: string;
  onFileChange: (file: File | null) => void;
  onFilesChange?: (files: File[]) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  onRemove?: (index: number) => void;
  multiple?: boolean;
  onClear: () => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const longPressStart = useRef<{ x: number; y: number } | null>(null);
  const isVideo = mediaType === "video";
  const previews = previewUrls?.length ? previewUrls : previewUrl ? [previewUrl] : [];
  const handleFiles = (fileList: FileList | null) => {
    const files = Array.from(fileList ?? []);
    if (onFilesChange) onFilesChange(files);
    else onFileChange(files[0] ?? null);
  };
  const canReorder = Boolean(onReorder && previews.length > 1 && !isVideo);
  const mediaHint = isVideo
    ? "支持 MP4/WebM"
    : previews.length
      ? `最多 ${maxPostImageCount} 张，长按拖动排序`
      : `最多 ${maxPostImageCount} 张，支持 JPG/PNG/WebP/GIF`;

  const clearLongPressTimer = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  useEffect(() => () => clearLongPressTimer(), []);

  const finishReorderGesture = () => {
    clearLongPressTimer();
    longPressStart.current = null;
    setDragIndex(null);
  };

  const startReorderGesture = (event: ReactPointerEvent<HTMLDivElement>, index: number) => {
    if (!canReorder || (event.target as Element | null)?.closest("button")) return;
    longPressStart.current = { x: event.clientX, y: event.clientY };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Some WebViews can reject pointer capture while native scrolling is active.
    }
    clearLongPressTimer();
    longPressTimer.current = window.setTimeout(() => {
      setDragIndex(index);
      longPressTimer.current = null;
    }, 260);
  };

  const updateReorderGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = longPressStart.current;
    if (!start) return;

    if (dragIndex === null) {
      const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      if (moved > 10) finishReorderGesture();
      return;
    }

    event.preventDefault();
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-media-index]") as HTMLElement | null;
    const targetIndex = Number(target?.dataset.mediaIndex);
    if (Number.isInteger(targetIndex) && targetIndex !== dragIndex) {
      onReorder?.(dragIndex, targetIndex);
      setDragIndex(targetIndex);
    }
  };

  return (
    <section className="mb-3 overflow-hidden rounded-lg bg-[rgba(244,248,244,0.92)] ring-1 ring-[var(--line-soft)]">
      {previews.length ? (
        <div className="bg-white p-2">
          {isVideo ? (
            <div className="relative mx-auto aspect-[9/16] max-h-[360px] overflow-hidden rounded-lg bg-white ring-1 ring-[var(--line-soft)]">
              <VideoPreview url={previews[0]} />
              <button
                onClick={onClear}
                className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/46 text-white backdrop-blur"
                aria-label="移除媒体"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {previews.map((url, index) => (
                <div
                  key={`${url}-${index}`}
                  data-media-index={index}
                  onPointerDown={(event) => startReorderGesture(event, index)}
                  onPointerMove={updateReorderGesture}
                  onPointerUp={finishReorderGesture}
                  onPointerCancel={finishReorderGesture}
                  className={`relative aspect-[9/16] h-52 shrink-0 select-none overflow-hidden rounded-lg bg-white ring-1 ring-[var(--line-soft)] transition ${
                    dragIndex === index ? "scale-[0.98] opacity-80 ring-[var(--pine)]" : ""
                  }`}
                >
                  <img src={url} alt={`媒体预览 ${index + 1}`} draggable={false} className="h-full w-full object-contain" />
                  <span className="absolute left-2 top-2 rounded-md bg-black/50 px-2 py-1 text-[10px] font-black text-white backdrop-blur">
                    {index === 0 ? "首图" : index + 1}
                  </span>
                  {canReorder ? (
                    <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-md bg-black/42 px-2 py-1 text-[10px] font-black text-white backdrop-blur">
                      <GripVertical className="h-3 w-3" /> 长按拖动排序
                    </span>
                  ) : null}
                  <button
                    onClick={() => onRemove?.(index)}
                    className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/46 text-white backdrop-blur"
                    aria-label="移除图片"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <div className="absolute bottom-2 right-2 flex gap-1">
                    <button
                      onClick={() => onReorder?.(index, index - 1)}
                      disabled={index === 0}
                      className="h-7 w-7 rounded-full bg-black/42 text-xs font-black text-white backdrop-blur disabled:opacity-30"
                      aria-label="前移图片"
                    >
                      ←
                    </button>
                    <button
                      onClick={() => onReorder?.(index, index + 1)}
                      disabled={index === previews.length - 1}
                      className="h-7 w-7 rounded-full bg-black/42 text-xs font-black text-white backdrop-blur disabled:opacity-30"
                      aria-label="后移图片"
                    >
                      →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <label className="flex h-44 cursor-pointer flex-col items-center justify-center gap-3 px-4 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(209,228,221,0.88)] text-[var(--pine)]">
            {isVideo ? <Video className="h-6 w-6" /> : <Image className="h-6 w-6" />}
          </span>
          <span className="text-sm font-black text-[var(--text-main)]">
            {isVideo ? "选择视频并预览" : "选择照片并预览"}
          </span>
          <span className="text-xs font-bold text-[var(--text-muted)]">
            {source === "camera" ? "可直接拍摄或从相册选择" : "可多次选择图片，第一张会作为首图"}
          </span>
          <input
            type="file"
            accept={isVideo ? "video/*" : "image/*"}
            capture={source === "camera" ? "environment" : undefined}
            multiple={Boolean(multiple && !isVideo)}
            className="hidden"
            onChange={(event) => {
              handleFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </label>
      )}
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <p className="min-w-0 truncate text-xs font-bold text-[var(--text-muted)]">
          {fileName || mediaHint}
        </p>
        <label className="shrink-0 cursor-pointer rounded-md bg-white px-3 py-1.5 text-xs font-black text-[var(--pine)] ring-1 ring-[var(--line-soft)]">
          {previews.length && !isVideo ? "继续添加" : previews.length ? "更换" : "选择"}
          <input
            type="file"
            accept={isVideo ? "video/*" : "image/*"}
            capture={source === "camera" ? "environment" : undefined}
            multiple={Boolean(multiple && !isVideo)}
            className="hidden"
            onChange={(event) => {
              handleFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </label>
      </div>
      {error ? <p className="px-3 pb-3 text-xs font-black text-[var(--coral)]">{error}</p> : null}
    </section>
  );
}

function VideoPreview({ url }: { url: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [posterUrl, setPosterUrl] = useState("");
  const [posterState, setPosterState] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    setPosterUrl("");
    setPosterState("loading");
    const video = videoRef.current;
    if (!video) return;
    video.load();
  }, [url]);

  const capturePoster = () => {
    const video = videoRef.current;
    if (!video || posterUrl || !video.videoWidth || !video.videoHeight) return;

    try {
      const maxWidth = 720;
      const scale = Math.min(1, maxWidth / video.videoWidth);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas context unavailable");
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      setPosterUrl(canvas.toDataURL("image/jpeg", 0.82));
      setPosterState("ready");
    } catch (error) {
      console.warn("Video preview poster generation failed.", error);
      setPosterState("failed");
    }
  };

  const seekForPoster = () => {
    const video = videoRef.current;
    if (!video) return;

    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const targetTime = duration > 1 ? Math.min(0.8, duration * 0.25) : 0;
    try {
      if (Math.abs(video.currentTime - targetTime) > 0.05) {
        video.currentTime = targetTime;
        return;
      }
    } catch (error) {
      console.warn("Video preview seek failed.", error);
    }
    capturePoster();
  };

  return (
    <>
      <video
        ref={videoRef}
        src={url}
        poster={posterUrl || undefined}
        controls
        muted
        playsInline
        preload="auto"
        className="h-full w-full object-contain"
        onLoadedMetadata={seekForPoster}
        onLoadedData={capturePoster}
        onCanPlay={capturePoster}
        onSeeked={capturePoster}
        onError={() => setPosterState("failed")}
      />
      {posterState !== "ready" ? (
        <div className="pointer-events-none absolute inset-x-3 bottom-3 rounded-lg bg-black/46 px-3 py-2 text-center text-[11px] font-black text-white backdrop-blur">
          {posterState === "failed" ? "该设备暂时无法生成预览封面，点播放可查看视频" : "正在生成预览封面…"}
        </div>
      ) : null}
    </>
  );
}

export function SheetTitle({ eyebrow, title, onClose }: { eyebrow: string; title: string; onClose: () => void }) {
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

export function CreateOption({ icon, title, desc, onClick }: { icon: ReactNode; title: string; desc: string; onClick: () => void }) {
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
