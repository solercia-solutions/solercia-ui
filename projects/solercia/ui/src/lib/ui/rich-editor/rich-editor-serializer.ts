/**
 * Serializador HTML "limpio" para `sol-rich-editor`.
 *
 * NÚCLEO DEL VALOR: recorre el DOM del área editable (o un HTML pegado) y
 * produce HTML SEMÁNTICO CANÓNICO apto para generar PDFs con TCPDF (Laravel).
 * TCPDF tiene un parser HTML muy limitado: rompe con `<div>`/`<span>` con
 * estilos inline arbitrarios, clases desconocidas y —sobre todo— tablas
 * anidadas. Este serializador garantiza una salida acotada y predecible.
 *
 * ── Allowlist de TAGS de salida ──────────────────────────────────────────
 *   Bloque:  <p> <h1> <h2> <h3> <ul> <ol> <li> <table><tbody><tr><td> <br>
 *   Inline:  <strong> <em> <u> <s> <a> <img>
 *   Chip:    <span data-mention-id="…"> / <span data-task-key="…">  (OPT-IN)
 *   Nada más. Todo lo demás se desanida (unwrap), se convierte o se descarta.
 *
 * ── Chips de mención (@) y enlace de tarea (#) — OPT-IN ───────────────────
 *   Un `<span>` se PRESERVA en la salida SOLO si porta `data-mention-id` o
 *   `data-task-key`. En ese caso se emite un span canónico con EXACTAMENTE ese
 *   único atributo data-* (valor escapado) y su texto; cualquier otro atributo
 *   del span de entrada (class, style, on*, contenteditable, href…) se DESCARTA
 *   —no hay passthrough—. Un `<span>` normal (sin data de chip) se desanida
 *   como siempre. Esto no abre XSS: solo el atributo data-* controlado y el
 *   texto escapado sobreviven; el span nunca lleva estilos ni handlers.
 *
 * ── Conversión de tags de entrada ────────────────────────────────────────
 *   <b>/<strong>       → <strong>
 *   <i>/<em>           → <em>
 *   <u>/<ins>          → <u>
 *   <s>/<strike>/<del> → <s>
 *   <div>              → <p>   (o se desanida si contiene bloques)
 *   <h4..h6>           → <h3>  (se acota la jerarquía)
 *   <span>/<font>      → se desanida; sus estilos (negrita/cursiva/subrayado/
 *                        tachado) se traducen a los tags semánticos anteriores.
 *   <thead>/<tbody>/<tfoot> → se aplanan dentro de <tbody>.
 *
 * ── Allowlist de PROPIEDADES CSS de ENTRADA ──────────────────────────────
 *   Solo se INSPECCIONAN estas cuatro; el resto de estilos inline se descarta:
 *     - font-weight       → se convierte a <strong>
 *     - font-style        → se convierte a <em>
 *     - text-decoration   → se convierte a <u> y/o <s>
 *     - text-align        → se conserva como style="text-align:…" en el bloque
 *   IMPORTANTE: los estilos NO se copian tal cual a la salida. El serializador
 *   DESCARTA todos los estilos de entrada y RE-GENERA solo los canónicos que
 *   él controla:
 *     - `style="text-align:center|right|justify"` en bloques (p/h1-3/celda)
 *     - `style="display:block;margin:0 auto"` en imágenes centradas
 *   Por eso el `style` de las imágenes centradas no viola la allowlist: no es
 *   un passthrough del usuario, es salida canónica autogenerada.
 *
 * ── Tablas anidadas ──────────────────────────────────────────────────────
 *   TCPDF rompe con tablas dentro de celdas. Cuando una <table> aparece dentro
 *   de una celda, se APLANA: sus celdas se serializan como texto inline
 *   separado por <br> dentro de la celda contenedora (nunca se emiten tags de
 *   tabla anidados). Igual criterio para bloques/listas dentro de celdas: se
 *   convierten a inline + <br> para mantener las celdas TCPDF-safe.
 *
 * ── Seguridad (anti-XSS) ─────────────────────────────────────────────────
 *   `sanitizeHtmlToTcpdf` parsea el HTML no confiable con DOMParser (documento
 *   INERTE: no ejecuta scripts, no dispara handlers, no carga recursos) y luego
 *   serializa por allowlist. `<script>`, `<style>`, `<iframe>`, handlers `on*`,
 *   `href="javascript:"` y `src` no permitidos se descartan.
 */

/**
 * Tags permitidos en la salida (para documentación/validación externa).
 * `span` SOLO se emite para chips de mención/tarea (`data-mention-id` /
 * `data-task-key`); un `<span>` normal se sigue desanidando.
 */
