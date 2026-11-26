import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  ElementRef,
  Injectable,
  TemplateRef,
  computed,
  contentChild,
  effect,
  inject,
  input,
  linkedSignal,
  model,
  output,
  signal,
  untracked,
  type Signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { injectSolI18n } from '../../i18n/inject-sol-i18n';
import { SolIconComponent } from '../icon/icon.component';

/**
 * Profundidad máxima por defecto: 5 niveles visibles (raíz = nivel 1).
 *
 * Es una cota DURA heredada del árbol de jerarquía que originó este
 * componente: mantiene el DOM acotado (sin virtualización), evita sangrías
 * ilegibles en móvil y —lo más importante para un primitivo genérico— corta
 * la recursión si el consumidor pasa por error un grafo con ciclos.
 */
export const SOL_TREE_MAX_DEPTH = 5;

/**
 * Nodo genérico del árbol. El componente SOLO conoce estos tres campos
 * (`id`, `label`, `children`); todo lo del dominio del consumidor viaja
 * opaco en `data` y se pinta desde la plantilla proyectada.
 *
 * @typeParam T Tipo de la carga libre de `data`.
 */
export interface SolTreeNode<T = unknown> {
  /** Identificador ESTABLE y único en todo el árbol (track, expansión y foco). */
  id: string;
  /** Texto del nodo. Se usa en el render por defecto y en los `aria-label`. */
  label: string;
  /** Hijos del nodo. Ausente o vacío ⇒ es una hoja. */
  children?: readonly SolTreeNode<T>[];
  /** Carga libre del consumidor (badges, avance, ruta…). El árbol no la interpreta. */
  data?: T;
}

/**
 * Contexto del `ng-template` de nodo proyectado: `let-node` (`$implicit`) o
 * `let-node="node"` — mismo patrón que `SolFlowCanvasNodeTemplateContext` y
 * `SolCalendarEventTemplateContext`.
 *
 * `expanded` y `hasChildren` van en el contexto (aunque el consumidor podría
 * derivarlos) por el mismo criterio que ya usa `sol-flow-canvas` con
 * `selected`/`highlighted`: evita que la plantilla proyectada tenga que
 * recalcular estado que el árbol ya conoce.
 */
export interface SolTreeNodeTemplateContext<T = unknown> {
  /** Alias posicional (`let-x`) — el mismo nodo que {@link node}. */
  $implicit: SolTreeNode<T>;
  /** Alias nombrado (`let-x="node"`) — el mismo nodo que {@link $implicit}. */
  node: SolTreeNode<T>;
  /** Profundidad del nodo, base 0 (las raíces son 0). */
  depth: number;
  /** Espejo del estado de expansión vigente para este nodo. */
  expanded: boolean;
  /** `true` si el nodo tiene al menos un hijo. */
  hasChildren: boolean;
}

/** Payload de `nodeToggled` — el nodo, su nuevo estado y el set completo resultante. */
export interface SolTreeToggleEvent<T = unknown> {
  /** Nodo cuyo chevron se accionó. */
  node: SolTreeNode<T>;
  /** `true` si quedó expandido. */
  expanded: boolean;
  /** Todos los ids expandidos DESPUÉS del cambio (listo para persistir o reenviar). */
  expandedIds: readonly string[];
}

/**
 * Marca el `<ng-template>` que pinta el CONTENIDO de cada nodo. Debe ser hijo
 * directo de `<sol-tree>`. Sin él, el árbol cae a un render por defecto que
 * muestra `node.label`.
 *
 * ```html
 * <sol-tree [nodes]="arbol()" (nodeSelected)="ir($event)">
 *   <ng-template solTreeNodeDef let-node let-depth="depth">
 *     <span>{{ node.label }}</span>
 *     <sol-badge>{{ node.data?.metodologia }}</sol-badge>
 *   </ng-template>
 * </sol-tree>
 * ```
 *
 * Nota de tipado: sin un input que ancle el genérico, TypeScript infiere
 * `T = unknown`, así que `node.data` llega como `unknown` y el consumidor lo
 * estrecha en su propio código. Es el mismo compromiso de `matTreeNodeDef`;
 * se prefirió eso antes que ensuciar la API con un input solo-para-inferencia.
 */
@Directive({
  selector: '[solTreeNodeDef]',
  standalone: true,
})
export class SolTreeNodeDefDirective<T = unknown> {
  readonly template = inject(TemplateRef<SolTreeNodeTemplateContext<T>>);

