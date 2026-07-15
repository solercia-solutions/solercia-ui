import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { SolToggleComponent } from './toggle.component';

describe('SolToggleComponent — switch con ControlValueAccessor', () => {
  let fixture: ComponentFixture<SolToggleComponent>;
  let component: SolToggleComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SolToggleComponent] });
    fixture = TestBed.createComponent(SolToggleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function switchEl(): HTMLButtonElement {
    return (fixture.nativeElement as HTMLElement).querySelector('button[role="switch"]')!;
  }

  it('el clic alterna el estado y lo refleja en aria-checked y la clase del track', () => {
    expect(switchEl().getAttribute('aria-checked')).toBe('false');

    switchEl().click();
    fixture.detectChanges();
    expect(switchEl().getAttribute('aria-checked')).toBe('true');
    expect(switchEl().className).toContain('sol-toggle__track--on');

    switchEl().click();
    fixture.detectChanges();
    expect(switchEl().getAttribute('aria-checked')).toBe('false');
  });

  it('propaga cada cambio al form (onChange) y marca touched', () => {
    const changes: boolean[] = [];
    let touched = false;
    component.registerOnChange(v => changes.push(v));
    component.registerOnTouched(() => (touched = true));

    switchEl().click();
    switchEl().click();

    expect(changes).toEqual([true, false]);
    expect(touched).toBe(true);
  });

  it('writeValue refleja el valor del form SIN re-emitir onChange (sin eco)', () => {
    const changes: boolean[] = [];
    component.registerOnChange(v => changes.push(v));

    component.writeValue(true);
    fixture.detectChanges();

    expect(switchEl().getAttribute('aria-checked')).toBe('true');
    expect(changes).toEqual([]);
  });

  it('deshabilitado: el botón nativo queda disabled y toggle() no muta ni emite', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    const changes: boolean[] = [];
    component.registerOnChange(v => changes.push(v));

    expect(switchEl().disabled).toBe(true);
    component.toggle(); // ni siquiera invocado directo debe pasar
    expect(component.checked()).toBe(false);
    expect(changes).toEqual([]);
  });

  it('muestra el label cuando se provee', () => {
    fixture.componentRef.setInput('label', 'Notificaciones');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Notificaciones');
  });
});
