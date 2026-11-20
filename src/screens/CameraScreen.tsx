import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { CameraView, useCameraPermissions, type FlashMode, type LensInfo } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { GlassSurface, LIQUID_GLASS } from '../ui/Glass';
import { PRESET, PRESETS } from '../engine/catalog';
import { deviceName, metaFromExif, normalizePhoto, Shot } from '../engine/shots';
import { Crop, Meta, todayISO } from '../engine/state';
import { getPref, setPref } from '../store';
import { C, F } from '../theme';
import { GUTTER, SkThumb } from '../ui/controls';
import { Icon } from '../ui/Icon';

const ASPECTS: [string, number][] = [['4:3', 3 / 4], ['1:1', 1], ['16:9', 9 / 16], ['3:2', 2 / 3]];
const UW = 'AVCaptureDeviceTypeBuiltInUltraWideCamera', WIDE = 'AVCaptureDeviceTypeBuiltInWideAngleCamera', TELE = 'AVCaptureDeviceTypeBuiltInTelephotoCamera';
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

type Layer = { backgroundColor?: string; opacity: number; mixBlendMode?: ViewStyle['mixBlendMode']; backgroundImage?: string };
const rgb = (c: number[], k = 255) => `rgb(${c.map(v => Math.round(Math.max(0, Math.min(1, v)) * k)).join(',')})`;
const vignetteLayer = (v: number): Layer => ({
  opacity: 1,
  backgroundImage: `radial-gradient(circle at center, rgba(0,0,0,0) 45%, rgba(0,0,0,${Math.min(.85, v * 1.6).toFixed(2)}) 100%)`,
});

/**
 * iOS: approximates the Skia look live by stacking layers that use native blend modes
 * (CALayer compositing filters) over the camera preview. A gray layer in `saturation` mode
 * strips colour from everything beneath it, so mono looks render as true black & white in
 * real time, not just at capture.
 */
function computeViewfinderLayers(presetId: string): Layer[] {
  const pr = PRESET[presetId];
  if (!pr || presetId === 'original') return [];
  const t = pr.t ?? {};
  const L: Layer[] = [];

  if (pr.mono) {
    // 1. Remove colour entirely (keeps the camera's luminance).
    L.push({ backgroundColor: '#808080', mixBlendMode: 'saturation', opacity: 1 });
    // 2. Print tone (warm fibre, platinum, …) — `color` blend keeps luminance, swaps hue/sat.
    const [r, g, b] = pr.mono.tone;
    if (Math.abs(r - 1) + Math.abs(g - 1) + Math.abs(b - 1) > .02) {
      L.push({ backgroundColor: rgb([r * .5, g * .5, b * .5]), mixBlendMode: 'color', opacity: Math.min(1, (Math.abs(r - b) + Math.abs(r - g)) * 3) });
    }
    // 3. Harder contrast for punchy looks like Noir.
    if ((t.contrast ?? 0) > .15) L.push({ backgroundColor: '#000', mixBlendMode: 'soft-light', opacity: Math.min(.6, (t.contrast ?? 0) * 1.1) });
    if ((t.fade ?? 0) > 0) L.push({ backgroundColor: '#3a3a3a', mixBlendMode: 'lighten', opacity: (t.fade ?? 0) * 1.5 });
  } else {
    const sat = t.saturation ?? 0;
    if (sat < 0) L.push({ backgroundColor: '#808080', mixBlendMode: 'saturation', opacity: Math.min(.85, -sat * 1.4) });
    const warmth = t.warmth ?? 0;
    if (Math.abs(warmth) > .02) L.push({ backgroundColor: warmth > 0 ? 'rgb(255,150,50)' : 'rgb(50,130,255)', mixBlendMode: 'soft-light', opacity: Math.min(.7, Math.abs(warmth) * 1.8) });
    const tint = t.tint ?? 0;
    if (Math.abs(tint) > .02) L.push({ backgroundColor: tint > 0 ? 'rgb(230,60,200)' : 'rgb(60,220,90)', mixBlendMode: 'soft-light', opacity: Math.min(.6, Math.abs(tint) * 1.8) });
    // Split tone: shadows lifted toward the shadow colour, highlights multiplied by the highlight colour.
    if (pr.split?.s) L.push({ backgroundColor: rgb(pr.split.s), mixBlendMode: 'screen', opacity: Math.min(.5, (pr.split.sa ?? .3) * .45 + (t.fade ?? 0) * .3) });
    else if ((t.fade ?? 0) > 0) L.push({ backgroundColor: '#2a2a2a', mixBlendMode: 'lighten', opacity: (t.fade ?? 0) * 1.5 });
    if (pr.split?.h) L.push({ backgroundColor: rgb(pr.split.h), mixBlendMode: 'multiply', opacity: Math.min(.5, (pr.split.ha ?? .2) * .8) });
    const con = t.contrast ?? 0;
    if (con > .1) L.push({ backgroundColor: '#000', mixBlendMode: 'soft-light', opacity: Math.min(.4, con * .8) });
    else if (con < -.1) L.push({ backgroundColor: '#fff', mixBlendMode: 'soft-light', opacity: Math.min(.3, -con * .6) });
  }
  if ((t.vignette ?? 0) > 0) L.push(vignetteLayer(t.vignette ?? 0));
  return L;
}

