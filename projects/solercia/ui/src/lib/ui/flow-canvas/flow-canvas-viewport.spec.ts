import { describe, expect, it } from 'vitest';
import {
  DEFAULT_VIEWPORT,
  MAX_ZOOM,
  MIN_ZOOM,
  clampZoom,
  computePinchZoom,
  computeWheelZoom,
  distanceBetween,
  midpoint,
  panBy,
  panToRevealWorldRect,
  screenToWorld,
  worldToScreen,
  zoomAtScreenPoint,
} from './flow-canvas-viewport';

/**
 * Motor de pan/zoom de `sol-flow-canvas` (Ola 5 PR-C2B) — PURO, sin Angular,
 * sin DOM (mismo criterio que `flow-canvas-layout.ts`). Convención de
 * coordenadas (documentada también en la docstring del módulo):
 *  - "screen": px relativos a la esquina superior izquierda del host
 *    `.sol-flow-canvas` (NO `event.clientX/Y` crudo — eso lo resuelve el
 *    componente restando `getBoundingClientRect()`).
 *  - "world"/"canvas": el mismo sistema de coordenadas que `node.position`
 *    (el que ya usaba el shell de PR-C1 con zoom=1/pan=(0,0) implícitos).
 *  - `screen = world * zoom + pan`; inversa: `world = (screen - pan) / zoom`.
 */

describe('clampZoom', () => {
  it('conserva un zoom dentro de rango', () => {
    expect(clampZoom(1)).toBe(1);
  });

  it('clampea por debajo de MIN_ZOOM', () => {
    expect(clampZoom(0.01)).toBe(MIN_ZOOM);
  });

  it('clampea por encima de MAX_ZOOM', () => {
    expect(clampZoom(100)).toBe(MAX_ZOOM);
  });
});

describe('screenToWorld / worldToScreen — inversas exactas', () => {
  it('con zoom=1 y pan=(0,0), screen y world coinciden (mismo criterio que el shell C1)', () => {
    const viewport = DEFAULT_VIEWPORT;
    expect(screenToWorld(viewport, { x: 123, y: 45 })).toEqual({ x: 123, y: 45 });
  });

  it('con pan≠0, resta el pan antes de dividir por el zoom', () => {
    const viewport = { panX: 50, panY: -20, zoom: 1 };
    expect(screenToWorld(viewport, { x: 150, y: 30 })).toEqual({ x: 100, y: 50 });
  });

  it('con zoom≠1, divide por el zoom DESPUÉS de restar el pan', () => {
    const viewport = { panX: 10, panY: 10, zoom: 2 };
    // screen=(110,110) -> world = ((110-10)/2, (110-10)/2) = (50,50)
    expect(screenToWorld(viewport, { x: 110, y: 110 })).toEqual({ x: 50, y: 50 });
  });

  it('worldToScreen es la inversa exacta de screenToWorld para cualquier viewport', () => {
    const viewport = { panX: 33, panY: -17, zoom: 1.5 };
    const world = { x: 200, y: -80 };
    const screen = worldToScreen(viewport, world);
    expect(screenToWorld(viewport, screen)).toEqual(world);
  });
});

describe('zoomAtScreenPoint — el punto ANCLA se queda fijo en pantalla al cambiar el zoom', () => {
  it('duplicar el zoom anclado en un punto conserva ese punto en world DESPUÉS del cambio', () => {
    const viewport = DEFAULT_VIEWPORT; // pan=(0,0), zoom=1
    const anchor = { x: 100, y: 80 };
    const worldBefore = screenToWorld(viewport, anchor);

    const next = zoomAtScreenPoint(viewport, anchor, 2);

    expect(next.zoom).toBe(2);
    expect(screenToWorld(next, anchor)).toEqual(worldBefore);
  });

  it('funciona igual con un pan/zoom de partida no-trivial', () => {
    const viewport = { panX: -40, panY: 60, zoom: 1.3 };
    const anchor = { x: 250, y: 60 };
    const worldBefore = screenToWorld(viewport, anchor);

    const next = zoomAtScreenPoint(viewport, anchor, 0.8);

    expect(screenToWorld(next, anchor).x).toBeCloseTo(worldBefore.x, 6);
    expect(screenToWorld(next, anchor).y).toBeCloseTo(worldBefore.y, 6);
  });

  it('clampea el zoom objetivo antes de recalcular el pan', () => {
    const next = zoomAtScreenPoint(DEFAULT_VIEWPORT, { x: 0, y: 0 }, 999);
    expect(next.zoom).toBe(MAX_ZOOM);
  });

  it('un zoom objetivo IGUAL al actual no cambia el viewport (evita trabajo/objetos nuevos innecesarios)', () => {
    const viewport = { panX: 5, panY: 5, zoom: 1 };
    expect(zoomAtScreenPoint(viewport, { x: 10, y: 10 }, 1)).toBe(viewport);
  });
});

