import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  forwardRef,
  HostListener,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { SOL_I18N } from '../../i18n/sol-i18n';
import { SolIconComponent } from '../icon/icon.component';
import { SolFloatingPanelDirective } from '../overlay/floating-panel.directive';

/** Vista activa del calendario dentro del popover. */
type DatePickerView = 'days' | 'months' | 'years';

/** Tamaño del campo disparador (md = alto de input estándar, sm = compacto). */
export type SolDatePickerSize = 'sm' | 'md';

/** Celda de la grilla de días (6 semanas × 7 días = 42 celdas fijas). */
interface DayCell {
  date: Date;
  iso: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  isFocused: boolean;
  disabled: boolean;
  aria: string;
}

/** Celda de la grilla de meses (12 celdas). */
interface MonthCell {
  index: number;
  label: string;
  isCurrent: boolean;
  isSelected: boolean;
  disabled: boolean;
}

/** Celda de la grilla de años (década + 1 antes/después = 12 celdas). */
interface YearCell {
  year: number;
  inDecade: boolean;
  isCurrent: boolean;
  isSelected: boolean;
  disabled: boolean;
}

// ── Helpers de fecha PUROS (calendario 100% propio, sin librerías) ──
// El picker trabaja con fechas LOCALES a medianoche y emite `yyyy-MM-dd`,
// el mismo formato date-only que boki-api y `@shared/lib` usan en tránsito,
// para nunca cruzar UTC (jamás `toISOString()`, que corre el día).

/** Fecha local a medianoche (descarta la hora). */
function midnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Primer día del mes de `d`, a medianoche. */
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** `d` desplazada `n` días (n puede ser negativo). */
function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** `d` desplazada `n` meses, apuntando al día 1. */
function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

