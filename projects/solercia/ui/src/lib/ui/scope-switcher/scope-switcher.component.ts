import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { SOL_I18N } from '../../i18n/sol-i18n';
import { SolAvatarComponent } from '../avatar/avatar.component';
import { SolIconComponent, type SolIconName } from '../icon/icon.component';
import { SolSpinnerComponent } from '../spinner/spinner.component';
import {
  SolFloatingPanelDirective,
  type SolFloatingPanelAlign,
} from '../overlay/floating-panel.directive';

/**
 * Un ámbito seleccionable: la unidad de contexto sobre la que trabaja la
 * aplicación (empresa, sede, proyecto, espacio de trabajo, tenant…).
 *
 * El tipo es deliberadamente ANÉMICO y agnóstico del dominio: la librería solo
 * necesita saber cómo pintar cada fila y cómo identificarla. Todo lo que el
 * consumidor necesite recuperar al recibir la selección viaja intacto en
 * `data`, sin que `@solercia/ui` conozca su forma.
 *
 * @typeParam TData Carga libre del consumidor (p. ej. la membresía completa).
 */
export interface SolScope<TData = unknown> {
  /** Identificador estable y único dentro de la lista. Ancla el ámbito activo. */
  readonly id: string;

  /** Etiqueta principal ya resuelta al idioma activo (nombre del ámbito). */
  readonly label: string;

  /**
   * Etiqueta secundaria opcional, ya resuelta al idioma activo. El consumidor
   * decide qué significa: el rol del usuario en la empresa, el plan contratado,
   * la ciudad de la sede… La librería solo la pinta atenuada junto al `label`.
   */
  readonly sublabel?: string;

  /**
   * Ícono del `ICON_REGISTRY` para representar el ámbito. Si no se provee, el
   * componente cae a las iniciales del `label` mediante `sol-avatar`, así que
   * una lista sin íconos igual se distingue de un vistazo.
   */
  readonly icon?: SolIconName | string;

  /** Imagen/logo del ámbito. Solo aplica cuando no hay `icon`; alimenta el avatar. */
  readonly imageUrl?: string | null;

  /** Carga libre del consumidor. La librería nunca la lee — solo la devuelve al emitir. */
  readonly data?: TData;
}

/**
 * Estados mutuamente excluyentes del selector. Se modelan como un único
 * discriminante (y no como banderas sueltas `loading`/`error`) precisamente
 * para que "cargando", "vacío" y "error" NUNCA puedan confundirse ni
 * solaparse: la lista vacía es un estado legítimo, no una falla.
 */
export type SolScopeSwitcherStatus = 'idle' | 'loading' | 'error';

/** Prefijo del catálogo i18n donde viven los textos por defecto del componente. */
const I18N_PREFIX = 'shared.scopeSwitcher';

/**
 * `sol-scope-switcher` — selector genérico de ámbito activo.
 *
 * Presenta la lista de ámbitos disponibles con su etiqueta y su etiqueta
 * secundaria, marca cuál está activo y emite el elegido. Nada más.
 *
 * ## Frontera deliberada: esto es SOLO el selector visual
 *
 * El componente es un control puro y sin memoria. NO persiste la elección, NO
 * reinicia stores, NO recarga menús, NO reconecta sockets y NO toca cabeceras
 * HTTP: todo eso es política de la aplicación anfitriona, que reacciona a
 * `scopeSelected` y decide qué significa "cambiar de ámbito" en su dominio.
 * Meter cualquiera de esas responsabilidades aquí ataría `@solercia/ui` a un
 * backend y a un modelo de sesión concretos, que es justo lo que este refactor
 * evita.
 *
 * También es la aplicación —no el componente— la que decide si un cambio
 * prospera: mientras verifica el acceso puede pasar `disabled` para congelar
 * el control, y si falla puede pasar `status="error"` conservando `scopes` y
 * `activeScopeId` anteriores. En ese caso el selector sigue mostrando el
 * contexto vigente y suma una alerta debajo, sin quedar en un estado a medias.
 *
 * ## Un solo ámbito
 *
 * Con un único ámbito no se renderiza disparador ni panel: se muestra como
 * activo, en texto estático, sin obligar a elegir entre una sola opción.
 *
 * @typeParam TData Tipo de la carga libre `SolScope.data`.
 *
 * @example
 * ```html
 * <sol-scope-switcher
 *   [scopes]="empresas()"
 *   [activeScopeId]="empresaActivaId()"
 *   [status]="estado()"
 *   [disabled]="cambiando()"
 *   (scopeSelected)="cambiarEmpresa($event)"
 * />
 * ```
 */
