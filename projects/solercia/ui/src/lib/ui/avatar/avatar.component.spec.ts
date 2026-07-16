import { TestBed, type ComponentFixture } from '@angular/core/testing';
import {
  SolAvatarComponent,
  computeInitials,
  hashToPaletteIndex,
} from './avatar.component';

describe('computeInitials (pura)', () => {
  it('nombre compuesto: primera letra de la primera y la última palabra', () => {
    expect(computeInitials('Ana Torres')).toBe('AT');
  });

  it('nombre de 3+ palabras: ignora las del medio', () => {
    expect(computeInitials('María José Pérez Gómez')).toBe('MG');
  });

  it('una sola palabra: sus 2 primeras letras', () => {
    expect(computeInitials('Solercia')).toBe('SO');
  });

  it('cadena vacía o solo espacios: cadena vacía', () => {
    expect(computeInitials('')).toBe('');
    expect(computeInitials('   ')).toBe('');
  });
});

describe('hashToPaletteIndex (pura, determinista)', () => {
  it('la misma semilla SIEMPRE produce el mismo índice', () => {
    const a = hashToPaletteIndex('Ana Torres');
    const b = hashToPaletteIndex('Ana Torres');
    const c = hashToPaletteIndex('Ana Torres');
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('el índice siempre cae dentro del tamaño de paleta pedido', () => {
    for (const seed of ['x', 'Ana Torres', 'Empresa Demo S.A.S.', '', 'lead-42']) {
      const index = hashToPaletteIndex(seed, 8);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(8);
    }
  });

  it('semillas distintas típicamente producen índices distintos (no todo colapsa a 0)', () => {
    const indices = new Set(['Ana', 'Beto', 'Carla', 'Diego', 'Elena'].map((s) => hashToPaletteIndex(s)));
    expect(indices.size).toBeGreaterThan(1);
  });
});

describe('SolAvatarComponent', () => {
  let fixture: ComponentFixture<SolAvatarComponent>;

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SolAvatarComponent] });
    fixture = TestBed.createComponent(SolAvatarComponent);
  });

  it('[spec] color estable entre instancias: dos con el mismo name muestran el mismo color', () => {
    fixture.componentRef.setInput('name', 'Ana Torres');
    fixture.detectChanges();
    const firstClass = host().className;

    const second = TestBed.createComponent(SolAvatarComponent);
    second.componentRef.setInput('name', 'Ana Torres');
    second.detectChanges();
    const secondClass = (second.nativeElement as HTMLElement).className;

    expect(firstClass).toBe(secondClass);
  });

  it('[spec] iniciales de nombre compuesto: name="Ana Torres" muestra "AT"', () => {
    fixture.componentRef.setInput('name', 'Ana Torres');
    fixture.detectChanges();
    expect(host().querySelector('.sol-avatar__initials')?.textContent).toBe('AT');
  });

  it('con imageUrl, renderiza la imagen en vez de las iniciales', () => {
    fixture.componentRef.setInput('name', 'Ana Torres');
    fixture.componentRef.setInput('imageUrl', 'https://cdn.example.com/ana.jpg');
    fixture.detectChanges();

    const img = host().querySelector<HTMLImageElement>('.sol-avatar__image');
    expect(img?.src).toBe('https://cdn.example.com/ana.jpg');
    expect(host().querySelector('.sol-avatar__initials')).toBeNull();
  });

  it('aplica la clase de tamaño y expone aria-label con el name', () => {
    fixture.componentRef.setInput('name', 'Ana Torres');
    fixture.componentRef.setInput('size', 'lg');
    fixture.detectChanges();

    expect(host().className).toContain('sol-avatar--lg');
    expect(host().getAttribute('aria-label')).toBe('Ana Torres');
    expect(host().getAttribute('role')).toBe('img');
  });
});
