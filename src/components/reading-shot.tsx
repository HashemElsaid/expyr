import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

/**
 * The picture being read, with a line of light reading down it.
 *
 * Shared by the screenshot import and the document scan, so the wait looks
 * the same wherever a picture is being read: the person's own picture, not a
 * spinner over a blank page, because seeing it reassures them it is the right
 * one while the few seconds pass.
 */
export function ReadingShot({ uri, caption, height = 380 }: { uri: string; caption: string; height?: number }) {
  const reduced = useReducedMotion();
  const sweep = useSharedValue(0);
  const [measured, setMeasured] = useState(height);

  useEffect(() => {
    if (reduced) return;
    sweep.value = withRepeat(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [reduced, sweep]);

  const band = useAnimatedStyle(() => ({
    transform: [{ translateY: -60 + sweep.value * (measured + 60) }],
  }));

  return (
    <View style={styles.reading}>
      <View
        style={[styles.shot, { height }]}
        onLayout={(e) => setMeasured(e.nativeEvent.layout.height)}
        accessibilityLabel="Your picture, being read">
        <Image source={{ uri }} style={styles.image} resizeMode="cover" />
        {!reduced && <Animated.View style={[styles.sweep, band]} />}
      </View>
      <ThemedText type="footnote" themeColor="textSecondary" style={styles.center}>
        {caption}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  reading: { gap: Spacing.three },
  shot: { borderRadius: 18, overflow: 'hidden', backgroundColor: '#FFFFFF' },
  image: { width: '100%', height: '100%' },
  sweep: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 60,
    backgroundImage:
      'linear-gradient(180deg, rgba(168, 230, 198, 0) 0%, rgba(168, 230, 198, 0.55) 50%, rgba(168, 230, 198, 0) 100%)',
  },
  center: { textAlign: 'center' },
});
