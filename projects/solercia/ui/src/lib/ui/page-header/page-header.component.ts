import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Cabecera de página del design system: título (H1) + subtítulo opcional a la
 * izquierda, con un slot proyectado de acciones alineadas a la derecha (p. ej.
 * un botón "Crear"). Tematizado con `var(--sol-*)` — soporta light y dark.
 *
 * Uso:
 * ```html
 * <sol-page-header title="Profesionales" subtitle="Gestiona tu equipo">
 *   <sol-button (clicked)="crear()">Crear</sol-button>
 * </sol-page-header>
 * ```
 */
@Component({
  selector: 'sol-page-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sol-page-header">
      <div class="sol-page-header__titles">
        <h1 class="sol-page-header__title">{{ title() }}</h1>
        @if (subtitle()) {
          <p class="sol-page-header__subtitle">{{ subtitle() }}</p>
        }
      </div>
      <div class="sol-page-header__actions">
        <ng-content />
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .sol-page-header {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      justify-content: space-between;
      gap: var(--sol-space-sm, 0.75rem);
    }

    .sol-page-header__titles {
      min-width: 0;
    }

    .sol-page-header__title {
      margin: 0;
      font-family: var(--sol-font-display, var(--sol-font-family, inherit));
      font-size: var(--sol-font-size-xl, 1.5rem);
      font-weight: var(--sol-display-weight, var(--sol-font-weight-bold, 700));
      letter-spacing: var(--sol-display-tracking, -0.01em);
      text-transform: var(--sol-display-transform, none);
      line-height: 1.2;
      color: var(--sol-color-text-primary, #0f172a);
    }

    .sol-page-header__subtitle {
      margin: var(--sol-space-xs, 0.25rem) 0 0;
      font-size: var(--sol-font-size-sm, 0.8125rem);
      color: var(--sol-color-text-muted, #64748b);
    }

    .sol-page-header__actions {
      display: flex;
      align-items: center;
      gap: var(--sol-space-sm, 0.5rem);
      flex-shrink: 0;
    }

    .sol-page-header__actions:empty {
      display: none;
    }
  `,
})
export class SolPageHeaderComponent {
  /** Título principal (H1). Obligatorio. */
  readonly title = input.required<string>();

  /** Subtítulo opcional bajo el título. */
  readonly subtitle = input<string>('');
}
