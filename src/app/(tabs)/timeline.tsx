import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, SectionList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DocIcon } from '@/components/doc-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { labelForId } from '@/data/document-types';
import { useTheme } from '@/hooks/use-theme';
import { urgencyColor } from '@/hooks/use-urgency';
import { daysUntil, urgencyFor } from '@/lib/dates';
import { useDocuments } from '@/store/documents';
import { useSettings } from '@/store/settings';
import { TrackedDocument } from '@/types';

type Section = { title: string; data: TrackedDocument[] };

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** One section per calendar month, in date order, so the year reads as a story. */
function buildSections(docs: TrackedDocument[]): Section[] {
  const byMonth = new Map<string, TrackedDocument[]>();

  const sorted = [...docs].sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
  for (const doc of sorted) {
    const date = new Date(`${doc.expiryDate}T00:00:00`);
    const key = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, '0')}`;
    const existing = byMonth.get(key);
    if (existing) existing.push(doc);
    else byMonth.set(key, [doc]);
  }

  return [...byMonth.entries()].map(([key, data]) => {
    const [year, month] = key.split('-');
    return { title: `${MONTHS[Number(month)]} ${year}`, data };
  });
}

export default function TimelineScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { documents, loaded } = useDocuments();
  const { settings } = useSettings();

  const sections = useMemo(() => buildSections(documents), [documents]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <ThemedText type="display">Timeline</ThemedText>
          <ThemedText type="label" themeColor="textTertiary">
            {documents.length === 0
              ? 'Nothing scheduled yet'
              : `${documents.length} item${documents.length === 1 ? '' : 's'} ahead`}
          </ThemedText>
        </View>

        {loaded && documents.length === 0 ? (
          <View style={styles.empty}>
            <ThemedText type="body" themeColor="textSecondary" style={styles.centered}>
              Once you add something, this is where you will see the year laid out — every renewal
              in the order it arrives.
            </ThemedText>
          </View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            stickySectionHeadersEnabled={false}
            showsVerticalScrollIndicator={false}
            renderSectionHeader={({ section }) => (
              <View style={styles.monthHeader}>
                <ThemedText type="label" themeColor="textTertiary">
                  {section.title}
                </ThemedText>
                <View style={[styles.rule, { backgroundColor: theme.border }]} />
              </View>
            )}
            renderItem={({ item }) => {
              const date = new Date(`${item.expiryDate}T00:00:00`);
              const days = daysUntil(item.expiryDate);
              const color = urgencyColor(urgencyFor(days), theme);
              const label = labelForId(item.typeId, settings.country);

              return (
                <Pressable onPress={() => router.push(`/document/${item.id}`)}>
                  {({ pressed }) => (
                    <View style={[styles.row, pressed && styles.pressed]}>
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
                          {item.title}
                        </ThemedText>
                        <ThemedText type="small" themeColor="textTertiary" numberOfLines={1}>
                          {[item.owner, item.title.trim() === label ? null : label]
                            .filter(Boolean)
                            .join(' · ') || 'Expires this day'}
                        </ThemedText>
                      </View>

                      <DocIcon typeId={item.typeId} attachment={item.files[0]} size={38} />
                    </View>
                  )}
                </Pressable>
              );
            }}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  header: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.three,
    gap: Spacing.two,
  },
  list: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.five },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.two,
  },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  dateColumn: { width: 40, alignItems: 'center', gap: 1 },
  spine: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', alignItems: 'center' },
  node: { width: 7, height: 7, borderRadius: 4, marginTop: 22, marginLeft: -3 },
  rowBody: { flex: 1, gap: 2 },
  pressed: { opacity: 0.6 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.five },
  centered: { textAlign: 'center' },
});
