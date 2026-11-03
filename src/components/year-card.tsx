import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';

import { Pass, PassFigure, PassFoot, PassSub, PassTop, passFigureStyle } from '@/components/pass';
import { Springs } from '@/constants/motion';
import { Card, Fonts } from '@/constants/theme';
import { yearlyTotal } from '@/domain/money';
import { chargeAmount, chargesByMonth } from '@/domain/year';
import { dayMonthOf, daysUntil } from '@/lib/dates';
import { money, wholeMoney } from '@/lib/figures';
import type { TrackedDocument } from '@/types';

const MONTH_LETTERS = 'JFMAMJJASOND';

/**
 * What the year costs, on the card the Subscriptions page opens on.
 *
 * One figure, in one currency: the biggest one the household pays in. Under
 * it, twelve bars for the next twelve months, built from the real charge
 * dates, so the month a yearly renewal lands stands out as the spike it is.
 * That spike is usually the charge somebody forgot they had.
 */
export function YearCard({ subscriptions }: { subscriptions: readonly TrackedDocument[] }) {
  const live = subscriptions.filter((doc) => !doc.archivedAt);
  const total = yearlyTotal(live);
  const next = [...live].sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))[0];
  const count = live.length;

  if (total.kind === 'none') {
    return (
      <Pass accessibilityLabel="What your year costs">
        <PassTop left="What your year costs" right={`${count} running`} />
        <PassSub>Prices show here once a screenshot gives them.</PassSub>
        {next ? <NextFoot doc={next} /> : null}
      </Pass>
    );
  }

  const months = chargesByMonth(live, total.currency);
  const peak = Math.max(...months.map((m) => m.amount));

  return (
    <Pass accessibilityLabel={`What your year costs, ${total.currency} ${wholeMoney(total.amount)}`}>
      <PassTop left="What your year costs" right={`${count} running`} />
      <View style={styles.figure}>
        <PassFigure currency={total.currency} value={<CountUp to={total.amount} />} />
      </View>
      <PassSub>
        {total.kind === 'mixed'
          ? `Plus subscriptions in ${total.others} other ${total.others === 1 ? 'currency' : 'currencies'}`
          : `About ${total.currency} ${wholeMoney(total.amount / 12)} a month`}
      </PassSub>

      <View style={styles.ribbon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {months.map((month, i) => (
          <Bar
            key={`${month.year}-${month.month}`}
            index={i}
            share={peak > 0 ? month.amount / peak : 0}
            peak={peak > 0 && month.amount === peak}
          />
        ))}
      </View>
      <View style={styles.letters} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {months.map((month) => (
          <Text key={`${month.year}-${month.month}`} style={styles.letter} maxFontSizeMultiplier={1.2}>
            {MONTH_LETTERS[month.month]}
          </Text>
        ))}
      </View>

      {next ? <NextFoot doc={next} /> : null}
    </Pass>
  );
}

function NextFoot({ doc }: { doc: TrackedDocument }) {
  const days = daysUntil(doc.expiryDate);
  const each = chargeAmount(doc);
  return (
    <PassFoot
      left={`Next: ${doc.title}, ${days === 0 ? 'today' : dayMonthOf(doc.expiryDate)}`}
      right={each ? `${doc.price!.currency} ${money(each)}` : undefined}
    />
  );
}

/** One month's bar, growing from the baseline when the card first appears. */
function Bar({ index, share, peak }: { index: number; share: number; peak: boolean }) {
  const reduced = useReducedMotion();
  const grown = useSharedValue(reduced ? 1 : 0.04);

  useEffect(() => {
    if (reduced) return;
    grown.value = withDelay(160 + index * 40, withSpring(1, Springs.lift));
  }, [grown, index, reduced]);

  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: grown.value }] }));

  return (
    <View style={styles.barSlot}>
      <Animated.View
        style={[
          styles.bar,
          { height: `${Math.max(5, Math.round(share * 100))}%`, backgroundColor: peak ? Card.mint : 'rgba(168, 230, 198, 0.32)' },
          style,
        ]}
      />
    </View>
  );
}

/**
 * The total counting up from nothing the first time it is shown, and from its
 * old value to its new one after that, so a change reads as a change.
 */
function CountUp({ to }: { to: number }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? to : 0);
  const from = useRef(reduced ? to : 0);

  useEffect(() => {
    if (reduced) {
      setShown(to);
      from.current = to;
      return;
    }
    const start = from.current;
    const began = Date.now();
    let frame = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - began) / 1150);
      const eased = 1 - Math.pow(1 - t, 4);
      setShown(start + (to - start) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
      else from.current = to;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [to, reduced]);

  return (
    <Text style={passFigureStyle} maxFontSizeMultiplier={1.15}>
      {wholeMoney(shown)}
    </Text>
  );
}

const styles = StyleSheet.create({
  figure: { marginTop: 14 },
  ribbon: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
    height: 54,
    marginTop: 16,
  },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: {
    width: '100%',
    minHeight: 3,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    borderBottomLeftRadius: 1,
    borderBottomRightRadius: 1,
    transformOrigin: 'bottom',
  },
  letters: { flexDirection: 'row', gap: 5, marginTop: 5 },
  letter: {
    ...Fonts.strong,
    flex: 1,
    textAlign: 'center',
    fontSize: 9,
    color: 'rgba(234, 246, 239, 0.5)',
  },
});
