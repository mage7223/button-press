export interface ButtonSizePreset {
  id: string;
  label: string;
  liveAreaDiameterMm: number;
  cutLineDiameterMm: number;
}

export interface PageSizePreset {
  id: string;
  label: string;
  widthMm: number;
  heightMm: number;
}

export interface LayoutConfig {
  buttonSize: ButtonSizePreset;
  pageSize: PageSizePreset;
  sitePaddingMm: number;
  sheetMarginMm: number;
}

export interface SitePosition {
  index: number;
  row: number;
  col: number;
  centerXMm: number;
  centerYMm: number;
}

export interface Layout {
  config: LayoutConfig;
  columns: number;
  rows: number;
  sites: SitePosition[];
}
