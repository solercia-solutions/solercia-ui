import { inject } from '@angular/core';
import { SOL_I18N } from '@solercia/ui';

/** Text tree of the login appearance pieces (keys under `sol.loginAppearance`). */
export type LoginAppearanceDictionary = { readonly [key: string]: string | LoginAppearanceDictionary };

/** Default texts in Colombian Spanish (formal, tuteo). The host overrides any key in its engine. */
export const SOL_LOGIN_APPEARANCE_I18N_ES_CO: LoginAppearanceDictionary = {
  taglineFallback: 'Todo tu trabajo, en un solo lugar.',
  preview: {
    title: 'Vista previa · {{ mode }}',
    modeLight: 'modo claro',
    modeDark: 'modo oscuro',
    welcome: 'Te damos la bienvenida',
    email: 'Correo electrónico',
    emailPlaceholder: 'correo@ejemplo.com',
    password: 'Contraseña',
    passwordPlaceholder: 'Ingresa tu contraseña',
    remember: 'Recordarme',
    submit: 'Iniciar sesión',
    empty: 'Agrega al menos una foto para ver el inicio de sesión.',
  },
  editor: {
    photos: {
      title: 'Fotos',
      empty: 'Aún no hay fotos. Sin fotos se usan las predeterminadas de la aplicación o el diseño clásico.',
      add: 'Agregar fotos',
      moveUp: 'Subir foto {{ n }}',
      moveDown: 'Bajar foto {{ n }}',
      remove: 'Quitar foto {{ n }}',
      limit: 'Llegaste al máximo de {{ max }} fotos. Quita una para agregar otra.',
      uploading: 'Subiendo {{ current }} de {{ total }}…',
      partial: 'Solo se agregaron {{ count }} fotos: el máximo es {{ max }}.',
      invalidUrl: 'La foto «{{ name }}» se subió, pero su dirección no se puede usar. Inténtalo de nuevo.',
      uploadError: 'No se pudo subir «{{ name }}». {{ detail }}',
      uploadErrorDetail: 'Revisa que sea una imagen válida e inténtalo de nuevo.',
      uploadUnavailable: 'La carga de fotos no está disponible en esta aplicación.',
    },
    motion: {
      title: 'Movimiento',
      duration: 'Duración de cada foto',
      less: 'Menos tiempo',
      more: 'Más tiempo',
      seconds: '{{ s }} s',
      range: 'Entre {{ min }} y {{ max }} segundos',
      effect: 'Efecto de la imagen',
      transition: 'Transición entre fotos',
    },
    effect: { zoom: 'Zoom', focus: 'Enfoque', none: 'Sin efecto' },
    transition: { fade: 'Fundido', focus: 'Desenfoque' },
    perMode: {
      title: 'Por modo',
      ariaLabel: 'Modo que estás editando',
      light: 'Claro',
      dark: 'Oscuro',
      position: 'Posición del formulario',
      background: 'Tipo de fondo',
    },
    position: { left: 'Izquierda', center: 'Centro', right: 'Derecha' },
    background: {
      'glass-fade': 'Degradado con desenfoque',
      glass: 'Vidrio',
      solid: 'Sólido',
      triangles: 'Triángulos',
      'split-circle': 'Círculo partido',
      facets: 'Facetas',
      circles: 'Círculos',
    },
    caption: {
      title: 'Lema',
      label: 'Etiqueta',
      labelPlaceholder: 'Por ejemplo, el nombre de tu marca',
      indicators: 'Mostrar indicadores de foto',
    },
    reset: 'Restablecer valores predeterminados',
    undo: 'Deshacer',
    resetDone: 'Se restablecieron los valores predeterminados.',
    applyHint: 'Los cambios se guardan con «Aplicar tema» en la pestaña Apariencia general.',
    goToApply: 'Ir a Aplicar tema',
  },
};

