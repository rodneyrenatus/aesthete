import { ADJUSTS, AdjKey, FrameType, GRAINS, PRESET } from './catalog';

export type Tune = Record<AdjKey, number>;
export interface Analog {
  leak: { type: number; amt: number; shift: number };
  grain: { type: number; amt: number; size: number };
  texture: { type: number; amt: number };
  dither: { type: number; mix: number; levels: number; scale: number };
  motion: { amt: number; angle: number };
  lens: { ca: number; halation: number; fade: number };
}
export interface Crop { x: number; y: number; w: number; h: number }
export interface Geo { rot: number; flip: boolean; angle: number; crop: Crop; aspect: string }
export interface Frame {
  type: FrameType; color: string; ckey: string; auto: boolean; thick: number;
  caption: string; date: string; cam: string; specs: string; palette: boolean;
}
export interface EditState { preset: string; strength: number; tune: Tune; analog: Analog; geo: Geo; frame: Frame }
export interface Meta { cam?: string; specs?: string; date?: string }

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const defTune = (): Tune => Object.fromEntries(ADJUSTS.map(a => [a.key, 0])) as Tune;
export const defAnalog = (): Analog => ({
  leak: { type: 0, amt: 70, shift: 0 }, grain: { type: 0, amt: 45, size: 50 }, texture: { type: 0, amt: 60 },
  dither: { type: 0, mix: 100, levels: 4, scale: 3 }, motion: { amt: 0, angle: 0 }, lens: { ca: 0, halation: 0, fade: 0 },
});
export const defGeo = (): Geo => ({ rot: 0, flip: false, angle: 0, crop: { x: 0, y: 0, w: 1, h: 1 }, aspect: 'free' });
export const defFrame = (): Frame => ({
  type: 'none', color: '#e8e5d9', ckey: 'cream', auto: true, thick: 45, caption: '', date: todayISO(),
  cam: '', specs: '', palette: true,
});
export const defState = (): EditState => ({ preset: 'original', strength: 100, tune: defTune(), analog: defAnalog(), geo: defGeo(), frame: defFrame() });
export const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));

/* ------------------------------------------------------------------ shader params */
export interface GeoU { uRot: number; uFlip: number; uAngle: number; uScale: number; uFrame: [number, number]; uCrop: [number, number, number, number] }

export function geoParams(geo: Geo, srcW: number, srcH: number): GeoU {
  const rot = ((geo.rot % 4) + 4) % 4;
  const fw = rot % 2 ? srcH : srcW, fh = rot % 2 ? srcW : srcH;
  const a = geo.angle * Math.PI / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
  const scale = Math.max((fw * c + fh * s) / fw, (fw * s + fh * c) / fh);
  const cr = geo.crop;
  return { uRot: rot, uFlip: geo.flip ? 1 : 0, uAngle: a, uScale: scale, uFrame: [fw, fh], uCrop: [cr.x, cr.y, cr.w, cr.h] };
}

export type Uniforms = Record<string, number | number[]>;
const band = (arr: number[] | undefined, k: number, i: number) => ((arr && arr[i]) || 0) * k;

export function computeParams(st: EditState, gu: GeoU, original = false): { A: Uniforms; B: Uniforms } {
  const pr = original ? PRESET.original : (PRESET[st.preset] || PRESET.original);
  const k = original ? 0 : st.strength / 100;
  const t = original ? defTune() : st.tune;
  const pt = pr.t || {};
  const g = (key: AdjKey) => (t[key] || 0) / 100 + (pt[key] || 0) * k;
  const an = original ? defAnalog() : st.analog;
  const gr = GRAINS[an.grain.type] || GRAINS[0];
  const grainAmt = Math.max(an.grain.type ? an.grain.amt / 100 : 0, (pr.grain || 0) * k);
  const sp = pr.split || {};
  const mono = pr.mono;
  return {
    A: {
      ...gu,
      uNR: t.noise / 100, uSharp: t.sharpness / 100 + (pr.sharp || 0) * k, uDef: t.definition / 100,
      uMotion: an.motion.amt / 100, uMotionAngle: an.motion.angle * Math.PI / 180,
      uCA: an.lens.ca / 100 + (pr.ca || 0) * k, uHal: an.lens.halation / 100 + (pr.hal || 0) * k,
    },
    B: {
      uExp: g('exposure'), uBril: g('brilliance'), uHi: g('highlights'), uSh: g('shadows'), uCon: g('contrast'),
      uBri: g('brightness'), uBlk: g('black'), uSat: g('saturation'), uVib: g('vibrance'), uWarm: g('warmth'), uTint: g('tint'),
      uVig: g('vignette'), uFade: (pt.fade || 0) * k + an.lens.fade / 100, uShoulder: (pt.shoulder || 0) * k,
      uHueA: [0, 1, 2].map(i => band(pr.hue, k, i)), uHueB: [3, 4, 5].map(i => band(pr.hue, k, i)),
      uSatA: [0, 1, 2].map(i => band(pr.sat, k, i)), uSatB: [3, 4, 5].map(i => band(pr.sat, k, i)),
      uLumA: [0, 1, 2].map(i => band(pr.lum, k, i)), uLumB: [3, 4, 5].map(i => band(pr.lum, k, i)),
      uSplitS: sp.s || [.5, .5, .5], uSplitSA: (sp.sa || 0) * k, uSplitH: sp.h || [.5, .5, .5], uSplitHA: (sp.ha || 0) * k,
      uMono: mono ? k : 0, uMonoMix: mono ? mono.mix : [.3, .59, .11], uTone: mono ? mono.tone : [1, 1, 1],
      uLeak: an.leak.type, uLeakAmt: an.leak.amt / 100, uLeakShift: an.leak.shift / 100,
      uGrain: grainAmt, uGrainSize: an.grain.type ? gr.size * (0.5 + an.grain.size / 100) : 1.3,
      uGrainChroma: an.grain.type ? gr.c : 0, uGrainRough: an.grain.type ? gr.r : 0,
      uTexT: an.texture.type, uTexAmt: an.texture.amt / 100,
      uDith: an.dither.type, uDithMix: an.dither.mix / 100, uDithLevels: an.dither.levels, uDithScale: an.dither.scale,
    },
  };
}

/* ------------------------------------------------------------------ colour helpers */
export const toHex = (rgb: number[]) => '#' + rgb.map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
export const fromHex = (hx: string) => [1, 3, 5].map(i => parseInt(hx.slice(i, i + 2), 16));
export const hexLum = (hx: string) => { const [r, g, b] = fromHex(hx); return (r * .2126 + g * .7152 + b * .0722) / 255; };
export const mixHex = (a: string, b: string, t: number) => { const A = fromHex(a), B = fromHex(b); return toHex(A.map((v, i) => v + (B[i] - v) * t)); };

export function autoFrameColor(type: FrameType, palette: string[]): [string, string] {
  if (type === 'fs1') return ['ink', '#131311'];
  if (type === 'ex1') {
    const dark = palette.slice().sort((a, b) => hexLum(a) - hexLum(b))[0] || '#26281c';
    return ['auto', mixHex(dark, '#101010', .35)];
  }
  return ['cream', '#e8e5d9'];
}
