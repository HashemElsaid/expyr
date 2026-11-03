import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import {
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type SFSymbol } from '@/components/icon';
import { Springs } from '@/constants/motion';
import { Card, Fonts } from '@/constants/theme';
import { tapFeedback } from '@/lib/haptics';
import type { PickedFile } from '@/lib/scan';

type Shape = 'card' | 'page';

/** A credit card's proportions, and an A4 page's. */
const ASPECT: Record<Shape, number> = { card: 1.586, page: 1 / 1.414 };

/**
 * The camera a document is scanned with.
 *
 * Expyr's own rather than iOS's, so it can show what it wants: a frame the
 * shape of the thing being photographed, a line of light reading down it,
 * and the corners closing in on the card when the picture is taken. Most of
 * what people scan is a card (an ID, a licence, a registration), so the frame
 * starts card-shaped and switches to a page for contracts and policies.
 *
 * The whole picture is sent, not just what is inside the frame. The frame is
 * a guide for the hand; cropping to it would cut off the edge of anything held
 * a little crooked, and the reader finds the document in the photo itself.
 */
export function ScanCamera({
  visible,
  onCapture,
  onClose,
  onPhotos,
  onFiles,
}: {
  visible: boolean;
  onCapture: (picked: PickedFile) => void;
  onClose: () => void;
  onPhotos: () => void;
  onFiles: () => void;
}) {
  const insets = useSafeAreaInsets();
  const screen = useWindowDimensions();
  const reduced = useReducedMotion();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [shooting, setShooting] = useState(false);
  const [shape, setShape] = useState<Shape>('card');
  const [problem, setProblem] = useState<string | null>(null);

  const lock = useSharedValue(0);
  const flash = useSharedValue(0);
  const sweep = useSharedValue(0);

  // Asked the first time the camera opens, which is the moment it is wanted.
  useEffect(() => {
    if (visible && permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [visible, permission, requestPermission]);

  useEffect(() => {
    if (!visible) {
      lock.value = 0;
      setReady(false);
      setProblem(null);
      return;
    }
    if (reduced) return;
    sweep.value = 0;
    sweep.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [visible, reduced, lock, sweep]);

  // The frame: as wide as is comfortable, and never taller than half the screen.
  const width = shape === 'card' ? screen.width * 0.84 : Math.min(screen.width * 0.7, screen.height * 0.5 * ASPECT.page);
  const height = width / ASPECT[shape];
  const top = Math.max(insets.top + 96, (screen.height - height) / 2 - 40);
  const left = (screen.width - width) / 2;

  const corners = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - lock.value * 0.035 }],
  }));
  const line = useAnimatedStyle(() => ({
    opacity: 1 - lock.value,
    transform: [{ translateY: sweep.value * (height - 4) }],
  }));
  const whiteout = useAnimatedStyle(() => ({ opacity: flash.value }));

  async function shoot() {
    if (!ready || shooting || !camera.current) return;
    tapFeedback();
    setShooting(true);
    setProblem(null);
    // The corners close on the card the moment the shutter goes.
    lock.value = reduced ? 1 : withSpring(1, Springs.glide);
    try {
      const picture = await camera.current.takePictureAsync({ quality: 0.9 });
      flash.value = reduced ? 0 : withSequence(withTiming(0.85, { duration: 60 }), withTiming(0, { duration: 320 }));
      if (picture?.uri) {
        onCapture({ uri: picture.uri, type: 'image', width: picture.width, height: picture.height });
        return;
      }
      setProblem('That picture did not come out. Try again.');
    } catch {
      setProblem('That picture did not come out. Try again.');
    } finally {
      lock.value = reduced ? 0 : withSpring(0, Springs.settle);
      setShooting(false);
    }
  }

  const denied = permission && !permission.granted && !permission.canAskAgain;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.dark}>
        {permission?.granted ? (
          <CameraView
            ref={camera}
            style={styles.fill}
            facing="back"
            autofocus="on"
            animateShutter={false}
            onCameraReady={() => setReady(true)}
            onMountError={() => setProblem('The camera could not start. Choose a photo instead.')}
          />
        ) : null}

        {/* The page dimmed around the frame, so the frame is where the eye goes. */}
        <View style={[styles.dim, { top: 0, left: 0, right: 0, height: top }]} />
        <View style={[styles.dim, { top: top + height, left: 0, right: 0, bottom: 0 }]} />
        <View style={[styles.dim, { top, left: 0, width: left, height }]} />
        <View style={[styles.dim, { top, right: 0, width: left, height }]} />

        <Animated.View
          style={[styles.frame, { top, left, width, height, pointerEvents: 'none' }, corners]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          <View style={[styles.corner, styles.tl]} />
          <View style={[styles.corner, styles.tr]} />
          <View style={[styles.corner, styles.bl]} />
          <View style={[styles.corner, styles.br]} />
          {!reduced && <Animated.View style={[styles.scanline, line]} />}
        </Animated.View>

        <View style={[styles.topBar, { top: insets.top + 8 }]}>
          <RoundButton symbol="xmark" label="Close" onPress={onClose} />
          <Text style={styles.title} maxFontSizeMultiplier={1.3}>
            New document
          </Text>
          <View style={styles.roundSpace} />
        </View>

        <Text
          style={[styles.hint, { top: top + height + 18 }]}
          maxFontSizeMultiplier={1.3}>
          {problem ??
            (denied
              ? 'Expyr needs the camera to scan a document. Allow it in Settings, or choose a photo.'
              : shape === 'card'
                ? 'Hold the card inside the frame'
                : 'Fit the page inside the frame')}
        </Text>

        <View style={[styles.bottom, { paddingBottom: insets.bottom + 18 }]}>
          <View style={styles.shapes} accessibilityRole="radiogroup">
            {(['card', 'page'] as const).map((s) => (
              <Pressable
                key={s}
                onPress={() => {
                  tapFeedback();
                  setShape(s);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: shape === s }}>
                <Text style={[styles.shape, shape === s && styles.shapeOn]} maxFontSizeMultiplier={1.2}>
                  {s === 'card' ? 'Card' : 'Page'}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.controls}>
            <LabelledButton symbol="photo.on.rectangle" label="Photos" onPress={onPhotos} />
            {denied ? (
              <Pressable
                onPress={() => Linking.openSettings().catch(() => {})}
                accessibilityRole="button"
                style={styles.settingsButton}>
                <Text style={styles.settingsLabel}>Open Settings</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={shoot}
                disabled={!ready || shooting}
                accessibilityRole="button"
                accessibilityLabel="Take the photo">
                {({ pressed }) => (
                  <View style={[styles.shutter, (pressed || shooting) && styles.shutterDown]}>
                    <View style={styles.shutterInner} />
                  </View>
                )}
              </Pressable>
            )}
            <LabelledButton symbol="doc" label="PDF" onPress={onFiles} />
          </View>
        </View>

        <Animated.View style={[styles.flash, { pointerEvents: 'none' }, whiteout]} />
      </View>
    </Modal>
  );
}

function RoundButton({ symbol, label, onPress }: { symbol: SFSymbol; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={label}>
      {({ pressed }) => (
        <View style={[styles.round, pressed && styles.pressed]}>
          <Icon name={symbol} size={17} weight="semibold" color={Card.ink} />
        </View>
      )}
    </Pressable>
  );
}

function LabelledButton({ symbol, label, onPress }: { symbol: SFSymbol; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.labelled}>
      {({ pressed }) => (
        <>
          <View style={[styles.round, pressed && styles.pressed]}>
            <Icon name={symbol} size={18} color={Card.ink} />
          </View>
          <Text style={styles.small} maxFontSizeMultiplier={1.2}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const CORNER = 28;
const STROKE = 3;

const styles = StyleSheet.create({
  dark: { flex: 1, backgroundColor: '#050807' },
  dim: { position: 'absolute', backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  frame: { position: 'absolute', overflow: 'hidden' },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: '#FFFFFF' },
  tl: { top: 0, left: 0, borderTopWidth: STROKE, borderLeftWidth: STROKE, borderTopLeftRadius: 10 },
  tr: { top: 0, right: 0, borderTopWidth: STROKE, borderRightWidth: STROKE, borderTopRightRadius: 10 },
  bl: { bottom: 0, left: 0, borderBottomWidth: STROKE, borderLeftWidth: STROKE, borderBottomLeftRadius: 10 },
  br: { bottom: 0, right: 0, borderBottomWidth: STROKE, borderRightWidth: STROKE, borderBottomRightRadius: 10 },
  scanline: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: 0,
    height: 2,
    borderRadius: 1,
    backgroundColor: Card.mint,
    boxShadow: `0px 0px 12px 2px ${Card.mint}`,
  },
  topBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { ...Fonts.strong, fontSize: 13, letterSpacing: 0.9, textTransform: 'uppercase', color: Card.inkSecondary },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  roundSpace: { width: 44 },
  pressed: { opacity: 0.6 },
  hint: {
    ...Fonts.body,
    position: 'absolute',
    left: 32,
    right: 32,
    textAlign: 'center',
    fontSize: 15,
    color: Card.ink,
  },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: 22, paddingTop: 16 },
  shapes: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  shape: {
    ...Fonts.strong,
    fontSize: 13,
    color: Card.inkSecondary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  shapeOn: { color: '#0E1A15', backgroundColor: Card.mint },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 24 },
  labelled: { alignItems: 'center', gap: 6, width: 64 },
  small: { ...Fonts.bodyMedium, fontSize: 12, color: Card.inkSecondary },
  shutter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterDown: { transform: [{ scale: 0.92 }] },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#FFFFFF' },
  settingsButton: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 999, backgroundColor: Card.mint },
  settingsLabel: { ...Fonts.strong, fontSize: 15, color: '#0E1A15' },
  // Spelled out: absoluteFillObject went away with React Native 0.86.
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  flash: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#FFFFFF' },
});