export const SOL_LOGIN_APPEARANCE_I18N_EN: LoginAppearanceDictionary = {
  taglineFallback: 'All your work, in one place.',
  preview: {
    title: 'Preview · {{ mode }}',
    modeLight: 'light mode',
    modeDark: 'dark mode',
    welcome: 'Welcome',
    email: 'Email',
    emailPlaceholder: 'email@example.com',
    password: 'Password',
    passwordPlaceholder: 'Enter your password',
    remember: 'Remember me',
    submit: 'Sign in',
    empty: 'Add at least one photo to preview the sign-in screen.',
  },
  editor: {
    photos: {
      title: 'Photos',
      empty: 'No photos yet. Without photos the app defaults or the classic layout are used.',
      add: 'Add photos',
      moveUp: 'Move photo {{ n }} up',
      moveDown: 'Move photo {{ n }} down',
      remove: 'Remove photo {{ n }}',
      limit: 'You reached the maximum of {{ max }} photos. Remove one to add another.',
      uploading: 'Uploading {{ current }} of {{ total }}…',
      partial: 'Only {{ count }} photos were added: the maximum is {{ max }}.',
      invalidUrl: 'The photo “{{ name }}” was uploaded, but its address cannot be used. Try again.',
      uploadError: 'Could not upload “{{ name }}”. {{ detail }}',
      uploadErrorDetail: 'Check that it is a valid image and try again.',
      uploadUnavailable: 'Photo upload is not available in this app.',
    },
    motion: {
      title: 'Motion',
      duration: 'Duration of each photo',
      less: 'Less time',
      more: 'More time',
      seconds: '{{ s }} s',
      range: 'Between {{ min }} and {{ max }} seconds',
      effect: 'Image effect',
      transition: 'Transition between photos',
    },
    effect: { zoom: 'Zoom', focus: 'Focus', none: 'No effect' },
    transition: { fade: 'Fade', focus: 'Blur' },
    perMode: {
      title: 'Per mode',
      ariaLabel: 'Mode you are editing',
      light: 'Light',
      dark: 'Dark',
      position: 'Form position',
      background: 'Background type',
    },
    position: { left: 'Left', center: 'Center', right: 'Right' },
    background: {
      'glass-fade': 'Blurred gradient',
      glass: 'Glass',
      solid: 'Solid',
      triangles: 'Triangles',
      'split-circle': 'Split circle',
      facets: 'Facets',
      circles: 'Circles',
    },
    caption: {
      title: 'Caption',
      label: 'Label',
      labelPlaceholder: 'For example, your brand name',
      indicators: 'Show photo indicators',
    },
    reset: 'Restore defaults',
    undo: 'Undo',
    resetDone: 'Defaults were restored.',
    applyHint: 'Changes are saved with “Apply theme” in the General appearance tab.',
    goToApply: 'Go to Apply theme',
  },
};

/** Prefix of every key in the host translation engine. */
export const LOGIN_APPEARANCE_I18N_PREFIX = 'sol.loginAppearance.';

function lookup(dictionary: LoginAppearanceDictionary, path: string): string | undefined {
  let node: string | LoginAppearanceDictionary | undefined = dictionary;
  for (const segment of path.split('.')) {
    if (node === undefined || typeof node === 'string') return undefined;
    node = node[segment];
  }
  return typeof node === 'string' ? node : undefined;
}

function interpolate(template: string, params?: Record<string, unknown>): string {
  if (!params) return template;
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

/**
 * Translator (call in an injection context): resolves `sol.loginAppearance.<key>` with `SOL_I18N`
 * and, when the host lacks the key, falls back to the default dictionary of the active language
 * (`es*` → Colombian Spanish; anything else → English). Reads `activeLang()`, so it reacts to
 * language changes.
 */
export function injectLoginAppearanceText(): (key: string, params?: Record<string, unknown>) => string {
  const i18n = inject(SOL_I18N);
  return (key, params) => {
    const fullKey = LOGIN_APPEARANCE_I18N_PREFIX + key;
    const translated = i18n.translate(fullKey, params);
    if (translated && translated !== fullKey) return translated;
    const dictionary = i18n.activeLang().toLowerCase().startsWith('es') ? SOL_LOGIN_APPEARANCE_I18N_ES_CO : SOL_LOGIN_APPEARANCE_I18N_EN;
    return interpolate(lookup(dictionary, key) ?? lookup(SOL_LOGIN_APPEARANCE_I18N_EN, key) ?? fullKey, params);
  };
}
