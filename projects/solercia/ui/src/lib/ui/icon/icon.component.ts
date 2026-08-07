import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
  inject,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ICON_REGISTRY } from './icon.registry';

export type SolIconSize    = 'sm' | 'md' | 'lg';
export type SolIconVariant = 'outline' | 'fill';

/** All valid icon names. Add here when you extend icon.registry.ts. */
export type SolIconName = keyof typeof ICON_REGISTRY;

@Component({
  selector: 'sol-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="sol-icon" [class]="sizeClass()" [innerHTML]="svg()"></span>`,
  styles: `
    .sol-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    /*
     * '::ng-deep' y no ':deep(...)': esta última es sintaxis de Vue/Sass y
     * Angular no la reconoce, así que la regla salía al bundle como selector
     * inválido y el navegador la descartaba entera. Además el SVG se inyecta
     * por [innerHTML], por lo que nunca lleva el atributo de encapsulación
     * '_ngcontent-*' y '::ng-deep' es obligatorio para alcanzarlo.
     */
    .sol-icon ::ng-deep svg { width: 100%; height: 100%; display: block; }

    .sol-icon-sm { width: 16px; height: 16px; }
    .sol-icon-md { width: 20px; height: 20px; }
    .sol-icon-lg { width: 24px; height: 24px; }
  `,
})
export class SolIconComponent {
  private readonly sanitizer = inject(DomSanitizer);

  /** Icon name — must exist in ICON_REGISTRY. */
  readonly name = input.required<SolIconName | string>();

  /** Size token. Defaults to 'md' (20 × 20 px). */
  readonly size = input<SolIconSize>('md');

  /**
   * Visual variant:
   *   'outline' — stroke paths on transparent background
   *   'fill'    — solid filled shape
   *
   * Outline-only icons (registry entries with `fill === ''`, e.g. `bold`,
   * `robot`) have no solid silhouette — requesting `variant="fill"` on one
   * of them renders its outline stroke instead (never a broken/invisible
   * icon). See `IconDef.fill` in `icon.registry.ts`.
   *
   * Color is controlled via Tailwind's text-* class on the host element.
   * Example: <sol-icon name="edit" variant="fill" class="text-blue-500" />
   */
  readonly variant = input<SolIconVariant>('outline');

  readonly sizeClass = computed(() => `sol-icon sol-icon-${this.size()}`);

  readonly svg = computed((): SafeHtml => {
    const def = ICON_REGISTRY[this.name()];

    // Outline-only icons (`IconDef.fill === ''`) have no solid variant — their
    // path data is open/thin strokes with zero fillable area. Requesting
    // `variant="fill"` on one of them degrades to the outline stroke
    // rendering instead of producing a broken/invisible icon.
    const hasSolidFill = !!def?.fill;
    const renderAsFill = this.variant() === 'fill' && hasSolidFill;

    const paths = def
      ? (renderAsFill ? def.fill : def.outline)
      : '<circle cx="12" cy="12" r="4" />';  // fallback dot for unknown icons

    // `width`/`height` van como atributos y no solo por CSS: un <svg> sin
    // dimensiones intrínsecas, usado como flex item, colapsa a alto 0 en WebKit
    // (Safari iOS) y el ícono desaparece dejando visible únicamente el texto.
    // Con los atributos presentes el tamaño no depende de que la hoja de
    // estilos del componente alcance al nodo inyectado.
    const markup = renderAsFill
      ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
             width="100%" height="100%"
             fill="currentColor" stroke="none"
             aria-hidden="true">${paths}</svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
             width="100%" height="100%"
             fill="none" stroke="currentColor"
             stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
             aria-hidden="true">${paths}</svg>`;

    return this.sanitizer.bypassSecurityTrustHtml(markup);
  });
}
