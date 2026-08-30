import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DocumentCard } from '@/components/document-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { getDocumentType } from '@/data/document-types';
import { useTheme } from '@/hooks/use-theme';
import { daysUntil } from '@/lib/dates';
import { ensureNotificationPermission, getNotificationPermission } from '@/lib/notifications';
import { useDocuments } from '@/store/documents';
import { TrackedDocument } from '@/types';

type Section = { title: string; data: TrackedDocument[] };

/** Grouped by urgency so what matters is never below the fold. */
function buildSections(docs: TrackedDocument[]): Section[] {
  const overdue: TrackedDocument[] = [];
  const soon: TrackedDocument[] = [];
  const later: TrackedDocument[] = [];

  for (const doc of docs) {
    const days = daysUntil(doc.expiryDate);
    if (days < 0) overdue.push(doc);
    else if (days <= 30) soon.push(doc);
    else later.push(doc);
  }

  return [
    { title: 'Overdue', data: overdue },
    { title: 'This month', data: soon },
    { title: 'Later', data: later },
  ].filter((section) => section.data.length > 0);
}

export default function HomeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { documents, archived, loaded, rescheduleAll } = useDocuments();
  const [query, setQuery] = useState('');
  const [ownerFilter, setOwnerFilter] = useState<string | null>(null);
  const [notificationsOn, setNotificationsOn] = useState<boolean | null>(null);

  useFocusEffect(
    useCallback(() => {
      getNotificationPermission().then(setNotificationsOn).catch(() => setNotificationsOn(null));
    }, [])
  );

  const owners = useMemo(
    () => [...new Set(documents.map((d) => d.owner).filter((o): o is string => !!o))],
    [documents]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return documents.filter((doc) => {
      if (ownerFilter && (doc.owner ?? '') !== ownerFilter) return false;
      if (!q) return true;
      const type = getDocumentType(doc.typeId);
      return (
        doc.title.toLowerCase().includes(q) ||
        type.label.toLowerCase().includes(q) ||
        doc.owner?.toLowerCase().includes(q) ||
        doc.documentNumber?.toLowerCase().includes(q) ||
        doc.notes?.toLowerCase().includes(q)
      );
    });
  }, [documents, query, ownerFilter]);

  async function turnOnNotifications() {
    const granted = await ensureNotificationPermission();
    setNotificationsOn(granted);
    if (granted) await rescheduleAll();
  }

  const sections = useMemo(() => buildSections(filtered), [filtered]);
  const attention = documents.filter((d) => daysUntil(d.expiryDate) <= 30).length;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <ThemedText type="display">Renewly</ThemedText>
            <ThemedText type="label" themeColor="textTertiary" style={styles.tagline}>
              {summaryLine(documents.length, attention)}
            </ThemedText>
          </View>
          <Pressable
            onPress={() => router.push('/add')}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Add an item">
            {({ pressed }) => (
              <View
                style={[
                  styles.addButton,
                  { backgroundColor: theme.accent },
                  pressed && styles.pressed,
                ]}>
                <MaterialCommunityIcons name="plus" size={22} color={theme.accentContrast} />
              </View>
            )}
          </Pressable>
        </View>

        {documents.length >= 5 && (
          <View style={styles.searchWrap}>
            <View
              style={[
                styles.searchField,
                { backgroundColor: theme.backgroundElement, borderColor: theme.border },
              ]}>
              <MaterialCommunityIcons name="magnify" size={17} color={theme.textTertiary} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search"
                placeholderTextColor={theme.textTertiary}
                style={[styles.searchInput, { color: theme.text }]}
              />
            </View>
          </View>
        )}

        {owners.length > 0 && documents.length > 1 && (
          <View style={styles.filterRow}>
            <FilterChip
              label="Everyone"
              active={ownerFilter === null}
              onPress={() => setOwnerFilter(null)}
            />
            {owners.map((name) => (
              <FilterChip
                key={name}
                label={name}
                active={ownerFilter === name}
                onPress={() => setOwnerFilter(ownerFilter === name ? null : name)}
              />
            ))}
          </View>
        )}

        {notificationsOn === false && documents.length > 0 && (
          <Pressable onPress={turnOnNotifications} style={styles.bannerWrap}>
            <ThemedView
              type="backgroundElement"
              style={[styles.banner, { borderColor: theme.border }]}>
              <MaterialCommunityIcons
                name="bell-off-outline"
                size={18}
                color={theme.urgentSoft}
              />
              <View style={styles.flex}>
                <ThemedText type="smallBold">Reminders are switched off</ThemedText>
                <ThemedText type="small" themeColor="textTertiary">
                  Renewly cannot warn you before anything expires. Tap to turn them on.
                </ThemedText>
              </View>
            </ThemedView>
          </Pressable>
        )}

        {loaded && documents.length === 0 ? (
          <EmptyState onAdd={() => router.push('/add')} />
        ) : sections.length === 0 ? (
          <View style={styles.noResults}>
            <ThemedText type="small" themeColor="textTertiary">
              Nothing matches “{query.trim()}”.
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
              <View style={styles.sectionHeader}>
                <ThemedText type="label" themeColor="textTertiary">
                  {section.title}
                </ThemedText>
                <View style={[styles.rule, { backgroundColor: theme.border }]} />
              </View>
            )}
            renderItem={({ item }) => (
              <View style={styles.cardWrap}>
                <DocumentCard doc={item} onPress={() => router.push(`/document/${item.id}`)} />
              </View>
            )}
            ListFooterComponent={
              archived.length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push('/archive')}
                  style={styles.archiveLink}>
                  <ThemedText type="small" themeColor="textTertiary">
                    {archived.length} archived item{archived.length === 1 ? '' : 's'}
                  </ThemedText>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={18}
                    color={theme.textTertiary}
                  />
                </Pressable>
              ) : null
            }
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress}>
      <View
        style={[
          styles.filterChip,
          {
            backgroundColor: active ? theme.accent : 'transparent',
            borderColor: active ? theme.accent : theme.border,
          },
        ]}>
        <ThemedText type="smallBold" style={active ? { color: theme.accentContrast } : undefined}>
          {label}
        </ThemedText>
      </View>
    </Pressable>
  );
}