@Component({
  selector: 'sol-scope-switcher',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SolAvatarComponent,
    SolIconComponent,
    SolSpinnerComponent,
    SolFloatingPanelDirective,
  ],
  template: `
    @if (status() === 'loading') {
      <span class="sol-scope-switcher__loading" role="status">
        <sol-spinner size="sm" />
        <span class="sol-scope-switcher__loading-text">{{ loadingText() }}</span>
      </span>
    } @else {
      @if (isEmpty()) {
        <!-- Vacío legítimo: solo se pinta si NO hay error, para que "no tienes
             ámbitos" jamás se lea como "la consulta falló". -->
        @if (!hasError()) {
          <span class="sol-scope-switcher__empty">
            <sol-icon name="building" size="sm" class="sol-scope-switcher__empty-icon" />
            <span>{{ emptyText() }}</span>
          </span>
        }
      } @else if (isSingle()) {
        <span class="sol-scope-switcher__static" [attr.aria-label]="triggerAriaText()">
          @if (activeScope(); as scope) {
            @if (scope.icon) {
              <sol-icon [name]="scope.icon" size="sm" class="sol-scope-switcher__icon" />
            } @else {
              <sol-avatar [name]="scope.label" [imageUrl]="scope.imageUrl ?? null" size="sm" />
            }
            <span class="sol-scope-switcher__labels">
              <span class="sol-scope-switcher__label">{{ scope.label }}</span>
              @if (scope.sublabel) {
                <span class="sol-scope-switcher__sublabel">{{ scope.sublabel }}</span>
              }
            </span>
          }
        </span>
      } @else {
        <div class="sol-scope-switcher__host">
          <button
            #triggerBtn
            type="button"
            class="sol-scope-switcher__trigger"
            [class.sol-scope-switcher__trigger--open]="isOpen()"
            [disabled]="disabled()"
            aria-haspopup="listbox"
            [attr.aria-expanded]="isOpen()"
            [attr.aria-controls]="isOpen() ? panelId : null"
            [attr.aria-label]="triggerAriaText()"
            (click)="onTriggerClick()"
            (keydown)="onTriggerKeydown($event)"
          >
            @if (activeScope(); as scope) {
              @if (scope.icon) {
                <sol-icon [name]="scope.icon" size="sm" class="sol-scope-switcher__icon" />
              } @else {
                <sol-avatar [name]="scope.label" [imageUrl]="scope.imageUrl ?? null" size="sm" />
              }
              <span class="sol-scope-switcher__labels">
                <span class="sol-scope-switcher__label">{{ scope.label }}</span>
                @if (scope.sublabel) {
                  <span class="sol-scope-switcher__sublabel">{{ scope.sublabel }}</span>
                }
              </span>
            }
            <sol-icon
              name="chevron-down"
              variant="fill"
              size="sm"
              class="sol-scope-switcher__arrow"
              [class.sol-scope-switcher__arrow--open]="isOpen()"
            />
          </button>

          <!-- El panel se portalea a document.body con position:fixed vía la
               directiva compartida solFloatingPanel: el switcher suele vivir en
               un header con overflow, y sin el portal el panel quedaría
               recortado. El trigger queda enlazado por aria-controls porque
               ambos viven en árboles distintos del DOM. -->
          @if (isOpen()) {
            <div
              #panel
              [id]="panelId"
              class="sol-scope-switcher__panel"
              [class.sol-scope-switcher__panel--up]="dropUp()"
              role="listbox"
              [attr.aria-label]="panelAriaText()"
              [solFloatingPanel]="triggerBtn"
              [matchTriggerWidth]="false"
              [flipThreshold]="panelFlipThreshold"
              [align]="align()"
              (dropUpChange)="dropUp.set($event)"
              (keydown)="onPanelKeydown($event)"
            >
              @for (scope of scopeList(); track scope.id; let i = $index) {
                <button
                  #optionBtn
                  type="button"
                  class="sol-scope-switcher__option"
                  [class.sol-scope-switcher__option--active]="scope.id === effectiveActiveId()"
                  role="option"
                  tabindex="-1"
                  [attr.aria-selected]="scope.id === effectiveActiveId()"
                  (click)="select(scope)"
                >
                  @if (scope.icon) {
                    <sol-icon [name]="scope.icon" size="sm" class="sol-scope-switcher__icon" />
                  } @else {
                    <sol-avatar [name]="scope.label" [imageUrl]="scope.imageUrl ?? null" size="sm" />
                  }
                  <span class="sol-scope-switcher__labels">
                    <span class="sol-scope-switcher__label">{{ scope.label }}</span>
                    @if (scope.sublabel) {
                      <span class="sol-scope-switcher__sublabel">{{ scope.sublabel }}</span>
                    }
                  </span>
                  @if (scope.id === effectiveActiveId()) {
                    <sol-icon
                      name="check"
                      size="sm"
                      class="sol-scope-switcher__check"
                      [attr.aria-label]="activeOptionAriaText()"
                    />
                  }
                </button>
              }
            </div>
          }
        </div>
      }

      <!-- La alerta NO reemplaza al selector: convive con él para que un cambio
           fallido conserve el contexto anterior en pantalla (y se muestra sola
           cuando lo que falló fue la carga misma de la lista). -->
      @if (hasError()) {
        <p class="sol-scope-switcher__error" role="alert">
          <sol-icon name="exclamation-triangle" size="sm" class="sol-scope-switcher__error-icon" />
          <span>{{ errorText() }}</span>
        </p>
      }
    }
  `,
  styles: `
    :host {
      display: inline-block;
    }

    /* Los tokens se declaran también sobre .sol-scope-switcher__panel porque el
       panel se portalea a document.body y deja de heredar del :host. Todos
       apuntan a tokens globales --sol-* definidos en :root, así que el panel
       portaleado sigue tematizado en light y dark. */
    :host,
    .sol-scope-switcher__panel {
      --sol-scope-switcher-bg: var(--sol-bg-surface, #ffffff);
      --sol-scope-switcher-text: var(--sol-color-text-primary, #1e293b);
      --sol-scope-switcher-muted: var(--sol-color-text-muted, #94a3b8);
      --sol-scope-switcher-border: var(--sol-border-color-default, #cbd5e1);
      --sol-scope-switcher-border-width: var(--sol-border-width-default, 1px);
      --sol-scope-switcher-accent: var(--sol-color-primary, #6366f1);
      --sol-scope-switcher-danger: var(--sol-color-danger, #ef4444);
      --sol-scope-switcher-radius: var(--sol-border-radius-md, 0.5rem);
      --sol-scope-switcher-height: var(--sol-size-input-height, 2.5rem);
      --sol-scope-switcher-gap: var(--sol-space-xs, 0.5rem);
      --sol-scope-switcher-padding-x: var(--sol-space-sm, 0.75rem);
      --sol-scope-switcher-font-size: var(--sol-font-size-base, 0.875rem);
      --sol-scope-switcher-sub-font-size: var(--sol-font-size-sm, 0.75rem);
      --sol-scope-switcher-weight: var(--sol-font-weight-bold, 600);
      --sol-scope-switcher-shadow: var(--sol-shadow-lg, 0 10px 25px rgba(0, 0, 0, 0.15));
      --sol-scope-switcher-hover: var(--sol-color-bg-hover, rgba(0, 0, 0, 0.04));
      --sol-scope-switcher-active-bg: color-mix(in srgb, var(--sol-color-primary, #6366f1) 12%, transparent);
      --sol-scope-switcher-focus-ring: 0 0 0 3px color-mix(in srgb, var(--sol-color-primary, #6366f1) 40%, transparent);
      --sol-scope-switcher-transition: var(--sol-dur-fast, 150ms) var(--sol-ease, ease);
      --sol-scope-switcher-disabled-opacity: var(--sol-disabled-opacity, 0.55);
    }

    .sol-scope-switcher__host {
      position: relative;
      display: inline-block;
    }

    /* ── Estados no interactivos ───────────────────────────────────────────── */

    .sol-scope-switcher__loading,
    .sol-scope-switcher__empty,
    .sol-scope-switcher__static {
      display: inline-flex;
      align-items: center;
      gap: var(--sol-scope-switcher-gap);
      min-height: var(--sol-scope-switcher-height);
      padding: 0 var(--sol-scope-switcher-padding-x);
      font-size: var(--sol-scope-switcher-font-size);
      line-height: 1.3;
    }

    .sol-scope-switcher__loading,
    .sol-scope-switcher__empty {
      color: var(--sol-scope-switcher-muted);
    }

    .sol-scope-switcher__empty-icon {
      flex-shrink: 0;
      color: var(--sol-scope-switcher-muted);
    }

    .sol-scope-switcher__static {
      color: var(--sol-scope-switcher-text);
      background: var(--sol-scope-switcher-bg);
      border: var(--sol-scope-switcher-border-width) solid var(--sol-scope-switcher-border);
      border-radius: var(--sol-scope-switcher-radius);
    }

    /* ── Disparador ────────────────────────────────────────────────────────── */

    .sol-scope-switcher__trigger {
      display: inline-flex;
      align-items: center;
      gap: var(--sol-scope-switcher-gap);
      min-height: var(--sol-scope-switcher-height);
      max-width: 100%;
      padding: 0 var(--sol-scope-switcher-padding-x);
      font-family: inherit;
      font-size: var(--sol-scope-switcher-font-size);
      color: var(--sol-scope-switcher-text);
      text-align: left;
      background: var(--sol-scope-switcher-bg);
      border: var(--sol-scope-switcher-border-width) solid var(--sol-scope-switcher-border);
      border-radius: var(--sol-scope-switcher-radius);
      cursor: pointer;
      transition:
        background var(--sol-scope-switcher-transition),
        border-color var(--sol-scope-switcher-transition),
        box-shadow var(--sol-scope-switcher-transition);
    }

    .sol-scope-switcher__trigger:hover:not(:disabled) {
      background: var(--sol-scope-switcher-hover);
    }

    .sol-scope-switcher__trigger:focus-visible {
      outline: none;
      border-color: var(--sol-scope-switcher-accent);
      box-shadow: var(--sol-scope-switcher-focus-ring);
    }

    .sol-scope-switcher__trigger--open {
      border-color: var(--sol-scope-switcher-accent);
    }

    .sol-scope-switcher__trigger:disabled {
      cursor: not-allowed;
      opacity: var(--sol-scope-switcher-disabled-opacity);
    }

    .sol-scope-switcher__arrow {
      flex-shrink: 0;
      color: var(--sol-scope-switcher-muted);
      transition: transform var(--sol-scope-switcher-transition);
    }

    .sol-scope-switcher__arrow--open {
      transform: rotate(180deg);
    }

    /* ── Etiquetas ─────────────────────────────────────────────────────────── */

    .sol-scope-switcher__icon {
      flex-shrink: 0;
      color: var(--sol-scope-switcher-muted);
    }

    .sol-scope-switcher__labels {
      display: flex;
      flex-direction: column;
      min-width: 0;
      flex: 1;
    }

    .sol-scope-switcher__label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: var(--sol-scope-switcher-weight);
    }

    .sol-scope-switcher__sublabel {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: var(--sol-scope-switcher-sub-font-size);
      font-weight: normal;
      color: var(--sol-scope-switcher-muted);
    }

    /* ── Panel portaleado ──────────────────────────────────────────────────── */

    .sol-scope-switcher__panel {
      /* Base absoluta como respaldo; al portalearse recibe position:fixed y
         coordenadas inline calculadas del disparador. El z-index lo aporta la
         clase compartida .sol-floating-panel de la directiva. */
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      display: flex;
      flex-direction: column;
      min-width: 15rem;
      max-width: 22rem;
      max-height: 20rem;
      overflow-y: auto;
      padding: 0.25rem;
      background: var(--sol-scope-switcher-bg);
      border: var(--sol-scope-switcher-border-width) solid var(--sol-scope-switcher-border);
      border-radius: var(--sol-scope-switcher-radius);
      box-shadow: var(--sol-scope-switcher-shadow);
      animation: sol-scope-switcher-fade 0.12s ease-out;
    }

    .sol-scope-switcher__panel--up {
      top: auto;
      bottom: calc(100% + 4px);
    }

    .sol-scope-switcher__option {
      display: flex;
      align-items: center;
      gap: var(--sol-scope-switcher-gap);
      width: 100%;
      padding: 0.5rem 0.625rem;
      font-family: inherit;
      font-size: var(--sol-scope-switcher-font-size);
      color: var(--sol-scope-switcher-text);
      text-align: left;
      background: transparent;
      border: none;
      border-radius: calc(var(--sol-scope-switcher-radius) - 2px);
      cursor: pointer;
      transition: background var(--sol-scope-switcher-transition);
    }

    .sol-scope-switcher__option:hover {
      background: var(--sol-scope-switcher-hover);
    }

    .sol-scope-switcher__option:focus-visible {
      outline: none;
      box-shadow: var(--sol-scope-switcher-focus-ring);
    }

    .sol-scope-switcher__option--active {
      background: var(--sol-scope-switcher-active-bg);
    }

    .sol-scope-switcher__option--active .sol-scope-switcher__label {
      color: var(--sol-scope-switcher-accent);
    }

    .sol-scope-switcher__check {
      flex-shrink: 0;
      color: var(--sol-scope-switcher-accent);
    }

    /* ── Error ─────────────────────────────────────────────────────────────── */

    .sol-scope-switcher__error {
      display: flex;
      align-items: flex-start;
      gap: 0.375rem;
      margin: 0.25rem 0 0;
      font-size: var(--sol-scope-switcher-sub-font-size);
      line-height: 1.4;
      color: var(--sol-scope-switcher-danger);
    }

    .sol-scope-switcher__error-icon {
      flex-shrink: 0;
      color: var(--sol-scope-switcher-danger);
    }

    @keyframes sol-scope-switcher-fade {
      from {
        opacity: 0;
        transform: translateY(-4px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .sol-scope-switcher__panel {
        animation: none;
      }
      .sol-scope-switcher__arrow,
      .sol-scope-switcher__trigger,
      .sol-scope-switcher__option {
        transition: none;
      }
    }
  `,
})
export class SolScopeSwitcherComponent<TData = unknown> {
  private readonly i18n = inject(SOL_I18N);
  private readonly hostEl = inject<ElementRef<HTMLElement>>(ElementRef);

