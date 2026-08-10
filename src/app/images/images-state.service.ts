import { Injectable, signal } from '@angular/core';
import { ImageAsset, SUPPORTED_IMAGE_TYPES } from '../models/image.model';

export interface AddFilesResult {
  added: ImageAsset[];
  skipped: string[];
}

/** Holds uploaded images for the project (SPEC.md §8.3, §9 ImageAsset). */
@Injectable({ providedIn: 'root' })
export class ImagesStateService {
  private readonly _images = signal<ImageAsset[]>([]);
  readonly images = this._images.asReadonly();

  /** The image currently "held" for assignment onto sites — set by clicking a thumbnail. */
  private readonly _selectedImageId = signal<string | null>(null);
  readonly selectedImageId = this._selectedImageId.asReadonly();

  selectImage(id: string): void {
    this._selectedImageId.update((current) => (current === id ? null : id));
  }

  clearSelection(): void {
    this._selectedImageId.set(null);
  }

  async addFiles(files: Iterable<File>): Promise<AddFilesResult> {
    const added: ImageAsset[] = [];
    const skipped: string[] = [];

    for (const file of files) {
      if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
        skipped.push(file.name);
        continue;
      }

      const bitmap = await createImageBitmap(file);
      added.push({
        id: crypto.randomUUID(),
        fileName: file.name,
        bitmap,
        naturalWidthPx: bitmap.width,
        naturalHeightPx: bitmap.height,
        objectUrl: URL.createObjectURL(file),
      });
    }

    if (added.length > 0) {
      this._images.update((current) => [...current, ...added]);
    }

    return { added, skipped };
  }

  removeImage(id: string): void {
    const image = this._images().find((img) => img.id === id);
    if (!image) {
      return;
    }
    URL.revokeObjectURL(image.objectUrl);
    image.bitmap.close();
    this._images.update((current) => current.filter((img) => img.id !== id));
    if (this._selectedImageId() === id) {
      this.clearSelection();
    }
  }
}
