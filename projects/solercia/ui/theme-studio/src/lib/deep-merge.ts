/**
 * Fusión profunda tipada que usa el builder para PRESERVAR el `ThemeFile` base: `patch`
 * sobreescribe solo las rutas que declara (recursivamente en objetos planos) y cualquier clave
 * de `base` ausente en `patch` se conserva tal cual, incluidas las que el contrato TypeScript no
 * declara (la fusión opera sobre las claves en tiempo de ejecución, no sobre el tipo).
 *
 * Un array o un valor primitivo en `patch` REEMPLAZA al de `base` (nunca se combina por
 * índice). Una clave de `patch` con valor `undefined` se ignora (equivale a "sin cambio").
 * Las claves `__proto__`, `prototype` y `constructor` se descartan para no contaminar
 * prototipos. Nunca muta `base` ni `patch`.
 */

type Plain = Record<string, unknown>;

const UNSAFE_KEYS: ReadonlySet<string> = new Set(['__proto__', 'prototype', 'constructor']);

function isPlainObject(value: unknown): value is Plain {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** `T` con todas sus propiedades opcionales, recursivamente en objetos planos. */
export type DeepPartial<T> = T extends readonly (infer U)[]
  ? readonly DeepPartial<U>[]
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

export function deepMerge<T>(base: T, patch: DeepPartial<T>): T {
  if (!isPlainObject(base) || !isPlainObject(patch)) {
    return patch === undefined ? base : (patch as T);
  }
  const merged: Plain = { ...base };
  for (const key of Object.keys(patch)) {
    if (UNSAFE_KEYS.has(key)) continue;
    const patchValue = (patch as Plain)[key];
    if (patchValue === undefined) continue;
    const baseValue = (base as Plain)[key];
    merged[key] =
      isPlainObject(baseValue) && isPlainObject(patchValue)
        ? deepMerge(baseValue, patchValue)
        : patchValue;
  }
  return merged as T;
}
