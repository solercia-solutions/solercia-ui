import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import { SolConfirmDialogComponent } from './confirm-dialog.component';

describe('SolConfirmDialogComponent', () => {
  let fixture: ComponentFixture<SolConfirmDialogComponent>;
  let confirms: number;
  let cancels: number;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SolConfirmDialogComponent] });
    fixture = TestBed.createComponent(SolConfirmDialogComponent);
    confirms = 0;
    cancels = 0;
    fixture.componentInstance.confirm.subscribe(() => confirms++);
    fixture.componentInstance.cancel.subscribe(() => cancels++);
  });

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;

  it('cerrado no pinta nada', () => {
    fixture.detectChanges();
    expect(el().querySelector('[data-testid="sol-confirm-dialog"]')).toBeNull();
  });

  it('abierto muestra título, mensaje, ícono de la variante y las dos acciones', () => {
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('title', '¿Aplicar este tema?');
    fixture.componentRef.setInput('message', 'Mensaje');
    fixture.componentRef.setInput('confirmLabel', 'Aplicar tema');
    fixture.componentRef.setInput('variant', 'warning');
    fixture.detectChanges();

    expect(el().querySelector('.sol-confirm-title')?.textContent?.trim()).toBe('¿Aplicar este tema?');
    expect(el().querySelector('.sol-confirm-message')?.textContent?.trim()).toBe('Mensaje');
    expect(el().querySelector('.sol-confirm-icon--warning')).not.toBeNull();
    const accept = el().querySelector('[data-testid="sol-confirm-accept"]') as HTMLButtonElement;
    expect(accept.className).toContain('sol-confirm-btn--warning');
    expect(accept.textContent?.trim()).toBe('Aplicar tema');
  });

  it('confirmar emite confirm; cancelar, Escape y el fondo emiten cancel', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    (el().querySelector('[data-testid="sol-confirm-accept"]') as HTMLButtonElement).click();
    expect(confirms).toBe(1);

    (el().querySelector('[data-testid="sol-confirm-cancel"]') as HTMLButtonElement).click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    (el().querySelector('.sol-confirm-overlay') as HTMLElement).click();
    expect(cancels).toBe(3);
  });

  it('el clic dentro del panel no cancela', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    (el().querySelector('.sol-confirm-panel') as HTMLElement).click();
    expect(cancels).toBe(0);
  });
});
