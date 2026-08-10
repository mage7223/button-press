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

/** Custom drag payload type for dragging a thumbnail onto a site — distinct from OS file drags. */
export const IMAGE_DRAG_MIME_TYPE = 'application/x-button-press-image-id';
