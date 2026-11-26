import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  forwardRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { injectSolI18n } from '../../i18n/inject-sol-i18n';
import { SolIconComponent } from '../icon/icon.component';
import {
  sanitizeHtmlToTcpdf,
  serializeElementToTcpdfHtml,
} from './rich-editor-serializer';

/** Hook opcional para subir una imagen y devolver su URL definitiva. */
export type SolRichImageUploader = (file: File) => Promise<string>;

/**
 * Usuario mencionable con `@` (opt-in). Al elegirlo se inserta un chip
 * `<span data-mention-id="id">@name</span>` y se emite su `id` en
 * `mentionsChange`.
 */
export interface MentionUser {
  id: string;
  name: string;
}

/**
 * Tarea enlazable con `#` (opt-in). Al elegirla se inserta un chip
 * `<span data-task-key="key">key</span>` y se emite su `key` en
 * `taskLinksChange`.
 */
export interface LinkableTask {
  key: string;
  title: string;
}

/** Estado de los formatos activos bajo el cursor (para resaltar la toolbar). */
interface ActiveFormats {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  bulletList: boolean;
  numberedList: boolean;
  alignLeft: boolean;
  alignCenter: boolean;
  alignRight: boolean;
}

const EMPTY_FORMATS: ActiveFormats = {
  bold: false, italic: false, underline: false, strike: false,
  bulletList: false, numberedList: false,
  alignLeft: false, alignCenter: false, alignRight: false,
};

/** Tamaño máximo de la rejilla del selector de tablas. */
const TABLE_GRID_MAX = 8;

/** Máximo de resultados listados en el popover de menciones/tareas. */
const MENTION_MAX_RESULTS = 8;
/** Longitud máxima de la consulta tras `@`/`#` antes de descartar el trigger. */
const MENTION_QUERY_MAX = 30;
/** Ancho de referencia del popover (px) para acotar su posición horizontal. */
const POPOVER_WIDTH = 208;

/**
 * `sol-rich-editor` — editor de texto enriquecido PROPIO del design system.
 *
 * - `ControlValueAccessor`: funciona con `ngModel`/reactive forms. El value
 *   NUNCA es el `innerHTML` crudo del área editable: es SIEMPRE el HTML limpio
 *   serializado por `serializeElementToTcpdfHtml` (canónico, apto para TCPDF).
 *   El DOM vivo del `contenteditable` es efímero; el value se deriva de él.
 * - Comandos: enfoque HÍBRIDO. Los comandos de formato inline, listas,
 *   encabezados y alineación usan `document.execCommand` (robusto para el
 *   manejo del cursor/selección entre navegadores, aunque esté deprecado); la
 *   inserción de imágenes, tablas y enlaces usa la API `Selection`/`Range`
 *   propia. La "suciedad" que produce `execCommand` (p. ej. `<font>`, spans con
 *   estilo) es irrelevante: el serializador normaliza toda la salida.
 * - Pegado: SIEMPRE saneado por el mismo serializador (allowlist) antes de
 *   tocar el DOM. Las imágenes del portapapeles se insertan como data URL (o
 *   vía el hook `imageUpload`).
 * - Theming: adopta los tokens `var(--sol-*)` (bordes, foco, tipografía) y
 *   soporta light/dark como todo átomo del sistema.
 */
