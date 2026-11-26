import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  forwardRef,
  HostListener,
  inject,
  Injector,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { SolIconComponent } from '../icon/icon.component';
import { SolFloatingPanelDirective } from '../overlay/floating-panel.directive';
import { injectSolI18n } from '../../i18n/inject-sol-i18n';

export interface SolSelectOption {
  value: string;
  label: string;
}

/** Minúsculas y sin tildes: «bogota» encuentra «Bogotá». */
function foldText(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/**
 * Se usa de dos formas:
 * - **Formulario:** `ngModel` o `formControl` (ControlValueAccessor).
 * - **Controlado:** `[value]` y `(valueChange)`. El valor llega en la primera
 *   pintada, sin esperar la escritura asíncrona de `ngModel`, así que también
 *   queda bien en el HTML prerenderizado. Lo que se muestra sigue siempre a
 *   `[value]`: si el dueño no lo cambia, el select conserva el valor anterior.
 *
 * Teclado (patrón de botón + listbox): flechas, Inicio y Fin mueven la opción
 * activa; Enter la elige; Esc cierra y devuelve el foco al botón. Con buscador
 * el foco queda en su campo; sin él, en la lista. En pantalla táctil el foco va
 * siempre a la lista, para que el teclado no la tape. Con texto escrito en el
 * buscador, Inicio y Fin vuelven a mover el cursor dentro del texto.
 *
 * El botón toma su nombre de `label`, de `ariaLabel` o de un `<label>` que lo
 * envuelva.
 */
@Component({
  selector: 'sol-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SolIconComponent, SolFloatingPanelDirective],
  host: {
    '[class.sol-select--touch]': 'touchViewport()',
  },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SolSelectComponent),
      multi: true,
    },
  ],
  template: `
    @if (label()) {
      <label class="sol-select__label" [attr.for]="triggerId">{{ label() }}</label>
    }

    <div class="sol-select__wrapper" #wrapper>
      <!-- Trigger button -->
      <button
        #triggerBtn
        type="button"
        [id]="triggerId"
        [class]="triggerClass()"
        [disabled]="disabled()"
        aria-haspopup="listbox"
        [attr.aria-label]="triggerAriaLabel()"
        [attr.aria-expanded]="isOpen()"
        [attr.aria-controls]="isOpen() ? panelId : null"
        (click)="toggleDropdown()"
        (keydown)="onKeydown($event)"
        (blur)="onBlur()"
      >
        <span class="sol-select__display" [class.sol-select__display--placeholder]="!displayText()">
          {{ displayText() || placeholderText() }}
        </span>
        <sol-icon name="chevron-down" variant="fill" class="sol-select__arrow" [class.sol-select__arrow--open]="isOpen()" />
      </button>

      <!-- Panel del dropdown: al abrirse se portalea a document.body con
           position:fixed (CP-2, directiva compartida solFloatingPanel) para
           que ningún ancestro con overflow lo recorte (ej. .sol-modal-body).
           El trigger queda enlazado por aria-controls porque input y listbox
           viven en árboles distintos. -->
      @if (isOpen()) {
        <div
          #dropdownPanel
          class="sol-select__dropdown"
          [solFloatingPanel]="triggerBtn"
          (dropUpChange)="dropUp.set($event)"
          (keydown)="onKeydown($event)"
          [class.sol-select__dropdown--up]="dropUp()"
          [class.sol-select__dropdown--touch]="touchViewport()"
        >
          <!-- Search -->
          @if (searchable()) {
            <div class="sol-select__search-box">
              <input
                #searchInput
                type="text"
                class="sol-select__search"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded="true"
                [attr.aria-controls]="panelId"
                [attr.aria-activedescendant]="activeOptionId()"
                [attr.aria-label]="searchPlaceholderText()"
                [placeholder]="searchPlaceholderText()"
                [value]="searchTerm()"
                (input)="onSearchInput($event)"
              />
            </div>
          }

          <!-- Select all / none for multi -->
          @if (multiple()) {
            <div class="sol-select__bulk-actions">
              <button type="button" class="sol-select__bulk-btn" (click)="selectAll()">{{ selectAllText() }}</button>
              <button type="button" class="sol-select__bulk-btn" (click)="selectNone()">{{ selectNoneText() }}</button>
            </div>
          }

          <!-- Options (en modo single, "Todos" va primero: actúa como limpiar) -->
          <div
            #listbox
            class="sol-select__options"
            role="listbox"
            tabindex="-1"
            [id]="panelId"
            [attr.aria-labelledby]="triggerId"
            [attr.aria-multiselectable]="multiple() || null"
            [attr.aria-activedescendant]="searchable() && !touchViewport() ? null : activeOptionId()"
          >
            @for (opt of navItems(); track opt.value; let index = $index) {
              <div
                class="sol-select__option"
                role="option"
                [id]="optionId(index)"
                [class.sol-select__option--active]="isSelected(opt.value)"
                [class.sol-select__option--focused]="index === activeIndex()"
                [attr.aria-selected]="isSelected(opt.value)"
                (mousemove)="activeIndex.set(index)"
                (click)="onOptionClick(opt.value)"
              >
                @if (multiple()) {
                  <span class="sol-select__check" [class.sol-select__check--checked]="isSelected(opt.value)">
                    @if (isSelected(opt.value)) { &#10003; }
                  </span>
                }
                {{ opt.label }}
              </div>
            }
          </div>
          @if (filteredOptions().length === 0) {
            <div class="sol-select__empty" role="status">{{ emptyText() }}</div>
          }
        </div>
      }
    </div>

    @if (error()) {
      <p class="sol-select__error">{{ error() }}</p>
    }
  `,
  styles: `
    :host {
      display: block;
    }

    /* Los tokens se declaran también sobre .sol-select__dropdown porque el
       panel se portalea a document.body (CP-2) y deja de heredar del :host.
       Todos referencian tokens globales --sol-* definidos en :root, así que
       el panel portaleado sigue tematizado en light y dark. */
    :host,
    .sol-select__dropdown {
      /* v2: el trigger comparte los tokens de input del tema (filled/outline/underline). */
      --sol-select-bg: var(--sol-input-bg, var(--sol-bg-surface, #ffffff));
      --sol-select-text: var(--sol-color-text-primary, #1e293b);
      --sol-select-placeholder: var(--sol-color-text-muted, #94a3b8);
      --sol-select-border: var(--sol-border-color-default, #cbd5e1);
      --sol-select-border-focus: var(--sol-color-primary, #6366f1);
      --sol-select-error-color: var(--sol-color-danger, #ef4444);
      --sol-select-label-color: var(--sol-color-text-secondary, #475569);
      --sol-select-arrow-color: var(--sol-color-text-muted, #94a3b8);
      --sol-select-disabled-opacity: var(--sol-disabled-opacity, 0.55);
      --sol-select-radius: var(--sol-input-radius, var(--sol-border-radius-md, 0.5rem));
      --sol-select-border-width: var(--sol-border-width-default, 1px);
      --sol-select-padding-x: var(--sol-space-sm, 0.75rem);
      --sol-select-height: var(--sol-size-input-height, 2.5rem);
      --sol-select-font-size: var(--sol-font-size-base, 0.875rem);
      --sol-select-label-font-size: var(--sol-font-size-sm, 0.75rem);
      --sol-select-label-font-weight: var(--sol-font-weight-bold, 600);
      --sol-select-shadow: var(--sol-input-shadow, var(--sol-shadow-sm, 0 1px 2px rgba(0,0,0,0.05)));
      --sol-select-focus-ring: var(--sol-input-focus-ring, 0 0 0 3px color-mix(in srgb, var(--sol-color-primary, #6366f1) 40%, transparent));
      --sol-select-transition: var(--sol-dur-fast, 150ms) var(--sol-ease, ease);
      --sol-select-dropdown-bg: var(--sol-bg-surface, #ffffff);
      --sol-select-option-hover: var(--sol-color-bg-hover, color-mix(in srgb, var(--sol-color-text-primary, #1e293b) 7%, transparent));
      --sol-select-option-active-bg: color-mix(in srgb, var(--sol-color-primary, #6366f1) 12%, transparent);
      --sol-select-option-active-text: var(--sol-color-primary, #6366f1);
    }

    .sol-select__label {
      display: block;
      margin-bottom: 0.375rem;
      font-size: var(--sol-select-label-font-size);
      font-weight: var(--sol-select-label-font-weight);
      color: var(--sol-select-label-color);
      line-height: 1.4;
    }

    .sol-select__wrapper { position: relative; display: block; }

    .sol-select__trigger {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      height: var(--sol-select-height);
      padding: 0 var(--sol-select-padding-x);
      font-family: inherit;
      font-size: var(--sol-select-font-size);
      color: var(--sol-select-text);
      background-color: var(--sol-select-bg);
      border: var(--sol-input-border, var(--sol-select-border-width) solid var(--sol-select-border));
      border-radius: var(--sol-select-radius);
      box-shadow: var(--sol-select-shadow);
      cursor: pointer;
      transition: border-color var(--sol-select-transition), box-shadow var(--sol-select-transition);
      text-align: left;
    }
    .sol-select__trigger:focus { outline: none; border: var(--sol-input-focus-border, var(--sol-select-border-width) solid var(--sol-select-border-focus)); box-shadow: var(--sol-select-focus-ring); }
    .sol-select__trigger:disabled { cursor: not-allowed; opacity: var(--sol-select-disabled-opacity); }
    .sol-select__trigger--error { border-color: var(--sol-select-error-color); }
    .sol-select__trigger--open { border: var(--sol-input-focus-border, var(--sol-select-border-width) solid var(--sol-select-border-focus)); box-shadow: var(--sol-select-focus-ring); }

    /* min-width: 0 overrides the flex min-width:auto floor so the trigger can
       shrink inside narrow containers instead of overflowing them. */
    .sol-select__display { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sol-select__display--placeholder { color: var(--sol-select-placeholder); }

    .sol-select__arrow {
      width: 1.25rem; height: 1.25rem; flex-shrink: 0;
      color: var(--sol-select-arrow-color);
      transition: transform var(--sol-select-transition);
    }
    .sol-select__arrow--open { transform: rotate(180deg); }

    .sol-select__dropdown {
      /* Base absolute como fallback; al portalearse recibe position:fixed y
         coordenadas inline calculadas del trigger. El z-index lo aporta la
         clase compartida .sol-floating-panel (directiva solFloatingPanel),
         que supera al del modal para no quedar debajo del overlay. */
      position: absolute;
      top: calc(100% + 4px);
      left: 0; right: 0;
      background: var(--sol-select-dropdown-bg);
      border: var(--sol-select-border-width) solid var(--sol-select-border);
      border-radius: var(--sol-select-radius);
      box-shadow: var(--sol-shadow-lg, 0 10px 25px rgba(0,0,0,0.15));
      max-height: 280px;
      display: flex;
      flex-direction: column;
      animation: sol-select-fade 0.12s ease-out;
    }

    .sol-select__search-box { padding: 0.5rem; border-bottom: 1px solid var(--sol-select-border); }
    .sol-select__search {
      width: 100%;
      height: 2rem;
      padding: 0 0.5rem;
      font-family: inherit;
      font-size: var(--sol-select-font-size);
      color: var(--sol-select-text);
      background: var(--sol-select-bg);
      border: var(--sol-select-border-width) solid var(--sol-select-border);
      border-radius: calc(var(--sol-select-radius) - 2px);
      outline: none;
    }
    .sol-select__search:focus { border-color: var(--sol-select-border-focus); }

    .sol-select__bulk-actions {
      display: flex;
      gap: 0.25rem;
      padding: 0.375rem 0.5rem;
      border-bottom: 1px solid var(--sol-select-border);
    }
    .sol-select__bulk-btn {
      flex: 1;
      padding: 0.25rem;
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: var(--sol-select-option-active-text);
      background: transparent;
      border: 1px solid var(--sol-select-border);
      border-radius: calc(var(--sol-select-radius) - 2px);
      cursor: pointer;
      transition: background var(--sol-select-transition);
    }
    .sol-select__bulk-btn:hover { background: var(--sol-select-option-hover); }

    .sol-select__options { overflow-y: auto; flex: 1; padding: 0.25rem 0; }
    .sol-select__options:focus { outline: none; }

    .sol-select__option {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      font-size: var(--sol-select-font-size);
      color: var(--sol-select-text);
      cursor: pointer;
      transition: background var(--sol-select-transition);
    }
    .sol-select__option:hover { background: var(--sol-select-option-hover); }
    .sol-select__option--active { background: var(--sol-select-option-active-bg); color: var(--sol-select-option-active-text); font-weight: 500; }
    /* La opción activa (teclado o puntero), aparte de la elegida. */
    .sol-select__option--focused { box-shadow: inset 0 0 0 2px var(--sol-select-border-focus); }

    .sol-select__check {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1rem; height: 1rem;
      border: 2px solid var(--sol-select-border);
      border-radius: 3px;
      font-size: 0.65rem;
      flex-shrink: 0;
    }
    .sol-select__check--checked {
      background: var(--sol-select-option-active-text);
      border-color: var(--sol-select-option-active-text);
      color: #fff;
    }

    .sol-select__empty {
      padding: 0.75rem;
      text-align: center;
      color: var(--sol-select-placeholder);
      font-size: var(--sol-select-font-size);
    }

    .sol-select__error {
      margin: 0.25rem 0 0;
      font-size: var(--sol-select-label-font-size);
      color: var(--sol-select-error-color);
      line-height: 1.4;
    }

    .sol-select__dropdown--up {
      top: auto;
      bottom: calc(100% + 4px);
      animation: sol-select-fade-up 0.12s ease-out;
    }

    @keyframes sol-select-fade {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes sol-select-fade-up {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Evita el zoom automático de iOS Safari al enfocar el buscador interno
       (requiere font-size computado >= 16px). El trigger (<button>) no
       dispara zoom, pero se sube a 16px por paridad visual. Solo aplica en
       viewport móvil; no toca el token global --sol-font-size-base ni el
       font-size fuera de este breakpoint. */
    @media (max-width: 640px) {
      .sol-select__search,
      .sol-select__trigger {
        font-size: 16px;
      }

      /* Objetivo táctil de al menos 44 px en el celular. */
      .sol-select__option {
        min-height: 44px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .sol-select__dropdown,
      .sol-select__dropdown--up {
        animation: none;
      }

      .sol-select__arrow {
        transition: none;
      }
    }

    /* Corte configurable (0.6.0, input mobileBreakpoint): el host que corta su
       layout móvil por encima de 640px (p. ej. 768px) extiende la misma
       protección anti-zoom hasta su propio breakpoint, sin ::ng-deep. La
       clase la pone el componente según el ancho del viewport. */
    :host(.sol-select--touch) .sol-select__trigger,
    .sol-select__dropdown--touch .sol-select__search {
      font-size: var(--sol-font-size-touch-input, 16px);
    }

    /* Touch viewport: bottom sheet instead of a panel under the trigger, so the keyboard
       and the screen edge never cut the list. !important overrides the inline coordinates
       that solFloatingPanel writes for the desktop panel. */
    .sol-select__dropdown--touch {
      position: fixed !important;
      top: auto !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      width: 100% !important;
      max-height: 70dvh;
      border-radius: var(--sol-border-radius-lg, 1rem) var(--sol-border-radius-lg, 1rem) 0 0;
      padding-bottom: env(safe-area-inset-bottom, 0px);
      animation: sol-select-sheet-up 0.18s ease-out;
    }
    .sol-select__dropdown--touch .sol-select__option {
      min-height: 44px;
      display: flex;
      align-items: center;
      font-size: 16px;
    }
    @keyframes sol-select-sheet-up {
      from { transform: translateY(16px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    @media (prefers-reduced-motion: reduce) {
      .sol-select__dropdown--touch { animation: none; }
    }
  `,
})
export class SolSelectComponent implements ControlValueAccessor {
  /** Placeholder text when nothing is selected. */
  readonly placeholder = input<string | undefined>(undefined);
  /** Label displayed above the select. */
  readonly label = input<string>('');
  /** Error message below. */
  readonly error = input<string>('');
  /** Whether the select is disabled. */
  readonly disabled = input<boolean>(false);
  /** Enable search filtering. */
  readonly searchable = input<boolean>(true);
  /** Enable multi-selection mode. */
  readonly multiple = input<boolean>(false);
  /** Options array — use this instead of ng-content for searchable/multi. */
  readonly options = input<SolSelectOption[]>([]);
  /** Show an "All" / clear option in single mode. */
  readonly showAllOption = input<boolean>(false);
  /** Label for the "all" option in single mode (default `shared.select.all`). */
  readonly allOptionLabel = input<string | undefined>(undefined);
  /** Accessible name of the trigger when no `label` or wrapping `<label>` gives one. */
  readonly ariaLabel = input<string>('');
  /** Placeholder (and accessible name) of the search input. */
  readonly searchPlaceholder = input<string | undefined>(undefined);
  /** Message when the search matches nothing (default `shared.select.empty`). */
  readonly emptyLabel = input<string | undefined>(undefined);
  /** Controlled value in single mode: use it with `(valueChange)` instead of a form binding. */
  readonly value = input<string | null | undefined>(undefined);

