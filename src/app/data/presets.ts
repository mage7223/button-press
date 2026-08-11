import { ButtonSizePreset, PageSizePreset } from '../models/layout.model';

// Seed data per SPEC.md §5/§6 — not hardcoded constants in the design sense,
// but there's no editor for them yet, so this is the source of truth for v1.
export const BUTTON_SIZE_PRESETS: ButtonSizePreset[] = [
  { id: '1in', label: '1"', liveAreaDiameterMm: 25, cutLineDiameterMm: 35 },
  { id: '1.25in', label: '1.25"', liveAreaDiameterMm: 32, cutLineDiameterMm: 44 },
  { id: '1.5in', label: '1.5"', liveAreaDiameterMm: 38, cutLineDiameterMm: 47 },
  { id: '2.25in', label: '2.25"', liveAreaDiameterMm: 58, cutLineDiameterMm: 70 },
];

export const PAGE_SIZE_PRESETS: PageSizePreset[] = [
  { id: 'letter', label: 'US Letter', widthMm: 215.9, heightMm: 279.4 },
  { id: 'a4', label: 'A4', widthMm: 210, heightMm: 297 },
  { id: 'legal', label: 'US Legal', widthMm: 215.9, heightMm: 355.6 },
  // Actual dims are 46"x46" (not the full 100ft roll) — a single-page PDF/canvas at true
  // 46"x1200" would exceed browser canvas limits and PDF page-size limits. Label still
  // advertises the real roll length; see conversation with Kevin 2026-08-11.
  { id: 'stillwell', label: 'Stillwell (46" x 100ft)', widthMm: 1168.4, heightMm: 1168.4 },
];

export const DEFAULT_SITE_PADDING_MM = 5;
export const DEFAULT_SHEET_MARGIN_MM = 5;
