export type AdjKey =
  | 'exposure' | 'brilliance' | 'highlights' | 'shadows' | 'contrast' | 'brightness' | 'black'
  | 'saturation' | 'vibrance' | 'warmth' | 'tint' | 'sharpness' | 'definition' | 'noise' | 'vignette';

export interface Adjust { key: AdjKey; name: string; short: string; min: number }

export const ADJUSTS: Adjust[] = [
  { key: 'exposure',   name: 'Exposure',        short: 'EXP',  min: -100 },
  { key: 'brilliance', name: 'Brilliance',       short: 'BRIL', min: -100 },
  { key: 'highlights', name: 'Highlights',       short: 'HIGH', min: -100 },
  { key: 'shadows',    name: 'Shadows',          short: 'SHAD', min: -100 },
  { key: 'contrast',   name: 'Contrast',         short: 'CONT', min: -100 },
  { key: 'brightness', name: 'Brightness',       short: 'BRIG', min: -100 },
  { key: 'black',      name: 'Black Point',      short: 'BLK',  min: -100 },
  { key: 'saturation', name: 'Saturation',       short: 'SAT',  min: -100 },
  { key: 'vibrance',   name: 'Vibrance',         short: 'VIB',  min: -100 },
  { key: 'warmth',     name: 'Warmth',           short: 'WARM', min: -100 },
  { key: 'tint',       name: 'Tint',             short: 'TINT', min: -100 },
  { key: 'sharpness',  name: 'Sharpness',        short: 'SHRP', min: 0 },
  { key: 'definition', name: 'Definition',       short: 'DEF',  min: 0 },
  { key: 'noise',      name: 'Noise Reduction',  short: 'NR',   min: 0 },
  { key: 'vignette',   name: 'Vignette',         short: 'VIG',  min: -100 },
];

type Six = [number, number, number, number, number, number];
type RGB = [number, number, number];

/** Preset numbers are fractions of a full slider (-1..1). Hue bands: red, yellow, green, cyan, blue, magenta. */
export interface Preset {
  id: string; name: string; cat: string; sub: string;
  t?: Partial<Record<AdjKey | 'fade' | 'shoulder', number>>;
  hue?: Six; sat?: Six; lum?: Six;
  split?: { s?: RGB; sa?: number; h?: RGB; ha?: number };
  mono?: { mix: RGB; tone: RGB };
  grain?: number; hal?: number; ca?: number; sharp?: number;
}

