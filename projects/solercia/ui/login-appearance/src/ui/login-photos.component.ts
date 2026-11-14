import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import {
  LOGIN_DEFAULT_EFFECT,
  LOGIN_DEFAULT_TRANSITION,
  LOGIN_INTERVAL_DEFAULT_MS,
  type LoginEffect,
  type LoginTransition,
} from '../model/login-appearance.model';

/** The background animation outlasts the interval to cover each photo on its way out. */
const ANIMATION_TAIL_MS = 2000;

/**
 * Full-screen photos of the login. The effect (what happens to the photo while in front) and the
 * transition (how the next one comes in) are independent. It is decorative, so it is hidden from
 * screen readers. Whoever asks for reduced motion sees the first photo, still. Photo URLs come from
 * the theme only (`meta.login.images`, already normalized).
 */
@Component({
  standalone: true,
  selector: 'sol-login-photos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', '[style.--sol-login-photo-duration]': 'duration()' },
  template: `
    @for (photo of photos(); track photo; let i = $index) {
      <img
        data-testid="login-photo"
        [class]="'photo photo--' + effect() + ' enter--' + transition()"
        [class.photo--active]="i === active()"
        [class.photo--leaving]="i === previous()"
        [src]="photo"
        alt=""
      />
    }
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      overflow: hidden;
      background-image: var(--sol-auth-hero-bg, none);
      background-color: var(--sol-color-primary);
    }

    .photo {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      opacity: 0;
      transition: opacity 1.6s var(--sol-ease, ease), filter 1.6s var(--sol-ease, ease);
      will-change: opacity, transform;
    }

    .photo:nth-of-type(4n + 1) { --sol-login-move-x: -3%; --sol-login-move-y: -1.5%; }
    .photo:nth-of-type(4n + 2) { --sol-login-move-x: 3%; --sol-login-move-y: -2%; }
    .photo:nth-of-type(4n + 3) { --sol-login-move-x: -2%; --sol-login-move-y: 2%; }
    .photo:nth-of-type(4n + 4) { --sol-login-move-x: 3%; --sol-login-move-y: 1.5%; }

    .photo--active { opacity: 1; }

    /* Same animation on both classes: going from active to leaving does not restart it. */
    .photo--zoom.photo--active,
    .photo--zoom.photo--leaving {
      animation: sol-login-zoom-in var(--sol-login-photo-duration, 9s) linear forwards;
    }

    .photo--focus.photo--active,
    .photo--focus.photo--leaving {
      animation: sol-login-zoom-out var(--sol-login-photo-duration, 9s) cubic-bezier(0.2, 0.6, 0.3, 1) forwards;
    }

    /* The transition only uses filter and opacity: it never fights the effect transform. */
    .enter--focus { filter: blur(18px) brightness(1.25); }
    .enter--focus.photo--active { filter: none; }

    @keyframes sol-login-zoom-in {
      from { transform: scale(1.04); }
      to { transform: scale(1.2) translate(var(--sol-login-move-x), var(--sol-login-move-y)); }
    }

    @keyframes sol-login-zoom-out {
      from { transform: scale(1.22); }
      to { transform: scale(1.02); }
    }

    @media (prefers-reduced-motion: reduce) {
      .photo { transition: none; filter: none; }
      .photo--active,
      .photo--leaving { animation: none !important; }
    }
  `,
})
export class SolLoginPhotosComponent {
  readonly photos = input.required<readonly string[]>();
  readonly effect = input<LoginEffect>(LOGIN_DEFAULT_EFFECT);
  readonly transition = input<LoginTransition>(LOGIN_DEFAULT_TRANSITION);
  readonly intervalMs = input(LOGIN_INTERVAL_DEFAULT_MS);

  /** Index of the photo in front after each change. */
  readonly activePhoto = output<number>();

  protected readonly active = signal(0);
  protected readonly previous = signal<number | null>(null);
  protected readonly duration = computed(() => `${this.intervalMs() + ANIMATION_TAIL_MS}ms`);

  private timer: ReturnType<typeof setInterval> | undefined;

  /** Reschedules when the list or the interval change: the theme preview edits them live. */
  private readonly carousel = effect(() => {
    const total = this.photos().length;
    const interval = this.intervalMs();
    this.stop();
    if (untracked(this.active) >= total) this.active.set(0);
    if (total < 2 || globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    this.timer = setInterval(() => this.advance(), interval);
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  private stop(): void {
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
  }

  private advance(): void {
    this.previous.set(this.active());
    this.active.update(current => (current + 1) % this.photos().length);
    this.activePhoto.emit(this.active());
  }
}
