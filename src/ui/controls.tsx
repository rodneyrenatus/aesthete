import React, { useEffect, useRef, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, type ScrollViewInstance, StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';
import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import { Canvas, Image as SkImageView, type SkImage } from '@shopify/react-native-skia';
import { C, F } from '../theme';
import { Icon } from './Icon';

export const GUTTER = 16;

/** iPhone-style scrolling ruler. One unit = 4pt. */
export function Ruler({ min, max, value, onChange }: { min: number; max: number; value: number; onChange: (v: number) => void }) {
  const PX = 4;
  const [w, setW] = useState(0);
  const ref = useRef<ScrollViewInstance>(null);
  const cur = useRef(value);
  const dragging = useRef(false);
  const lastW = useRef(0);
  useEffect(() => {
    if (!w || dragging.current) return;
    if (value !== cur.current || lastW.current !== w) {
      lastW.current = w; cur.current = value;
      ref.current?.scrollTo({ x: (value - min) * PX, animated: false });
    }
  }, [value, w, min]);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const v = Math.max(min, Math.min(max, Math.round(min + e.nativeEvent.contentOffset.x / PX)));
    if (v !== cur.current) {
      cur.current = v; onChange(v);
      if (v % 10 === 0) Haptics.selectionAsync().catch(() => {});
    }
  };
  const ticks: React.ReactNode[] = [];
  for (let u = min; u <= max; u += 2) {
    const major = u % 10 === 0;
    ticks.push(<View key={u} style={{ position: 'absolute', left: (u - min) * PX, top: major ? 11 : 15, width: major ? 1.5 : 1, height: major ? 18 : 10, backgroundColor: major ? C.fg : C.mute }} />);
  }
  return (
    <View style={s.ruler} onLayout={e => setW(e.nativeEvent.layout.width)}>
      <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={16}
        contentOffset={{ x: (value - min) * PX, y: 0 }}
        onScrollBeginDrag={() => { dragging.current = true; }} onMomentumScrollEnd={() => { dragging.current = false; }}
        onScrollEndDrag={() => { setTimeout(() => { dragging.current = false; }, 400); }}>
        <View style={{ width: w / 2 }} />
        <View style={{ width: (max - min) * PX, height: 40 }}>
          {ticks}
          {min < 0 && <View style={{ position: 'absolute', left: -min * PX - 2.5, top: 2, width: 5, height: 5, borderRadius: 3, backgroundColor: C.fg }} />}
        </View>
        <View style={{ width: w / 2 }} />
      </ScrollView>
      <View pointerEvents="none" style={[s.mark, { left: w / 2 - 1 }]} />
    </View>
  );
}

export function SliderRow({ label, min, max, value, onChange, fmt = (v: number) => String(v), step = 1 }: {
  label: string; min: number; max: number; value: number; onChange: (v: number) => void; fmt?: (v: number) => string; step?: number;
}) {
  const [live, setLive] = useState(value);
  useEffect(() => setLive(value), [value]);
  return (
    <View style={s.sl}>
      <Text style={s.slLabel}>{label.toUpperCase()}</Text>
      <Slider style={{ flex: 1, height: 32 }} minimumValue={min} maximumValue={max} step={step} value={value}
        minimumTrackTintColor={C.fg} maximumTrackTintColor={C.line} thumbTintColor={C.fg}
        onValueChange={v => { setLive(v); onChange(v); Haptics.selectionAsync().catch(() => {}); }} accessibilityLabel={label} />
      <Text style={s.slVal}>{fmt(Math.round(live))}</Text>
    </View>
  );
}