@Component({
  selector: 'sol-rich-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SolIconComponent],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SolRichEditorComponent),
      multi: true,
    },
  ],
  template: `
    <div class="sol-rich-editor" [class.sol-rich-editor--disabled]="isDisabled()">
      <!-- ── Toolbar ─────────────────────────────────────────────────── -->
      <div class="sol-rich-editor__toolbar" role="toolbar" [attr.aria-label]="labels().toolbar">
        <!-- Formato inline -->
        <div class="sol-rich-editor__group">
          <button
            type="button" class="sol-rich-editor__btn"
            [class.is-active]="active().bold" [disabled]="isDisabled()"
            [attr.aria-label]="labels().bold" [attr.title]="labels().bold" [attr.aria-pressed]="active().bold"
            (mousedown)="preventSteal($event)" (click)="cmd('bold')"
          ><sol-icon name="bold" size="sm" /></button>
          <button
            type="button" class="sol-rich-editor__btn"
            [class.is-active]="active().italic" [disabled]="isDisabled()"
            [attr.aria-label]="labels().italic" [attr.title]="labels().italic" [attr.aria-pressed]="active().italic"
            (mousedown)="preventSteal($event)" (click)="cmd('italic')"
          ><sol-icon name="italic" size="sm" /></button>
          <button
            type="button" class="sol-rich-editor__btn"
            [class.is-active]="active().underline" [disabled]="isDisabled()"
            [attr.aria-label]="labels().underline" [attr.title]="labels().underline" [attr.aria-pressed]="active().underline"
            (mousedown)="preventSteal($event)" (click)="cmd('underline')"
          ><sol-icon name="underline" size="sm" /></button>
          <button
            type="button" class="sol-rich-editor__btn"
            [class.is-active]="active().strike" [disabled]="isDisabled()"
            [attr.aria-label]="labels().strike" [attr.title]="labels().strike" [attr.aria-pressed]="active().strike"
            (mousedown)="preventSteal($event)" (click)="cmd('strikeThrough')"
          ><sol-icon name="strikethrough" size="sm" /></button>
        </div>

        <span class="sol-rich-editor__sep" aria-hidden="true"></span>

        <!-- Encabezados -->
        <div class="sol-rich-editor__group sol-rich-editor__group--menu">
          <button
            type="button" class="sol-rich-editor__btn"
            [class.is-active]="showHeadingMenu()" [disabled]="isDisabled()"
            [attr.aria-label]="labels().heading" [attr.title]="labels().heading"
            [attr.aria-expanded]="showHeadingMenu()"
            (mousedown)="onTriggerMousedown($event)" (click)="toggleMenu('heading')"
          ><sol-icon name="heading" size="sm" /></button>
          @if (showHeadingMenu()) {
            <div class="sol-rich-editor__menu" role="menu">
              <button type="button" role="menuitem" class="sol-rich-editor__menu-item"
                (mousedown)="preventSteal($event)" (click)="applyHeading('p')">{{ labels().paragraph }}</button>
              <button type="button" role="menuitem" class="sol-rich-editor__menu-item sol-rich-editor__menu-item--h1"
                (mousedown)="preventSteal($event)" (click)="applyHeading('h1')">{{ labels().heading1 }}</button>
              <button type="button" role="menuitem" class="sol-rich-editor__menu-item sol-rich-editor__menu-item--h2"
                (mousedown)="preventSteal($event)" (click)="applyHeading('h2')">{{ labels().heading2 }}</button>
              <button type="button" role="menuitem" class="sol-rich-editor__menu-item sol-rich-editor__menu-item--h3"
                (mousedown)="preventSteal($event)" (click)="applyHeading('h3')">{{ labels().heading3 }}</button>
            </div>
          }
        </div>

        <!-- Listas -->
        <div class="sol-rich-editor__group">
          <button
            type="button" class="sol-rich-editor__btn"
            [class.is-active]="active().bulletList" [disabled]="isDisabled()"
            [attr.aria-label]="labels().bulletList" [attr.title]="labels().bulletList" [attr.aria-pressed]="active().bulletList"
            (mousedown)="preventSteal($event)" (click)="cmd('insertUnorderedList')"
          ><sol-icon name="list-bullet" size="sm" /></button>
          <button
            type="button" class="sol-rich-editor__btn"
            [class.is-active]="active().numberedList" [disabled]="isDisabled()"
            [attr.aria-label]="labels().numberedList" [attr.title]="labels().numberedList" [attr.aria-pressed]="active().numberedList"
            (mousedown)="preventSteal($event)" (click)="cmd('insertOrderedList')"
          ><sol-icon name="list-numbered" size="sm" /></button>
        </div>

        <span class="sol-rich-editor__sep" aria-hidden="true"></span>

        <!-- Alineación -->
        <div class="sol-rich-editor__group">
          <button
            type="button" class="sol-rich-editor__btn"
            [class.is-active]="active().alignLeft" [disabled]="isDisabled()"
            [attr.aria-label]="labels().alignLeft" [attr.title]="labels().alignLeft" [attr.aria-pressed]="active().alignLeft"
            (mousedown)="preventSteal($event)" (click)="align('left')"
          ><sol-icon name="align-left" size="sm" /></button>
          <button
            type="button" class="sol-rich-editor__btn"
            [class.is-active]="active().alignCenter" [disabled]="isDisabled()"
            [attr.aria-label]="labels().alignCenter" [attr.title]="labels().alignCenter" [attr.aria-pressed]="active().alignCenter"
            (mousedown)="preventSteal($event)" (click)="align('center')"
          ><sol-icon name="align-center" size="sm" /></button>
          <button
            type="button" class="sol-rich-editor__btn"
            [class.is-active]="active().alignRight" [disabled]="isDisabled()"
            [attr.aria-label]="labels().alignRight" [attr.title]="labels().alignRight" [attr.aria-pressed]="active().alignRight"
            (mousedown)="preventSteal($event)" (click)="align('right')"
          ><sol-icon name="align-right" size="sm" /></button>
        </div>

        <span class="sol-rich-editor__sep" aria-hidden="true"></span>

        <!-- Inserción: imagen, tabla, enlace -->
        <div class="sol-rich-editor__group">
          <button
            type="button" class="sol-rich-editor__btn" [disabled]="isDisabled()"
            [attr.aria-label]="labels().insertImage" [attr.title]="labels().insertImage"
            (mousedown)="onTriggerMousedown($event)" (click)="pickImage()"
          ><sol-icon name="image" size="sm" /></button>

          <!-- Tabla (selector de rejilla) -->
          <div class="sol-rich-editor__group--menu">
            <button
              type="button" class="sol-rich-editor__btn"
              [class.is-active]="showTableMenu()" [disabled]="isDisabled()"
              [attr.aria-label]="labels().insertTable" [attr.title]="labels().insertTable"
              [attr.aria-expanded]="showTableMenu()"
              (mousedown)="onTriggerMousedown($event)" (click)="toggleMenu('table')"
            ><sol-icon name="table" size="sm" /></button>
            @if (showTableMenu()) {
              <div class="sol-rich-editor__menu sol-rich-editor__menu--table" role="menu"
                   [attr.aria-label]="labels().tablePicker">
                <div class="sol-rich-editor__grid">
                  @for (row of gridRange(); track row) {
                    <div class="sol-rich-editor__grid-row">
                      @for (col of gridRange(); track col) {
                        <button
                          type="button" class="sol-rich-editor__grid-cell"
                          [class.is-on]="row <= tableRows() && col <= tableCols()"
                          (mousedown)="preventSteal($event)"
                          (mouseenter)="hoverTable(row, col)"
                          (click)="insertTable(row, col)"
                        ></button>
                      }
                    </div>
                  }
                </div>
                <div class="sol-rich-editor__grid-label">{{ tableRows() }} × {{ tableCols() }}</div>
              </div>
            }
          </div>

          <!-- Enlace -->
          <div class="sol-rich-editor__group--menu">
            <button
              type="button" class="sol-rich-editor__btn"
              [class.is-active]="showLinkMenu()" [disabled]="isDisabled()"
              [attr.aria-label]="labels().insertLink" [attr.title]="labels().insertLink"
              [attr.aria-expanded]="showLinkMenu()"
              (mousedown)="onTriggerMousedown($event)" (click)="toggleMenu('link')"
            ><sol-icon name="link" size="sm" /></button>
            @if (showLinkMenu()) {
              <div class="sol-rich-editor__menu sol-rich-editor__menu--link" role="menu">
                <input
                  #linkInput type="url" class="sol-rich-editor__link-input"
                  [placeholder]="labels().linkPlaceholder" [attr.aria-label]="labels().linkPlaceholder"
                  [value]="linkUrl()" (input)="linkUrl.set($any($event.target).value)"
                  (keydown.enter)="confirmLink()" (keydown.escape)="closeMenus()"
                />
                <div class="sol-rich-editor__link-actions">
                  <button type="button" class="sol-rich-editor__link-btn sol-rich-editor__link-btn--primary"
                    (mousedown)="preventSteal($event)" (click)="confirmLink()">{{ labels().linkConfirm }}</button>
                  <button type="button" class="sol-rich-editor__link-btn"
                    (mousedown)="preventSteal($event)" (click)="removeLink()">{{ labels().removeLink }}</button>
                </div>
              </div>
            }
          </div>
        </div>

        <span class="sol-rich-editor__sep" aria-hidden="true"></span>

        <!-- Quitar formato -->
        <div class="sol-rich-editor__group">
          <button
            type="button" class="sol-rich-editor__btn" [disabled]="isDisabled()"
            [attr.aria-label]="labels().removeFormat" [attr.title]="labels().removeFormat"
            (mousedown)="preventSteal($event)" (click)="removeFormat()"
          ><sol-icon name="remove-format" size="sm" /></button>
        </div>
      </div>

      <!-- ── Área editable ───────────────────────────────────────────── -->
      <div
        #editable
        class="sol-rich-editor__content"
        [class.is-empty]="isEmpty()"
        [attr.contenteditable]="isDisabled() ? 'false' : 'true'"
        [attr.data-placeholder]="placeholder()"
        [attr.aria-label]="editorAriaLabel()"
        [attr.aria-multiline]="'true'"
        role="textbox"
        [style.min-height]="minHeight()"
        [style.max-height]="maxHeight() || null"
        (input)="onInput()"
        (blur)="onBlur()"
        (keydown)="onKeyDown($event)"
        (keyup)="scheduleActiveUpdate()"
        (mouseup)="scheduleActiveUpdate()"
        (paste)="onPaste($event)"
      ></div>

      <!-- ── Popover de menciones (@) — opt-in ──────────────────────────── -->
      @if (showMentionPopover() && filteredUsers().length > 0) {
        <div
          class="sol-rich-editor__popover" role="listbox"
          [attr.aria-label]="labels().mentionList"
          [style.top.px]="popoverTop()" [style.left.px]="popoverLeft()"
        >
          @for (user of filteredUsers(); track user.id; let i = $index) {
            <button
              type="button" role="option" class="sol-rich-editor__popover-item"
              [class.is-active]="i === activeIndex()" [attr.aria-selected]="i === activeIndex()"
              (mousedown)="selectMention($event, i)" (mouseenter)="activeIndex.set(i)"
            >
              <span class="sol-rich-editor__avatar" aria-hidden="true">{{ initial(user.name) }}</span>
              <span class="sol-rich-editor__popover-label">{{ user.name }}</span>
            </button>
          }
        </div>
      }

      <!-- ── Popover de tareas (#) — opt-in ─────────────────────────────── -->
      @if (showTaskPopover() && filteredTasks().length > 0) {
        <div
          class="sol-rich-editor__popover sol-rich-editor__popover--task" role="listbox"
          [attr.aria-label]="labels().taskList"
          [style.top.px]="popoverTop()" [style.left.px]="popoverLeft()"
        >
          @for (task of filteredTasks(); track task.key; let i = $index) {
            <button
              type="button" role="option" class="sol-rich-editor__popover-item"
              [class.is-active]="i === activeIndex()" [attr.aria-selected]="i === activeIndex()"
              (mousedown)="selectTask($event, i)" (mouseenter)="activeIndex.set(i)"
            >
              <span class="sol-rich-editor__task-key" aria-hidden="true">{{ task.key }}</span>
              <span class="sol-rich-editor__popover-label sol-rich-editor__popover-label--truncate">{{ task.title }}</span>
            </button>
          }
        </div>
      }

      @if (imageError()) {
        <p class="sol-rich-editor__error" role="alert">{{ imageError() }}</p>
      }

      <!-- Selector de archivo oculto para insertar imágenes locales -->
      <input
        #fileInput type="file" accept="image/*" class="sol-rich-editor__file"
        (change)="onFileSelected($event)" tabindex="-1" aria-hidden="true"
      />
    </div>
  `,
  styles: `
    :host {
      display: block;

      /* Tokens del contenedor (comparte los de input del tema). */
      --sre-bg: var(--sol-input-bg, var(--sol-bg-surface, #ffffff));
      --sre-text: var(--sol-color-text-primary, #1e293b);
      --sre-muted: var(--sol-color-text-muted, #94a3b8);
      --sre-border: var(--sol-border-color-default, #cbd5e1);
      --sre-border-focus: var(--sol-color-primary, #6366f1);
      --sre-radius: var(--sol-input-radius, var(--sol-border-radius-md, 0.5rem));
      --sre-toolbar-bg: var(--sol-bg-sunken, var(--sol-bg-page, #f8fafc));
      --sre-btn-hover: color-mix(in srgb, var(--sol-color-primary, #6366f1) 12%, transparent);
      --sre-btn-active: color-mix(in srgb, var(--sol-color-primary, #6366f1) 18%, transparent);
      --sre-focus-ring: var(--sol-input-focus-ring, 0 0 0 3px color-mix(in srgb, var(--sol-color-primary, #6366f1) 30%, transparent));
      --sre-font: var(--sol-font-family, system-ui, sans-serif);
      --sre-font-size: var(--sol-font-size-base, 0.9375rem);
      --sre-transition: var(--sol-dur-fast, 150ms) var(--sol-ease, ease);
    }

    .sol-rich-editor {
      position: relative; /* contexto de posicionamiento del popover de menciones */
      display: flex;
      flex-direction: column;
      border: var(--sol-input-border, var(--sol-border-width-default, 1px) solid var(--sre-border));
      border-radius: var(--sre-radius);
      background: var(--sre-bg);
      box-shadow: var(--sol-input-shadow, none);
      /* SIN overflow:hidden (follow-up 4R 2026-07-20): recortaba los menús de
         la toolbar (position:absolute; top:calc(100% + …)) contra el borde
         inferior del editor cuando el contenido era bajo. Lo único que ese
         overflow protegía eran las esquinas redondeadas: el fondo propio del
         wrapper ya se recorta solo por su border-radius, y los DOS hijos que
         pintan/scrollean por su cuenta (toolbar y área de contenido) llevan
         ahora su propio redondeo anidado — ver sus reglas. */
      transition: border-color var(--sre-transition), box-shadow var(--sre-transition);
    }

    .sol-rich-editor:focus-within {
      border-color: var(--sre-border-focus);
      box-shadow: var(--sre-focus-ring);
    }

    .sol-rich-editor--disabled { opacity: var(--sol-disabled-opacity, 0.55); }

    /* ── Toolbar ─────────────────────────────────────────────────────── */
    .sol-rich-editor__toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.125rem;
      padding: 0.375rem 0.5rem;
      background: var(--sre-toolbar-bg);
      border-bottom: 1px solid var(--sre-border);
      /* Redondeo anidado (radio del wrapper menos su borde de 1px): sustituye
         el recorte que hacía el overflow:hidden del wrapper — su fondo sunken
         ya no invade las esquinas superiores. */
      border-radius: calc(var(--sre-radius) - 1px) calc(var(--sre-radius) - 1px) 0 0;
    }

    .sol-rich-editor__group { display: flex; align-items: center; gap: 0.125rem; }
    .sol-rich-editor__group--menu { position: relative; display: inline-flex; }

    .sol-rich-editor__sep {
      width: 1px;
      align-self: stretch;
      margin: 0.125rem 0.25rem;
      background: var(--sre-border);
    }

    .sol-rich-editor__btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.875rem;
      height: 1.875rem;
      padding: 0;
      border: none;
      border-radius: var(--sol-border-radius-sm, 0.375rem);
      background: transparent;
      color: var(--sre-text);
      cursor: pointer;
      transition: background-color var(--sre-transition), color var(--sre-transition);
    }

    .sol-rich-editor__btn:hover:not(:disabled) { background: var(--sre-btn-hover); }
    .sol-rich-editor__btn:focus-visible {
      outline: 2px solid var(--sre-border-focus);
      outline-offset: 1px;
    }
    .sol-rich-editor__btn.is-active {
      background: var(--sre-btn-active);
      color: var(--sol-color-primary, #6366f1);
    }
    .sol-rich-editor__btn:disabled { cursor: not-allowed; opacity: 0.5; }

    /* ── Menús flotantes (encabezado / tabla / enlace) ───────────────── */
    .sol-rich-editor__menu {
      position: absolute;
      top: calc(100% + 0.25rem);
      left: 0;
      z-index: var(--sol-z-dropdown, 1000);
      min-width: 9rem;
      padding: 0.25rem;
      background: var(--sol-bg-surface, #ffffff);
      border: 1px solid var(--sre-border);
      border-radius: var(--sol-border-radius-md, 0.5rem);
      box-shadow: var(--sol-shadow-lg, 0 10px 25px rgba(0, 0, 0, 0.12));
    }

    .sol-rich-editor__menu-item {
      display: block;
      width: 100%;
      padding: 0.375rem 0.625rem;
      border: none;
      border-radius: var(--sol-border-radius-sm, 0.375rem);
      background: transparent;
      color: var(--sre-text);
      font-family: var(--sre-font);
      font-size: var(--sol-font-size-base, 0.9375rem);
      text-align: left;
      cursor: pointer;
    }
    .sol-rich-editor__menu-item:hover { background: var(--sre-btn-hover); }
    .sol-rich-editor__menu-item--h1 { font-size: 1.375rem; font-weight: 700; }
    .sol-rich-editor__menu-item--h2 { font-size: 1.125rem; font-weight: 700; }
    .sol-rich-editor__menu-item--h3 { font-size: 1rem; font-weight: 600; }

    /* Selector de rejilla de tablas */
    .sol-rich-editor__menu--table { min-width: auto; }
    .sol-rich-editor__grid { display: flex; flex-direction: column; gap: 2px; }
    .sol-rich-editor__grid-row { display: flex; gap: 2px; }
    .sol-rich-editor__grid-cell {
      width: 1rem;
      height: 1rem;
      padding: 0;
      border: 1px solid var(--sre-border);
      border-radius: 2px;
      background: var(--sol-bg-surface, #ffffff);
      cursor: pointer;
    }
    .sol-rich-editor__grid-cell.is-on {
      background: color-mix(in srgb, var(--sol-color-primary, #6366f1) 45%, transparent);
      border-color: var(--sol-color-primary, #6366f1);
    }
    .sol-rich-editor__grid-label {
      margin-top: 0.375rem;
      text-align: center;
      font-family: var(--sre-font);
      font-size: var(--sol-font-size-sm, 0.75rem);
      color: var(--sre-muted);
    }

    /* Popover de enlace */
    .sol-rich-editor__menu--link { min-width: 15rem; }
    .sol-rich-editor__link-input {
      width: 100%;
      height: var(--sol-size-input-height, 2.25rem);
      padding: 0 0.5rem;
      font-family: var(--sre-font);
      font-size: var(--sol-font-size-base, 0.9375rem);
      color: var(--sre-text);
      background: var(--sre-bg);
      border: 1px solid var(--sre-border);
      border-radius: var(--sol-border-radius-sm, 0.375rem);
      outline: none;
      box-sizing: border-box;
    }
    .sol-rich-editor__link-input:focus { border-color: var(--sre-border-focus); }
    .sol-rich-editor__link-actions { display: flex; gap: 0.375rem; margin-top: 0.375rem; }
    .sol-rich-editor__link-btn {
      flex: 1;
      padding: 0.375rem 0.5rem;
      border: 1px solid var(--sre-border);
      border-radius: var(--sol-border-radius-sm, 0.375rem);
      background: transparent;
      color: var(--sre-text);
      font-family: var(--sre-font);
      font-size: var(--sol-font-size-sm, 0.75rem);
      cursor: pointer;
    }
    .sol-rich-editor__link-btn:hover { background: var(--sre-btn-hover); }
    .sol-rich-editor__link-btn--primary {
      background: var(--sol-color-primary, #6366f1);
      border-color: var(--sol-color-primary, #6366f1);
      color: var(--sol-color-primary-contrast, #ffffff);
    }

    /* ── Área editable ───────────────────────────────────────────────── */
    .sol-rich-editor__content {
      flex: 1;
      padding: 0.75rem 0.875rem;
      overflow-y: auto;
      /* Redondeo anidado inferior: el scroll propio de esta área (overflow-y)
         recorta su contenido AQUÍ (imágenes/tablas contra las esquinas bajas),
         no en el wrapper — los menús de la toolbar quedan libres. */
      border-radius: 0 0 calc(var(--sre-radius) - 1px) calc(var(--sre-radius) - 1px);
      font-family: var(--sre-font);
      font-size: var(--sre-font-size);
      line-height: var(--sol-line-height, 1.6);
      color: var(--sre-text);
      outline: none;
      word-break: break-word;
    }

    .sol-rich-editor__content.is-empty::before {
      content: attr(data-placeholder);
      color: var(--sre-muted);
      pointer-events: none;
    }

    .sol-rich-editor__error {
      margin: 0;
      padding: 0.375rem 0.875rem;
      font-family: var(--sre-font);
      font-size: var(--sol-font-size-sm, 0.75rem);
      color: var(--sol-color-danger, #ef4444);
    }

    .sol-rich-editor__file {
      position: absolute;
      width: 1px; height: 1px;
      padding: 0; margin: -1px;
      overflow: hidden; clip: rect(0, 0, 0, 0); border: 0;
    }

    /* ── Popover de menciones (@) / tareas (#) — opt-in ───────────────── */
    .sol-rich-editor__popover {
      position: absolute;
      z-index: var(--sol-z-dropdown, 1000);
      min-width: 12rem;
      max-width: 18rem;
      max-height: 14rem;
      overflow-y: auto;
      padding: 0.25rem;
      background: var(--sol-bg-surface, #ffffff);
      border: 1px solid var(--sre-border);
      border-radius: var(--sol-border-radius-md, 0.5rem);
      box-shadow: var(--sol-shadow-lg, 0 10px 25px rgba(0, 0, 0, 0.12));
    }
    .sol-rich-editor__popover--task { min-width: 16rem; }

    .sol-rich-editor__popover-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
      padding: 0.375rem 0.5rem;
      border: none;
      border-radius: var(--sol-border-radius-sm, 0.375rem);
      background: transparent;
      color: var(--sre-text);
      font-family: var(--sre-font);
      font-size: var(--sol-font-size-base, 0.9375rem);
      text-align: left;
      cursor: pointer;
    }
    .sol-rich-editor__popover-item:hover,
    .sol-rich-editor__popover-item.is-active { background: var(--sre-btn-hover); }

    .sol-rich-editor__popover-label { flex: 1; min-width: 0; }
    .sol-rich-editor__popover-label--truncate {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .sol-rich-editor__avatar {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.5rem;
      height: 1.5rem;
      flex-shrink: 0;
      border-radius: 9999px;
      background: color-mix(in srgb, var(--sol-color-primary, #6366f1) 20%, transparent);
      color: var(--sol-color-primary, #6366f1);
      font-size: var(--sol-font-size-sm, 0.75rem);
      font-weight: 600;
    }

    .sol-rich-editor__task-key {
      flex-shrink: 0;
      padding: 0.0625rem 0.375rem;
      border-radius: var(--sol-border-radius-sm, 0.375rem);
      background: color-mix(in srgb, var(--sol-color-success, #10b981) 14%, transparent);
      color: var(--sol-color-success, #10b981);
      font-family: var(--sol-font-family-mono, ui-monospace, monospace);
      font-size: var(--sol-font-size-sm, 0.75rem);
      font-weight: 600;
    }

    /* ── Estilos del CONTENIDO renderizado (nodos inyectados) ─────────── */
    /* Chips de mención (@) y tarea (#) insertados en el contenido. */
    .sol-rich-editor__content ::ng-deep span[data-mention-id] {
      display: inline-block;
      padding: 0 0.375rem;
      border-radius: var(--sol-border-radius-sm, 0.375rem);
      background: color-mix(in srgb, var(--sol-color-primary, #6366f1) 12%, transparent);
      color: var(--sol-color-primary, #6366f1);
      font-weight: 500;
      white-space: nowrap;
    }
    .sol-rich-editor__content ::ng-deep span[data-task-key] {
      display: inline-block;
      padding: 0 0.375rem;
      border-radius: var(--sol-border-radius-sm, 0.375rem);
      background: color-mix(in srgb, var(--sol-color-success, #10b981) 14%, transparent);
      color: var(--sol-color-success, #10b981);
      font-family: var(--sol-font-family-mono, ui-monospace, monospace);
      font-weight: 600;
      white-space: nowrap;
    }

    .sol-rich-editor__content ::ng-deep h1 { font-size: 1.5rem; font-weight: 700; margin: 0.5rem 0; line-height: 1.25; }
    .sol-rich-editor__content ::ng-deep h2 { font-size: 1.25rem; font-weight: 700; margin: 0.5rem 0; line-height: 1.3; }
    .sol-rich-editor__content ::ng-deep h3 { font-size: 1.0625rem; font-weight: 600; margin: 0.5rem 0; line-height: 1.35; }
    .sol-rich-editor__content ::ng-deep p { margin: 0 0 0.5rem; }
    .sol-rich-editor__content ::ng-deep ul,
    .sol-rich-editor__content ::ng-deep ol { margin: 0 0 0.5rem; padding-left: 1.5rem; }
    .sol-rich-editor__content ::ng-deep li { margin: 0.125rem 0; }
    .sol-rich-editor__content ::ng-deep a { color: var(--sol-color-primary, #6366f1); text-decoration: underline; }
    .sol-rich-editor__content ::ng-deep img { max-width: 100%; height: auto; border-radius: var(--sol-border-radius-sm, 0.375rem); }
    .sol-rich-editor__content ::ng-deep table {
      border-collapse: collapse;
      margin: 0.5rem 0;
      width: auto;
    }
    .sol-rich-editor__content ::ng-deep td,
    .sol-rich-editor__content ::ng-deep th {
      border: 1px solid var(--sre-border);
      padding: 0.375rem 0.5rem;
      min-width: 3rem;
    }
  `,
})
export class SolRichEditorComponent implements ControlValueAccessor, AfterViewInit {
  private readonly i18n = injectSolI18n();
  private readonly destroyRef = inject(DestroyRef);

