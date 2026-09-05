import { useEffect } from 'react';
import { Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Radius } from '@/constants/theme';
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
    opacity: settled.value * 0.12,
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
        <Animated.View
          pointerEvents="none"
          style={[styles.pill, { backgroundColor: theme.accent }, pill]}
        />
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
  pill: {
    position: 'absolute',
    /*
     * Asymmetric on purpose. The bar sits on the bottom edge of the screen, so
     * an even inset puts the pill's lower curve underneath the home indicator
     * where it gets clipped — it has to breathe upwards instead.
     */
    top: -8,
    bottom: -1,
    left: 5,
    right: 5,
    borderRadius: Radius.medium,
  },
});