export const TCPDF_ALLOWED_TAGS = [
  'p', 'h1', 'h2', 'h3', 'strong', 'em', 'u', 's',
  'ul', 'ol', 'li', 'table', 'tbody', 'tr', 'td', 'a', 'img', 'br', 'span',
] as const;

/**
 * Propiedades CSS de ENTRADA que el serializador inspecciona. `text-align` se
 * conserva como estilo canónico en bloques; las otras tres se traducen a tags
 * semánticos (no se emiten como `style`).
 */
export const TCPDF_ALLOWED_STYLE_PROPERTIES = [
  'text-align', 'font-weight', 'font-style', 'text-decoration',
] as const;

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

/** Marcas inline semánticas de salida. */
type InlineMark = 'strong' | 'em' | 'u' | 's';

/** Orden estable de apertura de marcas (determinista). */
const MARK_ORDER: readonly InlineMark[] = ['strong', 'em', 'u', 's'];

/** Contexto del recorrido. */
interface Ctx {
  /** true dentro de una celda de tabla (fuerza el aplanado de bloques/tablas). */
  readonly inCell: boolean;
  /** Marcas inline ya activas (para colapsar redundancias tipo <b><b>…). */
  readonly marks: ReadonlySet<InlineMark>;
}

/** Tags que se descartan por completo (contenido incluido). */
const DROP_TAGS = new Set([
  'script', 'style', 'noscript', 'head', 'title', 'meta', 'link', 'base',
  'object', 'embed', 'iframe', 'applet', 'param', 'svg', 'math', 'canvas',
  'video', 'audio', 'source', 'track', 'input', 'textarea', 'select',
  'option', 'button', 'template',
]);

/** Tags de nivel bloque reconocidos en la ENTRADA (para agrupar/desanidar). */
const BLOCK_TAGS = new Set([
  'div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption',
  'blockquote', 'section', 'article', 'header', 'footer', 'main', 'aside',
  'nav', 'figure', 'figcaption', 'dl', 'dd', 'dt', 'form', 'fieldset',
  'address', 'pre', 'hr',
]);

// ── Utilidades de texto ──────────────────────────────────────────────────

function escapeText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Colapsa espacios en blanco (incl. `&nbsp;`) a un único espacio. */
function collapseWs(value: string): string {
  return value.replace(/ /g, ' ').replace(/[\s]+/g, ' ');
}

// ── Utilidades de estilo / atributos ─────────────────────────────────────

function readAlign(el: Element): '' | 'center' | 'right' | 'justify' {
  const style = (el as HTMLElement).style;
  const styleAlign = (style?.textAlign ?? '').toLowerCase();
  const attrAlign = (el.getAttribute('align') ?? '').toLowerCase();
  const align = styleAlign || attrAlign;
  if (align === 'center') return 'center';
  if (align === 'right' || align === 'end') return 'right';
  if (align === 'justify') return 'justify';
  return '';
}

/** Devuelve ` style="text-align:…"` para bloques alineados (izquierda → ''). */
function alignAttr(el: Element): string {
  const align = readAlign(el);
  return align ? ` style="text-align:${align}"` : '';
}

/** Marcas inline derivadas de los estilos permitidos de un elemento. */
function styleMarks(el: HTMLElement): InlineMark[] {
  const style = el.style;
  if (!style) return [];
  const marks: InlineMark[] = [];

  const weight = (style.fontWeight ?? '').toLowerCase();
  if (weight === 'bold' || weight === 'bolder' || (/^\d+$/.test(weight) && Number(weight) >= 600)) {
    marks.push('strong');
  }

  const fontStyle = (style.fontStyle ?? '').toLowerCase();
  if (fontStyle === 'italic' || fontStyle === 'oblique') {
    marks.push('em');
  }

  const decoration = `${style.textDecorationLine ?? ''} ${style.textDecoration ?? ''}`.toLowerCase();
  if (decoration.includes('underline')) marks.push('u');
  if (decoration.includes('line-through')) marks.push('s');

  return marks;
}

/** Marcas inline derivadas del NOMBRE del tag. */
function tagMarks(tag: string): InlineMark[] {
  switch (tag) {
    case 'b': case 'strong': return ['strong'];
    case 'i': case 'em': return ['em'];
    case 'u': case 'ins': return ['u'];
    case 's': case 'strike': case 'del': return ['s'];
    default: return [];
  }
}

