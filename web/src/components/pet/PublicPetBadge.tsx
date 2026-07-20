import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { AvatarStickerLayer } from "@/components/pet/AvatarStickerLayer";
import { vpetAnimations } from "@/components/pet/vpetFrames";
import type { PublicPetSummary } from "@/services/petApi";

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

export function PublicPetBadge({ pet, ownerName = "Ta", compact = false, variant = "profile-card" }: PublicPetBadgeProps) {
  const [speechOpen, setSpeechOpen] = useState(false);
  const [pulseKey, setPulseKey] = useState(0);
  const petName = pet.petName || `${ownerName}的桌宠`;
  const intro = pet.intro || `你好呀，我是${petName}。`;
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
            Lv.{pet.level}
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
            <span className="rounded-md bg-[#fff7d7] px-2 py-1 text-[11px] font-black text-[#806636]">Lv.{pet.level}</span>
            <span className="rounded-md bg-[#effaf3] px-2 py-1 text-[11px] font-black text-[var(--pine)]">{moodLabel(pet.mood)}</span>
          </div>
          {!compact ? <p className="mt-1 line-clamp-1 text-xs font-semibold text-[var(--text-muted)]">点一下听它自我介绍</p> : null}
        </div>
      </button>
    </section>
  );
}

function PublicPetVisual({ pet, size, pulseKey }: { pet: PublicPetSummary; size: "sm" | "md"; pulseKey: number }) {
  const sizeClass = size === "sm" ? "h-16 w-16" : "h-20 w-20";
  const animationClass = useMemo(
    () => (pulseKey ? (pet.petStyle === "avatar-static" ? "public-pet-visual--bob" : "public-pet-visual--pat") : ""),
    [pet.petStyle, pulseKey],
  );

  if (pet.petStyle === "avatar-static") {
    return (
      <span key={pulseKey} className={`public-pet-visual ${animationClass} relative shrink-0 overflow-hidden rounded-full bg-[linear-gradient(160deg,#fff8df,#effaf3_56%,#f7f0ff)] ${sizeClass}`}>
        {pet.avatarPet.customAvatarUrl ? (
          <img src={pet.avatarPet.customAvatarUrl} alt="" className="absolute inset-1 h-[calc(100%-8px)] w-[calc(100%-8px)] rounded-full object-contain" draggable={false} />
        ) : (
          <span className="absolute inset-2 rounded-full bg-[var(--avatar-hair,#d8c5f6)]" />
        )}
        <AvatarStickerLayer stickers={pet.avatarPet.stickers} />
      </span>
    );
  }

  return (
    <span key={pulseKey} className={`public-pet-visual ${animationClass} relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#fff8e5] ${sizeClass}`}>
      <img src={vpetAnimations.touchHead.frames[0]?.src ?? vpetAnimations.idle.frames[0]?.src} alt="" className="h-[86%] w-[86%] object-contain drop-shadow-[0_8px_10px_rgba(23,34,30,0.16)]" draggable={false} />
      <AvatarStickerLayer stickers={pet.animatedPet.stickers} />
    </span>
  );
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