export const PRESETS: Preset[] = [
  // ── original ──────────────────────────────────────────────────────────
  { id: 'original', name: 'Original', cat: 'all', sub: 'As shot' },

  // ── film ──────────────────────────────────────────────────────────────
  { id: 'wildolive', name: 'Wild Olive', cat: 'film', sub: 'Olive greens, deep blue shadow',
    t: { contrast: .14, saturation: -.06, warmth: .06, shadows: .08, fade: .22 },
    hue: [.05, .25, .3, 0, 0, 0], sat: [0, -.1, -.2, 0, .12, 0],
    split: { s: [.12, .24, .5], sa: .4, h: [1, .86, .6], ha: .22 }, grain: .12 },

  { id: 'classicneg', name: 'Classic Neg', cat: 'film', sub: 'Hard tone, teal shadow',
    t: { contrast: .3, saturation: -.18, highlights: -.25, shadows: -.12, fade: .18, shoulder: .14 },
    hue: [-.15, .2, .45, 0, -.1, 0], sat: [-.08, -.12, -.2, -.1, -.15, -.25],
    split: { s: [.1, .45, .45], sa: .45, h: [1, .76, .78], ha: .25 }, grain: .1 },

  { id: 'velvet', name: 'Velvet', cat: 'film', sub: 'Saturated slide film',
    t: { contrast: .3, saturation: .32, vibrance: .2, black: .12, highlights: -.1 },
    hue: [0, -.05, .05, 0, .05, 0], lum: [0, 0, -.1, 0, -.15, 0] },

  { id: 'harvest', name: 'Harvest', cat: 'film', sub: 'Warm consumer film, golden cast',
    t: { warmth: .28, saturation: .1, contrast: .1, fade: .14 },
    hue: [0, -.15, .15, 0, 0, 0], split: { h: [1, .8, .4], ha: .3 }, grain: .18 },

  { id: 'expired', name: 'Expired', cat: 'film', sub: 'Faded, shifted, a little magenta',
    t: { fade: .4, contrast: -.15, saturation: -.2, tint: .18, warmth: .12, shoulder: .2 },
    split: { s: [.35, .15, .45], sa: .35 }, grain: .3 },

  { id: 'superia', name: 'Superia', cat: 'film', sub: 'Natural everyday, cyan in shadow',
    t: { saturation: -.05, warmth: .08, contrast: .08, highlights: -.1, fade: .1 },
    hue: [-.05, .1, .2, .08, 0, 0], sat: [0, -.05, -.12, .05, 0, 0],
    split: { s: [.1, .4, .45], sa: .3 }, grain: .1 },

  { id: 'lomochrome', name: 'LomoChrome', cat: 'film', sub: 'Wild saturation, Lomo crossfade',
    t: { saturation: .3, contrast: .2, vibrance: .15, warmth: .05, fade: .08 },
    hue: [.1, -.25, .3, 0, .1, 0], sat: [.1, .15, .2, 0, .1, .1], grain: .22 },

  // ── cinema ────────────────────────────────────────────────────────────
  { id: 'chrome', name: 'Chrome', cat: 'cinema', sub: 'Muted, documentary realism',
    t: { contrast: .35, saturation: -.32, shadows: -.22, black: .14, highlights: -.12 },
    sat: [.05, -.2, -.3, -.15, -.25, -.2],
    split: { s: [.16, .24, .34], sa: .25, h: [1, .9, .78], ha: .15 }, sharp: .2 },

  { id: 'fxcine', name: 'FX Cine', cat: 'cinema', sub: 'Sony-style cine, kind to skin',
    t: { contrast: -.08, highlights: -.35, shadows: .12, saturation: -.05, warmth: .04, fade: .1, shoulder: .1 },
    sat: [.05, 0, -.1, -.1, 0, 0], lum: [.12, .05, 0, 0, 0, 0],
    split: { s: [.1, .35, .42], sa: .25, h: [1, .78, .55], ha: .2 } },

  { id: 'loggrade', name: 'Log Grade', cat: 'cinema', sub: 'Flat, lifted, filmic base',
    t: { contrast: -.3, saturation: -.22, fade: .45, shoulder: .22, highlights: -.2, shadows: .22 },
    split: { s: [.2, .4, .45], sa: .25, h: [1, .9, .75], ha: .12 } },

  { id: 'tealamber', name: 'Teal & Amber', cat: 'cinema', sub: 'Blockbuster split tone',
    t: { contrast: .18, saturation: .04, vignette: .15 },
    hue: [.08, -.2, .35, 0, -.1, 0],
    split: { s: [0, .45, .55], sa: .7, h: [1, .62, .25], ha: .45 } },

  { id: 'bleach', name: 'Bleach', cat: 'cinema', sub: 'Bleach bypass: gritty, desaturated',
    t: { contrast: .4, saturation: -.45, brightness: .08, black: .15, highlights: .05 },
    split: { s: [.08, .08, .15], sa: .2, h: [.9, .9, .85], ha: .1 }, grain: .1 },

  { id: 'nordic', name: 'Nordic', cat: 'cinema', sub: 'Cool, airy Scandinavian moodboard',
    t: { warmth: -.2, saturation: -.25, highlights: -.1, brightness: .08, fade: .2, contrast: -.08 },
    hue: [0, 0, 0, .1, 0, 0], split: { s: [.15, .35, .45], sa: .3 } },

  // ── portrait ──────────────────────────────────────────────────────────
  { id: 'proneg', name: 'Pro Neg', cat: 'portrait', sub: 'Soft negative, honest skin',
    t: { contrast: -.12, saturation: -.08, warmth: .05, highlights: -.2, shadows: .18, fade: .1 },
    sat: [-.05, -.08, -.12, 0, -.1, 0], lum: [.12, .08, 0, 0, 0, 0] },

  { id: 'studio400', name: 'Studio 400', cat: 'portrait', sub: 'Pastel highlights, honest tones',
    t: { warmth: .1, contrast: -.06, saturation: -.12, highlights: -.15, fade: .1, brightness: .08 },
    lum: [.1, .1, 0, 0, 0, 0], grain: .12 },

  { id: 'blush', name: 'Blush', cat: 'portrait', sub: 'Warm rose highlights, creamy shadows',
    t: { warmth: .15, saturation: -.08, highlights: -.12, brightness: .05, fade: .12 },
    hue: [-.08, 0, 0, 0, 0, .08], sat: [.05, 0, 0, 0, -.08, .08], lum: [.1, .08, 0, 0, 0, 0] },

  { id: 'linen', name: 'Linen', cat: 'portrait', sub: 'Clean, airy high-key',
    t: { brightness: .15, contrast: -.15, saturation: -.18, highlights: -.2, fade: .15 },
    lum: [.12, .1, 0, 0, 0, 0] },

  { id: 'peach', name: 'Peach', cat: 'portrait', sub: 'Peachy warm editorial',
    t: { warmth: .2, saturation: .05, brightness: .05, highlights: -.15, fade: .08 },
    hue: [-.05, -.1, 0, 0, 0, .05], split: { h: [1, .8, .6], ha: .25 } },

  { id: 'azure', name: 'Azure', cat: 'portrait', sub: 'Cool editorial, desaturated skin',
    t: { warmth: -.15, saturation: -.2, highlights: -.1, contrast: .1, fade: .08 },
    hue: [0, 0, .1, .05, 0, 0] },

  // ── street ────────────────────────────────────────────────────────────
  { id: 'street', name: 'Street', cat: 'street', sub: 'Punchy contrast, cool shadows',
    t: { contrast: .3, saturation: -.1, black: .1, warmth: -.05, vignette: .2 },
    split: { s: [.1, .25, .45], sa: .35 }, sharp: .2 },

  { id: 'disposable', name: 'Disposable', cat: 'street', sub: 'Flash, green cast, hard light',
    t: { contrast: .35, saturation: .1, tint: -.15, exposure: .05, vignette: .35, black: .08 },
    grain: .3, ca: .25 },

  { id: 'summer', name: 'Summer 99', cat: 'street', sub: 'Sun-bleached and warm',
    t: { warmth: .22, brightness: .12, contrast: -.1, highlights: -.2, saturation: -.05, fade: .2 },
    split: { h: [1, .85, .55], ha: .4 }, hue: [0, 0, .25, 0, -.1, 0] },

  { id: 'copper', name: 'Copper', cat: 'street', sub: 'Warm copper-dusted urban',
    t: { warmth: .18, contrast: .2, saturation: -.05, black: .08, vignette: .18 },
    split: { s: [.15, .2, .4], sa: .35, h: [1, .7, .3], ha: .3 }, grain: .1 },

  { id: 'fog', name: 'Fog', cat: 'street', sub: 'Muted, gray, mysterious',
    t: { saturation: -.3, contrast: -.05, fade: .3, brightness: -.05 },
    split: { s: [.2, .3, .4], sa: .2 }, grain: .15 },

  // ── mono ──────────────────────────────────────────────────────────────
  { id: 'noir', name: 'Noir', cat: 'mono', sub: 'Hard black and white',
    t: { contrast: .45, black: .15, vignette: .3 },
    mono: { mix: [.35, .5, .15], tone: [1, 1, 1] }, grain: .2 },

  { id: 'silver', name: 'Silver', cat: 'mono', sub: 'Fine-grain, soft mono',
    t: { contrast: .1, highlights: -.15, shadows: .1 },
    mono: { mix: [.25, .6, .15], tone: [.99, 1, 1.03] }, grain: .12 },

  { id: 'darkroom', name: 'Darkroom', cat: 'mono', sub: 'Warm-toned fiber print',
    t: { contrast: .2, fade: .15 },
    mono: { mix: [.3, .55, .15], tone: [1.08, .98, .82] }, grain: .18 },

  { id: 'infra', name: 'Infra', cat: 'mono', sub: 'Pseudo-infrared, glowing light',
    t: { contrast: .2, brightness: .05, vignette: .1 },
    mono: { mix: [0, .92, .08], tone: [1.05, .98, .95] }, grain: .15 },

  { id: 'platinum', name: 'Platinum', cat: 'mono', sub: 'Soft platinum, luminous whites',
    t: { contrast: .08, highlights: -.2, shadows: .15, fade: .1 },
    mono: { mix: [.2, .65, .15], tone: [1.03, 1.02, .99] }, grain: .08 },

  // ── night ─────────────────────────────────────────────────────────────
  { id: 'neon', name: 'Neon Night', cat: 'night', sub: 'Electric magentas and cyans',
    t: { contrast: .25, saturation: .25, vibrance: .2, black: .1, vignette: .25, tint: .08 },
    hue: [0, 0, .2, 0, .15, 0], split: { s: [.25, .1, .5], sa: .4, h: [.4, 1, 1], ha: .2 }, hal: .25 },

  { id: 'nightglow', name: 'Night Glow', cat: 'night', sub: 'Cool balance, red halation',
    t: { warmth: -.3, tint: .05, contrast: .15, saturation: .05, fade: .08 },
    hal: .6, split: { s: [.05, .25, .5], sa: .3 }, grain: .2 },

  { id: 'bluehour', name: 'Blue Hour', cat: 'night', sub: 'Twilight, deep blues',
    t: { warmth: -.25, saturation: .08, contrast: .18, shadows: .08, brightness: -.08 },
    hue: [0, 0, 0, .05, -.05, 0], split: { s: [.08, .18, .5], sa: .5 }, grain: .15 },

  { id: 'ambercity', name: 'Amber City', cat: 'night', sub: 'Warm city lights, orange glow',
    t: { warmth: .3, contrast: .2, saturation: .08, vignette: .2 },
    split: { s: [.3, .2, .1], sa: .4, h: [1, .75, .3], ha: .3 }, hal: .3, grain: .15 },
];

