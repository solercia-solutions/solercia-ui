import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  forwardRef,
  HostListener,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { SolIconComponent } from '../icon/icon.component';

export interface SolSelectOption {
  value: string;
  label: string;
}

@Component({
  selector: 'sol-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SolIconComponent],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SolSelectComponent),
      multi: true,
    },
  ],
  template: `
    @if (label()) {
      <label class="sol-select__label">{{ label() }}</label>
    }

    <div class="sol-select__wrapper" #wrapper>
      <!-- Trigger button -->
      <button
        #triggerBtn
        type="button"
        [class]="triggerClass()"
        [disabled]="disabled()"
        [attr.aria-expanded]="isOpen()"
        [attr.aria-controls]="isOpen() ? panelId : null"
        (click)="toggleDropdown()"
        (blur)="onBlur()"
      >
        <span class="sol-select__display" [class.sol-select__display--placeholder]="!displayText()">
          {{ displayText() || placeholder() }}
        </span>
        <sol-icon name="chevron-down" variant="fill" class="sol-select__arrow" [class.sol-select__arrow--open]="isOpen()" />
      </button>

      <!-- Panel del dropdown: al abrirse se portalea a document.body con
           position:fixed (CP-2) para que ningún ancestro con overflow lo
           recorte (ej. .sol-modal-body). El trigger queda enlazado por
           aria-controls porque input y listbox viven en árboles distintos. -->
      @if (isOpen()) {
        <div
          #dropdownPanel
          class="sol-select__dropdown"
          role="listbox"
          [id]="panelId"
          [class.sol-select__dropdown--up]="dropUp()"
        >
          <!-- Search -->
          @if (searchable()) {
            <div class="sol-select__search-box">
              <input
                #searchInput
                type="text"
                class="sol-select__search"
                placeholder="Buscar..."
                [value]="searchTerm()"
                (input)="onSearchInput($event)"
                (keydown.escape)="closeDropdown()"
              />
            </div>
          }

          <!-- Select all / none for multi -->
          @if (multiple()) {
            <div class="sol-select__bulk-actions">
              <button type="button" class="sol-select__bulk-btn" (click)="selectAll()">Todos</button>
              <button type="button" class="sol-select__bulk-btn" (click)="selectNone()">Ninguno</button>
            </div>
          }

          <!-- "Todos" option for single mode (acts as empty/clear) -->
          @if (!multiple() && showAllOption()) {
            <div
              class="sol-select__option"
              [class.sol-select__option--active]="!singleValue()"
              (click)="onSelectSingle('')"
            >
              {{ allOptionLabel() }}
            </div>
          }

          <!-- Options -->
          <div class="sol-select__options">
            @for (opt of filteredOptions(); track opt.value) {
              <div
                class="sol-select__option"
                [class.sol-select__option--active]="isSelected(opt.value)"
                (click)="onOptionClick(opt.value)"
              >
                @if (multiple()) {
                  <span class="sol-select__check" [class.sol-select__check--checked]="isSelected(opt.value)">
                    @if (isSelected(opt.value)) { &#10003; }
                  </span>
                }
                {{ opt.label }}
              </div>
            } @empty {
              <div class="sol-select__empty">Sin resultados</div>
            }
          </div>
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
      --sol-select-option-hover: var(--sol-color-bg-hover, rgba(0,0,0,0.04));
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

    .sol-select__display { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sol-select__display--placeholder { color: var(--sol-select-placeholder); }

    .sol-select__arrow {
      width: 1.25rem; height: 1.25rem; flex-shrink: 0;
      color: var(--sol-select-arrow-color);
      transition: transform var(--sol-select-transition);
    }
    .sol-select__arrow--open { transform: rotate(180deg); }

    .sol-select__dropdown {
      /* Base absolute como fallback; al portalearse recibe position:fixed y
         coordenadas inline calculadas del trigger. El z-index supera al del
         modal para que el panel no quede debajo del overlay al usarse dentro
         de un sol-modal. */
      position: absolute;
      top: calc(100% + 4px);
      left: 0; right: 0;
      z-index: calc(var(--sol-z-modal, 1050) + 10);
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
    }
  `,
})
export class SolSelectComponent implements ControlValueAccessor {
  /** Placeholder text when nothing is selected. */
  readonly placeholder = input<string>('Selecciona...');
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
  /** Show a "Todos" / clear option in single mode. */
  readonly showAllOption = input<boolean>(false);
  /** Label for the "all" option in single mode. */
  readonly allOptionLabel = input<string>('Todos');

