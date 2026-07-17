export type PetActivityKind =
  | "manual_feed"
  | "manual_drink"
  | "meal_card"
  | "exchange"
  | "post"
  | "comment"
  | "like"
  | "favorite"
  | "share"
  | "message"
  | "group";

export type PetActivityEvent = {
  kind: PetActivityKind;
  label?: string;
};

const petActivityEventName = "ueat:pet-activity";

export function dispatchPetActivity(kind: PetActivityKind, label?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<PetActivityEvent>(petActivityEventName, { detail: { kind, label } }));
}

export function subscribePetActivity(listener: (event: PetActivityEvent) => void) {
  if (typeof window === "undefined") return () => undefined;
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<PetActivityEvent>).detail;
    if (!detail?.kind) return;
    listener(detail);
  };
  window.addEventListener(petActivityEventName, handler);
  return () => window.removeEventListener(petActivityEventName, handler);
}
