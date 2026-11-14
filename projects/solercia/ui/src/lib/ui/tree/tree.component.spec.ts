import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { SOL_I18N } from '../../i18n/sol-i18n';
import {
  SOL_TREE_MAX_DEPTH,
  SolTreeComponent,
  SolTreeNodeDefDirective,
  type SolTreeNode,
  type SolTreeToggleEvent,
} from './tree.component';

/**
 * Specs de `sol-tree`. Cubren: render recursivo, ARIA (`tree`/`treeitem`/
 * `group`, `aria-expanded`, `aria-level`, roving tabindex), expandir/colapsar
 * por chevron y por teclado, navegación con flechas, cota de profundidad,
 * selección emitida (nunca navegada) y el contexto que recibe el
 * `ng-template` proyectado.
 *
 * El mock de SOL_I18N devuelve la clave tal cual (comportamiento de Transloco
 * ante clave ausente): así se ejercitan los textos por defecto es-CO.
 */

const TREE: SolTreeNode<{ tipo: string }>[] = [
  {
    id: 'a',
    label: 'Raíz A',
    data: { tipo: 'raiz' },
    children: [
      {
        id: 'a1',
        label: 'Hijo A1',
        children: [{ id: 'a1x', label: 'Nieto A1X' }],
      },
      { id: 'a2', label: 'Hoja A2' },
    ],
  },
  { id: 'b', label: 'Raíz B' },
];

/** Host que proyecta la plantilla de nodo y controla la expansión en dos vías. */
@Component({
  standalone: true,
  imports: [SolTreeComponent, SolTreeNodeDefDirective],
  template: `
    <sol-tree [nodes]="nodes" [(expandedIds)]="expandidos">
      <ng-template
        solTreeNodeDef
        let-node
        let-depth="depth"
        let-expanded="expanded"
        let-hasChildren="hasChildren"
      >
        <span
          class="celda"
          [attr.data-id]="node.id"
          [attr.data-depth]="depth"
          [attr.data-expanded]="expanded"
          [attr.data-hijos]="hasChildren"
          >{{ node.label }}</span
        >
      </ng-template>
    </sol-tree>
  `,
})
class ProjectionHostComponent {
  nodes = TREE;
  expandidos: readonly string[] | null = ['a'];
}

