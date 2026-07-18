/**
 * Predicados puros compartidos por los overlays de la casa (`sol-modal`,
 * `sol-drawer`): deciden si un evento de interacción debe cerrar el overlay,
 * sin tocar el DOM ni el estado del componente. Se extraen para no duplicar
 * la misma lógica de "gating" en cada overlay (11-h-sol-drawer, T01).
 */

/** Escape solo cierra el overlay si está abierto y el consumidor lo permite. */
export function shouldCloseOnEscape(open: boolean, closeable: boolean): boolean {
  return open && closeable;
}

/**
 * El clic en el backdrop solo cierra el overlay si es cerrable y el
 * consumidor activó explícitamente el cierre por backdrop (opt-in).
 */
export function shouldCloseOnBackdrop(closeable: boolean, closeOnBackdrop: boolean): boolean {
  return closeable && closeOnBackdrop;
}
