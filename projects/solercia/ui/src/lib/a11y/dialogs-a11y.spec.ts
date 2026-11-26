import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SOL_I18N, createSolI18n } from '../i18n/sol-i18n';
import { SolModalComponent } from '../ui/modal/modal.component';
import { SolDrawerComponent } from '../ui/drawer/drawer.component';
import { SolConfirmDialogComponent } from '../ui/confirm-dialog/confirm-dialog.component';
import { SolDataTableComponent } from '../ui/data-table/data-table.component';

@Component({
  imports: [SolModalComponent, SolDrawerComponent],
  template: `
    <button id="opener">open</button>
    <sol-modal [open]="m()" [title]="title()" ariaLabel="Fallback name" [closeable]="closeable()" (closed)="closedCount = closedCount + 1">
      <input id="a" /><button id="b">b</button>
    </sol-modal>
    <sol-drawer [open]="d()" ariaLabel="Filters"><button id="c">c</button></sol-drawer>
  `,
})
class Host {
  m = signal(false); d = signal(false); title = signal<string>('Edit'); closeable = signal(true); closedCount = 0;
}

const tab = (shift = false) =>
  document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: shift, bubbles: true, cancelable: true }));
const esc = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

describe('dialogs a11y regression (0.8.0)', () => {
  let f: ReturnType<typeof TestBed.createComponent<Host>>;
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [Host] });
    f = TestBed.createComponent(Host);
    document.body.appendChild(f.nativeElement);
    f.detectChanges();
  });
  afterEach(() => { f.destroy(); document.body.style.overflow = ''; });

  it('dialog semantics, focus in, trap, restore', async () => {
    const opener = f.nativeElement.querySelector('#opener') as HTMLElement;
    opener.focus();
    f.componentInstance.m.set(true); f.detectChanges(); await f.whenStable();
    const panel = f.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    expect(panel.getAttribute('aria-modal')).toBe('true');
    const h = document.getElementById(panel.getAttribute('aria-labelledby')!);
    expect(h?.textContent?.trim()).toBe('Edit');
    expect(panel.contains(document.activeElement)).toBe(true);
    for (let i = 0; i < 6; i++) { tab(); expect(panel.contains(document.activeElement)).toBe(true); }
    for (let i = 0; i < 6; i++) { tab(true); expect(panel.contains(document.activeElement)).toBe(true); }
    esc(); expect(f.componentInstance.closedCount).toBe(1);
    f.componentInstance.m.set(false); f.detectChanges(); await f.whenStable();
    expect(document.activeElement).toBe(opener);
  });

  it('no title -> aria-label; closeable=false ignores Escape', async () => {
    f.componentInstance.title.set(''); f.componentInstance.closeable.set(false);
    f.componentInstance.m.set(true); f.detectChanges(); await f.whenStable();
    const panel = f.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    expect(panel.getAttribute('aria-label')).toBe('Fallback name');
    expect(panel.hasAttribute('aria-labelledby')).toBe(false);
    esc(); expect(f.componentInstance.closedCount).toBe(0);
  });

  it('stacked modal + drawer: scroll lock held until the last one closes, then restored', async () => {
    document.body.style.overflow = 'scroll';
    f.componentInstance.m.set(true); f.detectChanges(); await f.whenStable();
    f.componentInstance.d.set(true); f.detectChanges(); await f.whenStable();
    expect(document.body.style.overflow).toBe('hidden');
    f.componentInstance.m.set(false); f.detectChanges(); await f.whenStable();
    expect(document.body.style.overflow).toBe('hidden');
    f.componentInstance.d.set(false); f.detectChanges(); await f.whenStable();
    expect(document.body.style.overflow).toBe('scroll');
  });

  it('drawer ariaLabel names the dialog', async () => {
    f.componentInstance.d.set(true); f.detectChanges(); await f.whenStable();
    const dlg = Array.from(f.nativeElement.querySelectorAll('[aria-modal="true"]')).find((e) => (e as Element).getAttribute('aria-label') === 'Filters');
    expect(dlg).toBeTruthy();
  });
});

describe('confirm dialog and explicit inputs regression (0.8.0)', () => {
  it('confirm: alertdialog labelled/described, focus on Cancel', () => {
    TestBed.configureTestingModule({ imports: [SolConfirmDialogComponent] });
    const c = TestBed.createComponent(SolConfirmDialogComponent);
    c.componentRef.setInput('open', true); c.componentRef.setInput('message', 'Delete it?');
    document.body.appendChild(c.nativeElement); c.detectChanges();
    const p = c.nativeElement.querySelector('[role="alertdialog"]') as HTMLElement;
    expect(document.getElementById(p.getAttribute('aria-labelledby')!)?.textContent?.trim()).toBe('Are you sure?');
    expect(document.getElementById(p.getAttribute('aria-describedby')!)?.textContent?.trim()).toBe('Delete it?');
    expect((document.activeElement as HTMLElement).dataset['testid']).toBe('sol-confirm-cancel');
    c.destroy();
  });

  it('explicit inputs beat the es-CO catalog', () => {
    TestBed.configureTestingModule({ imports: [SolDataTableComponent, SolConfirmDialogComponent], providers: [{ provide: SOL_I18N, useFactory: () => createSolI18n({ lang: 'es-CO' }) }] });
    const t = TestBed.createComponent(SolDataTableComponent);
    t.componentRef.setInput('data', []); t.componentRef.setInput('columns', [{ key: 'a', label: 'A' }]);
    t.componentRef.setInput('showActions', true); t.componentRef.setInput('actionsLabel', 'Ops'); t.componentRef.setInput('searchPlaceholder', 'Find');
    t.componentRef.setInput('emptyMessage', 'Nada aquí'); t.detectChanges();
    const el = t.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Ops'); expect(el.textContent).toContain('Nada aquí');
    expect(el.querySelector('input')?.getAttribute('placeholder')).toBe('Find');
    const c = TestBed.createComponent(SolConfirmDialogComponent);
    c.componentRef.setInput('open', true); c.componentRef.setInput('confirmLabel', 'Sí, borrar'); c.detectChanges();
    expect((c.nativeElement as HTMLElement).textContent).toContain('Sí, borrar');
    expect((c.nativeElement as HTMLElement).textContent).toContain('Cancelar');
  });
});