/**
 * Android fallback: CameraX renders its preview into a SurfaceView, which sits outside the
 * normal view compositing, so blend modes can't reach it. We use plain tinted overlays there.
 */
function computeViewfinderTint(presetId: string): { backgroundColor: string; opacity: number } | null {
  if (presetId === 'original') return null;
  const pr = PRESET[presetId];
  if (!pr) return null;

  if (pr.mono) return { backgroundColor: '#080808', opacity: 0.40 };

  const t = pr.t ?? {};
  const fade = t.fade ?? 0;
  const warmth = t.warmth ?? 0;
  const sp = pr.split;

  // Base opacity: always at least 0.20, boosted by fade/warmth strength
  const opacity = Math.min(0.46, 0.20 + Math.abs(fade) * 0.35 + Math.abs(warmth) * 0.22);

  // Use shadow split-tone color when available (most cinematic/film presets define one)
  if (sp?.s) {
    const [rv, gv, bv] = sp.s;
    const r = Math.round(rv * 255);
    const g = Math.round(gv * 255);
    const b = Math.round(bv * 255);
    return { backgroundColor: `rgb(${r},${g},${b})`, opacity };
  }

  // Fall back to per-family signature colors
  if (warmth > 0.12) return { backgroundColor: 'rgb(220,160,80)', opacity };
  if (warmth < -0.12) return { backgroundColor: 'rgb(70,130,220)', opacity };
  switch (pr.cat) {
    case 'film':     return { backgroundColor: 'rgb(190,160,110)', opacity };
    case 'cinema':   return { backgroundColor: 'rgb(55,135,145)', opacity };
    case 'portrait': return { backgroundColor: 'rgb(220,165,135)', opacity };
    case 'street':   return { backgroundColor: 'rgb(110,115,95)',  opacity };
    case 'night':    return { backgroundColor: 'rgb(45,75,160)',   opacity };
    default:         return { backgroundColor: 'rgb(128,128,128)', opacity: 0.20 };
  }
}

