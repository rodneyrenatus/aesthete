import {
  AlphaType, ColorType, FilterMode, ImageFormat, MipmapMode, Skia, TileMode,
  type SkCanvas, type SkImage, type SkRuntimeEffect, type SkTypeface,
} from '@shopify/react-native-skia';
import { PRESET } from './catalog';
import { PASS_A, PASS_B } from './shaders';
import { computeParams, Crop, EditState, Frame, Geo, geoParams, hexLum, toHex, todayISO, Uniforms } from './state';

/* ------------------------------------------------------------------ effects */
let FX: { A: SkRuntimeEffect; B: SkRuntimeEffect } | null = null;
function effects() {
  if (!FX) {
    const A = Skia.RuntimeEffect.Make(PASS_A), B = Skia.RuntimeEffect.Make(PASS_B);
    if (!A || !B) throw new Error('The look engine shaders failed to compile on this device.');
    FX = { A, B };
  }
  return FX;
}
function pack(effect: SkRuntimeEffect, values: Uniforms): number[] {
  const out = new Array<number>(effect.getUniformFloatCount()).fill(0);
  for (let i = 0; i < effect.getUniformCount(); i++) {
    const u = effect.getUniform(i), name = effect.getUniformName(i);
    const v = values[name];
    if (v === undefined) continue;
    (Array.isArray(v) ? v : [v]).forEach((x, j) => { out[u.slot + j] = x; });
  }
  return out;
}

export interface Fonts { display: SkTypeface | null; hand: SkTypeface | null; mono: SkTypeface | null; monoBold: SkTypeface | null }

/** Draws the developed photo into (0,0,iw,ih) of the canvas' local space. */
export function drawPhoto(canvas: SkCanvas, src: SkImage, st: EditState, iw: number, ih: number, opt: { original?: boolean; geo?: Geo } = {}) {
  const { A, B } = effects();
  const sw = src.width(), sh = src.height();
  const gu = geoParams(opt.geo || st.geo, sw, sh);
  const P = computeParams(st, gu, !!opt.original);
  const ish = src.makeShaderOptions(TileMode.Clamp, TileMode.Clamp, FilterMode.Linear, MipmapMode.None);
  const a = A.makeShaderWithChildren(pack(A, { ...P.A, uOut: [iw, ih], uSrc: [sw, sh] }), [ish]);
  const b = B.makeShaderWithChildren(pack(B, { ...P.B, uOut: [iw, ih] }), [a]);
  const paint = Skia.Paint(); paint.setShader(b);
  canvas.drawRect(Skia.XYWHRect(0, 0, iw, ih), paint);
}

/** Aspect ratio (w/h) of the output image for a geometry on a source. */
export function outputAspect(geo: Geo, sw: number, sh: number) {
  const g = geoParams(geo, sw, sh);
  return (g.uCrop[2] * g.uFrame[0]) / (g.uCrop[3] * g.uFrame[1]);
}

function surface(w: number, h: number) {
  const s = Skia.Surface.MakeOffscreen(w, h) || Skia.Surface.Make(w, h);
  if (!s) throw new Error('Out of graphics memory');
  return s;
}
function snapshot(s: ReturnType<typeof surface>): SkImage {
  s.flush();
  const img = s.makeImageSnapshot();
  return img.makeNonTextureImage() || img;
}

/* ------------------------------------------------------------------ frames */
export interface Layout { W: number; H: number; x: number; y: number; u: number; b: number; top?: number; bot?: number; band?: number }
export function frameLayout(fr: Pick<Frame, 'type' | 'thick'>, iw: number, ih: number): Layout {
  const u = iw / 100, b = u * (1.5 + fr.thick / 100 * 7);
  switch (fr.type) {
    case 'b1': return { W: iw + 2 * b, H: ih + 2 * b, x: b, y: b, u, b };
    case 'p1': { const bot = Math.max(b * 3.4, u * 15); return { W: iw + 2 * b, H: ih + b + bot, x: b, y: b, u, b, bot }; }
    case 'p3': { const top = u * 34; return { W: iw + 2 * b, H: ih + top + b, x: b, y: top, u, b, top }; }
    case 'p4': { const bot = u * 22 + b; return { W: iw + 2 * b, H: ih + b + bot, x: b, y: b, u, b, bot }; }
    case 'pt1': { const bot = u * 28 + b; return { W: iw + 2 * b, H: ih + b + bot, x: b, y: b, u, b, bot }; }
    case 'ex1': { const bot = u * 14; return { W: iw + 2 * b, H: ih + b + bot, x: b, y: b, u, b, bot }; }
    case 'fs1': { const side = u * 1.6, band = u * 9.5; return { W: iw + 2 * side, H: ih + 2 * band, x: side, y: band, u, b: side, band }; }
    default: return { W: iw, H: ih, x: 0, y: 0, u, b: 0 };
  }
}
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function paintOf(color: string, alpha = 1) {
  const p = Skia.Paint(); p.setAntiAlias(true); p.setColor(Skia.Color(color)); if (alpha < 1) p.setAlphaf(alpha); return p;
}
function text(c: SkCanvas, s: string, x: number, y: number, tf: SkTypeface | null, size: number, color: string,
  align: 'left' | 'right' | 'center' = 'left', maxW?: number, alpha = 1) {
  if (!tf || !s) return;
  let font = Skia.Font(tf, size);
  let w = font.measureText(s).width;
  if (maxW && w > maxW) { font = Skia.Font(tf, size * maxW / w); w = maxW; }
  const px = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
  c.drawText(s, px, y, paintOf(color, alpha), font);
}