describe('computeWheelZoom — rueda del mouse', () => {
  it('deltaY negativo (scroll "hacia adelante") ACERCA — zoom aumenta', () => {
    const next = computeWheelZoom(DEFAULT_VIEWPORT, -100, { x: 0, y: 0 });
    expect(next.zoom).toBeGreaterThan(1);
  });

  it('deltaY positivo (scroll "hacia atrás") ALEJA — zoom disminuye', () => {
    const next = computeWheelZoom(DEFAULT_VIEWPORT, 100, { x: 0, y: 0 });
    expect(next.zoom).toBeLessThan(1);
  });

  it('respeta el clamp MIN/MAX incluso con deltas extremos', () => {
    expect(computeWheelZoom(DEFAULT_VIEWPORT, -100000, { x: 0, y: 0 }).zoom).toBe(MAX_ZOOM);
    expect(computeWheelZoom(DEFAULT_VIEWPORT, 100000, { x: 0, y: 0 }).zoom).toBe(MIN_ZOOM);
  });

  it('mantiene el punto bajo el cursor fijo (delega en zoomAtScreenPoint)', () => {
    const anchor = { x: 300, y: 120 };
    const worldBefore = screenToWorld(DEFAULT_VIEWPORT, anchor);
    const next = computeWheelZoom(DEFAULT_VIEWPORT, -50, anchor);
    expect(screenToWorld(next, anchor).x).toBeCloseTo(worldBefore.x, 6);
    expect(screenToWorld(next, anchor).y).toBeCloseTo(worldBefore.y, 6);
  });
});

describe('panBy — arrastre del fondo (delta de PANTALLA, independiente del zoom)', () => {
  it('suma el delta de pantalla directo al pan — el pan NO se divide por zoom (mismo criterio que un mapa: el fondo sigue al dedo 1:1)', () => {
    const viewport = { panX: 10, panY: -5, zoom: 3 };
    const next = panBy(viewport, { x: 20, y: 8 });
    expect(next).toEqual({ panX: 30, panY: 3, zoom: 3 });
  });
});

