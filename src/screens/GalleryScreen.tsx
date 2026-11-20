import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Dimensions, FlatList, Platform, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { Image } from 'expo-image';
import {
  Asset, AssetField, getPermissionsAsync, MediaType, presentPermissionsPicker, Query, requestPermissionsAsync,
} from 'expo-media-library';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F } from '../theme';
import { GUTTER } from '../ui/controls';

const NUM_COLS = 3;
const GAP = 2;
const SIDE = (Dimensions.get('window').width - GAP * (NUM_COLS - 1)) / NUM_COLS;
const PAGE = 60;

/**
 * iOS: asset.id is a "ph://<localIdentifier>" URI. React Native's built-in <Image> has no
 * loader for ph:// (that lived in the old CameraRoll module), which is why thumbnails failed
 * to load. expo-image resolves ph:// natively through PhotoKit, including iCloud-only photos,
 * and downsamples to the cell size. Android: getUri() returns a content:// URI.
 */
const Thumb = React.memo(function Thumb({ asset, onPress }: { asset: Asset; onPress: () => void }) {
  const [uri, setUri] = useState<string | null>(Platform.OS === 'ios' ? asset.id : null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'ios') return;
    let alive = true;
    asset.getUri().then(u => { if (alive) setUri(u); }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [asset]);
  return (
    <Pressable onPress={onPress} style={th.cell} accessibilityRole="imagebutton" accessibilityLabel="Edit this photo">
      {uri && !failed
        ? <Image source={{ uri }} style={th.img} contentFit="cover" recyclingKey={asset.id} transition={120}
            cachePolicy="memory" onError={() => setFailed(true)} />
        : <View style={th.placeholder}>{failed && <Text style={th.err}>!</Text>}</View>}
    </Pressable>
  );
});

const th = StyleSheet.create({
  cell: { width: SIDE, height: SIDE, margin: GAP / 2 },
  img: { width: '100%', height: '100%' },
  placeholder: { flex: 1, backgroundColor: '#1a1a18', alignItems: 'center', justifyContent: 'center' },
  err: { color: C.mute, fontFamily: F.monoBold, fontSize: 14 },
});

export default function GalleryScreen({
  onSelect, onImport, onClose,
}: {
  onSelect: (asset: Asset) => void;
  /** Opens the system photo picker — fallback for photos the library grid can't reach. */
  onImport: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [permDenied, setPermDenied] = useState(false);
  const [limited, setLimited] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);
  const fetchingMore = useRef(false);

  const loadPage = useCallback(async (reset = false) => {
    if (fetchingMore.current && !reset) return;
    fetchingMore.current = true;
    try {
      const offset = reset ? 0 : offsetRef.current;
      const page = await new Query()
        .eq(AssetField.MEDIA_TYPE, MediaType.IMAGE)
        .orderBy({ key: AssetField.CREATION_TIME, ascending: false })
        .limit(PAGE)
        .offset(offset)
        .exe();
      setAssets(prev => reset ? page : [...prev, ...page]);
      offsetRef.current = offset + page.length;
      setHasMore(page.length === PAGE);
      setLoadError(null);
    } catch (e: any) {
      setHasMore(false);
      setLoadError(e?.message || 'Could not read your photo library');
    }
    finally { fetchingMore.current = false; }
  }, []);

  const init = useCallback(async () => {
    try {
      let perm = await getPermissionsAsync();
      if (!perm.granted) perm = await requestPermissionsAsync();
      if (!perm.granted) { setPermDenied(true); return; }
      setLimited(perm.accessPrivileges === 'limited');
      await loadPage(true);
    } catch (e: any) {
      setLoadError(e?.message || 'Could not read your photo library');
    } finally { setLoading(false); }
  }, [loadPage]);

  useEffect(() => {
    let alive = true;
    Promise.resolve().then(() => { if (alive) init(); });
    return () => { alive = false; };
  }, [init]);

  const manageAccess = async () => {
    try { await presentPermissionsPicker(['photo']); } catch {}
    setLoading(true);
    init();
  };

  const onEndReached = () => { if (hasMore) loadPage(); };

  return (
    <View style={[gs.root, { paddingTop: insets.top }]}>
      <View style={gs.header}>
        <Text style={gs.title}>LIBRARY</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable onPress={onImport} hitSlop={8} style={gs.browse} accessibilityLabel="Browse all photos with the system picker">
            <Text style={gs.browseT}>BROWSE</Text>
          </Pressable>
          <Pressable onPress={onClose} hitSlop={12} style={gs.close} accessibilityLabel="Close library">
            <Text style={gs.closeT}>✕</Text>
          </Pressable>
        </View>
      </View>

      {limited && !permDenied && (
        <Pressable onPress={manageAccess} style={gs.limited}>
          <Text style={gs.limitedT}>LIMITED ACCESS · TAP TO CHOOSE MORE PHOTOS</Text>
        </Pressable>
      )}

      {permDenied ? (
        <View style={gs.center}>
          <Text style={gs.permTitle}>PHOTO ACCESS NEEDED</Text>
          <Text style={gs.permBody}>Allow AESTHETE to access your photos in Settings, or pick a single photo below.</Text>
          <Pressable onPress={onImport} style={gs.btn}><Text style={gs.btnT}>PICK A PHOTO</Text></Pressable>
        </View>
      ) : loading ? (
        <View style={gs.center}>
          <ActivityIndicator color={C.accent} />
        </View>
      ) : loadError && !assets.length ? (
        <View style={gs.center}>
          <Text style={gs.permTitle}>LIBRARY UNAVAILABLE</Text>
          <Text style={gs.permBody}>{loadError}</Text>
          <Pressable onPress={onImport} style={gs.btn}><Text style={gs.btnT}>PICK A PHOTO</Text></Pressable>
        </View>
      ) : (
        <FlatList
          data={assets}
          keyExtractor={a => a.id}
          numColumns={NUM_COLS}
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
          columnWrapperStyle={{ gap: GAP }}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          ListFooterComponent={hasMore && !loading ? <ActivityIndicator color={C.mute} style={{ padding: 20 }} /> : undefined}
          initialNumToRender={NUM_COLS * 8}
          windowSize={7}
          removeClippedSubviews
          renderItem={({ item }) => <Thumb asset={item} onPress={() => onSelect(item)} />}
        />
      )}
    </View>
  );
}

const gs = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: GUTTER },
  title: { color: C.fg, fontFamily: F.monoBold, fontSize: 13, letterSpacing: 2 },
  close: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  closeT: { color: C.mute, fontSize: 18 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  permTitle: { color: C.fg, fontFamily: F.monoBold, fontSize: 13, letterSpacing: 1.2, textAlign: 'center' },
  permBody: { color: C.mute, fontFamily: F.mono, fontSize: 12, textAlign: 'center', paddingHorizontal: 32, lineHeight: 18 },
  btn: { backgroundColor: C.accent, paddingVertical: 10, paddingHorizontal: 18, marginTop: 6 },
  btnT: { color: C.accentInk, fontFamily: F.monoBold, fontSize: 13, letterSpacing: 1 },
  browse: { borderWidth: 1, borderColor: C.line, paddingVertical: 5, paddingHorizontal: 10 },
  browseT: { color: C.fg, fontFamily: F.mono, fontSize: 11, letterSpacing: .8 },
  limited: { marginHorizontal: GUTTER, marginBottom: 8, paddingVertical: 8, borderWidth: 1, borderColor: C.line, alignItems: 'center' },
  limitedT: { color: C.accent, fontFamily: F.mono, fontSize: 10, letterSpacing: .8 },
});
