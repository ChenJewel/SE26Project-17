import { useEffect, type CSSProperties } from "react";
import type { PetCompanionState } from "@/hooks/usePetCompanion";
import type { PetAnimationName } from "@/components/pet/vpetFrames";
import { AvatarStickerLayer } from "@/components/pet/AvatarStickerLayer";

type AvatarPetCompanionProps = {
  pet: PetCompanionState;
  onAnimationDone: () => void;
};

const avatarSizeClass: Record<PetCompanionState["size"], string> = {
  sm: "w-[92px]",
  md: "w-[148px]",
  lg: "w-[180px]",
};

const transientActions = new Set<PetAnimationName>([
  "happy",
  "touch",
  "touchHead",
  "eat",
  "eatNormal",
  "eatHappy",
  "drink",
  "think",
  "saySelf",
  "saySerious",
  "sayShy",
  "pinch",
  "raise",
  "levelUp",
]);

function getEffectiveAction(pet: PetCompanionState) {
  return pet.currentAction === "idle" && pet.hunger < 20 ? "sleep" : pet.currentAction;
}

function getEffectKind(action: PetAnimationName) {
  if (action === "eat" || action === "eatNormal" || action === "eatHappy") return "eat";
  if (action === "drink") return "drink";
  if (action === "think") return "think";
  if (action === "touch" || action === "touchHead" || action === "pinch" || action === "raise" || action === "happy" || action === "levelUp") return "pat";
  if (action === "saySelf" || action === "saySerious" || action === "sayShy") return "talk";
  if (action === "sleep") return "sleep";
  return "idle";
}

export function AvatarPetCompanion({ pet, onAnimationDone }: AvatarPetCompanionProps) {
  const action = getEffectiveAction(pet);
  const effectKind = getEffectKind(action);
  const avatarPet = pet.avatarPet;
  const hasCustomAvatar = Boolean(avatarPet.customAvatarUrl);

  useEffect(() => {
    if (!transientActions.has(action)) return;
    const timer = window.setTimeout(onAnimationDone, 1050);
    return () => window.clearTimeout(timer);
  }, [action, onAnimationDone]);

  const cssVars = {
    "--avatar-hair": avatarPet.hairColor,
    "--avatar-eye": avatarPet.eyeColor,
    "--avatar-left-eye-x": `${avatarPet.eyeAnchors.left.x * 100}%`,
    "--avatar-left-eye-y": `${avatarPet.eyeAnchors.left.y * 100}%`,
    "--avatar-right-eye-x": `${avatarPet.eyeAnchors.right.x * 100}%`,
    "--avatar-right-eye-y": `${avatarPet.eyeAnchors.right.y * 100}%`,
  } as CSSProperties;

  return (
    <div
      className={`avatar-pet ${avatarSizeClass[pet.size]} ${effectKind === "pat" ? "avatar-pet--pop" : ""} ${effectKind === "talk" ? "avatar-pet--talk" : ""}`}
      style={cssVars}
      data-avatar-action={effectKind}
      aria-hidden="true"
    >
      <div className="avatar-pet-shadow" />
      <div className="avatar-pet-stage">
        {hasCustomAvatar ? (
          <img src={avatarPet.customAvatarUrl} alt="" className="avatar-pet-custom-image" draggable={false} />
        ) : (
          <div className="avatar-pet-face">
            <div className="avatar-pet-hair avatar-pet-hair-back" />
            <div className="avatar-pet-head">
              <div className="avatar-pet-hair avatar-pet-bangs" />
              <div className="avatar-pet-cheek avatar-pet-cheek-left" />
              <div className="avatar-pet-cheek avatar-pet-cheek-right" />
              <span className="avatar-pet-eye avatar-pet-eye-left" />
              <span className="avatar-pet-eye avatar-pet-eye-right" />
              <span className="avatar-pet-mouth" />
            </div>
          </div>
        )}
        {!hasCustomAvatar ? (
          <>
            <span className="avatar-pet-blink avatar-pet-blink-left" />
            <span className="avatar-pet-blink avatar-pet-blink-right" />
          </>
        ) : null}
        <AvatarStickerLayer stickers={avatarPet.stickers} />
        <AvatarPetFx kind={effectKind} />
      </div>
    </div>
  );
}

function AvatarPetFx({ kind }: { kind: ReturnType<typeof getEffectKind> }) {
  if (kind === "eat") {
    return (
      <div className="avatar-pet-fx avatar-pet-fx-eat">
        <span />
        <span />
        <span />
      </div>
    );
  }

  if (kind === "drink") {
    return (
      <div className="avatar-pet-fx avatar-pet-fx-drink">
        <span />
        <span />
        <span />
      </div>
    );
  }

  if (kind === "think") {
    return (
      <div className="avatar-pet-fx avatar-pet-fx-think">
        <span>?</span>
        <span>!</span>
      </div>
    );
  }

  if (kind === "pat" || kind === "talk") {
    return (
      <div className="avatar-pet-fx avatar-pet-fx-heart">
        <span />
        <span />
      </div>
    );
  }

  if (kind === "sleep") {
    return (
      <div className="avatar-pet-fx avatar-pet-fx-sleep">
        <span>Z</span>
        <span>Z</span>
      </div>
    );
  }

  return null;
}
