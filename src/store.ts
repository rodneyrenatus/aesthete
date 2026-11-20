import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Analog, Frame, Tune } from './engine/state';

export interface Recipe {
  name: string; preset: string; strength: number; tune: Tune; analog: Analog;
  frame: Pick<Frame, 'type' | 'thick' | 'palette'>;
}

const KEY = 'aesthete.recipes';
export async function loadRecipes(): Promise<Recipe[]> {
  try { const v = await AsyncStorage.getItem(KEY); return v ? JSON.parse(v) : []; } catch { return []; }
}
export async function saveRecipes(list: Recipe[]) {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(list)); } catch {}
}
export async function getPref<T>(k: string, d: T): Promise<T> {
  try { const v = await AsyncStorage.getItem('aesthete.' + k); return v ? JSON.parse(v) : d; } catch { return d; }
}
export function setPref(k: string, v: unknown) { AsyncStorage.setItem('aesthete.' + k, JSON.stringify(v)).catch(() => {}); }
