export type PetAnimationName =
  | "idle"
  | "happy"
  | "touch"
  | "touchHead"
  | "eat"
  | "eatNormal"
  | "eatHappy"
  | "drink"
  | "think"
  | "saySelf"
  | "saySerious"
  | "sayShy"
  | "pinch"
  | "raise"
  | "sideHideLeft"
  | "sideHideRight"
  | "walkLeft"
  | "walkRight"
  | "crawlLeft"
  | "crawlRight"
  | "fallLeft"
  | "fallRight"
  | "sleep"
  | "levelUp"
  | "climb"
  | "climbLeft"
  | "climbRight"
  | "climbTopLeft"
  | "climbTopRight";

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

function sequence(folder: string, prefix: string, durations: number[]) {
  return durations.map((duration, index) => frame(folder, `${prefix}-${String(index).padStart(3, "0")}-${duration}.png`));
}

const touchCFrames = ["touch-c-000-250.png", "touch-c-001-125.png"].map((name) => frame("touch-c", name));

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
    frames: numbered("touch-head", "touch-head", 12, 125),
  },
  touchHead: {
    loop: false,
    frames: numbered("touch-head", "touch-head", 12, 125),
  },
  eat: {
    loop: false,
    frames: sequence("eat-happy", "eat-happy", [125, 125, 125, 125, 125, 125, 125, 375, 125, 125, 125, 125]),
  },
  eatNormal: {
    loop: false,
    frames: sequence("eat-normal", "eat-normal", [125, 125, 125, 125, 125, 125, 125, 375, 125, 125, 125, 125]),
  },
  eatHappy: {
    loop: false,
    frames: sequence("eat-happy", "eat-happy", [125, 125, 125, 125, 125, 125, 125, 375, 125, 125, 125, 125]),
  },
  drink: {
    loop: false,
    frames: numbered("drink", "drink", 12, 125),
  },
  think: {
    loop: false,
    frames: numbered("think", "think", 9, 125),
  },
  saySelf: {
    loop: false,
    frames: numbered("say-self", "say-self", 12, 125),
  },
  saySerious: {
    loop: false,
    frames: numbered("say-serious", "say-serious", 4, 125),
  },
  sayShy: {
    loop: false,
    frames: numbered("say-shy", "say-shy", 5, 125),
  },
  pinch: {
    loop: false,
    frames: numbered("pinch", "pinch", 6, 125),
  },
  raise: {
    loop: true,
    frames: sequence("raise", "raise", [500, 125, 125, 125, 125, 125, 125, 375]),
  },
  sideHideLeft: {
    loop: true,
    frames: numbered("side-hide-left", "side-hide-left", 9, 125),
  },
  sideHideRight: {
    loop: true,
    frames: numbered("side-hide-right", "side-hide-right", 12, 125),
  },
  walkLeft: {
    loop: true,
    frames: numbered("walk-left", "walk-left", 6, 125),
  },
  walkRight: {
    loop: true,
    frames: numbered("walk-right", "walk-right", 6, 125),
  },
  crawlLeft: {
    loop: true,
    frames: sequence("crawl-left", "crawl-left", [250, 125, 125, 250, 250, 250, 125, 125, 250]),
  },
  crawlRight: {
    loop: true,
    frames: sequence("crawl-right", "crawl-right", [250, 125, 125, 250, 250, 250, 125, 125, 250]),
  },
  fallLeft: {
    loop: false,
    frames: numbered("fall-left", "fall-left", 8, 125),
  },
  fallRight: {
    loop: false,
    frames: numbered("fall-right", "fall-right", 8, 125),
  },
  sleep: {
    loop: true,
    frames: numbered("sleep", "sleep", 6),
  },
  levelUp: {
    loop: false,
    frames: numbered("levelup", "levelup", 29),
  },
  climb: {
    loop: true,
    frames: numbered("climb-right", "climb", 4, 250),
  },
  climbLeft: {
    loop: true,
    frames: numbered("climb-left", "climb", 4, 250),
  },
  climbRight: {
    loop: true,
    frames: numbered("climb-right", "climb", 4, 250),
  },
  climbTopLeft: {
    loop: true,
    frames: sequence("climb-top-left", "climb-top-left", [375, 125, 125, 375]),
  },
  climbTopRight: {
    loop: true,
    frames: sequence("climb-top-right", "climb-top-right", [375, 125, 125, 375]),
  },
};
