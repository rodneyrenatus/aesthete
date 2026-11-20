import React from 'react';
import Svg, { Circle, Path, Rect, Text as SvgText } from 'react-native-svg';
import { C } from '../theme';

type El =
  | { p: string; fill?: boolean }
  | { c: [number, number, number]; fill?: boolean }
  | { r: [number, number, number, number, number?]; fill?: boolean; op?: number }
  | { t: [string, number, number, number] };

const P = (p: string, fill?: boolean): El => ({ p, fill });
const Ci = (cx: number, cy: number, r: number, fill?: boolean): El => ({ c: [cx, cy, r], fill });
const R = (x: number, y: number, w: number, h: number, rx = 0, fill?: boolean, op?: number): El => ({ r: [x, y, w, h, rx], fill, op });

export const ICONS: Record<string, El[]> = {
  back: [P('M20 12H4m6-6-6 6 6 6')],
  undo: [P('M9 14 4 9l5-5'), P('M4 9h11a5 5 0 0 1 0 10h-4')],
  redo: [P('m15 14 5-5-5-5'), P('M20 9H9a5 5 0 0 0 0 10h4')],
  compare: [R(3, 5, 18, 14, 1), P('M12 5h8a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-8z', true)],
  flash: [P('M13 2 4 14h7l-1 8 9-12h-7z')],
  flashOff: [P('M13 2 4 14h7l-1 8 9-12h-7z'), P('M3 3l18 18')],
  flashAuto: [P('M11 2 3 13h6l-1 8 8-11h-6z'), P('M16 21l2.5-7 2.5 7M17 19h3')],
  timer: [Ci(12, 13, 8), P('M12 9v4l2 2M9 2h6')],
  grid: [R(3, 3, 18, 18, 1), P('M9 3v18M15 3v18M3 9h18M3 15h18')],
  flip: [P('M4 10h13l-3-3'), P('M20 14H7l3 3')],
  presets: [P('M19.5 12a7.5 7.5 0 1 1-4-6.6'), P('M18.5 2.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z')],
  tune: [Ci(12, 12, 9), P('M12 3v4M12 17v4M3 12h4M17 12h4'), Ci(12, 12, 2.5)],
  crop: [P('M7 2v15h15'), P('M2 7h15v15')],
  analog: [Ci(12, 12, 9), Ci(12, 7.3, 2), Ci(16.5, 10.6, 2), Ci(14.8, 15.9, 2), Ci(9.2, 15.9, 2), Ci(7.5, 10.6, 2)],
  polaroid: [R(4, 3, 16, 18, 1), R(4, 15, 16, 6, 0, true)],
  recipe: [P('M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z'), P('M14 3v5h5'), P('m12 10.5 1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z')],
  rotate: [P('M3 12a9 9 0 1 0 3-6.7'), P('M3 3v5h5')],
  mirror: [P('M12 3v18'), P('M8 7 3 17h5zM16 7l5 10h-5z')],
  reset: [P('M4 4v6h6'), P('M20 12a8 8 0 0 0-14.3-5L4 10m0 4a8 8 0 0 0 14.3 3')],
  plus: [P('M12 5v14M5 12h14')],
  none: [Ci(12, 12, 9), P('M5.6 18.4 18.4 5.6')],
  sun: [Ci(12, 12, 4), P('M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4')],
  library: [R(3, 5, 14, 14, 1), P('M7 3h12a2 2 0 0 1 2 2v12'), P('m3 16 4-4 4 4 2-2 4 4')],
  exposure: [Ci(12, 12, 9), P('M5.6 18.4 18.4 5.6M7 9.5h4M9 7.5v4M13.5 15h4')],
  brilliance: [P('M12 3l1.9 6.6L20.5 12l-6.6 1.9L12 20.5l-1.9-6.6L3.5 12l6.6-1.9z')],
  highlights: [Ci(12, 12, 9), P('M6 8h12M4.5 11h15')],
  shadows: [Ci(12, 12, 9), P('M4.5 13h15M6 16h12')],
  contrast: [Ci(12, 12, 9), P('M12 3a9 9 0 0 1 0 18z', true)],
  brightness: [Ci(12, 12, 4), P('M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4')],
  black: [Ci(12, 12, 9), Ci(12, 12, 4, true)],
  saturation: [Ci(9, 10, 5), Ci(15, 10, 5), Ci(12, 15, 5)],
  vibrance: [P('M12 3c4 5 6.5 8 6.5 11.2a6.5 6.5 0 0 1-13 0C5.5 11 8 8 12 3z'), P('M9 14.5a3 3 0 0 0 3 3')],
  warmth: [P('M10 4.5a2 2 0 0 1 4 0v9.6a4.2 4.2 0 1 1-4 0z'), P('M12 11v6')],
  tint: [P('M12 3c4 5 6.5 8 6.5 11.2a6.5 6.5 0 0 1-13 0C5.5 11 8 8 12 3z'), P('M12 3c4 5 6.5 8 6.5 11.2A6.5 6.5 0 0 1 12 20.7z', true)],
  sharpness: [P('M12 4l8.5 15h-17z')],
  definition: [P('M12 4l8.5 15h-17z'), P('M12 10.5l3.6 6.2H8.4z')],
  noise: [Ci(7, 7, 1.3, true), Ci(12, 7, 1.3, true), Ci(17, 7, 1.3, true), Ci(9.5, 12, 1.3, true), Ci(14.5, 12, 1.3, true), Ci(7, 17, 1.3, true), Ci(12, 17, 1.3, true), Ci(17, 17, 1.3, true)],
  vignette: [R(3, 5, 18, 14, 2), Ci(12, 12, 4)],
  // frame styles
  f_b1: [R(3, 3, 18, 18), R(5.5, 5.5, 13, 13, 0, true, .25)],
  f_p1: [R(3, 2, 18, 20), R(5, 4, 14, 12, 0, true, .25)],
  f_p3: [R(3, 2, 18, 20), { t: ['Date', 5, 8.2, 5] }, R(5, 10, 14, 10, 0, true, .25)],
  f_p4: [R(3, 2, 18, 20), R(5, 4, 14, 11, 0, true, .25), P('M5.5 18h6M5.5 20h3')],
  f_pt1: [R(3, 2, 18, 20), R(5, 4, 14, 11, 0, true, .25), { t: ['2026', 5, 20.6, 5.2] }],
  f_ex1: [R(3, 3, 18, 18), R(5, 5, 14, 10, 0, true, .25), P('M5.5 17.5h5M5.5 19.2h3'), R(15, 17.5, 1.6, 1.6, 0, true), R(17.2, 17.5, 1.6, 1.6, 0, true)],
  f_fs1: [R(2, 4, 20, 16), R(4, 8, 16, 8, 0, true, .25), P('M4 6h1.5M8 6h1.5M12 6h1.5M16 6h1.5M4 18h1.5M8 18h1.5M12 18h1.5M16 18h1.5')],
};

export function Icon({ name, size = 24, color = C.fg, stroke = 1.6 }: { name: string; size?: number; color?: string; stroke?: number }) {
  const els = ICONS[name] || [];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {els.map((e, i) => {
        if ('p' in e) return <Path key={i} d={e.p} stroke={e.fill ? 'none' : color} fill={e.fill ? color : 'none'} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />;
        if ('c' in e) return <Circle key={i} cx={e.c[0]} cy={e.c[1]} r={e.c[2]} stroke={e.fill ? 'none' : color} fill={e.fill ? color : 'none'} strokeWidth={stroke} />;
        if ('r' in e) return <Rect key={i} x={e.r[0]} y={e.r[1]} width={e.r[2]} height={e.r[3]} rx={e.r[4] || 0} stroke={e.fill ? 'none' : color} fill={e.fill ? color : 'none'} opacity={e.op ?? 1} strokeWidth={stroke} />;
        return <SvgText key={i} x={e.t[1]} y={e.t[2]} fontSize={e.t[3]} fontWeight="900" fill={color}>{e.t[0]}</SvgText>;
      })}
    </Svg>
  );
}
