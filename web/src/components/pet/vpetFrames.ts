export type PetAnimationName = "idle" | "happy" | "touch" | "eat" | "sleep" | "levelUp";

export type PetFrame = {
  src: string;
  duration: number;
};

const basePath = "/assets/vpet-prototype/frames";

function frame(folder: string, name: string): PetFrame {
  const durationMatch = name.match(/-(\d+)\.png$/);
  return {
    src: `${basePath}/${folder}/${name}`,
    duration: durationMatch ? Number(durationMatch[1]) : 125,
  };
}

function numbered(folder: string, prefix: string, count: number, duration = 125) {
  return Array.from({ length: count }, (_, index) =>
    frame(folder, `${prefix}-${String(index).padStart(3, "0")}-${duration}.png`)
  );
}

export const vpetAnimations: Record<PetAnimationName, { loop: boolean; frames: PetFrame[] }> = {
  idle: {
    loop: true,
    frames: [
      "idle-000-250.png",
      "idle-001-125.png",
      "idle-002-125.png",
      "idle-003-375.png",
      "idle-004-125.png",
      "idle-005-250.png",
      "idle-006-125.png",
      "idle-007-125.png",
    ].map((name) => frame("idle", name)),
  },
  happy: {
    loop: false,
    frames: [
      "happy-000-125.png",
      "happy-001-125.png",
      "happy-002-125.png",
      "happy-003-125.png",
      "happy-004-125.png",
      "happy-005-250.png",
      "happy-006-125.png",
      "happy-007-125.png",
      "happy-008-125.png",
      "happy-009-125.png",
      "happy-010-125.png",
      "happy-011-125.png",
      "happy-012-250.png",
    ].map((name) => frame("happy", name)),
  },
  touch: {
    loop: false,
    frames: [
      ...numbered("touch-a", "touch-a", 3),
      ...numbered("touch-b", "touch-b", 12),
      ...numbered("touch-c", "touch-c", 2),
    ],
  },
  eat: {
    loop: false,
    frames: [
      ...numbered("touch-a", "touch-a", 3),
      ...[
        "happy-000-125.png",
        "happy-001-125.png",
        "happy-002-125.png",
        "happy-003-125.png",
        "happy-004-125.png",
        "happy-005-250.png",
        "happy-006-125.png",
        "happy-007-125.png",
      ].map((name) => frame("happy", name)),
      ...numbered("touch-c", "touch-c", 2),
    ],
  },
  sleep: {
    loop: true,
    frames: numbered("sleep", "sleep", 6),
  },
  levelUp: {
    loop: false,
    frames: numbered("levelup", "levelup", 29),
  },
};
