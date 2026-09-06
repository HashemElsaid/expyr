import { useEffect } from 'react';
import { Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';
import { tapFeedback } from '@/lib/haptics';

/**
 * A tab that answers when you touch it.
 *
 * The bar used to change tint and nothing else: the icon was one colour before
 * the tap and another after, with no moment in between. That reads as a
 * screenshot rather than a control — you cannot tell whether the tap landed
 * until the page behind it has already changed.
 *
 * So there is a shape here now, and it does two jobs. It settles in behind the
 * tab you are on, which is where iOS and Instagram both put the answer to
 * "where am I"; and it takes the press, shrinking under the finger and coming
 * back, which is the answer to "did that work". Both run on the UI thread
 * through reanimated, so neither stutters while the screen behind is still
 * mounting — which is exactly when a tap feels broken.
 */

/** Firm and quick. A tab is a button, not a door swinging shut. */
const SETTLE = { damping: 18, stiffness: 260, mass: 0.6 } as const;

/**
 * Sized to the icon, deliberately wider than tall.
 *
 * A circle around a 24-point glyph looks like a badge; a capsule a little wider
 * than the thing it holds reads as a place the icon is sitting in, which is the
 * shape every bar that feels right uses.
 */
const PILL_WIDTH = 56;
const PILL_HEIGHT = 32;

export function TabButton({
  children,
  onPress,
  accessibilityState,
  ...rest
}: {
  children: React.ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  accessibilityState?: { selected?: boolean };
  [key: string]: unknown;
}) {
  const theme = useTheme();

  /*
   * Read from both places, because the navigator does not use one.
   *
   * React Navigation moved to the ARIA props, so which tab is current arrives
   * as `aria-selected` — while `accessibilityState.selected` is what every
   * example still shows and what a reasonable person checks first. Reading only
   * that gave a pill that was rendered, coloured, rounded and permanently
   * invisible, because `focused` was false on all four tabs at once.
   */
  const focused =
    accessibilityState?.selected ?? (rest['aria-selected'] as boolean | undefined) ?? false;

  const settled = useSharedValue(focused ? 1 : 0);
  const pressed = useSharedValue(0);

  useEffect(() => {
    settled.value = withSpring(focused ? 1 : 0, SETTLE);
  }, [focused, settled]);

  /*
   * Grows from slightly small rather than fading in at full size: fading alone
   * reads as a hover state, growing reads as something arriving.
   *
   * The accent at a tenth of its strength, not a neutral grey.
   *
   * A grey lift is what Instagram uses and it disappears entirely in this
   * palette — warm paper against a warm selected grey is a difference you have
   * to be told about. The accent already means "this one" everywhere else in
   * the app, so the pill is the same colour the label turns, faintly.
   */
  const pill = useAnimatedStyle(() => ({
    // A little stronger than before: the shape is smaller now, so the same
    // wash of colour over less area reads as fainter than it did.
    opacity: settled.value * 0.14,
    transform: [{ scale: 0.88 + settled.value * 0.12 }],
  }));

  // The whole tab takes the press, so the label moves with the icon.
  const content = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.08 }],
  }));

  /*
   * Centred, and it has to be said explicitly.
   *
   * Wrapping the icon and label in this view to scale them on press cost them
   * the centring the navigator had been doing: a column stretches its children
   * by default, so the icon's box grew to the width of the word beneath it and
   * the glyph sat at the left edge of that box. The drift was invisible on
   * "Settings" and obvious on "Household" — the offset was exactly half the
   * difference between the icon and the label, which is what gave it away.
   */

  return (
    <Pressable
      {...rest}
      accessibilityState={accessibilityState ?? { selected: focused }}
      onPressIn={() => {
        pressed.value = withTiming(1, { duration: 90 });
      }}
      onPressOut={() => {
        pressed.value = withSpring(0, SETTLE);
      }}
      onPress={(event) => {
        // Only when it changes something. A tap on the tab you are already on
        // is not worth a buzz.
        if (!focused) tapFeedback();
        onPress?.(event);
      }}
      style={styles.slot}>
      <View style={styles.stack}>
        {/*
         * A capsule around the glyph, not a box around the glyph and its word.
         *
         * The highlight used to span both, which on a two-line stack makes a
         * squarish rounded rectangle — and next to Instagram, where the shape
         * hugs a single icon and is fully rounded, ours read as a box somebody
         * had drawn rather than a control. The label sits below it, outside,
         * and is not enclosed by anything.
         */}
        <View style={[styles.pillRow, { pointerEvents: 'none' }]}>
          <Animated.View style={[styles.pill, { backgroundColor: theme.accent }, pill]} />
        </View>
        <Animated.View style={[styles.content, content]}>{children}</Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  slot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  /*
   * Stretched to the slot rather than shrunk to the label, so the pill is the
   * same width under every tab. Sized to its content it was a different shape
   * on each — and "Household" is wider than a fifth of a 375-point screen, so
   * the leftmost one ran off the edge of the phone.
   */
  stack: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  content: { alignItems: 'center' },
  /*
   * Behind the icon and its label both, inset rather than sized to the content
   * — four tabs whose labels differ in length would otherwise get four
   * differently shaped pills, and the eye reads that as four different states.
   */
  /*
   * Full width so the capsule inside it centres on the icon exactly, whatever
   * the label beneath happens to be. Pinned to the top of the stack, which is
   * where the glyph is — the word sits below and outside it.
   */
  pillRow: {
    position: 'absolute',
    /*
     * Measured, not guessed. At -5 the capsule sat three points above the
     * glyph's centre, which is not enough to name and exactly enough to make
     * the whole bar look slightly off. This puts the two centres on top of
     * each other.
     */
    top: -2,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  pill: {
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    // Half the height: a capsule, not a rounded square.
    borderRadius: PILL_HEIGHT / 2,
  },
});
