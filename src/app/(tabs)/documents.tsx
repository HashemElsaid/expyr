import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, SectionList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/form';
import { Icon } from '@/components/icon';
import { DocumentRow, GroupedItem } from '@/components/item-row';
import { PageFooter, PageHeader, RemindersOffBanner, StatStrip } from '@/components/page';
import { useTabBarFrame } from '@/components/pager';
import { Pass, PassFigure, PassFoot, PassTitle, PassTop } from '@/components/pass';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TimelineSectionHeader } from '@/components/timeline-row';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { labelForId } from '@/data/document-types';
import { isSubscription } from '@/domain/documents';
import { isMine } from '@/domain/household';
import { buildSections } from '@/domain/timeline';
import { useTheme } from '@/hooks/use-theme';
import { daysUntil, formatDate } from '@/lib/dates';
import { timeLeftParts } from '@/lib/figures';
import { useDocuments } from '@/store/documents';
import { useSettings } from '@/store/settings';
import type { DocumentTypeId, TrackedDocument } from '@/types';

/** The renewals that come round every year, in the order worth suggesting. */
const ANNUAL_STAPLES: DocumentTypeId[] = [
  'car-registration',
  'car-insurance',
  'health-insurance',
  'tenancy-ejari',
];

/**
 * Documents: everything that expires and waits for you to act.
 *
 * The one that is next sits on the card at the top with its time left
 * engraved on it, overdue first if anything is. Below that, the same three
 * figures as the Subscriptions page, and the list in the order the dates
 * arrive.
 */
export default function DocumentsPage() {
  const router = useRouter();
  const theme = useTheme();
  const { documents, loaded } = useDocuments();
  const { settings } = useSettings();
  const bar = useTabBarFrame();

  const papers = useMemo(() => documents.filter((doc) => !isSubscription(doc)), [documents]);
  const sections = useMemo(() => buildSections(papers), [papers]);
  const next = useMemo(
    () => [...papers].sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))[0],
    [papers]
  );

  const overdue = papers.filter((doc) => daysUntil(doc.expiryDate) < 0).length;
  const soon = papers.filter((doc) => {
    const days = daysUntil(doc.expiryDate);
    return days >= 0 && days <= 30;
  }).length;

  /*
   * The documents people reach for first, passport and ID, are the ones that
   * last a decade, so a new list can read as "nothing happens here for years".
   * These are the ones that actually come round, and they are worth naming.
   */
  const missingAnnual = useMemo(
    () =>
      ANNUAL_STAPLES.filter((id) => !papers.some((d) => d.typeId === id)).map((id) =>
        labelForId(id, settings.country)
      ),
    [papers, settings.country]
  );
  const quiet =
    papers.length > 0 && overdue === 0 && soon === 0 && next && daysUntil(next.expiryDate) > 120;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: bar.inset }]}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              <PageHeader title="Documents" />
              {next && (
                <NextUp doc={next} onPress={() => router.push(`/document/${next.id}`)} />
              )}
              <RemindersOffBanner />
              {papers.length > 0 && (
                <StatStrip
                  stats={[
                    { value: String(overdue), label: 'Overdue', late: overdue > 0 },
                    { value: String(soon), label: 'Next 30 days' },
                    { value: String(papers.length), label: 'Tracked' },
                  ]}
                />
              )}
              {quiet && missingAnnual.length > 0 && (
                <Pressable onPress={() => router.push('/add')} accessibilityRole="button">
                  {({ pressed }) => (
                    <View
                      style={[
                        styles.banner,
                        { backgroundColor: theme.backgroundElement },
                        pressed && styles.dim,
                      ]}>
                      <Icon name="calendar.badge.clock" size={18} color={theme.textTertiary} />
                      <ThemedText type="footnote" style={styles.flex}>
                        Nothing due for months. The ones that catch people out come round every
                        year: {missingAnnual.slice(0, 3).join(', ')}.
                      </ThemedText>
                    </View>
                  )}
                </Pressable>
              )}
            </View>
          }
          renderSectionHeader={({ section }) => <TimelineSectionHeader title={section.title} />}
          renderItem={({ item, index, section }) => (
            <GroupedItem first={index === 0} last={index === section.data.length - 1}>
              <DocumentRow doc={item} onPress={() => router.push(`/document/${item.id}`)} />
            </GroupedItem>
          )}
          ListEmptyComponent={
            loaded ? <EmptyDocuments onAdd={() => router.push('/add')} /> : undefined
          }
          ListFooterComponent={<PageFooter />}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

/** The card for whatever expires soonest, overdue first. */
function NextUp({ doc, onPress }: { doc: TrackedDocument; onPress: () => void }) {
  const { settings } = useSettings();
  const days = daysUntil(doc.expiryDate);
  const late = days < 0;
  const { value, unit } = timeLeftParts(days);
  const owner = isMine(doc.owner, settings.ownName) ? settings.ownName : doc.owner;

  return (
    <Pass
      onPress={onPress}
      accessibilityLabel={`Next up: ${doc.title}, ${value} ${unit}`.trim()}>
      <PassTop left="Next up" right={labelForId(doc.typeId, settings.country)} />
      <PassTitle>{doc.title}</PassTitle>
      <PassFigure value={value} unit={unit || undefined} late={late} />
      <PassFoot
        left={`${late ? 'Expired' : 'Expires'} ${formatDate(doc.expiryDate)}`}
        right={owner || undefined}
      />
    </Pass>
  );
}

function EmptyDocuments({ onAdd }: { onAdd: () => void }) {
  return (
    <View style={styles.empty}>
      <ThemedText type="title2">Nothing expires unnoticed</ThemedText>
      <ThemedText type="body" themeColor="textSecondary">
        Scan a passport, an ID or a policy. Expyr reads the date and reminds you in time.
      </ThemedText>
      <PrimaryButton label="Scan a document" onPress={onAdd} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  list: { paddingHorizontal: 20, paddingTop: Spacing.two },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: 14,
    marginTop: Spacing.three,
  },
  dim: { opacity: 0.6 },
  flex: { flex: 1 },
  empty: { gap: Spacing.three, paddingTop: Spacing.four },
});
