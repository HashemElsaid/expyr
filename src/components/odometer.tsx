import { useEffect } from 'react';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

import { Springs } from '@/constants/motion';

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

/**
 * A number that rolls into place the way a mechanical counter does, each
 * digit a little after the one before it.
 *
 * Anything that is not a plain whole number, "Today" for instance, is simply
 * set as text. Nothing rolls until `play` is true, so a card that is still
 * flying in does not spend its roll before anybody can see it.
 */
export function Odometer({
  value,
  style,
  lineHeight,
  play = true,
}: {
  value: string;
  style: TextStyle;
  /** The height of one digit, which is also how far the strip moves per step. */
  lineHeight: number;
  play?: boolean;
}) {
  if (!/^\d+$/.test(value)) {
    return (
      <Text style={style} maxFontSizeMultiplier={1.15}>
        {value}
      </Text>
    );
  }
  return (
    <View style={styles.row} accessible accessibilityLabel={value}>
      {value.split('').map((digit, i) => (
        <Column
          key={`${i}-${value.length}`}
          digit={Number(digit)}
          index={i}
          style={style}
          lineHeight={lineHeight}
          play={play}
        />
      ))}
    </View>
  );
}

function Column({
  digit,
  index,
  style,
  lineHeight,
  play,
}: {
  digit: number;
  index: number;
  style: TextStyle;
  lineHeight: number;
  play: boolean;
}) {
  const reduced = useReducedMotion();
  const offset = useSharedValue(reduced ? -digit * lineHeight : 0);

  useEffect(() => {
    const target = -digit * lineHeight;
    if (reduced) {
      offset.value = target;
      return;
    }
    if (!play) return;
    offset.value = withDelay(index * 70, withSpring(target, Springs.lift));
  }, [digit, index, lineHeight, offset, play, reduced]);

  const strip = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));

  return (
    <View
      style={{ height: lineHeight, overflow: 'hidden' }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Animated.View style={strip}>
        {DIGITS.map((d) => (
          <Text key={d} style={[style, { lineHeight, height: lineHeight }]} maxFontSizeMultiplier={1}>
            {d}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
});
