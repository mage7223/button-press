import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LayoutControlsComponent } from './layout/layout-controls.component';
import { SheetPreviewComponent } from './canvas/sheet-preview.component';
import { ImageUploadComponent } from './images/image-upload.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, LayoutControlsComponent, SheetPreviewComponent, ImageUploadComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly title = signal('Tampa HackerSpace Button Press formatinator');
}
