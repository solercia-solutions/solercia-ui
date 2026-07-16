import {
  Component,
  ChangeDetectionStrategy,
  computed,
  input,
} from '@angular/core';

export type SolAvatarSize = 'sm' | 'md' | 'lg';

const PALETTE_SIZE = 8;

/**
 * Hash determinista (variante djb2) de una semilla a un índice `[0, paletteSize)`.
 * PURA: sin `Date`/`Math.random`/estado — la misma semilla SIEMPRE produce el
 * mismo índice, en cualquier instancia y en cualquier momento (spec:
 * solercia-ui-vocero-atoms#color estable entre instancias).
 */
export function hashToPaletteIndex(seed: string, paletteSize = PALETTE_SIZE): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0; // |0 trunca a entero de 32 bits (overflow controlado)
  }
  return Math.abs(hash) % paletteSize;
}

/**
 * Iniciales a partir de un nombre: nombre compuesto → primera letra de la
 * primera y de la última palabra ("Ana Torres" → "AT"); una sola palabra →
 * sus 2 primeras letras; vacío → cadena vacía. PURA.
 */
export function computeInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * `sol-avatar` — iniciales + color de fondo estable por hash del `name`,
 * elegido entre una paleta fija de 8 tonos desaturados (spec:
 * solercia-ui-vocero-atoms). Sin conocimiento de dominio: recibe un `name`
 * genérico (persona, empresa, lo que sea) — nunca un modelo de negocio.
 *
 * Sin texto que traducir: las iniciales se derivan del propio `name` (dato
 * del consumidor, no copia de UI), así que no hay i18n que resolver aquí.
 */
@Component({
  selector: 'sol-avatar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'hostClass()',
    role: 'img',
    '[attr.aria-label]': 'name()',
  },
  template: `
    @if (imageUrl(); as src) {
      <img class="sol-avatar__image" [src]="src" alt="" />
    } @else {
      <span class="sol-avatar__initials" aria-hidden="true">{{ initials() }}</span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      overflow: hidden;
      border-radius: 50%;
      font-family: var(--sol-font-family);
      font-weight: 600;
      color: #ffffff;
      user-select: none;
    }

    :host.sol-avatar--sm { width: 1.75rem; height: 1.75rem; font-size: var(--sol-font-size-xs, 0.7rem); }
    :host.sol-avatar--md { width: 2.5rem; height: 2.5rem; font-size: var(--sol-font-size-sm, 0.875rem); }
    :host.sol-avatar--lg { width: 3.5rem; height: 3.5rem; font-size: var(--sol-font-size-base, 1rem); }

    .sol-avatar__image {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    /* Paleta de 8 tonos desaturados (hash % 8) — override vía --sol-avatar-palette-N
       si un host quiere una paleta propia; el fallback ya funciona en light/dark. */
    :host.sol-avatar--palette-0 { background: var(--sol-avatar-palette-0, #78716c); }
    :host.sol-avatar--palette-1 { background: var(--sol-avatar-palette-1, #a8756c); }
    :host.sol-avatar--palette-2 { background: var(--sol-avatar-palette-2, #a68a56); }
    :host.sol-avatar--palette-3 { background: var(--sol-avatar-palette-3, #6b9080); }
    :host.sol-avatar--palette-4 { background: var(--sol-avatar-palette-4, #5b8a8a); }
    :host.sol-avatar--palette-5 { background: var(--sol-avatar-palette-5, #6b83a6); }
    :host.sol-avatar--palette-6 { background: var(--sol-avatar-palette-6, #8a75a6); }
    :host.sol-avatar--palette-7 { background: var(--sol-avatar-palette-7, #a6688a); }
  `,
})
export class SolAvatarComponent {
  /** Nombre o identificador de entrada — determina iniciales y color. */
  readonly name = input.required<string>();

  /** URL de imagen opcional; si se da, reemplaza las iniciales. */
  readonly imageUrl = input<string | null>(null);

  readonly size = input<SolAvatarSize>('md');

  readonly initials = computed(() => computeInitials(this.name()));

  readonly paletteIndex = computed(() => hashToPaletteIndex(this.name()));

  readonly hostClass = computed(
    () => `sol-avatar sol-avatar--${this.size()} sol-avatar--palette-${this.paletteIndex()}`,
  );
}