  // ── Entradas ────────────────────────────────────────────────────────────────

  /**
   * Ámbitos disponibles, en el orden en que deben listarse. Tolera `null` y
   * `undefined` para servir sin ceremonia al patrón asíncrono
   * (`[scopes]="stream$ | async"`), que emite vacío antes de traer datos.
   */
  readonly scopes = input<readonly SolScope<TData>[] | null | undefined>([]);

  /**
   * Id del ámbito activo. `null` (o un id que ya no está en la lista) cae al
   * primer ámbito disponible: el backend suele aplicar ese mismo respaldo, y
   * mostrar un disparador en blanco sería mentirle al usuario sobre el
   * contexto en el que realmente está trabajando.
   */
  readonly activeScopeId = input<string | null | undefined>(null);

  /** Estado del selector. La lista vacía se deriva de `scopes`, no de aquí. */
  readonly status = input<SolScopeSwitcherStatus>('idle');

  /**
   * Congela el disparador sin ocultar el contexto (p. ej. mientras la
   * aplicación verifica el acceso al ámbito recién elegido).
   */
  readonly disabled = input<boolean>(false);

  /** Borde del disparador contra el que se alinea el panel. */
  readonly align = input<SolFloatingPanelAlign>('end');

  /**
   * Mensaje de error ya resuelto. Sobrescribe el texto por defecto para que la
   * aplicación distinga "sin conexión" de "perdiste el acceso"; si viene vacío,
   * se usa la clave `shared.scopeSwitcher.error`.
   */
  readonly errorMessage = input<string>('');

