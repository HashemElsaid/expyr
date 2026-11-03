import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Path, Text as SvgText, TextPath } from 'react-native-svg';

import { Springs } from '@/constants/motion';
import { Card } from '@/constants/theme';

/**
 * The "tracked by Expyr" stamp that lands on a document's card once it is
 * saved, the way a passport is stamped at the counter. It comes down once, on
 * the one spring in the app with a real bounce, and sits slightly askew.
 */
export function Stamp({ delay = 450, size = 112 }: { delay?: number; size?: number }) {
  const reduced = useReducedMotion();
  const down = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) return;
    down.value = withDelay(delay, withSpring(1, Springs.stamp));
  }, [delay, down, reduced]);

  const landed = useAnimatedStyle(() => ({
    opacity: Math.min(1, down.value * 1.6),
    transform: [
      { scale: 1.7 - 0.7 * down.value },
      { rotate: `${-22 + 14 * down.value}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[styles.stamp, { width: size, height: size, pointerEvents: 'none' }, landed]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} viewBox="0 0 120 120">
        <Defs>
          <Path id="ring" d="M60 60m-41 0a41 41 0 1 1 82 0a41 41 0 1 1-82 0" />
        </Defs>
        <Circle cx={60} cy={60} r={55} fill="rgba(10, 41, 31, 0.88)" stroke={Card.mint} strokeWidth={2} />
        <Circle cx={60} cy={60} r={49} fill="none" stroke={Card.mint} strokeWidth={0.8} strokeDasharray="2 3" />
        <SvgText fill={Card.mint} fontSize={9.5} fontWeight="600" letterSpacing={2}>
          <TextPath href="#ring">TRACKED BY EXPYR • TRACKED BY EXPYR •</TextPath>
        </SvgText>
        <Path
          d="m45 61 10 10 21-22"
          fill="none"
          stroke={Card.mint}
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stamp: { position: 'absolute', right: -10, top: -32 },
});
