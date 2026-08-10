import { ImageTransform } from '../models/assignment.model';
import { ImageAsset } from '../models/image.model';

/** Covers the cut-line circle at transform scale 1, then applies pan/stretch on top (§8.4). */
export function drawClippedSiteImage(
  ctx: CanvasRenderingContext2D,
  asset: ImageAsset,
  transform: ImageTransform,
  cx: number,
  cy: number,
  cutRadiusPx: number,
  pxPerMm: number,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, cutRadiusPx, 0, Math.PI * 2);
  ctx.clip();

  const targetSize = cutRadiusPx * 2;
  const baseScale = Math.max(targetSize / asset.bitmap.width, targetSize / asset.bitmap.height);
  const drawWidth = asset.bitmap.width * baseScale * transform.scaleX;
  const drawHeight = asset.bitmap.height * baseScale * transform.scaleY;
  const offsetXPx = transform.offsetXMm * pxPerMm;
  const offsetYPx = transform.offsetYMm * pxPerMm;
  ctx.drawImage(asset.bitmap, cx - drawWidth / 2 + offsetXPx, cy - drawHeight / 2 + offsetYPx, drawWidth, drawHeight);

  ctx.restore();
}
