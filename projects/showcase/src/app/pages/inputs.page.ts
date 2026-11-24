import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  SolFormFieldComponent,
  SolInputComponent,
  SolNumberInputComponent,
  SolSearchInputComponent,
  SolTextareaComponent,
} from '@solercia/ui';
import { DemoComponent } from '../shared/demo.component';
import { PageComponent } from '../shared/page.component';

@Component({
  selector: 'app-inputs-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    PageComponent,
    DemoComponent,
    SolInputComponent,
    SolTextareaComponent,
    SolFormFieldComponent,
    SolSearchInputComponent,
    SolNumberInputComponent,
  ],
  template: `
    <app-page
      title="Text inputs"
      lead="Form controls that implement ControlValueAccessor: use them with ngModel or reactive forms."
      [selectors]="['sol-input', 'sol-textarea', 'sol-form-field', 'sol-search-input', 'sol-number-input']"
    >
      <app-demo title="Input" description="Label, placeholder, types, validation error and disabled." [code]="inputCode">
        <div class="grid">
          <sol-input label="Full name" placeholder="Ada Lovelace" autocomplete="name" [(ngModel)]="name" />
          <sol-input label="Email" type="email" placeholder="ada@example.com" [(ngModel)]="email" [error]="emailError()" />
          <sol-input label="Start date" type="date" min="2026-01-01" />
          <sol-input label="Organization" [disabled]="true" placeholder="Solercia Solutions" />
        </div>
      </app-demo>

      <app-demo title="Textarea" [code]="textareaCode">
        <div class="grid">
          <sol-textarea label="Notes" placeholder="Write a short summary…" [rows]="4" [(ngModel)]="notes" />
          <sol-textarea label="Reason" error="The reason is required." />
        </div>
        <p class="hint">{{ notes().length }} characters</p>
      </app-demo>

      <app-demo title="Form field" description="Wraps any control with label, hint and error." [code]="fieldCode">
        <div class="grid">
          <sol-form-field label="Website" hint="Include https://">
            <input class="native" placeholder="https://solercia.co" />
          </sol-form-field>
          <sol-form-field label="Tax ID" error="Enter a valid tax ID.">
            <input class="native" value="900-ABC" />
          </sol-form-field>
        </div>
      </app-demo>

      <app-demo title="Search input" description="Emits searchChange as the user types." [code]="searchCode" [stack]="true">
        <sol-search-input placeholder="Search projects…" (searchChange)="search.set($event)" />
        <p class="hint">Search term: “{{ search() || '—' }}”</p>
      </app-demo>

      <app-demo title="Number input" description="Stepper with min, max and step; ariaLabelKey is translated through SOL_I18N." [code]="numberCode">
        <sol-number-input ariaLabelKey="showcase.quantity" [min]="1" [max]="20" [(ngModel)]="seats" />
        <sol-number-input ariaLabelKey="showcase.quantity" [min]="0" [max]="100" [step]="5" [(ngModel)]="percent" />
        <sol-number-input ariaLabelKey="showcase.quantity" [disabled]="true" [ngModel]="3" />
        <p class="hint">Seats: {{ seats() }} · Percent: {{ percent() }}</p>
      </app-demo>
    </app-page>
  `,
  styles: `
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: var(--sol-space-md);
      width: 100%;
    }
    .hint {
      margin: 0;
      color: var(--sol-color-text-secondary);
      font-size: var(--sol-font-size-sm);
    }
    .native {
      width: 100%;
      height: var(--sol-size-input-height);
      padding: 0 var(--sol-space-sm);
      border: var(--sol-input-border);
      border-radius: var(--sol-input-radius);
      background: var(--sol-input-bg);
      color: var(--sol-color-text-primary);
      font: inherit;
    }
  `,
})
export class InputsPage {
  protected readonly name = signal('');
  protected readonly email = signal('ada@');
  protected readonly emailError = computed(() =>
    this.email() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(this.email()) ? 'Enter a valid email address.' : '',
  );
  protected readonly notes = signal('');
  protected readonly search = signal('');
  protected readonly seats = signal(4);
  protected readonly percent = signal(25);

  protected readonly inputCode = `<sol-input label="Full name" placeholder="Ada Lovelace" autocomplete="name" [(ngModel)]="name" />
<sol-input label="Email" type="email" [(ngModel)]="email" [error]="emailError()" />
<sol-input label="Start date" type="date" min="2026-01-01" />
<sol-input label="Organization" [disabled]="true" />`;
  protected readonly textareaCode = `<sol-textarea label="Notes" placeholder="Write a short summary…" [rows]="4" [(ngModel)]="notes" />
<sol-textarea label="Reason" error="The reason is required." />`;
  protected readonly fieldCode = `<sol-form-field label="Website" hint="Include https://">
  <input placeholder="https://solercia.co" />
</sol-form-field>
<sol-form-field label="Tax ID" error="Enter a valid tax ID.">
  <input />
</sol-form-field>`;
  protected readonly searchCode = `<sol-search-input placeholder="Search projects…" (searchChange)="search.set($event)" />`;
  protected readonly numberCode = `<sol-number-input ariaLabelKey="showcase.quantity" [min]="1" [max]="20" [(ngModel)]="seats" />
<sol-number-input ariaLabelKey="showcase.quantity" [step]="5" [max]="100" [(ngModel)]="percent" />`;
}
