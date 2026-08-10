import { Component, effect, ElementRef, inject, signal, viewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { AssignmentStateService } from '../assignment/assignment-state.service';
import { SiteEditorDialogComponent, SiteEditorDialogData, SiteEditorResult } from '../assignment/site-editor-dialog.component';
import { ImagesStateService } from '../images/images-state.service';
import { IMAGE_DRAG_MIME_TYPE, ImageAsset } from '../models/image.model';
import { ImageTransform, SiteAssignment } from '../models/assignment.model';
import { Layout, SitePosition } from '../models/layout.model';
import { LayoutStateService } from '../layout/layout-state.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../shared/confirm-dialog.component';

/** Pixels per mm at render time — arbitrary for on-screen preview, not export. */
const PX_PER_MM = 3;

@Component({
  selector: 'app-sheet-preview',
  imports: [],
  templateUrl: './sheet-preview.component.html',
  styleUrl: './sheet-preview.component.scss',
})
export class SheetPreviewComponent {
  protected readonly state = inject(LayoutStateService);
  protected readonly assignmentState = inject(AssignmentStateService);
  private readonly imagesState = inject(ImagesStateService);
  private readonly dialog = inject(MatDialog);
  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

  private readonly dragHoverSiteIndex = signal<number | null>(null);

  constructor() {
    effect(() => {
      const layout = this.state.layout();
      const canvasEl = this.canvasRef();
      const assignments = this.assignmentState.assignments();
      const imagesById = new Map(this.imagesState.images().map((img) => [img.id, img]));
      const hoverSiteIndex = this.dragHoverSiteIndex();
      this.draw(canvasEl, layout, assignments, imagesById, hoverSiteIndex);
    });
  }

  protected onCanvasClick(event: MouseEvent): void {
    const site = this.findSiteAtClientPoint(event.clientX, event.clientY);
    if (!site) {
      return;
    }

    // A filled site always opens the editor on click, regardless of whether an image is
    // currently held for placement — no need to deselect first. Held-image placement by
    // click only applies to empty sites; dragging a thumbnail onto a filled site still
    // overwrites it directly (see onCanvasDrop).
    if (this.assignmentState.getAssignment(site.index)) {
      this.openEditor(site.index);
      return;
    }

    const selectedImageId = this.imagesState.selectedImageId();
    if (selectedImageId) {
      this.assignmentState.assignImage(site.index, selectedImageId);
    }
  }

  protected onCanvasDragOver(event: DragEvent): void {
    if (!event.dataTransfer?.types.includes(IMAGE_DRAG_MIME_TYPE)) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    const site = this.findSiteAtClientPoint(event.clientX, event.clientY);
    this.dragHoverSiteIndex.set(site?.index ?? null);
  }

  protected onCanvasDragLeave(): void {
    this.dragHoverSiteIndex.set(null);
  }

  protected onCanvasDrop(event: DragEvent): void {
    const imageId = event.dataTransfer?.getData(IMAGE_DRAG_MIME_TYPE);
    this.dragHoverSiteIndex.set(null);
    if (!imageId) {
      return;
    }
    event.preventDefault();
    const site = this.findSiteAtClientPoint(event.clientX, event.clientY);
    if (site) {
      this.assignmentState.assignImage(site.index, imageId);
    }
  }

  private findSiteAtClientPoint(clientX: number, clientY: number): SitePosition | undefined {
    const layout = this.state.layout();
    const canvasEl = this.canvasRef();
    if (!layout || !canvasEl) {
      return undefined;
    }

    const canvas = canvasEl.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const xMm = ((clientX - rect.left) * scaleX) / PX_PER_MM;
    const yMm = ((clientY - rect.top) * scaleY) / PX_PER_MM;
    const cutRadiusMm = layout.config.buttonSize.cutLineDiameterMm / 2;

    return layout.sites.find((s) => {
      const dx = xMm - s.centerXMm;
      const dy = yMm - s.centerYMm;
      return Math.sqrt(dx * dx + dy * dy) <= cutRadiusMm;
    });
  }

  private openEditor(siteIndex: number): void {
    const ref = this.dialog.open(SiteEditorDialogComponent, {
      data: { siteIndex } satisfies SiteEditorDialogData,
      width: '480px',
      maxWidth: '95vw',
    });

    ref.afterClosed().subscribe((result: SiteEditorResult | undefined) => {
      if (!result?.saved) {
        return;
      }
      this.maybePropagateTransform(siteIndex, result.imageId, result.transform);
    });
  }

  private maybePropagateTransform(siteIndex: number, imageId: string, transform: ImageTransform): void {
    const others = this.assignmentState.sitesWithImage(imageId, siteIndex);
    if (others.length === 0) {
      return;
    }

    const confirmRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Apply to other sites?',
        message: `This image is also used on ${others.length} other site${others.length === 1 ? '' : 's'}. Apply the same position and size there too?`,
        confirmLabel: 'Apply to all',
        cancelLabel: 'Just this one',
      } satisfies ConfirmDialogData,
      width: '360px',
    });

    confirmRef.afterClosed().subscribe((confirmed: boolean | undefined) => {
      if (confirmed) {
        this.assignmentState.applyTransformToSites(others, transform);
      }
    });
  }

  private draw(
    canvasEl: ElementRef<HTMLCanvasElement> | undefined,
    layout: Layout | null,
    assignments: ReadonlyMap<number, SiteAssignment>,
    imagesById: Map<string, ImageAsset>,
    hoverSiteIndex: number | null,
  ): void {
    if (!canvasEl || !layout) {
      return;
    }
    const canvas = canvasEl.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const { pageSize, buttonSize } = layout.config;
    canvas.width = pageSize.widthMm * PX_PER_MM;
    canvas.height = pageSize.heightMm * PX_PER_MM;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#cccccc';
    ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);

    const cutRadiusPx = (buttonSize.cutLineDiameterMm / 2) * PX_PER_MM;
    const liveRadiusPx = (buttonSize.liveAreaDiameterMm / 2) * PX_PER_MM;

    for (const site of layout.sites) {
      const cx = site.centerXMm * PX_PER_MM;
      const cy = site.centerYMm * PX_PER_MM;
      const assignment = assignments.get(site.index);
      const asset = assignment ? imagesById.get(assignment.imageId) : undefined;

      if (asset && assignment) {
        this.drawSiteImage(ctx, asset, assignment.transform, cx, cy, cutRadiusPx);
      }

      ctx.beginPath();
      ctx.arc(cx, cy, cutRadiusPx, 0, Math.PI * 2);
      ctx.strokeStyle = '#333333';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, liveRadiusPx, 0, Math.PI * 2);
      ctx.strokeStyle = asset ? 'rgba(255, 255, 255, 0.85)' : '#999999';
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);

      if (site.index === hoverSiteIndex) {
        ctx.beginPath();
        ctx.arc(cx, cy, cutRadiusPx + 3, 0, Math.PI * 2);
        ctx.strokeStyle = '#1976d2';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }
  }

  /** Covers the cut-line circle at transform scale 1, then applies pan/stretch on top (§8.4). */
  private drawSiteImage(
    ctx: CanvasRenderingContext2D,
    asset: ImageAsset,
    transform: ImageTransform,
    cx: number,
    cy: number,
    cutRadiusPx: number,
  ): void {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, cutRadiusPx, 0, Math.PI * 2);
    ctx.clip();

    const targetSize = cutRadiusPx * 2;
    const baseScale = Math.max(targetSize / asset.bitmap.width, targetSize / asset.bitmap.height);
    const drawWidth = asset.bitmap.width * baseScale * transform.scaleX;
    const drawHeight = asset.bitmap.height * baseScale * transform.scaleY;
    const offsetXPx = transform.offsetXMm * PX_PER_MM;
    const offsetYPx = transform.offsetYMm * PX_PER_MM;
    ctx.drawImage(asset.bitmap, cx - drawWidth / 2 + offsetXPx, cy - drawHeight / 2 + offsetYPx, drawWidth, drawHeight);

    ctx.restore();
  }
}
