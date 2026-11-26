import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { injectSolI18n } from '../../i18n/inject-sol-i18n';
import { SolIconComponent } from '../icon/icon.component';

export type SolStarRatingSize = 'sm' | 'md' | 'lg';

/** Escala de calificación: 5 estrellas, como la de Google. */
const MAX_STARS = 5;

/**
 * `sol-star-rating` — calificación de 1 a 5 en estrellas, de solo lectura.
 *
 * Genérico a propósito: no sabe de dónde sale el puntaje (reseñas de Google,
 * encuestas propias, calificación de un profesional). El consumidor pasa el
 * valor y decide si además muestra el número y el conteo.
 *
 * La media estrella se resuelve recortando la estrella llena con `width`
 * sobre la vacía, así que un 4.3 se ve como 4 llenas y una parcial — sin
 * redondear hacia arriba y sin un tercer ícono "media estrella".
 *
 * Accesibilidad: las estrellas son decorativas (`aria-hidden`) y el valor
 * real viaja en el `aria-label` del contenedor, con `role="img"`. Un lector
 * de pantalla anuncia "4,3 de 5" en vez de leer cinco íconos sueltos.
 */
@Component({
  selector: 'sol-star-rating',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SolIconComponent],
  template: `
    <span class="sol-star-rating" role="img" [attr.aria-label]="ariaLabel()">
      <span class="sol-star-rating__stars" aria-hidden="true">
        <!-- Capa base: las 5 estrellas vacías. -->
        @for (star of stars; track star) {
          <sol-icon name="star" [size]="size()" class="sol-star-rating__empty" />
        }

        <!-- Capa superpuesta: las mismas 5 llenas, recortadas al porcentaje. -->
        <span class="sol-star-rating__filled" [style.width.%]="filledPercent()">
          @for (star of stars; track star) {
            <sol-icon name="star" variant="fill" [size]="size()" />
          }
        </span>
      </span>

      @if (showValue() && value() !== null) {
        <span class="sol-star-rating__value">{{ formattedValue() }}</span>
      }
    </span>
  `,
  styles: `
    :host {
      display: inline-flex;
    }

    .sol-star-rating {
      display: inline-flex;
      align-items: center;
      gap: var(--sol-space-xs, 0.25rem);
    }

    .sol-star-rating__stars {
      position: relative;
      display: inline-flex;
      /* El ancho lo fija el contenido (las 5 estrellas vacías); la capa
         llena se posiciona encima y se recorta con overflow. */
      flex: none;
    }

    .sol-star-rating__stars sol-icon {
      /* Color de la calificación: el token de advertencia del tema es el
         ámbar del sistema, así que las estrellas se retematizan solas en
         claro y oscuro sin un color hardcodeado. */
      color: var(--sol-color-warning);
    }

    .sol-star-rating__empty {
      opacity: 0.35;
    }

    .sol-star-rating__filled {
      position: absolute;
      inset-block: 0;
      inset-inline-start: 0;
      display: inline-flex;
      overflow: hidden;
      /* Sin esto, la porción recortada dejaría pasar clics a lo que haya
         debajo con un área que el usuario no ve. */
      pointer-events: none;
    }

    .sol-star-rating__value {
      font-weight: var(--sol-font-weight-bold, 600);
      color: var(--sol-color-text-primary);
    }
  `,
})
export class SolStarRatingComponent {
  private readonly i18n = injectSolI18n();

  /** Calificación de 0 a 5. `null` = sin dato: se pintan 5 estrellas vacías. */
  readonly value = input<number | null>(null);

  /** Tamaño de las estrellas. Hereda la escala de `sol-icon`. */
  readonly size = input<SolStarRatingSize>('sm');

  /** Muestra el número junto a las estrellas (ej. "4,8"). */
  readonly showValue = input(false);

  /** Índices para el `@for`: siempre son 5 estrellas. */
  protected readonly stars = Array.from({ length: MAX_STARS }, (_, i) => i);

  /** Valor recortado al rango válido: un dato raro no rompe el ancho. */
  private readonly safeValue = computed(() => {
    const raw = this.value();
    if (raw === null || !Number.isFinite(raw)) return 0;
    return Math.min(Math.max(raw, 0), MAX_STARS);
  });

  protected readonly filledPercent = computed(() => (this.safeValue() / MAX_STARS) * 100);

  /** Un decimal con el separador del idioma activo (`4.5` en inglés, `4,5` en español). */
  protected readonly formattedValue = computed(() => {
    const lang = this.i18n.activeLang() || 'en';
    try {
      return new Intl.NumberFormat(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(this.safeValue());
    } catch {
      return this.safeValue().toFixed(1);
    }
  });

  protected readonly ariaLabel = computed(() => {
    const rating = this.formattedValue();
    const translated = this.i18n.translate('shared.starRating.label', {
      rating,
      max: MAX_STARS,
    });

    // El contrato de `SolI18n` devuelve la clave misma cuando falta, así que
    // ese caso se detecta y se cae a un texto propio en vez de anunciarle la
    // clave cruda a un lector de pantalla.
    return translated === 'shared.starRating.label'
      ? `${rating} of ${MAX_STARS}`
      : translated;
  });
}
