import { inject, Injectable } from '@angular/core';
import { PDFDocument } from 'pdf-lib';
import { AssignmentStateService } from '../assignment/assignment-state.service';
import { drawClippedSiteImage } from '../canvas/site-image-render';
import { ImagesStateService } from '../images/images-state.service';
import { LayoutStateService } from '../layout/layout-state.service';
import { SiteAssignment } from '../models/assignment.model';
import { ImageAsset } from '../models/image.model';
import { Layout } from '../models/layout.model';

const PT_PER_MM = 72 / 25.4;
/** Raster resolution for the exported sheet — plenty for print, keeps file size reasonable. */
const EXPORT_DPI = 300;
const PX_PER_MM = EXPORT_DPI / 25.4;

@Injectable({ providedIn: 'root' })
export class PdfExportService {
  private readonly layoutState = inject(LayoutStateService);
  private readonly assignmentState = inject(AssignmentStateService);
  private readonly imagesState = inject(ImagesStateService);

  /** Renders the current sheet to a true-physical-scale, single-page PDF (SPEC.md §8.6). */
  async generate(): Promise<Blob | null> {
    const layout = this.layoutState.layout();
    if (!layout) {
      return null;
    }

    const imagesById = new Map(this.imagesState.images().map((img) => [img.id, img]));
    const sheetCanvas = renderSheetCanvas(layout, this.assignmentState.assignments(), imagesById);
    const pngBytes = await canvasToPngBytes(sheetCanvas);

    const pdfDoc = await PDFDocument.create();
    const pngImage = await pdfDoc.embedPng(pngBytes);
    const widthPt = layout.config.pageSize.widthMm * PT_PER_MM;
    const heightPt = layout.config.pageSize.heightMm * PT_PER_MM;
    const page = pdfDoc.addPage([widthPt, heightPt]);
    page.drawImage(pngImage, { x: 0, y: 0, width: widthPt, height: heightPt });

    const pdfBytes = await pdfDoc.save();
    // pdf-lib's Uint8Array is always ArrayBuffer-backed; TS's stricter BlobPart typing just can't see that.
    return new Blob([pdfBytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' });
  }

  suggestedFileName(): string {
    const date = new Date().toISOString().slice(0, 10);
    const layout = this.layoutState.layout();
    if (!layout) {
      return `button-press-${date}.pdf`;
    }
    const button = slug(layout.config.buttonSize.label);
    const page = slug(layout.config.pageSize.label);
    return `button-press-${button}-${page}-${date}.pdf`;
  }
}

/**
 * Cut-line (outer) circle is always drawn, on every site whether filled or empty — it's the
 * real physical cutting position. Live-area (inner) circle is never drawn — it's an on-screen
 * composition aid only (§8.4), never meant to appear on the physical output. See SPEC.md §8.6.
 */
function renderSheetCanvas(
  layout: Layout,
  assignments: ReadonlyMap<number, SiteAssignment>,
  imagesById: Map<string, ImageAsset>,
): HTMLCanvasElement {
  const { pageSize, buttonSize } = layout.config;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(pageSize.widthMm * PX_PER_MM);
  canvas.height = Math.round(pageSize.heightMm * PX_PER_MM);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return canvas;
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const cutRadiusPx = (buttonSize.cutLineDiameterMm / 2) * PX_PER_MM;

  for (const site of layout.sites) {
    const assignment = assignments.get(site.index);
    const asset = assignment ? imagesById.get(assignment.imageId) : undefined;
    const cx = site.centerXMm * PX_PER_MM;
    const cy = site.centerYMm * PX_PER_MM;

    if (assignment && asset) {
      drawClippedSiteImage(ctx, asset, assignment.transform, cx, cy, cutRadiusPx, PX_PER_MM);
    }

    ctx.beginPath();
    ctx.arc(cx, cy, cutRadiusPx, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.lineWidth = 0.3 * PX_PER_MM;
    ctx.stroke();
  }

  return canvas;
}

function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to rasterize the sheet to PNG.'));
        return;
      }
      blob
        .arrayBuffer()
        .then((buffer) => resolve(new Uint8Array(buffer)))
        .catch(reject);
    }, 'image/png');
  });
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