  /** Tipa las variables `let-` del template (`let-node`, `let-depth`, …). */
  static ngTemplateContextGuard<T>(
    _directive: SolTreeNodeDefDirective<T>,
    _context: unknown,
  ): _context is SolTreeNodeTemplateContext<T> {
    return true;
  }
}

/**
 * Contrato que el contenedor `sol-tree` le expone a sus nodos. Se declara
 * aparte (y no como `inject(SolTreeComponent)`) para que el nodo recursivo
 * NO dependa de una clase declarada después en el archivo y para que el
 * acoplamiento entre ambos quede explícito y probable.
 */
interface SolTreeOwner {
  readonly expandedSet: Signal<ReadonlySet<string>>;
  readonly maxDepth: Signal<number>;
  readonly indent: Signal<number>;
  readonly nodeTemplate: Signal<TemplateRef<SolTreeNodeTemplateContext> | null>;
  toggle(node: SolTreeNode): void;
  select(node: SolTreeNode): void;
}

/**
 * Estado compartido por TODOS los nodos de un mismo `sol-tree` (se provee en
 * `providers` del contenedor, así cada árbol tiene el suyo).
 *
 * `activeId` es el cursor del roving tabindex: solo el nodo activo lleva
 * `tabindex="0"`, el resto `-1`. Así el árbol completo es UNA sola parada de
 * Tab y las flechas mueven el foco adentro (patrón `tree` de la APG).
 */
@Injectable()
export class SolTreeState {
  /** Id del único nodo que es parada de Tab. */
  readonly activeId = signal<string | null>(null);

  /** Lo instala el contenedor en su constructor, antes de crear cualquier nodo. */
  owner!: SolTreeOwner;
}

/**
 * Nodo recursivo del árbol: se renderiza a sí mismo para cada hijo, de modo
 * que el anidamiento ARIA (`treeitem` › `group` › `treeitem`) calza con el
 * DOM sin listas aplanadas.
 *
 * `role="treeitem"`, el `tabindex` y el manejo de teclado viven en el HOST
 * (no en un `<div>` interno): así este elemento es el que recibe el foco y
 * el que aparece en la consulta del roving tabindex de `moveFocus()`.
 *
 * Es una pieza INTERNA de `sol-tree`; no se usa suelta.
 */
@Component({
  selector: 'sol-tree-node',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, SolIconComponent, SolTreeNodeComponent],
  host: {
    role: 'treeitem',
    class: 'sol-tree__item',
    '[attr.aria-expanded]': 'hasChildren() ? expanded() : null',
    '[attr.aria-level]': 'depth() + 1',
    '[attr.tabindex]': 'tabIndexValue()',
    '(keydown)': 'onKeydown($event)',
    '(focus)': 'onFocus()',
  },
  template: `
    <div class="sol-tree__row" [style.paddingLeft.px]="depth() * indent()">
      @if (hasChildren()) {
        <button
          type="button"
          class="sol-tree__toggle"
          tabindex="-1"
          [attr.aria-label]="toggleAriaLabel()"
          (click)="onToggleClick($event)"
        >
          <sol-icon [name]="expanded() ? 'chevron-down' : 'chevron-right'" size="sm" />
        </button>
      } @else {
        <span class="sol-tree__toggle-spacer" aria-hidden="true"></span>
      }

      <div class="sol-tree__content">
        @if (nodeTemplate(); as tpl) {
          <ng-container
            [ngTemplateOutlet]="tpl"
            [ngTemplateOutletContext]="templateContext()"
          />
        } @else {
          <span class="sol-tree__label">{{ node().label }}</span>
        }
      </div>
    </div>

    @if (showChildren()) {
      <div role="group" class="sol-tree__group">
        @for (child of children(); track child.id) {
          <sol-tree-node [node]="child" [depth]="depth() + 1" />
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
      border-radius: var(--sol-border-radius-lg, 12px);
      outline: none;
    }

    :host(:focus-visible) {
      outline: 2px solid var(--sol-color-primary, #2563eb);
      outline-offset: 2px;
    }

    .sol-tree__row {
      display: flex;
      align-items: center;
      gap: var(--sol-space-sm, 0.5rem);
      min-width: 0;
    }

    .sol-tree__toggle,
    .sol-tree__toggle-spacer {
      flex: none;
      width: 2.25rem;
      height: 2.25rem;
    }

    .sol-tree__toggle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      border: none;
      border-radius: var(--sol-border-radius-md, 8px);
      background: transparent;
      color: var(--sol-color-text-secondary, #6b7280);
      cursor: pointer;
      transition:
        background var(--sol-dur-fast, 120ms) var(--sol-ease, ease),
        color var(--sol-dur-fast, 120ms) var(--sol-ease, ease);
    }

    .sol-tree__toggle:hover {
      background: var(--sol-bg-sunken, rgba(0, 0, 0, 0.05));
      color: var(--sol-color-text-primary, #111827);
    }

    .sol-tree__content {
      flex: 1 1 auto;
      min-width: 0;
    }

    .sol-tree__label {
      display: block;
      overflow: hidden;
      color: var(--sol-color-text-primary, #111827);
      font-family: var(--sol-font-family);
      font-size: var(--sol-font-size-base, 14px);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .sol-tree__group {
      display: flex;
      flex-direction: column;
      gap: var(--sol-space-sm, 0.5rem);
      margin-top: var(--sol-space-sm, 0.5rem);
    }

    @media (prefers-reduced-motion: reduce) {
      .sol-tree__toggle {
        transition: none;
      }
    }
  `,
})
export class SolTreeNodeComponent {
  /** Nodo que pinta esta instancia. */
  readonly node = input.required<SolTreeNode>();

