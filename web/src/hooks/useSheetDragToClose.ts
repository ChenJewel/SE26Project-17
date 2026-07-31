import { useRef, useState, type CSSProperties, type PointerEvent } from "react";

function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

function project(initialVelocity: number, decelerationRate = 0.998) {
  return (initialVelocity / 1000) * decelerationRate / (1 - decelerationRate);
}

export function useSheetDragToClose(onClose: () => void, enabled = true) {
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const active = useRef(false);
  const history = useRef<Array<{ y: number; t: number }>>([]);

  const reset = () => {
    start.current = null;
    active.current = false;
    history.current = [];
    setDragging(false);
    setDragY(0);
  };

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (!enabled || (event.pointerType === "mouse" && event.button !== 0)) return;
    const target = event.target as HTMLElement | null;
    const scrollParent = target?.closest("[data-sheet-scroll]") as HTMLElement | null;
    if (scrollParent && scrollParent.scrollTop > 0) return;

    start.current = { x: event.clientX, y: event.clientY };
    history.current = [{ y: event.clientY, t: performance.now() }];
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (!start.current) return;
    const dx = event.clientX - start.current.x;
    const dy = event.clientY - start.current.y;

    if (!active.current) {
      if (dy < 8) return;
      if (Math.abs(dx) > dy) {
        reset();
        return;
      }
      active.current = true;
      setDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    event.preventDefault();
    const nextY = dy < 0 ? rubberband(dy, 360, 0.25) : dy > 220 ? 220 + rubberband(dy - 220, 360) : dy;
    setDragY(Math.max(-18, nextY));
    const now = performance.now();
    history.current = [...history.current, { y: event.clientY, t: now }].slice(-5);
  };

  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    if (!start.current) return;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Browser may already have released pointer capture.
    }

    const samples = history.current;
    const first = samples[0];
    const last = samples[samples.length - 1];
    const velocity = first && last && last.t !== first.t ? ((last.y - first.y) / (last.t - first.t)) * 1000 : 0;
    const projected = dragY + project(velocity);
    const shouldClose = dragY > 96 || projected > 160 || velocity > 760;

    if (shouldClose) onClose();
    else reset();
  };

  const sheetStyle = {
    "--sheet-drag-y": `${dragY}px`,
    "--sheet-drag-progress": String(Math.min(1, Math.max(0, dragY / 180))),
  } as CSSProperties;

  return {
    sheetProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: reset,
      style: sheetStyle,
      className: dragging ? "app-sheet-dragging" : "",
    },
    resetSheetDrag: reset,
  };
}