function drawDecor(c: SkCanvas, L: Layout, fr: Frame, iw: number, ih: number, fonts: Fonts, palette: string[], presetName: string) {
  const u = L.u;
  const light = hexLum(fr.color || '#000000') > .5;
  const ink = light ? '#161512' : '#f1ece1';
  const softA = light ? .58 : .62;
  const [Y, M, D] = (fr.date || todayISO()).split('-');
  const mon = MONTHS[(+M || 1) - 1];
  const pal = palette;
  if (fr.type !== 'none' && fr.type !== 'fs1') c.drawRect(Skia.XYWHRect(L.x, L.y + ih, iw, Math.max(1, u * .12)), paintOf(light ? '#000000' : '#ffffff', light ? .08 : .06));
  switch (fr.type) {
    case 'p1':
      if (fr.caption) text(c, fr.caption, L.W / 2, L.y + ih + (L.bot || 0) * .62, fonts.hand, u * 7.5, ink, 'center', iw);
      break;
    case 'p3': {
      const top = L.top || 0;
      text(c, `${mon} ${+D}`, L.b, top * .5, fonts.display, u * 10.5, ink);
      text(c, Y, L.b, top * .5 + u * 9.4, fonts.display, u * 10.5, ink);
      if (fr.palette && pal.length) {
        const sw = u * 3.6, n = Math.min(5, pal.length), x0 = L.W - L.b - sw * n;
        pal.slice(0, n).forEach((col, i) => c.drawRect(Skia.XYWHRect(x0 + i * sw, top * .5 + u * 9.4 - sw * .9, sw, sw), paintOf(col)));
      }
      break;
    }
    case 'p4': {
      const by = L.y + ih, bot = L.bot || 0;
      text(c, fr.caption || 'untitled', L.b, by + bot * .5, fonts.hand, u * 8, ink, 'left', iw * .7);
      text(c, `${mon} ${+D}, ${Y}`, L.b, by + bot * .5 + u * 5, fonts.mono, u * 2.5, ink, 'left', undefined, softA);
      if (fr.palette && pal.length) {
        const r = u * 1.5;
        pal.slice(0, 5).forEach((col, i) => c.drawCircle(L.W - L.b - r - i * r * 2.6, by + bot * .5 - u * 2, r, paintOf(col)));
      }
      break;
    }
    case 'pt1': {
      const by = L.y + ih, bot = L.bot || 0;
      text(c, Y, L.b - u * .6, by + bot - L.b * .9 - u * 1.5, fonts.display, u * 25, ink, 'left', iw * .8);
      text(c, `${mon} ${D}`, L.W - L.b, by + u * 7, fonts.monoBold, u * 2.4, ink, 'right', undefined, softA);
      if (fr.caption) text(c, fr.caption.toUpperCase(), L.W - L.b, by + u * 10.5, fonts.mono, u * 2.4, ink, 'right', iw * .35, softA);
      break;
    }
    case 'ex1': {
      const by = L.y + ih, mid = by + (L.bot || 0) * .5;
      text(c, fr.cam || 'AESTHETE', L.b, mid - u * .4, fonts.monoBold, u * 2.5, ink, 'left', iw * .6);
      text(c, fr.specs || `${mon} ${+D} ${Y}`, L.b, mid + u * 3.2, fonts.mono, u * 2, ink, 'left', iw * .6, softA);
      text(c, fr.caption || presetName, L.W - L.b, mid - u * .4, fonts.monoBold, u * 2.5, ink, 'right', iw * .35);
      if (fr.palette && pal.length) {
        const s = u * 2.6, n = Math.min(4, pal.length); let x = L.W - L.b;
        for (let i = n - 1; i >= 0; i--) {
          if (i % 2 === 1 && i !== n - 1) x -= u * 1.6;
          x -= s; c.drawRect(Skia.XYWHRect(x, mid + u * 1.1, s, s * .85), paintOf(pal[i]));
        }
      }
      break;
    }
    case 'fs1': {
      const hw = u * 2.6, hh = u * 3.3, step = u * 6.2, rr = u * .6, band = L.band || 0;
      const hole = paintOf(light ? '#000000' : '#e9e4d6', light ? .82 : 1);
      for (let x = u * 2; x < L.W - hw; x += step) {
        for (const yy of [(band - hh) * .42, L.H - band + (band - hh) * .58]) c.drawRRect(Skia.RRectXY(Skia.XYWHRect(x, yy, hw, hh), rr, rr), hole);
      }
      const ty = band - u * .9;
      text(c, 'AESTHETE 400', u * 3, ty, fonts.monoBold, u * 2, '#ff9a3c');
      text(c, '24  >  24A', L.W - u * 3, ty, fonts.monoBold, u * 2, '#ff9a3c', 'right');
      text(c, presetName.toUpperCase(), u * 3, L.H - band + u * 2.6, fonts.monoBold, u * 2, '#ff9a3c');
      break;
    }
  }
}

