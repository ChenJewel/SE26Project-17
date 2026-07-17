import { useEffect, useRef, useState, type ReactNode } from "react";
import { Minus, Moon, Shirt, Sparkles, Utensils, X } from "lucide-react";
import type { PetCompanionState, PetPosition } from "@/hooks/usePetCompanion";
import { vpetAnimations, type PetAnimationName } from "@/components/pet/vpetFrames";

type PetCompanionProps = {
  pet: PetCompanionState;
  xpToNext: number;
  onPatch: (patch: Partial<PetCompanionState>) => void;
  onMove: (position: PetPosition) => void;
  onFeed: () => void;
  onAnimationDone: () => void;
};

const sizeClass: Record<PetCompanionState["size"], string> = {
  sm: "w-[116px]",
  md: "w-[148px]",
  lg: "w-[180px]",
};

const petSizePx: Record<PetCompanionState["size"], number> = {
  sm: 116,
  md: 148,
  lg: 180,
};

export function PetCompanion({ pet, xpToNext, onPatch, onMove, onFeed, onAnimationDone }: PetCompanionProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; origin: PetPosition; moved: boolean } | null>(null);
  const suppressClickRef = useRef(false);

  const moodLabel = pet.hunger < 26 ? "Hungry" : pet.mood > 78 ? "Happy" : pet.mood < 38 ? "Needs pat" : "With you";
  const animation = pet.currentAction === "idle" && pet.hunger < 20 ? "sleep" : pet.currentAction;

  if (!pet.visible) return null;

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: pet.position,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const width = pet.collapsed ? 64 : petSizePx[pet.size] + 46;
    const height = pet.collapsed ? 64 : petSizePx[pet.size] + 60;
    const nextX = Math.max(8, Math.min(window.innerWidth - width - 8, drag.origin.x + event.clientX - drag.startX));
    const nextY = Math.max(8, Math.min(window.innerHeight - height - 8, drag.origin.y + event.clientY - drag.startY));

    drag.moved ||= Math.abs(event.clientX - drag.startX) > 4 || Math.abs(event.clientY - drag.startY) > 4;
    onMove({ x: nextX, y: nextY });
    event.preventDefault();
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (drag.moved) {
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 120);
      return;
    }

    onPatch({ currentAction: "touch", lastLine: "Pat accepted. Remember to eat well today." });
  };

  const dragHandleProps = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: () => {
      dragRef.current = null;
    },
  };

  return (
    <div className="fixed z-[115] select-none" style={{ left: pet.position.x, top: pet.position.y }}>
      {pet.collapsed ? (
        <div
          role="button"
          tabIndex={0}
          {...dragHandleProps}
          onClick={() => {
            if (suppressClickRef.current) return;
            onPatch({ collapsed: false });
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onPatch({ collapsed: false });
            }
          }}
          className="flex h-16 w-16 cursor-grab touch-none items-center justify-center rounded-full bg-[#fff8df] text-[#725321] shadow-[0_14px_30px_rgba(92,74,42,0.18)] ring-1 ring-[#ead7a7] active:cursor-grabbing active:scale-[0.98]"
          aria-label="Expand pet"
        >
          <Sparkles className="h-7 w-7" strokeWidth={2.4} />
        </div>
      ) : (
        <div className="relative">
          <div className="pointer-events-none absolute -left-8 -top-10 max-w-[210px] rounded-lg bg-white px-3 py-2 text-xs font-bold leading-5 text-[var(--text-main)] shadow-[0_12px_28px_rgba(31,42,35,0.18)] ring-1 ring-[var(--line-soft)]">
            {pet.lastLine}
          </div>

          <div
            role="button"
            tabIndex={0}
            {...dragHandleProps}
            onClick={() => {
              if (suppressClickRef.current) return;
              onPatch({ currentAction: "touch", lastLine: "Pat accepted. Remember to eat well today." });
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onPatch({ currentAction: "touch", lastLine: "Pat accepted. Remember to eat well today." });
              }
            }}
            className={`relative block ${sizeClass[pet.size]} cursor-grab touch-none rounded-xl bg-transparent p-0 transition active:cursor-grabbing active:scale-[0.98]`}
            aria-label="Pat pet"
          >
            <FramePlayer action={animation} onDone={onAnimationDone} />
          </div>

          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => setPanelOpen((open) => !open)}
            className="absolute bottom-1 left-1/2 z-10 -translate-x-1/2 rounded-full bg-[#FDEEEA]/94 px-2.5 py-1 text-[10px] font-black text-[var(--text-main)] shadow-sm ring-1 ring-[#FEE09D]/80"
            aria-label="Pet status panel"
            title="Pet status panel"
          >
            Lv.{pet.level} - {moodLabel}
          </button>

          <div className="absolute -right-3 top-1 flex flex-col gap-2">
            <IconButton label="Feed" icon={<Utensils className="h-4 w-4" />} onClick={onFeed} />
            <IconButton
              label="Wardrobe library"
              icon={<Shirt className="h-4 w-4" />}
              onClick={() => onPatch({ currentAction: "touch", lastLine: "Wardrobe library will connect to official assets later." })}
            />
            <IconButton
              label="Collapse"
              icon={<Minus className="h-4 w-4" />}
              onClick={() => {
                setPanelOpen(false);
                onPatch({ collapsed: true });
              }}
            />
          </div>

          {panelOpen ? (
            <PetPanel
              pet={pet}
              xpToNext={xpToNext}
              onClose={() => setPanelOpen(false)}
              onPatch={onPatch}
              onSleep={() => onPatch({ currentAction: "sleep", lastLine: "Sleeping now. Feed again later." })}
              onClimb={() => {
                const width = petSizePx[pet.size] + 46;
                onMove({ x: Math.max(8, window.innerWidth - width - 8), y: 86 });
                onPatch({ currentAction: "happy", lastLine: "Climbed to the wall side." });
              }}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

function FramePlayer({ action, onDone }: { action: PetAnimationName; onDone: () => void }) {
  const config = vpetAnimations[action];
  const frames = config.frames.length ? config.frames : vpetAnimations.idle.frames;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [action]);

  useEffect(() => {
    const frame = frames[index] ?? frames[0];
    const timer = window.setTimeout(() => {
      const next = index + 1;
      if (next < frames.length) {
        setIndex(next);
        return;
      }

      if (config.loop) {
        setIndex(0);
        return;
      }

      onDone();
    }, Math.max(80, frame.duration));
    return () => window.clearTimeout(timer);
  }, [config.loop, frames, index, onDone]);

  const current = frames[index] ?? frames[0];
  return (
    <img
      src={current.src}
      alt="VPet temporary desktop pet"
      className="pointer-events-none block h-auto w-full drop-shadow-[0_18px_20px_rgba(23,34,30,0.18)]"
      draggable={false}
    />
  );
}

function PetPanel({
  pet,
  xpToNext,
  onClose,
  onPatch,
  onSleep,
  onClimb,
}: {
  pet: PetCompanionState;
  xpToNext: number;
  onClose: () => void;
  onPatch: (patch: Partial<PetCompanionState>) => void;
  onSleep: () => void;
  onClimb: () => void;
}) {
  const xpPercent = Math.round((pet.xp / xpToNext) * 100);
  const sizeItems: Array<PetCompanionState["size"]> = ["sm", "md", "lg"];

  return (
    <div className="fixed bottom-24 right-3 w-[min(260px,calc(100vw-24px))] rounded-lg bg-white p-3 text-left shadow-[0_14px_34px_rgba(30,44,38,0.2)] ring-1 ring-[var(--line-soft)]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#7c8f86]">Companion</p>
          <h3 className="mt-0.5 text-base font-black text-[var(--text-main)]">Ueat Pet Lv.{pet.level}</h3>
        </div>
        <button onClick={onClose} aria-label="Close pet panel" className="rounded-full bg-[var(--chip-bg)] p-1 text-[var(--text-muted)]">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-3 space-y-1.5">
        <Meter label="XP" value={xpPercent} suffix={`${pet.xp}/${xpToNext}`} color="#FC8A8E" />
        <Meter label="Hunger" value={pet.hunger} suffix={`${pet.hunger}%`} color="#FFAE69" />
        <Meter label="Mood" value={pet.mood} suffix={`${pet.mood}%`} color="#FEE09D" />
        <Meter label="Bond" value={pet.affinity} suffix={`${pet.affinity}%`} color="#FDEEEA" />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {sizeItems.map((size) => (
          <button
            key={size}
            onClick={() => onPatch({ size })}
            className={`rounded-md px-2 py-1.5 text-[11px] font-black ${pet.size === size ? "bg-[var(--pine)] text-white" : "bg-[var(--chip-bg)] text-[var(--text-muted)]"}`}
          >
            {size.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <button onClick={onSleep} className="flex items-center justify-center gap-1 rounded-md bg-[#f4f1e8] px-2.5 py-1.5 text-[11px] font-black text-[#6d5a32]">
          <Moon className="h-3.5 w-3.5" />
          Sleep
        </button>
        <button onClick={onClimb} className="rounded-md bg-[#f4f1e8] px-2.5 py-1.5 text-[11px] font-black text-[#6d5a32]">
          Climb
        </button>
      </div>
    </div>
  );
}

function Meter({ label, value, suffix, color }: { label: string; value: number; suffix: string; color: string }) {
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between text-[10px] font-black text-[var(--text-muted)]">
        <span>{label}</span>
        <span>{suffix}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#f3f2ee]">
        <div className="h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, value))}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function IconButton({ label, icon, onClick }: { label: string; icon: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[var(--pine)] shadow-[0_10px_22px_rgba(31,42,35,0.16)] ring-1 ring-[var(--line-soft)]"
      aria-label={label}
      title={label}
    >
      {icon}
    </button>
  );
}
