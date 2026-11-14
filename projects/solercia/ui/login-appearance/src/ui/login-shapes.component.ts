import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, signal } from '@angular/core';
import { hasLoginShapes, type LoginBackground, type LoginPosition } from '../model/login-appearance.model';
import {
  CIRCLES_CENTER,
  CIRCLES_SIDE,
  FACETS,
  MOSAIC_SHAPES,
  SHAPE_CANVAS,
  SHAPE_FORM_BOX,
  SHAPE_TONES,
  SPLIT_CIRCLE,
  SPLIT_CIRCLE_CENTER,
  mirror,
  type Shape,
} from './login-shapes.data';

const CELL = 64;
const INITIAL_SCALE = 1.15;
/** Mosaic columns repeated towards the edge so it does not fall short on wide screens. */
const REPEATED_COLUMN = 17 * CELL;
const COLUMN_SHIFT = 3 * CELL;
/** Mosaic dimming per shape: a shared `opacity` would break the blend with the photo. */
const MOSAIC_OPACITY = 0.88;

interface Composition {
  readonly shapes: readonly Shape[];
  /** Canvas point that matches the center of the form. */
  readonly anchor: readonly [number, number];
}

const mirrored = (shapes: readonly Shape[]): readonly Shape[] => shapes.map(s => mirror(s, SHAPE_CANVAS.width));

function fullMosaic(): readonly Shape[] {
  const extra = MOSAIC_SHAPES.filter(s => s.l >= REPEATED_COLUMN).map(s => ({ ...s, l: s.l + COLUMN_SHIFT }));
  return [...MOSAIC_SHAPES, ...extra];
}

/** The mosaic is drawn on one side: centered, its sparse half repeats mirrored outwards. */
function centeredMosaic(): readonly Shape[] {
  const edge = 15 * CELL;
  const half = MOSAIC_SHAPES.filter(s => s.l < edge);
  return [...half.map(s => ({ ...s, l: s.l - 320 })), ...half.map(s => mirror(s, 1600))];
}

function composition(background: LoginBackground, position: LoginPosition): Composition {
  const left = position === 'left';
  switch (background) {
    case 'triangles':
      if (position === 'center') return { shapes: centeredMosaic(), anchor: [640, 400] };
      return left ? { shapes: mirrored(fullMosaic()), anchor: [320, 400] } : { shapes: fullMosaic(), anchor: [960, 400] };
    case 'split-circle':
      if (position === 'center') return { shapes: SPLIT_CIRCLE_CENTER, anchor: [640, 400] };
      return left ? { shapes: SPLIT_CIRCLE, anchor: [282, 478] } : { shapes: mirrored(SPLIT_CIRCLE), anchor: [998, 478] };
    case 'facets':
      return left ? { shapes: mirrored(FACETS), anchor: [640, 408] } : { shapes: FACETS, anchor: [640, 408] };
    case 'circles':
      if (position === 'center') return { shapes: CIRCLES_CENTER, anchor: [650, 410] };
      return left ? { shapes: mirrored(CIRCLES_SIDE), anchor: [320, 400] } : { shapes: CIRCLES_SIDE, anchor: [960, 400] };
    default:
      return { shapes: [], anchor: [0, 0] };
  }
}

function shapeStyle(s: Shape, ox: number, oy: number, dimming = 1): Record<string, string> {
  const style: Record<string, string> = {
    left: `${s.l - ox}em`,
    top: `${s.t - oy}em`,
    width: `${s.w}em`,
    height: `${s.h}em`,
  };
  if (s.circle) style['border-radius'] = '50%';
  if (s.clip) style['clip-path'] = `polygon(${s.clip.map(([x, y]) => `${x}em ${y}em`).join(', ')})`;
  if (s.tone) style['background'] = SHAPE_TONES[s.tone];
  if (s.op !== undefined) style['opacity'] = String(s.op * dimming);
  if (s.multiply) style['mix-blend-mode'] = 'multiply';
  if (s.ring) {
    const color = s.ring.tone === 'text' ? 'var(--sol-color-text-primary)' : SHAPE_TONES[s.ring.tone];
    style['border'] = `1.5em solid ${color}`;
    style['box-sizing'] = 'border-box';
    style['opacity'] = String(s.ring.op);
  }
  if (s.gradient) {
    style['background'] = `radial-gradient(circle at ${s.gradient.side}% 50%, color-mix(in srgb, ${SHAPE_TONES.t} 55%, transparent), transparent 45%)`;
  }
  return style;
}

/**
 * Shapes of the background: they are the form container. They live inside the card, anchored to
 * its center, and scale with the real form box (see `SHAPE_FORM_BOX`). They are `div`s with
 * `clip-path` and `mix-blend-mode`; the blend with the photo only works when no ancestor creates its
 * own stacking context, which is why `em` does the scaling instead of `transform`. Below 768 px
 * they are hidden and the card uses the simple panel.
 */
@Component({
  standalone: true,
  selector: 'sol-login-shapes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[style.font-size.px]': 'effectiveScale()',
    '[class.fixed-scale]': 'fixedScale() !== null',
  },
  template: `
    @for (shape of shapes(); track $index) {
      <div class="s" [style]="shape.style">
        @if (shape.child; as child) {
          <div class="s" [style]="child"></div>
        }
      </div>
    }
  `,
  styles: `
    :host {
      position: absolute;
      left: 50%;
      top: 50%;
      width: 0;
      height: 0;
      pointer-events: none;
    }

    .s { position: absolute; }

    @media (max-width: 767.98px) {
      :host(:not(.fixed-scale)) { display: none; }
    }
  `,
})
export class SolLoginShapesComponent {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  readonly background = input.required<LoginBackground>();
  readonly position = input.required<LoginPosition>();
  /** Explicit scale for editor thumbnails, which are not anchored to a form. */
  readonly fixedScale = input<number | null>(null);

  private readonly scale = signal(INITIAL_SCALE);
  protected readonly effectiveScale = computed(() => this.fixedScale() ?? this.scale());

  protected readonly shapes = computed(() => {
    if (!hasLoginShapes(this.background())) return [];
    const { shapes, anchor } = composition(this.background(), this.position());
    const dimming = this.background() === 'triangles' ? MOSAIC_OPACITY : 1;
    return shapes.map(s => ({
      style: shapeStyle(s, anchor[0], anchor[1], dimming),
      child: s.child ? shapeStyle(s.child, 0, 0) : null,
    }));
  });

  constructor() {
    afterNextRender(() => this.observe());
  }

  private observe(): void {
    if (this.fixedScale() !== null || typeof ResizeObserver === 'undefined') return;
    const host = this.element.nativeElement;
    const card = host.parentElement;
    if (!card) return;
    const canvas = host.closest<HTMLElement>('[data-login-frame]');
    const measure = () => {
      const byBox = Math.max(card.offsetWidth / SHAPE_FORM_BOX.width, card.offsetHeight / SHAPE_FORM_BOX.height);
      // The mosaic goes edge to edge: besides holding the form it must cover the height.
      const byHeight = this.background() === 'triangles' && canvas ? canvas.clientHeight / SHAPE_CANVAS.height : 0;
      const scale = Math.max(byBox, byHeight);
      if (scale > 0) this.scale.set(scale);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(card);
    if (canvas) observer.observe(canvas);
    this.destroyRef.onDestroy(() => observer.disconnect());
  }
}
