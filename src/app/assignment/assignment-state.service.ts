import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { ImagesStateService } from '../images/images-state.service';
import { LayoutStateService } from '../layout/layout-state.service';
import { IDENTITY_TRANSFORM, ImageTransform, SiteAssignment } from '../models/assignment.model';

/**
 * siteIndex -> SiteAssignment, scoped to the current sheet (single sheet for now —
 * multi-sheet assignment per SPEC.md §8.2/§8.3 is future work).
 */
@Injectable({ providedIn: 'root' })
export class AssignmentStateService {
  private readonly layoutState = inject(LayoutStateService);
  private readonly imagesState = inject(ImagesStateService);

  private readonly _assignments = signal<ReadonlyMap<number, SiteAssignment>>(new Map());
  readonly assignments = this._assignments.asReadonly();

  readonly totalSites = computed(() => this.layoutState.layout()?.sites.length ?? 0);
  readonly filledCount = computed(() => this._assignments().size);

  constructor() {
    // Drop assignments for sites that no longer exist after a layout change (SPEC §8.1).
    effect(() => {
      const total = this.totalSites();
      this.prune((siteIndex) => siteIndex < total);
    });

    // Drop assignments pointing at an image that was removed.
    effect(() => {
      const validIds = new Set(this.imagesState.images().map((img) => img.id));
      this.prune((_siteIndex, assignment) => validIds.has(assignment.imageId));
    });
  }

  getAssignment(siteIndex: number): SiteAssignment | null {
    return this._assignments().get(siteIndex) ?? null;
  }

  imageIdFor(siteIndex: number): string | null {
    return this._assignments().get(siteIndex)?.imageId ?? null;
  }

  assignImage(siteIndex: number, imageId: string): void {
    const next = new Map(this._assignments());
    next.set(siteIndex, { imageId, transform: IDENTITY_TRANSFORM });
    this._assignments.set(next);
  }

  clearSite(siteIndex: number): void {
    if (!this._assignments().has(siteIndex)) {
      return;
    }
    const next = new Map(this._assignments());
    next.delete(siteIndex);
    this._assignments.set(next);
  }

  setTransform(siteIndex: number, transform: ImageTransform): void {
    const current = this._assignments().get(siteIndex);
    if (!current) {
      return;
    }
    const next = new Map(this._assignments());
    next.set(siteIndex, { ...current, transform });
    this._assignments.set(next);
  }

  /** Other sites (excluding siteIndex) currently showing the same image. */
  sitesWithImage(imageId: string, excludeSiteIndex: number): number[] {
    const result: number[] = [];
    for (const [siteIndex, assignment] of this._assignments()) {
      if (siteIndex !== excludeSiteIndex && assignment.imageId === imageId) {
        result.push(siteIndex);
      }
    }
    return result;
  }

  applyTransformToSites(siteIndexes: readonly number[], transform: ImageTransform): void {
    const next = new Map(this._assignments());
    for (const siteIndex of siteIndexes) {
      const current = next.get(siteIndex);
      if (current) {
        next.set(siteIndex, { ...current, transform });
      }
    }
    this._assignments.set(next);
  }

  /** Overwrites every site in the current layout, replacing any existing per-site assignment. */
  applyToAll(imageId: string): void {
    const layout = this.layoutState.layout();
    if (!layout) {
      return;
    }
    const next = new Map<number, SiteAssignment>();
    for (const site of layout.sites) {
      next.set(site.index, { imageId, transform: IDENTITY_TRANSFORM });
    }
    this._assignments.set(next);
  }

  /** Fills only sites that don't already have an image assigned, leaving existing ones untouched. */
  applyToRemainder(imageId: string): void {
    const layout = this.layoutState.layout();
    if (!layout) {
      return;
    }
    const next = new Map(this._assignments());
    for (const site of layout.sites) {
      if (!next.has(site.index)) {
        next.set(site.index, { imageId, transform: IDENTITY_TRANSFORM });
      }
    }
    this._assignments.set(next);
  }

  private prune(keep: (siteIndex: number, assignment: SiteAssignment) => boolean): void {
    const current = this._assignments();
    let changed = false;
    const next = new Map<number, SiteAssignment>();
    for (const [siteIndex, assignment] of current) {
      if (keep(siteIndex, assignment)) {
        next.set(siteIndex, assignment);
      } else {
        changed = true;
      }
    }
    if (changed) {
      this._assignments.set(next);
    }
  }
}
