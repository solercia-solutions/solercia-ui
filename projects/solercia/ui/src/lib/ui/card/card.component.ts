import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';

@Component({
  selector: 'sol-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="hostClasses()">
      <ng-content />
    </div>
  `,
  styles: `
    /* Sin esta regla el host (un elemento custom sin display propio) colapsa
       a max-content cuando el padre lo vuelve flex/grid item — el borde y el
       fondo de .sol-card seguían pintándose a tamaño completo, pero la caja
       real del host no reservaba espacio, así que layouts flex con varias
       sol-card como hijas quedaban rotos (bug real, PANDORA). */
    :host {
      display: block;
    }

    /* Tokens v2 de card (theming): forma, sombra y blur salen del tema activo.
       Los fallbacks encadenan a los tokens v1 (red final de styles.css). */
    .sol-card {
      background: var(--sol-card-bg, var(--sol-bg-surface, #fff));
      border: var(--sol-card-border, 1px solid var(--sol-border-color-default, #e5e7eb));
      border-radius: var(--sol-card-radius, var(--sol-border-radius-lg, 12px));
      box-shadow: var(--sol-card-shadow, var(--sol-shadow-sm, 0 1px 3px rgba(0, 0, 0, 0.08)));
      -webkit-backdrop-filter: var(--sol-card-blur, none);
      backdrop-filter: var(--sol-card-blur, none);
      transition:
        box-shadow var(--sol-dur-base, 240ms) var(--sol-ease, ease),
        transform var(--sol-dur-base, 240ms) var(--sol-ease, ease);
    }

    /* El lift y la sombra de hover vienen del tema; el default emite 0px y la
       misma sombra base, así que sin tema v2 el hover no produce efecto. */
    .sol-card:hover {
      transform: translateY(var(--sol-hover-lift, 0px));
      box-shadow: var(--sol-card-shadow-hover, var(--sol-card-shadow, var(--sol-shadow-sm)));
    }

    .sol-card-padded {
      padding: 1.5rem;
    }

    .sol-card-hoverable {
      cursor: pointer;
    }
  `,
})
export class SolCardComponent {
  /** Whether the card has internal padding. */
  padding = input<boolean>(true);

  /** Whether the card shows a hover shadow effect. */
  hoverable = input<boolean>(false);

  /** Computed CSS classes combining base, padding, and hover states. */
  hostClasses = computed(() => {
    const classes = ['sol-card'];

    if (this.padding()) {
      classes.push('sol-card-padded');
    }

    if (this.hoverable()) {
      classes.push('sol-card-hoverable');
    }

    return classes.join(' ');
  });
}
