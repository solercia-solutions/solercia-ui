import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { SolPageHeaderComponent } from './page-header.component';

describe('SolPageHeaderComponent — cabecera de página', () => {
  let fixture: ComponentFixture<SolPageHeaderComponent>;

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SolPageHeaderComponent] });
    fixture = TestBed.createComponent(SolPageHeaderComponent);
    fixture.componentRef.setInput('title', 'Profesionales');
    fixture.detectChanges();
  });

  it('renderiza el título como H1', () => {
    const h1 = el().querySelector('h1.sol-page-header__title');
    expect(h1).not.toBeNull();
    expect(h1?.textContent?.trim()).toBe('Profesionales');
  });

  it('no renderiza el subtítulo cuando está vacío y sí cuando se provee', () => {
    expect(el().querySelector('.sol-page-header__subtitle')).toBeNull();

    fixture.componentRef.setInput('subtitle', 'Gestiona tu equipo');
    fixture.detectChanges();

    const sub = el().querySelector('.sol-page-header__subtitle');
    expect(sub?.textContent?.trim()).toBe('Gestiona tu equipo');
  });
});

/** Host que proyecta una acción en el slot de la cabecera. */
@Component({
  standalone: true,
  imports: [SolPageHeaderComponent],
  template: `
    <sol-page-header title="Profesionales">
      <button class="accion-host" type="button">Crear</button>
    </sol-page-header>
  `,
})
class HostComponent {}

describe('SolPageHeaderComponent — proyección de acciones', () => {
  it('proyecta las acciones en el slot de la derecha', () => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const action = (fixture.nativeElement as HTMLElement).querySelector(
      '.sol-page-header__actions .accion-host',
    );
    expect(action).not.toBeNull();
    expect(action?.textContent?.trim()).toBe('Crear');
  });
});
