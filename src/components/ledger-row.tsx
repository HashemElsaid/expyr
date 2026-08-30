import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { getDocumentType } from '@/data/document-types';
import { RENEWAL_PERIOD_DAYS } from '@/data/renewal-actions';
import { useTheme } from '@/hooks/use-theme';
import { useUrgency } from '@/hooks/use-urgency';
import { countdownShort, daysUntil, shortDate } from '@/lib/dates';
import { TrackedDocument } from '@/types';

/**
 * Things that get renewed are set in the serif and carry a runway; things you
 * simply use up — milk, an exam, a warranty — compress to a single line. The
 * distinction is whether the category has a renewal period at all.
 */
export function isDocumentClass(doc: TrackedDocument): boolean {
  return RENEWAL_PERIOD_DAYS[doc.typeId] !== undefined;
}

/**
 * A hairline with a dot showing how far through its life this document is.
 * Near the right-hand end means nearly expired.
 */
function Runway({ doc, color }: { doc: TrackedDocument; color: string }) {
  const theme = useTheme();
  const period = RENEWAL_PERIOD_DAYS[doc.typeId];
  if (!period) return null;

  const left = daysUntil(doc.expiryDate);
  const elapsed = Math.min(1, Math.max(0, (period - left) / period));

  return (
    <View style={styles.runway}>
      <View style={[styles.runwayLine, { backgroundColor: theme.border }]} />
      <View
        style={[
          styles.runwayDot,
          { backgroundColor: color, left: `${Math.round(elapsed * 100)}%` },
        ]}
      />
    </View>
  );
}

export function LedgerRow({ doc, onPress }: { doc: TrackedDocument; onPress: () => void }) {
  const theme = useTheme();
  const type = getDocumentType(doc.typeId);
  const days = daysUntil(doc.expiryDate);
  const { color } = useUrgency(days);
  const isDocument = isDocumentClass(doc);

  // Skip the category when the user never renamed it — no point saying it twice.
  const meta = [
    doc.owner,
    doc.title.trim() === type.label ? null : type.label,
    shortDate(doc.expiryDate),
  ]
    .filter(Boolean)
    .join(' · ');

  if (!isDocument) {
    // Everyday tier: one line, sans, the number doing the work.
    return (
      <Pressable onPress={onPress} accessibilityRole="button">
        {({ pressed }) => (
          <View
            style={[styles.compactRow, { borderBottomColor: theme.border }, pressed && styles.dim]}>
            <ThemedText type="body" style={styles.flex} numberOfLines={1}>
              {doc.title}{' '}
              <ThemedText type="body" themeColor="textTertiary">
                · {shortDate(doc.expiryDate)}
              </ThemedText>
            </ThemedText>
            <ThemedText type="smallBold" style={{ color }}>
              {countdownShort(days)}
            </ThemedText>
          </View>
        )}
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {({ pressed }) => (
        <View style={[styles.row, { borderBottomColor: theme.border }, pressed && styles.dim]}>
          <View style={styles.titleLine}>
            <ThemedText type="ledgerTitle" style={styles.flex} numberOfLines={2}>
              {doc.title}
            </ThemedText>
            <ThemedText type="ledgerFigure" style={{ color }}>
              {countdownShort(days)}
            </ThemedText>
          </View>
          <ThemedText type="small" themeColor="textTertiary" numberOfLines={1}>
            {meta}
          </ThemedText>
          <Runway doc={doc} color={color} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  dim: { opacity: 0.55 },
  row: {
    gap: 6,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  titleLine: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
  runway: { height: 6, marginTop: 4, justifyContent: 'center' },
  runwayLine: { position: 'absolute', left: 0, right: 0, height: 2 },
  runwayDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: -3,
  },
});
