import { describe, expect, it } from 'vitest';
import { deepMerge } from './deep-merge';

describe('deepMerge', () => {
  it('sobreescribe solo las rutas del patch y conserva el resto del base', () => {
    const base = { a: { b: 1, c: 2 }, d: 'x' };
    expect(deepMerge(base, { a: { b: 9 } })).toEqual({ a: { b: 9, c: 2 }, d: 'x' });
  });

  it('conserva claves que el tipo no declara (opera sobre las claves en runtime)', () => {
    const base = { a: { b: 1 } } as { a: { b: number } };
    (base.a as Record<string, unknown>)['extra'] = 'kept';
    const merged = deepMerge(base, { a: { b: 2 } });
    expect((merged.a as Record<string, unknown>)['extra']).toBe('kept');
  });

  it('un arreglo del patch reemplaza al del base (nunca se combina por índice)', () => {
    expect(deepMerge({ list: [1, 2, 3] }, { list: [9] })).toEqual({ list: [9] });
  });

  it('una clave con undefined en el patch se ignora', () => {
    expect(deepMerge({ a: 1, b: 2 }, { a: undefined })).toEqual({ a: 1, b: 2 });
  });

  it('descarta __proto__, prototype y constructor sin contaminar prototipos', () => {
    const patch = JSON.parse('{"__proto__":{"polluted":true},"constructor":{"x":1},"ok":1}') as Record<string, unknown>;
    const merged = deepMerge<Record<string, unknown>>({}, patch);
    expect(merged).toEqual({ ok: 1 });
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    expect(Object.getPrototypeOf(merged)).toBe(Object.prototype);
  });

  it('no muta ni el base ni el patch', () => {
    const base = { a: { b: 1 } };
    const patch = { a: { c: 2 } } as unknown as { a: { b: number } };
    const before = JSON.stringify([base, patch]);
    deepMerge(base, patch);
    expect(JSON.stringify([base, patch])).toBe(before);
  });
});