  /** Profundidad base 0 (las raíces valen 0). */
  readonly depth = input<number>(0);

  private readonly el: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly state = inject(SolTreeState);
  private readonly i18n = injectSolI18n();

  protected readonly children = computed<readonly SolTreeNode[]>(
    () => this.node().children ?? [],
  );

  protected readonly hasChildren = computed(() => this.children().length > 0);

  protected readonly expanded = computed(() =>
    this.state.owner.expandedSet().has(this.node().id),
  );

  protected readonly indent = computed(() => this.state.owner.indent());

  protected readonly nodeTemplate = computed(() => this.state.owner.nodeTemplate());

  /** Corta la recursión en `maxDepth` niveles visibles (ver {@link SOL_TREE_MAX_DEPTH}). */
  protected readonly canDescend = computed(
    () => this.depth() + 1 < this.state.owner.maxDepth(),
  );

  protected readonly showChildren = computed(
    () => this.hasChildren() && this.expanded() && this.canDescend(),
  );

  /** Roving tabindex: solo el nodo activo es parada de Tab. */
  protected readonly tabIndexValue = computed(() =>
    this.state.activeId() === this.node().id ? 0 : -1,
  );

  protected readonly templateContext = computed<SolTreeNodeTemplateContext>(() => ({
    $implicit: this.node(),
    node: this.node(),
    depth: this.depth(),
    expanded: this.expanded(),
    hasChildren: this.hasChildren(),
  }));

  /** `aria-label` del chevron: varía con el estado y con el nombre del nodo. */
  protected readonly toggleAriaLabel = computed(() => {
    this.i18n.activeLang();
    const label = this.node().label;
    return this.expanded()
      ? this.text('shared.tree.collapseAria', `Collapse ${label}`, label)
      : this.text('shared.tree.expandAria', `Expand ${label}`, label);
  });

  protected onToggleClick(event: MouseEvent): void {
    // El clic en el chevron no debe burbujear hacia la fila del consumidor.
    event.stopPropagation();
    this.state.owner.toggle(this.node());
  }

  protected onFocus(): void {
    this.state.activeId.set(this.node().id);
  }

  /**
   * Teclado del patrón `tree` (idéntico al del árbol de jerarquía original):
   * Enter/Espacio activa —alterna si tiene hijos, selecciona si es hoja—,
   * ←/→ colapsa/expande y ↑/↓ mueven el foco entre los `treeitem` VISIBLES.
   *
   * Dos ajustes sobre el original, ambos deliberados:
   *  1. "Activar una hoja" ya no navega: emite `nodeSelected` y el consumidor
   *     decide (requisito de acoplamiento cero al dominio).
   *  2. Solo actúa el `treeitem` REALMENTE enfocado. El original escuchaba en
   *     el host sin filtrar el `target`, así que la tecla de un nodo anidado
   *     burbujeaba y sus ancestros la volvían a procesar (con ↓ el foco
   *     terminaba en el lugar equivocado); además, con esta guarda, escribir
   *     con flechas dentro de un campo de la plantilla proyectada ya no mueve
   *     el foco del árbol.
   */
  protected onKeydown(event: KeyboardEvent): void {
    if (event.target !== this.el.nativeElement) return;

    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (this.hasChildren()) {
          this.state.owner.toggle(this.node());
        } else {
          this.state.owner.select(this.node());
        }
        break;
      case 'ArrowRight':
        if (this.hasChildren() && !this.expanded()) {
          event.preventDefault();
          this.state.owner.toggle(this.node());
        }
        break;
      case 'ArrowLeft':
        if (this.hasChildren() && this.expanded()) {
          event.preventDefault();
          this.state.owner.toggle(this.node());
        }
        break;
      case 'ArrowDown':
        event.preventDefault();
        this.moveFocus(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.moveFocus(-1);
        break;
    }
  }

