import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { SOL_I18N } from '../../i18n/sol-i18n';
import { SolRichEditorComponent } from './rich-editor.component';

/**
 * Specs de `sol-rich-editor` (componente). Cubren el contrato observable en
 * jsdom: CVA (writeValue/onChange saneados), inserción vía Selection/Range
 * (tabla, enlace, imagen), saneado del pegado, estado deshabilitado y las
 * etiquetas i18n de la toolbar. Los comandos que dependen de
 * `document.execCommand` (negrita, listas, alineación) NO mutan el DOM en
 * jsdom —execCommand no está implementado— por eso se verifican por su
 * contrato (no lanzan y mantienen el value limpio), no por su efecto visual.
 */

const I18N_MOCK = {
  activeLang: signal('es-CO'),
  translate: (key: string) => key, // devuelve la clave (suficiente para aserciones)
};

describe('SolRichEditorComponent', () => {
  let fixture: ComponentFixture<SolRichEditorComponent>;
  let component: SolRichEditorComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SolRichEditorComponent],
      providers: [{ provide: SOL_I18N, useValue: I18N_MOCK }],
    });
    fixture = TestBed.createComponent(SolRichEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges(); // dispara ngAfterViewInit → viewReady
  });

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function content(): HTMLElement {
    return root().querySelector('.sol-rich-editor__content') as HTMLElement;
  }

  /** Coloca un caret colapsado al final del área editable (para inserciones). */
  function placeCaretInEditor(): void {
    const el = content();
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const selection = document.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
  }

  describe('CVA — writeValue / getHtml', () => {
    it('writeValue sanea el HTML entrante a canónico y lo pinta en el editable', () => {
      component.writeValue('<div style="color:red"><b>hola</b></div>');
      fixture.detectChanges();
      expect(content().innerHTML).toBe('<p><strong>hola</strong></p>');
      expect(component.getHtml()).toBe('<p><strong>hola</strong></p>');
    });

    it('writeValue(null) deja el editor vacío y marca isEmpty', () => {
      component.writeValue(null);
      fixture.detectChanges();
      expect(component.getHtml()).toBe('');
      expect(component.isEmpty()).toBe(true);
    });
  });

  describe('CVA — onChange en la edición', () => {
    it('al escribir emite el HTML LIMPIO (no el innerHTML crudo)', () => {
      const emitted: string[] = [];
      component.registerOnChange((v) => emitted.push(v));

      // Simula el DOM sucio que dejaría el navegador y dispara input.
      content().innerHTML = '<b>x</b><div style="text-align:center">y</div>';
      content().dispatchEvent(new Event('input'));

      expect(emitted.at(-1)).toBe('<p><strong>x</strong></p><p style="text-align:center">y</p>');
    });

    it('onBlur marca el control como tocado', () => {
      let touched = false;
      component.registerOnTouched(() => (touched = true));
      content().dispatchEvent(new Event('blur'));
      expect(touched).toBe(true);
    });
  });

  describe('estado deshabilitado', () => {
    it('setDisabledState(true) pone contenteditable="false"', () => {
      component.setDisabledState(true);
      fixture.detectChanges();
      expect(content().getAttribute('contenteditable')).toBe('false');
    });

    it('el input disabled también deshabilita el editor', () => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();
      expect(component.isDisabled()).toBe(true);
      expect(content().getAttribute('contenteditable')).toBe('false');
    });
  });

  describe('inserción de tabla (Selection/Range propio)', () => {
    it('inserta una table>tbody>tr>td y el value sale canónico', () => {
      placeCaretInEditor();
      component.insertTable(2, 3);

      const html = component.getHtml();
      expect(html).toContain('<table border="1" cellpadding="4" cellspacing="0"><tbody>');
      // 2 filas × 3 columnas = 6 celdas.
      expect((html.match(/<td>/g) ?? []).length).toBe(6);
      expect((html.match(/<tr>/g) ?? []).length).toBe(2);
      expect(component.showTableMenu()).toBe(false);
    });
  });

  describe('inserción de enlace', () => {
    it('con caret colapsado inserta <a> con el texto de la URL', () => {
      placeCaretInEditor();
      component.linkUrl.set('https://solercia.co');
      component.confirmLink();

      expect(component.getHtml()).toBe('<p><a href="https://solercia.co">https://solercia.co</a></p>');
    });

    it('antepone https:// a una URL sin esquema', () => {
      placeCaretInEditor();
      component.linkUrl.set('solercia.co');
      component.confirmLink();
      expect(component.getHtml()).toContain('href="https://solercia.co"');
    });
  });

  describe('inserción de imagen (base64)', () => {
    it('insertImage centrable produce una imagen segura en su propio párrafo', () => {
      placeCaretInEditor();
      const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';
      // insertImage es privado; se ejercita vía el flujo de archivo simulado.
      (component as unknown as { insertImage(url: string): void }).insertImage(dataUrl);

      expect(component.getHtml()).toBe(`<p><img src="${dataUrl}" alt="" /></p>`);
    });
  });

  describe('pegado saneado', () => {
    it('pega HTML enriquecido pasándolo por el serializador (sin divs/estilos)', () => {
      placeCaretInEditor();
      const paste = {
        clipboardData: {
          items: [],
          files: [],
          getData: (type: string) =>
            type === 'text/html'
              ? '<div class="x" style="color:red"><b>peg</b><span style="font-style:italic">ado</span></div>'
              : '',
        },
        preventDefault: () => {},
      } as unknown as ClipboardEvent;

      component.onPaste(paste);

      const html = component.getHtml();
      expect(html).toContain('<strong>peg</strong>');
      expect(html).toContain('<em>ado</em>');
      expect(html).not.toContain('class=');
      expect(html).not.toContain('<div');
      expect(html).not.toContain('color:red');
    });

    it('pega texto plano cuando no hay HTML', () => {
      placeCaretInEditor();
      const paste = {
        clipboardData: {
          items: [],
          files: [],
          getData: (type: string) => (type === 'text/plain' ? 'texto suelto' : ''),
        },
        preventDefault: () => {},
      } as unknown as ClipboardEvent;

      component.onPaste(paste);
      expect(component.getHtml()).toBe('<p>texto suelto</p>');
    });
  });

  describe('toolbar', () => {
    it('renderiza los grupos de botones con aria-label i18n', () => {
      const boldBtn = root().querySelector('[aria-label="shared.richEditor.bold"]');
      const tableBtn = root().querySelector('[aria-label="shared.richEditor.insertTable"]');
      expect(boldBtn).not.toBeNull();
      expect(tableBtn).not.toBeNull();
    });

    it('el menú de tabla se abre y se cierra con el trigger', () => {
      expect(component.showTableMenu()).toBe(false);
      component.toggleMenu('table');
      expect(component.showTableMenu()).toBe(true);
      component.toggleMenu('table');
      expect(component.showTableMenu()).toBe(false);
    });

    it('abrir un menú cierra los demás', () => {
      component.toggleMenu('heading');
      expect(component.showHeadingMenu()).toBe(true);
      component.toggleMenu('link');
      expect(component.showHeadingMenu()).toBe(false);
      expect(component.showLinkMenu()).toBe(true);
    });

    it('los comandos execCommand no lanzan aunque jsdom no los implemente', () => {
      placeCaretInEditor();
      expect(() => component.cmd('bold')).not.toThrow();
      expect(() => component.align('center')).not.toThrow();
      expect(() => component.removeFormat()).not.toThrow();
    });
  });
});
