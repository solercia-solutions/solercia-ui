import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  input,
  output,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export type SolCheckboxSize = 'sm' | 'md' | 'lg';
export type SolCheckboxColor = 'primary' | 'secondary' | 'success' | 'danger' | 'amber' | 'teal' | 'indigo' | 'purple' | 'pink';
export type SolCheckboxShape = 'rounded' | 'square' | 'circle';

@Component({
  selector: 'sol-checkbox',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SolCheckboxComponent),
      multi: true,
    },
  ],
  template: `
    <label [class]="hostClass()" [style.--_cb-color]="colorVar()" (click)="$event.stopPropagation()">
      <span [class]="boxWrapperClass()">
        <input
          type="checkbox"
          class="sol-checkbox__native"
          [checked]="checked()"
          [disabled]="disabled()"
          (change)="onToggle()"
          (blur)="onTouched()"
        />
        <span [class]="boxClass()">
          @if (checked()) {
            <svg
              [class]="'sol-checkbox__icon sol-checkbox__icon--' + size()"
              [attr.viewBox]="iconViewBox()"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              @switch (icon()) {
                @case ('check') {
                  <polyline points="20 6 9 17 4 12" />
                }
                @case ('minus') {
                  <line x1="5" y1="12" x2="19" y2="12" />
                }
                @case ('heart') {
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" fill="currentColor" stroke="none" />
                }
                @case ('star') {
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="currentColor" stroke="none" />
                }
                @default {
                  <polyline points="20 6 9 17 4 12" />
                }
              }
            </svg>
          }
        </span>
        @if (ripple()) {
          <span class="sol-checkbox__ripple" [class.sol-checkbox__ripple--active]="rippleActive()"></span>
        }
      </span>

      @if (label()) {
        <span class="sol-checkbox__label">
          {{ label() }}
          @if (linkText() && linkHref()) {
            <a [href]="linkHref()" class="sol-checkbox__link" target="_blank" rel="noopener" (click)="$event.stopPropagation()">{{ linkText() }}</a>
          }
        </span>
      }
    </label>
  `,
  styles: `
    :host {
      display: inline-block;
      --sol-cb-primary: var(--sol-color-primary, #2563eb);
      --sol-cb-secondary: var(--sol-color-secondary, #64748b);
      --sol-cb-success: var(--sol-color-success, #16a34a);
      --sol-cb-danger: var(--sol-color-danger, #dc2626);
      --sol-cb-amber: #d97706; --sol-cb-teal: #0d9488;
      --sol-cb-indigo: #4f46e5; --sol-cb-purple: #7c3aed; --sol-cb-pink: #db2777;
      --sol-cb-border: var(--sol-border-color-default, #94a3b8);
      --sol-cb-label: var(--sol-color-text-primary, #1e293b);
      --sol-cb-t: var(--sol-transition-fast, 150ms ease);
    }
    .sol-checkbox { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; -webkit-tap-highlight-color: transparent; }
    .sol-checkbox--disabled { cursor: not-allowed; opacity: 0.45; }
    .sol-checkbox__native { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; border: 0; clip: rect(0 0 0 0); overflow: hidden; }
    .sol-checkbox__box-wrapper { position: relative; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .sol-checkbox__box {
      display: inline-flex; align-items: center; justify-content: center;
      border: 2px solid var(--sol-cb-border); background: transparent;
      transition: background-color var(--sol-cb-t), border-color var(--sol-cb-t), box-shadow var(--sol-cb-t);
      position: relative; z-index: 1;
    }
    .sol-checkbox__box--sm { width: 16px; height: 16px; --_r: 3px; }
    .sol-checkbox__box--md { width: 20px; height: 20px; --_r: 4px; }
    .sol-checkbox__box--lg { width: 24px; height: 24px; --_r: 5px; }
    /* El shape rounded sigue el radio del tema; --_r queda como fallback por tamaño. */
    .sol-checkbox__box--rounded { border-radius: var(--sol-border-radius-sm, var(--_r)); }
    .sol-checkbox__box--square { border-radius: 2px; }
    .sol-checkbox__box--circle { border-radius: 50%; }
    .sol-checkbox__box--checked { background-color: var(--_cb-color); border-color: var(--_cb-color); }
    .sol-checkbox__native:focus-visible ~ .sol-checkbox__box { box-shadow: 0 0 0 3px color-mix(in srgb, var(--_cb-color) 30%, transparent); }
    .sol-checkbox__icon { color: #fff; display: block; }
    .sol-checkbox__icon--sm { width: 10px; height: 10px; }
    .sol-checkbox__icon--md { width: 13px; height: 13px; }
    .sol-checkbox__icon--lg { width: 16px; height: 16px; }
    .sol-checkbox__ripple {
      position: absolute; top: 50%; left: 50%;
      transform: translate(-50%, -50%) scale(0);
      width: 250%; height: 250%; border-radius: 50%;
      background: color-mix(in srgb, var(--_cb-color) 15%, transparent);
      transition: transform 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.3s ease;
      opacity: 0; z-index: 0; pointer-events: none;
    }
    .sol-checkbox__ripple--active { transform: translate(-50%, -50%) scale(1); opacity: 1; }
    .sol-checkbox:not(.sol-checkbox--disabled) .sol-checkbox__box-wrapper:hover .sol-checkbox__ripple { transform: translate(-50%, -50%) scale(1); opacity: 0.6; }
    .sol-checkbox__label { color: var(--sol-cb-label); line-height: 1.4; }
    .sol-checkbox--sm .sol-checkbox__label { font-size: var(--sol-font-size-sm, 12px); }
    .sol-checkbox--md .sol-checkbox__label, .sol-checkbox--lg .sol-checkbox__label { font-size: var(--sol-font-size-base, 14px); }
    .sol-checkbox__link { color: var(--_cb-color); text-decoration: underline; text-underline-offset: 2px; font-weight: 500; transition: opacity var(--sol-cb-t); }
    .sol-checkbox__link:hover { opacity: 0.8; }
  `,
})
export class SolCheckboxComponent implements ControlValueAccessor {
  /** Text label beside the checkbox. */
  readonly label = input<string>('');

