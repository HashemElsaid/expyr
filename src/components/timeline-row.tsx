import { Pressable, StyleSheet, View } from 'react-native';

import { DocIcon } from '@/components/doc-icon';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { isSubscription } from '@/domain/documents';
import { isMine } from '@/domain/household';
import { useTheme } from '@/hooks/use-theme';
import { guessDomain } from '@/lib/brand-icons';
import { daysUntil, shortDate } from '@/lib/dates';
import { useSettings } from '@/store/settings';
import type { TrackedDocument } from '@/types';

/**
 * One row of the list, set the way iOS sets a row.
 *
 * It used to be a ledger: a big numeral for the day of the month in its own
 * column, a hairline spine down the screen with a coloured node on it, and a
 * grey line under the title joining up to four facts with middots. Every part
 * of that was drawn rather than borrowed, and the first person to look at it
 * who had not built it said the screens looked machine-made.
 *
 * A row is now a row. The category's symbol on a filled tile, the name of the
 * thing, one fact under it, and a chevron because tapping it opens a screen.
 * Nothing else, which is the point: an iPhone owner has read ten thousand rows
 * of exactly this shape and reads this one without noticing it.
 *
 * Two facts survived the cull, and they are the two somebody acts on. The date
 * is the whole reason the app exists, so it is the line under the title: red
 * once it has passed, the way Reminders reddens an overdue date, because that
 * is a fact about this row rather than a decoration. And whose it is sits on
 * the right where a Settings row puts its value, so a household can see at a
 * glance which of the four passports is theirs.
 */
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

  const days = daysUntil(doc.expiryDate);
  const gone = days < 0;

  /*
   * One fragment, no full stop. A subscription is not expiring, it is charging
   * you, and saying "expires" of a Netflix renewal invites precisely the wrong
   * response: waiting for it to lapse.
   */
  const when = isSubscription(doc)
    ? `${gone ? 'Charged' : 'Charges'} ${shortDate(doc.expiryDate)}`
    : `${gone ? 'Expired' : 'Expires'} ${shortDate(doc.expiryDate)}`;

  const owner = showOwner && !isMine(doc.owner, settings.ownName) ? doc.owner : undefined;

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={doc.title}>
      {({ pressed }) => (
        <View style={[styles.row, pressed && styles.dim]}>
          <DocIcon
            typeId={doc.typeId}
            iconDomain={doc.iconDomain ?? (isSubscription(doc) ? guessDomain(doc.title) : undefined)}
            size={40}
            overdue={gone}
          />

          <View style={styles.body}>
            <ThemedText type="headline" numberOfLines={1}>
              {doc.title}
            </ThemedText>
            <ThemedText
              type="subheadline"
              themeColor={gone ? undefined : 'textSecondary'}
              style={gone ? { color: theme.urgentStrong } : undefined}
              numberOfLines={1}>
              {when}
            </ThemedText>
          </View>

          {owner && (
            <ThemedText type="footnote" themeColor="textTertiary" numberOfLines={1}>
              {owner}
            </ThemedText>
          )}

          <Icon name="chevron.right" size={14} weight="semibold" color={theme.textTertiary} />
        </View>
      )}
    </Pressable>
  );
}

/**
 * The header over a group of rows, and the only place uppercase survives.
 *
 * Footnote, grey, no added tracking, which is how Settings sets one. Overdue
 * takes the red, and that is where the state of the list now lives: the screen
 * above it says "Timeline" and nothing else, rather than announcing "One
 * expired." in a sentence with a full stop.
 */
export function TimelineSectionHeader({ title }: { title: string }) {
  const theme = useTheme();
  const overdue = title === 'Overdue';

  return (
    <View style={styles.header}>
      <ThemedText
        type="sectionHeader"
        themeColor={overdue ? undefined : 'textSecondary'}
        style={overdue ? { color: theme.urgentStrong } : undefined}>
        {title}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: 10 },
  dim: { opacity: 0.6 },
  body: { flex: 1, gap: 1 },
  header: { paddingTop: Spacing.four, paddingBottom: Spacing.one },
});
