import { useEffect, useRef, useState, type ReactNode } from "react";
import { Eye, EyeOff, Minus, Moon, Shirt, Sparkles, Utensils, X } from "lucide-react";
import type { PetCompanionState, PetPosition } from "@/hooks/usePetCompanion";
import { vpetAnimations, type PetAnimationName } from "@/components/pet/vpetFrames";

type PetCompanionProps = {
  pet: PetCompanionState;
  xpToNext: number;
  onPatch: (patch: Partial<PetCompanionState>) => void;
  onMove: (position: PetPosition) => void;
  onFeed: () => void;
  onDrink: () => void;
  onAnimationDone: () => void;
};

type MovementPreviewAction = Extract<
  PetAnimationName,
  "walkLeft" | "walkRight" | "crawlLeft" | "crawlRight" | "fallLeft" | "fallRight" | "climbTopLeft" | "climbTopRight"
>;

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

const sideButtonStackClass: Record<PetCompanionState["size"], Record<"left" | "right", string>> = {
  sm: {
    left: "absolute -left-5 top-1 flex flex-col gap-0.5",
    right: "absolute -right-5 top-1 flex flex-col gap-0.5",
  },
  md: {
    left: "absolute -left-6 top-1 flex flex-col gap-1",
    right: "absolute -right-6 top-1 flex flex-col gap-1",
  },
  lg: {
    left: "absolute -left-7 top-1 flex flex-col gap-1",
    right: "absolute -right-7 top-1 flex flex-col gap-1",
  },
};

const speechTimeoutMs = 4200;
const spontaneousMoveActions: MovementPreviewAction[] = [
  "walkLeft",
  "walkRight",
  "crawlLeft",
  "crawlRight",
  "fallLeft",
  "fallRight",
  "climbTopLeft",
  "climbTopRight",
];
const spontaneousMoveLines = [
  "你是不是忘记我啦？我自己活动一下。",
  "这么久不理我，我先散个小步。",
  "我有一点点无聊，翻个身给你看。",
  "主人忙完了吗？我在旁边动一动。",
];
const spontaneousMoveIdleMs = 5 * 60 * 1000;
const spontaneousMoveCheckMinMs = 60 * 1000;
const spontaneousMoveCheckJitterMs = 60 * 1000;
const spontaneousMoveDurationMs = 3200;
const patLines = [
  "嘿嘿，摸头收到啦！今天也要好好吃饭哦。",
  "头发要被揉乱啦，不过我不讨厌。",
  "充电完成——再摸一下也可以。",
];
const thinkLines = ["我想想，今天适合找个轻松饭搭子。", "思考中……也许一句真诚的开场白就够啦。", "我在脑内摆盘，帮你整理一下话题。"];
const talkLines = ["我在这里，小声但认真地陪你。", "要不要把想说的话先说给我听？", "今天也可以从一句简单的你好开始。"];

