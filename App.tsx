import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Asset, AssetField, getPermissionsAsync, MediaType, Query } from 'expo-media-library';
import { useTypeface } from '@shopify/react-native-skia';
import { SpaceMono_400Regular } from '@expo-google-fonts/space-mono/400Regular';
import { SpaceMono_700Bold } from '@expo-google-fonts/space-mono/700Bold';
import { ArchivoBlack_400Regular } from '@expo-google-fonts/archivo-black/400Regular';
import { Caveat_600SemiBold } from '@expo-google-fonts/caveat/600SemiBold';
import CameraScreen from './src/screens/CameraScreen';
import EditorScreen from './src/screens/EditorScreen';
import GalleryScreen from './src/screens/GalleryScreen';
import { Fonts } from './src/engine/render';
import * as ImagePicker from 'expo-image-picker';
import { makeShot, metaFromExif, normalizePhoto, Shot } from './src/engine/shots';
import { EditState, Meta } from './src/engine/state';
import { C, F } from './src/theme';

export default function App() {
  const [fontsLoaded] = useFonts({ SpaceMono_400Regular, SpaceMono_700Bold, ArchivoBlack_400Regular, Caveat_600SemiBold });
  const display = useTypeface(ArchivoBlack_400Regular);
  const hand = useTypeface(Caveat_600SemiBold);
  const mono = useTypeface(SpaceMono_400Regular);
  const monoBold = useTypeface(SpaceMono_700Bold);
  const fonts: Fonts = React.useMemo(() => ({ display, hand, mono, monoBold }), [display, hand, mono, monoBold]);

  const [shots, setShots] = useState<Shot[]>([]);
  const [current, setCurrent] = useState<Shot | null>(null);
  const [busy, setBusy] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);

  /* toast */
  const [msg, setMsg] = useState('');
  const fade = useRef(new Animated.Value(0)).current;
  const tT = useRef<ReturnType<typeof setTimeout>>(undefined);
  const toast = useCallback((m: string) => {
    setMsg(m); clearTimeout(tT.current);
    Animated.timing(fade, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    tT.current = setTimeout(() => Animated.timing(fade, { toValue: 0, duration: 250, useNativeDriver: true }).start(), 2200);
  }, [fade]);

  /* load the most recent gallery photo as the opening shot (only if permission already granted) */
  useEffect(() => {
    (async () => {
      try {
        const perm = await getPermissionsAsync();
        if (!perm.granted) return;
        const assets = await new Query()
          .eq(AssetField.MEDIA_TYPE, MediaType.IMAGE)
          .orderBy({ key: AssetField.CREATION_TIME, ascending: false })
          .limit(1)
          .exe();
        if (!assets.length) return;
        const asset = assets[0];
        const [uri, shape] = await Promise.all([asset.getUri(), asset.getShape()]);
        if (!uri) return;
        const normalizedUri = await normalizePhoto(uri, shape?.width ?? 1920, shape?.height ?? 1080);
        const sh = await makeShot(normalizedUri, {});
        setShots(s => (s.length ? s : [sh]));
      } catch {}
    })();
  }, []);

  const onCaptured = async (uri: string, meta: Meta, init: { preset: string; exposure: number }) => {
    setBusy(true);
    try {
      const sh = await makeShot(uri, meta, init);
      setShots(s => [...s, sh]); setCurrent(sh);
    } catch (e: any) { toast(e?.message || 'That photo could not be developed'); }
    finally { setBusy(false); }
  };

  /** System photo picker: the original import path, kept as a reliable fallback. */
  const importWithPicker = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], exif: true, quality: 1 });
      if (res.canceled || !res.assets?.length) return;
      setGalleryOpen(false);
      setBusy(true);
      const a = res.assets[0];
      const normalizedUri = await normalizePhoto(a.uri, a.width || 1920, a.height || 1080);
      const sh = await makeShot(normalizedUri, metaFromExif(a.exif));
      setShots(s => [...s, sh]);
      setCurrent(sh);
    } catch (e: any) { toast(e?.message || 'Could not open that photo'); }
    finally { setBusy(false); }
  };

  const handleSelectFromGallery = async (asset: Asset) => {
    setGalleryOpen(false);
    setBusy(true);
    try {
      const [uri, shape, creationMs] = await Promise.all([
        // iOS: may download the original from iCloud first, so this can take a moment
        asset.getUri(),
        asset.getShape().catch(() => null),
        asset.getCreationTime().catch(() => null),
      ]);
      if (!uri) throw new Error('no uri');
      const normalizedUri = await normalizePhoto(uri, shape?.width ?? 1920, shape?.height ?? 1080);
      // getCreationTime() returns milliseconds since epoch
      const date = creationMs ? new Date(creationMs).toISOString().slice(0, 10) : undefined;
      const sh = await makeShot(normalizedUri, { date });
      setShots(s => [...s, sh]);
      setCurrent(sh);
    } catch (e: any) {
      toast(`Couldn't open that photo${e?.message && e.message !== 'no uri' ? `: ${e.message}` : ''}. Try BROWSE.`);
      setGalleryOpen(true);
    }
    finally { setBusy(false); }
  };

  const onBack = (st: EditState) => { if (current) current.state = st; setCurrent(null); };
  const last = shots[shots.length - 1] || null;

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: C.bg }} />;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <SafeAreaView style={styles.root} edges={['top', 'bottom', 'left', 'right']}>
        {galleryOpen ? (
          <GalleryScreen onSelect={handleSelectFromGallery} onImport={importWithPicker} onClose={() => setGalleryOpen(false)} />
        ) : current ? (
          <EditorScreen key={current.id} shot={current} fonts={fonts} onBack={onBack} toast={toast} />
        ) : (
          <CameraScreen lastShot={last} busy={busy} toast={toast} onCaptured={onCaptured}
            onOpenGallery={() => setGalleryOpen(true)} />
        )}
        <Animated.View pointerEvents="none" style={[styles.toast, { opacity: fade }]}>
          <Text style={styles.toastT}>{msg}</Text>
        </Animated.View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  toast: { position: 'absolute', bottom: 130, alignSelf: 'center', backgroundColor: C.fg, paddingVertical: 8, paddingHorizontal: 14, maxWidth: '90%' },
  toastT: { color: '#000', fontFamily: F.monoBold, fontSize: 12, letterSpacing: .6, textAlign: 'center' },
});