/** `href` seguro: solo esquemas de navegación conocidos (nunca `javascript:`). */
function sanitizeHref(raw: string | null): string {
  const href = (raw ?? '').trim();
  if (!href) return '';
  return /^(https?:|mailto:|tel:|#)/i.test(href) ? href : '';
}

/** `src` de imagen seguro: solo `data:image/*` en base64 o http(s). */
function isSafeImgSrc(src: string): boolean {
  return (
    /^data:image\/(png|jpe?g|gif|webp|bmp|svg\+xml);base64,/i.test(src) ||
    /^https?:\/\//i.test(src)
  );
}

/** Ancho/alto numérico (atributo o `style` en px), 0 si no aplica. */
function intSize(el: HTMLElement, name: 'width' | 'height'): number {
  const attr = el.getAttribute(name);
  if (attr && /^\d+$/.test(attr)) return Number(attr);
  const styleValue = (el.style?.[name] ?? '').toString();
  const match = /^(\d+)(?:px)?$/.exec(styleValue);
  return match ? Number(match[1]) : 0;
}

/** Detecta si una imagen debe centrarse (margin auto / align / bloque padre). */
function isImgCentered(el: HTMLElement): boolean {
  const style = el.style;
  if (style) {
    const margin = (style.margin ?? '').toLowerCase();
    const marginLeft = (style.marginLeft ?? '').toLowerCase();
    const marginRight = (style.marginRight ?? '').toLowerCase();
    if (margin.includes('auto') || (marginLeft === 'auto' && marginRight === 'auto')) {
      return true;
    }
  }
  const align = (el.getAttribute('align') ?? '').toLowerCase();
  if (align === 'middle' || align === 'center') return true;

  const parent = el.parentElement;
  return !!parent && readAlign(parent) === 'center';
}

function isElement(node: Node): node is Element {
  return node.nodeType === ELEMENT_NODE;
}

function isBlockLevel(node: Node): boolean {
  return isElement(node) && BLOCK_TAGS.has((node as Element).localName);
}

function hasBlockChild(el: Element): boolean {
  return Array.from(el.children).some(
    (child) => BLOCK_TAGS.has(child.localName) && !DROP_TAGS.has(child.localName),
  );
}

// ── Serialización inline ─────────────────────────────────────────────────

/**
 * Chip OPT-IN de mención (@) o enlace de tarea (#).
 *
 * Devuelve el span canónico con EXACTAMENTE un atributo data-* (escapado) y el
 * texto escapado; descarta cualquier otro atributo (class, style, on*, …). Un
 * span con el data de chip pero sin texto se descarta (''). Un span SIN data de
 * chip devuelve `null` para que el recorrido lo desanide como span normal.
 */
function serializeMentionChip(el: HTMLElement): string | null {
  const mentionId = (el.getAttribute('data-mention-id') ?? '').trim();
  if (mentionId) {
    const text = escapeText(collapseWs(el.textContent ?? '')).trim();
    return text ? `<span data-mention-id="${escapeAttr(mentionId)}">${text}</span>` : '';
  }
  const taskKey = (el.getAttribute('data-task-key') ?? '').trim();
  if (taskKey) {
    const text = escapeText(collapseWs(el.textContent ?? '')).trim();
    return text ? `<span data-task-key="${escapeAttr(taskKey)}">${text}</span>` : '';
  }
  return null;
}

function serializeImg(el: HTMLElement): string {
  const src = (el.getAttribute('src') ?? '').trim();
  if (!isSafeImgSrc(src)) return '';

  const parts = [`<img src="${escapeAttr(src)}"`, `alt="${escapeAttr(el.getAttribute('alt') ?? '')}"`];
  const width = intSize(el, 'width');
  if (width) parts.push(`width="${width}"`);
  const height = intSize(el, 'height');
  if (height) parts.push(`height="${height}"`);
  // Estilo canónico de centrado (autogenerado, no passthrough del usuario).
  if (isImgCentered(el)) parts.push('style="display:block;margin:0 auto"');

  return `${parts.join(' ')} />`;
}

function serializeInline(node: Node, ctx: Ctx): string {
  if (node.nodeType === TEXT_NODE) {
    return escapeText(collapseWs(node.textContent ?? ''));
  }
  if (!isElement(node)) return '';

  const el = node as HTMLElement;
  const tag = el.localName;

  if (DROP_TAGS.has(tag)) return '';
  if (tag === 'br') return '<br />';
  if (tag === 'img') return serializeImg(el);

  // Chip de mención/tarea (opt-in): se preserva; un span normal → null (unwrap).
  if (tag === 'span') {
    const chip = serializeMentionChip(el);
    if (chip !== null) return chip;
  }

  if (tag === 'a') {
    const inner = serializeInlineChildren(el, { ...ctx, marks: new Set(ctx.marks) });
    if (!inner) return '';
    const href = sanitizeHref(el.getAttribute('href'));
    return href ? `<a href="${escapeAttr(href)}">${inner}</a>` : inner;
  }

  // Marcas semánticas nuevas (por tag o por estilo) que aún no están activas.
  const wanted = new Set<InlineMark>([...tagMarks(tag), ...styleMarks(el)]);
  const toOpen = MARK_ORDER.filter((mark) => wanted.has(mark) && !ctx.marks.has(mark));

  const nextMarks = new Set(ctx.marks);
  toOpen.forEach((mark) => nextMarks.add(mark));

  const inner = serializeInlineChildren(el, { ...ctx, marks: nextMarks });
  if (!inner) return '';

  const open = toOpen.map((mark) => `<${mark}>`).join('');
  const close = [...toOpen].reverse().map((mark) => `</${mark}>`).join('');
  return open + inner + close;
}

function serializeInlineChildren(parent: Node, ctx: Ctx): string {
  let out = '';
  parent.childNodes.forEach((child) => {
    out += serializeInline(child, ctx);
  });
  return out;
}

// ── Serialización de celdas (modo aplanado) ──────────────────────────────

/** Aplana una tabla a texto: celdas por fila unidas, filas separadas por <br>. */
function flattenTable(tableEl: Element): string {
  const rows = Array.from(tableEl.querySelectorAll('tr')).filter(
    (tr) => tr.closest('table') === tableEl,
  );
  const lines = rows.map((tr) =>
    Array.from(tr.children)
      .filter((cell) => cell.localName === 'td' || cell.localName === 'th')
      .map((cell) => serializeCellContent(cell))
      .filter(Boolean)
      .join(' '),
  );
  return lines.filter(Boolean).join('<br />');
}

/** Aplana una lista a texto: cada ítem con viñeta, separados por <br>. */
function flattenList(listEl: Element): string {
  return Array.from(listEl.children)
    .filter((child) => child.localName === 'li')
    .map((li) => {
      const text = serializeInlineChildren(li, { inCell: true, marks: new Set() }).trim();
      return text ? `&#8226; ${text}` : '';
    })
    .filter(Boolean)
    .join('<br />');
}

/** Contenido TCPDF-safe de una celda: todo se aplana a inline + <br>. */
function serializeCellContent(cell: Element): string {
  const ctx: Ctx = { inCell: true, marks: new Set() };
  let out = '';

  const addBlockBreak = () => {
    if (out && !out.endsWith('<br />')) out += '<br />';
  };

  cell.childNodes.forEach((child) => {
    if (child.nodeType === TEXT_NODE) {
      out += escapeText(collapseWs(child.textContent ?? ''));
      return;
    }
    if (!isElement(child)) return;

    const tag = (child as Element).localName;
    if (DROP_TAGS.has(tag)) return;

    if (tag === 'br') {
      out += '<br />';
      return;
    }
    if (tag === 'table') {
      const flat = flattenTable(child as Element);
      if (flat) { addBlockBreak(); out += flat; }
      return;
    }
    if (tag === 'ul' || tag === 'ol') {
      const flat = flattenList(child as Element);
      if (flat) { addBlockBreak(); out += flat; }
      return;
    }
    if (BLOCK_TAGS.has(tag)) {
      const inner = serializeInlineChildren(child, ctx).trim();
      if (inner) { addBlockBreak(); out += inner; }
      return;
    }
    out += serializeInline(child, ctx);
  });

  // Sin <br> sobrantes en los extremos.
  return out.replace(/^(?:<br \/>)+/, '').replace(/(?:<br \/>)+$/, '');
}

// ── Serialización de bloques ─────────────────────────────────────────────

function serializeHeading(el: Element, tag: 'h1' | 'h2' | 'h3'): string {
  const inner = serializeInlineChildren(el, { inCell: false, marks: new Set() }).trim();
  return inner ? `<${tag}${alignAttr(el)}>${inner}</${tag}>` : '';
}

function serializeParagraph(el: Element): string {
  const inner = serializeInlineChildren(el, { inCell: false, marks: new Set() }).trim();
  return inner ? `<p${alignAttr(el)}>${inner}</p>` : '';
}

function serializeListItem(li: Element): string {
  let inline = '';
  let nested = '';
  li.childNodes.forEach((child) => {
    if (isElement(child) && (child.localName === 'ul' || child.localName === 'ol')) {
      nested += serializeList(child, child.localName as 'ul' | 'ol');
    } else {
      inline += serializeInline(child, { inCell: false, marks: new Set() });
    }
  });
  const text = inline.trim();
  if (!text && !nested) return '';
  return `<li>${text}${nested}</li>`;
}

function serializeList(el: Element, tag: 'ul' | 'ol'): string {
  const items = Array.from(el.children)
    .filter((child) => child.localName === 'li')
    .map((li) => serializeListItem(li))
    .filter(Boolean)
    .join('');
  return items ? `<${tag}>${items}</${tag}>` : '';
}

function serializeTable(el: Element): string {
  const rows = Array.from(el.querySelectorAll('tr')).filter(
    (tr) => tr.closest('table') === el,
  );

  let body = '';
  for (const tr of rows) {
    const cells = Array.from(tr.children).filter(
      (cell) => cell.localName === 'td' || cell.localName === 'th',
    );
    let rowHtml = '';
    for (const cell of cells) {
      rowHtml += `<td>${serializeCellContent(cell)}</td>`;
    }
    if (rowHtml) body += `<tr>${rowHtml}</tr>`;
  }

  return body
    ? `<table border="1" cellpadding="4" cellspacing="0"><tbody>${body}</tbody></table>`
    : '';
}

function serializeBlock(el: Element, ctx: Ctx): string {
  const tag = el.localName;
  if (DROP_TAGS.has(tag)) return '';

  switch (tag) {
    case 'h1': return serializeHeading(el, 'h1');
    case 'h2': return serializeHeading(el, 'h2');
    case 'h3': case 'h4': case 'h5': case 'h6': return serializeHeading(el, 'h3');
    case 'ul': return serializeList(el, 'ul');
    case 'ol': return serializeList(el, 'ol');
    case 'table': return ctx.inCell ? flattenTable(el) : serializeTable(el);
    case 'hr': return '';
    // Contenedores de tabla huérfanos → se desanidan.
    case 'thead': case 'tbody': case 'tfoot':
    case 'tr': case 'td': case 'th': case 'caption':
      return serializeBlockList(el, ctx);
    default:
      // p, div, blockquote, section, li huérfano, etc.
      return hasBlockChild(el) ? serializeBlockList(el, ctx) : serializeParagraph(el);
  }
}

/**
 * Recorre los hijos de un contenedor a nivel BLOQUE, agrupando el contenido
 * inline suelto en `<p>` y delegando los bloques a `serializeBlock`. Las
 * imágenes sueltas (hijas directas del bloque) obtienen su propio párrafo,
 * centrado si corresponde.
 */
function serializeBlockList(parent: Node, ctx: Ctx): string {
  let out = '';
  let inline = '';

  const flush = () => {
    const text = inline.trim();
    if (text) out += `<p>${text}</p>`;
    inline = '';
  };

  parent.childNodes.forEach((child) => {
    if (child.nodeType === TEXT_NODE) {
      inline += escapeText(collapseWs(child.textContent ?? ''));
      return;
    }
    if (!isElement(child)) return;

    const tag = (child as Element).localName;

    // Imagen suelta → párrafo propio (centrado si aplica).
    if (tag === 'img') {
      const img = serializeImg(child as HTMLElement);
      if (img) {
        flush();
        const centered = isImgCentered(child as HTMLElement);
        out += `<p${centered ? ' style="text-align:center"' : ''}>${img}</p>`;
      }
      return;
    }

    if (isBlockLevel(child)) {
      flush();
      out += serializeBlock(child as Element, ctx);
    } else {
      inline += serializeInline(child, { ...ctx, marks: new Set() });
    }
  });

  flush();
  return out;
}

// ── API pública ──────────────────────────────────────────────────────────

/**
 * Serializa el contenido de un elemento (típicamente el `contenteditable`) a
 * HTML canónico TCPDF-safe. Función PURA: no muta el DOM recibido.
 */
export function serializeElementToTcpdfHtml(root: HTMLElement): string {
  return serializeBlockList(root, { inCell: false, marks: new Set() });
}

/**
 * Sanea un HTML NO CONFIABLE (pegado, o valor externo del formulario) a HTML
 * canónico TCPDF-safe. Parsea con DOMParser (documento inerte: sin ejecución
 * de scripts ni carga de recursos) y aplica la allowlist. Devuelve '' si no hay
 * DOMParser disponible (p. ej. SSR).
 */
export function sanitizeHtmlToTcpdf(rawHtml: string): string {
  if (!rawHtml) return '';
  if (typeof DOMParser === 'undefined') return '';
  const doc = new DOMParser().parseFromString(rawHtml, 'text/html');
  return serializeElementToTcpdfHtml(doc.body);
}
