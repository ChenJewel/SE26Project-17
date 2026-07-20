import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Check, ChevronLeft, RotateCcw, Shirt, Sparkles, Trash2, Upload } from "lucide-react";
import type { AnimatedPetState, AvatarPetState, AvatarStickerPlacement, PetCompanionState } from "@/hooks/usePetCompanion";
import { vpetAnimations } from "@/components/pet/vpetFrames";
import { uploadBinaryMedia } from "@/services/uploadApi";

type PetWardrobePageProps = {
  pet: PetCompanionState;
  onClose: () => void;
  onPatch: (patch: Partial<PetCompanionState>) => void;
};

type StickerManifestItem = {
  id: string;
  tag: string;
  label: string;
  category: string;
  src: string;
};

type StickerManifest = {
  stickers?: StickerManifestItem[];
};

type AvatarVariant = {
  id: string;
  label: string;
  src: string;
  eyeAnchors: AvatarPetState["eyeAnchors"];
};

type StickerOperation = {
  pointerId: number;
  mode: "move" | "resize";
  corner?: "nw" | "ne" | "sw" | "se";
  sticker: AvatarStickerPlacement;
  startX: number;
  startY: number;
  rect: DOMRect;
};

type DraggingAsset = {
  asset: StickerManifestItem;
  startX: number;
  startY: number;
  x: number;
  y: number;
  moved: boolean;
};

type UploadKind = "avatar" | "sticker";

const avatarVariants: AvatarVariant[] = [
  {
    id: "q-avatar-big-head-01",
    label: "粉花帽檐",
    src: "/assets/pet-avatar-avatars/avatar-01.png",
    eyeAnchors: { left: { x: 0.36, y: 0.44 }, right: { x: 0.63, y: 0.44 } },
  },
  {
    id: "q-avatar-big-head-02",
    label: "白发蓝瞳",
    src: "/assets/pet-avatar-avatars/avatar-02.png",
    eyeAnchors: { left: { x: 0.36, y: 0.5 }, right: { x: 0.65, y: 0.5 } },
  },
  {
    id: "q-avatar-big-head-03",
    label: "紫发花饰",
    src: "/assets/pet-avatar-avatars/avatar-03.png",
    eyeAnchors: { left: { x: 0.38, y: 0.48 }, right: { x: 0.65, y: 0.48 } },
  },
  {
    id: "q-avatar-big-head-04",
    label: "小翅膀",
    src: "/assets/pet-avatar-avatars/avatar-04.png",
    eyeAnchors: { left: { x: 0.49, y: 0.58 }, right: { x: 0.64, y: 0.58 } },
  },
  {
    id: "q-avatar-big-head-05",
    label: "灰帽花花",
    src: "/assets/pet-avatar-avatars/avatar-05.png",
    eyeAnchors: { left: { x: 0.45, y: 0.48 }, right: { x: 0.61, y: 0.48 } },
  },
  {
    id: "q-avatar-big-head-06",
    label: "抱枕小睡",
    src: "/assets/pet-avatar-avatars/avatar-06.png",
    eyeAnchors: { left: { x: 0.38, y: 0.54 }, right: { x: 0.58, y: 0.54 } },
  },
  {
    id: "q-avatar-big-head-07",
    label: "蓝发朵朵",
    src: "/assets/pet-avatar-avatars/avatar-07.png",
    eyeAnchors: { left: { x: 0.31, y: 0.5 }, right: { x: 0.63, y: 0.5 } },
  },
  {
    id: "q-avatar-big-head-08",
    label: "九尾狐",
    src: "/assets/pet-avatar-avatars/avatar-08.png",
    eyeAnchors: { left: { x: 0.42, y: 0.47 }, right: { x: 0.58, y: 0.47 } },
  },
  {
    id: "q-avatar-big-head-09",
    label: "捣乱猫",
    src: "/assets/pet-avatar-avatars/avatar-09.png",
    eyeAnchors: { left: { x: 0.36, y: 0.44 }, right: { x: 0.65, y: 0.44 } },
  },
  {
    id: "q-avatar-big-head-10",
    label: "蝶结猫娘",
    src: "/assets/pet-avatar-avatars/avatar-10.png",
    eyeAnchors: { left: { x: 0.44, y: 0.48 }, right: { x: 0.57, y: 0.48 } },
  },
  {
    id: "q-avatar-big-head-11",
    label: "粉发抱柴",
    src: "/assets/pet-avatar-avatars/avatar-11.png",
    eyeAnchors: { left: { x: 0.43, y: 0.43 }, right: { x: 0.55, y: 0.43 } },
  },
];