/** `Date` local → `yyyy-MM-dd` sin pasar por UTC. */
function isoOf(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Igualdad a nivel de día (ignora la hora). */
function sameDay(a: Date | null, b: Date | null): boolean {
  return (
    !!a &&
    !!b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Primera letra en mayúscula (los nombres de Intl vienen en minúscula). */
function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/**
 * Normaliza el valor recibido (`Date`, `yyyy-MM-dd` u otras cadenas ISO,
 * `null`/`undefined`) a una fecha local a medianoche, o `null` si es vacío
 * o inválido.
 */
function parseInput(value: Date | string | null | undefined): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : midnight(value);
  }
  // Cadena: se toma la parte de fecha antes de una posible 'T' (ISO completo).
  const datePart = value.split('T')[0];
  const parts = datePart.split('-').map(Number);
  if (parts.length === 3 && parts.every(n => Number.isFinite(n))) {
    const [y, m, d] = parts;
    return new Date(y, m - 1, d);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : midnight(parsed);
}

// Dimensiones aproximadas del popover para el cálculo manual de viewport.
const POPOVER_HEIGHT = 340;
const POPOVER_WIDTH = 300;

/**
 * `sol-date-picker` — calendario propio del design system, tematizado con
 * tokens `--sol-*` (light/dark) y con tres vistas navegables:
 *
 *  1. DÍAS  — grilla del mes (semana lunes→domingo, convención es-CO), con
 *     desborde atenuado del mes anterior/siguiente; hoy marcado, seleccionado
 *     con fondo primario. El encabezado "Mes AAAA" promueve a la vista MESES.
 *  2. MESES — grilla 3×4 del año; el encabezado "AAAA" promueve a la vista AÑOS.
 *  3. AÑOS  — grilla de la década (12 años); elegir un año vuelve a MESES.
 *
 * Presentación: un campo de texto de solo lectura con ícono de calendario que,
 * al enfocar o hacer clic, abre un popover con posicionamiento manual (arriba
 * o abajo según el viewport), que cierra con clic-fuera o Escape. El popover
 * se portalea a `document.body` mediante la directiva compartida
 * `solFloatingPanel`, de modo que flota por encima de un `sol-modal` o un
 * `sol-drawer` sin que sus contenedores con `overflow` lo recorten.
 *
 * API dual: funciona como componente controlado (`value` + `valueChange`) y
 * como `ControlValueAccessor` (ngModel / reactive forms). Emite siempre
 * `yyyy-MM-dd` (fecha local, sin conversión de zona horaria), el mismo formato
 * date-only que usa el resto de la plataforma.
 *
 * NOTA: es un componente DISTINTO de `sol-day-picker` (tira horizontal de días
 * del flujo de reserva). Ambos conviven en el design system.
 */
@Component({
  selector: 'sol-date-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SolIconComponent, SolFloatingPanelDirective],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SolDatePickerComponent),
      multi: true,
    },
  ],
  template: `
    <div class="sol-date-picker" [class.sol-date-picker--sm]="size() === 'sm'">
      <!-- Campo disparador -->
      <div
        #field
        class="sol-date-picker__field"
        [class.sol-date-picker__field--open]="isOpen()"
        [class.sol-date-picker__field--disabled]="isDisabled()"
      >
        <input
          #trigger
          type="text"
          class="sol-date-picker__input"
          readonly
          [value]="displayText()"
          [attr.placeholder]="placeholderText()"
          [attr.aria-label]="triggerAria()"
          aria-haspopup="dialog"
          [attr.aria-expanded]="isOpen()"
          [disabled]="isDisabled()"
          (click)="open()"
          (focus)="onTriggerFocus()"
          (keydown)="onTriggerKeydown($event)"
          (blur)="onTouched()"
        />
        <button
          type="button"
          class="sol-date-picker__trigger-btn"
          tabindex="-1"
          [disabled]="isDisabled()"
          [attr.aria-label]="triggerAria()"
          (mousedown)="$event.preventDefault()"
          (click)="toggle()"
        >
          <sol-icon name="calendar" size="sm" />
        </button>
      </div>

      <!-- Popover: se portalea a document.body con position:fixed (directiva
           compartida solFloatingPanel) para que ningún ancestro con overflow
           o backdrop-filter lo recorte — típicamente .sol-modal-body o el
           cuerpo de un sol-drawer. Ancho propio (matchTriggerWidth:false) y
           alineación por el borde derecho cuando no cabe hacia la derecha. -->
      @if (isOpen()) {
        <div
          #pop
          class="sol-date-picker__pop"
          [solFloatingPanel]="field"
          [matchTriggerWidth]="false"
          [flipThreshold]="popoverHeight"
          [align]="alignEnd() ? 'end' : 'start'"
          (dropUpChange)="dropUp.set($event)"
          [class.sol-date-picker__pop--up]="dropUp()"
          role="dialog"
          [attr.aria-label]="dialogAria()"
          (keydown)="onPopoverKeydown($event)"
        >
          <!-- Encabezado con navegación -->
          <div class="sol-date-picker__header">
            <button
              type="button"
              class="sol-date-picker__nav"
              [attr.aria-label]="prevAria()"
              (click)="goPrev()"
            >
              <sol-icon name="chevron-left" size="sm" />
            </button>

            <button
              type="button"
              class="sol-date-picker__title"
              [disabled]="view() === 'years'"
              [attr.aria-label]="titleAria()"
              (click)="promoteView()"
            >
              {{ headerLabel() }}
            </button>

            <button
              type="button"
              class="sol-date-picker__nav"
              [attr.aria-label]="nextAria()"
              (click)="goNext()"
            >
              <sol-icon name="chevron-right" size="sm" />
            </button>
          </div>

          <!-- Vista DÍAS -->
          @if (view() === 'days') {
            <div class="sol-date-picker__weekdays" aria-hidden="true">
              @for (w of weekdayLabels(); track $index) {
                <span class="sol-date-picker__weekday">{{ w }}</span>
              }
            </div>
            <div class="sol-date-picker__grid" role="grid">
              @for (week of weeks(); track $index) {
                <div class="sol-date-picker__row" role="row">
                  @for (cell of week; track cell.iso) {
                    <button
                      type="button"
                      role="gridcell"
                      class="sol-date-picker__day"
                      [class.is-outside]="!cell.inMonth"
                      [class.is-today]="cell.isToday"
                      [class.is-selected]="cell.isSelected"
                      [class.is-focused]="cell.isFocused"
                      [attr.aria-selected]="cell.isSelected"
                      [attr.aria-label]="cell.aria"
                      [attr.tabindex]="cell.isFocused ? 0 : -1"
                      [disabled]="cell.disabled"
                      (click)="pickDay(cell.date)"
                    >
                      {{ cell.day }}
                    </button>
                  }
                </div>
              }
            </div>
          }

          <!-- Vista MESES -->
          @if (view() === 'months') {
            <div class="sol-date-picker__cells" role="grid">
              @for (m of months(); track m.index) {
                <button
                  type="button"
                  role="gridcell"
                  class="sol-date-picker__cell"
                  [class.is-today]="m.isCurrent"
                  [class.is-selected]="m.isSelected"
                  [attr.aria-selected]="m.isSelected"
                  [disabled]="m.disabled"
                  (click)="pickMonth(m.index)"
                >
                  {{ m.label }}
                </button>
              }
            </div>
          }

          <!-- Vista AÑOS (década) -->
          @if (view() === 'years') {
            <div class="sol-date-picker__cells" role="grid">
              @for (y of years(); track y.year) {
                <button
                  type="button"
                  role="gridcell"
                  class="sol-date-picker__cell"
                  [class.is-outside]="!y.inDecade"
                  [class.is-today]="y.isCurrent"
                  [class.is-selected]="y.isSelected"
                  [attr.aria-selected]="y.isSelected"
                  [disabled]="y.disabled"
                  (click)="pickYear(y.year)"
                >
                  {{ y.year }}
                </button>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      /* El campo comparte los tokens de input del tema (filled/outline/underline). */
      --sol-dp-bg: var(--sol-input-bg, var(--sol-bg-surface, #ffffff));
      --sol-dp-text: var(--sol-color-text-primary, #1e293b);
      --sol-dp-placeholder: var(--sol-color-text-muted, #94a3b8);
      --sol-dp-border: var(--sol-border-color-default, #cbd5e1);
      --sol-dp-border-focus: var(--sol-color-primary, #2563eb);
      --sol-dp-radius: var(--sol-input-radius, var(--sol-border-radius-md, 0.5rem));
      --sol-dp-border-width: var(--sol-border-width-default, 1px);
      --sol-dp-height: var(--sol-size-input-height, 2.5rem);
      --sol-dp-font-size: var(--sol-font-size-base, 0.875rem);
      --sol-dp-shadow: var(--sol-input-shadow, var(--sol-shadow-sm, 0 1px 2px rgba(0, 0, 0, 0.05)));
      --sol-dp-focus-ring: var(--sol-input-focus-ring, 0 0 0 3px color-mix(in srgb, var(--sol-color-primary, #2563eb) 40%, transparent));
      --sol-dp-transition: var(--sol-dur-fast, 150ms) var(--sol-ease, ease);
      --sol-dp-disabled-opacity: var(--sol-disabled-opacity, 0.55);
      --sol-dp-pop-bg: var(--sol-card-bg, var(--sol-bg-surface, #ffffff));
      --sol-dp-pop-radius: var(--sol-card-radius, var(--sol-border-radius-lg, 0.75rem));
      --sol-dp-pop-shadow: var(--sol-card-shadow, var(--sol-shadow-lg, 0 10px 25px rgba(0, 0, 0, 0.15)));
      --sol-dp-primary: var(--sol-color-primary, #2563eb);
      --sol-dp-hover: var(--sol-color-bg-hover, rgba(0, 0, 0, 0.04));
      --sol-dp-muted: var(--sol-color-text-muted, #94a3b8);
    }

    .sol-date-picker { position: relative; display: block; }

    /* ── Campo disparador ── */
    .sol-date-picker__field {
      display: flex;
      align-items: center;
      width: 100%;
      height: var(--sol-dp-height);
      background: var(--sol-dp-bg);
      border: var(--sol-input-border, var(--sol-dp-border-width) solid var(--sol-dp-border));
      border-radius: var(--sol-dp-radius);
      box-shadow: var(--sol-dp-shadow);
      transition: border-color var(--sol-dp-transition), box-shadow var(--sol-dp-transition);
    }
    .sol-date-picker--sm .sol-date-picker__field { height: 2rem; }
    .sol-date-picker__field--open,
    .sol-date-picker__field:focus-within {
      border: var(--sol-input-focus-border, var(--sol-dp-border-width) solid var(--sol-dp-border-focus));
      box-shadow: var(--sol-dp-focus-ring);
    }
    .sol-date-picker__field--disabled {
      cursor: not-allowed;
      opacity: var(--sol-dp-disabled-opacity);
    }

    .sol-date-picker__input {
      flex: 1;
      min-width: 0;
      height: 100%;
      padding: 0 0.5rem 0 var(--sol-space-sm, 0.75rem);
      border: none;
      background: transparent;
      color: var(--sol-dp-text);
      font-family: inherit;
      font-size: var(--sol-dp-font-size);
      cursor: pointer;
      outline: none;
    }
    .sol-date-picker--sm .sol-date-picker__input { font-size: var(--sol-font-size-sm, 0.8125rem); }
    .sol-date-picker__input::placeholder { color: var(--sol-dp-placeholder); }
    .sol-date-picker__input:disabled { cursor: not-allowed; }

    .sol-date-picker__trigger-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 0 0.5rem;
      border: none;
      background: transparent;
      color: var(--sol-dp-muted);
      cursor: pointer;
    }
    .sol-date-picker__trigger-btn:disabled { cursor: not-allowed; }

    /* ── Popover ──
       Base absolute como fallback; al portalearse recibe position:fixed y
       coordenadas inline calculadas del disparador. El z-index lo aporta la
       clase compartida .sol-floating-panel (directiva solFloatingPanel), que
       supera al del modal para no quedar debajo del overlay. */
    .sol-date-picker__pop {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      width: ${POPOVER_WIDTH}px;
      max-width: calc(100vw - 24px);
      padding: 0.625rem;
      background: var(--sol-dp-pop-bg);
      border: var(--sol-dp-border-width) solid var(--sol-dp-border);
      border-radius: var(--sol-dp-pop-radius);
      box-shadow: var(--sol-dp-pop-shadow);
      animation: sol-dp-fade var(--sol-dur-fast, 150ms) var(--sol-ease, ease-out);
    }
    .sol-date-picker__pop--up { top: auto; bottom: calc(100% + 4px); }

    /* ── Encabezado ── */
    .sol-date-picker__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.25rem;
      margin-bottom: 0.5rem;
    }
    .sol-date-picker__nav {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      border: none;
      border-radius: var(--sol-border-radius-md, 0.5rem);
      background: transparent;
      color: var(--sol-dp-text);
      cursor: pointer;
      transition: background var(--sol-dp-transition);
    }
    .sol-date-picker__nav:hover { background: var(--sol-dp-hover); }
    .sol-date-picker__title {
      flex: 1;
      height: 2rem;
      border: none;
      border-radius: var(--sol-border-radius-md, 0.5rem);
      background: transparent;
      color: var(--sol-dp-text);
      font-family: inherit;
      font-size: var(--sol-dp-font-size);
      font-weight: var(--sol-font-weight-bold, 600);
      cursor: pointer;
      transition: background var(--sol-dp-transition);
    }
    .sol-date-picker__title:hover:not(:disabled) { background: var(--sol-dp-hover); }
    .sol-date-picker__title:disabled { cursor: default; }

    /* ── Nombres de días de la semana ── */
    .sol-date-picker__weekdays {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      margin-bottom: 0.25rem;
    }
    .sol-date-picker__weekday {
      text-align: center;
      font-size: var(--sol-font-size-sm, 0.75rem);
      font-weight: 500;
      color: var(--sol-dp-muted);
      padding: 0.25rem 0;
    }

    /* ── Grilla de días ── */
    .sol-date-picker__grid { display: flex; flex-direction: column; gap: 2px; }
    .sol-date-picker__row { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }

    .sol-date-picker__day {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      aspect-ratio: 1 / 1;
      width: 100%;
      border: 1px solid transparent;
      border-radius: var(--sol-border-radius-md, 0.5rem);
      background: transparent;
      color: var(--sol-dp-text);
      font-family: inherit;
      font-size: var(--sol-dp-font-size);
      cursor: pointer;
      transition: background var(--sol-dp-transition), color var(--sol-dp-transition), border-color var(--sol-dp-transition);
    }
    .sol-date-picker__day:hover:not(:disabled):not(.is-selected) { background: var(--sol-dp-hover); }
    .sol-date-picker__day.is-outside { color: var(--sol-dp-muted); opacity: 0.6; }
    .sol-date-picker__day.is-today:not(.is-selected) { border-color: var(--sol-dp-primary); font-weight: 600; }
    .sol-date-picker__day.is-selected {
      background: var(--sol-dp-primary);
      border-color: var(--sol-dp-primary);
      color: #fff;
      font-weight: 600;
    }
    .sol-date-picker__day.is-focused:not(.is-selected) {
      outline: 2px solid var(--sol-dp-primary);
      outline-offset: -2px;
    }
    .sol-date-picker__day:disabled { opacity: 0.3; cursor: not-allowed; }

    /* ── Grilla de meses / años ── */
    .sol-date-picker__cells {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 4px;
    }
    .sol-date-picker__cell {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 3rem;
      border: 1px solid transparent;
      border-radius: var(--sol-border-radius-md, 0.5rem);
      background: transparent;
      color: var(--sol-dp-text);
      font-family: inherit;
      font-size: var(--sol-dp-font-size);
      cursor: pointer;
      transition: background var(--sol-dp-transition), color var(--sol-dp-transition), border-color var(--sol-dp-transition);
    }
    .sol-date-picker__cell:hover:not(:disabled):not(.is-selected) { background: var(--sol-dp-hover); }
    .sol-date-picker__cell.is-outside { color: var(--sol-dp-muted); opacity: 0.6; }
    .sol-date-picker__cell.is-today:not(.is-selected) { border-color: var(--sol-dp-primary); font-weight: 600; }
    .sol-date-picker__cell.is-selected {
      background: var(--sol-dp-primary);
      border-color: var(--sol-dp-primary);
      color: #fff;
      font-weight: 600;
    }
    .sol-date-picker__cell:disabled { opacity: 0.3; cursor: not-allowed; }

    @keyframes sol-dp-fade {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .sol-date-picker__pop--up { animation-name: sol-dp-fade-up; }
    @keyframes sol-dp-fade-up {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @media (prefers-reduced-motion: reduce) {
      .sol-date-picker__pop { animation: none; }
    }

    /* Evita el zoom automático de iOS Safari al enfocar (requiere font-size
       computado >= 16px). Ajuste defensivo: el campo es readonly (no abre
       teclado nativo), pero se protege igual por consistencia con el resto
       de átomos. Solo aplica en viewport móvil; no toca el token global
       --sol-font-size-base ni el font-size fuera de este breakpoint.
       Incluye el selector de la variante --sm (línea ~382): sin esa entrada,
       su especificidad de 2 clases ganaba sobre este bloque de 1 clase y
       el input quedaba en ~13px en móvil. */
    @media (max-width: 640px) {
      .sol-date-picker__input,
      .sol-date-picker--sm .sol-date-picker__input {
        font-size: 16px;
      }
    }
  `,
})
export class SolDatePickerComponent implements ControlValueAccessor {
  private readonly i18n = inject(SOL_I18N);
  private readonly hostEl = inject(ElementRef) as ElementRef<HTMLElement>;

