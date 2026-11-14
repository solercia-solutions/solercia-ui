import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';
import type { ThemeFile } from '@solercia/ui';

/**
 * Una versión guardada del tema del tenant. El `ThemeFile` NO lleva campo de versión: el
 * versionado vive en el backend del host, y este contrato es agnóstico de él (cada app mapea su
 * propia respuesta en su adaptador).
 */
export interface ThemeVersion {
  id: number | string;
  /** Nombre de quien aplicó la versión; `null` si el backend no lo conoce. */
  userName: string | null;
  userId: number | string | null;
  /** Fecha de aplicación, ISO 8601 en UTC. */
  appliedAt: string;
  /** `true` para la captura del tema previo al primer guardado (autor y fecha no confiables). */
  initialCapture: boolean;
  /** Versión base de una restauración; `null` si no viene de una restauración. */
  sourceVersionId: number | string | null;
}

/** Página del historial, de la más reciente a la más antigua. */
export interface ThemeVersionPage {
  versions: ThemeVersion[];
  /** Cursor de la siguiente página; `null` cuando no hay más. */
  next: number | string | null;
}

/**
 * Puerto de persistencia del Theme Studio. El host lo implementa con su backend y lo provee
 * con `THEME_STUDIO_STORE`.
 *
 * Los métodos opcionales apagan su sección de la pantalla: sin `listVersions` (o sin
 * `getVersion`) no hay historial; sin `uploadLogo` no hay carga de logo ni de favicon.
 */
export interface ThemeStudioStore {
  /** Tema guardado del tenant activo; `null` si todavía no tiene uno (se usa el tema base). */
  load(): Observable<ThemeFile | null>;
  /**
   * Persiste el tema. `sourceVersionId` es la versión restaurada en la que se basó el cambio
   * (o `null`). Puede devolver la versión creada o el tema TAL COMO QUEDÓ PERSISTIDO: con un
   * `ThemeFile` la pantalla lo empuja con `ThemeService.setTenantTheme` (sin volver a pedirlo);
   * sin él, llama a `ThemeService.refresh()`.
   */
  apply(theme: ThemeFile, sourceVersionId?: ThemeVersion['id'] | null): Observable<ThemeVersion | ThemeFile | void>;
  /** Historial paginado; `before` es el cursor `next` de la página anterior. */
  listVersions?(before?: ThemeVersionPage['next']): Observable<ThemeVersionPage>;
  /** Tema completo de una versión del historial. */
  getVersion?(id: ThemeVersion['id']): Observable<ThemeFile>;
  /** Sube una imagen (logo o favicon) y devuelve la URL publicada. */
  uploadLogo?(file: File): Observable<string>;
}

/**
 * Mensaje legible de un error del store, si lo trae. Reconoce la forma de `HttpErrorResponse`
 * (`error.message` o `error.errors[0].message` del cuerpo de la respuesta) y un objeto plano
 * `{ message }` marcado como mensaje para la persona usuaria (`userMessage`). Nunca devuelve el
 * texto técnico de un `Error` cualquiera (por ejemplo, "Http failure response for …").
 */
export function extractStoreErrorMessage(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const record = error as Record<string, unknown>;
  if (typeof record['userMessage'] === 'string' && record['userMessage'].trim()) return record['userMessage'];
  const body = record['error'];
  if (!body || typeof body !== 'object') return null;
  const bodyRecord = body as Record<string, unknown>;
  if (typeof bodyRecord['message'] === 'string' && bodyRecord['message'].trim()) return bodyRecord['message'];
  const errors = bodyRecord['errors'];
  if (Array.isArray(errors)) {
    const first = errors[0] as Record<string, unknown> | undefined;
    if (first && typeof first['message'] === 'string' && first['message'].trim()) return first['message'];
  }
  return null;
}

/** Token del puerto de persistencia. Sin proveedor, `<sol-theme-studio>` muestra su estado de error. */
export const THEME_STUDIO_STORE = new InjectionToken<ThemeStudioStore>('THEME_STUDIO_STORE');