  // ── Inputs ──────────────────────────────────────────────────────────
  /** Texto guía cuando el editor está vacío. */
  readonly placeholder = input<string>('');
  /** Altura mínima del área editable (cualquier unidad CSS). */
  readonly minHeight = input<string>('12rem');
  /** Altura máxima opcional (scroll interno al superarla). */
  readonly maxHeight = input<string>('');
  /** Etiqueta accesible del área editable (fallback: clave i18n por defecto). */
  readonly ariaLabel = input<string>('');
  /** Deshabilita el editor (además del estado del formulario). */
  readonly disabled = input<boolean>(false);
  /** Tamaño máximo en bytes de una imagen pegada/insertada (default 5 MB). */
  readonly imageMaxBytes = input<number>(5 * 1024 * 1024);
  /** Hook opcional para subir la imagen y usar su URL en vez del data URL. */
  readonly imageUpload = input<SolRichImageUploader | null>(null);
  /**
   * Usuarios mencionables con `@` (opt-in). Vacío ⇒ menciones DESACTIVADAS:
   * el editor se comporta exactamente igual que sin esta capacidad.
   */
  readonly mentionableUsers = input<MentionUser[]>([]);
  /**
   * Tareas enlazables con `#` (opt-in). Vacío ⇒ enlaces DESACTIVADOS: el
   * editor se comporta exactamente igual que sin esta capacidad.
   */
  readonly linkableTasks = input<LinkableTask[]>([]);

