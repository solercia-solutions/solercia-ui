import {
  Component,
  ChangeDetectionStrategy,
  computed,
  inject,
  input,
} from '@angular/core';
import { SOL_I18N } from '../../i18n/sol-i18n';
import { SolIconComponent } from '../icon/icon.component';
import type { SolIconName } from '../icon/icon.component';

/**
 * Estado vacío estándar del design system (E2): ícono + título +
 * descripción opcional + slot para una acción. Recibe CLAVES i18n (no
 * texto) y las resuelve vía I18nService, reactivo al idioma activo.
 *
 * Uso:
 * ```html
 * <sol-empty-state icon="building" titleKey="pages.x.empty.title" descriptionKey="pages.x.empty.description">
 *   <sol-button (clicked)="crear()">…</sol-button>
 * </sol-empty-state>
 * ```
 */
@Component({
  selector: 'sol-empty-state',
  standalone: true,
  imports: [SolIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sol-empty-state" role="status">
      <div class="sol-empty-state__icon">
        <sol-icon [name]="icon()" size="lg" />
      </div>
      <h3 class="sol-empty-state__title">{{ title() }}</h3>
      @if (description()) {
        <p class="sol-empty-state__description">{{ description() }}</p>
      }
      <div class="sol-empty-state__action">
        <ng-content />
      </div>
    </div>
  `,
  styles: `
    .sol-empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: var(--sol-space-xl, 3rem) var(--sol-space-md, 1rem);
      background: var(--sol-bg-surface, #fff);
      border: 1px dashed var(--sol-border-color-default, #e2e8f0);
      border-radius: var(--sol-border-radius-lg, 12px);
    }

    .sol-empty-state__icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: color-mix(in srgb, var(--sol-color-primary, #2563eb) 8%, transparent);
      color: var(--sol-color-primary, #2563eb);
      margin-bottom: var(--sol-space-md, 1rem);
    }

    .sol-empty-state__title {
      font-size: var(--sol-font-size-md, 15px);
      font-weight: 600;
      color: var(--sol-color-text-primary, #0f172a);
      margin: 0;
    }

    .sol-empty-state__description {
      font-size: var(--sol-font-size-sm, 13px);
      color: var(--sol-color-text-muted, #64748b);
      margin: 6px 0 0;
      max-width: 420px;
    }

    .sol-empty-state__action {
      margin-top: var(--sol-space-md, 1rem);
    }

    .sol-empty-state__action:empty {
      display: none;
    }
  `,
})
export class SolEmptyStateComponent {
  private readonly i18n = inject(SOL_I18N);

  /** Ícono del registry a mostrar. */
  readonly icon = input<SolIconName>('list');

  /** Clave i18n del título (obligatoria). */
  readonly titleKey = input.required<string>();

  /** Clave i18n de la descripción (opcional). */
  readonly descriptionKey = input<string>('');

  /**
   * Las claves son inputs (dinámicas), así que no se puede usar `i18n.t()`
   * directo: se lee `activeLang` dentro del computed para recalcular la
   * traducción cuando cambia el idioma.
   */
  readonly title = computed(() => {
    this.i18n.activeLang();
    return this.i18n.translate(this.titleKey());
  });

  readonly description = computed(() => {
    this.i18n.activeLang();
    const key = this.descriptionKey();
    return key ? this.i18n.translate(key) : '';
  });
}
