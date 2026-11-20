import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, PanResponder, PixelRatio, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Canvas, Image as SkImageView, type SkImage } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import * as MediaLibrary from 'expo-media-library';
import { File, Paths } from 'expo-file-system';
import { exportJpegBase64, Fonts, frameLayout, outputAspect, renderComposite } from '../engine/render';
import { Shot } from '../engine/shots';
import { clone, Crop, EditState } from '../engine/state';
import { C, F } from '../theme';
import { GUTTER } from '../ui/controls';
import { GlassSurface } from '../ui/Glass';
import { Icon } from '../ui/Icon';
import { aspectValue, AnalogPanel, CropPanel, frameDims, PanelProps, PolaroidPanel, PresetsPanel, RecipePanel, TunePanel, UiState } from './panels';

const TABS: [string, string, string][] = [
  ['presets', 'PRESETS', 'presets'], ['tune', 'TUNE', 'tune'], ['crop', 'CROP', 'crop'],
  ['analog', 'ANALOG', 'analog'], ['polaroid', 'POLAROID', 'polaroid'], ['develop', 'DEVELOP', 'recipe'],
];
const PANELS: Record<string, (p: PanelProps) => React.ReactElement> = {
  presets: PresetsPanel, tune: TunePanel, crop: CropPanel, analog: AnalogPanel, polaroid: PolaroidPanel, develop: RecipePanel,
};

interface View_ { img: SkImage; w: number; h: number; ix: number; iy: number; iw: number; ih: number }

