import { Pressable, StyleSheet, View } from 'react-native';

import { DocIcon } from '@/components/doc-icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { labelForId } from '@/data/document-types';
import { useTheme } from '@/hooks/use-theme';
import { saysItsOwnType } from '@/domain/timeline';
import { urgencyColor } from '@/hooks/use-urgency';
import { guessDomain } from '@/lib/brand-icons';
import { countdownLabel, daysUntil, urgencyFor } from '@/lib/dates';
import { recurrenceWord } from '@/lib/recurrence';
import { useSettings } from '@/store/settings';
import type { TrackedDocument } from '@/types';

/**
 * One line of the ledger: the day on the left, a node on the spine, what it is,
 * and the brand or category mark on the right.
 *
 * Lived inside the home screen until a second screen wanted the same list for
 * one person. Copying it would have been the easy thing and the wrong one —
 * this row carries four separate judgements about what to say and what to leave
 * out, and a copy inherits them once and then stops.
 */

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function TimelineRow({
  doc,
  onPress,
  /** Hidden on a screen that is already about one person. */
  showOwner = true,
}: {
  doc: TrackedDocument;
  onPress: () => void;
  showOwner?: boolean;
}) {
  const theme = useTheme();
  const { settings } = useSettings();

  const date = new Date(`${doc.expiryDate}T00:00:00`);
  const days = daysUntil(doc.expiryDate);
  const color = urgencyColor(urgencyFor(days), theme);
  const label = labelForId(doc.typeId, settings.country);

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={doc.title}>
      {({ pressed }) => (
        <View style={[styles.row, pressed && styles.dim]}>
          <View style={styles.dateColumn}>
            <ThemedText type="numeral" style={{ color }}>
              {date.getDate()}
            </ThemedText>
            <ThemedText type="label" themeColor="textTertiary">
              {WEEKDAYS[date.getDay()]}
            </ThemedText>
          </View>

          <View style={[styles.spine, { backgroundColor: theme.border }]}>
            <View style={[styles.node, { backgroundColor: color }]} />
          </View>

          <View style={styles.rowBody}>
            <ThemedText type="title" numberOfLines={1}>
              {doc.title}
            </ThemedText>
            {/*
             * What this row cannot show any other way. The countdown is the
             * point of the app and was missing from the list entirely, and
             * "Expires this day" appeared under things that expired a fortnight
             * ago because it was written as a filler for rows with nothing else
             * to say.
             */}
            <ThemedText type="small" themeColor="textTertiary" numberOfLines={1}>
              {[
                /*
                 * First, and only when it is close. The big date on the left
                 * already says when; how long is what a person needs when the
                 * answer is soon or already past, and last in the line it was
                 * being truncated away on every row.
                 */
                days <= 30 ? countdownLabel(days, Boolean(doc.renewsEvery)) : null,
                showOwner ? doc.owner : null,
                /*
                 * A subscription's plan and price beat repeating its type, and
                 * how often it charges beats it too. Seven subscriptions all
                 * read "Subscription / Membership" under a heading that
                 * already said Subscriptions — eleven characters repeated
                 * seven times, distinguishing none of them from each other.
                 */
                doc.renewsEvery ? doc.notes || recurrenceWord(doc.renewsEvery) : null,
                saysItsOwnType(doc.title, label) || doc.renewsEvery ? null : label,
              ]
                .filter(Boolean)
                .join(' · ')}
            </ThemedText>
          </View>

          <DocIcon
            typeId={doc.typeId}
            iconDomain={
              doc.iconDomain ??
              (doc.renewsEvery || doc.typeId === 'membership'
                ? guessDomain(doc.title)
                : undefined)
            }
            size={38}
          />
        </View>
      )}
    </Pressable>
  );
}

/** The month rule above a run of rows, or the red one above what is overdue. */
export function TimelineSectionHeader({ title }: { title: string }) {
  const theme = useTheme();
  const overdue = title === 'Overdue';

  return (
    <View style={styles.monthHeader}>
      <ThemedText
        type="label"
        themeColor={overdue ? undefined : 'textTertiary'}
        style={overdue ? { color: theme.urgentStrong } : undefined}>
        {title}
      </ThemedText>
      <View
        style={[
          styles.rule,
          { backgroundColor: overdue ? theme.urgentStrong : theme.border },
          overdue && styles.ruleStrong,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: 14 },
  dim: { opacity: 0.6 },
  dateColumn: { width: 40, alignItems: 'center' },
  spine: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', alignItems: 'center' },
  node: { width: 7, height: 7, borderRadius: 4, marginTop: 18 },
  rowBody: { flex: 1, gap: 2 },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.two,
  },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  ruleStrong: { height: 1 },
});