  /** Texto del estado vacío. Vacío ⇒ clave `shared.scopeSwitcher.empty`. */
  readonly emptyMessage = input<string>('');

  /** Texto del estado de carga. Vacío ⇒ clave `shared.scopeSwitcher.loading`. */
  readonly loadingMessage = input<string>('');

  /** `aria-label` del disparador. Vacío ⇒ clave `shared.scopeSwitcher.trigger`. */
  readonly triggerAriaLabel = input<string>('');

  /** `aria-label` del panel. Vacío ⇒ clave `shared.scopeSwitcher.panel`. */
  readonly panelAriaLabel = input<string>('');

  // ── Salidas ─────────────────────────────────────────────────────────────────

  /**
   * Emite el ámbito elegido, con su `data` intacta. El componente NO persiste,
   * NO recarga y NO reintenta: la aplicación decide qué hacer con el evento.
   *
   * No emite cuando el usuario vuelve a elegir el ámbito que ya estaba activo —
   * en el consumidor eso equivaldría a reiniciar todo el contexto sin motivo.
   */
  readonly scopeSelected = output<SolScope<TData>>();

  /** Emite al abrir (`true`) y al cerrar (`false`) el panel. */
  readonly openChange = output<boolean>();

  // ── Estado interno ──────────────────────────────────────────────────────────