function summaryLine(total: number, attention: number): string {
  if (total === 0) return 'Nothing expires unnoticed';
  if (attention === 0) return `${total} tracked · all clear`;
  return `${total} tracked · ${attention} need${attention === 1 ? 's' : ''} you`;
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  const theme = useTheme();
  return (
    <View style={styles.empty}>
      <ThemedText type="headline" style={styles.centered}>
        Everything that expires, in one quiet place.
      </ThemedText>
      <ThemedText type="body" themeColor="textSecondary" style={styles.centered}>
        Photograph a visa, a licence, a tenancy contract or a carton of milk. Renewly reads the
        date, remembers it, and tells you in time to act.
      </ThemedText>
      <Pressable onPress={onAdd}>
        {({ pressed }) => (
          <View
            style={[styles.ctaButton, { backgroundColor: theme.accent }, pressed && styles.pressed]}>
            <ThemedText type="smallBold" style={{ color: theme.accentContrast }}>
              Add your first item
            </ThemedText>
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
  },
  headerText: { flex: 1, gap: Spacing.two },
  tagline: { marginBottom: 2 },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  searchWrap: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.three },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 2 },
  flex: { flex: 1 },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
  },
  filterChip: {
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  bannerWrap: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.three },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
  },
  list: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.five },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.two,
  },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  cardWrap: { paddingBottom: Spacing.two },
  archiveLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.four,
  },
  noResults: { alignItems: 'center', paddingTop: Spacing.five },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
    gap: Spacing.three,
  },
  centered: { textAlign: 'center' },
  ctaButton: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    marginTop: Spacing.two,
  },
});
