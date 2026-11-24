/**
 * Setup global de pruebas — polyfill de Web Storage (localStorage / sessionStorage).
 *
 * El entorno de pruebas (builder `@angular/build:unit-test` + runner vitest)
 * expone `window` y `document`, pero NO la Web Storage API. Varios specs usan
 * `localStorage` / `sessionStorage` directamente (ThemeService, login, auth),
 * por lo que aquí se instala una implementación en memoria conforme a la
 * interfaz `Storage` únicamente cuando el entorno no la provee.
 *
 * Es exclusivo del entorno de test: NO altera código de producción.
 */

/** Implementación en memoria de la Web Storage API (`Storage`). */
class InMemoryStorage {
  private readonly store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

/**
 * Instala un `Storage` en memoria en `globalThis` (y en `window` si existe)
 * cuando el entorno de pruebas no expone uno funcional. Si ya hay una
 * implementación válida, no se toca.
 */
function ensureStorage(name: 'localStorage' | 'sessionStorage'): void {
  const current = (globalThis as Record<string, unknown>)[name] as
    | { getItem?: unknown }
    | undefined;

  if (current != null && typeof current.getItem === 'function') {
    return;
  }

  const storage = new InMemoryStorage();

  Object.defineProperty(globalThis, name, {
    value: storage,
    writable: true,
    configurable: true,
  });

  if (typeof window !== 'undefined') {
    Object.defineProperty(window, name, {
      value: storage,
      writable: true,
      configurable: true,
    });
  }
}

ensureStorage('localStorage');
ensureStorage('sessionStorage');
