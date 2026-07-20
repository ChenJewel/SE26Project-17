import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { AvatarStickerLayer } from "@/components/pet/AvatarStickerLayer";
import { vpetAnimations } from "@/components/pet/vpetFrames";
import type { PublicPetSummary } from "@/services/petApi";

type PublicPetBadgeProps = {
  pet: PublicPetSummary;
  ownerName?: string;
  compact?: boolean;
};

const moodLabel = (mood: number) => {
  if (mood >= 82) return "心情很好";
  if (mood >= 58) return "状态稳定";
  if (mood >= 34) return "想被摸摸";
  return "需要陪陪";
};

export function PublicPetBadge({ pet, ownerName = "Ta", compact = false }: PublicPetBadgeProps) {
  const [speechOpen, setSpeechOpen] = useState(false);
  const intro = pet.intro || `你好呀，我是 ${ownerName} 的桌宠。`;

  useEffect(() => {
    if (!speechOpen) return;
    const timer = window.setTimeout(() => setSpeechOpen(false), 8000);
    return () => window.clearTimeout(timer);
  }, [speechOpen, intro]);

  return (
    <section className={`relative rounded-lg bg-white/86 p-3 ring-1 ring-[var(--line-soft)] ${compact ? "mt-2" : ""}`}>
      {speechOpen ? (
        <div className="absolute -top-2 left-4 right-3 z-10 -translate-y-full rounded-lg bg-[#fffdf6] px-3 py-2 text-xs font-bold leading-5 text-[var(--text-main)] shadow-[0_10px_24px_rgba(31,42,35,0.16)] ring-1 ring-[rgba(63,111,96,0.14)]">
          {intro}
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => setSpeechOpen(true)}
        className={`flex w-full items-center text-left ${compact ? "gap-2" : "gap-3"}`}
        aria-label={`查看${ownerName}的桌宠介绍`}
      >
        <PublicPetVisual pet={pet} compact={compact} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-[var(--pine)]" />
            <p className="truncate text-xs font-black uppercase text-[var(--pine)]">{ownerName} 的桌宠</p>
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

function PublicPetVisual({ pet, compact }: { pet: PublicPetSummary; compact?: boolean }) {
  const sizeClass = compact ? "h-14 w-14" : "h-20 w-20";

  if (pet.petStyle === "avatar-static") {
    return (
      <span className={`relative shrink-0 overflow-hidden rounded-full bg-[linear-gradient(160deg,#fff8df,#effaf3_56%,#f7f0ff)] ${sizeClass}`}>
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
    <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#fff8e5] ${sizeClass}`}>
      <img src={vpetAnimations.idle.frames[0]?.src} alt="" className="h-[82%] w-[82%] object-contain drop-shadow-[0_8px_10px_rgba(23,34,30,0.16)]" draggable={false} />
    </span>
  );
}
