import { shouldCloseOnBackdrop, shouldCloseOnEscape } from './overlay-interactions';

describe('overlay-interactions — predicados puros de cierre', () => {
  describe('shouldCloseOnEscape', () => {
    it('cierra solo cuando el overlay está abierto y es cerrable', () => {
      expect(shouldCloseOnEscape(true, true)).toBe(true);
    });

    it('no cierra si está cerrado', () => {
      expect(shouldCloseOnEscape(false, true)).toBe(false);
    });

    it('no cierra si no es cerrable', () => {
      expect(shouldCloseOnEscape(true, false)).toBe(false);
    });
  });

  describe('shouldCloseOnBackdrop', () => {
    it('cierra solo cuando es cerrable y el backdrop-close está activado', () => {
      expect(shouldCloseOnBackdrop(true, true)).toBe(true);
    });

    it('no cierra si no es cerrable, aunque el backdrop-close esté activo', () => {
      expect(shouldCloseOnBackdrop(false, true)).toBe(false);
    });

    it('no cierra si el backdrop-close no está activado (default de sol-modal)', () => {
      expect(shouldCloseOnBackdrop(true, false)).toBe(false);
    });
  });
});
