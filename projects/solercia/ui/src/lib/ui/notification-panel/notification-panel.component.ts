import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { SOL_I18N } from '../../i18n/sol-i18n';
import { SolBadgeComponent } from '../badge/badge.component';
import { SolButtonComponent } from '../button/button.component';
import { SolEmptyStateComponent } from '../empty-state/empty-state.component';
import { SolIconComponent } from '../icon/icon.component';
import { SolIconButtonComponent } from '../icon-button/icon-button.component';
import { SolSpinnerComponent } from '../spinner/spinner.component';

/**
 * Tono visual de la etiqueta de tipo de una notificación. Coincide 1:1 con
 * las variantes de `sol-badge` — la librería NUNCA conoce el catálogo de
 * tipos del consumidor (el original acoplado resolvía `RULE_TYPE_LABELS`),
 * así que el consumidor entrega la etiqueta YA resuelta y, opcionalmente,
 * el tono con el que debe pintarse.
 */
export type SolNotificationTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/**
 * Notificación genérica del panel. Sin conocimiento de dominio: no hay
 * `rule_type`, `target_type` ni `target_id` — lo que el consumidor necesite
 * para enrutar viaja opaco en `data` y regresa intacto en los outputs.
 *
 * `title`/`body` son DATOS del consumidor (texto ya listo para mostrar), no
 * copy de UI: por eso son texto crudo y no claves i18n, igual que
 * `TimelineNode.label`. El copy propio del panel (títulos de estado,
 * acciones, tiempo relativo) sí se resuelve por `SOL_I18N`.
 */
export interface SolNotificationItem<TData = unknown> {
  /** Identidad estable — usada como `track` del `@for`. */
  id: string | number;

  /** Título visible. Dato del consumidor, ya traducido. */
  title: string;

  /** Cuerpo/descripción opcional. Se recorta a dos líneas. */
  body?: string;

  /**
   * Marca de tiempo del evento. Tolera `string` ISO, epoch-ms, `Date`,
   * `null` y `undefined`; un valor inválido se trata como ausente y la fila
   * simplemente no muestra tiempo (nunca "Invalid Date").
   */
  timestamp?: string | number | Date | null;

  /** `true` cuando ya fue leída. Ausente equivale a NO leída. */
  read?: boolean;

  /** Etiqueta de tipo ya resuelta a texto por el consumidor. */
  typeLabel?: string;

  /** Tono del `sol-badge` de la etiqueta de tipo. Default: `neutral`. */
  tone?: SolNotificationTone;

  /** Carga libre del consumidor. La librería no la lee: solo la devuelve. */
  data?: TData;
}

/** Estado excluyente que el panel está renderizando en este momento. */
export type SolNotificationPanelState = 'loading' | 'error' | 'empty' | 'content';

/** Fila derivada: la notificación más lo que el panel calculó para pintarla. */
interface SolNotificationRow<T> {
  item: T;
  timeLabel: string;
  tone: SolNotificationTone;
}

const MINUTE_MS = 60_000;

/**
 * `sol-notification-panel` — centro de notificaciones genérico y sin
 * acoplamiento al dominio.
 *
 * Extraído del `notification-panel` de `solercia-command`, que inyectaba
 * `NotificationsService` (se auto-alimentaba), inyectaba `Router` (navegaba
 * solo) e importaba `AppNotification`/`RULE_TYPE_LABELS` de `@entities`.
 * Aquí SUBE únicamente la presentación: la lista, el contador de no leídas,
 * los estados y las acciones. QUEDA en la aplicación de dónde salen los
 * datos y a dónde navega cada notificación — el panel no inyecta servicios
 * de datos, no llama HTTP y no navega: **emite**.
 *
 * ## Vacío ≠ error (deuda que este componente salda)
 *
 * El original mostraba "no hay notificaciones" también cuando la carga
 * fallaba (su `error:` solo apagaba el spinner), así que le mentía al
 * usuario. Aquí `state()` es excluyente y ordenado —
 * `loading` › `error` › `empty` › `content`— con `error` ANTES de `empty`:
 * una carga fallida deja `items` vacío, y si `empty` ganara volveríamos a
 * decir "no tienes notificaciones" cuando la verdad es "no pudimos saberlo".
 * Además el estado de error se pinta con estructura, tono y `role="alert"`
 * propios (nunca el `sol-empty-state`) y ofrece salida vía `retryRequested`.
 *
 * ## Fuente de verdad
 *
 * El panel NO guarda un espejo interno de `read`: lo pinta desde `items`.
 * Marcar como leída emite y espera que el consumidor reasigne `items` — así
 * la UI nunca afirma un cambio que el backend rechazó.
 *
 * Uso:
 * ```html
 * <sol-notification-panel
 *   [items]="notificaciones()"
 *   [loading]="cargando()"
 *   [error]="fallo()"
 *   [errorMessage]="mensajeDelBackend()"
 *   (itemSelected)="abrir($event)"
 *   (markedRead)="marcarLeida($event)"
 *   (markedAllRead)="marcarTodas()"
 *   (retryRequested)="recargar()"
 *   (closed)="cerrar()"
 * />
 * ```
 */
