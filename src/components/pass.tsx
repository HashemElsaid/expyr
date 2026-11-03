import { memo, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Springs, PRESSED_SCALE } from '@/constants/motion';
import { Card, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { printPaths } from '@/lib/security-print';

/**
 * The card: what a year costs, a subscription, the document that is next.
 *
 * Built in the language of a passport cover, which is the one object everybody
 * already trusts with a date that matters: deep emerald, a guilloché rosette
 * in fine mint lines, uppercase spaced labels, and the number engraved in a
 * serif. It is the only place in the app that dresses up. The lists, sheets
 * and settings around it stay plain, so the card reads as an object rather
 * than as one more styled box.
 *
 * Its typography is its own for the same reason. The rest of the app keeps to
 * Apple's text styles (see `ThemedText`); the card's labels are uppercase and
 * spaced, and its figure sits beside a smaller italic unit, because that is
 * how a cover is set and the card is meant to be one.
 */
export function Pass({
  children,
  onPress,
  accessibilityLabel,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const scheme = useColorScheme();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const pressed = useSharedValue(1);
  const press = useAnimatedStyle(() => ({ transform: [{ scale: pressed.value }] }));

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    // Whole points only, so a sub-pixel relayout does not redraw the print.
    const next = { width: Math.round(width), height: Math.round(height) };
    if (!size || size.width !== next.width || size.height !== next.height) setSize(next);
  };

  const surface = [styles.card, { backgroundImage: passGradient(scheme), boxShadow: passShadow }, style];

  const inner = (
    <>
      {size ? <SecurityPrint width={size.width} height={size.height} /> : null}
      {size ? <Sheen width={size.width} /> : null}
      {children}
    </>
  );

  if (!onPress) {
    return (
      <View style={surface} onLayout={onLayout} accessibilityLabel={accessibilityLabel}>
        {inner}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        pressed.value = withSpring(PRESSED_SCALE, Springs.press);
      }}
      onPressOut={() => {
        pressed.value = withSpring(1, Springs.press);
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}>
      <Animated.View style={[surface, press]} onLayout={onLayout}>
        {inner}
      </Animated.View>
    </Pressable>
  );
}

/** The row of small capitals across the top: what this is, and whose. */
export function PassTop({ left, right }: { left: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.top}>
      {typeof left === 'string' ? (
        <Text style={styles.label} maxFontSizeMultiplier={1.3}>
          {left}
        </Text>
      ) : (
        left
      )}
      {typeof right === 'string' ? (
        <Text style={styles.label} maxFontSizeMultiplier={1.3}>
          {right}
        </Text>
      ) : (
        right ?? null
      )}
    </View>
  );
}

export function PassTitle({ children }: { children: string }) {
  return (
    <Text style={styles.title} maxFontSizeMultiplier={1.4}>
      {children}
    </Text>
  );
}

/**
 * The engraved number, with its unit in italic beside it and, for money, the
 * currency set small above the line the way a banknote sets it.
 */
export function PassFigure({
  value,
  unit,
  currency,
  late,
  accessibilityLabel,
}: {
  value: ReactNode;
  unit?: string;
  currency?: string;
  late?: boolean;
  accessibilityLabel?: string;
}) {
  const ink = late ? { color: Card.late } : null;
  return (
    <View style={styles.figureRow} accessible accessibilityLabel={accessibilityLabel}>
      {currency ? (
        <Text style={styles.currency} maxFontSizeMultiplier={1.2}>
          {currency}
        </Text>
      ) : null}
      {typeof value === 'string' ? (
        <Text style={[styles.figure, ink]} maxFontSizeMultiplier={1.15}>
          {value}
        </Text>
      ) : (
        value
      )}
      {unit ? (
        <Text style={[styles.unit, ink]} maxFontSizeMultiplier={1.2}>
          {unit}
        </Text>
      ) : null}
    </View>
  );
}

export function PassSub({ children }: { children: ReactNode }) {
  return (
    <Text style={styles.sub} maxFontSizeMultiplier={1.4}>
      {children}
    </Text>
  );
}

