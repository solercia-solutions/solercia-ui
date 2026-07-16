import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { SolInputComponent } from './input.component';

/**
 * Gate 4R A3 (11-c-whatsapp-config PR3): un campo `type="password"` sin
 * `autocomplete` deja que el gestor de contraseñas del navegador/SO
 * (Keychain, 1Password vía la API nativa del navegador) OFREZCA guardar el
 * valor tecleado — inaceptable para un token de acceso de Meta. `sol-input`
 * no exponía forma de pasar `autocomplete` al `<input>` nativo; este
 * cambio es ADITIVO (default `undefined` — ningún consumidor existente
 * cambia de comportamiento).
 */
describe('SolInputComponent — autocomplete passthrough (gate 4R A3)', () => {
  let fixture: ComponentFixture<SolInputComponent>;

  const createComponent = (): ComponentFixture<SolInputComponent> => {
    const created = TestBed.createComponent(SolInputComponent);
    created.detectChanges();
    return created;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({});
    fixture = createComponent();
  });

  it('sin autocomplete especificado, el <input> nativo NO tiene el atributo (comportamiento previo intacto)', () => {
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    expect(input.getAttribute('autocomplete')).toBeNull();
  });

  it('con autocomplete="new-password", el <input> nativo lo recibe (token nunca ofrecido al gestor de contraseñas)', () => {
    fixture.componentRef.setInput('autocomplete', 'new-password');
    fixture.detectChanges();

    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    expect(input.getAttribute('autocomplete')).toBe('new-password');
  });

  it('con autocomplete="email", el <input> nativo lo recibe (caso de uso normal, no relacionado a secretos)', () => {
    fixture.componentRef.setInput('autocomplete', 'email');
    fixture.detectChanges();

    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    expect(input.getAttribute('autocomplete')).toBe('email');
  });
});
