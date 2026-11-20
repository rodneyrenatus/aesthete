import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { SkImage } from '@shopify/react-native-skia';
import {
  ADJUSTS, AdjKey, ASPECT_OPTS, CATS, DITHERS, FRAMES, GRAINS, LEAKS, NEUTRALS, PRESET, PRESETS, TEXTURES,
} from '../engine/catalog';
import { Fonts, renderThumb } from '../engine/render';
import { Shot } from '../engine/shots';
import { autoFrameColor, clone, defAnalog, defGeo, defState, defTune, EditState, mixHex } from '../engine/state';
import { loadRecipes, Recipe, saveRecipes } from '../store';
import { C, F } from '../theme';
import { Btn, Card, Chips, Field, HRow, NoneThumb, Note, Ruler, s as cs, Seg, SkThumb, SliderRow, Toggle } from '../ui/controls';
import { Icon } from '../ui/Icon';

export type Update = (fn: (d: EditState) => void) => void;
export interface PanelProps {
  st: EditState; update: Update; shot: Shot; fonts: Fonts; toast: (m: string) => void;
  ui: UiState; setUi: (p: Partial<UiState>) => void;
}
export interface UiState { cat: string; adj: AdjKey; analog: string; polaroid: string }

const signed = (v: number) => (v > 0 ? `+${v}` : String(v));
const TH = 70;

