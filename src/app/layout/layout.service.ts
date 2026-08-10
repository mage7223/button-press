import { Injectable } from '@angular/core';
import { Layout, LayoutConfig, SitePosition } from '../models/layout.model';

export interface LayoutResult {
  layout: Layout | null;
  /** Set when the chosen button doesn't fit on the chosen paper even once. */
  error: string | null;
}

@Injectable({ providedIn: 'root' })
export class LayoutService {
  /** Grid packing per SPEC.md §10. */
  compute(config: LayoutConfig): LayoutResult {
    const { buttonSize, pageSize, sitePaddingMm: P, sheetMarginMm: M } = config;
    const D = buttonSize.cutLineDiameterMm;
    const W = pageSize.widthMm;
    const H = pageSize.heightMm;

    const availableW = W - 2 * M - D;
    const availableH = H - 2 * M - D;

    if (availableW < 0 || availableH < 0) {
      return {
        layout: null,
        error: `A ${buttonSize.label} button doesn't fit on ${pageSize.label} with a ${M}mm margin — reduce the margin or choose a smaller button/larger paper.`,
      };
    }

    const cols = Math.floor(availableW / (D + P)) + 1;
    const rows = Math.floor(availableH / (D + P)) + 1;

    const gridW = D + (cols - 1) * (D + P);
    const gridH = D + (rows - 1) * (D + P);
    const marginX = (W - gridW) / 2;
    const marginY = (H - gridH) / 2;

    const sites: SitePosition[] = [];
    let index = 0;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        sites.push({
          index,
          row,
          col,
          centerXMm: marginX + D / 2 + col * (D + P),
          centerYMm: marginY + D / 2 + row * (D + P),
        });
        index++;
      }
    }

    return {
      layout: { config, columns: cols, rows, sites },
      error: null,
    };
  }
}
