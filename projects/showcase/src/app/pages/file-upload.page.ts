import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { SolFileUploadComponent } from '@solercia/ui';
import { DemoComponent } from '../shared/demo.component';
import { PageComponent } from '../shared/page.component';

@Component({
  selector: 'app-file-upload-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageComponent, DemoComponent, SolFileUploadComponent],
  template: `
    <app-page title="File upload" lead="Drag-and-drop image picker with type and size validation and a local preview." [selectors]="['sol-file-upload']">
      <app-demo title="Default (images up to 5 MB)" [code]="defaultCode" [stack]="true">
        <sol-file-upload
          label="Drag your logo here or click to browse"
          (fileSelected)="file.set($event.name + ' · ' + kb($event.size) + ' KB')"
          (previewReady)="previewLoaded.set(true)"
          (fileError)="error.set($event)"
          (fileRemoved)="clear()"
        />
        <p class="hint">
          File: {{ file() || '—' }} · Preview: {{ previewLoaded() ? 'ready' : 'none' }}
          @if (error()) {
            · <span class="error">{{ error() }}</span>
          }
        </p>
      </app-demo>

      <app-demo title="Restricted (PNG up to 200 KB)" description="Drop a larger file to see the fileError output." [code]="restrictedCode" [stack]="true">
        <sol-file-upload label="Drag a PNG here or click to browse" accept="image/png" [maxSizeBytes]="200 * 1024" hint="PNG · max. 200 KB" (fileError)="error.set($event)" />
      </app-demo>
    </app-page>
  `,
  styles: `
    .hint {
      margin: 0;
      color: var(--sol-color-text-secondary);
      font-size: var(--sol-font-size-sm);
    }
    .error {
      color: var(--sol-color-danger);
    }
  `,
})
export class FileUploadPage {
  protected readonly file = signal('');
  protected readonly previewLoaded = signal(false);
  protected readonly error = signal('');

  protected kb(bytes: number): number {
    return Math.round(bytes / 1024);
  }

  protected clear(): void {
    this.file.set('');
    this.previewLoaded.set(false);
    this.error.set('');
  }

  protected readonly defaultCode = `<sol-file-upload
  label="Drag your logo here or click to browse"
  (fileSelected)="upload($event)"      <!-- File -->
  (previewReady)="preview.set($event)" <!-- data URL -->
  (fileError)="error.set($event)"      <!-- message -->
  (fileRemoved)="clear()"
/>`;
  protected readonly restrictedCode = `<sol-file-upload label="Drag a PNG here or click to browse" accept="image/png" [maxSizeBytes]="200 * 1024" hint="PNG · max. 200 KB" />`;
}
