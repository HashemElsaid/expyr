import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { SecurityPrint, passGradient, passShadow } from '@/components/pass';
import { Springs } from '@/constants/motion';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { finish, useFlight, type Flight } from '@/lib/card-flight';

/**
 * Where the flying card is drawn: one layer over the whole app, above the
 * screens it travels between. Empty until a flight has both of its ends.
 */
export function CardFlightLayer() {
  const flight = useFlight();
  if (!flight?.to) return null;
  return (
    <View style={[styles.layer, { pointerEvents: 'none' }]}>
      <Ghost key={flight.key} flight={flight} to={flight.to} />
    </View>
  );
}

function Ghost({ flight, to }: { flight: Flight; to: NonNullable<Flight['to']> }) {
  const scheme = useColorScheme();
  const progress = useSharedValue(0);
  const { from } = flight;

  useEffect(() => {
    const key = flight.key;
    // Out on the spring that lands with a little give, home on the one that does not.
    progress.value = withSpring(1, flight.direction === 'out' ? Springs.lift : Springs.settle, (done) => {
      if (done) scheduleOnRN(finish, key);
    });
  }, [flight.direction, flight.key, progress]);

  const moving = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      left: from.x + (to.x - from.x) * p,
      top: from.y + (to.y - from.y) * p,
      width: from.width + (to.width - from.width) * p,
      height: from.height + (to.height - from.height) * p,
      borderRadius: flight.fromRadius + (flight.toRadius - flight.fromRadius) * p,
    };
  });

  // The print is drawn once at the larger size and clipped as the card grows.
  const print = from.width * from.height > to.width * to.height ? from : to;

  return (
    <Animated.View
      style={[styles.ghost, { backgroundImage: passGradient(scheme), boxShadow: passShadow }, moving]}>
      <SecurityPrint width={Math.round(print.width)} height={Math.round(print.height)} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Spelled out: absoluteFillObject went away with React Native 0.86.
  layer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  ghost: { position: 'absolute', overflow: 'hidden' },
});