  /** The person picked a value (single mode). */
  readonly valueChange = output<string>();

  /**
   * Viewport width (px) at or below which the trigger and the inner search
   * rise to 16px to avoid iOS Safari auto-zoom. The CSS baseline keeps
   * protecting viewports up to 640px without JavaScript; a larger value
   * (e.g. 768 for hosts whose mobile layout starts there) extends it.
   */
  readonly mobileBreakpoint = input<number>(640);

  /** Current viewport width, refreshed on `window:resize`. */
  private readonly viewportWidth = signal(SolSelectComponent.readViewportWidth());

  /** True when the viewport is within `mobileBreakpoint` (drives the touch classes). */
  readonly touchViewport = computed(() => {
    const width = this.viewportWidth();
    return width > 0 && width <= this.mobileBreakpoint();
  });

  // ── Internal state ──
  readonly isOpen = signal(false);
  readonly dropUp = signal(false);
  readonly searchTerm = signal('');
  readonly singleValue = linkedSignal<string>(() => this.value() ?? '');
  readonly multiValues = signal<Set<string>>(new Set());
  /** Opción activa dentro de `navItems`; -1 si no hay ninguna. */
  readonly activeIndex = signal(-1);

  readonly triggerBtn = viewChild<ElementRef<HTMLButtonElement>>('triggerBtn');
  readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  readonly dropdownPanel = viewChild<ElementRef<HTMLElement>>('dropdownPanel');
  readonly listbox = viewChild<ElementRef<HTMLElement>>('listbox');

