/**
 * Geometry, tones and opacities of the shape backgrounds. Everything is expressed in a 1280×800
 * design frame; `login-shapes.component.ts` anchors it to the real form box.
 *
 * Every tone comes from the theme tokens, so each shape has its light and dark version with the
 * same structure.
 */
export type ShapeTone = 'a' | 'b' | 'c' | 'd' | 'e' | 'p' | 'q' | 'r' | 's' | 't' | 'u';

export const SHAPE_TONES: Readonly<Record<ShapeTone, string>> = {
  a: 'var(--sol-bg-surface)',
  b: 'color-mix(in srgb, var(--sol-bg-surface) 92%, var(--sol-color-text-primary))',
  c: 'color-mix(in srgb, var(--sol-bg-surface) 90%, var(--sol-bg-page))',
  d: 'var(--sol-bg-page)',
  e: 'color-mix(in srgb, var(--sol-bg-page) 92%, var(--sol-color-primary))',
  p: 'var(--sol-color-secondary)',
  q: 'var(--sol-color-primary)',
  r: 'color-mix(in srgb, var(--sol-color-primary) 72%, black)',
  s: 'color-mix(in srgb, var(--sol-color-secondary) 78%, white)',
  t: 'color-mix(in srgb, var(--sol-color-primary) 46%, var(--sol-bg-page))',
  u: 'color-mix(in srgb, var(--sol-color-primary) 24%, var(--sol-bg-page))',
};

export type Point = readonly [number, number];

/** One shape: a rectangle with an optional clip and, optionally, a child clipped by it. */
export interface Shape {
  readonly l: number;
  readonly t: number;
  readonly w: number;
  readonly h: number;
  readonly tone?: ShapeTone;
  readonly op?: number;
  /** `mix-blend-mode: multiply`. */
  readonly multiply?: boolean;
  readonly circle?: boolean;
  /** Polygon in the shape's own coordinates. */
  readonly clip?: readonly Point[];
  /** Stroke only (rings). */
  readonly ring?: { readonly tone: ShapeTone | 'text'; readonly op: number };
  /** Radial gradient with `side` = 0 or 100 (%). */
  readonly gradient?: { readonly side: number };
  readonly child?: Shape;
}

export const SHAPE_CANVAS = { width: 1280, height: 800 } as const;

/** Form box in the design, padding included: the reference to scale the shapes. */
export const SHAPE_FORM_BOX = { width: 412, height: 448 } as const;

const CELL = 64;

