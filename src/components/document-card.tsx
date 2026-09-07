import { Pressable, StyleSheet, View } from 'react-native';

import { DocIcon } from '@/components/doc-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { getDocumentType, labelFor } from '@/data/document-types';
import { saysItsOwnType } from '@/domain/timeline';
import { guessDomain } from '@/lib/brand-icons';
import { useTheme } from '@/hooks/use-theme';
import { useUrgency } from '@/hooks/use-urgency';
import { countdownParts, daysUntil, formatDate } from '@/lib/dates';
import { useSettings } from '@/store/settings';
import { TrackedDocument } from '@/types';

export function DocumentCard({ doc, onPress }: { doc: TrackedDocument; onPress: () => void }) {
  const theme = useTheme();
  const { settings } = useSettings();
  const type = getDocumentType(doc.typeId);
  const label = labelFor(type, settings.country);
  const days = daysUntil(doc.expiryDate);
  const { color } = useUrgency(days);
  const countdown = countdownParts(days);

  /*
   * Archived things do not get a countdown.
   *
   * The archive is where somebody puts what they are finished with, and it was
   * answering with "211 DAYS OVER" in red — a number that grows for the rest of
   * the life of the app, about a tenancy that ended on purpose. Nothing is
   * being asked of anyone here.
   *
   * The date takes its place, and says which date it is, because without the
   * countdown beside it "8 Feb 2026" could as easily be when it was filed.
   */
  const retired = Boolean(doc.archivedAt);
  const when = retired
    ? `${days < 0 ? 'Expired' : 'Expires'} ${formatDate(doc.expiryDate)}`
    : formatDate(doc.expiryDate);

  const meta = [doc.owner, when].filter(Boolean).join(' · ');
  const secondary = saysItsOwnType(doc.title, label) ? meta : `${label} · ${meta}`;

  return (
    <Pressable onPress={onPress}>
      {({ pressed }) => (
        <ThemedView
          type={pressed ? 'backgroundSelected' : 'backgroundElement'}
          style={[styles.card, { borderColor: theme.border }]}>
          <DocIcon
            typeId={doc.typeId}
            iconDomain={doc.iconDomain ??
              (doc.renewsEvery || doc.typeId === 'membership'
                ? guessDomain(doc.title)
                : undefined)}
          />

          <View style={styles.info}>
            <ThemedText type="title" numberOfLines={1}>
              {doc.title}
            </ThemedText>
            <ThemedText type="small" themeColor="textTertiary" numberOfLines={1}>
              {secondary}
            </ThemedText>
          </View>

          {!retired && (
            <View style={styles.countdown}>
              <ThemedText type="numeral" style={{ color }}>
                {countdown.value}
              </ThemedText>
              <ThemedText type="label" themeColor="textTertiary">
                {countdown.unit}
              </ThemedText>
            </View>
          )}
        </ThemedView>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  countdown: {
    alignItems: 'flex-end',
    gap: 2,
    minWidth: 62,
  },
});
