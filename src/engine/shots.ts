import { Platform } from 'react-native';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { SkImage } from '@shopify/react-native-skia';
import { extractPalette, loadSkImage, scaleImage } from './render';
import { Crop, defState, EditState, Meta, todayISO } from './state';

export interface Shot {
  id: string;
  full: SkImage;   // up to 4096px, used for export
  prev: SkImage;   // up to 1800px, used for the live editor preview
  thumb: SkImage;  // up to 320px, used for look thumbnails
  palette: string[];
  state: EditState;
  meta: Meta;
}

let seq = 0;

/**
 * Bakes EXIF orientation, applies an optional crop (normalised 0..1) and caps the
 * long side, so Skia always receives an upright, reasonably sized JPEG.
 */
export async function normalizePhoto(uri: string, w: number, h: number, crop?: Crop, max = 4096): Promise<string> {
  let ctx = ImageManipulator.manipulate(uri);
  let cw = w, ch = h;
  if (crop) {
    const ox = Math.round(crop.x * w), oy = Math.round(crop.y * h);
    cw = Math.round(crop.w * w); ch = Math.round(crop.h * h);
    ctx = ctx.crop({ originX: ox, originY: oy, width: cw, height: ch });
  }
  const k = Math.min(1, max / Math.max(cw, ch));
  // Always resize to bake EXIF orientation into pixels — skipping this when k≥1
  // leaves the EXIF tag intact, so Skia applies it on load but the exporter strips
  // it on save, producing a spurious 90° rotation on affected devices.
  ctx = ctx.resize({ width: Math.max(1, Math.round(cw * k)) });
  const ref = await ctx.renderAsync();
  const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.96 });
  return out.uri;
}

export async function makeShot(uri: string, meta: Meta, init: { preset?: string; exposure?: number } = {}): Promise<Shot> {
  const full = await loadSkImage(uri);
  const prev = scaleImage(full, 1800);
  const thumb = scaleImage(prev, 320);
  const palette = extractPalette(thumb);
  const state = defState();
  if (init.preset) state.preset = init.preset;
  if (init.exposure) state.tune.exposure = Math.round(Math.max(-100, Math.min(100, init.exposure)));
  state.frame.date = meta.date || todayISO();
  state.frame.cam = meta.cam || '';
  state.frame.specs = meta.specs || '';
  return { id: `shot${++seq}`, full, prev, thumb, palette, state, meta };
}

/** Reads camera / picker EXIF (flat on Android, nested dictionaries on iOS) into frame text. */
export function metaFromExif(exif: Record<string, any> | null | undefined): Meta {
  if (!exif) return {};
  const get = (k: string): any => exif[k] ?? exif['{Exif}']?.[k] ?? exif['{TIFF}']?.[k];
  const out: Meta = {};
  const make: string = get('Make') || '', model: string = get('Model') || '';
  if (make || model) out.cam = model && make && !model.toLowerCase().includes(make.toLowerCase()) ? `${model} ${make}` : (model || make);
  const parts: string[] = [];
  const f = Number(get('FNumber')); if (f) parts.push(`f/${f.toFixed(1)}`);
  const fl = Number(get('FocalLenIn35mmFilm') || get('FocalLengthIn35mmFilm') || get('FocalLength'));
  if (fl) parts.push(`${Math.round(fl)}mm`);
  let iso = get('ISOSpeedRatings') ?? get('PhotographicSensitivity') ?? get('ISO');
  if (Array.isArray(iso)) iso = iso[0];
  if (iso) parts.push(`ISO${iso}`);
  const et = Number(get('ExposureTime')); if (et) parts.push(et >= 1 ? `${et}s` : `1/${Math.round(1 / et)}`);
  if (parts.length) out.specs = parts.join(' | ');
  const dt: string | undefined = get('DateTimeOriginal') || get('DateTime');
  if (dt && /^\d{4}:\d{2}:\d{2}/.test(dt)) out.date = dt.slice(0, 10).replace(/:/g, '-');
  return out;
}

export const deviceName = () => (Platform.OS === 'ios' ? 'iPhone' : 'Android');
