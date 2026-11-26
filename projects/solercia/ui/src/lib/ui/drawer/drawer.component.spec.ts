import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { SolDrawerComponent } from './drawer.component';

function pressEscape(): void {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}

function pressTab(shiftKey = false): void {
  document.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true }),
  );
}

/** Host mínimo para probar accesibilidad y proyección de contenido/footer. */
@Component({
  standalone: true,
  imports: [SolDrawerComponent],
  template: `
    <button type="button">Editar</button>
    <sol-drawer [open]="isOpen()" title="Editar categoría" (closed)="isOpen.set(false)">
      <p class="drawer-body-content">Contenido del formulario</p>
      <div drawerFooter class="drawer-footer-content">
        <button type="button" class="footer-btn">Guardar</button>
      </div>
    </sol-drawer>
  `,
})
class DrawerHostComponent {
  readonly isOpen = signal(false);
}

describe('SolDrawerComponent — apertura, lados, tamaños y cierre', () => {
  let fixture: ComponentFixture<SolDrawerComponent>;
  let component: SolDrawerComponent;
  let closedCount: number;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SolDrawerComponent] });
    fixture = TestBed.createComponent(SolDrawerComponent);
    component = fixture.componentInstance;
    closedCount = 0;
    component.closed.subscribe(() => closedCount++);
  });

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('cerrado no renderiza nada; abierto monta overlay, título y botón de cierre', () => {
    fixture.detectChanges();
    expect(el().querySelector('.sol-drawer-overlay')).toBeNull();

    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('title', 'Editar categoría');
    fixture.detectChanges();

    expect(el().querySelector('.sol-drawer-overlay')).not.toBeNull();
    expect(el().querySelector('.sol-drawer-title')?.textContent).toContain('Editar categoría');
    expect(el().querySelector('.sol-drawer-close')).not.toBeNull();

    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
  });

  it('el lado end es el default; el lado start invierte overlay y panel', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    expect(el().querySelector('.sol-drawer-overlay--end')).not.toBeNull();
    expect(el().querySelector('.sol-drawer-panel--end')).not.toBeNull();

    fixture.componentRef.setInput('side', 'start');
    fixture.detectChanges();
    expect(el().querySelector('.sol-drawer-overlay--start')).not.toBeNull();
    expect(el().querySelector('.sol-drawer-panel--start')).not.toBeNull();

    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
  });

  it('el ancho sale del tamaño (sm/md/lg) vía clase, por tokens', () => {
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('size', 'sm');
    fixture.detectChanges();
    expect(el().querySelector('.sol-drawer-sm')).not.toBeNull();

    fixture.componentRef.setInput('size', 'lg');
    fixture.detectChanges();
    expect(el().querySelector('.sol-drawer-lg')).not.toBeNull();

    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
  });

  it('PR-C4 — variant panel (default) NUNCA agrega la clase --sheet (regresión de compatibilidad)', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    expect(el().querySelector('.sol-drawer-panel--sheet')).toBeNull();
    expect(el().querySelector('.sol-drawer-overlay--sheet')).toBeNull();

    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
  });

  it('PR-C4 — variant sheet agrega --sheet a overlay y panel, ADITIVO (conserva side/size)', () => {
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('variant', 'sheet');
    fixture.detectChanges();

    expect(el().querySelector('.sol-drawer-panel--sheet')).not.toBeNull();
    expect(el().querySelector('.sol-drawer-overlay--sheet')).not.toBeNull();
    expect(el().querySelector('.sol-drawer-panel--end')).not.toBeNull(); // side por defecto conservado
    expect(el().querySelector('.sol-drawer-md')).not.toBeNull(); // size por defecto conservado

    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
  });

  it('Escape solicita el cierre SOLO con el drawer abierto y cerrable', () => {
    fixture.detectChanges();
    pressEscape();
    expect(closedCount).toBe(0);

    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    pressEscape();
    expect(closedCount).toBe(1);

    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
  });

  it('con closeable=false ni Escape ni la X pueden cerrar', () => {
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('closeable', false);
    fixture.detectChanges();

    pressEscape();
    expect(closedCount).toBe(0);
    expect(el().querySelector('.sol-drawer-close')).toBeNull();

    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
  });

  it('el clic en el backdrop cierra por defecto (a diferencia de sol-modal)', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    (el().querySelector('.sol-drawer-overlay') as HTMLElement).click();
    expect(closedCount).toBe(1);
  });

  it('closeOnBackdrop=false desactiva el cierre por backdrop', () => {
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('closeOnBackdrop', false);
    fixture.detectChanges();

    (el().querySelector('.sol-drawer-overlay') as HTMLElement).click();
    expect(closedCount).toBe(0);

    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
  });

  it('el clic DENTRO del panel nunca cierra (stopPropagation)', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    (el().querySelector('.sol-drawer-panel') as HTMLElement).click();
    expect(closedCount).toBe(0);

    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
  });

  it('el botón X emite closed', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    (el().querySelector('.sol-drawer-close') as HTMLElement).click();
    expect(closedCount).toBe(1);
  });

  it('candado de scroll: bloquea el body mientras está abierto y lo libera al cerrar', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    expect(document.body.style.overflow).toBe('hidden');

    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    expect(document.body.style.overflow).not.toBe('hidden');
  });
});