  /** Ids únicos: enlazan el trigger (aria-controls) con el listbox portaleado. */
  private static nextId = 0;
  private readonly uid = SolSelectComponent.nextId++;
  readonly panelId = `sol-select-panel-${this.uid}`;
  readonly triggerId = `sol-select-trigger-${this.uid}`;

  private readonly injector = inject(Injector);
  private readonly i18n = injectSolI18n();

  // Visible texts: an explicit input always wins (even ''); otherwise the shared.select.* key.
  readonly placeholderText = computed(() => this.text(this.placeholder(), 'shared.select.placeholder'));
  readonly searchPlaceholderText = computed(() => this.text(this.searchPlaceholder(), 'shared.select.searchPlaceholder'));
  readonly emptyText = computed(() => this.text(this.emptyLabel(), 'shared.select.empty'));
  readonly allOptionText = computed(() => this.text(this.allOptionLabel(), 'shared.select.all'));
  readonly selectAllText = computed(() => this.text(undefined, 'shared.select.selectAll'));
  readonly selectNoneText = computed(() => this.text(undefined, 'shared.select.selectNone'));

  private text(override: string | undefined, key: string): string {
    this.i18n.activeLang();
    return override ?? this.i18n.translate(key);
  }

  readonly filteredOptions = computed(() => {
    const term = foldText(this.searchTerm());
    const opts = this.options();
    if (!term) return opts;
    return opts.filter(o => foldText(o.label).includes(term));
  });

