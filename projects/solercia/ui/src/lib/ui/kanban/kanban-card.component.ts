import {
  Component,
  ChangeDetectionStrategy,
  TemplateRef,
  input,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { KanbanItem } from './kanban.model';

/** Contexto del `ng-template` de tarjeta: `let-item` (`$implicit`) o `let-item="item"`. */
export interface KanbanCardTemplateContext<T extends KanbanItem> {
  $implicit: T;
  item: T;
}

/**
 * `sol-kanban-card` — contenedor presentacional de un item; el CONTENIDO va
 * por `cardTemplate` proyectado (spec: solercia-ui-kanban#Estructura
 * genérica sin conocimiento de dominio). Sin `cdkDrag` todavía — eso lo
 * cablea el PR5b.
 */
@Component({
  selector: 'sol-kanban-card',
  standalone: true,
  imports: [NgTemplateOutlet],
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
    }

    .sol-kanban-card {
      border: 1px solid var(--sol-border-color-default, #e2e8f0);
      border-radius: var(--sol-border-radius-md, 8px);
      background: var(--sol-bg-surface, #ffffff);
      box-shadow: var(--sol-shadow-sm, 0 1px 2px rgba(0, 0, 0, 0.05));
    }
  `,
})
export class SolKanbanCardComponent<T extends KanbanItem = KanbanItem> {
  /** El item de dominio del consumidor — genérico, la librería nunca lo interpreta. */
  readonly item = input.required<T>();

  /** Template proyectado que renderiza el CONTENIDO de la tarjeta. */
  readonly cardTemplate = input.required<TemplateRef<KanbanCardTemplateContext<T>>>();
}
