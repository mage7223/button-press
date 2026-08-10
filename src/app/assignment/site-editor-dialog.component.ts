import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatSliderModule } from '@angular/material/slider';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { ImagesStateService } from '../images/images-state.service';
import { LayoutStateService } from '../layout/layout-state.service';
import { ImageTransform } from '../models/assignment.model';
import { AssignmentStateService } from './assignment-state.service';

export interface SiteEditorDialogData {
  siteIndex: number;
}

export type SiteEditorResult = { saved: true; imageId: string; transform: ImageTransform } | { saved: false };

const PREVIEW_SIZE_PX = 280;
// Shared by both the uniform zoom slider and the independent X/Y stretch sliders — going
// below 1 lets the image shrink to fit inside the live area instead of covering the cut line.
const SCALE_MIN = 0.3;
const SCALE_MAX = 4;

@Component({
  selector: 'app-site-editor-dialog',
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatSliderModule, MatSlideToggleModule],
  templateUrl: './site-editor-dialog.component.html',
  styleUrl: './site-editor-dialog.component.scss',
})
export class SiteEditorDialogComponent {
  private readonly data = inject<SiteEditorDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<SiteEditorDialogComponent, SiteEditorResult>);
  private readonly assignmentState = inject(AssignmentStateService);
  private readonly imagesState = inject(ImagesStateService);
  private readonly layoutState = inject(LayoutStateService);

  protected readonly siteIndex = this.data.siteIndex;
  private readonly assignment = this.assignmentState.getAssignment(this.siteIndex);
  protected readonly image = this.assignment
    ? (this.imagesState.images().find((img) => img.id === this.assignment!.imageId) ?? null)
    : null;

  protected readonly previewSizePx = PREVIEW_SIZE_PX;
  protected readonly scaleMin = SCALE_MIN;
  protected readonly scaleMax = SCALE_MAX;

  private readonly buttonSize = this.layoutState.layout()?.config.buttonSize;
  private readonly cutDiameterMm = this.buttonSize?.cutLineDiameterMm ?? 1;
  private readonly liveDiameterMm = this.buttonSize?.liveAreaDiameterMm ?? 1;
  private readonly pxPerMm = PREVIEW_SIZE_PX / this.cutDiameterMm;

  protected readonly liveAreaSizePx = this.liveDiameterMm * this.pxPerMm;

  protected readonly offsetXMm = signal(this.assignment?.transform.offsetXMm ?? 0);
  protected readonly offsetYMm = signal(this.assignment?.transform.offsetYMm ?? 0);
  protected readonly scaleX = signal(this.assignment?.transform.scaleX ?? 1);
  protected readonly scaleY = signal(this.assignment?.transform.scaleY ?? 1);
  protected readonly lockAspect = signal(
    Math.abs((this.assignment?.transform.scaleX ?? 1) - (this.assignment?.transform.scaleY ?? 1)) < 0.001,
  );

  private readonly baseCoverScale = computed(() => {
    if (!this.image) {
      return 1;
    }
    return Math.max(PREVIEW_SIZE_PX / this.image.naturalWidthPx, PREVIEW_SIZE_PX / this.image.naturalHeightPx);
  });

  protected readonly displayWidth = computed(() =>
    this.image ? this.image.naturalWidthPx * this.baseCoverScale() * this.scaleX() : 0,
  );
  protected readonly displayHeight = computed(() =>
    this.image ? this.image.naturalHeightPx * this.baseCoverScale() * this.scaleY() : 0,
  );
  protected readonly imageLeft = computed(() => PREVIEW_SIZE_PX / 2 - this.displayWidth() / 2 + this.offsetXMm() * this.pxPerMm);
  protected readonly imageTop = computed(() => PREVIEW_SIZE_PX / 2 - this.displayHeight() / 2 + this.offsetYMm() * this.pxPerMm);

  private dragPointerId: number | null = null;
  private dragStart: { x: number; y: number; offsetX: number; offsetY: number } | null = null;

  constructor() {
    if (!this.assignment) {
      setTimeout(() => this.dialogRef.close({ saved: false }));
    }
  }

  protected onPointerDown(event: PointerEvent): void {
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    this.dragPointerId = event.pointerId;
    this.dragStart = { x: event.clientX, y: event.clientY, offsetX: this.offsetXMm(), offsetY: this.offsetYMm() };
  }

  protected onPointerMove(event: PointerEvent): void {
    if (this.dragPointerId !== event.pointerId || !this.dragStart) {
      return;
    }
    const dxPx = event.clientX - this.dragStart.x;
    const dyPx = event.clientY - this.dragStart.y;
    this.offsetXMm.set(this.dragStart.offsetX + dxPx / this.pxPerMm);
    this.offsetYMm.set(this.dragStart.offsetY + dyPx / this.pxPerMm);
  }

  protected onPointerUp(event: PointerEvent): void {
    if (this.dragPointerId === event.pointerId) {
      this.dragPointerId = null;
      this.dragStart = null;
    }
  }

  protected onZoomChange(value: number): void {
    this.scaleX.set(value);
    this.scaleY.set(value);
  }

  protected onWidthScaleChange(value: number): void {
    this.scaleX.set(value);
  }

  protected onHeightScaleChange(value: number): void {
    this.scaleY.set(value);
  }

  protected onLockAspectChange(locked: boolean): void {
    this.lockAspect.set(locked);
    if (locked) {
      const avg = (this.scaleX() + this.scaleY()) / 2;
      this.scaleX.set(avg);
      this.scaleY.set(avg);
    }
  }

  protected reset(): void {
    this.offsetXMm.set(0);
    this.offsetYMm.set(0);
    this.scaleX.set(1);
    this.scaleY.set(1);
    this.lockAspect.set(true);
  }

  protected removeFromSite(): void {
    this.assignmentState.clearSite(this.siteIndex);
    this.dialogRef.close({ saved: false });
  }

  protected cancel(): void {
    this.dialogRef.close({ saved: false });
  }

  protected save(): void {
    if (!this.assignment) {
      this.dialogRef.close({ saved: false });
      return;
    }
    const transform: ImageTransform = {
      offsetXMm: this.offsetXMm(),
      offsetYMm: this.offsetYMm(),
      scaleX: this.scaleX(),
      scaleY: this.scaleY(),
    };
    this.assignmentState.setTransform(this.siteIndex, transform);
    this.dialogRef.close({ saved: true, imageId: this.assignment.imageId, transform });
  }
}
