import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Sparkles } from "lucide-react";
import { AvatarStickerLayer } from "@/components/pet/AvatarStickerLayer";
import { vpetAnimations, type PetAnimationName } from "@/components/pet/vpetFrames";
import { resolveMediaUrl } from "@/lib/mediaUrl";
import type { PublicPetSummary } from "@/services/petApi";
import type { AvatarEyeAnchor, AvatarPetState, AvatarStickerPlacement } from "@/hooks/usePetCompanion";

type PublicPetBadgeProps = {
  pet: PublicPetSummary;
  ownerName?: string;
  compact?: boolean;
  variant?: "profile-card" | "chat-float";
};

const moodLabel = (mood: number) => {
  if (mood >= 82) return "心情很好";
  if (mood >= 58) return "状态稳定";
  if (mood >= 34) return "想被摸摸";
  return "需要陪陪";
};

const fallbackEyeAnchors: AvatarPetState["eyeAnchors"] = {
  left: { x: 0.38, y: 0.48 },
  right: { x: 0.62, y: 0.48 },
};

const fallbackAvatarPet: AvatarPetState = {
  baseId: "q-avatar-big-head-03",
  customAvatarUrl: "/assets/pet-avatar-avatars/avatar-03.png",
  hairColor: "#b79af2",
  eyeColor: "#7c3aed",
  eyeAnchors: fallbackEyeAnchors,
  stickers: [],
};

const builtInAvatarSrcByBaseId: Record<string, string> = {
  "q-avatar-big-head-01": "/assets/pet-avatar-avatars/avatar-01.png",
  "q-avatar-big-head-02": "/assets/pet-avatar-avatars/avatar-02.png",
  "q-avatar-big-head-03": "/assets/pet-avatar-avatars/avatar-03.png",
  "q-avatar-big-head-04": "/assets/pet-avatar-avatars/avatar-04.png",
  "q-avatar-big-head-05": "/assets/pet-avatar-avatars/avatar-05.png",
  "q-avatar-big-head-06": "/assets/pet-avatar-avatars/avatar-06.png",
  "q-avatar-big-head-07": "/assets/pet-avatar-avatars/avatar-07.png",
  "q-avatar-big-head-08": "/assets/pet-avatar-avatars/avatar-08.png",
  "q-avatar-big-head-09": "/assets/pet-avatar-avatars/avatar-09.png",
  "q-avatar-big-head-10": "/assets/pet-avatar-avatars/avatar-10.png",
  "q-avatar-big-head-11": "/assets/pet-avatar-avatars/avatar-11.png",
};

const publicPetPreviewActions: PetAnimationName[] = ["happy", "think", "walkRight", "saySelf"];

export function PublicPetBadge({ pet, ownerName = "Ta", compact = false, variant = "profile-card" }: PublicPetBadgeProps) {
  const [speechOpen, setSpeechOpen] = useState(false);
  const [pulseKey, setPulseKey] = useState(0);
  const petName = pet.petName || `${ownerName}的桌宠`;
  const intro = pet.intro || `你好呀，我是${petName}。`;
  const level = Number.isFinite(pet.level) ? pet.level : 1;
  const mood = Number.isFinite(pet.mood) ? pet.mood : 76;
  const floating = variant === "chat-float";

  useEffect(() => {
    if (!speechOpen) return;
    const timer = window.setTimeout(() => setSpeechOpen(false), 8000);
    return () => window.clearTimeout(timer);
  }, [speechOpen, intro, pulseKey]);

  const triggerIntro = () => {
    setPulseKey((value) => value + 1);
    setSpeechOpen(true);
  };

  if (floating) {
    return (
      <div className="relative inline-flex items-start">
        <button
          type="button"
          onClick={triggerIntro}
          className="group relative flex flex-col items-center text-left"
          aria-label={`查看${petName}的介绍`}
        >
          <PublicPetVisual pet={pet} size="sm" pulseKey={pulseKey} />
          <span className="mt-0.5 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-black text-[var(--pine)] shadow-sm ring-1 ring-[var(--line-soft)]">
            Lv.{level}
          </span>
        </button>
        {speechOpen ? <PetSpeechBubble intro={intro} petName={petName} compact /> : null}
      </div>
    );
  }

  return (
    <section className={`relative rounded-lg bg-white/86 p-3 ring-1 ring-[var(--line-soft)] ${compact ? "mt-2" : ""}`}>
      <button
        type="button"
        onClick={triggerIntro}
        className={`flex w-full items-center text-left ${compact ? "gap-2" : "gap-3"}`}
        aria-label={`查看${petName}的介绍`}
      >
        <span className="relative shrink-0">
          <PublicPetVisual pet={pet} size={compact ? "sm" : "md"} pulseKey={pulseKey} />
          {speechOpen ? <PetSpeechBubble intro={intro} petName={petName} /> : null}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-[var(--pine)]" />
            <p className="truncate text-xs font-black uppercase text-[var(--pine)]">{petName}</p>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="rounded-md bg-[#fff7d7] px-2 py-1 text-[11px] font-black text-[#806636]">Lv.{level}</span>
            <span className="rounded-md bg-[#effaf3] px-2 py-1 text-[11px] font-black text-[var(--pine)]">{moodLabel(mood)}</span>
          </div>
          {!compact ? <p className="mt-1 line-clamp-1 text-xs font-semibold text-[var(--text-muted)]">点一下听它自我介绍</p> : null}
        </div>
      </button>
    </section>
  );
}

