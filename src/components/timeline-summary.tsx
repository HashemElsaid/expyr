import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, type SFSymbol } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useSystemColors, useTheme } from '@/hooks/use-theme';

/** Which slice of the list is showing. */
export type Focus = 'all' | 'overdue' | 'soon';

/**
 * Four cards over the list, the way Reminders opens.
 *
 * The Timeline was called "a bit simple" once it had been stripped of the
 * invented furniture, and that was fair: a screen of grey rows with a title
 * over them says nothing until you read it. This is what iOS puts there
 * instead, and it earns its space three ways at once.
 *
 * It answers "do I need to worry" in a glance, which is what the verdict
 * sentence used to do in words and a full stop. It gives the screen colour
 * without decorating anything, because every number on it is a fact. And it
 * turns the two states that matter into filters, so a person who sees that one
 * thing is overdue can tap the word and see which.
 *
 * No new text anywhere, which was the constraint. Four labels and four counts.
 */
export function TimelineSummary({
  overdue,
  soon,
  all,
  people,
  focus,
  onFocus,
  onHousehold,
}: {
  overdue: number;
  soon: number;
  all: number;
  people: number;
  focus: Focus;
  onFocus: (next: Focus) => void;
  onHousehold: () => void;
}) {
  const system = useSystemColors();

  return (
    <View style={styles.grid}>
      <Card
        symbol="exclamationmark.circle.fill"
        colour={system.red}
        label="Overdue"
        count={overdue}
        selected={focus === 'overdue'}
        /* Nothing to filter to, so it stops being a button rather than
           showing an empty list under a red heading. */
        onPress={overdue > 0 ? () => onFocus(focus === 'overdue' ? 'all' : 'overdue') : undefined}
      />
      <Card
        symbol="calendar"
        colour={system.orange}
        label="Next 30 days"
        count={soon}
        selected={focus === 'soon'}
        onPress={soon > 0 ? () => onFocus(focus === 'soon' ? 'all' : 'soon') : undefined}
      />
      <Card
        symbol="tray.full"
        colour={system.gray}
        label="All"
        count={all}
        selected={focus === 'all'}
        onPress={() => onFocus('all')}
      />
      <Card
        symbol="person.2"
        colour={system.green}
        label="Household"
        count={people}
        onPress={onHousehold}
      />
    </View>
  );
}

function Card({
  symbol,
  colour,
  label,
  count,
  selected,
  onPress,
}: {
  symbol: SFSymbol;
  colour: string;
  label: string;
  count: number;
  selected?: boolean;
  onPress?: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={styles.half}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}, ${count}`}>
      {({ pressed }) => (
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.backgroundElement,
              /*
               * The selected card is outlined in its own colour rather than
               * filled, so the count stays as legible as the other three and
               * the grid does not lurch when the filter changes.
               */
              borderColor: selected ? colour : 'transparent',
            },
            pressed && styles.dim,
            !onPress && styles.faded,
          ]}>
          <View style={styles.top}>
            <View style={[styles.dot, { backgroundColor: colour }]}>
              <Icon name={symbol} size={13} weight="semibold" color="#FFFFFF" />
            </View>
            <ThemedText type="title2">{count}</ThemedText>
          </View>
          <ThemedText type="footnoteStrong" themeColor="textSecondary">
            {label}
          </ThemedText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, paddingTop: Spacing.three },
  /* Two to a row, whatever the width, with the gap taken off each half. */
  half: { flexBasis: '48%', flexGrow: 1 },
  card: {
    borderRadius: Radius.medium,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: 2,
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dim: { opacity: 0.6 },
  /** A count of nothing is still worth reading, just not worth pressing. */
  faded: { opacity: 0.55 },
});
