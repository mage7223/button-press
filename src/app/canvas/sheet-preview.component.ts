import { Component, effect, ElementRef, inject, viewChild } from '@angular/core';
import { Layout } from '../models/layout.model';
import { LayoutStateService } from '../layout/layout-state.service';

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
  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

  constructor() {
    effect(() => {
      const layout = this.state.layout();
      const canvasEl = this.canvasRef();
      this.draw(canvasEl, layout);
    });
  }

  private draw(canvasEl: ElementRef<HTMLCanvasElement> | undefined, layout: Layout | null): void {
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

      ctx.beginPath();
      ctx.arc(cx, cy, cutRadiusPx, 0, Math.PI * 2);
      ctx.strokeStyle = '#333333';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, liveRadiusPx, 0, Math.PI * 2);
      ctx.strokeStyle = '#999999';
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}
