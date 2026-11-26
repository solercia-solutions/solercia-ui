import {
  Component,
  ChangeDetectionStrategy,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { SolIconComponent } from '../icon/icon.component';
import { injectSolI18n } from '../../i18n/inject-sol-i18n';

const DEFAULT_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';
const DEFAULT_MAX_SIZE = 5 * 1024 * 1024; // 5 MB

@Component({
  selector: 'sol-file-upload',
  standalone: true,
  imports: [SolIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label
      class="sol-file-upload"
      [class.sol-file-upload--dragover]="isDragOver()"
      [class.sol-file-upload--drag-invalid]="isDragInvalid()"
      [class.sol-file-upload--has-preview]="previewUrl()"
      [class.sol-file-upload--has-error]="errorMessage()"
      (dragover)="onDragOver($event)"
      (dragleave)="onDragLeave()"
      (drop)="onDrop($event)"
    >
      <input
        type="file"
        [accept]="accept()"
        class="sol-file-upload__input"
        (change)="onInputChange($event)"
      />

      @if (previewUrl()) {
        <img [src]="previewUrl()!" [alt]="fileName() || t('preview')" class="sol-file-upload__preview" />
        <div class="sol-file-upload__overlay">
          <button type="button" class="sol-file-upload__remove" (click)="removeImage($event)" [attr.title]="t('remove')" [attr.aria-label]="t('remove')">
            <sol-icon name="x" size="sm" />
          </button>
          <sol-icon name="photo" size="md" class="sol-file-upload__overlay-icon" />
          <span class="sol-file-upload__overlay-text">{{ t('change') }}</span>
        </div>
      } @else {
        <div class="sol-file-upload__placeholder">
          <sol-icon name="cloud-arrow-up" size="lg" class="sol-file-upload__icon" />
          <span class="sol-file-upload__hint-primary">{{ labelText() }}</span>
          <span class="sol-file-upload__hint-secondary">{{ hintText() }}</span>
        </div>
      }
    </label>

    @if (errorMessage()) {
      <p class="sol-file-upload__error">{{ errorMessage() }}</p>
    } @else if (fileName() && !previewUrl()) {
      <p class="sol-file-upload__filename">{{ fileName() }}</p>
    }
  `,
  styles: `
    .sol-file-upload {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      min-height: 140px;
      border: 2px dashed var(--sol-border-color-default, #E2E8F0);
      border-radius: var(--sol-border-radius-md, 8px);
      background: var(--sol-bg-page, #F8FAFC);
      cursor: pointer;
      transition: border-color 0.2s ease, background 0.2s ease;
      overflow: hidden;
      user-select: none;
    }

    .sol-file-upload:hover,
    .sol-file-upload--dragover {
      border-color: var(--sol-color-primary, #2563EB);
      background: color-mix(in srgb, var(--sol-color-primary, #2563EB) 4%, var(--sol-bg-page, #F8FAFC));
    }

    .sol-file-upload--dragover {
      border-style: solid;
    }

    .sol-file-upload--drag-invalid {
      border-color: var(--sol-color-danger, #DC2626) !important;
      border-style: solid;
      background: color-mix(in srgb, var(--sol-color-danger, #DC2626) 4%, var(--sol-bg-page, #F8FAFC)) !important;
    }

    .sol-file-upload--has-error {
      border-color: var(--sol-color-danger, #DC2626);
    }

    .sol-file-upload__input {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .sol-file-upload__placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 24px 16px;
      text-align: center;
      pointer-events: none;
    }

    .sol-file-upload__icon {
      color: var(--sol-color-text-muted, #94A3B8);
      transition: color 0.2s;
    }

    .sol-file-upload:hover .sol-file-upload__icon,
    .sol-file-upload--dragover .sol-file-upload__icon {
      color: var(--sol-color-primary, #2563EB);
    }

    .sol-file-upload__hint-primary {
      font-size: var(--sol-font-size-sm, 13px);
      font-weight: 500;
      color: var(--sol-color-text-secondary, #64748B);
    }

    .sol-file-upload__hint-secondary {
      font-size: var(--sol-font-size-xs, 11px);
      color: var(--sol-color-text-muted, #94A3B8);
    }

    .sol-file-upload__preview {
      width: 100%;
      height: 100%;
      min-height: 140px;
      object-fit: cover;
      display: block;
    }

    .sol-file-upload__overlay {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      background: rgba(0, 0, 0, 0.45);
      opacity: 0;
      transition: opacity 0.2s ease;
      pointer-events: none;
    }

    .sol-file-upload:hover .sol-file-upload__overlay {
      opacity: 1;
    }

    .sol-file-upload__remove {
      pointer-events: auto;
      position: absolute;
      top: 8px;
      right: 8px;
      background: rgba(0, 0, 0, 0.5);
      border: none;
      border-radius: 50%;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: #fff;
      transition: background 0.15s;
      z-index: 1;
    }

    .sol-file-upload__remove:hover {
      background: rgba(220, 38, 38, 0.8);
    }

    .sol-file-upload__overlay-icon {
      color: #fff;
    }

    .sol-file-upload__overlay-text {
      font-size: var(--sol-font-size-sm, 13px);
      font-weight: 500;
      color: #fff;
    }

    .sol-file-upload__filename {
      margin: 6px 0 0;
      font-size: var(--sol-font-size-xs, 11px);
      color: var(--sol-color-text-muted, #94A3B8);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .sol-file-upload__error {
      margin: 6px 0 0;
      font-size: var(--sol-font-size-xs, 11px);
      color: var(--sol-color-danger, #DC2626);
      font-weight: 500;
    }
  `,
})
export class SolFileUploadComponent {
  readonly accept = input<string>(DEFAULT_ACCEPT);
  readonly maxSizeBytes = input<number>(DEFAULT_MAX_SIZE);
  private readonly i18n = injectSolI18n();

  /** Main text of the drop zone. Without a value it uses `shared.fileUpload.label`. */
  readonly label = input<string | undefined>(undefined);
  /** Secondary text of the drop zone. Without a value it uses `shared.fileUpload.hint`. */
  readonly hint = input<string | undefined>(undefined);

  readonly fileSelected = output<File>();
  readonly previewReady = output<string>();
  readonly fileError = output<string>();
  readonly fileRemoved = output<void>();

  readonly isDragOver = signal(false);
  readonly isDragInvalid = signal(false);
  readonly previewUrl = signal<string | null>(null);
  readonly fileName = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  readonly labelText = computed(() => this.label() ?? this.t('label'));
  readonly hintText = computed(() => this.hint() ?? this.t('hint'));

  /** Resolves `shared.fileUpload.<key>` (reacts to language changes). */
  protected t(key: string, params?: Record<string, unknown>): string {
    this.i18n.activeLang();
    return this.i18n.translate(`shared.fileUpload.${key}`, params);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();

    const items = event.dataTransfer?.items;
    if (items && items.length > 0) {
      const item = items[0];
      if (item.kind === 'file' && item.type && !this.isAcceptedType(item.type)) {
        this.isDragInvalid.set(true);
        this.isDragOver.set(false);
        return;
      }
    }

    this.isDragOver.set(true);
    this.isDragInvalid.set(false);
  }

  onDragLeave(): void {
    this.isDragOver.set(false);
    this.isDragInvalid.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
    this.isDragInvalid.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) this.processFile(file);
  }

  onInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.processFile(file);
    input.value = '';
  }

  removeImage(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.reset();
    this.fileRemoved.emit();
  }

  private processFile(file: File): void {
    this.errorMessage.set(null);

    if (!this.isAcceptedType(file.type)) {
      const types = this.getReadableTypes();
      const msg = this.t('invalidType', { types });
      this.errorMessage.set(msg);
      this.fileError.emit(msg);
      return;
    }

    const maxSize = this.maxSizeBytes();
    if (maxSize > 0 && file.size > maxSize) {
      const maxMB = (maxSize / (1024 * 1024)).toFixed(0);
      const fileMB = (file.size / (1024 * 1024)).toFixed(1);
      const msg = this.t('tooLarge', { size: fileMB, max: maxMB });
      this.errorMessage.set(msg);
      this.fileError.emit(msg);
      return;
    }

    this.fileName.set(file.name);
    this.fileSelected.emit(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      this.previewUrl.set(url);
      this.previewReady.emit(url);
    };
    reader.readAsDataURL(file);
  }

  private isAcceptedType(mimeType: string): boolean {
    const accepted = this.accept().split(',').map(t => t.trim()).filter(Boolean);
    if (accepted.length === 0) return true;
    return accepted.includes(mimeType);
  }

  private getReadableTypes(): string {
    return this.accept()
      .split(',')
      .map(t => t.trim().split('/')[1]?.toUpperCase())
      .filter(Boolean)
      .join(', ');
  }

  /** Permite resetear el componente desde el exterior */
  reset(): void {
    this.previewUrl.set(null);
    this.fileName.set(null);
    this.errorMessage.set(null);
  }
}
