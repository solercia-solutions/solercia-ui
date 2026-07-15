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