  // ── Outputs ─────────────────────────────────────────────────────────
  /** Emite el HTML limpio en cada cambio (además del flujo CVA). */
  readonly valueChange = output<string>();
  /** IDs únicos (orden de documento) de los usuarios mencionados en el contenido. */
  readonly mentionsChange = output<string[]>();
  /** Keys únicas (orden de documento) de las tareas enlazadas en el contenido. */
  readonly taskLinksChange = output<string[]>();

  // ── Referencias del template ────────────────────────────────────────
  private readonly editable = viewChild.required<ElementRef<HTMLDivElement>>('editable');
  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');
  private readonly linkInput = viewChild<ElementRef<HTMLInputElement>>('linkInput');

  // ── Estado interno ──────────────────────────────────────────────────
  private readonly _value = signal<string>('');
  private readonly _disabledByForm = signal<boolean>(false);
  readonly active = signal<ActiveFormats>({ ...EMPTY_FORMATS });

  readonly showHeadingMenu = signal<boolean>(false);
  readonly showTableMenu = signal<boolean>(false);
  readonly showLinkMenu = signal<boolean>(false);
  readonly tableRows = signal<number>(1);
  readonly tableCols = signal<number>(1);
  readonly linkUrl = signal<string>('');
  readonly imageError = signal<string>('');

