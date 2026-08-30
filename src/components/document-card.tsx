import { Pressable, StyleSheet, View } from 'react-native';

import { DocIcon } from '@/components/doc-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { getDocumentType } from '@/data/document-types';
import { useTheme } from '@/hooks/use-theme';
import { useUrgency } from '@/hooks/use-urgency';
import { countdownParts, daysUntil, formatDate } from '@/lib/dates';
import { TrackedDocument } from '@/types';

export function DocumentCard({ doc, onPress }: { doc: TrackedDocument; onPress: () => void }) {
  const theme = useTheme();
  const type = getDocumentType(doc.typeId);
  const days = daysUntil(doc.expiryDate);
  const { color } = useUrgency(days);
  const countdown = countdownParts(days);

  const meta = [doc.owner, formatDate(doc.expiryDate)].filter(Boolean).join(' · ');
  const secondary = doc.title.trim() === type.label ? meta : `${type.label} · ${meta}`;

  return (
    <Pressable onPress={onPress}>
      {({ pressed }) => (
        <ThemedView
          type={pressed ? 'backgroundSelected' : 'backgroundElement'}
          style={[styles.card, { borderColor: theme.border }]}>
          <DocIcon typeId={doc.typeId} imageUri={doc.imageUri} />

          <View style={styles.info}>
            <ThemedText type="title" numberOfLines={1}>
              {doc.title}
            </ThemedText>
            <ThemedText type="small" themeColor="textTertiary" numberOfLines={1}>
              {secondary}
            </ThemedText>
          </View>

          <View style={styles.countdown}>
            <ThemedText type="numeral" style={{ color }}>
              {countdown.value}
            </ThemedText>
            <ThemedText type="label" themeColor="textTertiary">
              {countdown.unit}
            </ThemedText>
          </View>
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