  /** Whether the checkbox is disabled. */
  readonly disabled = input<boolean>(false);

  /** Size preset. */
  readonly size = input<SolCheckboxSize>('md');

  /** Color variant. */
  readonly color = input<SolCheckboxColor>('primary');

  /** Shape of the checkbox box. */
  readonly shape = input<SolCheckboxShape>('rounded');

  /** Whether to show ripple effect on click. */
  readonly ripple = input<boolean>(true);

  /** Custom icon: check (default), minus (indeterminate), heart, star. */
  readonly icon = input<'check' | 'minus' | 'heart' | 'star'>('check');

  /** Link text shown after the label. */
  readonly linkText = input<string>('');

  /** Link href. */
  readonly linkHref = input<string>('');

  /** Emits when checked state changes (for template-driven usage). */
  readonly changed = output<boolean>();

  /** Internal checked state. */
  readonly checked = signal(false);

  /** Ripple animation state. */
  readonly rippleActive = signal(false);

  private onChange: (value: boolean) => void = () => {};
  onTouched: () => void = () => {};

  readonly iconViewBox = computed(() => '0 0 24 24');

  readonly colorVar = computed(() => {
    const map: Record<SolCheckboxColor, string> = {
      primary:   'var(--sol-cb-primary)',
      secondary: 'var(--sol-cb-secondary)',
      success:   'var(--sol-cb-success)',
      danger:    'var(--sol-cb-danger)',
      amber:     'var(--sol-cb-amber)',
      teal:      'var(--sol-cb-teal)',
      indigo:    'var(--sol-cb-indigo)',
      purple:    'var(--sol-cb-purple)',
      pink:      'var(--sol-cb-pink)',
    };
    return map[this.color()] ?? map['primary'];
  });

  readonly hostClass = computed(() => {
    const classes = ['sol-checkbox', `sol-checkbox--${this.size()}`];
    if (this.disabled()) classes.push('sol-checkbox--disabled');
    return classes.join(' ');
  });

  readonly boxWrapperClass = computed(() =>
    `sol-checkbox__box-wrapper sol-checkbox__box-wrapper--${this.size()}`
  );

  readonly boxClass = computed(() => {
    const s = this.size();
    const classes = [
      'sol-checkbox__box',
      `sol-checkbox__box--${s}`,
      `sol-checkbox__box--${this.shape()}`,
    ];
    if (this.checked()) classes.push('sol-checkbox__box--checked');
    return classes.join(' ');
  });

  onToggle(): void {
    if (this.disabled()) return;
    const next = !this.checked();
    this.checked.set(next);
    this.onChange(next);
    this.changed.emit(next);

    if (this.ripple()) {
      this.rippleActive.set(true);
      setTimeout(() => this.rippleActive.set(false), 300);
    }
  }

  // ── ControlValueAccessor ──

  writeValue(value: boolean): void {
    this.checked.set(!!value);
  }

  registerOnChange(fn: (value: boolean) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState?(isDisabled: boolean): void {
    // Handled via disabled() input binding from reactive forms
  }
}