export function Card({ label, on, onPress, children, wide, a11y }: { label: string; on: boolean; onPress: () => void; children?: React.ReactNode; wide?: boolean; a11y?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={a11y || label}
      style={[s.card, wide && { width: 86 }, on && { borderColor: C.accent }]}>
      <View style={s.cardTh}>{children}</View>
      <View style={[s.cardLbl, on && { backgroundColor: C.accent }]}>
        <Text numberOfLines={1} style={[s.cardLblT, on && { fontFamily: F.monoBold }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

export function SkThumb({ image, size }: { image: SkImage | null; size: number }) {
  if (!image) return <View style={{ width: size, height: size, backgroundColor: '#111' }} />;
  return (
    <Canvas style={{ width: size, height: size }}>
      <SkImageView image={image} x={0} y={0} width={size} height={size} fit="cover" />
    </Canvas>
  );
}
export const NoneThumb = () => <Icon name="none" size={40} />;

export function HRow({ children, gap = 10, style }: { children: React.ReactNode; gap?: number; style?: ViewStyle }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[{ marginHorizontal: -GUTTER, flexGrow: 0 }, style]}
      contentContainerStyle={{ paddingHorizontal: GUTTER, gap, alignItems: 'center' }}>
      {children}
    </ScrollView>
  );
}

export function Seg<K extends string>({ items, value, onChange }: { items: [K, string][]; value: K; onChange: (k: K) => void }) {
  return (
    <HRow gap={2}>
      {items.map(([k, l]) => (
        <Pressable key={k} onPress={() => onChange(k)} accessibilityRole="tab" accessibilityState={{ selected: k === value }}
          style={[s.seg, k === value && { backgroundColor: C.fg }]}>
          <Text style={[s.segT, k === value && { color: '#000' }]}>{l}</Text>
        </Pressable>
      ))}
    </HRow>
  );
}

export function Chips<K extends string>({ items, value, onChange }: { items: [K, string][]; value: K; onChange: (k: K) => void }) {
  return (
    <HRow gap={6}>
      {items.map(([k, l]) => (
        <Pressable key={k} onPress={() => onChange(k)} accessibilityRole="button" accessibilityState={{ selected: k === value }}
          style={[s.chip, k === value && { borderColor: C.accent }]}>
          <Text style={[s.chipT, k === value && { color: C.accent }]}>{l.toUpperCase()}</Text>
        </Pressable>
      ))}
    </HRow>
  );
}

export function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable onPress={() => onChange(!value)} accessibilityRole="switch" accessibilityState={{ checked: value }} style={s.tog}>
      <View style={[s.togBox, value && { backgroundColor: C.accent }]}>
        <View style={[s.togKnob, value && { transform: [{ translateX: 16 }], backgroundColor: C.accentInk }]} />
      </View>
      <Text style={s.label}>{label.toUpperCase()}</Text>
    </Pressable>
  );
}

export function Field({ label, value, onChange, placeholder, maxLength = 60 }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number }) {
  return (
    <View style={s.fld}>
      <Text style={[s.label, { width: 72, color: C.mute }]}>{label.toUpperCase()}</Text>
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="#5a574f" maxLength={maxLength}
        style={s.input} keyboardAppearance="dark" autoCorrect={false} accessibilityLabel={label} />
    </View>
  );
}

export function Btn({ label, icon, onPress, primary }: { label: string; icon?: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={[s.btn, primary && { backgroundColor: C.accent, borderColor: C.accent }]}>
      {icon && <Icon name={icon} size={18} color={primary ? C.accentInk : C.fg} />}
      <Text style={[s.btnT, primary && { color: C.accentInk, fontFamily: F.monoBold }]}>{label.toUpperCase()}</Text>
    </Pressable>
  );
}

export const Note = ({ children, accent }: { children: React.ReactNode; accent?: boolean }) => (
  <Text style={[s.note, accent && { color: C.accent }]}>{children}</Text>
);

export const s = StyleSheet.create({
  ruler: { height: 40, marginHorizontal: -GUTTER },
  mark: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: C.accent },
  sl: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  slLabel: { width: 96, color: C.fg, fontFamily: F.mono, fontSize: 11, letterSpacing: .6 },
  slVal: { width: 44, textAlign: 'right', color: C.accent, fontFamily: F.monoBold, fontSize: 11, fontVariant: ['tabular-nums'] },
  card: { width: 74, borderWidth: 2, borderColor: C.card, backgroundColor: '#000' },
  cardTh: { width: '100%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  cardLbl: { backgroundColor: C.label, paddingVertical: 3, paddingHorizontal: 2 },
  cardLblT: { color: C.ink, textAlign: 'center', fontFamily: F.mono, fontSize: 11 },
  seg: { paddingVertical: 7, paddingHorizontal: 12 },
  segT: { color: C.fg, fontFamily: F.monoBold, fontSize: 13 },
  chip: { borderWidth: 1, borderColor: C.line, paddingVertical: 5, paddingHorizontal: 10 },
  chipT: { color: C.fg, fontFamily: F.mono, fontSize: 11, letterSpacing: .5 },
  tog: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  togBox: { width: 38, height: 22, borderRadius: 11, backgroundColor: C.line, justifyContent: 'center', paddingHorizontal: 3 },
  togKnob: { width: 16, height: 16, borderRadius: 8, backgroundColor: C.fg },
  label: { color: C.fg, fontFamily: F.mono, fontSize: 11, letterSpacing: .6 },
  fld: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { flex: 1, color: C.fg, fontFamily: F.mono, fontSize: 14, borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 6 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: C.line, paddingVertical: 8, paddingHorizontal: 12 },
  btnT: { color: C.fg, fontFamily: F.mono, fontSize: 11, letterSpacing: .8 },
  note: { color: C.mute, fontFamily: F.mono, fontSize: 11, lineHeight: 16 },
});