  /**
   * Mueve el foco al `treeitem` visible siguiente/anterior en orden del DOM.
   * Como los hijos colapsados no se renderizan, ese orden ya coincide con el
   * orden visual de arriba hacia abajo: no hace falta aplanar el árbol.
   */
  private moveFocus(delta: number): void {
    const container = this.el.nativeElement.closest<HTMLElement>('[role="tree"]');
    if (!container) return;
    const items = Array.from(
      container.querySelectorAll<HTMLElement>('[role="treeitem"]'),
    );
    const index = items.indexOf(this.el.nativeElement);
    items[index + delta]?.focus();
  }

  /** Resuelve texto: clave i18n (catálogo del host o el incluido) → respaldo en inglés. */
  private text(key: string, fallback: string, label: string): string {
    const translated = this.i18n.translate(key, { label });
    return translated && translated !== key ? translated : fallback;
  }
}

/**
 * `sol-tree` — árbol jerárquico genérico del design system.
 *
 * Sube a la librería el MECANISMO (recursión, ARIA `tree`/`treeitem`/`group`,
 * roving tabindex con flechas, expandir/colapsar, cota de profundidad) y deja
 * en la aplicación el CÓMO SE PINTA cada nodo, vía el `ng-template` marcado
 * con `solTreeNodeDef`. Cero conocimiento del dominio: ni rutas, ni `Router`,
 * ni badges, ni barras de avance.
 *
 * ```html
 * <sol-tree
 *   [nodes]="arbol()"
 *   [(expandedIds)]="expandidos"
 *   (nodeSelected)="router.navigate(['/proyectos', $event.id])"
 *   (nodeToggled)="persistir($event.expandedIds)"
 * >
 *   <ng-template solTreeNodeDef let-node let-expanded="expanded">
 *     <sol-card>{{ node.label }}</sol-card>
 *   </ng-template>
 * </sol-tree>
 * ```
 *
 * Estados: si `nodes` llega vacío el árbol no pinta nada — el vacío legítimo,
 * la carga y el error son del consumidor (`sol-skeleton`, `sol-empty-state`).
 *
 * @typeParam T Tipo de la carga libre `data` de cada nodo.
 */
@Component({
  selector: 'sol-tree',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [SolTreeState],
  imports: [SolTreeNodeComponent],
  template: `
    <div role="tree" class="sol-tree" [attr.aria-label]="treeAriaLabel()">
      @for (root of nodes(); track root.id) {
        <sol-tree-node [node]="root" [depth]="0" />
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }

    .sol-tree {
      display: flex;
      flex-direction: column;
      gap: var(--sol-space-sm, 0.5rem);
      font-family: var(--sol-font-family);
    }
  `,
})
export class SolTreeComponent<T = unknown> implements SolTreeOwner {
  private readonly i18n = injectSolI18n();
  private readonly state = inject(SolTreeState);

  /** Raíces del bosque. Un árbol de una sola raíz es un arreglo de un elemento. */
  readonly nodes = input.required<readonly SolTreeNode<T>[]>();

  /**
   * Ids expandidos, enlazable en dos vías `[(expandedIds)]`.
   *
   * `null` (default) = NO controlado: el árbol maneja la expansión solo y la
   * siembra con {@link defaultExpandedDepth}. Cualquier arreglo —incluido
   * `[]`— pasa a modo controlado: manda el consumidor y el árbol solo propone
   * el nuevo valor. Se eligió `null` en vez de `[]` como default justamente
   * para poder distinguir "no me controles" de "todo colapsado".
   */
  readonly expandedIds = model<readonly string[] | null>(null);

  /**
   * Niveles que arrancan expandidos en modo no controlado. `1` (default)
   * expande las raíces, así el árbol nunca se ve como un muro de filas
   * colapsadas; `0` lo deja todo cerrado.
   */
  readonly defaultExpandedDepth = input<number>(1);

  /** Niveles VISIBLES como máximo. Ver {@link SOL_TREE_MAX_DEPTH}. */
  readonly maxDepth = input<number>(SOL_TREE_MAX_DEPTH);

  /** Sangría en px que suma cada nivel. */
  readonly indent = input<number>(16);

  /** Override del `aria-label` del contenedor `role="tree"`. */
  readonly ariaLabel = input<string>('');