  // ── Internal state ──
  readonly isOpen = signal(false);
  readonly dropUp = signal(false);
  readonly searchTerm = signal('');
  readonly singleValue = signal<string>('');
  readonly multiValues = signal<Set<string>>(new Set());

  readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  readonly triggerBtn = viewChild<ElementRef<HTMLButtonElement>>('triggerBtn');
  readonly dropdownPanel = viewChild<ElementRef<HTMLElement>>('dropdownPanel');

  /** Id único que enlaza el trigger (aria-controls) con el listbox portaleado. */
  private static nextId = 0;
  readonly panelId = `sol-select-panel-${SolSelectComponent.nextId++}`;

  /** Nodo del panel mientras vive portaleado en document.body. */
  private portalPanel: HTMLElement | null = null;

  /** Reposiciona el panel; misma referencia para add/removeEventListener. */
  private readonly reposition = (): void => this.positionPanel();

  readonly filteredOptions = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const opts = this.options();
    if (!term) return opts;
    return opts.filter(o => o.label.toLowerCase().includes(term));
  });

  readonly displayText = computed(() => {
    if (this.multiple()) {
      const selected = this.multiValues();
      if (selected.size === 0) return '';
      if (selected.size === this.options().length) return 'Todos';
      const labels = this.options()
        .filter(o => selected.has(o.value))
        .map(o => o.label);
      return labels.join(', ');
    }
    const val = this.singleValue();
    if (!val) return '';
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
    const target = event.target as Node;
    const insideHost = this.hostEl.nativeElement.contains(target);
    // El panel vive portaleado en document.body: también cuenta como "dentro".
    const insidePanel = this.portalPanel?.contains(target) ?? false;
    if (!insideHost && !insidePanel) {
      this.closeDropdown();
    }
  }

  constructor(private hostEl: ElementRef) {
    // Portal manual (CP-2): cuando @if crea el panel, se mueve a document.body
    // con position:fixed y coordenadas del trigger; el cleanup del effect
    // retira listeners y el nodo al cerrar o destruir, sin fugas.
    effect(onCleanup => {
      const panel = this.dropdownPanel()?.nativeElement ?? null;
      if (!panel) return;
      this.attachPanel(panel);
      onCleanup(() => this.detachPanel());
    });
  }

  toggleDropdown(): void {
    if (this.disabled()) return;
    this.isOpen.update(v => !v);
    if (this.isOpen()) {
      this.searchTerm.set('');
      setTimeout(() => this.searchInput()?.nativeElement?.focus(), 50);
    }
  }

  /** Adhiere el panel a document.body y lo posiciona siguiendo al trigger. */
  private attachPanel(panel: HTMLElement): void {
    this.portalPanel = panel;
    document.body.appendChild(panel);
    this.positionPanel();
    window.addEventListener('scroll', this.reposition, { capture: true, passive: true });
    window.addEventListener('resize', this.reposition, { passive: true });
  }

  /** Retira listeners y el nodo portaleado (si Angular no lo removió ya). */
  private detachPanel(): void {
    window.removeEventListener('scroll', this.reposition, { capture: true });
    window.removeEventListener('resize', this.reposition);
    if (this.portalPanel && this.portalPanel.parentNode === document.body) {
      document.body.removeChild(this.portalPanel);
    }
    this.portalPanel = null;
  }

  /**
   * Posiciona el panel con coordenadas fixed del viewport: ancho y eje X del
   * trigger; hacia abajo por defecto o anclado por bottom (dropUp) cuando el
   * espacio real bajo el trigger es menor a 300px.
   */
  private positionPanel(): void {
    const panel = this.portalPanel;
    const trigger = this.triggerBtn()?.nativeElement;
    if (!panel || !trigger) return;

    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    this.dropUp.set(spaceBelow < 300);

    panel.style.position = 'fixed';
    panel.style.left = `${rect.left}px`;
    panel.style.width = `${rect.width}px`;
    panel.style.right = 'auto';
    if (this.dropUp()) {
      panel.style.top = 'auto';
      panel.style.bottom = `${window.innerHeight - rect.top + 4}px`;
    } else {
      panel.style.top = `${rect.bottom + 4}px`;
      panel.style.bottom = 'auto';
    }
  }

  closeDropdown(): void {
    this.isOpen.set(false);
  }

  onSearchInput(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
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
    this.singleValue.set(value);
    this.onChange(value);
    this.closeDropdown();
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