/** Mosaic: `column.row`, cell half (A or B), tone, opacity and `x` when it multiplies. */
const MOSAIC = `8.0Ba75 11.0Bb90 12.0Ap79x 12.0Bt83x 13.0Ab86 13.0Be79 14.0Aa74 14.0Br88x 15.0Ad77 15.0Bq62 16.0Aq78 16.0Bq65x
17.0Au76x 17.0Bt77 18.0Ap88x 18.0Bu67x 19.0Ae73 9.1At63 9.1Bu60 12.1Br58x 13.1Ap72 13.1Ba79 14.1Ae94 14.1Bc93
15.1Ae97 15.1Be93 16.1Ae94 16.1Be97 17.1Ab95 17.1Ba94 18.1Ap80 18.1Bc93 19.1Ad87 8.2Ae95 10.2Ae80 10.2Bt75x
11.2Aa88 11.2Br89 12.2Ae75 12.2Bq75 13.2Ae96 13.2Bd96 14.2Ad98 14.2Bc97 15.2Ac98 15.2Ba98 16.2Ad95 16.2Bc94
17.2Ab95 17.2Ba98 18.2Ac94 18.2Bb99 19.2Ae99 19.2Bb100 7.3Bb88 8.3Bt59x 9.3Ae75 9.3Bp64x 10.3Bb80 11.3Ar83
11.3Bc73 12.3Aa97 12.3Bd94 13.3Aa98 13.3Bc96 14.3Ae94 14.3Bc95 15.3Ad93 15.3Bc94 16.3Aa99 16.3Bb98 17.3Ac99
17.3Be99 18.3Ab97 18.3Ba96 19.3Ac96 19.3Bc98 10.4Bt89x 11.4At80 11.4Ba76 12.4Ab94 12.4Be99 13.4Ab98 13.4Bc96
14.4Ae97 14.4Be95 15.4Ab96 15.4Ba94 16.4Ac95 16.4Be99 17.4Aa98 17.4Be94 18.4Aa99 18.4Bd94 19.4Aa93 19.4Bb99
9.5Au56 10.5Bp88x 11.5Ab88 11.5Bc94 12.5Ad97 12.5Ba97 13.5Aa95 13.5Bb97 14.5Ae95 14.5Be93 15.5Ab96 15.5Bb98
16.5Ae94 16.5Be97 17.5Ae96 17.5Be99 18.5Ab99 18.5Be94 19.5Ab94 19.5Bd100 7.6Br88 8.6Bt71x 9.6Aq63x 9.6Bu71
10.6Ba85 11.6Bb100 12.6Ab97 12.6Be94 13.6Ad98 13.6Bb96 14.6Ac96 14.6Bc94 15.6Ad94 15.6Ba95 16.6Aa97 16.6Bd93
17.6Ad99 17.6Be93 18.6Ab95 18.6Bc99 19.6Ab93 19.6Be94 8.7Ap81x 9.7Br64 10.7Bt84 11.7Ab77 11.7Bt61 12.7Ab99
12.7Bc99 13.7Ae93 13.7Ba94 14.7Ad97 14.7Be97 15.7Ae99 15.7Be94 16.7Ac96 16.7Ba97 17.7Ab97 17.7Ba96 18.7Aa98
18.7Bb95 19.7Aa97 19.7Bc100 10.8Ar59x 10.8Bb80 11.8At60x 11.8Bt77x 12.8Ac94 12.8Be95 13.8Aa94 13.8Ba96 14.8Ad97
14.8Bc98 15.8Ab96 15.8Be98 16.8Ad97 16.8Bb99 17.8Ac100 17.8Ba100 18.8Ad94 18.8Ba99 19.8Ae98 19.8Bc95 9.9Ab85
10.9Ap73 11.9Ap89 11.9Br77x 12.9At78 12.9Ba98 13.9Ae97 13.9Bb94 14.9Aa96 14.9Bc93 15.9Ac98 15.9Be94 16.9Aa97
16.9Bc95 17.9Aa94 17.9Ba96 18.9Ab97 18.9Bc96 19.9Ab99 19.9Be96 10.10Bt84x 11.10Aa77 11.10Ba86 12.10Ap87 13.10Ad94
13.10Bd100 14.10Ac95 14.10Bc99 15.10Ab99 15.10Bd94 16.10Ab98 16.10Bd95 17.10Ac98 17.10Bb97 18.10Ad100 18.10Be97 19.10At61x
19.10Bq89x 9.11Ar84x 10.11Bu55x 11.11Bt77x 12.11Ad93 12.11Bb87 13.11Ap71x 13.11Bt73x 14.11Au64x 14.11Bb92 15.11Ad95 15.11Bc96
16.11Ac96 16.11Bc99 17.11Ae96 17.11Bb93 18.11Ae88 18.11Be75 19.11Ap81 19.11Br82x 9.12At55 12.12Aa87 12.12Bt66x 13.12At69x
14.12Bu77x 15.12At65 15.12Be84 16.12Ap65x 16.12Br55x 17.12Ad94 17.12Bp79 18.12Ad76 18.12Br62x 19.12At60x`;

const HALVES: Readonly<Record<string, readonly Point[]>> = {
  A: [
    [0, 0],
    [CELL, 0],
    [0, CELL],
  ],
  B: [
    [CELL, 0],
    [CELL, CELL],
    [0, CELL],
  ],
};

