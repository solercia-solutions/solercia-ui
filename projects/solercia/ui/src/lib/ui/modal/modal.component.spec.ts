import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { SolModalComponent } from './modal.component';

function pressEscape(): void {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}

describe('SolModalComponent — apertura, escape y backdrop', () => {
  let fixture: ComponentFixture<SolModalComponent>;
  let component: SolModalComponent;
  let closedCount: number;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SolModalComponent] });
    fixture = TestBed.createComponent(SolModalComponent);
    component = fixture.componentInstance;
    closedCount = 0;
    component.closed.subscribe(() => closedCount++);
  });

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('cerrado no renderiza nada; abierto monta overlay, título y botón de cierre', () => {
    fixture.detectChanges();
    expect(el().querySelector('.sol-modal-overlay')).toBeNull();

    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('title', 'Crear FAQ');
    fixture.detectChanges();

    expect(el().querySelector('.sol-modal-overlay')).not.toBeNull();
    expect(el().querySelector('.sol-modal-title')?.textContent).toContain('Crear FAQ');
    expect(el().querySelector('.sol-modal-close')).not.toBeNull();
  });

  it('Escape solicita el cierre SOLO con el modal abierto', () => {
    fixture.detectChanges();
    pressEscape();
    expect(closedCount).toBe(0);

    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    pressEscape();
    expect(closedCount).toBe(1);
  });

  it('con closeable=false ni Escape ni la X pueden cerrar (flujos obligatorios)', () => {
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('closeable', false);
    fixture.detectChanges();

    pressEscape();
    expect(closedCount).toBe(0);
    expect(el().querySelector('.sol-modal-close')).toBeNull();
  });

  it('el clic en el backdrop cierra SOLO si closeOnBackdrop está activo', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    (el().querySelector('.sol-modal-overlay') as HTMLElement).click();
    expect(closedCount).toBe(0); // por defecto el backdrop NO cierra

    fixture.componentRef.setInput('closeOnBackdrop', true);
    fixture.detectChanges();
    (el().querySelector('.sol-modal-overlay') as HTMLElement).click();
    expect(closedCount).toBe(1);
  });

  it('el clic DENTRO del panel nunca cierra (stopPropagation)', () => {
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('closeOnBackdrop', true);
    fixture.detectChanges();

    (el().querySelector('.sol-modal-content') as HTMLElement).click();
    expect(closedCount).toBe(0);
  });

  it('el botón X emite closed y el tamaño gobierna la clase del panel', () => {
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('size', 'lg');
    fixture.detectChanges();

    expect(el().querySelector('.sol-modal-lg')).not.toBeNull();
    (el().querySelector('.sol-modal-close') as HTMLElement).click();
    expect(closedCount).toBe(1);
  });
});

function pressTab(shiftKey = false): void {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true }));
}

/** Host with a trigger, a modal and a footer button, to drive focus like a real page. */
@Component({
  standalone: true,
  imports: [SolModalComponent],
  template: `
    <button type="button" class="trigger">Open</button>
    <sol-modal [open]="isOpen()" [title]="title()" [ariaLabel]="ariaLabel()" (closed)="isOpen.set(false)">
      <input class="field" />
      <button type="button" class="save">Save</button>
    </sol-modal>
  `,
})
class ModalHostComponent {
  readonly isOpen = signal(false);
  readonly title = signal('Edit category');
  readonly ariaLabel = signal('');
}

describe('SolModalComponent — accessibility', () => {
  let fixture: ComponentFixture<ModalHostComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ModalHostComponent] });
    fixture = TestBed.createComponent(ModalHostComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.componentInstance.isOpen.set(false);
    fixture.detectChanges();
  });

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function open(): void {
    fixture.componentInstance.isOpen.set(true);
    fixture.detectChanges();
  }

  it('the panel is a modal dialog labelled by its title', () => {
    open();
    const panel = el().querySelector('.sol-modal-content') as HTMLElement;
    const title = el().querySelector('.sol-modal-title') as HTMLElement;
    expect(panel.getAttribute('role')).toBe('dialog');
    expect(panel.getAttribute('aria-modal')).toBe('true');
    expect(title.id).not.toBe('');
    expect(panel.getAttribute('aria-labelledby')).toBe(title.id);
    expect(panel.hasAttribute('aria-label')).toBe(false);
  });

  it('without a title it uses the ariaLabel input and renders no empty heading', () => {
    fixture.componentInstance.title.set('');
    fixture.componentInstance.ariaLabel.set('Image preview');
    open();
    const panel = el().querySelector('.sol-modal-content') as HTMLElement;
    expect(panel.getAttribute('aria-label')).toBe('Image preview');
    expect(panel.hasAttribute('aria-labelledby')).toBe(false);
    expect(el().querySelector('.sol-modal-title')).toBeNull();
  });

  it('moves focus into the dialog on open and traps Tab / Shift+Tab', () => {
    const trigger = el().querySelector('.trigger') as HTMLButtonElement;
    trigger.focus();
    open();

    const closeBtn = el().querySelector('.sol-modal-close') as HTMLElement;
    const save = el().querySelector('.save') as HTMLElement;
    expect(document.activeElement).toBe(closeBtn);

    save.focus();
    pressTab();
    expect(document.activeElement).toBe(closeBtn);

    closeBtn.focus();
    pressTab(true);
    expect(document.activeElement).toBe(save);
  });

  it('Escape closes and focus returns to the element focused before opening', () => {
    const trigger = el().querySelector('.trigger') as HTMLButtonElement;
    trigger.focus();
    open();
    expect(document.activeElement).not.toBe(trigger);

    pressEscape();
    fixture.detectChanges();
    expect(el().querySelector('.sol-modal-content')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('locks the background scroll while open and restores it after closing', () => {
    document.body.style.overflow = 'auto';
    open();
    expect(document.body.style.overflow).toBe('hidden');

    fixture.componentInstance.isOpen.set(false);
    fixture.detectChanges();
    expect(document.body.style.overflow).toBe('auto');
    document.body.style.overflow = '';
  });
});