describe('distanceBetween / midpoint — soporte de pinch', () => {
  it('distancia euclidiana entre dos puntos', () => {
    expect(distanceBetween({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('punto medio entre dos puntos', () => {
    expect(midpoint({ x: 0, y: 0 }, { x: 10, y: 20 })).toEqual({ x: 5, y: 10 });
  });
});

describe('computePinchZoom — dos punteros (touch)', () => {
  it('separar los dedos (distancia actual > previa) ACERCA', () => {
    const next = computePinchZoom(DEFAULT_VIEWPORT, 100, 200, { x: 0, y: 0 });
    expect(next.zoom).toBe(2); // ratio 200/100 = 2x
  });

  it('juntar los dedos (distancia actual < previa) ALEJA', () => {
    const next = computePinchZoom(DEFAULT_VIEWPORT, 200, 100, { x: 0, y: 0 });
    expect(next.zoom).toBe(0.5);
  });

  it('mantiene el punto medio del pinch fijo en world (igual que zoomAtScreenPoint)', () => {
    const anchor = { x: 150, y: 150 };
    const viewport = { panX: 20, panY: -10, zoom: 1 };
    const worldBefore = screenToWorld(viewport, anchor);
    const next = computePinchZoom(viewport, 100, 150, anchor);
    expect(screenToWorld(next, anchor).x).toBeCloseTo(worldBefore.x, 6);
    expect(screenToWorld(next, anchor).y).toBeCloseTo(worldBefore.y, 6);
  });

  it('[robustez] distancia previa 0 o negativa no lanza ni produce NaN/Infinity — no-op', () => {
    expect(() => computePinchZoom(DEFAULT_VIEWPORT, 0, 150, { x: 0, y: 0 })).not.toThrow();
    const next = computePinchZoom(DEFAULT_VIEWPORT, 0, 150, { x: 0, y: 0 });
    expect(next).toEqual(DEFAULT_VIEWPORT);
  });
});

describe('panToRevealWorldRect — sigue al foco de teclado (PR-C2B, W-fix: overflow:hidden reemplaza el scroll nativo del navegador que traía "scroll into view" gratis con overflow:auto del shell de PR-C1; sin este ajuste, tabular a un nodo lejano movería el foco lógico SIN revelarlo visualmente)', () => {
  const viewportSize = { width: 400, height: 320 };

  it('un rect YA completamente visible no cambia el pan', () => {
    const worldRect = { x: 50, y: 50, width: 180, height: 56 };
    expect(panToRevealWorldRect(DEFAULT_VIEWPORT, worldRect, viewportSize)).toBe(DEFAULT_VIEWPORT);
  });

  it('un rect a la DERECHA del viewport panea hacia la izquierda (panX negativo) lo justo para revelarlo con margen', () => {
    // y=100 (no 0): deja el eje Y cómodamente DENTRO del margen para aislar el ajuste al eje X.
    const worldRect = { x: 2000, y: 100, width: 180, height: 56 };
    const next = panToRevealWorldRect(DEFAULT_VIEWPORT, worldRect, viewportSize);
    expect(next.panX).toBeLessThan(0);
    expect(next.panY).toBe(0);
    expect(next.zoom).toBe(1); // NUNCA cambia el zoom, solo el pan
    // el borde derecho del rect (2000+180=2180) debe caer EXACTO en (viewportWidth - margen) tras el ajuste
    expect(2180 * next.zoom + next.panX).toBeCloseTo(viewportSize.width - 24, 6);
  });

  it('un rect a la IZQUIERDA del viewport (x negativo) panea hacia la derecha (panX positivo)', () => {
    const worldRect = { x: -500, y: 100, width: 180, height: 56 };
    const next = panToRevealWorldRect(DEFAULT_VIEWPORT, worldRect, viewportSize);
    expect(next.panX).toBeGreaterThan(0);
    expect(-500 * next.zoom + next.panX).toBeCloseTo(24, 6); // borde izquierdo cae exacto en el margen
  });

  it('un rect ABAJO del viewport panea hacia arriba (panY negativo)', () => {
    // x=100 (no 0): deja el eje X cómodamente DENTRO del margen para aislar el ajuste al eje Y.
    const worldRect = { x: 100, y: 900, width: 180, height: 56 };
    const next = panToRevealWorldRect(DEFAULT_VIEWPORT, worldRect, viewportSize);
    expect(next.panY).toBeLessThan(0);
    expect(next.panX).toBe(0);
  });

  it('un rect cuyo borde de inicio cae DENTRO del margen (pero no negativo) también se reajusta — el margen aplica incluso sin "salirse" del todo', () => {
    const worldRect = { x: 100, y: 0, width: 180, height: 56 }; // y=0 < margen(24)
    const next = panToRevealWorldRect(DEFAULT_VIEWPORT, worldRect, viewportSize);
    expect(next.panY).toBe(24); // empuja el borde superior exactamente al margen
    expect(next.panX).toBe(0);
  });

  it('respeta el zoom vigente al decidir si el rect ya es visible', () => {
    const zoomedViewport = { panX: 0, panY: 0, zoom: 2 };
    // en world, x=150..330 (180 de ancho); a zoom=2 en pantalla es 300..660 — se sale del viewport de 400px.
    const worldRect = { x: 150, y: 0, width: 180, height: 56 };
    const next = panToRevealWorldRect(zoomedViewport, worldRect, viewportSize);
    expect(next.zoom).toBe(2);
    expect(next.panX).toBeLessThan(0);
  });

  it('[robustez] un viewport de tamaño 0 (sin layout medible aún) es un no-op seguro, nunca NaN/lanza', () => {
    const worldRect = { x: 99999, y: 99999, width: 180, height: 56 };
    expect(() => panToRevealWorldRect(DEFAULT_VIEWPORT, worldRect, { width: 0, height: 0 })).not.toThrow();
    expect(panToRevealWorldRect(DEFAULT_VIEWPORT, worldRect, { width: 0, height: 0 })).toBe(DEFAULT_VIEWPORT);
  });
});
