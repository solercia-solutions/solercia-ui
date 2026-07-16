import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  TemplateRef,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgTemplateOutlet } from '@angular/common';
import { CdkDrag } from '@angular/cdk/drag-drop';
import type { KanbanItem } from './kanban.model';

/** Contexto del `ng-template` de tarjeta: `let-item` (`$implicit`) o `let-item="item"`. */
export interface KanbanCardTemplateContext<T extends KanbanItem> {
  $implicit: T;
  item: T;
}

/**
 * `sol-kanban-card` — contenedor presentacional de un item; el CONTENIDO va
 * por `cardTemplate` proyectado (spec: solercia-ui-kanban#Estructura
 * genérica sin conocimiento de dominio).
 *
 * `cdkDrag` vía `hostDirectives` (PR5b, D1/T38): el HOST de la tarjeta se
 * vuelve arrastrable SIN que ningún consumidor escriba `cdkDrag` jamás — la
 * directiva se adopta internamente (`hostDirectives: [CdkDrag]`, forma
 * "desnuda" que NO reexpone ningún input/output de CDK hacia consumidores de
 * `<sol-kanban-card>`) y se cablea imperativamente (`data`, `previewClass`)
 * inyectando la instancia (`inject(CdkDrag, { host: true })`). Cualquier
 * archivo dentro de `ui/kanban/` puede importar `@angular/cdk/drag-drop`
 * (gate ESLint T40 exime el directorio completo, no un archivo puntual —
 * `kanban-board.component.ts` también importa `CdkDropListGroup`).
 *
 * A11y — CORRECCIÓN 4R (PR5b): `cdkDrag` de `@angular/cdk` 22.0.5 SOLO
 * registra listeners de `mousedown`/`touchstart`/`dragstart` — CERO soporte
 * de teclado (`keydown`). El comentario original de esta clase afirmaba lo
 * contrario; era falso y dejaba el tablero INOPERABLE para un usuario sin
 * mouse/touch (el drag es la única forma de mover una tarjeta). Por eso
 * `sol-kanban-column` ofrece un mecanismo alternativo 100% accesible por
 * teclado (un `<select>` nativo por tarjeta: "subir"/"bajar"/"mover a
 * columna X") que invoca el MISMO `KanbanReorderService` y emite el MISMO
 * `itemMoved` que el drag — ver `kanban-column.component.ts`. No se
 * reimplementa el drag por teclado de CDK (complejo y frágil); se da
 * paridad FUNCIONAL por una vía distinta.
 */
@Component({
  selector: 'sol-kanban-card',
  standalone: true,
  imports: [NgTemplateOutlet],
  hostDirectives: [CdkDrag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sol-kanban-card">
      <ng-container
        *ngTemplateOutlet="cardTemplate(); context: { $implicit: item(), item: item() }"
      />
    </div>
  `,
  styles: `
    :host {
      display: block;
      cursor: grab;
    }

    :host(.cdk-drag-dragging) {
      cursor: grabbing;
    }

    .sol-kanban-card {
      border: 1px solid var(--sol-border-color-default, #e2e8f0);
      border-radius: var(--sol-border-radius-md, 8px);
      background: var(--sol-bg-surface, #ffffff);
      box-shadow: var(--sol-shadow-sm, 0 1px 2px rgba(0, 0, 0, 0.05));
    }

    /*
     * Placeholder de posición (PR5b/T39): el "hueco" que deja la tarjeta
     * mientras se arrastra una copia. CDK clona el host y le agrega la clase
     * cdk-drag-placeholder — el clon queda DENTRO del mismo drop-list (no en
     * el overlay global), así que sigue dentro del alcance normal de
     * encapsulación de Angular (compound host selector, sin ::ng-deep).
     * NOTA: sin backticks en este comentario a propósito — están DENTRO del
     * template literal styles de este decorador, y un backtick literal acá
     * cerraría el template literal de TypeScript antes de tiempo.
     */
    :host(.cdk-drag-placeholder) .sol-kanban-card {
      opacity: 0.4;
      border: 1px dashed var(--sol-color-primary, #6366f1);
      background: transparent;
      box-shadow: none;
    }

    /*
     * Overlay de arrastre (PR5b/T39): rotación 2 grados + sombra (spec: UX
     * de arrastre del vocero). El preview auto-generado por CDK se inserta
     * en un overlay GLOBAL fuera del árbol de este componente (adjunto cerca
     * de <body>) — ::ng-deep SIN :host es la única forma de alcanzarlo (no
     * hay alternativa no-deprecada para este caso puntual de overlay de
     * CDK); se identifica por cdkDragPreviewClass, no por el selector de
     * tag, para no depender de que CDK preserve la encapsulación del clon.
     */
    ::ng-deep .sol-kanban-card__drag-preview {
      transform: rotate(2deg);
      box-shadow: var(--sol-shadow-lg, 0 10px 25px rgba(0, 0, 0, 0.15));
      cursor: grabbing;
    }
  `,
})
export class SolKanbanCardComponent<T extends KanbanItem = KanbanItem> {
  private readonly cdkDrag = inject(CdkDrag, { host: true });

  /** El item de dominio del consumidor — genérico, la librería nunca lo interpreta. */
  readonly item = input.required<T>();

  /** Template proyectado que renderiza el CONTENIDO de la tarjeta. */
  readonly cardTemplate = input.required<TemplateRef<KanbanCardTemplateContext<T>>>();

  /**
   * `true` mientras esta tarjeta está siendo arrastrada, `false` al soltar
   * (corrección 4R WARNING, PR5b): `sol-kanban-board` necesita saber si hay
   * ALGÚN drag activo en el tablero para POSPONER el re-seed del espejo
   * (D4) — reasignar `columns()` mientras CDK arrastra el nodo DOM de esta
   * misma tarjeta podría destruirlo/recrearlo (`@for`) y corromper el
   * gesto. Se bubblea vía `sol-kanban-column` hasta el board.
   */
  readonly dragActiveChanged = output<boolean>();

  constructor() {
    this.cdkDrag.previewClass = 'sol-kanban-card__drag-preview';
    // Payload del drag: SIEMPRE el item actual, sincronizado reactivamente.
    // `KanbanReorderService`/`sol-kanban-board` reordenan por índices + ids
    // de columna (no leen `data`), pero CDK lo expone en
    // `CdkDragDrop.item.data` por si un futuro consumidor lo necesita.
    effect(() => {
      this.cdkDrag.data = this.item();
    });

    const destroyRef = inject(DestroyRef);
    this.cdkDrag.started.pipe(takeUntilDestroyed(destroyRef)).subscribe(() => this.dragActiveChanged.emit(true));
    this.cdkDrag.ended.pipe(takeUntilDestroyed(destroyRef)).subscribe(() => this.dragActiveChanged.emit(false));
  }
}