  // ── Estado de menciones (@) / tareas (#) — opt-in ───────────────────
  readonly showMentionPopover = signal<boolean>(false);
  readonly showTaskPopover = signal<boolean>(false);
  readonly activeIndex = signal<number>(0);
  readonly popoverTop = signal<number>(0);
  readonly popoverLeft = signal<number>(0);
  private readonly mentionQuery = signal<string>('');
  private readonly taskQuery = signal<string>('');
  /** Rango que abarca `@query`/`#query`; se reemplaza por el chip al elegir. */
  private triggerRange: Range | null = null;

  /** Menciones activas solo si hay usuarios; si no, el trigger `@` se ignora. */
  readonly mentionsEnabled = computed(() => this.mentionableUsers().length > 0);
  /** Enlaces activos solo si hay tareas; si no, el trigger `#` se ignora. */
  readonly tasksEnabled = computed(() => this.linkableTasks().length > 0);

  readonly filteredUsers = computed(() => {
    const query = this.mentionQuery().toLowerCase();
    return this.mentionableUsers()
      .filter((user) => !query || user.name.toLowerCase().includes(query))
      .slice(0, MENTION_MAX_RESULTS);
  });

  readonly filteredTasks = computed(() => {
    const query = this.taskQuery().toLowerCase();
    return this.linkableTasks()
      .filter(
        (task) =>
          !query ||
          task.key.toLowerCase().includes(query) ||
          task.title.toLowerCase().includes(query),
      )
      .slice(0, MENTION_MAX_RESULTS);
  });

