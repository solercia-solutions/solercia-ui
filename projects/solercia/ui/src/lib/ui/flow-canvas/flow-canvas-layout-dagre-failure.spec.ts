import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * W2 (4R Ola 5 post PR-C3, "dagre sin red") — spec AISLADO del resto de
 * `flow-canvas-layout.spec.ts` a propósito: `vi.mock('@dagrejs/dagre', ...)`
 * afecta TODO el archivo donde se declara, y el resto de la suite necesita
 * el dagre REAL para sus aserciones de ranking/minimización de cruces. Este
 * archivo ejercita ÚNICAMENTE la rama de fallback cuando el chunk lazy
 * (`import()` dinámico, ver docstring de `flow-canvas-layout.ts`) falla a
 * mitad de sesión — simulado forzando que la factory del mock lance.
 */
vi.mock('@dagrejs/dagre', () => {
  throw new Error('mock: chunk de dagre no disponible (simulación de "dagre sin red")');
});

describe('computeAutoLayoutPositions — fallback cuando el chunk lazy de dagre falla (W2, "dagre sin red")', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.resetModules(); // fuerza a que el import() dinámico del módulo bajo prueba reevalúe el mock en cada test
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('cae a computeLayeredFallbackPositions (nunca rechaza la promesa) y deja rastro con console.warn', async () => {
    const { computeAutoLayoutPositions, computeLayeredFallbackPositions } = await import('./flow-canvas-layout');
    const nodes = [
      { id: 'a', label: 'A', kind: 'default' as const, position: { x: 0, y: 0 } },
      { id: 'b', label: 'B', kind: 'default' as const, position: { x: 0, y: 0 } },
    ];
    const edges = [{ id: 'a->b', sourceId: 'a', targetId: 'b', kind: 'always' as const }];

    await expect(computeAutoLayoutPositions(nodes, edges)).resolves.not.toThrow();
    const positions = await computeAutoLayoutPositions(nodes, edges);
    const expected = computeLayeredFallbackPositions(nodes, edges);

    expect(positions).toEqual(expected);
    expect(warnSpy).toHaveBeenCalled();
  });
});