  /** Lo que se recorre con el teclado: la opción "Todos" (si hay) y las filtradas. */
  readonly navItems = computed<SolSelectOption[]>(() => {
    const filtered = this.filteredOptions();
    return !this.multiple() && this.showAllOption()
      ? [{ value: '', label: this.allOptionText() }, ...filtered]
      : filtered;
  });

  readonly activeOptionId = computed(() => {
    const index = this.activeIndex();
    return this.isOpen() && index >= 0 && index < this.navItems().length ? this.optionId(index) : null;
  });

  /** `ariaLabel` tapa el contenido del botón: el valor vigente se repite en el nombre. */
  readonly triggerAriaLabel = computed(() => {
    const name = this.ariaLabel();
    if (!name) return null;
    const text = this.displayText();
    return text ? `${name}: ${text}` : name;
  });

  readonly displayText = computed(() => {
    if (this.multiple()) {
      const selected = this.multiValues();
      if (selected.size === 0) return '';
      if (selected.size === this.options().length) return this.allOptionText();
      const labels = this.options()
        .filter(o => selected.has(o.value))
        .map(o => o.label);
      return labels.join(', ');
    }
    const val = this.singleValue();
    // Una opción con valor '' («Cualquier lugar») también se muestra por su nombre.
    return this.options().find(o => o.value === val)?.label ?? val;
  });