export const MOSAIC_SHAPES: readonly Shape[] = MOSAIC.split(/\s+/).map(token => {
  const m = /^(\d+)\.(\d+)([AB])([a-z])(\d+)(x?)$/.exec(token) as RegExpExecArray;
  return {
    l: Number(m[1]) * CELL,
    t: Number(m[2]) * CELL,
    w: CELL,
    h: CELL,
    clip: HALVES[m[3]],
    tone: m[4] as ShapeTone,
    op: Number(m[5]) / 100,
    multiply: m[6] === 'x',
  };
});

/** Loose triangle in canvas coordinates, with its own box so it does not over-paint. */
function triangle(p1: Point, p2: Point, p3: Point, tone: ShapeTone, op: number, multiply = false): Shape {
  const xs = [p1[0], p2[0], p3[0]];
  const ys = [p1[1], p2[1], p3[1]];
  const l = Math.min(...xs);
  const t = Math.min(...ys);
  const w = Math.max(...xs) - l;
  const h = Math.max(...ys) - t;
  return { l, t, w, h, tone, op, multiply, clip: [p1, p2, p3].map(([a, b]) => [a - l, b - t] as const) };
}

const circle = (l: number, t: number, d: number, tone: ShapeTone, op: number, multiply = false): Shape => ({
  l,
  t,
  w: d,
  h: d,
  circle: true,
  tone,
  op,
  multiply,
});

/** Full-canvas frame that clips its child (used to split circles). */
const clipped = (clip: readonly Point[], child: Shape): Shape => ({ l: 0, t: 0, w: SHAPE_CANVAS.width, h: SHAPE_CANVAS.height, clip, child });

const rect = (l: number, t: number, r: number, b: number): readonly Point[] => [
  [l, t],
  [r, t],
  [r, b],
  [l, b],
];

/** Centered facets. */
export const FACETS: readonly Shape[] = [
  triangle([630, 410], [440, 120], [720, 90], 'd', 0.95),
  triangle([630, 410], [720, 90], [880, 190], 'a', 0.95),
  triangle([630, 410], [880, 190], [860, 600], 'c', 0.95),
  triangle([630, 410], [860, 600], [760, 720], 'b', 0.95),
  triangle([630, 410], [760, 720], [450, 690], 'e', 0.95),
  triangle([630, 410], [450, 690], [410, 380], 'd', 0.95),
  triangle([630, 410], [410, 380], [440, 120], 'a', 0.95),
  triangle([440, 120], [720, 90], [560, 0], 'q', 0.75, true),
  triangle([720, 90], [880, 190], [960, 40], 't', 0.9),
  triangle([880, 190], [860, 600], [1010, 380], 'r', 0.75, true),
  triangle([860, 600], [760, 720], [940, 790], 'b', 0.85),
  triangle([760, 720], [450, 690], [600, 800], 'q', 0.6, true),
  triangle([450, 690], [410, 380], [300, 620], 't', 0.82),
  triangle([410, 380], [440, 120], [290, 260], 'r', 0.7, true),
  triangle([290, 260], [410, 380], [230, 420], 'u', 0.55),
  triangle([960, 40], [880, 190], [1060, 170], 'p', 0.5, true),
  triangle([1010, 380], [860, 600], [1080, 560], 't', 0.55, true),
  triangle([300, 620], [450, 690], [330, 770], 'q', 0.45, true),
  triangle([560, 0], [720, 90], [700, 0], 'u', 0.6),
  triangle([1060, 170], [1010, 380], [1130, 300], 'r', 0.35, true),
  triangle([230, 420], [300, 620], [180, 560], 't', 0.4, true),
];

