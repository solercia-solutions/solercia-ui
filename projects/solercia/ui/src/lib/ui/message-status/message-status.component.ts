import {
  Component,
  ChangeDetectionStrategy,
  computed,
  input,
} from '@angular/core';
import { injectSolI18n } from '../../i18n/inject-sol-i18n';
import { SolIconComponent, type SolIconName } from '../icon/icon.component';

export type SolMessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

/** Ícono del registry por estado — NUNCA SVG inline (spec: solercia-ui-vocero-atoms). */
const STATUS_ICON: Record<SolMessageStatus, SolIconName> = {
  pending: 'clock',
  sent: 'check',
  delivered: 'double-check',
  read: 'double-check', // mismo ícono que delivered — la marca lo distingue por color (ver tone)
  failed: 'exclamation-triangle',
};

/** `read` usa el color de marca (primary); el resto, tonos neutros/semánticos. */
const STATUS_COLOR: Record<SolMessageStatus, string> = {
  pending: 'var(--sol-color-text-muted, #94a3b8)',
  sent: 'var(--sol-color-text-muted, #94a3b8)',
  delivered: 'var(--sol-color-text-secondary, #64748b)',
  read: 'var(--sol-color-primary, #2563eb)',
  failed: 'var(--sol-color-danger, #ef4444)',
};

/**
 * `sol-message-status` — ticks de estado de un mensaje (spec:
 * solercia-ui-vocero-atoms), inspirado en el patrón de WhatsApp. Genérico:
 * no sabe qué es un "mensaje" de dominio, solo un estado de entrega.
 *
 * `read` reutiliza el MISMO ícono `double-check` que `delivered` — la
 * diferencia visual es el color (token de marca `--sol-color-primary`),
 * igual que WhatsApp distingue el doble-check gris del azul.
 */
@Component({
  selector: 'sol-message-status',
  standalone: true,
  imports: [SolIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="sol-message-status" role="img" [style.color]="color()" [attr.aria-label]="statusLabel()">
      <sol-icon [name]="iconName()" size="sm" />
    </span>
  `,
  styles: `
    :host {
      display: inline-flex;
    }

    .sol-message-status {
      display: inline-flex;
      align-items: center;
    }
  `,
})
export class SolMessageStatusComponent {
  private readonly i18n = injectSolI18n();

  readonly status = input.required<SolMessageStatus>();

  readonly iconName = computed(() => STATUS_ICON[this.status()]);

  readonly color = computed(() => STATUS_COLOR[this.status()]);

  readonly statusLabel = computed(() => {
    this.i18n.activeLang();
    return this.i18n.translate(`shared.messageStatus.${this.status()}`);
  });
}