export default function CameraScreen({ lastShot, onCaptured, onOpenGallery, busy, toast }: {
  lastShot: Shot | null;
  onCaptured: (uri: string, meta: Meta, init: { preset: string; exposure: number }) => void;
  onOpenGallery: () => void;
  busy: boolean;
  toast: (m: string) => void;
}) {
  const [perm, requestPerm] = useCameraPermissions();
  const cam = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [flash, setFlash] = useState<'off' | 'on' | 'auto'>('off');
  const [timer, setTimer] = useState(0);
  const [grid, setGrid] = useState(false);
  const [aspect, setAspect] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [lens, setLens] = useState<string | undefined>(undefined);
  const [lenses, setLenses] = useState<LensInfo[]>([]);
  const [ev, setEv] = useState(0);
  const [preset, setPresetState] = useState('original');
  const [count, setCount] = useState(0);
  const [focus, setFocus] = useState<{ x: number; y: number } | null>(null);
  const [shooting, setShooting] = useState(false);
  const [screenFlash, setScreenFlash] = useState(false);
  const [wrap, setWrap] = useState({ w: 0, h: 0 });

  useEffect(() => { getPref('camPreset', 'original').then(setPresetState); }, []);
  const setPreset = (id: string) => { setPresetState(id); setPref('camPreset', id); Haptics.selectionAsync().catch(() => {}); };

  const r = ASPECTS[aspect][1];
  const vf = useMemo(() => {
    if (!wrap.w) return { w: 0, h: 0 };
    let w = wrap.w, h = w / r; if (h > wrap.h) { h = wrap.h; w = h * r; }
    return { w: Math.floor(w), h: Math.floor(h) };
  }, [wrap, r]);

  const viewfinderLayers = useMemo(() => {
    if (Platform.OS === 'ios') return computeViewfinderLayers(preset);
    const v = PRESET[preset]?.t?.vignette ?? 0; // plain (non-blended) vignette works on Android too
    return v > 0 ? [vignetteLayer(v)] : [];
  }, [preset]);
  const viewfinderTint = useMemo(() => (Platform.OS === 'ios' ? null : computeViewfinderTint(preset)), [preset]);

  const live = useRef({ zoom, ev, focus }); live.current = { zoom, ev, focus };
  const g = useRef<{ pinch?: { d: number; z: number }; ev?: number; moved?: boolean; t0?: number }>({});
  const hideT = useRef<ReturnType<typeof setTimeout>>(undefined);
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { g.current = { ev: live.current.ev, moved: false, t0: Date.now() }; },
    onPanResponderMove: (e, gs) => {
      const t = e.nativeEvent.touches;
      if (t.length >= 2) {
        const d = Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);
        if (!g.current.pinch) g.current.pinch = { d, z: live.current.zoom };
        setZoom(Math.max(1, Math.min(5, g.current.pinch.z * d / g.current.pinch.d)));
        g.current.moved = true; return;
      }
      if (live.current.focus && Math.abs(gs.dy) > 6 && !g.current.pinch) {
        g.current.moved = true;
        setEv(Math.max(-2, Math.min(2, (g.current.ev || 0) - gs.dy / 90)));
        clearTimeout(hideT.current); hideT.current = setTimeout(() => setFocus(null), 2500);
      }
    },
    onPanResponderRelease: (e, gs) => {
      if (!g.current.moved && Math.abs(gs.dx) < 8 && Math.abs(gs.dy) < 8 && Date.now() - (g.current.t0 || 0) < 400) {
        setFocus({ x: e.nativeEvent.locationX, y: e.nativeEvent.locationY });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        clearTimeout(hideT.current); hideT.current = setTimeout(() => setFocus(null), 2500);
      }
      g.current = {};
    },
  }), []);

  const hasUW = lenses.some(l => l.deviceType === UW), hasTele = lenses.some(l => l.deviceType === TELE);
  const pills: { label: string; on: boolean; go: () => void }[] = [];
  if (facing === 'back' && hasUW) pills.push({ label: '.5', on: lens === UW, go: () => { setLens(UW); setZoom(1); } });
  pills.push({ label: '1', on: (lens === WIDE || !lens) && Math.abs(zoom - 1) < .05, go: () => { setLens(WIDE); setZoom(1); } });
  pills.push({ label: '2', on: (lens === WIDE || !lens) && Math.abs(zoom - 2) < .05, go: () => { setLens(WIDE); setZoom(2); } });
  if (facing === 'back' && hasTele) pills.push({ label: 'TELE', on: lens === TELE, go: () => { setLens(TELE); setZoom(1); } });

  const shoot = async () => {
    if (shooting || busy) return;
    if (!cam.current) { toast('Camera is still starting, try again'); return; }
    // Don't silently ignore taps if onCameraReady hasn't fired: try anyway and surface any error.
    if (!ready) await wait(150);
    setShooting(true);
    try {
      if (timer) { for (let i = timer; i > 0; i--) { setCount(i); Haptics.selectionAsync().catch(() => {}); await wait(1000); } setCount(0); }
      if (flash !== 'off' && facing === 'front') { setScreenFlash(true); await wait(220); }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      if (!cam.current) throw new Error('camera closed');
      const pic = await cam.current.takePictureAsync({ quality: 1, exif: true });
      if (!pic?.uri) throw new Error('no image returned');
      setScreenFlash(false);
      const pr = pic.width > pic.height ? 1 / r : r, pa = pic.width / pic.height;
      let w = 1, h = 1; if (pa > pr) w = pr / pa; else h = pa / pr;
      w /= zoom; h /= zoom;
      const crop: Crop = { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
      const uri = await normalizePhoto(pic.uri, pic.width, pic.height, crop);
      const m = metaFromExif(pic.exif);
      const meta: Meta = {
        cam: m.cam || `${deviceName()} ${facing === 'front' ? 'Front' : 'Back'} Camera`,
        specs: m.specs || `${zoom.toFixed(1)}x${Math.abs(ev) > .04 ? ` | EV${ev > 0 ? '+' : ''}${ev.toFixed(1)}` : ''}`,
        date: m.date || todayISO(),
      };
      onCaptured(uri, meta, { preset, exposure: ev * 50 });
    } catch (e: any) {
      toast(`The camera didn't take the photo: ${e?.message || e}`);
    } finally { setShooting(false); setCount(0); setScreenFlash(false); }
  };

  const granted = !!perm?.granted;
  const flashIcon = flash === 'off' ? 'flashOff' : flash === 'on' ? 'flash' : 'flashAuto';
  const camFlash: FlashMode = facing === 'front' ? 'off' : flash;

  return (
    <View style={{ flex: 1 }}>
      <GlassSurface interactive style={[cs.bar, LIQUID_GLASS && cs.barGlass]}>
        <Pressable style={[cs.ib, flash !== 'off' && cs.on]} accessibilityLabel={`Flash ${flash}`} onPress={() => setFlash(f => (f === 'off' ? 'on' : f === 'on' ? 'auto' : 'off'))}>
          <Icon name={flashIcon} color={flash !== 'off' ? C.accent : C.fg} />
        </Pressable>
        <Pressable style={cs.pill} accessibilityLabel="Aspect ratio" onPress={() => setAspect(a => (a + 1) % ASPECTS.length)}>
          <Text style={cs.pillT}>{ASPECTS[aspect][0]}</Text>
        </Pressable>
        <Pressable style={cs.ib} accessibilityLabel={timer ? `Timer ${timer} seconds` : 'Timer off'} onPress={() => setTimer(t => (t === 0 ? 3 : t === 3 ? 10 : 0))}>
          <Icon name="timer" color={timer ? C.accent : C.fg} />
          {!!timer && <Text style={cs.badge}>{timer}s</Text>}
        </Pressable>
        <Pressable style={cs.ib} accessibilityLabel="Grid" accessibilityState={{ selected: grid }} onPress={() => setGrid(v => !v)}>
          <Icon name="grid" color={grid ? C.accent : C.fg} />
        </Pressable>
        <Text style={cs.ev}>{Math.abs(ev) > .04 ? `EV ${ev > 0 ? '+' : ''}${ev.toFixed(1)}` : ''}</Text>
      </GlassSurface>

      <View style={cs.vfWrap} onLayout={e => setWrap({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {granted ? (
          <View style={[cs.vf, { width: vf.w, height: vf.h }]} {...responder.panHandlers}>
            <View style={{ flex: 1, transform: [{ scale: zoom }] }} pointerEvents="none">
              <CameraView ref={cam} style={{ flex: 1 }} facing={facing} flash={camFlash} mirror={facing === 'front'}
                selectedLens={lens} animateShutter={false} onCameraReady={() => setReady(true)}
                onAvailableLensesChanged={(e) => setLenses(e.lenses || [])}
                onMountError={(e) => toast(`Camera unavailable: ${e.message}`)} />
            </View>
            {/* Real-time filter preview: blend-mode layers on iOS, tint on Android */}
            {viewfinderLayers.map((l, i) => (
              <View key={`${preset}-${i}`} pointerEvents="none" style={[StyleSheet.absoluteFill, l]} />
            ))}
            {viewfinderTint && (
              <View pointerEvents="none" style={[StyleSheet.absoluteFill, viewfinderTint]} />
            )}
            {preset !== 'original' && (
              <View pointerEvents="none" style={cs.lookTag}>
                <Text style={cs.lookTagT}>{PRESETS.find(p => p.id === preset)?.name.toUpperCase()}</Text>
                {PRESET[preset]?.mono && <Text style={[cs.lookTagT, { letterSpacing: 0 }]}> · B&W</Text>}
              </View>
            )}
            {Math.abs(ev) > .04 && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: ev > 0 ? '#fff' : '#000', opacity: Math.min(.5, Math.abs(ev) * .17) }]} />}
            {grid && <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              {[1, 2].map(i => <View key={'v' + i} style={[cs.gl, { left: `${i * 33.33}%`, top: 0, bottom: 0, width: StyleSheet.hairlineWidth }]} />)}
              {[1, 2].map(i => <View key={'h' + i} style={[cs.gl, { top: `${i * 33.33}%`, left: 0, right: 0, height: StyleSheet.hairlineWidth }]} />)}
            </View>}
            {focus && <View pointerEvents="none" style={[cs.focus, { left: focus.x - 38, top: focus.y - 38 }]}>
              <View style={[cs.sun, { top: 38 - 9 - ev * 18 }]}><Icon name="sun" size={18} color={C.accent} /></View>
            </View>}
            {!!count && <View pointerEvents="none" style={[StyleSheet.absoluteFill, cs.center]}><Text style={cs.count}>{count}</Text></View>}
            <View style={cs.zoom}>
              {pills.map(p => (
                <Pressable key={p.label} onPress={p.go} style={[cs.zp, p.on && { backgroundColor: 'rgba(0,0,0,.6)' }]} accessibilityLabel={`Zoom ${p.label}`}>
                  <Text style={[cs.zpT, p.on && { color: C.accent }]}>{p.label}{p.on && p.label !== 'TELE' ? '×' : ''}</Text>
                </Pressable>
              ))}
              {!pills.some(p => p.on) && <View style={[cs.zp, { backgroundColor: 'rgba(0,0,0,.6)' }]}><Text style={[cs.zpT, { color: C.accent }]}>{zoom.toFixed(1)}×</Text></View>}
            </View>
          </View>
        ) : (
          <View style={[cs.center, { padding: 28, gap: 14 }]}>
            <Text style={cs.permTitle}>AESTHETE NEEDS YOUR CAMERA</Text>
            <Text style={cs.permBody}>Photos stay on your phone. Grant access to start shooting.</Text>
            <Pressable style={cs.permBtn} onPress={requestPerm}><Text style={cs.permBtnT}>ALLOW CAMERA</Text></Pressable>
          </View>
        )}
        {(busy || shooting) && <View style={[StyleSheet.absoluteFill, cs.center, { backgroundColor: 'rgba(0,0,0,.35)' }]}><ActivityIndicator color={C.accent} /></View>}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={cs.strip}>
        {PRESETS.map(p => (
          <Pressable key={p.id} onPress={() => setPreset(p.id)} style={[cs.chip, p.id === preset && cs.chipOn]} accessibilityLabel={`${p.name}: ${p.sub}`}>
            <Text style={[cs.chipT, p.id === preset && { color: C.accentInk, fontFamily: F.monoBold }]}>{p.name.toUpperCase()}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={cs.bottom}>
        {/* Library / gallery button — opens full gallery to edit any photo */}
        <Pressable style={cs.last} onPress={onOpenGallery} accessibilityLabel="Open photo library">
          {lastShot ? <SkThumb image={lastShot.thumb} size={48} /> : <Icon name="library" />}
        </Pressable>
        <Pressable style={cs.shutter} onPress={granted ? shoot : requestPerm} accessibilityLabel="Take photo">
          {({ pressed }) => <View style={[cs.shutterIn, pressed && { transform: [{ scale: .9 }] }]} />}
        </Pressable>
        <Pressable style={cs.flip} onPress={() => { setFacing(f => (f === 'back' ? 'front' : 'back')); setLens(undefined); setZoom(1); setReady(false); }} accessibilityLabel="Switch camera">
          <Icon name="flip" />
        </Pressable>
      </View>
      {screenFlash && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#fff' }]} />}
    </View>
  );
}

const cs = StyleSheet.create({
  bar: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: GUTTER - 6 },
  barGlass: { marginHorizontal: 10, marginTop: 4, marginBottom: 6, borderRadius: 26 },
  ib: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  on: {},
  badge: { position: 'absolute', right: 0, bottom: 2, color: C.accent, fontFamily: F.monoBold, fontSize: 9 },
  pill: { borderWidth: 1.5, borderColor: C.fg, paddingVertical: 4, paddingHorizontal: 10 },
  pillT: { color: C.fg, fontFamily: F.monoBold, fontSize: 13, letterSpacing: 1 },
  ev: { width: 64, textAlign: 'right', color: C.accent, fontFamily: F.mono, fontSize: 11 },
  vfWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  vf: { overflow: 'hidden', backgroundColor: '#111' },
  gl: { position: 'absolute', backgroundColor: 'rgba(255,255,255,.4)' },
  focus: { position: 'absolute', width: 76, height: 76, borderWidth: 1.5, borderColor: C.accent },
  sun: { position: 'absolute', right: -28 },
  lookTag: { position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(0,0,0,.55)', paddingVertical: 3, paddingHorizontal: 7, flexDirection: 'row' },
  lookTagT: { color: C.accent, fontFamily: F.monoBold, fontSize: 10, letterSpacing: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  count: { color: C.fg, fontFamily: F.display, fontSize: 120 },
  zoom: { position: 'absolute', bottom: 12, alignSelf: 'center', flexDirection: 'row', gap: 6, backgroundColor: 'rgba(0,0,0,.35)', borderRadius: 999, padding: 4 },
  zp: { minWidth: 36, height: 36, paddingHorizontal: 6, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.1)' },
  zpT: { color: C.fg, fontFamily: F.monoBold, fontSize: 11 },
  strip: { paddingHorizontal: GUTTER, paddingTop: 10, paddingBottom: 4, gap: 6 },
  chip: { borderWidth: 1, borderColor: C.line, paddingVertical: 6, paddingHorizontal: 10 },
  chipOn: { backgroundColor: C.accent, borderColor: C.accent },
  chipT: { color: C.fg, fontFamily: F.mono, fontSize: 11, letterSpacing: .6 },
  bottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: GUTTER + 8, paddingTop: 10, paddingBottom: 14 },
  last: { width: 52, height: 52, borderWidth: 2, borderColor: C.fg, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#222' },
  shutter: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: C.fg, alignItems: 'center', justifyContent: 'center' },
  shutterIn: { width: 60, height: 60, borderRadius: 30, backgroundColor: C.fg },
  flip: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,.1)', alignItems: 'center', justifyContent: 'center' },
  permTitle: { color: C.fg, fontFamily: F.monoBold, fontSize: 14, letterSpacing: 1.2, textAlign: 'center' },
  permBody: { color: C.mute, fontFamily: F.mono, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  permBtn: { backgroundColor: C.accent, paddingVertical: 10, paddingHorizontal: 18 },
  permBtnT: { color: C.accentInk, fontFamily: F.monoBold, fontSize: 13, letterSpacing: 1 },
});