  // ── API pública ──

  /** Valor seleccionado. Acepta `Date`, `yyyy-MM-dd`/ISO o `null`. */
  readonly value = input<Date | string | null>();

  /** Cota inferior seleccionable (fuera de rango queda deshabilitado). */
  readonly min = input<Date | string | null>();

  /** Cota superior seleccionable (fuera de rango queda deshabilitado). */
  readonly max = input<Date | string | null>();

  /** Placeholder del campo cuando no hay fecha; por defecto usa la clave i18n. */
  readonly placeholder = input<string>('');

  /** Deshabilita el campo (también lo hace `setDisabledState` de formularios). */
  readonly disabled = input<boolean>(false);

  /** Tamaño del campo disparador. */
  readonly size = input<SolDatePickerSize>('md');

  /** Emite la fecha elegida como `yyyy-MM-dd` (fecha local, sin UTC). */
  readonly valueChange = output<string>();

  // ── Estado interno ──

  private readonly triggerRef = viewChild<ElementRef<HTMLInputElement>>('trigger');

  /** Popover mientras vive portaleado en document.body (fuera del host). */
  private readonly popRef = viewChild<ElementRef<HTMLElement>>('pop');

  /** Alto estimado del popover; umbral de volteo que consume la directiva. */
  readonly popoverHeight = POPOVER_HEIGHT;

