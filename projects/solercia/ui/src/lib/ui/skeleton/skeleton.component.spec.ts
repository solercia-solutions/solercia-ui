import { TestBed } from '@angular/core/testing';
import { SolSkeletonComponent } from './skeleton.component';

describe('SolSkeletonComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SolSkeletonComponent],
    }).compileComponents();
  });

  function createFixture() {
    return TestBed.createComponent(SolSkeletonComponent);
  }

  it('renderiza un solo bloque con la variante por defecto', () => {
    const fixture = createFixture();
    fixture.detectChanges();

    const blocks = fixture.nativeElement.querySelectorAll('.skeleton');
    expect(blocks.length).toBe(1);
    expect(blocks[0].classList.contains('skeleton--rounded')).toBe(true);
  });

  it('aplica la clase de cada variante nueva', () => {
    const variants = ['text', 'title', 'stat', 'card', 'row', 'circle'] as const;

    for (const variant of variants) {
      const fixture = createFixture();
      fixture.componentRef.setInput('variant', variant);
      fixture.detectChanges();

      const block = fixture.nativeElement.querySelector('.skeleton');
      expect(block.classList.contains(`skeleton--${variant}`)).toBe(true);
    }
  });

  it('repite bloques según count', () => {
    const fixture = createFixture();
    fixture.componentRef.setInput('variant', 'row');
    fixture.componentRef.setInput('count', 6);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.skeleton--row').length).toBe(6);
  });

  it('acepta count como atributo string', () => {
    const fixture = createFixture();
    fixture.componentRef.setInput('count', '3');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.skeleton').length).toBe(3);
  });

  it('normaliza count inválido a un solo bloque', () => {
    const fixture = createFixture();
    fixture.componentRef.setInput('count', 0);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.skeleton').length).toBe(1);
  });

  it('aplica width y height como overrides inline', () => {
    const fixture = createFixture();
    fixture.componentRef.setInput('variant', 'text');
    fixture.componentRef.setInput('width', '120px');
    fixture.componentRef.setInput('height', '20px');
    fixture.detectChanges();

    const block = fixture.nativeElement.querySelector('.skeleton') as HTMLElement;
    expect(block.style.width).toBe('120px');
    expect(block.style.height).toBe('20px');
  });

  it('no emite estilos inline cuando no hay overrides', () => {
    const fixture = createFixture();
    fixture.detectChanges();

    const block = fixture.nativeElement.querySelector('.skeleton') as HTMLElement;
    expect(block.style.width).toBe('');
    expect(block.style.height).toBe('');
  });

  it('queda oculto para tecnologías de asistencia', () => {
    const fixture = createFixture();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(host.getAttribute('role')).toBe('presentation');
  });
});
