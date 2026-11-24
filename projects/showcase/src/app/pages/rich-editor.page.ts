import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  SolRichEditorComponent,
  type LinkableTask,
  type MentionUser,
  type SolRichImageUploader,
} from '@solercia/ui';
import { DemoComponent } from '../shared/demo.component';
import { PageComponent } from '../shared/page.component';

@Component({
  selector: 'app-rich-editor-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, PageComponent, DemoComponent, SolRichEditorComponent],
  template: `
    <app-page
      title="Rich editor"
      lead="Formatted text with headings, lists, alignment, links, tables, images, @mentions and #task links. The HTML is sanitized to a TCPDF-safe subset."
      [selectors]="['sol-rich-editor']"
    >
      <app-demo title="Full editor" description="Type @ to mention a person or # to link a task." [code]="code" [stack]="true">
        <sol-rich-editor
          placeholder="Describe the change…"
          ariaLabel="Change description"
          minHeight="10rem"
          maxHeight="24rem"
          [imageUpload]="uploadImage"
          [mentionableUsers]="users"
          [linkableTasks]="tasks"
          [(ngModel)]="html"
          (mentionsChange)="mentions.set($event)"
          (taskLinksChange)="links.set($event)"
        />
        <p class="hint">Mentions: {{ mentions().join(', ') || '—' }} · Task links: {{ links().join(', ') || '—' }}</p>
        <details>
          <summary class="hint">HTML value</summary>
          <pre class="html">{{ html() }}</pre>
        </details>
      </app-demo>

      <app-demo title="Disabled" [code]="disabledCode" [stack]="true">
        <sol-rich-editor [disabled]="true" [ngModel]="readonlyHtml" ariaLabel="Read-only description" />
      </app-demo>
    </app-page>
  `,
  styles: `
    .hint {
      margin: 0;
      color: var(--sol-color-text-secondary);
      font-size: var(--sol-font-size-sm);
    }
    .html {
      white-space: pre-wrap;
      font-family: var(--sol-font-family-mono);
      font-size: var(--sol-font-size-sm);
    }
  `,
})
export class RichEditorPage {
  protected readonly users: MentionUser[] = [
    { id: 'u1', name: 'Ada Lovelace' },
    { id: 'u2', name: 'Alan Turing' },
    { id: 'u3', name: 'Grace Hopper' },
  ];
  protected readonly tasks: LinkableTask[] = [
    { key: 'SOL-101', title: 'Theme Studio export' },
    { key: 'SOL-102', title: 'Kanban keyboard moves' },
  ];
  protected readonly html = signal('<h2>Release notes</h2><p>The <strong>calendar</strong> now supports a day view.</p><ul><li>Faster rendering</li><li>Dark mode fixes</li></ul>');
  protected readonly readonlyHtml = '<p>This content cannot be edited.</p>';
  protected readonly mentions = signal<string[]>([]);
  protected readonly links = signal<string[]>([]);

  /** Demo uploader: a real host uploads the file and resolves its public URL. */
  protected readonly uploadImage: SolRichImageUploader = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  protected readonly code = `<sol-rich-editor
  placeholder="Describe the change…"
  ariaLabel="Change description"
  minHeight="10rem"
  maxHeight="24rem"
  [imageUpload]="uploadImage"          <!-- (file: File) => Promise<string /* url */> -->
  [mentionableUsers]="users"           <!-- MentionUser[] { id, name } -->
  [linkableTasks]="tasks"              <!-- LinkableTask[] { key, title } -->
  [(ngModel)]="html"
  (mentionsChange)="mentions.set($event)"
  (taskLinksChange)="links.set($event)"
/>`;
  protected readonly disabledCode = `<sol-rich-editor [disabled]="true" [ngModel]="html" />`;
}
