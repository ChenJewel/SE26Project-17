import { useEffect, useMemo, useState, type ReactNode, type RefObject } from "react";
import { AvatarStickerLayer } from "@/components/pet/AvatarStickerLayer";
import type { AvatarStickerPlacement } from "@/hooks/usePetCompanion";

type AlphaBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type AnimatedPetStickerStageProps = {
  frameSrc?: string;
  stickers?: AvatarStickerPlacement[];
  className?: string;
  imageClassName?: string;
  stickerLayerClassName?: string;
  stickerLayerRef?: RefObject<HTMLDivElement | null>;
  children?: ReactNode;
};

const fullBounds: AlphaBounds = { left: 0, top: 0, width: 1, height: 1 };
const boundsCache = new Map<string, AlphaBounds>();

export function AnimatedPetStickerStage({
  frameSrc,
  stickers,
  className = "",
  imageClassName = "",
  stickerLayerClassName = "",
  stickerLayerRef,
  children,
}: AnimatedPetStickerStageProps) {
  const bounds = useAlphaBounds(frameSrc);
  const layerStyle = useMemo(
    () => ({
      left: `${bounds.left * 100}%`,
      top: `${bounds.top * 100}%`,
      width: `${bounds.width * 100}%`,
      height: `${bounds.height * 100}%`,
    }),
    [bounds],
  );

  return (
    <span className={`relative block ${className}`}>
      {frameSrc ? (
        <img
          src={frameSrc}
          alt=""
          className={`pointer-events-none block h-auto w-full object-contain ${imageClassName}`}
          draggable={false}
        />
      ) : null}
      <div ref={stickerLayerRef} className={`absolute z-20 ${stickerLayerClassName}`} style={layerStyle}>
        {children ?? <AvatarStickerLayer stickers={stickers} />}
      </div>
    </span>
  );
}

function useAlphaBounds(frameSrc?: string) {
  const [bounds, setBounds] = useState<AlphaBounds>(fullBounds);

  useEffect(() => {
    if (!frameSrc) {
      setBounds(fullBounds);
      return;
    }

    const cached = boundsCache.get(frameSrc);
    if (cached) {
      setBounds(cached);
      return;
    }

    let cancelled = false;
    calculateAlphaBounds(frameSrc)
      .then((nextBounds) => {
        boundsCache.set(frameSrc, nextBounds);
        if (!cancelled) setBounds(nextBounds);
      })
      .catch((error) => {
        console.warn("Failed to calculate animated pet alpha bounds.", error);
        boundsCache.set(frameSrc, fullBounds);
        if (!cancelled) setBounds(fullBounds);
      });

    return () => {
      cancelled = true;
    };
  }, [frameSrc]);

  return bounds;
}

async function calculateAlphaBounds(src: string): Promise<AlphaBounds> {
  const image = await loadImage(src);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  if (!sourceWidth || !sourceHeight) return fullBounds;

  const maxSide = 360;
  const ratio = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * ratio));
  const height = Math.max(1, Math.round(sourceHeight * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return fullBounds;

  context.drawImage(image, 0, 0, width, height);
  const data = context.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha <= 12) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) return fullBounds;
  const padding = Math.max(2, Math.round(Math.max(width, height) * 0.018));
  const paddedMinX = Math.max(0, minX - padding);
  const paddedMinY = Math.max(0, minY - padding);
  const paddedMaxX = Math.min(width - 1, maxX + padding);
  const paddedMaxY = Math.min(height - 1, maxY + padding);

  return {
    left: paddedMinX / width,
    top: paddedMinY / height,
    width: (paddedMaxX - paddedMinX + 1) / width,
    height: (paddedMaxY - paddedMinY + 1) / height,
  };
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}
