import { useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { tapFeedback } from '@/lib/haptics';

/**
 * Two views of the same list, and a thumb that slides between them.
 *
 * The sliding is the whole point rather than decoration. A segmented control
 * that simply repaints leaves you working out which half you are now looking
 * at; one where the thumb travels tells you which way you went, and the list
 * underneath changing at the same moment reads as a consequence of the tap
 * rather than a coincidence.
 *
 * Deliberately not a tab bar. These are two cuts of one thing, not two places
 * — which is why it sits under the headline rather than at the edge of the
 * screen, and why the thumb moves rather than a page sliding in.
 */

export type Segment<T extends string> = {
  value: T;
  label: string;
  /**
   * Marks the segment you are not looking at as having something urgent in it.
   *
   * A hard split hides half the list, so without this an expired passport can
   * sit one tap away with nothing on screen suggesting anybody look. It is the
   * cost of splitting, and this is the smallest honest way to pay it.
   */
  attention?: boolean;
};

/** Matches the tab bar's settle, so the two do not feel like different apps. */
const SETTLE = { damping: 18, stiffness: 260, mass: 0.6 } as const;

export function Segmented<T extends string>({
  segments,
  value,
  onChange,
}: {
  segments: Segment<T>[];
  value: T;
  onChange: (next: T) => void;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);

  const index = Math.max(
    0,
    segments.findIndex((segment) => segment.value === value)
  );
  const position = useSharedValue(index);

  useEffect(() => {
    position.value = withSpring(index, SETTLE);
  }, [index, position]);

  const slotWidth = width > 0 ? (width - PADDING * 2) / segments.length : 0;

  const thumb = useAnimatedStyle(() => ({
    width: slotWidth,
    transform: [{ translateX: position.value * slotWidth }],
    // Nothing to slide before the control has been measured.
    opacity: slotWidth > 0 ? 1 : 0,
  }));

  function measure(event: LayoutChangeEvent) {
    setWidth(event.nativeEvent.layout.width);
  }

  return (
    <View
      onLayout={measure}
      style={[styles.track, { backgroundColor: theme.backgroundSelected }]}
      accessibilityRole="tablist">
      <Animated.View
        style={[
          styles.thumb,
          { pointerEvents: 'none' },
          {
            backgroundColor: theme.backgroundElement,
            boxShadow: shadow(theme.text, 1, 3, 0.1),
          },
          thumb,
        ]}
      />

      {segments.map((segment) => {
        const selected = segment.value === value;
        return (
          <Pressable
            key={segment.value}
            onPress={() => {
              if (selected) return;
              tapFeedback();
              onChange(segment.value);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={styles.slot}>
            <View style={styles.labelRow}>
              <ThemedText
                type="footnoteStrong"
                themeColor={selected ? 'text' : 'textSecondary'}
                numberOfLines={1}>
                {segment.label}
              </ThemedText>
              {/*
               * Only ever on the segment you are not reading. A dot on the half
               * you are already looking at tells you nothing you cannot see.
               */}
              {segment.attention && !selected && (
                <View style={[styles.dot, { backgroundColor: theme.urgentStrong }]} />
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const PADDING = 3;

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: Radius.small,
    padding: PADDING,
  },
  thumb: {
    position: 'absolute',
    top: PADDING,
    bottom: PADDING,
    left: PADDING,
    borderRadius: Radius.small - 2,
    // Lifted just enough to read as sitting on top of the track, not in it.
    elevation: 2,
  },
  slot: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 7 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
