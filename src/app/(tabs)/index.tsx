import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { isDocumentClass, LedgerRow } from '@/components/ledger-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { labelForId } from '@/data/document-types';
import { useTheme } from '@/hooks/use-theme';
import { countdownShort, countWord, daysUntil, mastheadDate } from '@/lib/dates';
import { tapFeedback } from '@/lib/haptics';
import { ensureNotificationPermission, getNotificationPermission } from '@/lib/notifications';
import { useDocuments } from '@/store/documents';
import { useSettings } from '@/store/settings';
import { DocumentTypeId, TrackedDocument } from '@/types';

type Section = { title: string; data: TrackedDocument[] };

/** The renewals that come round every year, in the order worth suggesting. */
const ANNUAL_STAPLES: DocumentTypeId[] = [
  'car-registration',
  'car-insurance',
  'health-insurance',
  'tenancy-ejari',
];

/** Urgent first, then things that renew, then things you simply use up. */
function buildSections(docs: TrackedDocument[], allClear: boolean): Section[] {
  const needsYou: TrackedDocument[] = [];
  const documents: TrackedDocument[] = [];
  const everyday: TrackedDocument[] = [];

  for (const doc of docs) {
    if (daysUntil(doc.expiryDate) <= 30) needsYou.push(doc);
    else if (isDocumentClass(doc)) documents.push(doc);
    else everyday.push(doc);
  }

  if (allClear) {
    // With nothing pressing, one calm list reads better than three headings.
    const rest = [...documents, ...everyday];
    // An empty section would still draw its heading and hide the empty state.
    return rest.length > 0 ? [{ title: 'The year ahead', data: rest }] : [];
  }

  return [
    { title: 'Needs you', data: needsYou },
    { title: 'Documents', data: documents },
    { title: 'Everyday', data: everyday },
  ].filter((s) => s.data.length > 0);
}

export default function HomeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { documents, archived, loaded, rescheduleAll } = useDocuments();
  const { settings } = useSettings();
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
  const hasOwnItems = useMemo(() => documents.some((d) => !d.owner), [documents]);

  /*
   * The documents people reach for first — passport, ID — are the ones that
   * last a decade, so a new list can read as "nothing happens here for years".
   * These are the ones that actually come round, and they are worth naming
   * rather than leaving a quiet screen to answer the question.
   */
  const missingAnnual = useMemo(
    () =>
      ANNUAL_STAPLES.filter((id) => !documents.some((d) => d.typeId === id)).map((id) =>
        labelForId(id, settings.country)
      ),
    [documents, settings.country]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return documents.filter((doc) => {
      // null is "everyone"; '' is the phone's owner, who has no name on file.
      if (ownerFilter !== null && (doc.owner ?? '') !== ownerFilter) return false;
      if (!q) return true;
      return (
        doc.title.toLowerCase().includes(q) ||
        labelForId(doc.typeId, settings.country).toLowerCase().includes(q) ||
        doc.owner?.toLowerCase().includes(q) ||
        doc.documentNumber?.toLowerCase().includes(q) ||
        doc.notes?.toLowerCase().includes(q)
      );
    });
  }, [documents, query, ownerFilter]);

  const urgent = documents.filter((d) => daysUntil(d.expiryDate) <= 30);
  const allClear = urgent.length === 0;
  const sections = useMemo(() => buildSections(filtered, allClear), [filtered, allClear]);
  const next = documents[0];

  async function turnOnNotifications() {
    const granted = await ensureNotificationPermission();
    setNotificationsOn(granted);
    if (granted) await rescheduleAll();
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              <View style={styles.masthead}>
                <View style={styles.flex}>
                  <ThemedText type="label" themeColor="textTertiary">
                    {mastheadDate()}
                  </ThemedText>
                  {documents.length > 0 && (
                    <ThemedText type="verdict" style={styles.verdict}>
                      {allClear ? 'All quiet.' : `${countWord(urgent.length)} need${urgent.length === 1 ? 's' : ''} you.`}
                    </ThemedText>
                  )}
                </View>
              </View>

              {allClear && next && documents.length > 0 && (
                <ThemedText type="body" themeColor="textSecondary" style={styles.reassurance}>
                  Next: {next.title}, {countdownShort(daysUntil(next.expiryDate))}.
                </ThemedText>
              )}

              {allClear && next && daysUntil(next.expiryDate) > 120 && missingAnnual.length > 0 && (
                <Pressable onPress={() => router.push('/add')} accessibilityRole="button">
                  {({ pressed }) => (
                    <View
                      style={[
                        styles.banner,
                        { borderColor: theme.border },
                        pressed && styles.pressed,
                      ]}>
                      <MaterialCommunityIcons
                        name="calendar-sync-outline"
                        size={18}
                        color={theme.textTertiary}
                      />
                      <ThemedText type="small" style={styles.flex}>
                        Nothing due for months. The ones that catch people out come round every
                        year: {missingAnnual.slice(0, 3).join(', ')}.
                      </ThemedText>
                    </View>
                  )}
                </Pressable>
              )}

              {notificationsOn === false && documents.length > 0 && (
                <Pressable onPress={turnOnNotifications} accessibilityRole="button">
                  <View style={[styles.banner, { borderColor: theme.border }]}>
                    <MaterialCommunityIcons
                      name="bell-off-outline"
                      size={18}
                      color={theme.urgentSoft}
                    />
                    <ThemedText type="small" style={styles.flex}>
                      Reminders are off. Tap to turn them on.
                    </ThemedText>
                  </View>
                </Pressable>
              )}

              {documents.length >= 5 && (
                <View
                  style={[
                    styles.searchField,
                    { borderColor: theme.border, backgroundColor: theme.backgroundElement },
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
              )}

              {owners.length > 0 && documents.length > 1 && (
                <View style={styles.filterRow}>
                  <FilterChip
                    label="Everyone"
                    active={ownerFilter === null}
                    onPress={() => setOwnerFilter(null)}
                  />
                  {/* Once other people are on the list, you are a person too. */}
                  {hasOwnItems && (
                    <FilterChip
                      label="Mine"
                      active={ownerFilter === ''}
                      onPress={() => setOwnerFilter(ownerFilter === '' ? null : '')}
                    />
                  )}
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
            </View>
          }
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <ThemedText type="label" themeColor="textTertiary">
                {section.title}
              </ThemedText>
              <View style={[styles.rule, { backgroundColor: theme.border }]} />
            </View>
          )}
          renderItem={({ item }) => (
            <LedgerRow
              doc={item}
              all={documents}
              onPress={() => router.push(`/document/${item.id}`)}
            />
          )}
          ListEmptyComponent={
            loaded && documents.length === 0 ? (
              <EmptyState onAdd={() => router.push('/add')} />
            ) : query.trim() ? (
              <ThemedText type="small" themeColor="textTertiary" style={styles.noResults}>
                Nothing matches “{query.trim()}”.
              </ThemedText>
            ) : null
          }
          ListFooterComponent={
            documents.length > 0 ? (
              <View>
                {archived.length > 0 && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => router.push('/archive')}
                    style={styles.archiveLink}>
                    <ThemedText type="small" themeColor="textTertiary">
                      {archived.length} archived
                    </ThemedText>
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={18}
                      color={theme.textTertiary}
                    />
                  </Pressable>
                )}
                {/* Answers the question a sign-in screen usually answers. */}
                <ThemedText type="small" themeColor="textTertiary" style={styles.assurance}>
                  Saved on this iPhone · included in your backup
                </ThemedText>
              </View>
            ) : null
          }
        />
      </SafeAreaView>

      {/*
       * The way in sits above the tab bar, under the thumb, rather than in the
       * far top corner where nothing else is. It shows a camera because the
       * fast way to add something is to photograph it — typing a date in is
       * still there, one step further on.
       */}
      <View style={styles.dockRow} pointerEvents="box-none">
        <Pressable
          onPress={() => {
            tapFeedback();
            router.push('/add');
          }}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Add an item by photographing it">
          {({ pressed }) => (
            <View
              style={[
                styles.dock,
                {
                  backgroundColor: theme.accent,
                  borderColor: theme.background,
                  shadowColor: theme.text,
                },
                pressed && styles.docked,
              ]}>
              {/*
               * Viewfinder corners around the lens: the frame you line a
               * document up inside, shrunk onto the button that opens it.
               */}
              <View style={styles.frame} pointerEvents="none">
                {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
                  <View
                    key={corner}
                    style={[
                      styles.corner,
                      styles[corner],
                      { borderColor: theme.accentContrast },
                    ]}
                  />
                ))}
              </View>
              <MaterialCommunityIcons name="camera" size={22} color={theme.accentContrast} />
            </View>
          )}
        </Pressable>
      </View>
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
    <Pressable onPress={onPress} accessibilityRole="button">
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