describe('SolTreeComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SOL_I18N,
          useValue: {
            activeLang: signal('es-CO'),
            translate: (key: string) => key,
          },
        },
      ],
    });
  });

  function create(
    inputs: Partial<{
      nodes: readonly SolTreeNode<{ tipo: string }>[];
      expandedIds: readonly string[] | null;
      defaultExpandedDepth: number;
      maxDepth: number;
      indent: number;
      ariaLabel: string;
    }> = {},
  ): ComponentFixture<SolTreeComponent<{ tipo: string }>> {
    const fixture = TestBed.createComponent(SolTreeComponent) as ComponentFixture<
      SolTreeComponent<{ tipo: string }>
    >;
    fixture.componentRef.setInput('nodes', inputs.nodes ?? TREE);
    for (const key of [
      'expandedIds',
      'defaultExpandedDepth',
      'maxDepth',
      'indent',
      'ariaLabel',
    ] as const) {
      if (inputs[key] !== undefined) fixture.componentRef.setInput(key, inputs[key]);
    }
    fixture.detectChanges();
    return fixture;
  }

  const root = (f: ComponentFixture<unknown>) => f.nativeElement as HTMLElement;
  const items = (f: ComponentFixture<unknown>) =>
    Array.from(root(f).querySelectorAll<HTMLElement>('[role="treeitem"]'));
  const labels = (f: ComponentFixture<unknown>) =>
    items(f).map(el => el.querySelector('.sol-tree__label')?.textContent?.trim() ?? '');
  const chevron = (item: HTMLElement) =>
    item.querySelector<HTMLButtonElement>(':scope > .sol-tree__row > .sol-tree__toggle');
  const press = (item: HTMLElement, key: string) =>
    item.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
    );

  // ── Render recursivo ──────────────────────────────────────────────────

  it('renderiza el bosque de raíces y, expandidas, sus hijos anidados', () => {
    const fixture = create();
    // defaultExpandedDepth=1 ⇒ la raíz con hijos arranca abierta.
    expect(labels(fixture)).toEqual(['Raíz A', 'Hijo A1', 'Hoja A2', 'Raíz B']);
  });

  it('anida los hijos dentro de un role="group" del propio treeitem', () => {
    const fixture = create();
    const grupo = items(fixture)[0].querySelector<HTMLElement>(':scope > [role="group"]');
    expect(grupo).not.toBeNull();
    expect(grupo!.querySelectorAll(':scope > [role="treeitem"]').length).toBe(2);
  });

  it('recursión de tercer nivel: al expandir el hijo aparece el nieto', () => {
    const fixture = create();
    press(items(fixture)[1], 'ArrowRight');
    fixture.detectChanges();
    expect(labels(fixture)).toContain('Nieto A1X');
  });

  it('con defaultExpandedDepth=0 arranca todo colapsado', () => {
    const fixture = create({ defaultExpandedDepth: 0 });
    expect(labels(fixture)).toEqual(['Raíz A', 'Raíz B']);
  });

  it('no pinta nada cuando el bosque llega vacío (el vacío es del consumidor)', () => {
    const fixture = create({ nodes: [] });
    expect(items(fixture).length).toBe(0);
    expect(root(fixture).querySelector('[role="tree"]')).not.toBeNull();
  });

  // ── ARIA ──────────────────────────────────────────────────────────────

  it('el contenedor es role="tree" con el aria-label por defecto es-CO', () => {
    const fixture = create();
    const tree = root(fixture).querySelector<HTMLElement>('[role="tree"]');
    expect(tree).not.toBeNull();
    expect(tree!.getAttribute('aria-label')).toBe('Árbol jerárquico');
  });

  it('permite el override del aria-label por input', () => {
    const fixture = create({ ariaLabel: 'Jerarquía de proyectos' });
    expect(
      root(fixture).querySelector('[role="tree"]')!.getAttribute('aria-label'),
    ).toBe('Jerarquía de proyectos');
  });

  it('aria-expanded solo existe en nodos con hijos y refleja su estado', () => {
    const fixture = create();
    const [a, a1, a2, b] = items(fixture);
    expect(a.getAttribute('aria-expanded')).toBe('true');
    expect(a1.getAttribute('aria-expanded')).toBe('false');
    expect(a2.getAttribute('aria-expanded')).toBeNull();
    expect(b.getAttribute('aria-expanded')).toBeNull();
  });

  it('aria-level es base 1 y crece con la profundidad', () => {
    const fixture = create();
    expect(items(fixture).map(el => el.getAttribute('aria-level'))).toEqual([
      '1',
      '2',
      '2',
      '1',
    ]);
  });

  it('roving tabindex: solo la primera raíz es parada de Tab', () => {
    const fixture = create();
    expect(items(fixture).map(el => el.getAttribute('tabindex'))).toEqual([
      '0',
      '-1',
      '-1',
      '-1',
    ]);
  });

  it('el foco en otro nodo mueve la única parada de Tab hacia él', () => {
    const fixture = create();
    items(fixture)[2].dispatchEvent(new FocusEvent('focus'));
    fixture.detectChanges();
    expect(items(fixture).map(el => el.getAttribute('tabindex'))).toEqual([
      '-1',
      '-1',
      '0',
      '-1',
    ]);
  });

  it('el chevron queda fuera del orden de tabulación y trae aria-label es-CO', () => {
    const fixture = create();
    const boton = chevron(items(fixture)[0])!;
    expect(boton.getAttribute('tabindex')).toBe('-1');
    expect(boton.getAttribute('aria-label')).toBe('Contraer Raíz A');

    boton.click();
    fixture.detectChanges();
    expect(chevron(items(fixture)[0])!.getAttribute('aria-label')).toBe(
      'Expandir Raíz A',
    );
  });

  // ── Expandir / colapsar ───────────────────────────────────────────────

  it('el clic en el chevron colapsa y vuelve a expandir', () => {
    const fixture = create();
    chevron(items(fixture)[0])!.click();
    fixture.detectChanges();
    expect(labels(fixture)).toEqual(['Raíz A', 'Raíz B']);

    chevron(items(fixture)[0])!.click();
    fixture.detectChanges();
    expect(labels(fixture)).toEqual(['Raíz A', 'Hijo A1', 'Hoja A2', 'Raíz B']);
  });

  it('emite nodeToggled con el nodo, el estado y el set completo resultante', () => {
    const fixture = create();
    const eventos: SolTreeToggleEvent<{ tipo: string }>[] = [];
    fixture.componentInstance.nodeToggled.subscribe(e => eventos.push(e));

    chevron(items(fixture)[0])!.click();
    fixture.detectChanges();
    expect(eventos).toHaveLength(1);
    expect(eventos[0].node.id).toBe('a');
    expect(eventos[0].expanded).toBe(false);
    expect(eventos[0].expandedIds).toEqual([]);

    press(items(fixture)[0], 'ArrowRight');
    fixture.detectChanges();
    expect(eventos[1].node.id).toBe('a');
    expect(eventos[1].expanded).toBe(true);
    expect(eventos[1].expandedIds).toEqual(['a']);
  });

  it('modo controlado: con expandedIds=[] manda el consumidor y arranca colapsado', () => {
    const fixture = create({ expandedIds: [] });
    expect(labels(fixture)).toEqual(['Raíz A', 'Raíz B']);
  });

  it('expandedIds es enlazable en dos vías: el chevron actualiza el host', () => {
    const fixture = TestBed.createComponent(ProjectionHostComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.expandidos).toEqual(['a']);

    chevron(items(fixture)[0])!.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.expandidos).toEqual([]);
    expect(items(fixture).length).toBe(2);
  });

  it('la API pública permite consultar y fijar la expansión', () => {
    const fixture = create();
    const tree = fixture.componentInstance;
    expect(tree.isExpanded('a')).toBe(true);

    tree.setExpanded(TREE[0].children![0], true);
    fixture.detectChanges();
    expect(tree.isExpanded('a1')).toBe(true);
    expect(labels(fixture)).toContain('Nieto A1X');
  });

  // ── Teclado ───────────────────────────────────────────────────────────

  it('ArrowRight expande y ArrowLeft colapsa el nodo enfocado', () => {
    const fixture = create();
    press(items(fixture)[1], 'ArrowRight');
    fixture.detectChanges();
    expect(items(fixture)[1].getAttribute('aria-expanded')).toBe('true');

    press(items(fixture)[1], 'ArrowLeft');
    fixture.detectChanges();
    expect(items(fixture)[1].getAttribute('aria-expanded')).toBe('false');
  });

  it('ArrowDown/ArrowUp mueven el foco entre los treeitem VISIBLES', () => {
    const fixture = create();
    const visibles = items(fixture);

    press(visibles[0], 'ArrowDown');
    expect(document.activeElement).toBe(visibles[1]);

    press(visibles[1], 'ArrowDown');
    expect(document.activeElement).toBe(visibles[2]);

    press(visibles[2], 'ArrowUp');
    expect(document.activeElement).toBe(visibles[1]);
  });

  it('ArrowUp en la primera raíz no saca el foco del árbol', () => {
    const fixture = create();
    const primero = items(fixture)[0];
    primero.focus();
    press(primero, 'ArrowUp');
    expect(document.activeElement).toBe(primero);
  });

  it('Enter/Espacio alternan cuando el nodo tiene hijos', () => {
    const fixture = create();
    press(items(fixture)[0], 'Enter');
    fixture.detectChanges();
    expect(labels(fixture)).toEqual(['Raíz A', 'Raíz B']);

    press(items(fixture)[0], ' ');
    fixture.detectChanges();
    expect(labels(fixture)).toEqual(['Raíz A', 'Hijo A1', 'Hoja A2', 'Raíz B']);
  });

  it('Enter en una hoja emite nodeSelected y NO navega', () => {
    const fixture = create();
    const seleccionados: SolTreeNode<{ tipo: string }>[] = [];
    fixture.componentInstance.nodeSelected.subscribe(n => seleccionados.push(n));

    press(items(fixture)[2], 'Enter');
    fixture.detectChanges();

    expect(seleccionados.map(n => n.id)).toEqual(['a2']);
  });

  it('select() permite seleccionar cualquier nodo desde la plantilla del consumidor', () => {
    const fixture = create();
    const seleccionados: SolTreeNode<{ tipo: string }>[] = [];
    fixture.componentInstance.nodeSelected.subscribe(n => seleccionados.push(n));

    fixture.componentInstance.select(TREE[0]);
    expect(seleccionados.map(n => n.id)).toEqual(['a']);
    expect(seleccionados[0].data).toEqual({ tipo: 'raiz' });
  });

  // ── Cota de profundidad ───────────────────────────────────────────────

  it('el default de maxDepth es la cota heredada del árbol original', () => {
    expect(SOL_TREE_MAX_DEPTH).toBe(5);
    expect(create().componentInstance.maxDepth()).toBe(5);
  });

  it('maxDepth corta la recursión aunque el nodo esté expandido', () => {
    const fixture = create({ maxDepth: 2 });
    press(items(fixture)[1], 'ArrowRight');
    fixture.detectChanges();

    expect(items(fixture)[1].getAttribute('aria-expanded')).toBe('true');
    expect(labels(fixture)).not.toContain('Nieto A1X');
  });

  it('la sangría por nivel usa el input indent', () => {
    const fixture = create({ indent: 24 });
    const fila = (i: number) =>
      items(fixture)[i].querySelector<HTMLElement>(':scope > .sol-tree__row')!;
    expect(fila(0).style.paddingLeft).toBe('0px');
    expect(fila(1).style.paddingLeft).toBe('24px');
  });

  // ── Plantilla proyectada ──────────────────────────────────────────────

  it('sin plantilla proyectada pinta la etiqueta del nodo', () => {
    const fixture = create();
    expect(root(fixture).querySelectorAll('.sol-tree__label').length).toBe(4);
  });

  it('la plantilla proyectada reemplaza el render por defecto', () => {
    const fixture = TestBed.createComponent(ProjectionHostComponent);
    fixture.detectChanges();
    expect(root(fixture).querySelector('.sol-tree__label')).toBeNull();
    expect(root(fixture).querySelectorAll('.celda').length).toBe(4);
  });

  it('la plantilla proyectada recibe nodo, profundidad, expansión e hijos', () => {
    const fixture = TestBed.createComponent(ProjectionHostComponent);
    fixture.detectChanges();

    const celdas = Array.from(root(fixture).querySelectorAll<HTMLElement>('.celda'));
    const contexto = celdas.map(el => ({
      id: el.dataset['id'],
      depth: el.dataset['depth'],
      expanded: el.dataset['expanded'],
      hijos: el.dataset['hijos'],
      texto: el.textContent?.trim(),
    }));

    expect(contexto).toEqual([
      { id: 'a', depth: '0', expanded: 'true', hijos: 'true', texto: 'Raíz A' },
      { id: 'a1', depth: '1', expanded: 'false', hijos: 'true', texto: 'Hijo A1' },
      { id: 'a2', depth: '1', expanded: 'false', hijos: 'false', texto: 'Hoja A2' },
      { id: 'b', depth: '0', expanded: 'false', hijos: 'false', texto: 'Raíz B' },
    ]);
  });
});