  /** Verdadero mientras el panel está desplegado. */
  readonly isOpen = signal(false);

  /** Verdadero cuando el panel volteó hacia arriba (lo decide la directiva). */
  readonly dropUp = signal(false);

  /** Índice del ámbito enfocado por teclado; `-1` cuando el panel está cerrado. */
  readonly highlightedIndex = signal(-1);

  /** Altura estimada del panel: umbral de volteo de `solFloatingPanel`. */
  readonly panelFlipThreshold = 320;

  private static nextId = 0;

  /** Id único que enlaza el disparador (`aria-controls`) con el panel portaleado. */
  readonly panelId = `sol-scope-switcher-panel-${SolScopeSwitcherComponent.nextId++}`;

  private readonly triggerRef = viewChild<ElementRef<HTMLButtonElement>>('triggerBtn');
  private readonly panelRef = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly optionRefs = viewChildren<ElementRef<HTMLButtonElement>>('optionBtn');

  // ── Derivados ───────────────────────────────────────────────────────────────

  /** Lista normalizada: `null`/`undefined` se comportan como lista vacía. */
  readonly scopeList = computed<readonly SolScope<TData>[]>(() => this.scopes() ?? []);

  /** No hay ámbitos que listar. Es un estado legítimo, nunca un error. */
  readonly isEmpty = computed(() => this.scopeList().length === 0);

