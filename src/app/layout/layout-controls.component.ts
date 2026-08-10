import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ButtonSizePreset, PageSizePreset } from '../models/layout.model';
import { LayoutStateService } from './layout-state.service';

@Component({
  selector: 'app-layout-controls',
  imports: [FormsModule, MatFormFieldModule, MatSelectModule, MatInputModule],
  templateUrl: './layout-controls.component.html',
  styleUrl: './layout-controls.component.scss',
})
export class LayoutControlsComponent {
  protected readonly state = inject(LayoutStateService);

  protected onButtonSizeChange(preset: ButtonSizePreset): void {
    this.state.buttonSize.set(preset);
  }

  protected onPageSizeChange(preset: PageSizePreset): void {
    this.state.pageSize.set(preset);
  }

  protected onSitePaddingChange(value: number): void {
    this.state.sitePaddingMm.set(Math.max(0, value));
  }

  protected onSheetMarginChange(value: number): void {
    this.state.sheetMarginMm.set(Math.max(0, value));
  }
}