@Component({
  selector: 'sol-notification-panel',
  standalone: true,
  imports: [
    SolBadgeComponent,
    SolButtonComponent,
    SolEmptyStateComponent,
    SolIconComponent,
    SolIconButtonComponent,
    SolSpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sol-notification-panel" role="dialog" [attr.aria-label]="dialogAria()">
      <header class="sol-notification-panel__header">
        <div class="sol-notification-panel__heading">
          <h2 class="sol-notification-panel__title">{{ title() }}</h2>
          @if (unreadCount() > 0) {
            <span
              class="sol-notification-panel__unread"
              role="status"
              [attr.aria-label]="unreadAria()"
            >
              <sol-badge variant="info" size="sm">{{ unreadCount() }}</sol-badge>
            </span>
          }
        </div>

        <div class="sol-notification-panel__header-actions">
          @if (unreadCount() > 0) {
            <sol-button
              variant="ghost"
              size="sm"
              class="sol-notification-panel__mark-all"
              (clicked)="markedAllRead.emit()"
            >
              {{ markAllReadLabel() }}
            </sol-button>
          }
          <sol-icon-button
            icon="x-mark"
            variant="ghost"
            size="touch"
            [ariaLabel]="closeLabel()"
            (clicked)="closed.emit()"
          />
        </div>
      </header>

      <div class="sol-notification-panel__body" [attr.data-state]="state()">
        @switch (state()) {
          @case ('loading') {
            <div class="sol-notification-panel__loading">
              <sol-spinner size="md" />
            </div>
          }

          @case ('error') {
            <div class="sol-notification-panel__error" role="alert">
              <span class="sol-notification-panel__error-icon" aria-hidden="true">
                <sol-icon name="exclamation-triangle" size="lg" />
              </span>
              <p class="sol-notification-panel__error-title">{{ errorTitle() }}</p>
              <p class="sol-notification-panel__error-description">{{ errorDescription() }}</p>
              <sol-button variant="secondary" size="sm" (clicked)="retryRequested.emit()">
                {{ retryLabel() }}
              </sol-button>
            </div>
          }

          @case ('empty') {
            <sol-empty-state
              class="sol-notification-panel__empty"
              icon="bell"
              [titleKey]="emptyTitleKey()"
              [descriptionKey]="emptyDescriptionKey()"
            />
          }

          @default {
            <ul class="sol-notification-panel__list" role="list">
              @for (row of rows(); track row.item.id) {
                <li
                  class="sol-notification-panel__item"
                  [class.sol-notification-panel__item--unread]="!row.item.read"
                >
                  <button
                    type="button"
                    class="sol-notification-panel__content"
                    (click)="itemSelected.emit(row.item)"
                  >
                    <span class="sol-notification-panel__item-title">
                      @if (!row.item.read) {
                        <span
                          class="sol-notification-panel__dot"
                          [attr.aria-label]="unreadDotLabel()"
                        ></span>
                      }
                      {{ row.item.title }}
                    </span>

                    @if (row.item.body) {
                      <span class="sol-notification-panel__item-body">{{ row.item.body }}</span>
                    }

                    @if (row.item.typeLabel || row.timeLabel) {
                      <span class="sol-notification-panel__meta">
                        @if (row.item.typeLabel) {
                          <sol-badge [variant]="row.tone" size="sm">
                            {{ row.item.typeLabel }}
                          </sol-badge>
                        }
                        @if (row.timeLabel) {
                          <span class="sol-notification-panel__time">{{ row.timeLabel }}</span>
                        }
                      </span>
                    }
                  </button>

                  @if (!row.item.read) {
                    <sol-icon-button
                      icon="check"
                      variant="ghost"
                      size="touch"
                      class="sol-notification-panel__mark-read"
                      [ariaLabel]="markReadLabel()"
                      (clicked)="markedRead.emit(row.item)"
                    />
                  }
                </li>
              }
            </ul>
          }
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      font-family: var(--sol-font-family, inherit);
    }

    .sol-notification-panel {
      display: flex;
      flex-direction: column;
      width: 100%;
      overflow: hidden;
      border: var(--sol-border-width-default, 1px) solid var(--sol-border-color-default, #e2e8f0);
      border-radius: var(--sol-card-radius, var(--sol-border-radius-lg, 12px));
      background: var(--sol-card-bg, var(--sol-bg-surface, #fff));
      box-shadow: var(--sol-shadow-lg, 0 10px 25px rgb(15 23 42 / 12%));
    }

    /* ---- header ---- */

    .sol-notification-panel__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sol-space-sm, 8px);
      padding: var(--sol-space-sm, 8px) var(--sol-space-md, 16px);
      border-bottom: var(--sol-border-width-default, 1px) solid
        var(--sol-border-color-default, #e2e8f0);
    }

    .sol-notification-panel__heading {
      display: inline-flex;
      align-items: center;
      gap: var(--sol-space-sm, 8px);
      min-width: 0;
    }

    .sol-notification-panel__title {
      margin: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: var(--sol-font-size-base, 0.9375rem);
      font-weight: var(--sol-font-weight-bold, 600);
      color: var(--sol-color-text-primary, #0f172a);
    }

    .sol-notification-panel__unread {
      display: inline-flex;
    }

    .sol-notification-panel__header-actions {
      display: inline-flex;
      align-items: center;
      gap: var(--sol-space-xs, 4px);
      flex-shrink: 0;
    }

    /* ---- cuerpo ---- */

    .sol-notification-panel__body {
      max-height: 28rem;
      overflow-y: auto;
    }

    .sol-notification-panel__loading {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--sol-space-xl, 40px) var(--sol-space-md, 16px);
    }

    /* El estado vacío usa sol-empty-state; el de error NO — deben verse
       distintos a simple vista, no solo decir cosas distintas. */
    .sol-notification-panel__error {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: var(--sol-space-xs, 4px);
      padding: var(--sol-space-xl, 40px) var(--sol-space-md, 16px);
      background: color-mix(in srgb, var(--sol-color-danger, #ef4444) 6%, transparent);
    }

    .sol-notification-panel__error-icon {
      display: inline-flex;
      color: var(--sol-color-danger, #ef4444);
      margin-bottom: var(--sol-space-xs, 4px);
    }

    .sol-notification-panel__error-title {
      margin: 0;
      font-size: var(--sol-font-size-sm, 0.875rem);
      font-weight: var(--sol-font-weight-bold, 600);
      color: var(--sol-color-text-primary, #0f172a);
    }

    .sol-notification-panel__error-description {
      margin: 0 0 var(--sol-space-sm, 8px);
      max-width: 32ch;
      font-size: var(--sol-font-size-sm, 0.8125rem);
      color: var(--sol-color-text-muted, #64748b);
    }

    .sol-notification-panel__empty {
      display: block;
    }

    /* ---- lista ---- */

    .sol-notification-panel__list {
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .sol-notification-panel__item {
      display: flex;
      align-items: flex-start;
      gap: var(--sol-space-xs, 4px);
      padding-right: var(--sol-space-sm, 8px);
      border-bottom: var(--sol-border-width-default, 1px) solid
        var(--sol-border-color-default, #e2e8f0);
      transition: background-color var(--sol-dur-fast, 150ms) var(--sol-ease, ease);
    }

    .sol-notification-panel__item:last-child {
      border-bottom: none;
    }

    .sol-notification-panel__item:hover {
      background: var(--sol-bg-sunken, color-mix(in srgb, var(--sol-color-primary, #2563eb) 5%, transparent));
    }

    .sol-notification-panel__item--unread {
      background: color-mix(in srgb, var(--sol-color-info, #3b82f6) 7%, transparent);
    }

    .sol-notification-panel__content {
      display: grid;
      gap: 2px;
      flex: 1 1 auto;
      min-width: 0;
      margin: 0;
      padding: var(--sol-space-sm, 10px) var(--sol-space-md, 16px);
      border: none;
      background: transparent;
      font: inherit;
      text-align: left;
      cursor: pointer;
    }

    .sol-notification-panel__content:focus-visible {
      outline: none;
      box-shadow: var(
        --sol-focus-ring,
        inset 0 0 0 2px color-mix(in srgb, var(--sol-color-primary, #2563eb) 45%, transparent)
      );
    }

    .sol-notification-panel__item-title {
      display: flex;
      align-items: center;
      gap: var(--sol-space-xs, 6px);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: var(--sol-font-size-sm, 0.875rem);
      font-weight: var(--sol-font-weight-normal, 500);
      color: var(--sol-color-text-primary, #0f172a);
    }

    .sol-notification-panel__item--unread .sol-notification-panel__item-title {
      font-weight: var(--sol-font-weight-bold, 600);
    }

    .sol-notification-panel__dot {
      width: 7px;
      height: 7px;
      flex-shrink: 0;
      border-radius: var(--sol-border-radius-full, 9999px);
      background: var(--sol-color-info, #3b82f6);
    }

    .sol-notification-panel__item-body {
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      overflow: hidden;
      font-size: var(--sol-font-size-sm, 0.75rem);
      color: var(--sol-color-text-muted, #64748b);
    }

    .sol-notification-panel__meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sol-space-xs, 6px);
      margin-top: var(--sol-space-xs, 4px);
    }

    .sol-notification-panel__time {
      font-size: var(--sol-font-size-sm, 0.6875rem);
      color: var(--sol-color-text-secondary, #94a3b8);
    }

    .sol-notification-panel__mark-read {
      align-self: center;
      flex-shrink: 0;
    }

    @media (prefers-reduced-motion: reduce) {
      .sol-notification-panel__item {
        transition: none;
      }
    }
  `,
})
export class SolNotificationPanelComponent<
  T extends SolNotificationItem = SolNotificationItem,
> {
  private readonly i18n = inject(SOL_I18N);

  /**
   * Notificaciones a mostrar. El panel NO las va a buscar: el consumidor es
   * la fuente de verdad. Tipado con `null | undefined` a propósito, para el
   * patrón `[items]="stream$ | async"` (misma lección que `sol-timeline`).
   */
  readonly items = input<readonly T[] | null | undefined>([]);

  /** `true` mientras la carga está en curso. Gana sobre cualquier otro estado. */
  readonly loading = input<boolean>(false);

  /** `true` cuando la carga falló. Gana sobre el vacío — nunca se confunden. */
  readonly error = input<boolean>(false);

  /**
   * Detalle del error tal como lo reportó el consumidor (mensaje del
   * backend). Cuando viene, reemplaza la descripción genérica: un error
   * específico jamás debe degradarse a "algo salió mal".
   */
  readonly errorMessage = input<string>('');

  /**
   * Claves i18n del estado vacío. Son inputs (no constantes) para que un
   * consumidor que filtra la lista distinga "todavía no hay nada" de "no hay
   * resultados con este filtro" sin que la librería conozca filtro alguno.
   */
  readonly emptyTitleKey = input<string>('shared.notificationPanel.emptyTitle');
  readonly emptyDescriptionKey = input<string>('shared.notificationPanel.emptyDescription');

  /** Se activó una notificación. El consumidor decide a dónde lleva. */
  readonly itemSelected = output<T>();

  /** Se pidió marcar UNA notificación como leída. */
  readonly markedRead = output<T>();

  /** Se pidió marcar todas como leídas. */
  readonly markedAllRead = output<void>();

  /**
   * Se pidió reintentar la carga. Añadido sobre los cuatro outputs del
   * encargo: un estado de error sin salida es un callejón sin salida — el
   * usuario ve el fallo y no puede hacer nada desde el panel.
   */
  readonly retryRequested = output<void>();

  /** Se pidió cerrar el panel. */
  readonly closed = output<void>();

  /** Lista normalizada: `null`/`undefined` se tratan como vacía. */
  private readonly list = computed<readonly T[]>(() => this.items() ?? []);

  /** Notificaciones sin leer. `read` ausente cuenta como NO leída. */
  readonly unreadCount = computed(() =>
    this.list().reduce((total, item) => total + (item.read ? 0 : 1), 0),
  );

  /**
   * Estado excluyente. El orden es la corrección de fondo: `error` ANTES de
   * `empty`, porque una carga fallida también deja la lista vacía.
   */
  readonly state = computed<SolNotificationPanelState>(() => {
    if (this.loading()) return 'loading';
    if (this.error()) return 'error';
    return this.list().length === 0 ? 'empty' : 'content';
  });

  /** Filas listas para pintar: la notificación + su tiempo relativo y tono. */
  readonly rows = computed<SolNotificationRow<T>[]>(() => {
    this.i18n.activeLang();
    const now = Date.now();
    return this.list().map((item) => ({
      item,
      timeLabel: this.formatRelativeTime(item.timestamp, now),
      tone: item.tone ?? 'neutral',
    }));
  });

  // ---- copy propio del panel (claves fijas → `t()` reactivo) ----

  readonly dialogAria = this.i18n.t('shared.notificationPanel.dialogAria');
  readonly title = this.i18n.t('shared.notificationPanel.title');
  readonly markAllReadLabel = this.i18n.t('shared.notificationPanel.markAllRead');
  readonly closeLabel = this.i18n.t('shared.notificationPanel.close');
  readonly markReadLabel = this.i18n.t('shared.notificationPanel.markRead');
  readonly unreadDotLabel = this.i18n.t('shared.notificationPanel.unreadDot');
  readonly errorTitle = this.i18n.t('shared.notificationPanel.errorTitle');
  readonly retryLabel = this.i18n.t('shared.notificationPanel.retry');

  /** Etiqueta accesible del contador; el badge solo muestra el número. */
  readonly unreadAria = computed(() => {
    this.i18n.activeLang();
    return this.i18n.translate('shared.notificationPanel.unreadCount', {
      count: this.unreadCount(),
    });
  });

  /** Descripción del error: el mensaje real del consumidor si lo hay. */
  readonly errorDescription = computed(() => {
    this.i18n.activeLang();
    const detail = this.errorMessage().trim();
    return detail || this.i18n.translate('shared.notificationPanel.errorDescription');
  });

  /**
   * Formatea la marca de tiempo como texto relativo ("hace 2 h"). Devuelve
   * cadena vacía cuando falta o es inválida — el panel omite el tiempo en vez
   * de mostrar basura.
   */
  private formatRelativeTime(value: SolNotificationItem['timestamp'], now: number): string {
    if (value === null || value === undefined) return '';

    const ms =
      value instanceof Date
        ? value.getTime()
        : typeof value === 'number'
          ? value
          : Date.parse(value);
    if (!Number.isFinite(ms)) return '';

    const minutes = Math.floor((now - ms) / MINUTE_MS);
    if (minutes < 1) return this.i18n.translate('shared.notificationPanel.relativeTime.now');
    if (minutes < 60) {
      return this.i18n.translate('shared.notificationPanel.relativeTime.minutes', {
        count: minutes,
      });
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return this.i18n.translate('shared.notificationPanel.relativeTime.hours', { count: hours });
    }

    return this.i18n.translate('shared.notificationPanel.relativeTime.days', {
      count: Math.floor(hours / 24),
    });
  }
}