  /** Un único ámbito: se muestra como activo, sin obligar a elegir. */
  readonly isSingle = computed(() => this.scopeList().length === 1);

  /** El selector está reportando una falla. */
  readonly hasError = computed(() => this.status() === 'error');

  /** Id realmente vigente: el explícito si sigue en la lista, si no el primero. */
  readonly effectiveActiveId = computed<string | null>(() => {
    const list = this.scopeList();
    const explicit = this.activeScopeId();
    if (explicit != null && list.some((scope) => scope.id === explicit)) return explicit;
    return list[0]?.id ?? null;
  });

  /** Ámbito activo resuelto, o `null` cuando la lista está vacía. */
  readonly activeScope = computed<SolScope<TData> | null>(() => {
    const id = this.effectiveActiveId();
    return this.scopeList().find((scope) => scope.id === id) ?? null;
  });

  // ── Textos ──────────────────────────────────────────────────────────────────
  // Idioma "sobrescritura primero, clave después" (mismo idiom que sol-date-picker):
  // el consumidor puede pasar su propio texto, y si no, manda el catálogo i18n.

  private readonly loadingKey = this.i18n.t(`${I18N_PREFIX}.loading`);
  private readonly emptyKey = this.i18n.t(`${I18N_PREFIX}.empty`);
  private readonly errorKey = this.i18n.t(`${I18N_PREFIX}.error`);
  private readonly triggerAriaKey = this.i18n.t(`${I18N_PREFIX}.trigger`);
  private readonly panelAriaKey = this.i18n.t(`${I18N_PREFIX}.panel`);
  private readonly activeOptionAriaKey = this.i18n.t(`${I18N_PREFIX}.activeOption`);

