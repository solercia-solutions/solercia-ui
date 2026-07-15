import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  numberAttribute,
} from '@angular/core';

/**
 * Variantes de forma del skeleton (Paso 5 theming v2):
 * - `text` / `title`: líneas de texto con radio pequeño del tema.
 * - `stat` / `card`: bloques de tarjeta con el radio de card del tema.
 * - `row`: fila de tabla o lista.
 * - `circle`: avatar circular.
 * - `rounded` / `square`: formas genéricas previas (galería de imágenes,
 *   bloques dimensionados por altura). Se conservan por compatibilidad.
 */
export type SolSkeletonVariant =
  | 'text'
  | 'title'
  | 'stat'
  | 'card'
  | 'row'
  | 'circle'
  | 'rounded'
  | 'square';

/**
 * Placeholder de carga tokenizado: el estado de carga también es de marca.
 * La forma sale por completo de los tokens del tema — en un tema plano y
 * recto el skeleton es plano y recto; en uno redondeado y suave, también —
 * sin ninguna lógica por tenant:
 * - Fondo: `--sol-bg-sunken` (superficie hundida del tema).
 * - Radio: `--sol-card-radius` para bloques, `--sol-border-radius-sm` para
 *   líneas y filas, 50% para círculos.
 * - Shimmer: keyframe global `solShimmer` (styles.css) con duración derivada
 *   de `--sol-dur-slow`, así hereda el escalado por intensidad de motion y
 *   por prefers-reduced-motion que aplica el ThemeService a los tokens.
 *
 * Accesibilidad: el host va `aria-hidden` (es decoración); el `aria-busy`
 * del contenedor que carga lo declara el consumidor.
 */
@Component({
  selector: 'sol-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    role: 'presentation',
  },
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--sol-space-xs, 8px);
    }

    .skeleton {
      position: relative;
      overflow: hidden;
      background: var(--sol-bg-sunken, var(--sol-bg-page, #e2e8f0));
      border-radius: var(--sol-card-radius, var(--sol-border-radius-lg, 12px));
    }

    /* Barrido de marca: el keyframe global solShimmer solo anima
       background-position; aquí se definen gradiente y background-size.
       La duración deriva de tokens (3x el paso "slow" del tema), nunca
       de un valor fijo. */
    .skeleton::after {
      content: '';
      position: absolute;
      inset: 0;
      background-image: linear-gradient(
        90deg,
        transparent 0%,
        color-mix(in srgb, var(--sol-bg-surface, #ffffff) 45%, transparent) 50%,
        transparent 100%
      );
      background-size: 200% 100%;
      background-repeat: no-repeat;
      animation: solShimmer calc(var(--sol-dur-slow, 480ms) * 3) ease-in-out infinite;
    }

    /* Parada dura de accesibilidad: los tokens ya colapsan la duración a
       ~1ms con reduced-motion, pero un bucle infinito acelerado parpadea,
       así que se detiene del todo y queda el bloque plano. */
    @media (prefers-reduced-motion: reduce) {
      .skeleton::after {
        animation: none;
      }
    }

    /* Dimensiones por variante — overrides via width/height del consumidor. */
    .skeleton--text {
      height: 14px;
      border-radius: var(--sol-border-radius-sm, 6px);
    }

    .skeleton--title {
      height: 24px;
      width: 45%;
      border-radius: var(--sol-border-radius-sm, 6px);
    }

    .skeleton--row {
      height: 44px;
      border-radius: var(--sol-border-radius-sm, 6px);
    }

    .skeleton--stat {
      height: 88px;
    }

    .skeleton--card {
      height: 300px;
    }

    .skeleton--circle {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      flex: none;
    }

    .skeleton--square {
      border-radius: 0;
    }
  `,
  template: `
    @for (i of blocks(); track i) {
      <div
        [class]="cssClass()"
        [style.width]="width()"
        [style.height]="height()"
        [style.aspect-ratio]="aspectRatio()"
      ></div>
    }
  `,
})
export class SolSkeletonComponent {
  readonly variant = input<SolSkeletonVariant>('rounded');
  /** Override opcional del ancho (los defaults salen de la variante). */
  readonly width = input<string>('');
  /** Override opcional del alto (los defaults salen de la variante). */
  readonly height = input<string>('');
  readonly aspectRatio = input<string>('');
  /** Cantidad de bloques a repetir (p. ej. filas de una tabla). */
  readonly count = input(1, { transform: numberAttribute });

  protected readonly cssClass = computed(() => `skeleton skeleton--${this.variant()}`);

  /** Índices a iterar; count inválido o menor a 1 pinta un solo bloque. */
  protected readonly blocks = computed(() => {
    const total = Number.isFinite(this.count()) ? Math.max(1, Math.floor(this.count())) : 1;
    return Array.from({ length: total }, (_, index) => index);
  });
}