function EmptyState({ onAdd }: { onAdd: () => void }) {
  const theme = useTheme();
  return (
    <View style={styles.empty}>
      <ThemedText type="verdict">Nothing yet.</ThemedText>
      <ThemedText type="body" themeColor="textSecondary">
        Photograph a visa, a licence, a tenancy contract. Expyr reads the date and remembers it
        for you.
      </ThemedText>
      <Pressable onPress={onAdd} accessibilityRole="button">
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
  flex: { flex: 1 },
  // Deep enough that the last item clears the camera button rather than
  // finishing underneath it.
  list: { paddingHorizontal: 28, paddingBottom: 96 },
  masthead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    paddingTop: Spacing.four,
  },
  verdict: { marginTop: 6 },
  reassurance: { paddingTop: Spacing.three, maxWidth: 340 },
  pressed: { opacity: 0.7 },
  /** Floats over the list, centred above the tab bar, within thumb reach. */
  dockRow: { position: 'absolute', left: 0, right: 0, bottom: Spacing.three, alignItems: 'center' },
  dock: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    // A ring of the page colour, so scrolling text never touches the button.
    borderWidth: 4,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  docked: { opacity: 0.85, transform: [{ scale: 0.96 }] },
  frame: { ...StyleSheet.absoluteFillObject, margin: 11, opacity: 0.5 },
  corner: { position: 'absolute', width: 9, height: 9 },
  tl: { top: 0, left: 0, borderTopWidth: 1.5, borderLeftWidth: 1.5, borderTopLeftRadius: 3 },
  tr: { top: 0, right: 0, borderTopWidth: 1.5, borderRightWidth: 1.5, borderTopRightRadius: 3 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 1.5, borderLeftWidth: 1.5, borderBottomLeftRadius: 3 },
  br: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 1.5,
    borderRightWidth: 1.5,
    borderBottomRightRadius: 3,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    marginTop: Spacing.four,
  },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    marginTop: Spacing.four,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 2 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.three },
  filterChip: {
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingTop: 28,
    paddingBottom: Spacing.one,
  },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  noResults: { paddingTop: Spacing.five, textAlign: 'center' },
  archiveLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.four,
  },
  assurance: { textAlign: 'center', paddingTop: Spacing.four, paddingBottom: Spacing.two },
  empty: { paddingTop: 48, gap: Spacing.three, alignItems: 'flex-start', maxWidth: 340 },
  ctaButton: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    marginTop: Spacing.two,
  },
});