  readonly loadingText = computed(() => this.loadingMessage() || this.loadingKey());
  readonly emptyText = computed(() => this.emptyMessage() || this.emptyKey());
  readonly errorText = computed(() => this.errorMessage() || this.errorKey());
  readonly triggerAriaText = computed(() => this.triggerAriaLabel() || this.triggerAriaKey());
  readonly panelAriaText = computed(() => this.panelAriaLabel() || this.panelAriaKey());
  readonly activeOptionAriaText = this.activeOptionAriaKey;

  constructor() {
    // Foco itinerante del listbox: la opción resaltada recibe el foco real (en
    // vez de simularlo con aria-activedescendant), así el lector de pantalla y
    // el foco visible del navegador cuentan siempre la misma historia. El
    // efecto depende de `optionRefs`, así que también corre en la primera
    // materialización del panel, no solo en los cambios de índice posteriores.
    effect(() => {
      if (!this.isOpen()) return;
      const index = this.highlightedIndex();
      this.optionRefs()[index]?.nativeElement.focus();
    });
  }

  // ── Interacción ─────────────────────────────────────────────────────────────

  /** Abre o cierra el panel desde el disparador. */
  protected onTriggerClick(): void {
    if (this.isOpen()) {
      this.close();
      return;
    }
    this.open();
  }

  /** Teclado del disparador: abre con flechas/Enter/Espacio. */
  protected onTriggerKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
      case 'Enter':
      case ' ':
        event.preventDefault();
        this.open();
        break;
      default:
        break;
    }
  }

  /** Teclado del panel: navegación itinerante y selección. */
  protected onPanelKeydown(event: KeyboardEvent): void {
    const total = this.scopeList().length;
    if (total === 0) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.highlightedIndex.update((i) => (i + 1) % total);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.highlightedIndex.update((i) => (i - 1 + total) % total);
        break;
      case 'Home':
        event.preventDefault();
        this.highlightedIndex.set(0);
        break;
      case 'End':
        event.preventDefault();
        this.highlightedIndex.set(total - 1);
        break;
      case 'Enter':
      case ' ': {
        event.preventDefault();
        const scope = this.scopeList()[this.highlightedIndex()];
        if (scope) this.select(scope);
        break;
      }
      case 'Tab':
        // Tabular sale del selector: el panel se cierra en vez de dejar el foco
        // suelto en un nodo portaleado fuera del orden natural del documento.
        this.close();
        break;
      default:
        break;
    }
  }

  /** Elige un ámbito, cierra el panel y devuelve el foco al disparador. */
  protected select(scope: SolScope<TData>): void {
    const wasActive = scope.id === this.effectiveActiveId();
    this.close(true);
    if (wasActive) return;
    this.scopeSelected.emit(scope);
  }

  /** Escape cierra el panel y devuelve el foco al disparador. */
  @HostListener('document:keydown.escape')
  protected onDocumentEscape(): void {
    if (!this.isOpen()) return;
    this.close(true);
  }

  /**
   * Clic afuera. El panel vive portaleado en `document.body`, así que "dentro"
   * abarca tanto el host como el nodo portaleado.
   */
  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.isOpen()) return;
    const target = event.target as Node;
    const insideHost = this.hostEl.nativeElement.contains(target);
    const insidePanel = this.panelRef()?.nativeElement.contains(target) ?? false;
    if (!insideHost && !insidePanel) this.close();
  }

  // ── Ciclo del panel ─────────────────────────────────────────────────────────

  private open(): void {
    if (this.disabled() || this.isOpen()) return;
    const list = this.scopeList();
    const activeIndex = list.findIndex((scope) => scope.id === this.effectiveActiveId());
    // Arranca sobre el ámbito vigente (no en cero): el usuario ve de entrada
    // dónde está parado y llega al vecino con una sola flecha.
    this.highlightedIndex.set(activeIndex >= 0 ? activeIndex : 0);
    this.isOpen.set(true);
    this.openChange.emit(true);
  }

  private close(returnFocus = false): void {
    if (!this.isOpen()) return;
    this.isOpen.set(false);
    this.highlightedIndex.set(-1);
    this.openChange.emit(false);
    if (returnFocus) this.triggerRef()?.nativeElement.focus();
  }
}