  /** Se emite al activar un nodo hoja con Enter/Espacio, o al llamar {@link select}. */
  readonly nodeSelected = output<SolTreeNode<T>>();

  /** Se emite en cada expandir/colapsar, con el set completo resultante. */
  readonly nodeToggled = output<SolTreeToggleEvent<T>>();

  /** Plantilla de contenido proyectada (opcional: sin ella se pinta `node.label`). */
  private readonly nodeDef = contentChild(SolTreeNodeDefDirective);

  readonly nodeTemplate = computed<TemplateRef<SolTreeNodeTemplateContext> | null>(
    () => this.nodeDef()?.template ?? null,
  );

  /** Ids que la semilla dejaría expandidos con la profundidad actual. */
  private readonly seedIds = computed(() =>
    collectExpandableIds(this.nodes(), this.defaultExpandedDepth()),
  );

  /**
   * Clave estructural de la semilla. Se compara como string (no por
   * identidad del arreglo) para que un `nodes` recreado con el MISMO
   * contenido no borre lo que el usuario ya expandió o colapsó a mano.
   */
  private readonly seedKey = computed(() => this.seedIds().join('|'));

  /** Expansión interna (modo no controlado); se resiembra al cambiar el árbol. */
  private readonly autoExpanded = linkedSignal<string, ReadonlySet<string>>({
    source: this.seedKey,
    computation: () => untracked(() => new Set(this.seedIds())),
  });

  /** Set de expansión vigente: el del consumidor si controla, si no el interno. */
  readonly expandedSet = computed<ReadonlySet<string>>(() => {
    const controlled = this.expandedIds();
    return controlled === null ? this.autoExpanded() : new Set(controlled);
  });

  readonly treeAriaLabel = computed(() => {
    this.i18n.activeLang();
    const override = this.ariaLabel().trim();
    if (override) return override;
    const translated = this.i18n.translate('shared.tree.ariaLabel');
    return translated && translated !== 'shared.tree.ariaLabel'
      ? translated
      : 'Hierarchical tree';
  });

  constructor() {
    this.state.owner = this;

    // Roving tabindex: el árbol siempre tiene UNA parada de Tab. Se ancla en
    // la primera raíz y solo se reubica si el nodo activo desapareció del
    // árbol (recarga, filtro), nunca mientras el usuario navega con flechas.
    effect(() => {
      const roots = this.nodes();
      untracked(() => {
        const active = this.state.activeId();
        if (active !== null && containsId(roots, active)) return;
        this.state.activeId.set(roots[0]?.id ?? null);
      });
    });
  }

  /** ¿Está expandido ese id? */
  isExpanded(id: string): boolean {
    return this.expandedSet().has(id);
  }

  /** Alterna la expansión de un nodo (lo mismo que hace el chevron). */
  toggle(node: SolTreeNode): void {
    this.setExpanded(node, !this.expandedSet().has(node.id));
  }

  /** Fija la expansión de un nodo y emite `nodeToggled`. */
  setExpanded(node: SolTreeNode, expanded: boolean): void {
    const next = new Set(this.expandedSet());
    if (expanded) {
      next.add(node.id);
    } else {
      next.delete(node.id);
    }
    const ids = [...next];

    this.autoExpanded.set(next);
    if (this.expandedIds() !== null) {
      this.expandedIds.set(ids);
    }
    this.nodeToggled.emit({
      node: node as SolTreeNode<T>,
      expanded,
      expandedIds: ids,
    });
  }

  /**
   * Emite `nodeSelected`. Es la puerta para que la plantilla proyectada
   * seleccione CUALQUIER nodo con un clic propio (`(click)="tree.select(node)"`
   * sobre una referencia `#tree`), no solo las hojas con Enter/Espacio.
   */
  select(node: SolTreeNode): void {
    this.nodeSelected.emit(node as SolTreeNode<T>);
  }
}

/** Ids de los nodos con hijos que están por encima de `depth` (base 0). */
function collectExpandableIds(
  nodes: readonly SolTreeNode<unknown>[],
  depth: number,
  current = 0,
): string[] {
  if (current >= depth) return [];
  const ids: string[] = [];
  for (const node of nodes) {
    const children = node.children ?? [];
    if (children.length === 0) continue;
    ids.push(node.id);
    ids.push(...collectExpandableIds(children, depth, current + 1));
  }
  return ids;
}

/** ¿Existe ese id en alguna parte del bosque? */
function containsId(nodes: readonly SolTreeNode<unknown>[], id: string): boolean {
  for (const node of nodes) {
    if (node.id === id) return true;
    if (containsId(node.children ?? [], id)) return true;
  }
  return false;
}