export const PRESET: Record<string, Preset> = Object.fromEntries(PRESETS.map(p => [p.id, p]));

export const CATS: [string, string][] = [
  ['all', 'All'], ['film', 'Film'], ['cinema', 'Cinema'], ['street', 'Street'],
  ['portrait', 'Portrait'], ['mono', 'Mono'], ['night', 'Night'],
];

export const LEAKS = ['None', 'Ember', 'Prism', 'Burn', 'Haze', 'Cool', 'Twin'];
export interface GrainType { n: string; size: number; c: number; r: number }
export const GRAINS: GrainType[] = [
  { n: 'None', size: 1.3, c: 0, r: 0 }, { n: 'Fine', size: .8, c: 0, r: 0 }, { n: '35mm', size: 1.3, c: 0, r: 0 },
  { n: 'Push', size: 2.1, c: 0, r: 1 }, { n: 'Color', size: 1.3, c: 1, r: 0 }, { n: 'Rough', size: 2.6, c: .4, r: 1 },
];
export const TEXTURES = ['None', 'Dust', 'Scratch', 'Paper', 'Canvas', 'Worn'];
export const DITHERS = ['None', 'Bayer 2', 'Bayer 4', 'Bayer 8', 'Noise', 'Halftone', '1-Bit'];

export type FrameType = 'none' | 'b1' | 'p1' | 'p3' | 'p4' | 'pt1' | 'ex1' | 'fs1';
export const FRAMES: [FrameType, string][] = [
  ['none', 'None'], ['b1', 'B1'], ['p1', 'P1'], ['p3', 'P3'], ['p4', 'P4'], ['pt1', 'PT1'], ['ex1', 'EX1'], ['fs1', 'FS1'],
];
export const NEUTRALS: [string, string][] = [['cream', '#e8e5d9'], ['white', '#f7f6f1'], ['bone', '#d6cfbd'], ['ink', '#131311']];
export const ASPECT_OPTS: [string, string][] = [
  ['free', 'Free'], ['orig', 'Original'], ['1:1', 'Square'], ['4:5', '4:5'], ['3:4', '3:4'], ['2:3', '2:3'], ['16:9', '16:9'], ['9:16', '9:16'],
];
