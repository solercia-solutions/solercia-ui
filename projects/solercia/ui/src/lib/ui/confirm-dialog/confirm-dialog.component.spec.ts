import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
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

function pressTab(shiftKey = false): void {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true }));
}

@Component({
  standalone: true,
  imports: [SolConfirmDialogComponent],
  template: `
    <button type="button" class="trigger">Delete</button>
    <sol-confirm-dialog [open]="isOpen()" title="Delete the record?" message="This cannot be undone." (cancel)="isOpen.set(false)" />
  `,
})
class ConfirmHostComponent {
  readonly isOpen = signal(false);
}

describe('SolConfirmDialogComponent — accessibility', () => {
  let fixture: ComponentFixture<ConfirmHostComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ConfirmHostComponent] });
    fixture = TestBed.createComponent(ConfirmHostComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.componentInstance.isOpen.set(false);
    fixture.detectChanges();
  });

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const open = (): void => {
    fixture.componentInstance.isOpen.set(true);
    fixture.detectChanges();
  };

  it('the panel is an alertdialog labelled by its title and described by its message', () => {
    open();
    const panel = el().querySelector('.sol-confirm-panel') as HTMLElement;
    const title = el().querySelector('.sol-confirm-title') as HTMLElement;
    const message = el().querySelector('.sol-confirm-message') as HTMLElement;
    expect(panel.getAttribute('role')).toBe('alertdialog');
    expect(panel.getAttribute('aria-modal')).toBe('true');
    expect(panel.getAttribute('aria-labelledby')).toBe(title.id);
    expect(panel.getAttribute('aria-describedby')).toBe(message.id);
  });

  it('focuses the least destructive action on open and traps Tab', () => {
    (el().querySelector('.trigger') as HTMLElement).focus();
    open();
    const accept = el().querySelector('[data-testid="sol-confirm-accept"]') as HTMLElement;
    const cancel = el().querySelector('[data-testid="sol-confirm-cancel"]') as HTMLElement;
    expect(document.activeElement).toBe(cancel);

    pressTab();
    expect(document.activeElement).toBe(accept);
    accept.focus();
    pressTab(true);
    expect(document.activeElement).toBe(cancel);
  });

  it('Escape cancels, focus returns to the trigger and the scroll lock is released', () => {
    const trigger = el().querySelector('.trigger') as HTMLElement;
    trigger.focus();
    open();
    expect(document.body.style.overflow).toBe('hidden');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(el().querySelector('.sol-confirm-panel')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).not.toBe('hidden');
  });
});