/** Renders thumbnails of the current photo for a list of state mutations. */
function useThumbs(shot: Shot, base: EditState, muts: ((s: EditState) => void)[], zoom: number, fonts: Fonts, key: string) {
  const [imgs, setImgs] = useState<(SkImage | null)[]>([]);
  useEffect(() => {
    let alive = true;
    const out: (SkImage | null)[] = [];
    let i = 0;
    const step = () => {
      if (!alive) return;
      const t0 = Date.now();
      while (i < muts.length && Date.now() - t0 < 24) {
        const st = clone(base); muts[i](st);
        try { out[i] = renderThumb(shot.thumb, st, TH * 2, zoom, fonts); } catch { out[i] = null; }
        i++;
      }
      setImgs(out.slice());
      if (i < muts.length) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shot.id, key]);
  return imgs;
}

/* ------------------------------------------------------------------ presets */
export function PresetsPanel({ st, update, shot, fonts, ui, setUi }: PanelProps) {
  const list = PRESETS.filter(p => ui.cat === 'all' || p.cat === ui.cat || p.id === 'original');
  const geoKey = JSON.stringify(st.geo) + ui.cat;
  const thumbs = useThumbs(shot, st, list.map(p => (s: EditState) => { s.preset = p.id; s.strength = 100; s.tune = defTune(); s.analog = defAnalog(); }), 1, fonts, geoKey);
  const pr = PRESET[st.preset];
  return (
    <>
      <Chips items={CATS} value={ui.cat} onChange={k => setUi({ cat: k })} />
      <HRow>
        {list.map((p, i) => (
          <Card key={p.id} wide label={p.name} on={st.preset === p.id} a11y={`${p.name}: ${p.sub}`}
            onPress={() => update(d => { d.preset = p.id; d.strength = 100; })}>
            <SkThumb image={thumbs[i] || null} size={82} />
          </Card>
        ))}
      </HRow>
      {st.preset !== 'original' ? (
        <>
          <Text style={st_.head} numberOfLines={1}>{pr.name.toUpperCase()} <Text style={{ color: C.mute }}>· {pr.sub}</Text></Text>
          <SliderRow label="Strength" min={0} max={100} value={st.strength} fmt={v => `${v}%`} onChange={v => update(d => { d.strength = v; })} />
        </>
      ) : <Note>Pick a look. Each one is a starting point: strength, tune and analog all stack on top.</Note>}
    </>
  );
}

/* ------------------------------------------------------------------ tune */
function Dial({ k, v, on, onPress, label }: { k: AdjKey; v: number; on: boolean; onPress: () => void; label: string }) {
  const r = 22.5, circ = 2 * Math.PI * r, p = Math.abs(v) / 100;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label} ${v}`} style={{ alignItems: 'center', gap: 6, width: 52 }}>
      <View style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={48} height={48} style={StyleSheet.absoluteFill}>
          <Circle cx={24} cy={24} r={r} stroke={on ? C.fg : '#4a4842'} strokeWidth={1.5} fill={on ? '#1c1b18' : 'none'} />
          {v !== 0 && (
            <Circle cx={24} cy={24} r={r} stroke={C.accent} strokeWidth={2.5} fill="none" strokeDasharray={`${circ * p} ${circ}`}
              transform={v < 0 ? 'translate(48,0) scale(-1,1) rotate(-90 24 24)' : 'rotate(-90 24 24)'} />
          )}
        </Svg>
        {on && v !== 0
          ? <Text style={{ color: C.fg, fontFamily: F.monoBold, fontSize: 12 }}>{signed(v)}</Text>
          : <Icon name={k} size={22} />}
      </View>
      <Text style={{ color: on ? C.fg : C.mute, fontFamily: F.mono, fontSize: 9, letterSpacing: .5 }}>{ADJUSTS.find(a => a.key === k)!.short}</Text>
    </Pressable>
  );
}
export function TunePanel({ st, update, ui, setUi }: PanelProps) {
  const a = ADJUSTS.find(x => x.key === ui.adj)!;
  return (
    <>
      <View style={st_.headRow}>
        <Text style={st_.head}>{a.name.toUpperCase()}  <Text style={{ color: C.accent, fontFamily: F.monoBold }}>{signed(st.tune[a.key])}</Text></Text>
        <Pressable onPress={() => update(d => { d.tune = defTune(); })} hitSlop={8}><Text style={st_.link}>RESET ALL</Text></Pressable>
      </View>
      <Ruler key={a.key} min={a.min} max={100} value={st.tune[a.key]} onChange={v => update(d => { d.tune[a.key] = v; })} />
      <HRow gap={14}>
        {ADJUSTS.map(x => <Dial key={x.key} k={x.key} label={x.name} v={st.tune[x.key]} on={x.key === ui.adj} onPress={() => setUi({ adj: x.key })} />)}
      </HRow>
    </>
  );
}

/* ------------------------------------------------------------------ crop */
export function frameDims(shot: Shot, st: EditState): [number, number] {
  const w = shot.prev.width(), h = shot.prev.height();
  return st.geo.rot % 2 ? [h, w] : [w, h];
}
export function aspectValue(key: string, shot: Shot, st: EditState): number | null {
  if (key === 'free') return null;
  if (key === 'orig') { const [fw, fh] = frameDims(shot, st); return fw / fh; }
  const [a, b] = key.split(':').map(Number); return a / b;
}
function fitCrop(d: EditState, ratio: number, shot: Shot) {
  const [fw, fh] = frameDims(shot, d); const fa = fw / fh;
  let w = 1, h = 1; if (ratio > fa) h = fa / ratio; else w = ratio / fa;
  d.geo.crop = { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
}
export function CropPanel({ st, update, shot }: PanelProps) {
  return (
    <>
      <Chips items={ASPECT_OPTS} value={st.geo.aspect} onChange={k => update(d => { d.geo.aspect = k; const r = aspectValue(k, shot, d); if (r) fitCrop(d, r, shot); })} />
      <Text style={st_.head}>STRAIGHTEN  <Text style={{ color: C.accent, fontFamily: F.monoBold }}>{st.geo.angle}°</Text></Text>
      <Ruler min={-45} max={45} value={Math.round(st.geo.angle)} onChange={v => update(d => { d.geo.angle = v; })} />
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Btn icon="rotate" label="Rotate" onPress={() => update(d => {
          d.geo.rot = (d.geo.rot + 3) % 4; d.geo.crop = { x: 0, y: 0, w: 1, h: 1 };
          const r = aspectValue(d.geo.aspect, shot, d); if (r) fitCrop(d, r, shot);
        })} />
        <Btn icon="mirror" label="Flip" onPress={() => update(d => { d.geo.flip = !d.geo.flip; })} />
        <Btn icon="reset" label="Reset" onPress={() => update(d => { d.geo = defGeo(); })} />
      </View>
    </>
  );
}

/* ------------------------------------------------------------------ analog */
const ANALOG_SUBS: [string, string][] = [['leak', 'Light Leak'], ['grain', 'Grain'], ['texture', 'Texture'], ['dither', 'Dither'], ['motion', 'Motion'], ['lens', 'Lens']];
export function AnalogPanel(props: PanelProps) {
  const { st, update, shot, fonts, ui, setUi } = props;
  const an = st.analog, sub = ui.analog;
  const baseKey = JSON.stringify([st.preset, st.strength, st.tune, st.geo.rot, st.geo.flip, st.geo.angle, sub]);
  type Kind = 'leak' | 'grain' | 'texture' | 'dither';
  const conf: Record<Kind, { names: string[]; zoom: number; mut: (s: EditState, i: number) => void }> = {
    leak: { names: LEAKS, zoom: 1, mut: (s, i) => { s.analog = defAnalog(); s.analog.leak = { type: i, amt: 85, shift: an.leak.shift }; } },
    grain: { names: GRAINS.map(g => g.n), zoom: .35, mut: (s, i) => { s.analog = defAnalog(); s.analog.grain = { type: i, amt: 80, size: an.grain.size }; } },
    texture: { names: TEXTURES, zoom: .6, mut: (s, i) => { s.analog = defAnalog(); s.analog.texture = { type: i, amt: 100 }; } },
    dither: { names: DITHERS, zoom: .4, mut: (s, i) => { s.analog = defAnalog(); s.analog.dither = { type: i, mix: 100, levels: an.dither.levels, scale: Math.max(3, an.dither.scale) }; } },
  };
  const kind = (['leak', 'grain', 'texture', 'dither'] as Kind[]).includes(sub as Kind) ? sub as Kind : null;
  const cf = kind ? conf[kind] : null;
  const muts = useMemo(() => (cf ? cf.names.map((_, i) => (s: EditState) => cf.mut(s, i)) : []), [kind]); // eslint-disable-line react-hooks/exhaustive-deps
  const thumbs = useThumbs(shot, st, muts, cf?.zoom || 1, fonts, baseKey);
  const sl = (label: string, min: number, max: number, get: number, set: (d: EditState, v: number) => void, fmt?: (v: number) => string) =>
    <SliderRow label={label} min={min} max={max} value={get} fmt={fmt} onChange={v => update(d => set(d, v))} />;
  return (
    <>
      <Seg items={ANALOG_SUBS} value={sub} onChange={k => setUi({ analog: k })} />
      {kind && cf && (
        <HRow>
          {cf.names.map((n, i) => (
            <Card key={n} label={n} on={an[kind].type === i} onPress={() => update(d => { d.analog[kind].type = i; })}>
              {i === 0 ? <NoneThumb /> : <SkThumb image={thumbs[i] || null} size={TH} />}
            </Card>
          ))}
        </HRow>
      )}
      {sub === 'leak' && an.leak.type > 0 && <>
        {sl('Intensity', 0, 100, an.leak.amt, (d, v) => { d.analog.leak.amt = v; })}
        {sl('Position', -100, 100, an.leak.shift, (d, v) => { d.analog.leak.shift = v; }, signed)}
      </>}
      {sub === 'grain' && an.grain.type > 0 && <>
        {sl('Amount', 0, 100, an.grain.amt, (d, v) => { d.analog.grain.amt = v; })}
        {sl('Size', 0, 100, an.grain.size, (d, v) => { d.analog.grain.size = v; })}
      </>}
      {sub === 'texture' && an.texture.type > 0 && sl('Intensity', 0, 100, an.texture.amt, (d, v) => { d.analog.texture.amt = v; })}
      {sub === 'dither' && an.dither.type > 0 && <>
        {sl('Mix', 0, 100, an.dither.mix, (d, v) => { d.analog.dither.mix = v; }, v => `${v}%`)}
        {an.dither.type <= 4 && sl('Levels', 2, 16, an.dither.levels, (d, v) => { d.analog.dither.levels = v; })}
        {sl('Pixel size', 2, 12, an.dither.scale, (d, v) => { d.analog.dither.scale = v; }, v => `${v}x`)}
      </>}
      {sub === 'motion' && <>
        {sl('Blur', 0, 100, an.motion.amt, (d, v) => { d.analog.motion.amt = v; })}
        {sl('Direction', 0, 180, an.motion.angle, (d, v) => { d.analog.motion.angle = v; }, v => `${v}°`)}
        <Note>A streak along the chosen direction, like a slow shutter on the move.</Note>
      </>}
      {sub === 'lens' && <>
        {sl('Chromatic', 0, 100, an.lens.ca, (d, v) => { d.analog.lens.ca = v; })}
        {sl('Halation', 0, 100, an.lens.halation, (d, v) => { d.analog.lens.halation = v; })}
        {sl('Fade', 0, 100, an.lens.fade, (d, v) => { d.analog.lens.fade = v; })}
      </>}
    </>
  );
}

/* ------------------------------------------------------------------ polaroid */
const POL_SUBS: [string, string][] = [['color', 'Color'], ['size', 'Border'], ['text', 'Text']];
function Swatch({ color, on, onPress, label, auto }: { color: string; on: boolean; onPress: () => void; label: string; auto?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={label}
      style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: on ? C.accent : 'transparent', padding: on ? 3 : 0 }}>
      {auto ? (
        <View style={{ flex: 1, borderRadius: 20, overflow: 'hidden', flexDirection: 'row', flexWrap: 'wrap' }}>
          {['#e9e6db', '#7a8a3a', '#2a2a26', '#18308a'].map(c => <View key={c} style={{ width: '50%', height: '50%', backgroundColor: c }} />)}
        </View>
      ) : <View style={{ flex: 1, borderRadius: 20, backgroundColor: color, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,.2)' }} />}
    </Pressable>
  );
}
export function PolaroidPanel({ st, update, shot, ui, setUi }: PanelProps) {
  const fr = st.frame, pal = shot.palette;
  const tints = pal.map(c => mixHex(c, '#f4f1ea', .68));
  const pick = (key: string, col: string) => update(d => { d.frame.auto = false; d.frame.ckey = key; d.frame.color = col; });
  return (
    <>
      <HRow>
        {FRAMES.map(([k, l]) => (
          <Card key={k} label={l} on={fr.type === k} onPress={() => update(d => {
            d.frame.type = k;
            if (d.frame.auto) { const [ck, col] = autoFrameColor(k, pal); d.frame.ckey = ck; d.frame.color = col; }
          })}>
            {k === 'none' ? <NoneThumb /> : <Icon name={`f_${k}`} size={38} stroke={1.4} />}
          </Card>
        ))}
      </HRow>
      <Seg items={POL_SUBS} value={ui.polaroid} onChange={k => setUi({ polaroid: k })} />
      {ui.polaroid === 'color' && <>
        <HRow gap={10}>
          <Swatch auto label="Match automatically" color="" on={fr.auto} onPress={() => update(d => { d.frame.auto = true; const [ck, c] = autoFrameColor(d.frame.type, pal); d.frame.ckey = ck; d.frame.color = c; })} />
          {NEUTRALS.map(([k, c]) => <Swatch key={k} label={k} color={c} on={!fr.auto && fr.ckey === k} onPress={() => pick(k, c)} />)}
          <View style={{ width: 1, height: 28, backgroundColor: C.line }} />
          {tints.map((c, i) => <Swatch key={'t' + i} label={`Pale tint ${i + 1} from photo`} color={c} on={!fr.auto && fr.ckey === 'tint' + i} onPress={() => pick('tint' + i, c)} />)}
          <View style={{ width: 1, height: 28, backgroundColor: C.line }} />
          {pal.map((c, i) => <Swatch key={'p' + i} label={`Photo color ${i + 1}`} color={c} on={!fr.auto && fr.ckey === 'pal' + i} onPress={() => pick('pal' + i, c)} />)}
        </HRow>
        <Note accent={fr.type === 'none'}>{fr.type === 'none' ? 'Choose a frame above to see the border.' : 'After the neutrals come pale tints pulled from this photo, then its pure colours.'}</Note>
      </>}
      {ui.polaroid === 'size' && <>
        <SliderRow label="Thickness" min={0} max={100} value={fr.thick} onChange={v => update(d => { d.frame.thick = v; })} />
        <Toggle label="Palette strip" value={fr.palette} onChange={v => update(d => { d.frame.palette = v; })} />
      </>}
      {ui.polaroid === 'text' && <>
        <Field label="Caption" value={fr.caption} placeholder={fr.type === 'ex1' ? 'Defaults to the look name' : 'Write on the print'} onChange={v => update(d => { d.frame.caption = v; })} />
        <Field label="Date" value={fr.date} placeholder="YYYY-MM-DD" maxLength={10} onChange={v => update(d => { d.frame.date = v; })} />
        <Field label="Camera" value={fr.cam} placeholder="iPhone 16 Apple" onChange={v => update(d => { d.frame.cam = v; })} />
        <Field label="Settings" value={fr.specs} placeholder="f/1.6 | 26mm | ISO125" onChange={v => update(d => { d.frame.specs = v; })} />
      </>}
    </>
  );
}

/* ------------------------------------------------------------------ recipes */
export function RecipePanel({ st, update, toast }: PanelProps) {
  const [list, setList] = useState<Recipe[]>([]);
  const [name, setName] = useState('');
  useEffect(() => { loadRecipes().then(setList); }, []);
  const placeholder = `Look ${String(list.length + 1).padStart(2, '0')}`;
  const save = async () => {
    const n = (name || placeholder).trim();
    const r: Recipe = clone({ name: n, preset: st.preset, strength: st.strength, tune: st.tune, analog: st.analog,
      frame: { type: st.frame.type, thick: st.frame.thick, palette: st.frame.palette } });
    const next = [...list, r]; setList(next); await saveRecipes(next); setName(''); toast(`Saved “${n}”`);
  };
  return (
    <>
      <Field label="Name" value={name} onChange={setName} placeholder={placeholder} maxLength={24} />
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Btn primary icon="plus" label="Save look" onPress={save} />
        <Btn icon="reset" label="Reset all edits" onPress={() => { update(d => { const f = d.frame; const n = defState(); n.frame.date = f.date; n.frame.cam = f.cam; n.frame.specs = f.specs; Object.assign(d, n); }); toast('Back to the original'); }} />
      </View>
      {!list.length && <Note>A look stores the preset, tune, analog and frame style so you can put it on the next shot in one tap. Looks stay on this phone.</Note>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {list.map((r, i) => (
          <View key={i} style={{ flexDirection: 'row', borderWidth: 1, borderColor: C.line }}>
            <Pressable style={{ paddingVertical: 7, paddingHorizontal: 10 }} onPress={() => {
              update(d => {
                d.preset = r.preset; d.strength = r.strength; d.tune = clone(r.tune); d.analog = { ...defAnalog(), ...clone(r.analog) };
                Object.assign(d.frame, r.frame);
              });
              toast(`Applied “${r.name}”`);
            }}><Text style={cs.label}>{r.name.toUpperCase()}</Text></Pressable>
            <Pressable accessibilityLabel={`Delete ${r.name}`} style={{ paddingVertical: 7, paddingHorizontal: 10, borderLeftWidth: 1, borderLeftColor: C.line }}
              onPress={async () => { const next = list.filter((_, j) => j !== i); setList(next); await saveRecipes(next); }}>
              <Text style={[cs.label, { color: C.mute }]}>×</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </>
  );
}

const st_ = StyleSheet.create({
  head: { color: C.fg, fontFamily: F.mono, fontSize: 12, letterSpacing: 1 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  link: { color: C.mute, fontFamily: F.mono, fontSize: 11, letterSpacing: .8 },
});
