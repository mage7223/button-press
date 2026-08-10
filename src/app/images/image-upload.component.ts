import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SUPPORTED_IMAGE_TYPES } from '../models/image.model';
import { ImagesStateService } from './images-state.service';

@Component({
  selector: 'app-image-upload',
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './image-upload.component.html',
  styleUrl: './image-upload.component.scss',
})
export class ImageUploadComponent {
  protected readonly state = inject(ImagesStateService);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly acceptTypes = SUPPORTED_IMAGE_TYPES.join(',');
  protected readonly isDragOver = signal(false);

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(true);
  }

  protected onDragLeave(): void {
    this.isDragOver.set(false);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(false);
    // Snapshot before the async chain proceeds — DataTransfer's data store is only
    // guaranteed valid for the duration of this synchronous handler.
    const files = event.dataTransfer?.files.length ? Array.from(event.dataTransfer.files) : [];
    if (files.length) {
      this.addFiles(files);
    }
  }

  protected onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    // Snapshot to a plain array before resetting — clearing input.value can invalidate
    // the live FileList mid-iteration, silently dropping all but the first file.
    const files = input.files ? Array.from(input.files) : [];
    input.value = '';
    if (files.length) {
      this.addFiles(files);
    }
  }

  protected removeImage(id: string): void {
    this.state.removeImage(id);
  }

  private async addFiles(files: Iterable<File>): Promise<void> {
    const { added, skipped } = await this.state.addFiles(files);
    if (skipped.length > 0) {
      const noun = skipped.length === 1 ? 'file' : 'files';
      this.snackBar.open(
        `Skipped ${skipped.length} unsupported ${noun} (${skipped.join(', ')}) — only JPEG, PNG, and WebP are supported.`,
        'Dismiss',
        { duration: 6000 },
      );
    } else if (added.length === 0) {
      this.snackBar.open('No supported images found in that selection.', 'Dismiss', { duration: 4000 });
    }
  }
}
