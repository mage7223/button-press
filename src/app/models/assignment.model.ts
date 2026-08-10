export interface ImageTransform {
  offsetXMm: number;
  offsetYMm: number;
  scaleX: number;
  scaleY: number;
}

/** scale 1 = the auto "cover the cut line" fit; no pan, no stretch. */
export const IDENTITY_TRANSFORM: ImageTransform = {
  offsetXMm: 0,
  offsetYMm: 0,
  scaleX: 1,
  scaleY: 1,
};

export interface SiteAssignment {
  imageId: string;
  transform: ImageTransform;
}
