import { describe, expect, it } from 'vitest';
import {
  sanitizeHtmlToTcpdf,
  serializeElementToTcpdfHtml,
  TCPDF_ALLOWED_TAGS,
} from './rich-editor-serializer';

/**
 * Specs del SERIALIZADOR TCPDF-safe (el núcleo del valor de sol-rich-editor).
 * Verifican que HTML "sucio" (divs con estilos inline, spans anidados,
 * <b>/<i>, tablas dentro de tablas, clases, estilos no permitidos, etc.)
 * produce SIEMPRE HTML canónico dentro de la allowlist.
 */

/** Serializa un HTML crudo montándolo en un elemento vivo (jsdom). */
function clean(dirtyHtml: string): string {
  const host = document.createElement('div');
  host.innerHTML = dirtyHtml;
  return serializeElementToTcpdfHtml(host);
}

describe('rich-editor-serializer — canonicalización TCPDF-safe', () => {
  describe('conversión de tags de formato', () => {
    it('<b> → <strong> y <i> → <em>', () => {
      expect(clean('<div><b>negrita</b> y <i>cursiva</i></div>'))
        .toBe('<p><strong>negrita</strong> y <em>cursiva</em></p>');
    });

    it('<u> se conserva y <strike>/<del> → <s>', () => {
      expect(clean('<p><u>sub</u> <strike>tach1</strike> <del>tach2</del></p>'))
        .toBe('<p><u>sub</u> <s>tach1</s> <s>tach2</s></p>');
    });

    it('<div> → <p>', () => {
      expect(clean('<div>hola</div><div>mundo</div>'))
        .toBe('<p>hola</p><p>mundo</p>');
    });

    it('encabezados h1/h2/h3 se conservan; h4-h6 se acotan a h3', () => {
      expect(clean('<h1>T1</h1><h2>T2</h2><h3>T3</h3><h4>T4</h4><h6>T6</h6>'))
        .toBe('<h1>T1</h1><h2>T2</h2><h3>T3</h3><h3>T4</h3><h3>T6</h3>');
    });
  });

  describe('estilos inline → tags semánticos (allowlist de propiedades CSS)', () => {
    it('font-weight:bold → <strong>; font-style:italic → <em>', () => {
      expect(clean('<p><span style="font-weight:bold">B</span><span style="font-style:italic">I</span></p>'))
        .toBe('<p><strong>B</strong><em>I</em></p>');
    });

    it('font-weight numérico >=600 → <strong>', () => {
      expect(clean('<p><span style="font-weight:700">grueso</span></p>'))
        .toBe('<p><strong>grueso</strong></p>');
    });

    it('text-decoration underline/line-through → <u>/<s>', () => {
      expect(clean('<p><span style="text-decoration:underline">u</span><span style="text-decoration:line-through">s</span></p>'))
        .toBe('<p><u>u</u><s>s</s></p>');
    });

    it('descarta propiedades CSS NO permitidas (color, font-size, background)', () => {
      expect(clean('<p><span style="color:red;font-size:40px;background:#0f0">texto</span></p>'))
        .toBe('<p>texto</p>');
    });

    it('combina varias marcas de estilo en un mismo span', () => {
      expect(clean('<p><span style="font-weight:bold;font-style:italic;text-decoration:underline">x</span></p>'))
        .toBe('<p><strong><em><u>x</u></em></strong></p>');
    });
  });

  describe('limpieza de basura (spans/divs redundantes, clases, ids, data-*)', () => {
    it('desanida spans sin estilo y colapsa el texto', () => {
      expect(clean('<p><span><span>a</span><span>b</span></span></p>'))
        .toBe('<p>ab</p>');
    });

    it('elimina class, id y data-*', () => {
      expect(clean('<div class="x" id="y" data-foo="z">contenido</div>'))
        .toBe('<p>contenido</p>');
    });

    it('colapsa marcas redundantes anidadas (<b><b>)', () => {
      expect(clean('<p><b><b>doble</b></b></p>'))
        .toBe('<p><strong>doble</strong></p>');
    });

    it('descarta <script> y <style> por completo', () => {
      expect(clean('<p>ok</p><script>alert(1)</script><style>.a{}</style>'))
        .toBe('<p>ok</p>');
    });

    it('ignora nodos de solo espacios entre bloques', () => {
      expect(clean('<div>a</div>\n\n   <div>b</div>'))
        .toBe('<p>a</p><p>b</p>');
    });
  });

  describe('listas', () => {
    it('viñetas y numeradas se conservan', () => {
      expect(clean('<ul><li>uno</li><li>dos</li></ul>'))
        .toBe('<ul><li>uno</li><li>dos</li></ul>');
      expect(clean('<ol><li>a</li><li>b</li></ol>'))
        .toBe('<ol><li>a</li><li>b</li></ol>');
    });

    it('conserva formato inline dentro de los ítems y descarta li vacíos', () => {
      expect(clean('<ul><li><b>x</b></li><li></li><li>y</li></ul>'))
        .toBe('<ul><li><strong>x</strong></li><li>y</li></ul>');
    });

    it('soporta sublistas anidadas', () => {
      expect(clean('<ul><li>a<ul><li>a1</li></ul></li></ul>'))
        .toBe('<ul><li>a<ul><li>a1</li></ul></li></ul>');
    });
  });

  describe('tablas', () => {
    it('emite table>tbody>tr>td con borde y sin thead', () => {
      expect(clean('<table><thead><tr><th>H</th></tr></thead><tbody><tr><td>C</td></tr></tbody></table>'))
        .toBe('<table border="1" cellpadding="4" cellspacing="0"><tbody><tr><td>H</td></tr><tr><td>C</td></tr></tbody></table>');
    });

    it('APLANA una tabla anidada dentro de una celda (TCPDF la rompe)', () => {
      const out = clean(
        '<table><tbody><tr><td>ext<table><tbody><tr><td>in1</td><td>in2</td></tr></tbody></table></td></tr></tbody></table>',
      );
      // La tabla interna NO debe aparecer como <table> anidada.
      expect(out).toBe(
        '<table border="1" cellpadding="4" cellspacing="0"><tbody><tr><td>ext<br />in1 in2</td></tr></tbody></table>',
      );
      expect(out.match(/<table/g)?.length).toBe(1);
    });

    it('aplana bloques y listas dentro de una celda a inline + <br>', () => {
      expect(clean('<table><tbody><tr><td><p>a</p><ul><li>b</li></ul></td></tr></tbody></table>'))
        .toBe('<table border="1" cellpadding="4" cellspacing="0"><tbody><tr><td>a<br />&#8226; b</td></tr></tbody></table>');
    });
  });

  describe('imágenes', () => {
    const DATA_URL = 'data:image/png;base64,iVBORw0KGgo=';

    it('imagen suelta va en su propio párrafo', () => {
      expect(clean(`<img src="${DATA_URL}" alt="foto">`))
        .toBe(`<p><img src="${DATA_URL}" alt="foto" /></p>`);
    });

    it('imagen centrada (margin auto) sale con display:block;margin:0 auto y párrafo centrado', () => {
      const out = clean(`<img src="${DATA_URL}" style="display:block;margin:0 auto" alt="c">`);
      expect(out).toContain('style="display:block;margin:0 auto"');
      expect(out).toBe(`<p style="text-align:center"><img src="${DATA_URL}" alt="c" style="display:block;margin:0 auto" /></p>`);
    });

    it('imagen centrada por bloque padre (text-align:center) también se marca', () => {
      const out = clean(`<div style="text-align:center"><img src="${DATA_URL}" alt=""></div>`);
      expect(out).toContain('margin:0 auto');
    });

    it('descarta imágenes con src no permitido (javascript/otros)', () => {
      expect(clean('<img src="javascript:alert(1)" alt="x">')).toBe('');
      expect(clean('<img src="ftp://host/a.png" alt="x">')).toBe('');
    });

    it('conserva width/height numéricos', () => {
      expect(clean(`<img src="${DATA_URL}" width="120" height="80" alt="">`))
        .toBe(`<p><img src="${DATA_URL}" alt="" width="120" height="80" /></p>`);
    });
  });

  describe('alineación de texto', () => {
    it('center/right/justify → style text-align; left se omite', () => {
      expect(clean('<p style="text-align:center">c</p>')).toBe('<p style="text-align:center">c</p>');
      expect(clean('<p style="text-align:right">r</p>')).toBe('<p style="text-align:right">r</p>');
      expect(clean('<p style="text-align:left">l</p>')).toBe('<p>l</p>');
    });

    it('respeta el atributo align="center" legacy', () => {
      expect(clean('<p align="center">c</p>')).toBe('<p style="text-align:center">c</p>');
    });
  });

  describe('enlaces', () => {
    it('conserva href http/mailto y descarta javascript:', () => {
      expect(clean('<p><a href="https://x.co">link</a></p>')).toBe('<p><a href="https://x.co">link</a></p>');
      expect(clean('<p><a href="mailto:a@b.co">mail</a></p>')).toBe('<p><a href="mailto:a@b.co">mail</a></p>');
      expect(clean('<p><a href="javascript:alert(1)">x</a></p>')).toBe('<p>x</p>');
    });
  });

  describe('sanitizeHtmlToTcpdf (entrada no confiable vía DOMParser)', () => {
    it('produce la misma salida canónica que el recorrido del DOM vivo', () => {
      expect(sanitizeHtmlToTcpdf('<div style="color:red"><b>hola</b></div>'))
        .toBe('<p><strong>hola</strong></p>');
    });

    it('neutraliza img con onerror y scripts embebidos', () => {
      const out = sanitizeHtmlToTcpdf('<img src="x" onerror="alert(1)"><script>alert(2)</script><p>seguro</p>');
      expect(out).toBe('<p>seguro</p>');
      expect(out).not.toContain('onerror');
      expect(out).not.toContain('script');
    });

    it('cadena vacía → ""', () => {
      expect(sanitizeHtmlToTcpdf('')).toBe('');
    });
  });

  describe('salida acotada a la allowlist', () => {
    it('un documento heterogéneo solo usa tags permitidos', () => {
      const messy = `
        <div class="wrap" style="padding:20px">
          <font color="red"><b>Título</b></font>
          <span style="font-style:italic">intro</span>
          <ul><li>item</li></ul>
          <table><tr><td>celda</td></tr></table>
          <p align="right">fin</p>
        </div>`;
      const out = clean(messy);
      const usedTags = [...out.matchAll(/<([a-z0-9]+)/g)].map((m) => m[1]);
      const allowed = new Set<string>(TCPDF_ALLOWED_TAGS);
      usedTags.forEach((tag) => expect(allowed.has(tag)).toBe(true));
      expect(out).not.toContain('class=');
      expect(out).not.toContain('<div');
      expect(out).not.toContain('<span');
      expect(out).not.toContain('<font');
    });
  });
});