export default function EditorScreen({ shot, fonts, onBack, toast }: {
  shot: Shot; fonts: Fonts; onBack: (st: EditState) => void; toast: (m: string) => void;
}) {
  const [st, setSt] = useState<EditState>(() => clone(shot.state));
  const [tab, setTab] = useState('presets');
  const [ui, setUiState] = useState<UiState>({ cat: 'all', adj: 'exposure', analog: 'leak', polaroid: 'color' });
  const setUi = useCallback((p: Partial<UiState>) => setUiState(u => ({ ...u, ...p })), []);
  const [comparing, setComparing] = useState(false);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View_ | null>(null);
  const [saving, setSaving] = useState(false);
  const [cropDraft, setCropDraft] = useState<Crop | null>(null);

  const update = useCallback((fn: (d: EditState) => void) => setSt(prev => { const n = clone(prev); fn(n); return n; }), []);

  /* ---------- history ---------- */
  const hist = useRef<string[]>([JSON.stringify(st)]);
  const hi = useRef(0);
  const [histTick, setHistTick] = useState(0);
  const restoring = useRef(false);
  useEffect(() => {
    if (restoring.current) { restoring.current = false; return; }
    const t = setTimeout(() => {
      const sj = JSON.stringify(st);
      if (sj !== hist.current[hi.current]) {
        hist.current = hist.current.slice(0, hi.current + 1); hist.current.push(sj);
        if (hist.current.length > 80) hist.current.shift();
        hi.current = hist.current.length - 1; setHistTick(x => x + 1);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [st]);
  const step = (d: number) => {
    const sj = JSON.stringify(st);
    if (sj !== hist.current[hi.current]) { hist.current = hist.current.slice(0, hi.current + 1); hist.current.push(sj); hi.current = hist.current.length - 1; }
    const n = Math.max(0, Math.min(hist.current.length - 1, hi.current + d));
    if (n === hi.current) return;
    hi.current = n; restoring.current = true; setSt(JSON.parse(hist.current[n])); setHistTick(x => x + 1);
    Haptics.selectionAsync().catch(() => {});
  };
  const canUndo = hi.current > 0 || JSON.stringify(st) !== hist.current[hi.current];
  const canRedo = hi.current < hist.current.length - 1;
  void histTick;

  /* ---------- preview render ---------- */
  const cropMode = tab === 'crop';
  const raf = useRef(0);
  useEffect(() => {
    if (!stage.w || !stage.h) return;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      try {
        const geo = cropMode ? { ...st.geo, crop: { x: 0, y: 0, w: 1, h: 1 } } : st.geo;
        const asp = outputAspect(geo, shot.prev.width(), shot.prev.height());
        const noFrame = cropMode || comparing;
        const fr = noFrame ? { type: 'none' as const, thick: 0 } : st.frame;
        const unit = frameLayout(fr, 1000, 1000 / asp);
        const pad = 14;
        const k = Math.min((stage.w - pad * 2) / unit.W, (stage.h - pad * 2) / unit.H);
        const dpr = Math.min(PixelRatio.get(), 2);
        const iw = Math.max(1, Math.round(1000 * k * dpr)), ih = Math.max(1, Math.round(iw / asp));
        const img = renderComposite(shot.prev, st, iw, ih, { fonts, palette: shot.palette, original: comparing, noFrame, geo });
        const L = frameLayout(fr, iw, ih);
        setView({ img, w: L.W / dpr, h: L.H / dpr, ix: L.x / dpr, iy: L.y / dpr, iw: iw / dpr, ih: ih / dpr });
      } catch (e: any) { toast(e?.message || 'Could not render the preview'); }
    });
    return () => cancelAnimationFrame(raf.current);
  }, [st, comparing, cropMode, stage, fonts, shot, toast]);

  /* ---------- crop gestures ---------- */
  const live = useRef({ st, view, cropDraft });
  live.current = { st, view, cropDraft };
  const drag = useRef<{ h: string; c: Crop } | null>(null);
  const makeResponder = (handle: string) => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { drag.current = { h: handle, c: { ...live.current.st.geo.crop } }; },
    onPanResponderMove: (_, g) => {
      const v = live.current.view, d0 = drag.current; if (!v || !d0) return;
      const dx = g.dx / v.iw, dy = g.dy / v.ih, c0 = d0.c, MIN = .08;
      let { x, y, w, h } = c0;
      if (d0.h === 'move') { x = Math.max(0, Math.min(1 - w, c0.x + dx)); y = Math.max(0, Math.min(1 - h, c0.y + dy)); }
      else {
        let l = c0.x, t = c0.y, r = c0.x + c0.w, b = c0.y + c0.h;
        if (d0.h.includes('l')) l = Math.max(0, Math.min(r - MIN, l + dx));
        if (d0.h.includes('r')) r = Math.min(1, Math.max(l + MIN, r + dx));
        if (d0.h.includes('t')) t = Math.max(0, Math.min(b - MIN, t + dy));
        if (d0.h.includes('b')) b = Math.min(1, Math.max(t + MIN, b + dy));
        const ratio = aspectValue(live.current.st.geo.aspect, shot, live.current.st);
        if (ratio) {
          const [fw, fh] = frameDims(shot, live.current.st);
          let wN = r - l, hN = wN * fw / ratio / fh;
          if (d0.h.includes('t')) { t = b - hN; if (t < 0) { t = 0; hN = b; wN = hN * fh * ratio / fw; if (d0.h.includes('l')) l = r - wN; else r = l + wN; } }
          else { b = t + hN; if (b > 1) { b = 1; hN = 1 - t; wN = hN * fh * ratio / fw; if (d0.h.includes('l')) l = r - wN; else r = l + wN; } }
        }
        x = l; y = t; w = r - l; h = b - t;
      }
      setCropDraft({ x, y, w, h });
    },
    onPanResponderRelease: () => {
      const c = live.current.cropDraft; drag.current = null;
      if (c) { update(d => { d.geo.crop = c; }); setCropDraft(null); }
    },
  });
  const responders = useMemo(() => Object.fromEntries(['move', 'tl', 'tr', 'bl', 'br'].map(h => [h, makeResponder(h)])), []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- save ---------- */
  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const perm = await MediaLibrary.requestPermissionsAsync(true);
      if (!perm.granted) { toast('Allow Photos access in Settings to save'); return; }
      await new Promise(r => setTimeout(r, 30));
      const b64 = exportJpegBase64(shot.full, st, fonts, shot.palette);
      const d = new Date(), p = (n: number) => String(n).padStart(2, '0');
      const file = new File(Paths.cache, `aesthete_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.jpg`);
      file.create({ overwrite: true });
      await file.write(b64, { encoding: 'base64' });
      await MediaLibrary.Asset.create(file.uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      toast('Saved to Photos');
    } catch (e: any) {
      toast(`Couldn’t save: ${e?.message || e}`);
    } finally { setSaving(false); }
  };

  const Panel = PANELS[tab];
  const crop = cropDraft || st.geo.crop;
  const left = view ? (stage.w - view.w) / 2 : 0, top = view ? (stage.h - view.h) / 2 : 0;

  const tabItems = TABS.map(([k, l, ic]) => (
    <Pressable key={k} style={[es.tab, Platform.OS === 'ios' && es.tabIos, Platform.OS === 'ios' && tab === k && es.tabIosOn]} onPress={() => { setTab(k); Haptics.selectionAsync().catch(() => {}); }}
      accessibilityRole="tab" accessibilityState={{ selected: tab === k }}>
      <Icon name={ic} color={tab === k ? C.accent : C.fg} />
      <Text style={[es.tabT, tab === k && { color: C.accent }]}>{l}</Text>
    </Pressable>
  ));

  return (
    <View style={{ flex: 1 }}>
      {/* KeyboardAvoidingView handles content above the tab bar */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={es.bar}>
          <Pressable style={es.ib} onPress={() => onBack(st)} accessibilityLabel="Back to camera" hitSlop={6}><Icon name="back" /></Pressable>
          <View style={{ flexDirection: 'row' }}>
            <Pressable style={[es.ib, !canUndo && es.dim]} disabled={!canUndo} onPress={() => step(-1)} accessibilityLabel="Undo"><Icon name="undo" /></Pressable>
            <Pressable style={[es.ib, !canRedo && es.dim]} disabled={!canRedo} onPress={() => step(1)} accessibilityLabel="Redo"><Icon name="redo" /></Pressable>
            <Pressable style={es.ib} onPressIn={() => !cropMode && setComparing(true)} onPressOut={() => setComparing(false)} accessibilityLabel="Hold to compare with the original"><Icon name="compare" /></Pressable>
          </View>
          <Pressable onPress={save} style={[es.save, saving && { opacity: .6 }]} accessibilityLabel="Save to Photos">
            {saving ? <ActivityIndicator color={C.fg} size="small" /> : <Text style={es.saveT}>SAVE</Text>}
          </Pressable>
        </View>

        <Pressable style={es.stage} onLayout={e => setStage({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
          onLongPress={() => !cropMode && setComparing(true)} onPressOut={() => setComparing(false)} delayLongPress={250}>
          {view && (
            <Canvas style={{ position: 'absolute', left, top, width: view.w, height: view.h }}>
              <SkImageView image={view.img} x={0} y={0} width={view.w} height={view.h} fit="fill" />
            </Canvas>
          )}
          {cropMode && view && (
            <View style={{ position: 'absolute', left: left + view.ix, top: top + view.iy, width: view.iw, height: view.ih }}>
              <View pointerEvents="none" style={[es.dimmer, { left: 0, top: 0, right: 0, height: crop.y * view.ih }]} />
              <View pointerEvents="none" style={[es.dimmer, { left: 0, bottom: 0, right: 0, height: (1 - crop.y - crop.h) * view.ih }]} />
              <View pointerEvents="none" style={[es.dimmer, { left: 0, top: crop.y * view.ih, width: crop.x * view.iw, height: crop.h * view.ih }]} />
              <View pointerEvents="none" style={[es.dimmer, { right: 0, top: crop.y * view.ih, width: (1 - crop.x - crop.w) * view.iw, height: crop.h * view.ih }]} />
              <View {...responders.move.panHandlers} style={[es.cropBox, { left: crop.x * view.iw, top: crop.y * view.ih, width: crop.w * view.iw, height: crop.h * view.ih }]}>
                {[1, 2].map(i => <View key={'v' + i} pointerEvents="none" style={[es.third, { left: `${i * 33.33}%`, top: 0, bottom: 0, width: StyleSheet.hairlineWidth }]} />)}
                {[1, 2].map(i => <View key={'h' + i} pointerEvents="none" style={[es.third, { top: `${i * 33.33}%`, left: 0, right: 0, height: StyleSheet.hairlineWidth }]} />)}
                {(['tl', 'tr', 'bl', 'br'] as const).map(hd => (
                  <View key={hd} {...responders[hd].panHandlers} hitSlop={10} style={[es.handle, hd.includes('t') ? { top: -8 } : { bottom: -8 }, hd.includes('l') ? { left: -8 } : { right: -8 }]}>
                    <View style={[es.corner, hd.includes('t') ? { top: 4, borderTopWidth: 4 } : { bottom: 4, borderBottomWidth: 4 }, hd.includes('l') ? { left: 4, borderLeftWidth: 4 } : { right: 4, borderRightWidth: 4 }]} />
                  </View>
                ))}
              </View>
            </View>
          )}
          {comparing && <View style={es.cmpTag}><Text style={es.cmpTagT}>ORIGINAL</Text></View>}
        </Pressable>

        <ScrollView style={es.tray} contentContainerStyle={es.trayIn} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Panel st={st} update={update} shot={shot} fonts={fonts} toast={toast} ui={ui} setUi={setUi} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Tab bar is a sibling of KeyboardAvoidingView so it always renders on top with z-index.
          iOS: floating Liquid Glass capsule (iOS 26+; blur on older iOS). Android: flat bar. */}
      {Platform.OS === 'ios' ? (
        <GlassSurface interactive style={es.tabsGlass}>{tabItems}</GlassSurface>
      ) : (
        <View style={[es.tabs, es.tabsAndroid]}>{tabItems}</View>
      )}
    </View>
  );
}

const es = StyleSheet.create({
  bar: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: GUTTER - 6 },
  ib: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  dim: { opacity: .35 },
  save: { borderWidth: 2, borderColor: '#cfe9e0', paddingVertical: 6, paddingHorizontal: 14, minWidth: 72, alignItems: 'center' },
  saveT: { color: C.fg, fontFamily: F.monoBold, fontSize: 14, letterSpacing: 1.4 },
  stage: { flex: 1, overflow: 'hidden' },
  dimmer: { position: 'absolute', backgroundColor: 'rgba(0,0,0,.55)' },
  cropBox: { position: 'absolute', borderWidth: 1.5, borderColor: C.fg },
  third: { position: 'absolute', backgroundColor: 'rgba(255,255,255,.45)' },
  handle: { position: 'absolute', width: 30, height: 30 },
  corner: { position: 'absolute', width: 18, height: 18, borderColor: C.fg },
  cmpTag: { position: 'absolute', top: 10, alignSelf: 'center', backgroundColor: C.fg, paddingVertical: 3, paddingHorizontal: 8 },
  cmpTagT: { color: '#000', fontFamily: F.monoBold, fontSize: 11, letterSpacing: 1.2 },
  tray: { flexGrow: 0, height: 236 },
  trayIn: { paddingHorizontal: GUTTER, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 92 : 72, gap: 12 },
  tabsGlass: {
    position: 'absolute', bottom: 6, left: 12, right: 12, zIndex: 100, flexDirection: 'row', alignItems: 'center',
    borderRadius: 34, padding: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.18)',
  },
  tabIos: { borderRadius: 28, paddingVertical: 8 },
  tabIosOn: { backgroundColor: 'rgba(255,255,255,0.14)' },
  tabs:{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 100, flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.15)', paddingTop: 8, paddingBottom: 4 },
  tabsAndroid: { backgroundColor: C.bg, borderTopColor: C.line, borderTopWidth: 1 },
  tab: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 4 },
  tabT: { color: C.fg, fontFamily: F.mono, fontSize: 9, letterSpacing: .6 },
});