  readonly isDisabled = computed(() => this.disabled() || this._disabledByForm());
  readonly isEmpty = computed(() => this._value().trim().length === 0);
  readonly editorAriaLabel = computed(
    () => this.ariaLabel() || this.labels().editorAria,
  );

  /** Rango fijo para la rejilla del selector de tablas. */
  readonly gridRange = computed(() =>
    Array.from({ length: TABLE_GRID_MAX }, (_, i) => i + 1),
  );

  /** Etiquetas i18n reactivas al idioma (patrón sol-stepper). */
  readonly labels = computed(() => {
    this.i18n.activeLang();
    const t = (key: string) => this.i18n.translate(`shared.richEditor.${key}`);
    return {
      toolbar: t('toolbar'),
      bold: t('bold'), italic: t('italic'), underline: t('underline'), strike: t('strike'),
      heading: t('heading'), paragraph: t('paragraph'),
      heading1: t('heading1'), heading2: t('heading2'), heading3: t('heading3'),
      bulletList: t('bulletList'), numberedList: t('numberedList'),
      alignLeft: t('alignLeft'), alignCenter: t('alignCenter'), alignRight: t('alignRight'),
      insertImage: t('insertImage'), insertTable: t('insertTable'),
      insertLink: t('insertLink'), removeLink: t('removeLink'), removeFormat: t('removeFormat'),
      tablePicker: t('tablePicker'),
      linkPlaceholder: t('linkPlaceholder'), linkConfirm: t('linkConfirm'),
      editorAria: t('editorAria'), imageTooLarge: t('imageTooLarge'),
      mentionList: t('mentionList'), taskList: t('taskList'),
    };
  });

  /** Selección guardada al abrir menús que roban el foco (enlace/imagen). */
  private savedRange: Range | null = null;
  /** Valor pendiente de aplicar al DOM (antes de que la vista esté lista). */
  private pendingValue = '';
  private viewReady = false;
  private activeUpdateHandle: ReturnType<typeof setTimeout> | null = null;
  private errorHandle: ReturnType<typeof setTimeout> | null = null;

  // ── CVA callbacks ───────────────────────────────────────────────────
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  // ── Ciclo de vida ───────────────────────────────────────────────────
  ngAfterViewInit(): void {
    this.viewReady = true;
    this.applyPending();

    // Actualiza el resaltado de la toolbar cuando cambia la selección.
    const onSelectionChange = () => {
      if (this.selectionInsideEditor()) this.updateActiveFormats();
    };
    document.addEventListener('selectionchange', onSelectionChange);

    // Cierra los menús y popovers al hacer clic fuera del componente.
    const onDocClick = (event: MouseEvent) => {
      const host = this.editable().nativeElement.closest('.sol-rich-editor');
      if (host && !host.contains(event.target as Node)) {
        this.closeMenus();
        this.closePopovers();
      }
    };
    document.addEventListener('click', onDocClick);

    this.destroyRef.onDestroy(() => {
      document.removeEventListener('selectionchange', onSelectionChange);
      document.removeEventListener('click', onDocClick);
      if (this.activeUpdateHandle) clearTimeout(this.activeUpdateHandle);
      if (this.errorHandle) clearTimeout(this.errorHandle);
    });
  }

  // ── ControlValueAccessor ────────────────────────────────────────────
  writeValue(value: string | null): void {
    this.pendingValue = value ?? '';
    this.applyPending();
  }

