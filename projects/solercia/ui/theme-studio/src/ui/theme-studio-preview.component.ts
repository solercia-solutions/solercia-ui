import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input } from '@angular/core';
import {
  resolveCssVars,
  sanitizeAssetUrl,
  type SolTableVariant,
  type ThemeFile,
  type ThemeLogo,
  type ThemeMode,
} from '@solercia/ui';
import { injectThemeStudioText } from '../i18n/theme-studio.i18n';
import type { ThemeLoaderConfig } from '../model/theme-studio-form.model';

/**
 * Vista previa aislada del tema EN EDICIÓN: un mini panel (barra lateral, indicadores, campo,
 * botones, botones por rol, chips, texto, tabla y, si el host activa la sección, el indicador de
 * carga) pintado con las variables del tema que se está editando.
 *
 * `resolveCssVars(theme, mode)` produce el mapa `--sol-*` y un effect lo aplica sobre el HOST del
 * componente: las custom properties heredan hacia abajo, así que solo el mock queda tematizado y
 * el `:root` (tema real de la aplicación) permanece intacto.
 */
@Component({
  selector: 'sol-theme-studio-preview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-mode]': 'mode()',
    '[class.is-dark]': "mode() === 'dark'",
    '[attr.data-variant]': 'tableVariant()',
    '[attr.data-sol-table]': 'tableVariant()',
    '[attr.data-sol-loader]': "loader()?.presentation ?? 'current'",
  },
  template: `
    <div class="preview-page" data-testid="preview-page">
      <aside class="preview-sidebar" data-testid="preview-sidebar">
        <div class="brand-row" data-testid="preview-brand">
          @if (logoUrl(); as url) {
            <span class="preview-brand-logo">
              <img class="brand-logo-img" [src]="url" [alt]="brand()?.altText ?? ''" [style.--sol-brand-logo-width]="logoWidth()" />
            </span>
          } @else {
            <span class="brand">{{ t('preview.brand') }}</span>
          }
        </div>
        <a class="nav-item active">{{ t('preview.navDashboard') }}</a>
        <a class="nav-item">{{ t('preview.navRequests') }}</a>
        <a class="nav-item">{{ t('preview.navUsers') }}</a>
      </aside>

      <div class="preview-content">
        <h3 class="preview-title">{{ t('preview.title') }}</h3>

        <div class="stat-row">
          <div class="stat-card">
            <span class="stat-label">{{ t('preview.statRequests') }}</span>
            <span class="stat-value">128</span>
          </div>
          <div class="stat-card">
            <span class="stat-label">{{ t('preview.statBudget') }}</span>
            <span class="stat-value">{{ t('preview.statBudgetValue') }}</span>
          </div>
        </div>

        <label class="preview-field">
          <span class="field-label">{{ t('preview.inputLabel') }}</span>
          <input class="preview-input" type="text" [placeholder]="t('preview.inputPlaceholder')" />
        </label>

        <div class="button-row">
          <button type="button" class="btn btn-primary">
            {{ t('preview.primaryAction') }}
          </button>
          <button type="button" class="btn btn-ghost">
            {{ t('preview.ghostAction') }}
          </button>
        </div>

        <div class="preview-field">
          <span class="field-label">{{ t('preview.rolesHeading') }}</span>
          <div class="button-row" data-testid="preview-role-buttons">
            <button type="button" class="btn btn-primary">{{ t('preview.roleBtnPrimary') }}</button>
            <button type="button" class="btn btn-secondary">{{ t('preview.roleBtnSecondary') }}</button>
            <button type="button" class="btn btn-success">{{ t('preview.roleBtnSuccess') }}</button>
            <button type="button" class="btn btn-warning">{{ t('preview.roleBtnWarning') }}</button>
            <button type="button" class="btn btn-danger">{{ t('preview.roleBtnDanger') }}</button>
            <button type="button" class="btn btn-info">{{ t('preview.roleBtnInfo') }}</button>
          </div>
        </div>

        <div class="chip-row">
          <span class="chip chip-primary">{{ t('preview.chipActive') }}</span>
          <span class="chip chip-accent">{{ t('preview.chipNew') }}</span>
          <span class="chip chip-muted">{{ t('preview.chipPending') }}</span>
        </div>

        <div class="preview-field" data-testid="preview-body-text">
          <h4 class="body-text-heading">{{ t('preview.bodyTextHeading') }}</h4>
          <p class="body-text-paragraph">{{ t('preview.bodyTextParagraph') }}</p>
        </div>

        <div class="preview-field" data-testid="preview-table">
          <span class="field-label">{{ t('preview.tableSample') }}</span>
          <table class="preview-table">
            <thead>
              <tr>
                <th>{{ t('preview.tableColName') }}</th>
                <th>{{ t('preview.tableColRole') }}</th>
                <th>{{ t('preview.tableColState') }}</th>
              </tr>
            </thead>
            <tbody>
              @for (row of sampleRows; track row.name) {
                <tr><td>{{ row.name }}</td><td>{{ t('preview.tableColRole') }}</td><td>{{ t(row.stateKey) }}</td></tr>
              }
            </tbody>
          </table>
        </div>

        @if (loader()) {
          <div class="preview-field" data-testid="preview-loader">
            <span class="field-label">{{ t('preview.loaderSample') }}</span>
            <span class="preview-spinner" aria-hidden="true"></span>
          </div>
        }
      </div>

      <footer class="preview-footer" data-testid="preview-footer">
        {{ tagline() || t('preview.footerFallback') }}
      </footer>
    </div>
  `,
  styles: `
    :host {
      display: block;
      position: relative;
      isolation: isolate;
      border-radius: 14px;
      overflow: hidden;
      /* El host lleva las vars del modo en edición y las usa como fondo/textura/texto: al
         alternar claro/oscuro el contenedor entero cambia, con un marco del color de página. */
      padding: 10px;
      background-color: var(--sol-bg-page, #F8FAFC);
      color: var(--sol-color-text-primary, #0F172A);
      transition: background-color 0.45s ease;
    }
    /* Textura de página del tema en edición, acotada al propio host (no al viewport). */
    :host::before {
      content: '';
      position: absolute;
      inset: 0;
      z-index: -1;
      pointer-events: none;
      background-image: var(--sol-bg-page-texture, none);
      background-repeat: no-repeat;
      background-size: cover;
      background-position: center;
    }
    .preview-page {
      display: grid;
      position: relative;
      isolation: isolate;
      grid-template-columns: 132px 1fr;
      min-height: 380px;
      border-radius: 10px;
      overflow: hidden;
      background-color: var(--sol-bg-page, #F8FAFC);
      font-family: var(--sol-font-family, system-ui, sans-serif);
      font-size: var(--sol-font-size-base, 14px);
      line-height: var(--sol-line-height, 1.5);
      color: var(--sol-color-text-primary, #0F172A);
      box-shadow: var(--sol-card-shadow, none);
      transition: background-color 0.45s ease;
    }
    /* Misma textura en el grid interior (un hijo absoluto no ocupa celda del grid). */
    .preview-page::before {
      content: '';
      position: absolute;
      inset: 0;
      z-index: -1;
      pointer-events: none;
      background-image: var(--sol-bg-page-texture, none);
      background-repeat: no-repeat;
      background-size: cover;
      background-position: center;
    }
    .preview-sidebar {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 12px 8px;
      background: var(--sol-sidebar-bg, var(--sol-bg-surface, #FFFFFF));
    }
    .brand-row {
      display: flex;
      align-items: center;
      padding: 4px 10px 10px;
    }
    .brand {
      font-family: var(--sol-font-display, var(--sol-font-family, system-ui, sans-serif));
      font-weight: var(--sol-display-weight, 700);
      letter-spacing: var(--sol-display-tracking, 0em);
      text-transform: var(--sol-display-transform, none);
      color: var(--sol-sidebar-active-text, var(--sol-color-primary, #2563EB));
      font-size: var(--sol-font-size-lg, 16px);
    }
    /* El slot fija el ALTO; el logo deriva su ancho de la proporción, con el ancho del tema como
       techo (mismo contrato que el logo del encabezado). */
    .preview-brand-logo {
      display: inline-flex;
      align-items: center;
      height: 28px;
      color: var(--sol-color-text-primary, #0F172A);
    }
    .brand-logo-img {
      display: block;
      width: auto;
      height: 100%;
      max-width: min(var(--sol-brand-logo-width, 120px), var(--sol-brand-logo-max-width, 9999px));
      object-fit: contain;
    }
    .nav-item {
      padding: 7px 10px;
      border-radius: var(--sol-sidebar-item-radius, 6px);
      color: var(--sol-sidebar-text, var(--sol-color-text-secondary, #475569));
      font-size: var(--sol-font-size-sm, 13px);
      cursor: default;
    }
    .nav-item.active {
      background: var(--sol-sidebar-active-bg, transparent);
      color: var(--sol-sidebar-active-text, var(--sol-color-primary, #2563EB));
      box-shadow: var(--sol-sidebar-indicator, none);
    }
    .preview-content {
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 16px;
      min-width: 0;
    }
    .preview-title {
      margin: 0;
      font-family: var(--sol-font-display, var(--sol-font-family, system-ui, sans-serif));
      font-weight: var(--sol-display-weight, 700);
      letter-spacing: var(--sol-display-tracking, 0em);
      text-transform: var(--sol-display-transform, none);
      font-size: var(--sol-font-size-xl, 20px);
    }
    .stat-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .stat-card {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 12px;
      min-width: 0;
      background: var(--sol-card-bg, var(--sol-bg-surface, #FFFFFF));
      border: var(--sol-card-border, 1px solid var(--sol-border-color-default, #E2E8F0));
      border-radius: var(--sol-card-radius, 12px);
      box-shadow: var(--sol-card-shadow, none);
      backdrop-filter: var(--sol-card-blur, none);
      transition:
        box-shadow var(--sol-dur-base, 240ms) var(--sol-ease, ease),
        transform var(--sol-dur-base, 240ms) var(--sol-ease, ease);
    }
    .stat-card:hover {
      transform: translateY(var(--sol-hover-lift, 0px));
      box-shadow: var(--sol-card-shadow-hover, var(--sol-card-shadow, none));
    }
    .stat-label {
      font-size: var(--sol-font-size-sm, 13px);
      color: var(--sol-color-text-muted, #64748B);
    }
    .stat-value {
      font-family: var(--sol-font-numeric, var(--sol-font-family, system-ui, sans-serif));
      font-weight: var(--sol-display-weight, 700);
      font-size: 22px;
    }
    .preview-field {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .field-label {
      font-size: var(--sol-font-size-sm, 13px);
      color: var(--sol-color-text-secondary, #475569);
    }
    .preview-input {
      height: var(--sol-size-input-height, 36px);
      padding: 0 10px;
      background: var(--sol-input-bg, var(--sol-bg-surface, #FFFFFF));
      border: var(--sol-input-border, 1px solid var(--sol-border-color-default, #E2E8F0));
      border-radius: var(--sol-input-radius, 6px);
      box-shadow: var(--sol-input-shadow, none);
      color: var(--sol-color-text-primary, #0F172A);
      font: inherit;
      outline: none;
    }
    .preview-input:focus {
      border: var(--sol-input-focus-border, 1px solid var(--sol-color-primary, #2563EB));
      box-shadow: var(--sol-input-focus-ring, none);
    }
    .button-row {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    .btn {
      height: var(--sol-size-button-height, 36px);
      padding: 0 16px;
      border-radius: var(--sol-button-radius, 6px);
      box-shadow: var(--sol-button-shadow, none);
      font-weight: var(--sol-button-weight, 600);
      text-transform: var(--sol-button-transform, none);
      font-family: inherit;
      font-size: var(--sol-font-size-sm, 13px);
      cursor: pointer;
      transition: filter var(--sol-dur-fast, 120ms) var(--sol-ease, ease);
    }
    .btn:active {
      transform: scale(var(--sol-press-scale, 0.98));
    }
    .btn:hover {
      filter: brightness(1.08);
    }
    .btn-primary {
      background: var(--sol-color-primary, #2563EB);
      color: var(--sol-color-primary-contrast, #FFFFFF);
      border: none;
    }
    .btn-ghost {
      background: transparent;
      color: var(--sol-color-primary, #2563EB);
      border: var(--sol-border-width-default, 1px) solid var(--sol-border-color-default, #E2E8F0);
    }
    /* Roles de estado: fondo sólido y texto claro, misma disciplina que .btn-primary. */
    .btn-secondary {
      background: var(--sol-color-secondary, #E2E8F0);
      color: var(--sol-color-secondary-contrast, #1E293B);
      border: none;
    }
    .btn-success {
      background: var(--sol-color-success, #16A34A);
      color: var(--sol-theme-studio-on-color, #FFFFFF);
      border: none;
    }
    .btn-warning {
      background: var(--sol-color-warning, #D97706);
      color: var(--sol-theme-studio-on-color, #FFFFFF);
      border: none;
    }
    .btn-danger {
      background: var(--sol-color-danger, #DC2626);
      color: var(--sol-theme-studio-on-color, #FFFFFF);
      border: none;
    }
    .btn-info {
      background: var(--sol-color-info, #0284C7);
      color: var(--sol-theme-studio-on-color, #FFFFFF);
      border: none;
    }
    .chip-row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .chip {
      padding: 3px 10px;
      border-radius: var(--sol-border-radius-full, 999px);
      font-size: var(--sol-font-size-sm, 13px);
    }
    .chip-primary {
      background: color-mix(in srgb, var(--sol-color-primary, #2563EB) 12%, transparent);
      color: var(--sol-color-primary, #2563EB);
    }
    .chip-accent {
      background: color-mix(in srgb, var(--sol-color-accent, #F59E0B) 14%, transparent);
      color: var(--sol-color-accent, #F59E0B);
    }
    .chip-muted {
      background: var(--sol-bg-sunken, #F1F5F9);
      color: var(--sol-color-text-muted, #64748B);
    }
    /* El párrafo no fija fuente, tamaño, interlineado ni color: los hereda de .preview-page, que
       es justo lo que este bloque muestra en vivo. */
    .body-text-heading {
      margin: 0;
      font-family: var(--sol-font-display, var(--sol-font-family, system-ui, sans-serif));
      font-weight: var(--sol-display-weight, 700);
      letter-spacing: var(--sol-display-tracking, 0em);
      text-transform: var(--sol-display-transform, none);
      font-size: var(--sol-font-size-lg, 16px);
    }
    .body-text-paragraph {
      margin: 0;
      max-width: 34ch;
    }
    .preview-footer {
      grid-column: 1 / -1;
      padding: 8px 16px;
      border-top: var(--sol-border-width-default, 1px) solid var(--sol-border-color-default, #E2E8F0);
      font-size: var(--sol-font-size-sm, 13px);
      color: var(--sol-color-text-muted, #64748B);
      text-align: center;
    }

    /* Derivaciones de tabla e indicador de carga: la EMIT_TABLE no emite estos --sol-*, así que se
       calculan aquí desde la paleta viva y reaccionan en vivo a claro/oscuro. */
    :host {
      --sol-table-header-bg: color-mix(in srgb, var(--sol-color-primary, #2563EB) 8%, var(--sol-bg-surface, #FFFFFF));
      --sol-table-header-strong-bg: color-mix(in srgb, var(--sol-color-primary, #2563EB) 16%, var(--sol-bg-surface, #FFFFFF));
      --sol-table-zebra: color-mix(in srgb, var(--sol-color-text-primary, #0F172A) 4%, transparent);
      --sol-table-band: color-mix(in srgb, var(--sol-color-primary, #2563EB) 7%, transparent);
      --sol-table-cell-border: var(--sol-border-color-default, #E2E8F0);
      --sol-loader-color: var(--sol-color-primary, #2563EB);
      --sol-loader-track: color-mix(in srgb, var(--sol-color-text-primary, #0F172A) 14%, transparent);
    }
    .preview-table {
      width: 100%;
      border-collapse: collapse;
      font-size: var(--sol-font-size-sm, 13px);
      background: var(--sol-card-bg, var(--sol-bg-surface, #FFFFFF));
      border-radius: var(--sol-card-radius, 12px);
      overflow: hidden;
    }
    .preview-table th,
    .preview-table td {
      padding: var(--sol-space-sm, 8px) var(--sol-space-md, 12px);
      text-align: left;
      border-bottom: var(--sol-border-width-default, 1px) solid var(--sol-table-cell-border);
    }
    .preview-table thead th {
      background: var(--sol-table-header-bg);
      color: var(--sol-color-text-secondary, #475569);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .preview-table tbody tr:nth-of-type(odd) {
      background: var(--sol-table-zebra);
    }
    :host([data-sol-table='clean']) .preview-table tbody tr:nth-of-type(odd) {
      background: transparent;
    }
    :host([data-sol-table='banded']) .preview-table tbody tr:nth-of-type(3n) {
      background: var(--sol-table-band);
    }
    :host([data-sol-table='bordered']) .preview-table th,
    :host([data-sol-table='bordered']) .preview-table td {
      border: var(--sol-border-width-default, 1px) solid var(--sol-table-cell-border);
    }
    :host([data-sol-table='emphasis-header']) .preview-table thead th {
      background: var(--sol-table-header-strong-bg);
      color: var(--sol-color-primary, #2563EB);
    }
    .preview-spinner {
      display: inline-block;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: 3px solid var(--sol-loader-track);
      border-top-color: var(--sol-loader-color);
      background-image: var(--sol-loader-image, none);
      background-repeat: no-repeat;
      background-position: center;
      background-size: contain;
      animation: var(--sol-loader-animation-name, sol-loader-spin) 0.8s linear infinite;
    }
    @keyframes sol-loader-spin {
      to {
        transform: rotate(360deg);
      }
    }
    @keyframes sol-loader-pulse {
      0%,
      100% {
        transform: scale(0.72);
        opacity: 0.55;
      }
      50% {
        transform: scale(1);
        opacity: 1;
      }
    }
    @keyframes sol-loader-shake {
      0%,
      100% {
        transform: translateX(0);
      }
      20% {
        transform: translateX(-4px);
      }
      60% {
        transform: translateX(4px);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .preview-spinner {
        animation: none;
      }
    }
  `,
})
export class SolThemeStudioPreviewComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly t = injectThemeStudioText();

  /** Tema EN EDICIÓN (no el activo de la aplicación). */
  readonly theme = input.required<ThemeFile>();
  /** Modo de la vista previa, independiente del modo real de la persona usuaria. */
  readonly mode = input<ThemeMode>('light');
  /** Marca en edición (`meta.logo`). */
  readonly brand = input<ThemeLogo | undefined>(undefined);
  /** Texto del pie de página (`meta.tagline`); vacío muestra el texto de respaldo. */
  readonly tagline = input<string>('');
  /** Variante de tabla de la muestra. */
  readonly tableVariant = input<SolTableVariant | null>(null);
  /** Indicador de carga en edición; sin él no se muestra su muestra. */
  readonly loader = input<ThemeLoaderConfig | undefined>(undefined);

  /**
   * URL del logo del modo de la vista previa, SANITIZADA. En modo oscuro usa `urlDark` cuando
   * existe; sin URL segura se muestra el texto de respaldo.
   */
  protected readonly logoUrl = computed<string | null>(() => {
    const brand = this.brand();
    if (!brand) return null;
    const light = sanitizeAssetUrl(brand.url);
    const dark = sanitizeAssetUrl(brand.urlDark);
    return this.mode() === 'dark' && dark ? dark : light;
  });

  /** Ancho del logo (control «Ancho del logo»), como techo del ancho derivado. */
  protected readonly logoWidth = computed(() => `${this.brand()?.width ?? 120}px`);

  protected readonly sampleRows = [
    { name: 'Ana Prado', stateKey: 'preview.chipActive' },
    { name: 'Beto Ríos', stateKey: 'preview.chipActive' },
    { name: 'Carla Díaz', stateKey: 'preview.chipPending' },
    { name: 'Diego Sol', stateKey: 'preview.chipActive' },
  ];

  constructor() {
    // La EMIT_TABLE es un conjunto fijo: cada emisión sobreescribe todas las variables, sin
    // residuos entre temas. Un tema irresoluble conserva las variables anteriores.
    effect(() => {
      let vars: Map<string, string>;
      try {
        vars = resolveCssVars(this.theme(), this.mode());
      } catch {
        return;
      }
      const style = this.host.nativeElement.style;
      for (const [name, value] of vars) {
        style.setProperty(name, value);
      }
      // La imagen y la animación del indicador de carga no son tokens de la EMIT_TABLE.
      const loader = this.loader();
      if (loader) {
        const image = sanitizeAssetUrl(loader.image);
        style.setProperty('--sol-loader-image', image ? `url("${image}")` : 'none');
        style.setProperty(
          '--sol-loader-animation-name',
          loader.animation === 'none' ? 'none' : `sol-loader-${loader.animation}`,
        );
      }
    });
  }
}
