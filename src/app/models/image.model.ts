export interface ImageAsset {
  id: string;
  fileName: string;
  bitmap: ImageBitmap;
  naturalWidthPx: number;
  naturalHeightPx: number;
  /** Object URL for cheap <img> thumbnail rendering — UI concern, revoke on removal. */
  objectUrl: string;
}

export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
