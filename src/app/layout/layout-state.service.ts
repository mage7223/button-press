import { computed, inject, Injectable, signal } from '@angular/core';
import { BUTTON_SIZE_PRESETS, DEFAULT_SHEET_MARGIN_MM, DEFAULT_SITE_PADDING_MM, PAGE_SIZE_PRESETS } from '../data/presets';
import { ButtonSizePreset, LayoutConfig, PageSizePreset } from '../models/layout.model';
import { LayoutService } from './layout.service';

/** Holds the current button/page/padding/margin selection and the derived layout. */
@Injectable({ providedIn: 'root' })
export class LayoutStateService {
  readonly buttonSizePresets = BUTTON_SIZE_PRESETS;
  readonly pageSizePresets = PAGE_SIZE_PRESETS;

  readonly buttonSize = signal<ButtonSizePreset>(BUTTON_SIZE_PRESETS[0]);
  readonly pageSize = signal<PageSizePreset>(PAGE_SIZE_PRESETS[0]);
  readonly sitePaddingMm = signal(DEFAULT_SITE_PADDING_MM);
  readonly sheetMarginMm = signal(DEFAULT_SHEET_MARGIN_MM);

  readonly config = computed<LayoutConfig>(() => ({
    buttonSize: this.buttonSize(),
    pageSize: this.pageSize(),
    sitePaddingMm: this.sitePaddingMm(),
    sheetMarginMm: this.sheetMarginMm(),
  }));

  private readonly result = computed(() => this.layoutService.compute(this.config()));

  readonly layout = computed(() => this.result().layout);
  readonly error = computed(() => this.result().error);

  private readonly layoutService = inject(LayoutService);
}
