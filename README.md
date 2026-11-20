# Aesthete

A dark-mode camera and film darkroom for iPhone and Android, built with Expo (SDK 58) and React Native.

- **Camera**: flash (off / on / auto, screen flash on the front camera), 4:3 · 1:1 · 16:9 · 3:2 framing, 3 s and 10 s timer, rule-of-thirds grid, ultra-wide / wide / tele lens pills, pinch for digital zoom up to 5×, tap to show focus, drag up or down for exposure, front/back switch, an in-app photo library (with a BROWSE fallback to the system picker). The selected look is previewed live and applied in full when the photo opens in the editor.
- **Presets**: 19 looks in Film, Cinema, Street, Portrait, B&W and Night (Fuji-style Classic Neg / Chrome / Pro Neg, Sony-style FX Cine, Log Grade, Tungsten 800 with halation, and more), each with a strength slider.
- **Tune**: exposure, brilliance, highlights, shadows, contrast, brightness, black point, saturation, vibrance, warmth, tint, sharpness, definition, noise reduction and vignette, on an iPhone-style ruler.
- **Crop**: free and fixed ratios, straighten (±45°), rotate 90°, flip.
- **Analog**: 6 light leaks, 5 grain stocks, 5 textures (dust, scratches, paper, canvas, worn), 6 dithers (Bayer 2/4/8, noise, halftone, 1-bit), motion blur, chromatic aberration, halation, fade.
- **Polaroid**: 7 frames (B1 border, P1 classic, P3 date header, P4 caption, PT1 big year, EX1 camera info strip, FS1 35mm film strip). Border colours include neutrals plus swatches pulled from the photo, and there is a 7-segment date stamp.
- **Recipes**: save a look (preset, tune, analog, frame style) and apply it to the next shot.
- **Save**: renders at full resolution (up to 4096 px on the long side) and writes the JPEG to Photos.

All image processing runs on the GPU through two Skia runtime shaders (`src/engine/shaders.ts`). The preview and the saved file use the same code path.

## Run it on your phone

```bash
npm install
```

```bash
npx expo start
```

Scan the QR code with the Camera app (iOS) or Expo Go (Android). Every native module used here ships in Expo Go, so you don't need a custom build to try it.

For a standalone install, build with EAS:

```bash
npx eas-cli@latest build --profile development --platform ios
```

## Checks

```bash
npm run typecheck
```

```bash
npm run check:shaders
```

## Layout

```
App.tsx                      fonts, sample photo, camera/editor switch
src/screens/CameraScreen.tsx camera UI and capture
src/screens/EditorScreen.tsx preview, crop overlay, undo/redo, compare, save
src/screens/panels.tsx       Presets, Tune, Crop, Analog, Polaroid, Recipe trays
src/engine/shaders.ts        SkSL: geometry + spatial pass, tone/colour/film pass
src/engine/render.ts         Skia pipeline, frames, palette extraction, export
src/engine/state.ts          edit state, shader parameters
src/engine/catalog.ts        presets and effect catalogues
```

## Known limits

- The live viewfinder preview is an approximation built from blend-mode layers (true live B&W for mono looks on iOS). Android's camera preview is a SurfaceView that blend modes can't reach, so Android shows a colour tint instead. An exact live preview would need frame processors (react-native-vision-camera).
- Liquid Glass (the floating glass tab bar and camera controls) is iOS-only and needs iOS 26+. Older iOS falls back to a blur; Android uses flat surfaces.
- Zoom past each lens is a centre crop, so 2× on the wide lens gives a smaller file than the sensor's full resolution.
- Tap-to-focus shows the focus square and drives the exposure control. expo-camera doesn't expose a focus point, so the camera keeps its own continuous autofocus.
