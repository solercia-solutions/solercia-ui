/**
 * Tono semántico compartido por los átomos de vocero (`sol-score-badge`,
 * `sol-trend`) y cualquier otro componente que necesite un color por
 * significado en vez de por valor concreto. Único lugar donde se define —
 * antes vivía duplicado (declaración propia en `score-badge` + mapa de
 * color repetido en `trend`), violando SRP y arriesgando que un tono nuevo
 * se agregue en un componente y se olvide en el otro.
 */
export type SolTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/** Color CSS (`var(--sol-color-*)` con fallback) por tono — fuente única para toda la lib. */
export const TONE_COLOR: Record<SolTone, string> = {
  success: 'var(--sol-color-success, #10b981)',
  warning: 'var(--sol-color-warning, #f59e0b)',
  danger: 'var(--sol-color-danger, #ef4444)',
  info: 'var(--sol-color-info, #3b82f6)',
  neutral: 'var(--sol-color-text-muted, #94a3b8)',
};