  registerOnChange(fn: (value: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this._disabledByForm.set(isDisabled); }

  /** Devuelve el HTML limpio (canónico TCPDF-safe) actual. */
  getHtml(): string { return this._value(); }

  // ── Manejo de eventos del área editable ─────────────────────────────
  onInput(): void {
    if (this.mentionsEnabled() || this.tasksEnabled()) this.detectAutocomplete();
    this.emitChange();
    this.scheduleActiveUpdate();
  }

  onBlur(): void { this.onTouched(); }

  /** Navegación del popover de menciones/tareas (solo cuando está abierto). */
  onKeyDown(event: KeyboardEvent): void {
    if (!this.showMentionPopover() && !this.showTaskPopover()) return;
    const length = this.showMentionPopover()
      ? this.filteredUsers().length
      : this.filteredTasks().length;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.activeIndex.update((i) => Math.min(i + 1, length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.activeIndex.update((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        event.preventDefault();
        if (this.showMentionPopover()) this.selectMention(null, this.activeIndex());
        else this.selectTask(null, this.activeIndex());
        break;
      case 'Escape':
        event.preventDefault();
        this.closePopovers();
        break;
    }
  }

  /** Inicial en mayúscula para el avatar del popover de menciones. */
  initial(name: string): string {
    return (name.trim().charAt(0) || '?').toUpperCase();
  }

  /** Recalcula el estado de la toolbar de forma diferida (tras el DOM). */
  scheduleActiveUpdate(): void {
    if (this.activeUpdateHandle) clearTimeout(this.activeUpdateHandle);
    this.activeUpdateHandle = setTimeout(() => this.updateActiveFormats(), 0);
  }

  // ── Comandos de formato (execCommand + normalización por serializador) ─
  cmd(command: string): void {
    this.exec(command);
  }

  applyHeading(tag: 'p' | 'h1' | 'h2' | 'h3'): void {
    this.exec('formatBlock', `<${tag}>`);
    this.closeMenus();
  }

  align(direction: 'left' | 'center' | 'right'): void {
    const command = direction === 'left' ? 'justifyLeft'
      : direction === 'center' ? 'justifyCenter' : 'justifyRight';
    this.focusEditable();
    this.safeExec(command);
    // Si el objetivo es una imagen, refleja el alineado en su propio estilo
    // (además del bloque) para que el serializador lo detecte con fiabilidad.
    const img = this.selectedImage();
    if (img) {
      if (direction === 'center') {
        img.style.display = 'block';
        img.style.marginLeft = 'auto';
        img.style.marginRight = 'auto';
      } else {
        img.style.display = '';
        img.style.margin = '';
      }
    }
    this.emitChange();
    this.updateActiveFormats();
  }

  removeFormat(): void {
    this.focusEditable();
    this.safeExec('removeFormat');
    this.safeExec('formatBlock', '<p>');
    this.emitChange();
    this.updateActiveFormats();
  }

  // ── Menús ───────────────────────────────────────────────────────────
  toggleMenu(which: 'heading' | 'table' | 'link'): void {
    const isOpen = which === 'heading' ? this.showHeadingMenu()
      : which === 'table' ? this.showTableMenu() : this.showLinkMenu();
    this.closeMenus();
    if (isOpen) return;
    if (which === 'heading') this.showHeadingMenu.set(true);
    if (which === 'table') { this.tableRows.set(1); this.tableCols.set(1); this.showTableMenu.set(true); }
    if (which === 'link') {
      this.linkUrl.set('');
      this.showLinkMenu.set(true);
      // Enfoca el input tras el render.
      setTimeout(() => this.linkInput()?.nativeElement.focus(), 0);
    }
  }

  closeMenus(): void {
    this.showHeadingMenu.set(false);
    this.showTableMenu.set(false);
    this.showLinkMenu.set(false);
  }

  // ── Tabla ───────────────────────────────────────────────────────────
  hoverTable(rows: number, cols: number): void {
    this.tableRows.set(rows);
    this.tableCols.set(cols);
  }

  insertTable(rows: number, cols: number): void {
    const table = document.createElement('table');
    table.setAttribute('border', '1');
    const tbody = document.createElement('tbody');
    for (let r = 0; r < rows; r++) {
      const tr = document.createElement('tr');
      for (let c = 0; c < cols; c++) {
        const td = document.createElement('td');
        td.appendChild(document.createElement('br'));
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    this.insertNodeAtCaret(table);
    this.closeMenus();
  }

  // ── Enlace ──────────────────────────────────────────────────────────
  confirmLink(): void {
    const url = this.linkUrl().trim();
    if (!url) { this.closeMenus(); return; }
    const href = /^(https?:|mailto:|tel:|#)/i.test(url) ? url : `https://${url}`;

    this.restoreSelection();
    const selection = document.getSelection();
    if (selection && !selection.isCollapsed) {
      this.focusEditable();
      this.safeExec('createLink', href);
    } else {
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.textContent = url;
      this.insertNodeAtCaret(anchor);
    }
    this.emitChange();
    this.closeMenus();
  }

  removeLink(): void {
    this.focusEditable();
    this.restoreSelection();
    this.safeExec('unlink');
    this.emitChange();
    this.closeMenus();
  }

  // ── Imágenes ────────────────────────────────────────────────────────
  pickImage(): void {
    this.saveSelection();
    this.fileInput().nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.handleImageFile(file);
    input.value = ''; // permite volver a elegir el mismo archivo
  }

  private handleImageFile(file: File): void {
    if (!file.type.startsWith('image/')) return;
    if (file.size > this.imageMaxBytes()) {
      this.showImageError();
      return;
    }
    const uploader = this.imageUpload();
    if (uploader) {
      uploader(file)
        .then((url) => this.insertImage(url))
        .catch(() => this.showImageError());
      return;
    }
    const reader = new FileReader();
    reader.onload = () => this.insertImage(String(reader.result ?? ''));
    reader.readAsDataURL(file);
  }

  private insertImage(url: string): void {
    if (!url) return;
    const img = document.createElement('img');
    img.src = url;
    img.alt = '';
    this.insertNodeAtCaret(img);
  }

  private showImageError(): void {
    this.imageError.set(this.labels().imageTooLarge);
    if (this.errorHandle) clearTimeout(this.errorHandle);
    this.errorHandle = setTimeout(() => this.imageError.set(''), 4000);
  }

  // ── Menciones (@) / tareas (#) — opt-in ─────────────────────────────
  /**
   * Analiza el texto anterior al cursor: si hay un trigger `@`/`#` activo (al
   * inicio o precedido por espacio) y su lista está habilitada, abre el popover
   * respectivo; si no, lo cierra.
   */
  private detectAutocomplete(): void {
    const found = this.getQueryBeforeCursor();
    if (!found) { this.closePopovers(); return; }

    const { trigger, query, range } = found;
    if (trigger === '@' && !this.mentionsEnabled()) { this.closePopovers(); return; }
    if (trigger === '#' && !this.tasksEnabled()) { this.closePopovers(); return; }

    this.triggerRange = range;
    this.activeIndex.set(0);
    if (trigger === '@') {
      this.mentionQuery.set(query);
      this.showMentionPopover.set(true);
      this.showTaskPopover.set(false);
    } else {
      this.taskQuery.set(query);
      this.showTaskPopover.set(true);
      this.showMentionPopover.set(false);
    }
    this.positionPopover();
  }

  /** Trigger + consulta inmediatamente antes del cursor colapsado (o null). */
  private getQueryBeforeCursor(): { trigger: '@' | '#'; query: string; range: Range } | null {
    const selection = document.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    if (!range.collapsed) return null;

    const container = range.startContainer;
    if (container.nodeType !== Node.TEXT_NODE) return null;
    if (!this.editable().nativeElement.contains(container)) return null;

    const text = container.textContent ?? '';
    const offset = range.startOffset;
    const before = text.slice(0, offset);

    let triggerIdx = -1;
    let trigger: '@' | '#' | null = null;
    for (let i = before.length - 1; i >= 0; i--) {
      const ch = before[i];
      if (ch === '@' || ch === '#') {
        if (i === 0 || /\s/.test(before[i - 1])) { triggerIdx = i; trigger = ch; }
        break;
      }
      if (/\s/.test(ch)) break; // espacio antes del trigger ⇒ no hay match
    }
    if (triggerIdx === -1 || !trigger) return null;

    const query = before.slice(triggerIdx + 1);
    if (query.length > MENTION_QUERY_MAX) return null;

    const triggerRange = document.createRange();
    triggerRange.setStart(container, triggerIdx);
    triggerRange.setEnd(container, offset);
    return { trigger, query, range: triggerRange };
  }

  /** Ubica el popover bajo el caret (cálculo manual; sin librerías de posición). */
  private positionPopover(): void {
    const selection = document.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const host = this.editable().nativeElement.closest('.sol-rich-editor') as HTMLElement | null;
    if (!host || typeof host.getBoundingClientRect !== 'function') return;

    const caret = selection.getRangeAt(0).cloneRange();
    caret.collapse(true);
    // `Range.getBoundingClientRect` no existe en jsdom (tests): sin medidas de
    // viewport se conserva la posición por defecto (0,0) sin romper el flujo.
    if (typeof caret.getBoundingClientRect !== 'function') return;
    const caretRect = caret.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();

    const count = this.showMentionPopover()
      ? this.filteredUsers().length
      : this.filteredTasks().length;
    const estHeight = Math.min(count, 6) * 36 + 8;
    const below = caretRect.bottom - hostRect.top + 4;
    const roomBelow = hostRect.bottom - caretRect.bottom;
    // Si no cabe abajo pero sí arriba, se abre hacia arriba (flip).
    const top =
      roomBelow < estHeight && caretRect.top - hostRect.top > estHeight
        ? caretRect.top - hostRect.top - estHeight - 4
        : below;
    const left = Math.max(
      0,
      Math.min(caretRect.left - hostRect.left, hostRect.width - POPOVER_WIDTH),
    );
    this.popoverTop.set(Math.max(0, top));
    this.popoverLeft.set(left);
  }

  closePopovers(): void {
    this.showMentionPopover.set(false);
    this.showTaskPopover.set(false);
    this.triggerRange = null;
  }

  selectMention(event: Event | null, index: number): void {
    event?.preventDefault();
    const user = this.filteredUsers()[index];
    if (!user) return;
    this.insertChip(`@${user.name}`, 'data-mention-id', user.id);
    this.closePopovers();
    this.emitChange();
  }

  selectTask(event: Event | null, index: number): void {
    event?.preventDefault();
    const task = this.filteredTasks()[index];
    if (!task) return;
    this.insertChip(task.key, 'data-task-key', task.key);
    this.closePopovers();
    this.emitChange();
  }

  /**
   * Reemplaza el rango `@query`/`#query` por un chip `<span>` no editable con
   * el atributo data-* dado, y deja el cursor tras él con un espacio.
   */
  private insertChip(label: string, attr: string, value: string): void {
    if (!this.triggerRange) return;
    const selection = document.getSelection();
    if (!selection) return;

    const chip = document.createElement('span');
    chip.setAttribute('contenteditable', 'false');
    chip.textContent = label;
    chip.setAttribute(attr, value);

    this.triggerRange.deleteContents();
    this.triggerRange.insertNode(chip);

    const after = document.createRange();
    after.setStartAfter(chip);
    after.collapse(true);
    selection.removeAllRanges();
    selection.addRange(after);
    // Espacio para poder seguir escribiendo fuera del chip.
    this.safeExec('insertText', ' ');
    this.triggerRange = null;
  }

  /** Marca los chips como no editables tras (re)pintar el contenido. */
  private hardenChips(): void {
    this.editable()
      .nativeElement.querySelectorAll<HTMLElement>('[data-mention-id],[data-task-key]')
      .forEach((el) => { el.setAttribute('contenteditable', 'false'); });
  }

  /** IDs/keys únicos (orden de documento) de los chips presentes en el DOM. */
  private collectChipValues(attr: string): string[] {
    const seen = new Set<string>();
    this.editable()
      .nativeElement.querySelectorAll(`[${attr}]`)
      .forEach((el) => {
        const value = el.getAttribute(attr)?.trim();
        if (value) seen.add(value);
      });
    return [...seen];
  }

  // ── Pegado (saneado SIEMPRE por el serializador) ────────────────────
  onPaste(event: ClipboardEvent): void {
    const data = event.clipboardData;
    if (!data) return;

    // 1) Imágenes en el portapapeles.
    const imageFiles = Array.from(data.items ?? [])
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file != null);
    const directFiles = Array.from(data.files ?? []).filter((f) => f.type.startsWith('image/'));
    const images = imageFiles.length ? imageFiles : directFiles;
    if (images.length) {
      event.preventDefault();
      images.forEach((file) => this.handleImageFile(file));
      return;
    }

    // 2) HTML enriquecido → saneado por allowlist antes de tocar el DOM.
    const html = data.getData('text/html');
    if (html) {
      event.preventDefault();
      const clean = sanitizeHtmlToTcpdf(html);
      if (clean) this.insertHtmlAtCaret(clean);
      return;
    }

    // 3) Texto plano.
    const text = data.getData('text/plain');
    if (text) {
      event.preventDefault();
      this.insertTextAtCaret(text);
    }
  }

  // ── Utilidades de selección / inserción ─────────────────────────────
  preventSteal(event: Event): void {
    event.preventDefault();
  }

  onTriggerMousedown(event: Event): void {
    event.preventDefault();
    this.saveSelection();
  }

  private focusEditable(): void {
    this.editable().nativeElement.focus();
  }

  private selectionInsideEditor(): boolean {
    const selection = document.getSelection();
    if (!selection || selection.rangeCount === 0) return false;
    const node = selection.anchorNode;
    return !!node && this.editable().nativeElement.contains(node);
  }

  private saveSelection(): void {
    const selection = document.getSelection();
    if (selection && selection.rangeCount > 0 && this.selectionInsideEditor()) {
      this.savedRange = selection.getRangeAt(0).cloneRange();
    }
  }

  private restoreSelection(): void {
    if (!this.savedRange) return;
    this.focusEditable();
    const selection = document.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(this.savedRange);
    }
  }

  private insertNodeAtCaret(node: Node): void {
    this.focusEditable();
    this.restoreSelection();
    const selection = document.getSelection();
    const editable = this.editable().nativeElement;
    if (selection && selection.rangeCount > 0 && this.selectionInsideEditor()) {
      const range = selection.getRangeAt(0);
      // Un DocumentFragment se vacía al insertarse (sus hijos pasan al DOM); hay
      // que capturar el último hijo ANTES para poder recolocar el cursor tras él.
      const isFragment = node.nodeType === 11; // DOCUMENT_FRAGMENT_NODE
      const marker: Node | null = isFragment ? node.lastChild : node;
      range.deleteContents();
      range.insertNode(node);
      if (marker) {
        range.setStartAfter(marker);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    } else {
      editable.appendChild(node);
    }
    this.savedRange = null;
    this.emitChange();
  }

  private insertHtmlAtCaret(cleanHtml: string): void {
    const template = document.createElement('template');
    template.innerHTML = cleanHtml; // ya saneado: seguro
    this.insertNodeAtCaret(template.content.cloneNode(true));
  }

  private insertTextAtCaret(text: string): void {
    this.insertNodeAtCaret(document.createTextNode(text));
  }

  private exec(command: string, value?: string): void {
    this.focusEditable();
    this.safeExec(command, value);
    this.emitChange();
    this.updateActiveFormats();
  }

  private safeExec(command: string, value?: string): void {
    try {
      document.execCommand(command, false, value);
    } catch {
      // execCommand está deprecado y puede no existir (SSR/tests): la salida
      // se garantiza limpia igualmente vía el serializador.
    }
  }

  private emitChange(): void {
    const clean = serializeElementToTcpdfHtml(this.editable().nativeElement);
    this._value.set(clean);
    this.onChange(clean);
    this.valueChange.emit(clean);
    this.mentionsChange.emit(this.collectChipValues('data-mention-id'));
    this.taskLinksChange.emit(this.collectChipValues('data-task-key'));
  }

  private applyPending(): void {
    if (!this.viewReady) return;
    const clean = sanitizeHtmlToTcpdf(this.pendingValue);
    const editable = this.editable().nativeElement;
    if (editable.innerHTML !== clean) editable.innerHTML = clean;
    this.hardenChips();
    this._value.set(clean);
  }

  private updateActiveFormats(): void {
    if (!this.selectionInsideEditor()) return;
    const state = (command: string): boolean => {
      try {
        return document.queryCommandState(command);
      } catch {
        return false;
      }
    };
    this.active.set({
      bold: state('bold'),
      italic: state('italic'),
      underline: state('underline'),
      strike: state('strikeThrough'),
      bulletList: state('insertUnorderedList'),
      numberedList: state('insertOrderedList'),
      alignLeft: state('justifyLeft'),
      alignCenter: state('justifyCenter'),
      alignRight: state('justifyRight'),
    });
  }

  private selectedImage(): HTMLImageElement | null {
    const selection = document.getSelection();
    if (!selection || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);

    // Imagen exactamente seleccionada.
    const single = range.startContainer.childNodes[range.startOffset];
    if (single instanceof HTMLImageElement) return single;

    // Imagen contenedora del ancla.
    let node: Node | null = selection.anchorNode;
    while (node && node !== this.editable().nativeElement) {
      if (node instanceof HTMLImageElement) return node;
      node = node.parentNode;
    }
    return null;
  }
}