export function PetCompanion({ pet, xpToNext, onPatch, onMove, onFeed, onDrink, onAnimationDone }: PetCompanionProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelPosition, setPanelPosition] = useState<PetPosition | null>(null);
  const [speechVisible, setSpeechVisible] = useState(false);
  const [shortcutsHidden, setShortcutsHidden] = useState(false);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; origin: PetPosition; moved: boolean; raised: boolean; restoredFromEdge: boolean } | null>(null);
  const climbDirectionRef = useRef(1);
  const longPressTimerRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const latestPetRef = useRef(pet);
  const autoMoveStopTimerRef = useRef<number | null>(null);
  const lastInteractionAtRef = useRef(Date.now());
  const lastAutoMoveAtRef = useRef(Date.now());

  const moodLabel = pet.hunger < 26 ? "Hungry" : pet.mood > 78 ? "Happy" : pet.mood < 38 ? "Needs pat" : "With you";
  const isClimbing = pet.currentAction === "climb" && pet.wallMode !== "none";
  const isEdgeHidden = pet.edgeHidden !== "none";
  const animation: PetAnimationName = isClimbing ? (pet.wallMode === "left" ? "climbLeft" : "climbRight") : pet.currentAction === "idle" && pet.hunger < 20 ? "sleep" : pet.currentAction;
  const petWidth = petSizePx[pet.size];
  const fullWidth = petWidth + 46;
  const fullHeight = petWidth + 68;
  const rightLimit = Math.max(8, window.innerWidth - fullWidth - 8);
  const bottomLimit = Math.max(72, window.innerHeight - fullHeight - 112);
  const buttonSide: "left" | "right" = pet.position.x + petSizePx[pet.size] / 2 > window.innerWidth / 2 ? "right" : "left";

  const clampPetY = (y: number) => Math.max(72, Math.min(bottomLimit, y));
  const getEdgePeekX = (side: "left" | "right") => {
    const peekWidth = Math.min(92, Math.max(56, petWidth * 0.52));
    return side === "left" ? Math.round(-(petWidth - peekWidth)) : Math.round(window.innerWidth - peekWidth);
  };
  const getDesktopPosition = (side: "left" | "right" = buttonSide): PetPosition => ({
    x: side === "right" ? Math.max(8, window.innerWidth - petWidth - 8) : 8,
    y: clampPetY(pet.position.y),
  });
  const clampVisiblePosition = (position: PetPosition): PetPosition => {
    const width = pet.collapsed ? 64 : petWidth;
    const height = pet.collapsed ? 64 : petWidth + 60;
    return {
      x: Math.max(8, Math.min(Math.max(8, window.innerWidth - width - 8), position.x)),
      y: Math.max(8, Math.min(Math.max(8, window.innerHeight - height - 8), position.y)),
    };
  };

  const markInteraction = () => {
    lastInteractionAtRef.current = Date.now();
  };

  useEffect(() => {
    latestPetRef.current = pet;
  }, [pet]);

  useEffect(() => {
    if (!pet.lastLine || !pet.lastSpokenAt || pet.collapsed) {
      setSpeechVisible(false);
      return;
    }

    const elapsed = Date.now() - pet.lastSpokenAt;
    const remaining = speechTimeoutMs - elapsed;
    if (remaining <= 0) {
      setSpeechVisible(false);
      return;
    }

    setSpeechVisible(true);
    const timer = window.setTimeout(() => setSpeechVisible(false), remaining);
    return () => window.clearTimeout(timer);
  }, [pet.collapsed, pet.lastLine, pet.lastSpokenAt]);

  useEffect(() => {
    if (!isClimbing || pet.collapsed) return;

    const tick = () => {
      const width = petSizePx[pet.size] + 46;
      const height = petSizePx[pet.size] + 68;
      const topLimit = 72;
      const bottomLimit = Math.max(topLimit, window.innerHeight - height - 112);
      const edgeX = pet.wallMode === "left" ? 8 : Math.max(8, window.innerWidth - width - 8);
      let nextY = pet.position.y + climbDirectionRef.current * 20;

      if (nextY >= bottomLimit) {
        nextY = bottomLimit;
        climbDirectionRef.current = -1;
      } else if (nextY <= topLimit) {
        nextY = topLimit;
        climbDirectionRef.current = 1;
      }

      onMove({ x: edgeX, y: nextY });
    };

    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [isClimbing, onMove, pet.collapsed, pet.position.y, pet.size, pet.wallMode]);

  useEffect(() => {
    if (!pet.visible) return;

    const keepInViewport = () => {
      const nextPosition = pet.edgeHidden === "none"
        ? clampVisiblePosition(pet.position)
        : { x: getEdgePeekX(pet.edgeHidden), y: clampPetY(pet.position.y) };

      if (Math.abs(nextPosition.x - pet.position.x) > 1 || Math.abs(nextPosition.y - pet.position.y) > 1) {
        onMove(nextPosition);
      }
    };

    keepInViewport();
    window.addEventListener("resize", keepInViewport);
    return () => window.removeEventListener("resize", keepInViewport);
  }, [bottomLimit, onMove, pet.collapsed, pet.edgeHidden, pet.position, pet.size, pet.visible]);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;

    const schedule = () => {
      timer = window.setTimeout(() => {
        if (cancelled) return;

        const current = latestPetRef.current;
        const now = Date.now();
        const idleForMs = now - lastInteractionAtRef.current;
        const sinceAutoMoveMs = now - lastAutoMoveAtRef.current;
        const canMove =
          current.visible &&
          !current.collapsed &&
          current.edgeHidden === "none" &&
          current.wallMode === "none" &&
          current.currentAction === "idle" &&
          current.hunger >= 20 &&
          idleForMs >= spontaneousMoveIdleMs &&
          sinceAutoMoveMs >= spontaneousMoveIdleMs &&
          !dragRef.current;

        if (canMove && Math.random() < 0.58) {
          const action = spontaneousMoveActions[Math.floor(Math.random() * spontaneousMoveActions.length)] ?? "walkRight";
          const lastLine = spontaneousMoveLines[Math.floor(Math.random() * spontaneousMoveLines.length)] ?? spontaneousMoveLines[0];
          lastAutoMoveAtRef.current = Date.now();
          onPatch({ currentAction: action, wallMode: "none", edgeHidden: "none", lastLine });

          if (autoMoveStopTimerRef.current !== null) {
            window.clearTimeout(autoMoveStopTimerRef.current);
          }

          autoMoveStopTimerRef.current = window.setTimeout(() => {
            const latest = latestPetRef.current;
            if (latest.currentAction === action && latest.wallMode === "none" && latest.edgeHidden === "none") {
              onPatch({ currentAction: "idle" });
            }
            autoMoveStopTimerRef.current = null;
          }, spontaneousMoveDurationMs);
        }

        schedule();
      }, spontaneousMoveCheckMinMs + Math.random() * spontaneousMoveCheckJitterMs);
    };

    schedule();
    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
      if (autoMoveStopTimerRef.current !== null) {
        window.clearTimeout(autoMoveStopTimerRef.current);
        autoMoveStopTimerRef.current = null;
      }
    };
  }, [onPatch]);

  if (!pet.visible) return null;

  const pickLine = (lines: string[]) => lines[Math.floor(Math.random() * lines.length)] ?? lines[0];

  const activePanelPosition = panelPosition ?? { x: Math.max(12, window.innerWidth - 272), y: Math.max(72, window.innerHeight - 512) };
  const movePanel = (position: PetPosition) => {
    setPanelPosition({
      x: Math.max(8, Math.min(window.innerWidth - 268, position.x)),
      y: Math.max(8, Math.min(window.innerHeight - 120, position.y)),
    });
  };

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current === null) return;
    window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  };

  const hideToEdge = (side: "left" | "right") => {
    setPanelOpen(false);
    clearLongPressTimer();
    onMove({ x: getEdgePeekX(side), y: clampPetY(pet.position.y) });
    onPatch({
      edgeHidden: side,
      wallMode: "none",
      currentAction: side === "left" ? "sideHideLeft" : "sideHideRight",
      lastLine: side === "left" ? "我先贴到左边探头，不挡你。" : "我先贴到右边探头，不挡你。",
    });
  };

  const restoreToDesktop = (side: "left" | "right" = pet.edgeHidden === "none" ? buttonSide : pet.edgeHidden) => {
    const nextPosition = getDesktopPosition(side);
    onMove(nextPosition);
    onPatch({
      collapsed: false,
      edgeHidden: "none",
      wallMode: "none",
      currentAction: "raise",
      lastLine: "我回来桌面啦，轻轻一捏就归位。",
    });
    return nextPosition;
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    markInteraction();
    if (isClimbing) {
      onPatch({ currentAction: "idle", wallMode: "none" });
    }
    const edgeSide = pet.edgeHidden === "none" ? null : pet.edgeHidden;
    const restoredFromEdge = edgeSide !== null;
    const origin = edgeSide ? restoreToDesktop(edgeSide) : pet.position;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin,
      moved: false,
      raised: false,
      restoredFromEdge,
    };
    longPressTimerRef.current = window.setTimeout(() => {
      onPatch({ currentAction: "pinch", lastLine: "嗯？被捏起来了。" });
    }, 260);
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
    if (drag.moved && !drag.raised) {
      drag.raised = true;
      clearLongPressTimer();
      if (pet.edgeHidden !== "none") {
        onPatch({ edgeHidden: "none", currentAction: "raise", lastLine: "我回来啦，别把我夹在边边。" });
      } else {
        onPatch({ currentAction: "raise" });
      }
    }
    onMove({ x: nextX, y: nextY });
    event.preventDefault();
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || drag.pointerId !== event.pointerId) return;
    clearLongPressTimer();

    if (drag.moved) {
      const edgeTouchThreshold = 10;
      const fingerTouchedLeftEdge = event.clientX <= edgeTouchThreshold;
      const fingerTouchedRightEdge = event.clientX >= window.innerWidth - edgeTouchThreshold;
      if (!drag.restoredFromEdge && (fingerTouchedLeftEdge || fingerTouchedRightEdge)) {
        hideToEdge(fingerTouchedLeftEdge ? "left" : "right");
      } else {
        const wentRight = event.clientX >= drag.startX;
        onPatch({ currentAction: wentRight ? "fallRight" : "fallLeft", edgeHidden: "none", lastLine: "稳稳落地，刚才飞了一小下。" });
      }
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 120);
      return;
    }

    if (drag.restoredFromEdge) {
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 120);
      return;
    }

    if (isEdgeHidden) {
      setPanelOpen((open) => !open);
      onPatch({ currentAction: pet.edgeHidden === "left" ? "sideHideLeft" : "sideHideRight" });
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 120);
      return;
    }

    onPatch({ currentAction: "touchHead", wallMode: "none", lastLine: pickLine(patLines) });
  };

  const dragHandleProps = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: () => {
      dragRef.current = null;
      clearLongPressTimer();
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
          {isEdgeHidden && speechVisible ? (
            <div className={`pointer-events-none absolute top-7 z-20 rounded-full bg-white/95 px-2 py-1 text-[10px] font-black text-[var(--pine)] shadow-[0_8px_18px_rgba(31,42,35,0.16)] ring-1 ring-[var(--line-soft)] ${pet.edgeHidden === "left" ? "right-0" : "left-0"}`}>
              点我 / 拖我
            </div>
          ) : null}

          {speechVisible && !isEdgeHidden ? (
            <div className="pointer-events-none absolute -left-8 -top-10 max-w-[210px] rounded-lg bg-white px-3 py-2 text-xs font-bold leading-5 text-[var(--text-main)] shadow-[0_12px_28px_rgba(31,42,35,0.18)] ring-1 ring-[var(--line-soft)]">
              {pet.lastLine}
            </div>
          ) : null}

          <div
            role="button"
            tabIndex={0}
            {...dragHandleProps}
            onClick={() => {
              if (suppressClickRef.current) return;
              if (isEdgeHidden) {
                setPanelOpen((open) => !open);
                return;
              }
              onPatch({ currentAction: "touchHead", wallMode: "none", lastLine: pickLine(patLines) });
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                if (isEdgeHidden) {
                  setPanelOpen((open) => !open);
                  return;
                }
                onPatch({ currentAction: "touchHead", wallMode: "none", lastLine: pickLine(patLines) });
              }
            }}
            className={`relative z-30 block ${sizeClass[pet.size]} cursor-grab touch-none rounded-xl bg-transparent p-0 transition active:cursor-grabbing active:scale-[0.98]`}
            aria-label="Pat pet"
          >
            <FramePlayer action={animation} wallMode={pet.wallMode} onDone={onAnimationDone} />
          </div>

          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => {
              markInteraction();
              setPanelOpen((open) => !open);
            }}
            className="absolute bottom-1 left-1/2 z-30 -translate-x-1/2 rounded-full bg-[#FDEEEA]/94 px-2.5 py-1 text-[10px] font-black text-[var(--text-main)] shadow-sm ring-1 ring-[#FEE09D]/80"
            aria-label="Pet status panel"
            title="Pet status panel"
          >
            Lv.{pet.level} - {moodLabel}
          </button>

          <div className={`${sideButtonStackClass[pet.size][buttonSide]} ${isEdgeHidden || shortcutsHidden ? "hidden" : ""}`} onClickCapture={markInteraction}>
            <IconButton
              size={pet.size}
              label="Feed"
              icon={<Utensils />}
              onClick={() => {
                markInteraction();
                onFeed();
              }}
            />
            <IconButton
              size={pet.size}
              label="Wardrobe library"
              icon={<Shirt />}
              onClick={() => onPatch({ currentAction: "sayShy", lastLine: "衣柜还在整理中，等素材库上线就给我换新衣服吧。" })}
            />
            <IconButton
              size={pet.size}
              label="Collapse"
              icon={<Minus />}
              onClick={() => {
                markInteraction();
                setPanelOpen(false);
                onPatch({ collapsed: true, wallMode: "none", edgeHidden: "none" });
              }}
            />
            <IconButton
              size={pet.size}
              label="Hide shortcuts"
              icon={<EyeOff />}
              onClick={() => {
                markInteraction();
                setShortcutsHidden((hidden) => !hidden);
              }}
            />
          </div>

          {shortcutsHidden && !isEdgeHidden ? (
            <div className="absolute left-1/2 top-full z-10 mt-1 -translate-x-1/2" onClickCapture={markInteraction}>
              <IconButton
                size={pet.size}
                label="Show shortcuts"
                icon={<Eye />}
                onClick={() => {
                  markInteraction();
                  setShortcutsHidden(false);
                }}
              />
            </div>
          ) : null}

          {panelOpen ? (
            <PetPanel
              pet={pet}
              xpToNext={xpToNext}
              position={activePanelPosition}
              onClose={() => setPanelOpen(false)}
              onPatch={onPatch}
              onPanelMove={movePanel}
              onInteraction={markInteraction}
              onDrink={onDrink}
              onSleep={() => onPatch({ currentAction: "sleep", wallMode: "none", lastLine: "呼，我先睡一小会儿，饿了记得叫醒我呀。" })}
              onThink={() => onPatch({ currentAction: "think", wallMode: "none", edgeHidden: "none", lastLine: pickLine(thinkLines) })}
              onTalk={(action) => onPatch({ currentAction: action, wallMode: "none", edgeHidden: "none", lastLine: pickLine(talkLines) })}
              onMoveAction={(action) => onPatch({ currentAction: action, wallMode: "none", edgeHidden: "none", lastLine: "我换个姿势活动一下。" })}
              onRestoreDesktop={() => restoreToDesktop()}
              isClimbing={isClimbing}
              onStopClimb={() => onPatch({ currentAction: "idle", wallMode: "none", lastLine: "我从墙边下来啦。" })}
              onClimb={() => {
                const width = petSizePx[pet.size] + 46;
                onMove({ x: Math.max(8, window.innerWidth - width - 8), y: 86 });
                onPatch({ currentAction: "climb", wallMode: "right", edgeHidden: "none", lastLine: "我贴到墙边啦，会沿着边边慢慢爬，不挡你看卡片。" });
              }}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

function FramePlayer({ action, wallMode, onDone }: { action: PetAnimationName; wallMode: PetCompanionState["wallMode"]; onDone: () => void }) {
  const config = vpetAnimations[action];
  const frames = config.frames.length ? config.frames : vpetAnimations.idle.frames;
  const [index, setIndex] = useState(0);
  const fallbackFrame = vpetAnimations.idle.frames[0];

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
  const climbClass = action === "climb" || action === "climbLeft" || action === "climbRight"
    ? wallMode === "left"
      ? "origin-left -rotate-3"
      : "origin-right rotate-3"
    : "";
  return (
    <img
      src={current.src}
      alt=""
      onError={(event) => {
        if (!fallbackFrame || event.currentTarget.src.endsWith(fallbackFrame.src)) return;
        event.currentTarget.src = fallbackFrame.src;
      }}
      className={`pointer-events-none block h-auto w-full drop-shadow-[0_18px_20px_rgba(23,34,30,0.18)] transition-transform duration-300 ${climbClass}`}
      draggable={false}
    />
  );
}

function PetPanel({
  pet,
  xpToNext,
  position,
  onClose,
  onPatch,
  onPanelMove,
  onInteraction,
  onDrink,
  onSleep,
  onThink,
  onTalk,
  onMoveAction,
  onRestoreDesktop,
  isClimbing,
  onStopClimb,
  onClimb,
}: {
  pet: PetCompanionState;
  xpToNext: number;
  position: PetPosition;
  onClose: () => void;
  onPatch: (patch: Partial<PetCompanionState>) => void;
  onPanelMove: (position: PetPosition) => void;
  onInteraction: () => void;
  onDrink: () => void;
  onSleep: () => void;
  onThink: () => void;
  onTalk: (action: Extract<PetAnimationName, "saySelf" | "saySerious" | "sayShy">) => void;
  onMoveAction: (action: Extract<PetAnimationName, "walkLeft" | "walkRight" | "crawlLeft" | "crawlRight" | "fallLeft" | "fallRight" | "climbTopLeft" | "climbTopRight">) => void;
  onRestoreDesktop: () => void;
  isClimbing: boolean;
  onStopClimb: () => void;
  onClimb: () => void;
}) {
  const xpPercent = Math.round((pet.xp / xpToNext) * 100);
  const sizeItems: Array<PetCompanionState["size"]> = ["sm", "md", "lg"];
  const panelDragRef = useRef<{ pointerId: number; startX: number; startY: number; origin: PetPosition } | null>(null);

  const onPanelPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    onInteraction();
    panelDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: position,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPanelPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = panelDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    onPanelMove({
      x: drag.origin.x + event.clientX - drag.startX,
      y: drag.origin.y + event.clientY - drag.startY,
    });
    event.preventDefault();
  };

  const onPanelPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = panelDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    panelDragRef.current = null;
  };

  return (
    <div
      className="fixed z-10 w-[min(260px,calc(100vw-24px))] rounded-lg bg-white p-3 text-left shadow-[0_14px_34px_rgba(30,44,38,0.2)] ring-1 ring-[var(--line-soft)]"
      style={{ left: position.x, top: position.y }}
      onClickCapture={onInteraction}
    >
      <div
        className="flex cursor-grab touch-none items-start justify-between gap-2 active:cursor-grabbing"
        onPointerDown={onPanelPointerDown}
        onPointerMove={onPanelPointerMove}
        onPointerUp={onPanelPointerEnd}
        onPointerCancel={onPanelPointerEnd}
      >
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#7c8f86]">Companion</p>
          <h3 className="mt-0.5 text-base font-black text-[var(--text-main)]">Ueat Pet Lv.{pet.level}</h3>
          <p className="mt-0.5 text-[10px] font-bold text-[var(--text-faint)]">拖动标题栏移动面板</p>
        </div>
        <button onPointerDown={(event) => event.stopPropagation()} onClick={onClose} aria-label="Close pet panel" className="rounded-full bg-[var(--chip-bg)] p-1 text-[var(--text-muted)]">
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
        <button onClick={onDrink} className="rounded-md bg-[#eef7fb] px-2.5 py-1.5 text-[11px] font-black text-[#3a6576]">
          Drink
        </button>
        <button onClick={onThink} className="rounded-md bg-[#eef7fb] px-2.5 py-1.5 text-[11px] font-black text-[#3a6576]">
          Think
        </button>
        <button onClick={onSleep} className="flex items-center justify-center gap-1 rounded-md bg-[#f4f1e8] px-2.5 py-1.5 text-[11px] font-black text-[#6d5a32]">
          <Moon className="h-3.5 w-3.5" />
          Sleep
        </button>
        <button onClick={onClimb} className="rounded-md bg-[#f4f1e8] px-2.5 py-1.5 text-[11px] font-black text-[#6d5a32]">
          Climb
        </button>
      </div>

      <button onClick={onRestoreDesktop} className="mt-2 w-full rounded-md bg-[#fff8df] px-2.5 py-1.5 text-[11px] font-black text-[#725321] ring-1 ring-[#ead7a7]">
        回到桌面
      </button>

      {isClimbing ? (
        <button onClick={onStopClimb} className="mt-2 w-full rounded-md bg-[#fff1f1] px-2.5 py-1.5 text-[11px] font-black text-[#a14e4e] ring-1 ring-[#ffd8d8]">
          Stop climbing
        </button>
      ) : null}

      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <button onClick={() => onTalk("saySelf")} className="rounded-md bg-[#f8f4ff] px-2 py-1.5 text-[10px] font-black text-[#6b4b88]">
          Self
        </button>
        <button onClick={() => onTalk("saySerious")} className="rounded-md bg-[#f8f4ff] px-2 py-1.5 text-[10px] font-black text-[#6b4b88]">
          Serious
        </button>
        <button onClick={() => onTalk("sayShy")} className="rounded-md bg-[#f8f4ff] px-2 py-1.5 text-[10px] font-black text-[#6b4b88]">
          Shy
        </button>
      </div>

      <div className="mt-2 grid grid-cols-4 gap-1">
        <button onClick={() => onMoveAction("walkLeft")} className="rounded-md bg-[var(--chip-bg)] px-1 py-1.5 text-[10px] font-black text-[var(--text-muted)]">
          Walk L
        </button>
        <button onClick={() => onMoveAction("walkRight")} className="rounded-md bg-[var(--chip-bg)] px-1 py-1.5 text-[10px] font-black text-[var(--text-muted)]">
          Walk R
        </button>
        <button onClick={() => onMoveAction("crawlLeft")} className="rounded-md bg-[var(--chip-bg)] px-1 py-1.5 text-[10px] font-black text-[var(--text-muted)]">
          Crawl L
        </button>
        <button onClick={() => onMoveAction("crawlRight")} className="rounded-md bg-[var(--chip-bg)] px-1 py-1.5 text-[10px] font-black text-[var(--text-muted)]">
          Crawl R
        </button>
        <button onClick={() => onMoveAction("fallLeft")} className="rounded-md bg-[var(--chip-bg)] px-1 py-1.5 text-[10px] font-black text-[var(--text-muted)]">
          Fall L
        </button>
        <button onClick={() => onMoveAction("fallRight")} className="rounded-md bg-[var(--chip-bg)] px-1 py-1.5 text-[10px] font-black text-[var(--text-muted)]">
          Fall R
        </button>
        <button onClick={() => onMoveAction("climbTopLeft")} className="rounded-md bg-[var(--chip-bg)] px-1 py-1.5 text-[10px] font-black text-[var(--text-muted)]">
          Top L
        </button>
        <button onClick={() => onMoveAction("climbTopRight")} className="rounded-md bg-[var(--chip-bg)] px-1 py-1.5 text-[10px] font-black text-[var(--text-muted)]">
          Top R
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

function IconButton({ size, label, icon, onClick }: { size: PetCompanionState["size"]; label: string; icon: ReactNode; onClick: () => void }) {
  const buttonClass: Record<PetCompanionState["size"], string> = {
    sm: "h-5 w-5 [&_svg]:h-2.5 [&_svg]:w-2.5",
    md: "h-6 w-6 [&_svg]:h-3 [&_svg]:w-3",
    lg: "h-7 w-7 [&_svg]:h-3.5 [&_svg]:w-3.5",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center rounded-full bg-white text-[var(--pine)] shadow-[0_10px_22px_rgba(31,42,35,0.16)] ring-1 ring-[var(--line-soft)] ${buttonClass[size]}`}
      aria-label={label}
      title={label}
    >
      {icon}
    </button>
  );
}