/** A hairline, then two facts at either end. */
export function PassFoot({ left, right }: { left: string; right?: string }) {
  return (
    <View style={styles.foot}>
      <Text style={styles.footText} maxFontSizeMultiplier={1.3} numberOfLines={1}>
        {left}
      </Text>
      {right ? (
        <Text style={styles.footText} maxFontSizeMultiplier={1.3}>
          {right}
        </Text>
      ) : null}
    </View>
  );
}

/** The card's emerald, lit from the top right. */
export function passGradient(scheme: 'light' | 'dark'): string {
  return `radial-gradient(130% 120% at 88% 0%, ${Card.emeraldHigh[scheme]} 0%, ${Card.emerald} 48%, ${Card.emeraldLow} 100%)`;
}

/** The card's own shadow and edge, for anything drawn to look like it. */
export const passShadow =
  'inset 0px 1px 0px rgba(255, 255, 255, 0.10), inset 0px 0px 0px 1px rgba(168, 230, 198, 0.10), 0px 24px 40px -24px rgba(6, 28, 20, 0.75)';

/** Shared with anything that sets a figure the card's way outside a card. */
export const passFigureStyle = {
  ...Fonts.figure,
  fontSize: 66,
  lineHeight: 70,
  letterSpacing: -1.3,
  color: Card.ink,
} as const;

/* ------------------------------------------------------------------ print */

/** The rosette and waves from `printPaths`, in mint at three strengths. */
export const SecurityPrint = memo(function SecurityPrint({ width, height }: { width: number; height: number }) {
  const paths = useMemo(() => printPaths(width, height), [width, height]);
  return (
    <View style={[styles.fill, { pointerEvents: 'none' }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Path d={paths.outer} stroke={Card.mint} strokeWidth={0.55} strokeOpacity={0.2} fill="none" />
        <Path d={paths.inner} stroke={Card.mint} strokeWidth={0.55} strokeOpacity={0.17} fill="none" />
        <Path d={paths.waves} stroke={Card.mint} strokeWidth={0.55} strokeOpacity={0.14} fill="none" />
      </Svg>
    </View>
  );
});

/**
 * A slow band of light that crosses the card every nine seconds, the way a
 * laminated page catches a lamp as it moves. Off with Reduce Motion.
 */
function Sheen({ width }: { width: number }) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    progress.value = withDelay(
      1600,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1980, easing: Easing.inOut(Easing.ease) }),
          withDelay(7020, withTiming(0, { duration: 0 }))
        ),
        -1
      )
    );
  }, [reduced, progress]);

  const band = width * 1.6;
  const moving = useAnimatedStyle(() => ({
    transform: [{ translateX: (-0.6 + 1.2 * progress.value) * band }],
  }));

  if (reduced) return null;
  return (
    <Animated.View
      style={[
        styles.sheen,
        { left: -width * 0.3, width: band, pointerEvents: 'none' },
        moving,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  // Spelled out: absoluteFillObject went away with React Native 0.86.
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheen: {
    position: 'absolute',
    top: '-30%',
    bottom: '-30%',
    backgroundImage:
      'linear-gradient(105deg, transparent 42%, rgba(255, 255, 255, 0.11) 50%, transparent 58%)',
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  label: {
    ...Fonts.strong,
    fontSize: 10.5,
    letterSpacing: 0.74,
    textTransform: 'uppercase',
    color: Card.inkTertiary,
  },
  title: {
    ...Fonts.strong,
    fontSize: 17,
    lineHeight: 22,
    marginTop: 22,
    color: Card.ink,
  },
  figureRow: { flexDirection: 'row', alignItems: 'baseline', gap: 9, marginTop: 4 },
  figure: passFigureStyle,
  unit: { ...Fonts.figureUnit, fontSize: 22, color: Card.inkSecondary },
  currency: {
    ...Fonts.strong,
    fontSize: 14,
    letterSpacing: 1.1,
    color: 'rgba(234, 246, 239, 0.7)',
    alignSelf: 'flex-start',
    marginTop: 12,
  },
  sub: { ...Fonts.body, fontSize: 14, lineHeight: 19, marginTop: 6, color: Card.inkSecondary },
  foot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Card.rule,
  },
  footText: { ...Fonts.body, fontSize: 13, color: 'rgba(234, 246, 239, 0.74)', flexShrink: 1 },
});