  readonly triggerClass = computed(() => {
    let cls = 'sol-select__trigger';
    if (this.error()) cls += ' sol-select__trigger--error';
    if (this.isOpen()) cls += ' sol-select__trigger--open';
    return cls;
  });

  private onChange: (value: any) => void = () => {};
  private onTouched: () => void = () => {};

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Element;
    const insideHost = this.hostEl.nativeElement.contains(target);
    // El panel vive portaleado en document.body: también cuenta como "dentro".
    const insidePanel = this.dropdownPanel()?.nativeElement.contains(target) ?? false;
    // Un <label> que envuelve al select reenvía el clic al botón, que ya alterna:
    // cerrar aquí haría que el panel abierto se volviera a abrir.
    const insideLabel = target.closest?.('label')?.contains(this.hostEl.nativeElement) ?? false;
    if (!insideHost && !insidePanel && !insideLabel) {
      this.closeDropdown();
    }
  }

  constructor(private hostEl: ElementRef) {}

  @HostListener('window:resize')
  onViewportResize(): void {
    this.viewportWidth.set(SolSelectComponent.readViewportWidth());
  }

  private static readViewportWidth(): number {
    return typeof window !== 'undefined' && Number.isFinite(window.innerWidth) ? window.innerWidth : 0;
  }

  optionId(index: number): string {
    return `${this.panelId}-option-${index}`;
  }

  toggleDropdown(): void {
    if (this.isOpen()) this.closeDropdown();
    else this.openDropdown();
  }

  private openDropdown(): void {
    if (this.disabled()) return;
    this.searchTerm.set('');
    this.isOpen.set(true);
    const selected = this.navItems().findIndex(item => this.isSelected(item.value));
    this.activeIndex.set(selected >= 0 ? selected : this.navItems().length > 0 ? 0 : -1);
    afterNextRender(
      () => {
        // On a touch viewport the list opens as a bottom sheet: focusing the search box would
        // raise the keyboard over it, so the focus goes to the list and the person taps the
        // search box only if they need it.
        const search = this.touchViewport() ? undefined : this.searchInput();
        const target = search ?? this.listbox();
        target?.nativeElement.focus({ preventScroll: true });
        this.scrollActiveIntoView();
      },
      { injector: this.injector },
    );
  }

  /** `returnFocus`: al elegir o con Esc el foco vuelve al botón; con un clic fuera, se queda donde cayó. */
  closeDropdown(returnFocus = false): void {
    this.isOpen.set(false);
    if (returnFocus) this.triggerBtn()?.nativeElement.focus({ preventScroll: true });
  }

  onSearchInput(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
    // La primera coincidencia, sin contar "Todos".
    const firstMatch = !this.multiple() && this.showAllOption() ? 1 : 0;
    this.activeIndex.set(Math.min(firstMatch, this.navItems().length - 1));
  }

  /** Teclado del botón y del panel (el panel vive fuera del host, portaleado). */
  onKeydown(event: KeyboardEvent): void {
    if (!this.isOpen()) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        this.openDropdown();
      }
      return;
    }

    const target = event.target as HTMLElement;
    const inSearch = target === this.searchInput()?.nativeElement;
    // "Todos" y "Ninguno" son botones de verdad: Enter y Espacio siguen siendo suyos.
    if ((event.key === 'Enter' || event.key === ' ') && target.classList.contains('sol-select__bulk-btn')) return;

    switch (event.key) {
      case 'ArrowDown':
        this.moveActive(Math.min(this.activeIndex() + 1, this.navItems().length - 1), event);
        break;
      case 'ArrowUp':
        this.moveActive(Math.max(this.activeIndex() - 1, 0), event);
        break;
      case 'Home':
        if (!(inSearch && this.searchTerm())) this.moveActive(0, event);
        break;
      case 'End':
        if (!(inSearch && this.searchTerm())) this.moveActive(this.navItems().length - 1, event);
        break;
      case ' ':
        if (!inSearch) this.chooseActive(event);
        break;
      case 'Enter':
        this.chooseActive(event);
        break;
      case 'Escape':
        // Sin propagar: un drawer o un modal que lo contenga no se cierra con el mismo Esc.
        event.preventDefault();
        event.stopPropagation();
        this.closeDropdown(true);
        break;
      case 'Tab':
        // El panel está al final del body: Tab sigue desde el botón, como en un select nativo.
        if (!this.multiple()) this.closeDropdown(true);
        break;
    }
  }

  private moveActive(index: number, event: KeyboardEvent): void {
    event.preventDefault();
    if (this.navItems().length === 0) return;
    this.activeIndex.set(index);
    this.scrollActiveIntoView();
  }

  private chooseActive(event: KeyboardEvent): void {
    event.preventDefault();
    const item = this.navItems()[this.activeIndex()];
    if (item) this.onOptionClick(item.value);
  }

  private scrollActiveIntoView(): void {
    document.getElementById(this.optionId(this.activeIndex()))?.scrollIntoView?.({ block: 'nearest' });
  }

  isSelected(value: string): boolean {
    if (this.multiple()) return this.multiValues().has(value);
    return this.singleValue() === value;
  }

  onOptionClick(value: string): void {
    if (this.multiple()) {
      this.multiValues.update(set => {
        const next = new Set(set);
        next.has(value) ? next.delete(value) : next.add(value);
        return next;
      });
      this.emitMultiValue();
    } else {
      this.onSelectSingle(value);
    }
  }

  onSelectSingle(value: string): void {
    // Controlado: lo que se muestra lo decide el dueño a través de `[value]`.
    if (this.value() === undefined) this.singleValue.set(value);
    this.onChange(value);
    this.valueChange.emit(value);
    this.closeDropdown(true);
  }

  selectAll(): void {
    const all = new Set(this.options().map(o => o.value));
    this.multiValues.set(all);
    this.emitMultiValue();
  }

  selectNone(): void {
    this.multiValues.set(new Set());
    this.emitMultiValue();
  }

  onBlur(): void {
    this.onTouched();
  }

  // ── ControlValueAccessor ──

  writeValue(value: any): void {
    if (this.multiple()) {
      if (Array.isArray(value)) {
        this.multiValues.set(new Set(value.map(String)));
      } else {
        this.multiValues.set(new Set());
      }
    } else {
      this.singleValue.set(value != null ? String(value) : '');
    }
  }

  registerOnChange(fn: (value: any) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(_: boolean): void {}

  private emitMultiValue(): void {
    this.onChange(Array.from(this.multiValues()));
  }
}
