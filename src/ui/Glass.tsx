import React from 'react';
import { Platform, StyleProp, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';

/**
 * Liquid Glass is an iOS-only design language (iOS 26+). On those devices we render the
 * native glass material; on older iOS we fall back to a system blur; on Android we render
 * a plain opaque surface, because there is no Liquid Glass there.
 */
export const LIQUID_GLASS = (() => {
  if (Platform.OS !== 'ios') return false;
  try { return isLiquidGlassAvailable() && isGlassEffectAPIAvailable(); } catch { return false; }
})();

export function GlassSurface({ style, children, interactive, fallback, tintColor }: {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  interactive?: boolean;
  /** Style used on Android (no glass, no blur). */
  fallback?: StyleProp<ViewStyle>;
  tintColor?: string;
}) {
  if (LIQUID_GLASS) {
    return (
      <GlassView style={style} glassEffectStyle="regular" colorScheme="dark" isInteractive={interactive} tintColor={tintColor}>
        {children}
      </GlassView>
    );
  }
  if (Platform.OS === 'ios') {
    return <BlurView intensity={80} tint="systemUltraThinMaterialDark" style={[style, { overflow: 'hidden' }]}>{children}</BlurView>;
  }
  return <View style={[style, fallback]}>{children}</View>;
}