/** Circles with the form in the center. */
export const CIRCLES_CENTER: readonly Shape[] = [
  circle(680, 10, 460, 'q', 0.72, true),
  circle(190, 460, 340, 'r', 0.68, true),
  circle(240, 70, 720, 't', 0.85),
  clipped(rect(640, 610, 1280, 1600), circle(620, 350, 520, 'u', 0.62)),
  circle(330, 90, 640, 'a', 0.98),
  clipped(rect(0, 0, 650, 800), circle(330, 90, 640, 'b', 0.98)),
  clipped(rect(0, 410, 650, 800), circle(330, 90, 640, 'c', 0.98)),
  circle(860, 300, 240, 'p', 0.45, true),
  { l: 250, t: 10, w: 800, h: 800, circle: true, ring: { tone: 'p', op: 0.65 }, clip: rect(0, 0, 800, 368) },
  { l: 648, t: -22, w: 524, h: 524, circle: true, ring: { tone: 'text', op: 0.35 }, clip: rect(262, 0, 524, 524) },
  circle(902, 92, 76, 'p', 0.9),
  circle(280, 242, 40, 't', 0.95),
  circle(1016, 676, 28, 's', 0.9),
];

/** Circles with the form on the right. */
export const CIRCLES_SIDE: readonly Shape[] = [
  circle(1078, 88, 144, 'r', 0.6, true),
  circle(664, 104, 592, 'a', 0.97),
  clipped(rect(0, 0, 960, 800), circle(664, 104, 592, 'b', 0.97)),
  // Lower than a tight fit: real forms are taller and the circle would cover the footer.
  circle(640, 600, 172, 'q', 0.62, true),
  { l: 630, t: 70, w: 660, h: 660, circle: true, ring: { tone: 'p', op: 0.6 }, clip: rect(0, 0, 660, 400) },
  circle(641, 291, 18, 's', 0.9),
  circle(1204, 684, 12, 'p', 0.9),
];

const CUT_TOP: readonly Point[] = [
  [-600, -600],
  [720, -600],
  [720, 30],
  [-600, 433],
];
const CUT_BOTTOM: readonly Point[] = [
  [-600, 445],
  [720, 42],
  [720, 1600],
  [-600, 1600],
];
const BIG_CIRCLE = { l: -680, t: -200, w: 1240, h: 1240, circle: true } as const;

/** Split circle with the form on the left. */
export const SPLIT_CIRCLE: readonly Shape[] = [
  clipped(CUT_TOP, { ...BIG_CIRCLE, l: -698, t: -214, tone: 'q', op: 0.92 }),
  clipped(CUT_BOTTOM, { ...BIG_CIRCLE, tone: 'a', op: 0.98 }),
  clipped(CUT_BOTTOM, { ...BIG_CIRCLE, gradient: { side: 100 } }),
  triangle([598, 118], [640, 92], [626, 150], 'p', 0.9),
  triangle([660, 170], [690, 154], [684, 190], 't', 0.9),
];

const CUT_CENTER_TOP: readonly Point[] = [
  [-600, -600],
  [1880, -600],
  [1880, 4],
  [-600, 236],
];
const CUT_CENTER_BOTTOM: readonly Point[] = [
  [-600, 248],
  [1880, 16],
  [1880, 1600],
  [-600, 1600],
];

/** Centered split circle: the same circle surrounds the form and the diagonal cut passes above it. */
export const SPLIT_CIRCLE_CENTER: readonly Shape[] = [
  clipped(CUT_CENTER_TOP, circle(192, -44, 860, 'q', 0.92)),
  clipped(CUT_CENTER_BOTTOM, circle(210, -30, 860, 'a', 0.98)),
  triangle([1040, 196], [1082, 170], [1068, 228], 'p', 0.9),
  triangle([1102, 248], [1132, 232], [1126, 268], 't', 0.9),
];

/** Mirrors a shape over an axis `2 * center`; children mirror over their parent. */
export function mirror(s: Shape, width: number): Shape {
  return {
    ...s,
    l: width - s.l - s.w,
    clip: s.clip?.map(([x, y]) => [s.w - x, y] as const),
    gradient: s.gradient ? { side: 100 - s.gradient.side } : undefined,
    child: s.child ? mirror(s.child, s.w) : undefined,
  };
}
