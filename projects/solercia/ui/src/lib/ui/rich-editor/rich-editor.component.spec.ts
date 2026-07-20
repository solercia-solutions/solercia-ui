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

  /** Escribe `text` en el editor con el caret al final y dispara `input`. */
  function typeInEditor(text: string): void {
    const el = content();
    el.focus();
    el.textContent = text;
    const node = el.firstChild!;
    const range = document.createRange();
    range.setStart(node, text.length);
    range.collapse(true);
    const selection = document.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    el.dispatchEvent(new Event('input'));
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

  describe('menciones (@) / tareas (#) — DESACTIVADAS por defecto', () => {
    it('sin listas, mentionsEnabled/tasksEnabled son false', () => {
      expect(component.mentionsEnabled()).toBe(false);
      expect(component.tasksEnabled()).toBe(false);
    });

    it('teclear @ o # no abre popover y el HTML sale como texto plano', () => {
      typeInEditor('hola @todos');
      expect(component.showMentionPopover()).toBe(false);
      expect(component.showTaskPopover()).toBe(false);
      expect(component.getHtml()).toBe('<p>hola @todos</p>');
    });
  });

  describe('menciones (@) / tareas (#) — opt-in (con listas)', () => {
    const USERS = [
      { id: 'u1', name: 'Ana Gómez' },
      { id: 'u2', name: 'Andrés Ruiz' },
      { id: 'u3', name: 'Beatriz Díaz' },
    ];
    const TASKS = [
      { key: 'SDM-12', title: 'Ajustar el login' },
      { key: 'SDM-15', title: 'Corregir el header' },
    ];

    beforeEach(() => {
      fixture.componentRef.setInput('mentionableUsers', USERS);
      fixture.componentRef.setInput('linkableTasks', TASKS);
      fixture.detectChanges();
    });

    it('teclear @ abre el popover de menciones filtrado por nombre', () => {
      typeInEditor('@An');
      expect(component.showMentionPopover()).toBe(true);
      expect(component.filteredUsers().map((u) => u.name)).toEqual(['Ana Gómez', 'Andrés Ruiz']);
    });

    it('teclear # abre el popover de tareas filtrado por key/título', () => {
      typeInEditor('#SDM-12');
      expect(component.showTaskPopover()).toBe(true);
      expect(component.filteredTasks().map((t) => t.key)).toEqual(['SDM-12']);
    });

    it('elegir una mención inserta el chip y emite mentionsChange', () => {
      const emitted: string[][] = [];
      component.mentionsChange.subscribe((v) => emitted.push(v));

      typeInEditor('@An');
      component.selectMention(null, 0); // Ana Gómez

      const html = component.getHtml();
      expect(html).toContain('<span data-mention-id="u1">@Ana Gómez</span>');
      expect(html).not.toContain('contenteditable');
      expect(component.showMentionPopover()).toBe(false);
      expect(emitted.at(-1)).toEqual(['u1']);
    });

    it('elegir una tarea inserta el chip y emite taskLinksChange', () => {
      const emitted: string[][] = [];
      component.taskLinksChange.subscribe((v) => emitted.push(v));

      typeInEditor('#SDM-12');
      component.selectTask(null, 0);

      const html = component.getHtml();
      expect(html).toContain('<span data-task-key="SDM-12">SDM-12</span>');
      expect(emitted.at(-1)).toEqual(['SDM-12']);
    });

    it('ArrowDown mueve la selección y Escape cierra el popover', () => {
      typeInEditor('@An');
      expect(component.activeIndex()).toBe(0);
      component.onKeyDown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      expect(component.activeIndex()).toBe(1);
      component.onKeyDown(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(component.showMentionPopover()).toBe(false);
    });

    it('writeValue con chips los conserva y los deja no editables (round-trip)', () => {
      component.writeValue(
        '<p>Hola <span data-mention-id="u1">@Ana</span> y <span data-task-key="SDM-12">SDM-12</span></p>',
      );
      fixture.detectChanges();

      expect(component.getHtml()).toBe(
        '<p>Hola <span data-mention-id="u1">@Ana</span> y <span data-task-key="SDM-12">SDM-12</span></p>',
      );
      const chip = content().querySelector('[data-mention-id]') as HTMLElement;
      expect(chip.getAttribute('contenteditable')).toBe('false');
    });
  });

  describe('menús de toolbar — sin recorte por overflow (follow-up 4R 2026-07-20)', () => {
    it('ningún ancestro del menú dentro del componente recorta contenido — el menú (top: calc(100% + …)) puede sobresalir del borde del editor', () => {
      component.toggleMenu('heading');
      fixture.detectChanges();

      const menu = root().querySelector('.sol-rich-editor__menu') as HTMLElement;
      expect(menu).not.toBeNull();

      // El menú es position:absolute colgando bajo su trigger: CUALQUIER
      // ancestro con overflow distinto de visible dentro del componente lo
      // recorta contra el borde del editor cuando el contenido es bajo (el
      // bug reportado era overflow:hidden en .sol-rich-editor). Se recorre la
      // cadena real de ancestros del menú hasta el host.
      const clippers: string[] = [];
      for (let el = menu.parentElement; el && el !== root(); el = el.parentElement) {
        const style = getComputedStyle(el);
        const values = [style.overflow, style.overflowX, style.overflowY].filter(Boolean);
        if (values.some(v => v !== 'visible')) {
          clippers.push(`${el.className || el.tagName} → overflow: ${values.join('/')}`);
        }
      }
      expect(clippers).toEqual([]);
    });
  });
});