describe('SolDrawerComponent — accesibilidad y contenido proyectado', () => {
  let fixture: ComponentFixture<DrawerHostComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [DrawerHostComponent] });
    fixture = TestBed.createComponent(DrawerHostComponent);
    fixture.detectChanges();
  });

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('proyecta header (título), contenido y footer', () => {
    fixture.componentInstance.isOpen.set(true);
    fixture.detectChanges();

    expect(el().querySelector('.sol-drawer-title')?.textContent).toContain('Editar categoría');
    expect(el().querySelector('.drawer-body-content')).not.toBeNull();
    expect(el().querySelector('.drawer-footer-content')).not.toBeNull();
    expect(el().querySelector('.footer-btn')).not.toBeNull();
  });

  it('role=dialog, aria-modal y aria-labelledby apuntan al título', () => {
    fixture.componentInstance.isOpen.set(true);
    fixture.detectChanges();

    const panel = el().querySelector('.sol-drawer-panel') as HTMLElement;
    const drawerTitle = el().querySelector('.sol-drawer-title') as HTMLElement;
    expect(panel.getAttribute('role')).toBe('dialog');
    expect(panel.getAttribute('aria-modal')).toBe('true');
    expect(panel.getAttribute('aria-labelledby')).toBe(drawerTitle.id);
  });

  it('ciclo de foco: entra al abrir, Tab/Shift+Tab ciclan dentro y Escape lo devuelve al disparador', () => {
    const trigger = el().querySelector('button') as HTMLButtonElement;
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    fixture.componentInstance.isOpen.set(true);
    fixture.detectChanges();

    const closeBtn = el().querySelector('.sol-drawer-close') as HTMLElement;
    const saveBtn = el().querySelector('.footer-btn') as HTMLElement;

    // El primer control focuseable del panel (la X) recibe el foco al abrir.
    expect(document.activeElement).toBe(closeBtn);

    // Tab en el último control (Guardar) cicla de vuelta a la X.
    saveBtn.focus();
    pressTab();
    expect(document.activeElement).toBe(closeBtn);

    // Shift+Tab en el primer control (la X) cicla al último (Guardar).
    closeBtn.focus();
    pressTab(true);
    expect(document.activeElement).toBe(saveBtn);

    // Escape cierra y devuelve el foco al botón "Editar" que abrió el drawer.
    pressEscape();
    fixture.detectChanges();
    expect(document.activeElement).toBe(trigger);
  });
});

describe('SolDrawerComponent — accessible name without a title', () => {
  it('uses the ariaLabel input instead of an empty labelledby heading', () => {
    TestBed.configureTestingModule({ imports: [SolDrawerComponent] });
    const fixture = TestBed.createComponent(SolDrawerComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('ariaLabel', 'Filters');
    fixture.detectChanges();
    const panel = (fixture.nativeElement as HTMLElement).querySelector('.sol-drawer-panel') as HTMLElement;
    expect(panel.getAttribute('aria-label')).toBe('Filters');
    expect(panel.hasAttribute('aria-labelledby')).toBe(false);
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
  });
});
