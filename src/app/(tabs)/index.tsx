import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DocIcon } from '@/components/doc-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { labelForId } from '@/data/document-types';
import { ensureBrandIcon, guessDomain } from '@/lib/brand-icons';
import { searchableText } from '@/domain/fields';
import { useTheme } from '@/hooks/use-theme';
import { urgencyColor } from '@/hooks/use-urgency';
import {
  countdownLabel,
  countdownShort,
  countWord,
  daysUntil,
  mastheadDate,
  urgencyFor,
} from '@/lib/dates';
import { ensureNotificationPermission, getNotificationPermission } from '@/lib/notifications';
import { useDocuments } from '@/store/documents';
import { useSettings } from '@/store/settings';
import { DocumentTypeId, TrackedDocument } from '@/types';

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

/** The renewals that come round every year, in the order worth suggesting. */
const ANNUAL_STAPLES: DocumentTypeId[] = [
  'car-registration',
  'car-insurance',
  'health-insurance',
  'tenancy-ejari',
];

/** One section per calendar month, in date order, so the year reads as a story. */
function buildSections(docs: TrackedDocument[]): Section[] {
  const byMonth = new Map<string, TrackedDocument[]>();
  /*
   * Anything already past comes out of the calendar and goes to the top under
   * its own heading. Filed by month it reads as history — an Emirates ID that
   * lapsed in August sits under "August 2026", above today, looking as settled
   * as a tenancy that ends next year. It is not history. It is costing AED 20
   * a day, and it is the only thing on the screen that cannot wait.
   */
  const overdue: TrackedDocument[] = [];

  const sorted = [...docs].sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
  for (const doc of sorted) {
    if (daysUntil(doc.expiryDate) < 0) {
      overdue.push(doc);
      continue;
    }
    const date = new Date(`${doc.expiryDate}T00:00:00`);
    const key = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, '0')}`;
    const existing = byMonth.get(key);
    if (existing) existing.push(doc);
    else byMonth.set(key, [doc]);
  }

  const months = [...byMonth.entries()].map(([key, data]) => {
    const [year, month] = key.split('-');
    return { title: `${MONTHS[Number(month)]} ${year}`, data };
  });

  return overdue.length > 0 ? [{ title: 'Overdue', data: overdue }, ...months] : months;
}

/**
 * Home: whether anything needs you today, and then the year in the order it
 * arrives.
 *
 * This was two tabs — one list sorted by urgency, another sorted by date —
 * which was the same documents twice over, and the reason neither felt like
 * the home screen. The verdict answers "do I need to worry"; everything under
 * it answers "when", which is the only question a tracker has to be good at.
 */
export default function HomeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { documents, archived, loaded, rescheduleAll } = useDocuments();
  const { settings } = useSettings();
  const [notificationsOn, setNotificationsOn] = useState<boolean | null>(null);
  const [query, setQuery] = useState('');
  /** Bumped when an icon lands, so the rows redraw wearing it. */
  const [, setIconsFetched] = useState(0);

  useFocusEffect(
    useCallback(() => {
      getNotificationPermission().then(setNotificationsOn).catch(() => setNotificationsOn(null));
    }, [])
  );

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

  /*
   * Searching what you own, once owning it means more than a screenful. Five
   * items need no search and a field over them is clutter; twenty spread across
   * three years is a scroll, and the thing being looked for is usually one
   * word — a name, a person, a policy number.
   */
  const found = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return documents;
    /*
     * Everything the scan read counts, not just the title. "Salama" should
     * find the motor policy issued by Salama even though nothing in its title
     * says so — which is most of the point of having read the document at all.
     */
    return documents.filter((doc) =>
      `${searchableText(doc)} ${labelForId(doc.typeId, settings.country).toLowerCase()}`.includes(
        needle
      )
    );
  }, [documents, query, settings.country]);

  const sections = useMemo(() => buildSections(found), [found]);
  const expired = documents.filter((d) => daysUntil(d.expiryDate) < 0);
  const soon = documents.filter((d) => {
    const days = daysUntil(d.expiryDate);
    return days >= 0 && days <= 30;
  });
  const urgent = [...expired, ...soon];
  const allClear = urgent.length === 0;
  const next = useMemo(
    () => [...documents].sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))[0],
    [documents]
  );

  /*
   * One pass over the subscriptions when the list appears, fetching any icon
   * this phone has not got yet. ensureBrandIcon does nothing when the file is
   * already there, so this costs one request per service, once, ever.
   */
  useEffect(() => {
    let live = true;
    (async () => {
      let fetched = false;
      for (const doc of documents) {
        if (!doc.renewsEvery && doc.typeId !== 'membership') continue;
        const got = await ensureBrandIcon(
          doc.iconDomain ?? guessDomain(doc.title)
        );
        fetched = fetched || got;
      }
      /*
       * The rows read the icon off the disk while rendering, so an icon that
       * arrives after the list has drawn is invisible until something else
       * causes a redraw. This is that something else.
       */
      if (fetched && live) setIconsFetched((n) => n + 1);
    })();
    return () => {
      live = false;
    };
  }, [documents]);

  async function turnOnNotifications() {
    const granted = await ensureNotificationPermission();
    setNotificationsOn(granted);
    if (granted) await rescheduleAll();
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              <View style={styles.masthead}>
                <ThemedText type="label" themeColor="textTertiary">
                  {mastheadDate()}
                </ThemedText>
                {/*
                 * Expired is a different fact from due soon, and saying "four
                 * need you" flattens the one that is already costing money into
                 * the three that are not.
                 */}
                {documents.length > 0 && (
                  <ThemedText type="verdict" style={styles.verdict}>
                    {allClear
                      ? 'All quiet.'
                      : expired.length > 0
                        ? `${countWord(expired.length)} expired.`
                        : `${countWord(soon.length)} need${soon.length === 1 ? 's' : ''} you.`}
                  </ThemedText>
                )}
                {allClear && next && documents.length > 0 && (
                  <ThemedText type="body" themeColor="textSecondary" style={styles.reassurance}>
                    Next: {next.title}, {countdownShort(daysUntil(next.expiryDate))}.
                  </ThemedText>
                )}
              </View>

              {allClear && next && daysUntil(next.expiryDate) > 120 && missingAnnual.length > 0 && (
                <Pressable onPress={() => router.push('/add')} accessibilityRole="button">
                  {({ pressed }) => (
                    <View
                      style={[styles.banner, { borderColor: theme.border }, pressed && styles.dim]}>
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

              {documents.length >= 8 && (
                <View
                  style={[
                    styles.search,
                    { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                  ]}>
                  <MaterialCommunityIcons name="magnify" size={17} color={theme.textTertiary} />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search your papers"
                    placeholderTextColor={theme.textTertiary}
                    autoCorrect={false}
                    style={[styles.searchInput, { color: theme.text }]}
                    accessibilityLabel="Search"
                  />
                  {query.length > 0 && (
                    <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Clear">
                      <MaterialCommunityIcons
                        name="close-circle"
                        size={17}
                        color={theme.textTertiary}
                      />
                    </Pressable>
                  )}
                </View>
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
            </View>
          }
          renderSectionHeader={({ section }) => {
            const overdue = section.title === 'Overdue';
            return (
              <View style={styles.monthHeader}>
                <ThemedText
                  type="label"
                  themeColor={overdue ? undefined : 'textTertiary'}
                  style={overdue ? { color: theme.urgentStrong } : undefined}>
                  {section.title}
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
          }}
          renderItem={({ item }) => {
            const date = new Date(`${item.expiryDate}T00:00:00`);
            const days = daysUntil(item.expiryDate);
            const color = urgencyColor(urgencyFor(days), theme);
            const label = labelForId(item.typeId, settings.country);

            return (
              <Pressable onPress={() => router.push(`/document/${item.id}`)}>
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
                        {item.title}
                      </ThemedText>
                      {/*
                       * What this row cannot show any other way. The countdown
                       * is the point of the app and was missing from the list
                       * entirely, and "Expires this day" appeared under things
                       * that expired a fortnight ago because it was written as
                       * a filler for rows with nothing else to say.
                       */}
                      <ThemedText type="small" themeColor="textTertiary" numberOfLines={1}>
                        {[
                          /*
                           * First, and only when it is close. The big date on
                           * the left already says when; how long is what a
                           * person needs when the answer is soon or already
                           * past, and last in the line it was being truncated
                           * away on every row.
                           */
                          days <= 30 ? countdownLabel(days) : null,
                          item.owner,
                          // A subscription's plan and price beat repeating its type.
                          item.renewsEvery ? item.notes : null,
                          // "Claude Pro - Monthly · AED 73.99 · Subscription / Membership" —
                          // the last part is the only one nobody needed.
                          item.title.trim() === label || (item.renewsEvery && item.notes)
                            ? null
                            : label,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </ThemedText>
                    </View>

                    <DocIcon
                      typeId={item.typeId}
                      iconDomain={
                        item.iconDomain ??
                        (item.renewsEvery || item.typeId === 'membership'
                          ? guessDomain(item.title)
                          : undefined)
                      }
                      size={38}
                    />
                  </View>
                )}
              </Pressable>
            );
          }}
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
    </ThemedView>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  const theme = useTheme();
  return (
    <View style={styles.empty}>
      <ThemedText type="verdict">Nothing yet.</ThemedText>
      <ThemedText type="body" themeColor="textSecondary" style={styles.centered}>
        Photograph a visa, a licence, a tenancy contract. Expyr reads the date and remembers it for
        you.
      </ThemedText>
      <Pressable onPress={onAdd} accessibilityRole="button">
        {({ pressed }) => (
          <View style={[styles.cta, { backgroundColor: theme.accent }, pressed && styles.dim]}>
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
  // Deep enough that the last row clears the camera button on the tab bar.
  list: { paddingHorizontal: Spacing.four, paddingBottom: 72 },
  masthead: { paddingTop: Spacing.four },
  verdict: { marginTop: 6 },
  reassurance: { paddingTop: Spacing.three, maxWidth: 340 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    marginTop: Spacing.four,
  },
  searchInput: { flex: 1, fontFamily: Fonts.body, fontSize: 15, paddingVertical: 2 },
  noResults: { paddingTop: Spacing.five, textAlign: 'center' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    marginTop: Spacing.four,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.two,
  },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  ruleStrong: { opacity: 0.4 },
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
  archiveLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.four,
  },
  assurance: { paddingTop: Spacing.three },
  empty: { alignItems: 'center', gap: Spacing.three, paddingTop: Spacing.six },
  centered: { textAlign: 'center' },
  cta: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    marginTop: Spacing.two,
  },
  dim: { opacity: 0.6 },
});
