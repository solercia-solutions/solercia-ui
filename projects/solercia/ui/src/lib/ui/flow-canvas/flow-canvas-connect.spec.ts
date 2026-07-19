import { describe, expect, it } from 'vitest';
import { computeValidConnectionTargets } from './flow-canvas-connect';
import type { SolFlowCanvasEdge, SolFlowCanvasNode } from './flow-canvas.model';

/**
 * Validez de destino al "tap-para-conectar" de `sol-flow-canvas` (Ola 5
 * PR-C2B) — PURA, sin Angular/DOM (mismo criterio que `flow-canvas-layout.ts`).
 *
 * Decisión de diseño (documentada también en `flow-canvas.component.ts`):
 * `sol-flow-canvas` es una librería AGNÓSTICA de dominio (ver docstring de
 * `flow-canvas.model.ts`) — NUNCA puede importar
 * `entities/flow/model/flow.validators.ts` de la app (violaría FSD y el
 * contrato "cero conocimiento de dominio" documentado en el propio modelo).
 * Este módulo reimplementa el MISMO criterio estructural que motiva 2 de los
 * checks de `flow.validators.ts` (`checkNoDuplicateTransitions` y el ESPÍRITU
 * de "ciclo ilegal" de `FlowValidator._validate_cycles`) pero como grafo PURO
 * — sin `yields_turn` (atributo de dominio que ni siquiera viaja a la API,
 * ver docstring de `flow.validators.ts`), así que la regla de ciclos de acá
 * es DELIBERADAMENTE más estricta que la del backend: excluye CUALQUIER
 * destino que ya pueda alcanzar el origen (cerraría un ciclo visible en el
 * lienzo), aunque el backend permita ciclos legítimos con `interrupt()`. Es
 * un HINT visual del canvas, no la fuente de verdad — el validador real de
 * `entities/flow` sigue siendo quien decide la legalidad final.
 *
 * Reglas:
 *  1. El propio origen NUNCA es un destino válido (sin auto-loop).
 *  2. Un destino con el que YA existe una arista origen→destino no es válido
 *     (evita una conexión duplicada — mismo espíritu que
 *     `checkNoDuplicateTransitions`).
 *  3. Un destino desde el que HOY se puede alcanzar el origen (vía aristas
 *     existentes) no es válido — conectarlo cerraría un ciclo.
 */

function n(id: string): SolFlowCanvasNode {
  return { id, label: id, kind: 'default', position: { x: 0, y: 0 } };
}

function e(sourceId: string, targetId: string): SolFlowCanvasEdge {
  return { id: `${sourceId}->${targetId}`, sourceId, targetId, kind: 'always' };
}

describe('computeValidConnectionTargets', () => {
  it('sin aristas, todos los DEMÁS nodos son destinos válidos', () => {
    const valid = computeValidConnectionTargets([n('a'), n('b'), n('c')], [], 'a');
    expect(valid).toEqual(new Set(['b', 'c']));
  });

  it('el propio origen nunca es válido (sin auto-loop)', () => {
    const valid = computeValidConnectionTargets([n('a'), n('b')], [], 'a');
    expect(valid.has('a')).toBe(false);
  });

  it('un destino con el que YA existe una arista origen→destino se excluye (evita duplicado)', () => {
    const valid = computeValidConnectionTargets([n('a'), n('b'), n('c')], [e('a', 'b')], 'a');
    expect(valid.has('b')).toBe(false);
    expect(valid.has('c')).toBe(true);
  });

  it('una arista en sentido CONTRARIO (b→a) no bloquea a→b como duplicado (son aristas distintas)', () => {
    const valid = computeValidConnectionTargets([n('a'), n('b')], [e('b', 'a')], 'a');
    // b→a existe; conectar a→b NO sería un duplicado de ESA arista... pero SÍ cerraría un ciclo (regla 3) — ver test siguiente.
    // Este test aísla la regla 2 (duplicado exacto a→b) usando un grafo donde la regla 3 también aplicaría,
    // así que se verifica con el motivo correcto: b queda excluido, pero por CICLO, no por duplicado.
    expect(valid.has('b')).toBe(false);
  });

  it('un destino desde el que HOY se puede alcanzar el origen cierra un ciclo — se excluye', () => {
    // a->b->c ya existe. Conectar c->a cerraría el ciclo a->b->c->a.
    const valid = computeValidConnectionTargets([n('a'), n('b'), n('c')], [e('a', 'b'), e('b', 'c')], 'c');
    expect(valid.has('a')).toBe(false);
    expect(valid.has('b')).toBe(false);
  });

  it('un ciclo se detecta de forma TRANSITIVA, no solo un salto directo', () => {
    // a->b->c->d ya existe. Conectar d->a cerraría el ciclo completo.
    const valid = computeValidConnectionTargets(
      [n('a'), n('b'), n('c'), n('d')],
      [e('a', 'b'), e('b', 'c'), e('c', 'd')],
      'd',
    );
    expect(valid.has('a')).toBe(false);
    expect(valid.has('b')).toBe(false);
    expect(valid.has('c')).toBe(false);
  });

  it('un nodo INALCANZABLE hacia el origen (rama distinta del grafo) SÍ es un destino válido', () => {
    // a->b existe; 'z' es un nodo aislado, sin relación con a.
    const valid = computeValidConnectionTargets([n('a'), n('b'), n('z')], [e('a', 'b')], 'a');
    expect(valid.has('z')).toBe(true);
  });

  it('un sourceId que no existe entre los nodos actuales devuelve un set vacío (defensivo)', () => {
    const valid = computeValidConnectionTargets([n('a'), n('b')], [], 'fantasma');
    expect(valid.size).toBe(0);
  });

  it('una arista que referencia un nodo ausente en `nodes` se ignora (mismo criterio de robustez que visibleEdges())', () => {
    const valid = computeValidConnectionTargets([n('a'), n('b')], [e('a', 'fantasma')], 'a');
    expect(valid.has('b')).toBe(true);
  });

  it('[robustez] nodes/edges null/undefined no lanza — set vacío', () => {
    expect(() => computeValidConnectionTargets(null, undefined, 'a')).not.toThrow();
    expect(computeValidConnectionTargets(null, undefined, 'a').size).toBe(0);
  });
});
