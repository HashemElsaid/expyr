import { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { SecurityPrint, Sheen } from '@/components/pass';
import { Card, Fonts } from '@/constants/theme';

/**
 * Expyr Pro, as the card it is: the same object as every subscription's card,
 * in near-black with gold foil instead of emerald with mint, so what is being
 * bought looks like the thing that is kept rather than like an advertisement.
 * The light crosses it more often than the others, because this is the one
 * card asking to be noticed.
 */
export function ProCard() {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  const onLayout = (e: LayoutChangeEvent) => {
    const width = Math.round(e.nativeEvent.layout.width);
    const height = Math.round(e.nativeEvent.layout.height);
    if (!size || size.width !== width || size.height !== height) setSize({ width, height });
  };

  return (
    <View style={styles.card} onLayout={onLayout} accessible accessibilityLabel="Expyr Pro">
      {size ? <SecurityPrint width={size.width} height={size.height} color={Card.brass} strength={1.1} /> : null}
      {size ? <Sheen width={size.width} tint="rgba(255, 236, 190, 0.16)" every={6000} /> : null}
      <Text style={styles.top} maxFontSizeMultiplier={1.3}>
        Expyr
      </Text>
      <Text style={styles.word} maxFontSizeMultiplier={1.1}>
        Pro
      </Text>
      <Text style={styles.line} maxFontSizeMultiplier={1.4}>
        One payment. A reminder before every charge, and every document you own.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    overflow: 'hidden',
    padding: 20,
    minHeight: 186,
    backgroundImage: 'radial-gradient(130% 120% at 85% 0%, #25392F 0%, #111C17 55%, #070C0A 100%)',
    boxShadow: 'inset 0px 0px 0px 1px rgba(217, 192, 138, 0.22), 0px 24px 40px -24px rgba(0, 0, 0, 0.7)',
  },
  top: {
    ...Fonts.strong,
    fontSize: 10.5,
    letterSpacing: 0.95,
    textTransform: 'uppercase',
    color: Card.brass,
  },
  word: {
    ...Fonts.figureUnit,
    fontSize: 64,
    lineHeight: 68,
    marginTop: 22,
    color: Card.brass,
  },
  line: { ...Fonts.body, fontSize: 14, lineHeight: 19, marginTop: 6, maxWidth: 260, color: 'rgba(243, 235, 216, 0.78)' },
});