  /** Fecha seleccionada canónica (fuente de verdad del display). */
  private readonly selected = signal<Date | null>(null);

  /** Deshabilitado impuesto por el formulario (CVA). */
  private readonly formDisabled = signal(false);

  /** Mes/año que se está mostrando en la grilla. */
  private readonly viewDate = signal<Date>(startOfMonth(new Date()));

  /** Día con foco de teclado dentro de la vista DÍAS. */
  private readonly focusedDate = signal<Date | null>(null);

  readonly view = signal<DatePickerView>('days');
  readonly isOpen = signal(false);
  readonly dropUp = signal(false);
  readonly alignEnd = signal(false);

  /** Suprime la apertura por foco al devolver el foco tras cerrar el popover. */
  private suppressFocusOpen = false;

  /** Hoy a medianoche, fijo durante la vida del componente. */
  private readonly today = midnight(new Date());

  // ── i18n (textos estáticos; nombres de mes/día vienen de Intl) ──
  private readonly placeholderKey = this.i18n.t('shared.datePicker.placeholder');
  private readonly triggerAriaKey = this.i18n.t('shared.datePicker.trigger');
  private readonly dialogAriaKey = this.i18n.t('shared.datePicker.dialog');
  private readonly prevAriaKey = this.i18n.t('shared.datePicker.prev');
  private readonly nextAriaKey = this.i18n.t('shared.datePicker.next');
  private readonly titleAriaKey = this.i18n.t('shared.datePicker.chooseView');