const stickerSlots = [
  { x: 0.3, y: 0.7, scale: 0.22, rotate: -8, slot: "cheek-left" },
  { x: 0.72, y: 0.28, scale: 0.2, rotate: 10, slot: "hair-right" },
  { x: 0.25, y: 0.25, scale: 0.24, rotate: -5, slot: "bubble-top-left" },
  { x: 0.68, y: 0.68, scale: 0.18, rotate: 6, slot: "cheek-right" },
];
const manifestUrl = "/assets/pet-avatar-stickers/stickers-manifest.json";
const transparentUploadTypes = new Set(["image/png", "image/webp"]);

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

async function inspectTransparentImage(file: File) {
  if (!transparentUploadTypes.has(file.type)) {
    return { ok: false, reason: "请上传 PNG 或 WebP，JPEG 没有透明底信息。" };
  }

  const bitmap = await createImageBitmap(file);
  const sourceWidth = bitmap.width;
  const sourceHeight = bitmap.height;
  const maxSide = 512;
  const ratio = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * ratio));
  const height = Math.max(1, Math.round(sourceHeight * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    bitmap.close?.();
    return { ok: false, reason: "浏览器暂时无法读取图片透明度，请换一张透明 PNG 试试。" };
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  const data = context.getImageData(0, 0, width, height).data;
  let transparentPixels = 0;
  for (let index = 3; index < data.length; index += 4) {
    if (data[index] < 250) transparentPixels += 1;
  }

  const transparentRatio = transparentPixels / (width * height);
  if (transparentRatio < 0.01) {
    return { ok: false, reason: "这张图看起来不是透明底，请先抠成透明 PNG/WebP 再上传。" };
  }

  return { ok: true, reason: "", width: sourceWidth, height: sourceHeight };
}

export function PetWardrobePage({ pet, onClose, onPatch }: PetWardrobePageProps) {
  const isAvatarMode = pet.petStyle === "avatar-static";
  const activeStickers = isAvatarMode ? pet.avatarPet.stickers : pet.animatedPet.stickers;
  const [stickers, setStickers] = useState<StickerManifestItem[]>([]);
  const [customStickers, setCustomStickers] = useState<StickerManifestItem[]>([]);
  const [selectedStickerId, setSelectedStickerId] = useState(activeStickers[0]?.id ?? "");
  const [draggingAsset, setDraggingAsset] = useState<DraggingAsset | null>(null);
  const [uploadingKind, setUploadingKind] = useState<UploadKind | null>(null);
  const [uploadError, setUploadError] = useState("");
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const avatarUploadRef = useRef<HTMLInputElement | null>(null);
  const stickerUploadRef = useRef<HTMLInputElement | null>(null);
  const stickerOperationRef = useRef<StickerOperation | null>(null);
  const suppressStickerClickRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    fetch(manifestUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to load sticker manifest: ${response.status}`);
        return response.json() as Promise<StickerManifest>;
      })
      .then((data) => {
        if (!cancelled) setStickers(data.stickers ?? []);
      })
      .catch((error) => {
        console.warn("Failed to load wardrobe stickers.", error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!draggingAsset) return;

    const move = (event: PointerEvent) => {
      setDraggingAsset((current) => {
        if (!current) return current;
        return {
          ...current,
          x: event.clientX,
          y: event.clientY,
          moved: current.moved || Math.abs(event.clientX - current.startX) > 6 || Math.abs(event.clientY - current.startY) > 6,
        };
      });
    };

    const up = (event: PointerEvent) => {
      setDraggingAsset((current) => {
        if (!current) return current;
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
          const x = clamp((event.clientX - rect.left) / rect.width, 0.08, 0.92);
          const y = clamp((event.clientY - rect.top) / rect.height, 0.08, 0.92);
          addStickerAt(current.asset, x, y);
        }
        suppressStickerClickRef.current = current.moved;
        window.setTimeout(() => {
          suppressStickerClickRef.current = false;
        }, 0);
        return null;
      });
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    window.addEventListener("pointercancel", up, { once: true });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [draggingAsset]);

  useEffect(() => {
    if (activeStickers.some((sticker) => sticker.id === selectedStickerId)) return;
    setSelectedStickerId(activeStickers[0]?.id ?? "");
  }, [activeStickers, selectedStickerId]);

  const selectedPlacement = activeStickers.find((sticker) => sticker.id === selectedStickerId) ?? activeStickers[0] ?? null;
  const savedCustomStickers = useMemo(
    () =>
      pet.avatarPet.stickers
        .filter((sticker) => sticker.src)
        .map((sticker) => ({
          id: sticker.id,
          tag: sticker.sourceTag ?? "custom",
          label: "自定义贴纸",
          category: "custom",
          src: sticker.src ?? "",
        })),
    [pet.avatarPet.stickers],
  );
  const savedAnimatedCustomStickers = useMemo(
    () =>
      pet.animatedPet.stickers
        .filter((sticker) => sticker.src)
        .map((sticker) => ({
          id: sticker.id,
          tag: sticker.sourceTag ?? "custom",
          label: "Custom sticker",
          category: "custom",
          src: sticker.src ?? "",
        })),
    [pet.animatedPet.stickers],
  );
  const allStickerAssets = useMemo(
    () => [...stickers, ...customStickers, ...savedCustomStickers, ...savedAnimatedCustomStickers],
    [customStickers, savedAnimatedCustomStickers, savedCustomStickers, stickers],
  );
  const stickerAssets = useMemo(() => new Map(allStickerAssets.map((sticker) => [sticker.id, sticker])), [allStickerAssets]);
  const wardrobeStickers = useMemo(() => {
    const builtInIds = new Set(stickers.map((sticker) => sticker.id));
    const customOnly = [...customStickers, ...savedCustomStickers, ...savedAnimatedCustomStickers].filter((sticker) => !builtInIds.has(sticker.id));
    return [...new Map(customOnly.map((sticker) => [sticker.id, sticker])).values(), ...stickers];
  }, [customStickers, savedAnimatedCustomStickers, savedCustomStickers, stickers]);

  const patchAvatar = (patch: Partial<AvatarPetState>) => {
    onPatch({
      avatarPet: {
        ...pet.avatarPet,
        ...patch,
      },
      currentAction: pet.petStyle === "avatar-static" ? "happy" : pet.currentAction,
      lastLine: "衣柜更新好啦，我把新装扮带上了。",
    });
  };

  const patchAnimated = (patch: Partial<AnimatedPetState>) => {
    onPatch({
      animatedPet: {
        ...pet.animatedPet,
        ...patch,
      },
      currentAction: pet.currentAction,
    });
  };

  const patchActiveStickers = (nextStickers: AvatarStickerPlacement[]) => {
    if (isAvatarMode) {
      patchAvatar({ stickers: nextStickers });
      return;
    }

    patchAnimated({ stickers: nextStickers });
  };

  const setStyle = (petStyle: PetCompanionState["petStyle"]) => {
    onPatch({
      petStyle,
      wallMode: "none",
      edgeHidden: "none",
      currentAction: petStyle === "avatar-static" ? "happy" : "saySelf",
      lastLine: petStyle === "avatar-static" ? "切换到 Q 版头像桌宠啦，轻轻漂浮陪你。" : "切换回动态桌宠啦，动作全套回来。",
    });
  };

  const setVariant = (variant: AvatarVariant) => {
    onPatch({
      petStyle: "avatar-static",
      currentAction: "happy",
      avatarPet: {
        ...pet.avatarPet,
        baseId: variant.id,
        customAvatarUrl: variant.src,
        eyeAnchors: variant.eyeAnchors,
      },
      lastLine: "头像换好啦，贴纸也可以直接拖上来。",
    });
  };

  const uploadTransparentAsset = async (file: File, kind: UploadKind) => {
    setUploadError("");
    setUploadingKind(kind);
    try {
      const inspected = await inspectTransparentImage(file);
      if (!inspected.ok) {
        setUploadError(inspected.reason);
        return null;
      }

      const asset = await uploadBinaryMedia({
        fileName: file.name,
        mimeType: file.type,
        file,
        purpose: kind === "avatar" ? "pet-avatar" : "pet-sticker",
      });
      return asset;
    } catch (error) {
      console.warn("Failed to upload pet wardrobe asset.", error);
      setUploadError("上传失败，请确认已登录并稍后重试。");
      return null;
    } finally {
      setUploadingKind(null);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    const asset = await uploadTransparentAsset(file, "avatar");
    if (!asset) return;

    onPatch({
      petStyle: "avatar-static",
      currentAction: "happy",
      avatarPet: {
        ...pet.avatarPet,
        baseId: `custom-avatar-${asset.id}`,
        customAvatarUrl: asset.url,
      },
      lastLine: "透明头像上传好啦，已经换到桌宠身上。",
    });
  };

  const handleStickerUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    const asset = await uploadTransparentAsset(file, "sticker");
    if (!asset) return;

    const customSticker: StickerManifestItem = {
      id: `custom-sticker-${asset.id}`,
      tag: "custom",
      label: file.name,
      category: "custom",
      src: asset.url,
    };
    setCustomStickers((current) => [customSticker, ...current.filter((sticker) => sticker.id !== customSticker.id)]);
    addStickerAt(customSticker, 0.5, 0.5);
  };

  const addStickerAt = (asset: StickerManifestItem, x = 0.5, y = 0.5) => {
    const existing = activeStickers.find((sticker) => sticker.id === asset.id);
    if (existing) {
      patchActiveStickers(
        activeStickers.map((sticker) =>
          sticker.id === asset.id ? { ...sticker, x, y, src: asset.category === "custom" ? asset.src : sticker.src } : sticker
        ),
      );
      setSelectedStickerId(asset.id);
      return;
    }

    const slot = stickerSlots[activeStickers.length % stickerSlots.length];
    const nextSticker: AvatarStickerPlacement = {
      id: asset.id,
      sourceTag: asset.tag,
      slot: slot.slot,
      x,
      y,
      scale: slot.scale,
      rotate: slot.rotate,
      src: asset.category === "custom" ? asset.src : undefined,
    };
    const nextStickers = [...activeStickers, nextSticker].slice(-4);
    patchActiveStickers(nextStickers);
    setSelectedStickerId(asset.id);
  };

  const removeSelectedSticker = () => {
    if (!selectedPlacement) return;
    const nextStickers = activeStickers.filter((sticker) => sticker.id !== selectedPlacement.id);
    patchActiveStickers(nextStickers);
    setSelectedStickerId(nextStickers[0]?.id ?? "");
  };

  const resetSelectedSticker = () => {
    if (!selectedPlacement) return;
    const slot = stickerSlots[0];
    updateSticker(selectedPlacement.id, { x: slot.x, y: slot.y, scale: slot.scale, rotate: slot.rotate });
  };

  const updateSticker = (id: string, patch: Partial<AvatarStickerPlacement>) => {
    patchActiveStickers(
      activeStickers.map((sticker) =>
        sticker.id === id ? { ...sticker, ...patch } : sticker
      ),
    );
  };

  const startAssetDrag = (asset: StickerManifestItem, event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    setDraggingAsset({
      asset,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      moved: false,
    });
  };

  const startStickerOperation = (sticker: AvatarStickerPlacement, mode: StickerOperation["mode"], event: React.PointerEvent<HTMLElement>, corner?: StickerOperation["corner"]) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    event.stopPropagation();
    setSelectedStickerId(sticker.id);
    stickerOperationRef.current = {
      pointerId: event.pointerId,
      mode,
      corner,
      sticker,
      startX: event.clientX,
      startY: event.clientY,
      rect,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveStickerOperation = (event: React.PointerEvent<HTMLElement>) => {
    const operation = stickerOperationRef.current;
    if (!operation || operation.pointerId !== event.pointerId) return;
    const dx = (event.clientX - operation.startX) / operation.rect.width;
    const dy = (event.clientY - operation.startY) / operation.rect.height;

    if (operation.mode === "move") {
      updateSticker(operation.sticker.id, {
        x: clamp(operation.sticker.x + dx, 0.05, 0.95),
        y: clamp(operation.sticker.y + dy, 0.05, 0.95),
      });
      return;
    }

    const east = operation.corner?.includes("e") ? 1 : -1;
    const south = operation.corner?.includes("s") ? 1 : -1;
    const delta = (dx * east + dy * south) / 2;
    updateSticker(operation.sticker.id, {
      scale: clamp(operation.sticker.scale + delta, 0.08, 0.48),
    });
  };

  const stopStickerOperation = (event: React.PointerEvent<HTMLElement>) => {
    if (stickerOperationRef.current?.pointerId === event.pointerId) {
      stickerOperationRef.current = null;
    }
  };

  const avatarSrc = pet.avatarPet.customAvatarUrl ?? avatarVariants[0].src;

  return (
    <main className="fixed inset-0 z-[150] bg-[var(--page-bg)] text-[var(--text-main)]">
      <input ref={avatarUploadRef} type="file" accept="image/png,image/webp" className="hidden" onChange={handleAvatarUpload} />
      <input ref={stickerUploadRef} type="file" accept="image/png,image/webp" className="hidden" onChange={handleStickerUpload} />
      <header className="border-b border-[var(--line-soft)] bg-white/94 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+12px)] backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--chip-bg)] text-[var(--pine)]" aria-label="返回">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase text-[#7c8f86]">Pet Wardrobe</p>
            <h1 className="truncate text-lg font-black">桌宠衣柜</h1>
          </div>
          <button onClick={onClose} className="rounded-lg bg-[var(--pine)] px-4 py-2 text-sm font-black text-white">
            完成
          </button>
        </div>
      </header>

      <div className="mx-auto grid h-[calc(100dvh-env(safe-area-inset-top)-66px)] max-w-4xl grid-rows-[auto_auto_minmax(0,1fr)] gap-3 px-3 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3">
        <section className="grid grid-cols-2 gap-2">
          <StyleButton active={pet.petStyle === "animated-vpet"} label="A 款动态" detail="完整动作" icon={<Sparkles />} onClick={() => setStyle("animated-vpet")} />
          <StyleButton active={pet.petStyle === "avatar-static"} label="B 款头像" detail="拖贴纸装扮" icon={<Shirt />} onClick={() => setStyle("avatar-static")} />
        </section>

        <div
          className={`min-h-8 rounded-lg px-3 py-2 text-xs font-bold ring-1 ${
            uploadError ? "bg-[#fff1f1] text-[#a14e4e] ring-[#f1caca]" : "bg-transparent text-transparent ring-transparent"
          }`}
          aria-live="polite"
        >
          {uploadError || "透明图片提示"}
        </div>

        <section className="grid min-h-0 grid-cols-[minmax(0,1fr)_82px] gap-2 sm:grid-cols-[minmax(0,1fr)_104px]">
          <div className="flex min-h-0 flex-col gap-2">
            <div ref={canvasRef} className="relative min-h-0 flex-1 overflow-hidden rounded-lg bg-[linear-gradient(160deg,#fff8df,#effaf3_56%,#f7f0ff)] p-3 ring-1 ring-[var(--line-soft)]">
              <div className="absolute left-3 top-3 z-20 rounded-full bg-white/86 px-2 py-1 text-[10px] font-black text-[var(--text-muted)] shadow-sm">
                {pet.petStyle === "avatar-static" ? "把右侧贴纸拖进画布" : "A 款可在上方切换回 B 款编辑贴纸"}
              </div>

              <div className="absolute inset-3 flex items-center justify-center">
                {isAvatarMode ? (
                  <img src={avatarSrc} alt="" className="h-full max-h-full w-full max-w-full rounded-[28px] object-contain drop-shadow-[0_18px_20px_rgba(23,34,30,0.16)]" draggable={false} />
                ) : (
                  <img src={vpetAnimations.idle.frames[0]?.src} alt="" className="w-[min(60%,210px)] drop-shadow-[0_18px_20px_rgba(23,34,30,0.18)]" draggable={false} />
                )}
              </div>

              <div className="absolute inset-3 z-10">
                {activeStickers.map((sticker) => {
                    const asset = stickerAssets.get(sticker.id);
                    const selected = selectedPlacement?.id === sticker.id;
                    if (!asset) return null;
                    return (
                      <div
                        key={sticker.id}
                        role="button"
                        tabIndex={0}
                        className={`absolute touch-none ${selected ? "z-30" : "z-20"}`}
                        style={stickerStyle(sticker)}
                        onPointerDown={(event) => startStickerOperation(sticker, "move", event)}
                        onPointerMove={moveStickerOperation}
                        onPointerUp={stopStickerOperation}
                        onPointerCancel={stopStickerOperation}
                      >
                        <img src={asset.src} alt="" className="pointer-events-none h-full w-full object-contain drop-shadow-[0_5px_6px_rgba(52,40,62,0.18)]" draggable={false} />
                        {selected ? <StickerHandles sticker={sticker} onStart={startStickerOperation} onMove={moveStickerOperation} onStop={stopStickerOperation} /> : null}
                      </div>
                    );
                })}
              </div>

              {draggingAsset ? (
                <img
                  src={draggingAsset.asset.src}
                  alt=""
                  className="pointer-events-none fixed z-[180] h-14 w-14 -translate-x-1/2 -translate-y-1/2 object-contain drop-shadow-[0_10px_16px_rgba(31,42,35,0.24)]"
                  style={{ left: draggingAsset.x, top: draggingAsset.y }}
                  draggable={false}
                />
              ) : null}
            </div>

            {isAvatarMode ? (
            <div className="flex gap-2 overflow-x-auto rounded-lg bg-white p-2 ring-1 ring-[var(--line-soft)]">
              <button
                onClick={() => avatarUploadRef.current?.click()}
                disabled={uploadingKind !== null}
                className="flex h-16 w-16 shrink-0 flex-col items-center justify-center gap-1 rounded-lg bg-[#effaf3] text-[10px] font-black text-[var(--pine)] ring-2 ring-transparent disabled:opacity-55"
                aria-label="上传透明头像"
                title="上传透明头像"
              >
                <Upload className="h-4 w-4" />
                <span>{uploadingKind === "avatar" ? "上传中" : "头像"}</span>
              </button>
              {avatarVariants.map((variant) => (
                <button
                  key={variant.id}
                  onClick={() => setVariant(variant)}
                  className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-[#fbfaf7] ring-2 ${pet.avatarPet.baseId === variant.id ? "ring-[var(--pine)]" : "ring-transparent"}`}
                  aria-label={variant.label}
                  title={variant.label}
                >
                  <img src={variant.src} alt="" className="h-full w-full object-cover" draggable={false} />
                  {pet.avatarPet.baseId === variant.id ? (
                    <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--pine)] text-white">
                      <Check className="h-3 w-3" />
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
            ) : null}
          </div>

          <aside className="flex min-h-0 flex-col gap-2 rounded-lg bg-white p-2 ring-1 ring-[var(--line-soft)]">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-black text-[var(--text-muted)]">贴纸</span>
              <span className="rounded-md bg-[#f7f5ef] px-1.5 py-0.5 text-[10px] font-black text-[var(--text-faint)]">{activeStickers.length}/4</span>
            </div>
            <button
              onClick={() => stickerUploadRef.current?.click()}
              disabled={uploadingKind !== null}
              className="flex h-10 items-center justify-center rounded-lg bg-[#effaf3] text-[var(--pine)] ring-1 ring-[#d8e8dc] disabled:opacity-55"
              aria-label="上传透明贴纸"
              title="上传透明贴纸"
            >
              <Upload className="h-4 w-4" />
            </button>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
              {wardrobeStickers.map((asset) => {
                const active = activeStickers.some((sticker) => sticker.id === asset.id);
                return (
                  <button
                    key={asset.id}
                    onPointerDown={(event) => startAssetDrag(asset, event)}
                    onClick={() => {
                      if (suppressStickerClickRef.current) return;
                      addStickerAt(asset, 0.5, 0.5);
                    }}
                    className={`relative flex aspect-square w-full items-center justify-center rounded-lg bg-[#fbfaf7] p-2 ring-1 ${active ? "ring-[var(--pine)]" : "ring-[var(--line-soft)]"}`}
                    aria-label={asset.label}
                    title={asset.label}
                  >
                    <img src={asset.src} alt="" className="max-h-full max-w-full object-contain" draggable={false} />
                    {active ? (
                      <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--pine)] text-white">
                        <Check className="h-3 w-3" />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <div className="grid gap-1.5">
              <button
                disabled={!selectedPlacement}
                onClick={resetSelectedSticker}
                className="flex h-9 items-center justify-center rounded-md bg-[#f7f5ef] text-[var(--text-muted)] disabled:opacity-45"
                aria-label="重置贴纸"
                title="重置贴纸"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                disabled={!selectedPlacement}
                onClick={removeSelectedSticker}
                className="flex h-9 items-center justify-center rounded-md bg-[#fff1f1] text-[#a14e4e] disabled:opacity-45"
                aria-label="删除贴纸"
                title="删除贴纸"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function stickerStyle(sticker: AvatarStickerPlacement): CSSProperties {
  return {
    left: `${sticker.x * 100}%`,
    top: `${sticker.y * 100}%`,
    width: `${sticker.scale * 100}%`,
    aspectRatio: "1 / 1",
    transform: `translate(-50%, -50%) rotate(${sticker.rotate}deg)`,
  };
}

function StickerHandles({
  sticker,
  onStart,
  onMove,
  onStop,
}: {
  sticker: AvatarStickerPlacement;
  onStart: (sticker: AvatarStickerPlacement, mode: StickerOperation["mode"], event: React.PointerEvent<HTMLElement>, corner?: StickerOperation["corner"]) => void;
  onMove: (event: React.PointerEvent<HTMLElement>) => void;
  onStop: (event: React.PointerEvent<HTMLElement>) => void;
}) {
  const handles: Array<{ corner: StickerOperation["corner"]; className: string }> = [
    { corner: "nw", className: "-left-2 -top-2 cursor-nwse-resize" },
    { corner: "ne", className: "-right-2 -top-2 cursor-nesw-resize" },
    { corner: "sw", className: "-bottom-2 -left-2 cursor-nesw-resize" },
    { corner: "se", className: "-bottom-2 -right-2 cursor-nwse-resize" },
  ];

  return (
    <>
      <span className="pointer-events-none absolute inset-0 rounded-md outline outline-2 outline-white drop-shadow-[0_0_5px_rgba(31,42,35,0.2)]" />
      {handles.map((handle) => (
        <span
          key={handle.corner}
          className={`absolute flex h-5 w-5 touch-none items-center justify-center rounded-full bg-white shadow-[0_4px_10px_rgba(31,42,35,0.2)] ring-2 ring-[var(--pine)] ${handle.className}`}
          onPointerDown={(event) => onStart(sticker, "resize", event, handle.corner)}
          onPointerMove={onMove}
          onPointerUp={onStop}
          onPointerCancel={onStop}
        />
      ))}
    </>
  );
}

function StyleButton({ active, label, detail, icon, onClick }: { active: boolean; label: string; detail: string; icon: ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex min-w-0 items-center gap-2 rounded-lg p-2 text-left ring-1 ${active ? "bg-[var(--pine)] text-white ring-[var(--pine)]" : "bg-white text-[var(--text-main)] ring-[var(--line-soft)]"}`}>
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${active ? "bg-white/18" : "bg-[#f7f5ef] text-[var(--pine)]"} [&_svg]:h-4 [&_svg]:w-4`}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-black">{label}</span>
        <span className={`block truncate text-[11px] font-bold ${active ? "text-white/78" : "text-[var(--text-faint)]"}`}>{detail}</span>
      </span>
    </button>
  );
}
