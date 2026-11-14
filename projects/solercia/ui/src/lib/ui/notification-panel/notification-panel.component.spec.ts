import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { SOL_I18N } from '../../i18n/sol-i18n';
import { createCatalogCheckedI18nStub } from '../../testing/i18n-catalog';
import {
  SolNotificationPanelComponent,
  type SolNotificationItem,
} from './notification-panel.component';

describe('SolNotificationPanelComponent — centro de notificaciones genérico', () => {
  let fixture: ComponentFixture<SolNotificationPanelComponent>;

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function body(): HTMLElement {
    return host().querySelector<HTMLElement>('.sol-notification-panel__body')!;
  }

  function state(): string | null {
    return body().getAttribute('data-state');
  }

  function items(): HTMLElement[] {
    return Array.from(host().querySelectorAll<HTMLElement>('.sol-notification-panel__item'));
  }

  function firstButtonIn(selector: string): HTMLButtonElement {
    return host().querySelector<HTMLButtonElement>(`${selector} button`)!;
  }

  function sample(): SolNotificationItem[] {
    return [
      {
        id: 'n1',
        title: 'Tarea vencida',
        body: 'La tarea SOL-14 pasó su fecha límite.',
        timestamp: new Date(Date.now() - 90 * 60_000),
        read: false,
        typeLabel: 'Vencimiento',
        tone: 'danger',
        data: { taskKey: 'SOL-14' },
      },
      {
        id: 'n2',
        title: 'Nuevo comentario',
        timestamp: new Date(Date.now() - 30_000),
        read: true,
      },
      { id: 'n3', title: 'Sprint cerrado' },
    ];
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SolNotificationPanelComponent],
      // Stub que VERIFICA cada clave contra el catálogo real es-CO.json:
      // una clave i18n olvidada falla el test en vez de llegar cruda a producción.
      providers: [{ provide: SOL_I18N, useValue: createCatalogCheckedI18nStub() }],
    });
    fixture = TestBed.createComponent(SolNotificationPanelComponent);
  });

  // ---------------------------------------------------------------- estados

  describe('los cuatro estados son excluyentes y distinguibles', () => {
    it('cargando: muestra el spinner y ninguna lista, vacío ni error', () => {
      fixture.componentRef.setInput('loading', true);
      fixture.componentRef.setInput('items', []);
      fixture.detectChanges();

      expect(state()).toBe('loading');
      expect(host().querySelector('sol-spinner')).not.toBeNull();
      expect(host().querySelector('sol-empty-state')).toBeNull();
      expect(host().querySelector('.sol-notification-panel__error')).toBeNull();
      expect(items()).toHaveLength(0);
    });

    it('vacío legítimo: muestra sol-empty-state, sin spinner ni error', () => {
      fixture.componentRef.setInput('items', []);
      fixture.detectChanges();

      expect(state()).toBe('empty');
      expect(host().querySelector('sol-empty-state')).not.toBeNull();
      expect(host().querySelector('.sol-notification-panel__error')).toBeNull();
      expect(host().querySelector('sol-spinner')).toBeNull();
    });

    it('error de carga: bloque propio con role="alert" y acción de reintento, NUNCA sol-empty-state', () => {
      fixture.componentRef.setInput('error', true);
      fixture.componentRef.setInput('items', []);
      fixture.detectChanges();

      expect(state()).toBe('error');

      const alert = host().querySelector<HTMLElement>('.sol-notification-panel__error');
      expect(alert).not.toBeNull();
      expect(alert!.getAttribute('role')).toBe('alert');
      expect(alert!.textContent).toContain('No pudimos cargar tus notificaciones');
      expect(alert!.querySelector('button')).not.toBeNull();

      expect(host().querySelector('sol-empty-state')).toBeNull();
      expect(host().querySelector('sol-spinner')).toBeNull();
    });

    it('contenido: renderiza una fila por notificación con título, cuerpo y etiqueta de tipo', () => {
      fixture.componentRef.setInput('items', sample());
      fixture.detectChanges();

      expect(state()).toBe('content');
      expect(items()).toHaveLength(3);
      expect(items()[0].textContent).toContain('Tarea vencida');
      expect(items()[0].textContent).toContain('La tarea SOL-14 pasó su fecha límite.');
      expect(items()[0].textContent).toContain('Vencimiento');
      expect(host().querySelector('sol-empty-state')).toBeNull();
      expect(host().querySelector('.sol-notification-panel__error')).toBeNull();
    });
  });

  describe('vacío ≠ error (deuda saldada del componente original)', () => {
    it('con la lista vacía Y error=true gana el error: jamás dice "no tienes notificaciones"', () => {
      fixture.componentRef.setInput('items', []);
      fixture.componentRef.setInput('error', true);
      fixture.detectChanges();

      expect(state()).toBe('error');
      expect(host().querySelector('sol-empty-state')).toBeNull();
      expect(host().textContent).not.toContain('No tienes notificaciones');
    });

    it('el vacío legítimo y el error muestran textos y estructura distintos', () => {
      fixture.componentRef.setInput('items', []);
      fixture.detectChanges();
      const emptyText = body().textContent ?? '';
      const emptyState = state();

      fixture.componentRef.setInput('error', true);
      fixture.detectChanges();
      const errorText = body().textContent ?? '';

      expect(emptyState).toBe('empty');
      expect(state()).toBe('error');
      expect(emptyText).not.toBe(errorText);
      expect(emptyText).toContain('No tienes notificaciones');
      expect(errorText).toContain('No pudimos cargar tus notificaciones');
    });

    it('cargando gana sobre error: al reintentar se ve el spinner, no el fallo anterior', () => {
      fixture.componentRef.setInput('items', []);
      fixture.componentRef.setInput('error', true);
      fixture.componentRef.setInput('loading', true);
      fixture.detectChanges();

      expect(state()).toBe('loading');
      expect(host().querySelector('.sol-notification-panel__error')).toBeNull();
    });

    it('el mensaje específico del consumidor reemplaza la descripción genérica del error', () => {
      fixture.componentRef.setInput('error', true);
      fixture.componentRef.setInput('errorMessage', 'El servicio respondió 503');
      fixture.detectChanges();

      const alert = host().querySelector<HTMLElement>('.sol-notification-panel__error')!;
      expect(alert.textContent).toContain('El servicio respondió 503');
      expect(alert.textContent).not.toContain('Revisa tu conexión');
    });
  });

  // -------------------------------------------------------------- contador

  describe('contador de no leídas', () => {
    it('cuenta las no leídas tratando `read` ausente como NO leída', () => {
      fixture.componentRef.setInput('items', sample());
      fixture.detectChanges();

      // n1 (read:false) + n3 (sin `read`) = 2; n2 (read:true) no cuenta.
      expect(fixture.componentInstance.unreadCount()).toBe(2);
      expect(
        host().querySelector('.sol-notification-panel__unread sol-badge')!.textContent!.trim(),
      ).toBe('2');
    });

    it('sin no leídas oculta el contador y la acción de marcar todas', () => {
      fixture.componentRef.setInput(
        'items',
        sample().map((item) => ({ ...item, read: true })),
      );
      fixture.detectChanges();

      expect(fixture.componentInstance.unreadCount()).toBe(0);
      expect(host().querySelector('.sol-notification-panel__unread')).toBeNull();
      expect(host().querySelector('.sol-notification-panel__mark-all')).toBeNull();
      expect(host().querySelectorAll('.sol-notification-panel__mark-read')).toHaveLength(0);
    });

    it('items null/undefined se tratan como lista vacía sin romper el contador', () => {
      fixture.componentRef.setInput('items', null);
      fixture.detectChanges();

      expect(fixture.componentInstance.unreadCount()).toBe(0);
      expect(state()).toBe('empty');
    });
  });

  // --------------------------------------------------------------- outputs

  describe('outputs: el panel emite y nunca navega ni llama servicios', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('items', sample());
      fixture.detectChanges();
    });

    it('itemSelected emite la notificación completa, con su `data` intacto', () => {
      const emitted: SolNotificationItem[] = [];
      fixture.componentInstance.itemSelected.subscribe((n) => emitted.push(n));

      firstButtonIn('.sol-notification-panel__item').click();

      expect(emitted).toHaveLength(1);
      expect(emitted[0].id).toBe('n1');
      expect(emitted[0].data).toEqual({ taskKey: 'SOL-14' });
    });

    it('markedRead emite solo la notificación de esa fila', () => {
      const emitted: SolNotificationItem[] = [];
      fixture.componentInstance.markedRead.subscribe((n) => emitted.push(n));

      // La acción solo existe en filas no leídas: n1 y n3.
      const actions = host().querySelectorAll<HTMLElement>('.sol-notification-panel__mark-read');
      expect(actions).toHaveLength(2);

      actions[1].querySelector('button')!.click();

      expect(emitted).toHaveLength(1);
      expect(emitted[0].id).toBe('n3');
    });

    it('markedAllRead emite una vez desde la acción del encabezado', () => {
      let count = 0;
      fixture.componentInstance.markedAllRead.subscribe(() => (count += 1));

      firstButtonIn('.sol-notification-panel__mark-all').click();

      expect(count).toBe(1);
    });

    it('closed emite desde el botón de cerrar del encabezado', () => {
      let count = 0;
      fixture.componentInstance.closed.subscribe(() => (count += 1));

      firstButtonIn('.sol-notification-panel__header-actions sol-icon-button').click();

      expect(count).toBe(1);
    });

    it('retryRequested emite desde el estado de error: nunca es un callejón sin salida', () => {
      fixture.componentRef.setInput('items', []);
      fixture.componentRef.setInput('error', true);
      fixture.detectChanges();

      let count = 0;
      fixture.componentInstance.retryRequested.subscribe(() => (count += 1));

      firstButtonIn('.sol-notification-panel__error sol-button').click();

      expect(count).toBe(1);
    });

    it('no emite nada por el solo hecho de renderizar', () => {
      let total = 0;
      const bump = () => (total += 1);
      fixture.componentInstance.itemSelected.subscribe(bump);
      fixture.componentInstance.markedRead.subscribe(bump);
      fixture.componentInstance.markedAllRead.subscribe(bump);
      fixture.componentInstance.retryRequested.subscribe(bump);
      fixture.componentInstance.closed.subscribe(bump);

      fixture.detectChanges();

      expect(total).toBe(0);
    });
  });

  // ------------------------------------------------- presentación derivada

  describe('presentación derivada', () => {
    it('marca visualmente las no leídas y les pone el punto indicador', () => {
      fixture.componentRef.setInput('items', sample());
      fixture.detectChanges();

      const unread = host().querySelectorAll('.sol-notification-panel__item--unread');
      expect(unread).toHaveLength(2);
      expect(host().querySelectorAll('.sol-notification-panel__dot')).toHaveLength(2);
    });

    it('omite el tiempo cuando la marca es inválida o ausente, en vez de mostrar basura', () => {
      fixture.componentRef.setInput('items', [
        { id: 'a', title: 'Sin fecha' },
        { id: 'b', title: 'Fecha rota', timestamp: 'no-es-una-fecha' },
      ] satisfies SolNotificationItem[]);
      fixture.detectChanges();

      expect(fixture.componentInstance.rows().map((row) => row.timeLabel)).toEqual(['', '']);
      expect(host().querySelectorAll('.sol-notification-panel__time')).toHaveLength(0);
    });

    it('resuelve el tiempo relativo por tramos (ahora / minutos / horas / días)', () => {
      const now = Date.now();
      fixture.componentRef.setInput('items', [
        { id: 'now', title: 'a', timestamp: now - 5_000 },
        { id: 'min', title: 'b', timestamp: now - 20 * 60_000 },
        { id: 'hour', title: 'c', timestamp: now - 5 * 3_600_000 },
        { id: 'day', title: 'd', timestamp: now - 3 * 86_400_000 },
      ] satisfies SolNotificationItem[]);
      fixture.detectChanges();

      const labels = fixture.componentInstance.rows().map((row) => row.timeLabel);
      expect(labels[0]).toBe('Justo ahora');
      // El stub del catálogo no interpola: se verifica el tramo, no el número.
      expect(labels[1]).toContain('min');
      expect(labels[2]).toContain('h');
      expect(labels[3]).toContain('d');
      expect(new Set(labels).size).toBe(4);
    });

    it('el tono por defecto de la etiqueta de tipo es neutral', () => {
      fixture.componentRef.setInput('items', [
        { id: 'x', title: 'Sin tono', typeLabel: 'Aviso' },
      ] satisfies SolNotificationItem[]);
      fixture.detectChanges();

      expect(fixture.componentInstance.rows()[0].tone).toBe('neutral');
    });

    it('las claves del estado vacío son sustituibles (vacío por filtro del consumidor)', () => {
      fixture.componentRef.setInput('items', []);
      fixture.componentRef.setInput('emptyTitleKey', 'shared.timeline.emptyState');
      fixture.componentRef.setInput('emptyDescriptionKey', '');
      fixture.detectChanges();

      expect(host().querySelector('sol-empty-state')!.textContent).toContain(
        'No hay elementos para mostrar',
      );
    });

    it('expone role="dialog" con etiqueta accesible', () => {
      fixture.detectChanges();

      const dialog = host().querySelector<HTMLElement>('[role="dialog"]')!;
      expect(dialog.getAttribute('aria-label')).toBe('Centro de notificaciones');
    });
  });
});