function PublicPetVisual({ pet, size, pulseKey }: { pet: PublicPetSummary; size: "sm" | "md"; pulseKey: number }) {
  const sizeClass = size === "sm" ? "h-16 w-16" : "h-20 w-20";
  const petStyle = pet.petStyle === "avatar-static" ? "avatar-static" : "animated-vpet";
  const avatarPet = normalizePublicAvatarPet(pet.avatarPet);
  const animatedPet = pet.animatedPet ?? { stickers: [] };
  const [animatedAction, setAnimatedAction] = useState<PetAnimationName>("idle");
  const [avatarImageFailed, setAvatarImageFailed] = useState(false);
  const [frameIndex, setFrameIndex] = useState(0);
  const [previewStep, setPreviewStep] = useState(0);
  const animationClass = useMemo(
    () => {
      if (petStyle === "animated-vpet" && animatedAction === "walkRight") return "public-pet-visual--scout";
      if (!pulseKey) return "";
      return petStyle === "avatar-static" ? "public-pet-visual--avatar-tap" : "public-pet-visual--pat";
    },
    [animatedAction, petStyle, pulseKey],
  );
  const cssVars = {
    "--avatar-hair": avatarPet.hairColor,
    "--avatar-eye": avatarPet.eyeColor,
    "--avatar-left-eye-x": `${avatarPet.eyeAnchors.left.x * 100}%`,
    "--avatar-left-eye-y": `${avatarPet.eyeAnchors.left.y * 100}%`,
    "--avatar-right-eye-x": `${avatarPet.eyeAnchors.right.x * 100}%`,
    "--avatar-right-eye-y": `${avatarPet.eyeAnchors.right.y * 100}%`,
  } as CSSProperties;
  const avatarImageUrl = avatarImageFailed ? null : avatarPet.customAvatarUrl;
  const hasAvatarImage = Boolean(avatarImageUrl);

  useEffect(() => {
    setAvatarImageFailed(false);
  }, [avatarPet.baseId, avatarPet.customAvatarUrl]);

  useEffect(() => {
    if (petStyle !== "animated-vpet" || pulseKey === 0) return;
    setAnimatedAction("touchHead");
    setFrameIndex(0);
  }, [petStyle, pulseKey]);

  useEffect(() => {
    if (petStyle !== "animated-vpet") return;
    const timer = window.setInterval(() => {
      setPreviewStep((step) => step + 1);
    }, 4200);
    return () => window.clearInterval(timer);
  }, [petStyle]);

  useEffect(() => {
    if (petStyle !== "animated-vpet" || previewStep === 0 || animatedAction !== "idle") return;
    const nextAction = publicPetPreviewActions[(previewStep - 1) % publicPetPreviewActions.length] ?? "happy";
    setAnimatedAction(nextAction);
    setFrameIndex(0);
  }, [animatedAction, petStyle, previewStep]);

  useEffect(() => {
    if (petStyle !== "animated-vpet" || animatedAction !== "walkRight") return;
    const timer = window.setTimeout(() => {
      setAnimatedAction("idle");
      setFrameIndex(0);
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [animatedAction, petStyle]);

  useEffect(() => {
    if (petStyle !== "animated-vpet") return;
    const config = vpetAnimations[animatedAction] ?? vpetAnimations.idle;
    const frames = config.frames.length ? config.frames : vpetAnimations.idle.frames;
    const frame = frames[frameIndex] ?? frames[0];
    const timer = window.setTimeout(() => {
      const next = frameIndex + 1;
      if (next < frames.length) {
        setFrameIndex(next);
        return;
      }
      if (config.loop) {
        setFrameIndex(0);
        return;
      }
      setAnimatedAction("idle");
      setFrameIndex(0);
    }, Math.max(80, frame?.duration ?? 125));
    return () => window.clearTimeout(timer);
  }, [animatedAction, frameIndex, petStyle]);

  if (petStyle === "avatar-static") {
    return (
      <span key={pulseKey} className={`public-avatar-pet public-pet-visual ${animationClass} ${sizeClass}`} style={cssVars}>
        <span className="public-avatar-pet-shadow" />
        <span className="public-avatar-pet-stage">
          {hasAvatarImage ? (
            <img
              src={avatarImageUrl ?? ""}
              alt=""
              className="public-avatar-pet-image"
              draggable={false}
              onError={() => setAvatarImageFailed(true)}
            />
          ) : (
            <PublicAvatarFallbackFace />
          )}
          {!hasAvatarImage ? (
            <>
              <span className="avatar-pet-blink avatar-pet-blink-left" />
              <span className="avatar-pet-blink avatar-pet-blink-right" />
            </>
          ) : null}
          <AvatarStickerLayer stickers={avatarPet.stickers} />
        </span>
      </span>
    );
  }

  const config = vpetAnimations[animatedAction] ?? vpetAnimations.idle;
  const frames = config.frames.length ? config.frames : vpetAnimations.idle.frames;
  const currentFrame = frames[frameIndex] ?? frames[0] ?? vpetAnimations.idle.frames[0];

  return (
    <span className={`public-pet-visual public-pet-visual--animated ${animationClass} relative block shrink-0 ${sizeClass}`}>
      <img src={currentFrame?.src} alt="" className="pointer-events-none block h-auto w-full object-contain drop-shadow-[0_10px_12px_rgba(23,34,30,0.18)]" draggable={false} />
      <AvatarStickerLayer stickers={animatedPet.stickers} />
    </span>
  );
}

function PublicAvatarFallbackFace() {
  return (
    <span className="public-avatar-pet-fallback">
      <span className="public-avatar-pet-hair" />
      <span className="public-avatar-pet-head">
        <span className="public-avatar-pet-bangs" />
        <span className="public-avatar-pet-cheek public-avatar-pet-cheek-left" />
        <span className="public-avatar-pet-cheek public-avatar-pet-cheek-right" />
        <span className="public-avatar-pet-eye public-avatar-pet-eye-left" />
        <span className="public-avatar-pet-eye public-avatar-pet-eye-right" />
        <span className="public-avatar-pet-mouth" />
      </span>
    </span>
  );
}

function normalizePublicAvatarPet(input: Partial<AvatarPetState> | null | undefined): AvatarPetState {
  const baseId = typeof input?.baseId === "string" && input.baseId ? input.baseId : fallbackAvatarPet.baseId;
  const builtInSrc = builtInAvatarSrcByBaseId[baseId] ?? fallbackAvatarPet.customAvatarUrl;
  const customAvatarUrl = normalizePublicAvatarUrl(input?.customAvatarUrl, builtInSrc);

  return {
    ...fallbackAvatarPet,
    ...input,
    baseId,
    customAvatarUrl,
    hairColor: typeof input?.hairColor === "string" && input.hairColor ? input.hairColor : fallbackAvatarPet.hairColor,
    eyeColor: typeof input?.eyeColor === "string" && input.eyeColor ? input.eyeColor : fallbackAvatarPet.eyeColor,
    eyeAnchors: {
      left: normalizeEyeAnchor(input?.eyeAnchors?.left, fallbackEyeAnchors.left),
      right: normalizeEyeAnchor(input?.eyeAnchors?.right, fallbackEyeAnchors.right),
    },
    stickers: normalizePublicStickers(input?.stickers),
  };
}

function normalizePublicAvatarUrl(value: unknown, fallback: string | null) {
  const fallbackUrl = fallback ? resolveMediaUrl(normalizeStaticAvatarAsset(fallback)) : null;
  if (typeof value !== "string" || !value.trim()) return fallbackUrl;
  return resolveMediaUrl(normalizeStaticAvatarAsset(value.trim()));
}

function normalizeStaticAvatarAsset(url: string) {
  return url.replace(/(\/assets\/pet-avatar-avatars\/avatar-\d{2})\.jpg(\?|#|$)/, "$1.png$2");
}

function normalizeEyeAnchor(input: Partial<AvatarEyeAnchor> | null | undefined, fallback: AvatarEyeAnchor): AvatarEyeAnchor {
  return {
    x: typeof input?.x === "number" && Number.isFinite(input.x) ? Math.min(1, Math.max(0, input.x)) : fallback.x,
    y: typeof input?.y === "number" && Number.isFinite(input.y) ? Math.min(1, Math.max(0, input.y)) : fallback.y,
  };
}

function normalizePublicStickers(input: unknown): AvatarStickerPlacement[] {
  if (!Array.isArray(input)) return [];
  return input.filter((item): item is AvatarStickerPlacement => Boolean(item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string"));
}

function PetSpeechBubble({ intro, petName, compact = false }: { intro: string; petName: string; compact?: boolean }) {
  return (
    <div
      className={`pointer-events-none absolute left-full top-1 z-20 ml-2 rounded-lg bg-[#fffdf6] px-3 py-2 text-xs font-bold leading-5 text-[var(--text-main)] shadow-[0_10px_24px_rgba(31,42,35,0.16)] ring-1 ring-[rgba(63,111,96,0.14)] ${
        compact ? "w-[min(220px,calc(100vw-104px))]" : "w-[min(240px,calc(100vw-128px))]"
      }`}
    >
      <p className="line-clamp-1 text-[10px] font-black text-[var(--pine)]">{petName}</p>
      <p className="mt-0.5">{intro}</p>
    </div>
  );
}