/** Renders the photo plus its frame into a new image. */
export function renderComposite(src: SkImage, st: EditState, iw: number, ih: number, ctx: {
  fonts: Fonts; palette: string[]; original?: boolean; noFrame?: boolean; geo?: Geo;
}): SkImage {
  iw = Math.max(1, Math.round(iw)); ih = Math.max(1, Math.round(ih));
  const fr: Frame = ctx.noFrame ? { ...st.frame, type: 'none' } : st.frame;
  const L = frameLayout(fr, iw, ih);
  const s = surface(Math.round(L.W), Math.round(L.H));
  const c = s.getCanvas();
  c.clear(Skia.Color(fr.type === 'none' ? '#000000' : fr.color));
  c.save(); c.translate(L.x, L.y);
  drawPhoto(c, src, st, iw, ih, { original: ctx.original, geo: ctx.geo });
  c.restore();
  drawDecor(c, L, fr, iw, ih, ctx.fonts, ctx.palette, (PRESET[st.preset] || PRESET.original).name);
  return snapshot(s);
}

/** Square thumbnail of the photo with a mutated state. */
export function renderThumb(src: SkImage, st: EditState, size: number, zoom = 1, fonts: Fonts): SkImage {
  const rot = st.geo.rot % 2;
  const fw = rot ? src.height() : src.width(), fh = rot ? src.width() : src.height();
  const a = fw / fh; let w = a > 1 ? 1 / a : 1, h = a > 1 ? 1 : a; w *= zoom; h *= zoom;
  const crop: Crop = { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
  return renderComposite(src, st, size, size, { fonts, palette: [], noFrame: true, geo: { ...st.geo, crop } });
}

/* ------------------------------------------------------------------ images */
export function scaleImage(img: SkImage, max: number): SkImage {
  const k = Math.min(1, max / Math.max(img.width(), img.height()));
  if (k === 1) return img;
  const w = Math.max(1, Math.round(img.width() * k)), h = Math.max(1, Math.round(img.height() * k));
  const s = surface(w, h);
  s.getCanvas().drawImageRectOptions(img, Skia.XYWHRect(0, 0, img.width(), img.height()), Skia.XYWHRect(0, 0, w, h), FilterMode.Linear, MipmapMode.Linear, null);
  return snapshot(s);
}

export async function loadSkImage(uri: string): Promise<SkImage> {
  const data = await Skia.Data.fromURI(uri);
  const img = Skia.Image.MakeImageFromEncoded(data);
  if (!img) throw new Error('That file could not be opened as a photo.');
  return img;
}

export function extractPalette(src: SkImage): string[] {
  const img = scaleImage(src, 48);
  const w = img.width(), h = img.height();
  const px = img.readPixels(0, 0, { width: w, height: h, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul });
  if (!px) return ['#e8e5d9', '#8e8a7f', '#2c2b27'];
  const pts: number[][] = [];
  for (let i = 0; i + 3 < px.length; i += 4) pts.push([px[i], px[i + 1], px[i + 2]]);
  const lum = (p: number[]) => p[0] * .2126 + p[1] * .7152 + p[2] * .0722;
  pts.sort((a, b) => lum(a) - lum(b));
  const K = 6;
  let cen = Array.from({ length: K }, (_, i) => pts[Math.floor((i + .5) / K * pts.length)].slice());
  let cnt = new Array(K).fill(0);
  for (let it = 0; it < 10; it++) {
    const sum = cen.map(() => [0, 0, 0]); cnt = new Array(K).fill(0);
    for (const p of pts) {
      let bi = 0, bd = 1e9;
      for (let j = 0; j < K; j++) { const q = cen[j]; const d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2; if (d < bd) { bd = d; bi = j; } }
      sum[bi][0] += p[0]; sum[bi][1] += p[1]; sum[bi][2] += p[2]; cnt[bi]++;
    }
    cen = cen.map((q, j) => cnt[j] ? sum[j].map(v => v / cnt[j]) : q);
  }
  return cen.map((q, j) => ({ q, n: cnt[j] })).filter(o => o.n > 0).sort((a, b) => lum(b.q) - lum(a.q))
    .map(o => { const L = lum(o.q); return toHex(o.q.map(v => L + (v - L) * 1.25)); });
}

/** Full-resolution JPEG of the edit, as base64. */
export function exportJpegBase64(full: SkImage, st: EditState, fonts: Fonts, palette: string[], maxSide = 4096): string {
  const gu = geoParams(st.geo, full.width(), full.height());
  let iw = gu.uCrop[2] * gu.uFrame[0], ih = gu.uCrop[3] * gu.uFrame[1];
  const k = Math.min(1, maxSide / Math.max(iw, ih)); iw *= k; ih *= k;
  const img = renderComposite(full, st, iw, ih, { fonts, palette });
  return img.encodeToBase64(ImageFormat.JPEG, 93);
}
