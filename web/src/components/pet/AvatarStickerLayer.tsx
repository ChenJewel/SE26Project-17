import { useEffect, useMemo, useState } from "react";
import type { AvatarStickerPlacement } from "@/hooks/usePetCompanion";

type StickerManifestItem = {
  id: string;
  src: string;
  label?: string;
};

type StickerManifest = {
  stickers?: StickerManifestItem[];
};

type AvatarStickerLayerProps = {
  stickers?: AvatarStickerPlacement[];
};

const manifestUrl = "/assets/pet-avatar-stickers/stickers-manifest.json";

export function AvatarStickerLayer({ stickers }: AvatarStickerLayerProps) {
  const [manifest, setManifest] = useState<Record<string, StickerManifestItem>>({});
  const safeStickers = Array.isArray(stickers) ? stickers : [];

  useEffect(() => {
    let cancelled = false;

    fetch(manifestUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to load sticker manifest: ${response.status}`);
        return response.json() as Promise<StickerManifest>;
      })
      .then((data) => {
        if (cancelled) return;
        const nextManifest = Object.fromEntries((data.stickers ?? []).map((item) => [item.id, item]));
        setManifest(nextManifest);
      })
      .catch((error) => {
        console.warn("Failed to load avatar pet stickers.", error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const visibleStickers = useMemo(
    () =>
      safeStickers
        .slice(0, 4)
        .map((sticker) => ({ sticker, asset: manifest[sticker.id] ?? (sticker.src ? { id: sticker.id, src: sticker.src } : undefined) }))
        .filter((item): item is { sticker: AvatarStickerPlacement; asset: StickerManifestItem } => Boolean(item.asset)),
    [manifest, safeStickers],
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {visibleStickers.map(({ sticker, asset }) => (
        <img
          key={`${sticker.id}-${sticker.slot ?? "free"}`}
          src={asset.src}
          alt=""
          draggable={false}
          className="absolute object-contain drop-shadow-[0_4px_5px_rgba(52,40,62,0.16)]"
          style={{
            left: `${sticker.x * 100}%`,
            top: `${sticker.y * 100}%`,
            width: `${sticker.scale * 100}%`,
            transform: `translate(-50%, -50%) rotate(${sticker.rotate}deg)`,
          }}
        />
      ))}
    </div>
  );
}