  readonly placeholderText = computed(() => this.placeholder() || this.placeholderKey());
  readonly triggerAria = this.triggerAriaKey;
  readonly dialogAria = this.dialogAriaKey;
  readonly prevAria = this.prevAriaKey;
  readonly nextAria = this.nextAriaKey;
  readonly titleAria = this.titleAriaKey;

  // ── Callbacks de ControlValueAccessor ──
  onChange: (value: string) => void = () => {};
  onTouched: () => void = () => {};

  constructor() {
    // Sincroniza el input `value` → estado interno SOLO cuando está enlazado
    // (undefined = no enlazado, p. ej. en modo reactive forms donde manda CVA).
    effect(() => {
      const v = this.value();
      if (v === undefined) return;
      this.selected.set(parseInput(v));
    });
  }

  // ── Derivados ──

  /** Locale efectivo (reactivo al idioma activo); es-CO por defecto. */
  private readonly locale = computed(() => this.i18n.activeLang() || 'es-CO');

  readonly isDisabled = computed(() => this.disabled() || this.formDisabled());

  private readonly minDate = computed(() => parseInput(this.min()));
  private readonly maxDate = computed(() => parseInput(this.max()));

  /** Texto del campo: fecha seleccionada formateada (dd/mm/aaaa) o vacío. */
  readonly displayText = computed(() => {
    const d = this.selected();
    if (!d) return '';
    return new Intl.DateTimeFormat(this.locale(), {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d);
  });

  /** Nombres cortos de los 7 días, empezando en lunes (convención es-CO). */
  readonly weekdayLabels = computed(() => {
    const fmt = new Intl.DateTimeFormat(this.locale(), { weekday: 'short' });
    // 2023-01-02 es lunes: se recorre una semana completa desde ahí.
    return Array.from({ length: 7 }, (_, i) => {
      const label = fmt.format(new Date(2023, 0, 2 + i)).replace(/\.$/, '');
      return capitalize(label);
    });
  });

  /** Etiqueta del encabezado según la vista activa. */
  readonly headerLabel = computed(() => {
    const view = this.view();
    const vd = this.viewDate();
    if (view === 'days') {
      const month = new Intl.DateTimeFormat(this.locale(), { month: 'long' }).format(vd);
      return `${capitalize(month)} ${vd.getFullYear()}`;
    }
    if (view === 'months') {
      return `${vd.getFullYear()}`;
    }
    const base = Math.floor(vd.getFullYear() / 10) * 10;
    return `${base} – ${base + 9}`;
  });

  /** 42 celdas de día (6 semanas), agrupadas en filas de 7. */
  readonly weeks = computed<DayCell[][]>(() => {
    const vd = this.viewDate();
    const sel = this.selected();
    const focus = this.focusedDate();
    const min = this.minDate();
    const max = this.maxDate();
    const ariaFmt = new Intl.DateTimeFormat(this.locale(), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const first = startOfMonth(vd);
    // Desplazamiento hasta el lunes de la primera semana visible.
    const offsetToMonday = (first.getDay() + 6) % 7;
    const gridStart = addDays(first, -offsetToMonday);

    const rows: DayCell[][] = [];
    for (let week = 0; week < 6; week++) {
      const row: DayCell[] = [];
      for (let d = 0; d < 7; d++) {
        const date = addDays(gridStart, week * 7 + d);
        row.push({
          date,
          iso: isoOf(date),
          day: date.getDate(),
          inMonth: date.getMonth() === vd.getMonth(),
          isToday: sameDay(date, this.today),
          isSelected: sameDay(date, sel),
          isFocused: sameDay(date, focus),
          disabled: this.outOfRange(date, min, max),
          aria: capitalize(ariaFmt.format(date)),
        });
      }
      rows.push(row);
    }
    return rows;
  });

  /** 12 meses del año en curso de la vista. */
  readonly months = computed<MonthCell[]>(() => {
    const vd = this.viewDate();
    const sel = this.selected();
    const min = this.minDate();
    const max = this.maxDate();
    const year = vd.getFullYear();
    const fmt = new Intl.DateTimeFormat(this.locale(), { month: 'short' });

    return Array.from({ length: 12 }, (_, index) => {
      const monthStart = new Date(year, index, 1);
      const monthEnd = new Date(year, index + 1, 0);
      return {
        index,
        label: capitalize(fmt.format(monthStart).replace(/\.$/, '')),
        isCurrent: year === this.today.getFullYear() && index === this.today.getMonth(),
        isSelected: !!sel && sel.getFullYear() === year && sel.getMonth() === index,
        // Deshabilitado si el mes completo queda fuera del rango permitido.
        disabled: (!!max && monthStart > max) || (!!min && monthEnd < min),
      };
    });
  });

  /** 12 años: la década más un año antes y otro después (atenuados). */
  readonly years = computed<YearCell[]>(() => {
    const vd = this.viewDate();
    const sel = this.selected();
    const min = this.minDate();
    const max = this.maxDate();
    const base = Math.floor(vd.getFullYear() / 10) * 10;

    return Array.from({ length: 12 }, (_, i) => {
      const year = base - 1 + i;
      const yearStart = new Date(year, 0, 1);
      const yearEnd = new Date(year, 11, 31);
      return {
        year,
        inDecade: year >= base && year <= base + 9,
        isCurrent: year === this.today.getFullYear(),
        isSelected: !!sel && sel.getFullYear() === year,
        disabled: (!!max && yearStart > max) || (!!min && yearEnd < min),
      };
    });
  });

  // ── Apertura / cierre ──

  toggle(): void {
    if (this.isDisabled()) return;
    this.isOpen() ? this.close() : this.open();
  }

  /** Abre por foco, salvo cuando el foco proviene de un cierre programático. */
  onTriggerFocus(): void {
    if (this.suppressFocusOpen) {
      this.suppressFocusOpen = false;
      return;
    }
    this.open();
  }

  open(): void {
    if (this.isDisabled() || this.isOpen()) return;
    this.isOpen.set(true);
    this.view.set('days');
    const base = this.selected() ?? this.clampToRange(this.today);
    this.viewDate.set(startOfMonth(base));
    this.focusedDate.set(this.clampToRange(base));
    this.positionPopover();
    this.focusActiveCellSoon();
  }

  close(): void {
    if (!this.isOpen()) return;
    this.isOpen.set(false);
    this.onTouched();
  }

  /** Cierra al hacer clic fuera del componente. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isOpen()) return;
    const target = event.target as Node;
    const insideHost = this.hostEl.nativeElement.contains(target);
    // El popover vive portaleado en document.body: también cuenta como "dentro".
    const insidePop = this.popRef()?.nativeElement.contains(target) ?? false;
    if (!insideHost && !insidePop) {
      this.close();
    }
  }

  /**
   * Decide la alineación horizontal antes de abrir: si el popover no cabe
   * hacia la derecha del disparador, se ancla por su borde derecho. El eje
   * vertical (volteo `dropUp`) lo resuelve la directiva `solFloatingPanel`,
   * que además reposiciona en scroll y resize.
   */
  private positionPopover(): void {
    const rect = this.hostEl.nativeElement.getBoundingClientRect();
    this.alignEnd.set(rect.left + POPOVER_WIDTH > window.innerWidth);
  }

  // ── Navegación del encabezado ──

  goPrev(): void {
    const view = this.view();
    if (view === 'days') this.viewDate.update(d => addMonths(d, -1));
    else if (view === 'months') this.viewDate.update(d => new Date(d.getFullYear() - 1, d.getMonth(), 1));
    else this.viewDate.update(d => new Date(d.getFullYear() - 10, d.getMonth(), 1));
  }

  goNext(): void {
    const view = this.view();
    if (view === 'days') this.viewDate.update(d => addMonths(d, 1));
    else if (view === 'months') this.viewDate.update(d => new Date(d.getFullYear() + 1, d.getMonth(), 1));
    else this.viewDate.update(d => new Date(d.getFullYear() + 10, d.getMonth(), 1));
  }

  /** Promueve la vista: días → meses → años. */
  promoteView(): void {
    const view = this.view();
    if (view === 'days') this.view.set('months');
    else if (view === 'months') this.view.set('years');
  }

  // ── Selección ──

  pickDay(date: Date): void {
    if (this.outOfRange(date, this.minDate(), this.maxDate())) return;
    this.selected.set(midnight(date));
    this.viewDate.set(startOfMonth(date));
    const iso = isoOf(date);
    this.onChange(iso);
    this.valueChange.emit(iso);
    this.onTouched();
    this.close();
    this.focusTrigger();
  }

  pickMonth(index: number): void {
    this.viewDate.update(d => new Date(d.getFullYear(), index, 1));
    this.view.set('days');
    this.focusedDate.set(this.clampToRange(this.viewDate()));
    this.focusActiveCellSoon();
  }

  pickYear(year: number): void {
    this.viewDate.update(d => new Date(year, d.getMonth(), 1));
    this.view.set('months');
  }

  // ── Teclado ──

  onTriggerKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.open();
    }
  }

  onPopoverKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      this.focusTrigger();
      return;
    }
    // La navegación por flechas aplica a la vista DÍAS.
    if (this.view() !== 'days') return;

    const current = this.focusedDate() ?? this.clampToRange(this.today);
    let next: Date | null = null;

    switch (event.key) {
      case 'ArrowLeft': next = addDays(current, -1); break;
      case 'ArrowRight': next = addDays(current, 1); break;
      case 'ArrowUp': next = addDays(current, -7); break;
      case 'ArrowDown': next = addDays(current, 7); break;
      case 'Home': next = addDays(current, -((current.getDay() + 6) % 7)); break; // lunes
      case 'End': next = addDays(current, 6 - ((current.getDay() + 6) % 7)); break; // domingo
      case 'PageUp': next = addMonths(current, -1); break;
      case 'PageDown': next = addMonths(current, 1); break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        this.pickDay(current);
        return;
      default:
        return;
    }

    event.preventDefault();
    this.focusedDate.set(next);
    // Sigue el foco si cruza el mes visible.
    if (next.getMonth() !== this.viewDate().getMonth() || next.getFullYear() !== this.viewDate().getFullYear()) {
      this.viewDate.set(startOfMonth(next));
    }
    this.focusActiveCellSoon();
  }

  // ── ControlValueAccessor ──

  writeValue(value: Date | string | null): void {
    this.selected.set(parseInput(value));
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.formDisabled.set(isDisabled);
  }

  // ── Utilidades internas ──

  /** True si `date` está fuera del rango `[min, max]` (comparación por día). */
  private outOfRange(date: Date, min: Date | null, max: Date | null): boolean {
    const d = midnight(date).getTime();
    if (min && d < min.getTime()) return true;
    if (max && d > max.getTime()) return true;
    return false;
  }

  /** Ajusta `date` dentro de `[min, max]` para arrancar el foco en un día válido. */
  private clampToRange(date: Date): Date {
    const min = this.minDate();
    const max = this.maxDate();
    if (min && midnight(date) < min) return midnight(min);
    if (max && midnight(date) > max) return midnight(max);
    return midnight(date);
  }

  /** Devuelve el foco al campo sin re-disparar la apertura por foco. */
  private focusTrigger(): void {
    this.suppressFocusOpen = true;
    this.triggerRef()?.nativeElement?.focus();
    this.suppressFocusOpen = false;
  }

  /** Enfoca la celda con foco tras el próximo render (roving tabindex). */
  private focusActiveCellSoon(): void {
    setTimeout(() => {
      // Se busca dentro del popover, no del host: al portalearse deja de ser
      // descendiente de `<sol-date-picker>`.
      const cell = this.popRef()?.nativeElement.querySelector(
        '.sol-date-picker__day.is-focused',
      ) as HTMLButtonElement | null;
      cell?.focus();
    });
  }
}
