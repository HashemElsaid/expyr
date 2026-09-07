import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { labelForId } from '@/data/document-types';
import { ensureBrandIcon, guessDomain } from '@/lib/brand-icons';
import { Segmented } from '@/components/segmented';
import { isSubscription } from '@/domain/documents';
import { TimelineRow, TimelineSectionHeader } from '@/components/timeline-row';
import { buildSections } from '@/domain/timeline';
import { searchableText } from '@/domain/fields';
import { useTheme } from '@/hooks/use-theme';
import {
  countdownShort,
  countWord,
  daysUntil,
  mastheadDate,
} from '@/lib/dates';
import { ensureNotificationPermission, getNotificationPermission } from '@/lib/notifications';
import { useDocuments } from '@/store/documents';
import { useSettings } from '@/store/settings';
import { DocumentTypeId, TrackedDocument } from '@/types';

/** The renewals that come round every year, in the order worth suggesting. */
const ANNUAL_STAPLES: DocumentTypeId[] = [
  'car-registration',
  'car-insurance',
  'health-insurance',
  'tenancy-ejari',
];

/**
 * Home: whether anything needs you today, and then the year in the order it
 * arrives.
 *
 * This was two tabs — one list sorted by urgency, another sorted by date —
 * which was the same documents twice over, and the reason neither felt like
 * the home screen. The verdict answers "do I need to worry"; everything under
 * it answers "when", which is the only question a tracker has to be good at.
 */
/** Which half of the list is showing. */
type Side = 'documents' | 'subscriptions';

export default function HomeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { documents, archived, loaded, rescheduleAll } = useDocuments();
  const { settings } = useSettings();
  const [notificationsOn, setNotificationsOn] = useState<boolean | null>(null);
  const [query, setQuery] = useState('');
  /*
   * Which half of the list is on screen.
   *
   * Documents and subscriptions are different things — one lapses and waits for
   * you, the other takes money whether or not you do anything — and this shows
   * one at a time rather than filtering within a single list.
   *
   * The cost of that is real and worth naming: half of what you track is
   * always hidden, so an expired passport can sit one tap away with nothing on
   * screen suggesting anybody look. The dot on the other segment is what pays
   * for it, and the verdict below only ever counts what is actually in view —
   * "four need you" over a list of one is the confusion a split invites.
   */
  const [side, setSide] = useState<Side>('documents');
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

  /** The two halves, split before anything else looks at them. */
  const halves = useMemo(
    () => ({
      documents: documents.filter((doc) => !isSubscription(doc)),
      subscriptions: documents.filter(isSubscription),
    }),
    [documents]
  );

  /** Only what is on screen. Everything below counts this, not the whole list. */
  const inView = useMemo(
    () => found.filter((doc) => (side === 'subscriptions') === isSubscription(doc)),
    [found, side]
  );

  /**
   * Matches for the current search that are sitting on the half you are not
   * reading.
   *
   * Searching "Netflix" from the Documents tab answered "Nothing matches
   * 'Netflix'", with Netflix one tap away — the app denying it holds something
   * it holds. The split is a browsing aid and the search is a person looking
   * for one named thing; the search has to win, or at least say where it went.
   */
  const elsewhere = useMemo(
    () =>
      query.trim()
        ? found.filter((doc) => isSubscription(doc) !== (side === 'subscriptions')).length
        : 0,
    [found, query, side]
  );

  const sections = useMemo(() => buildSections(inView), [inView]);

  /*
   * The masthead counts the half you are reading, not the search results.
   *
   * It counted what was on screen, so typing "Netflix" turned "One expired."
   * into "All quiet." — the passport is still four days over, and the app said
   * everything was fine because the person happened to be looking for
   * something else. A search narrows a list; it does not settle anything.
   */
  const onThisSide = side === 'subscriptions' ? halves.subscriptions : halves.documents;
  const expired = onThisSide.filter((d) => daysUntil(d.expiryDate) < 0);
  const soon = onThisSide.filter((d) => {
    const days = daysUntil(d.expiryDate);
    return days >= 0 && days <= 30;
  });
  const urgent = [...expired, ...soon];
  const allClear = urgent.length === 0;
  const next = useMemo(
    () => [...onThisSide].sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))[0],
    [onThisSide]
  );

  /**
   * Whether the half you are not reading has something that cannot wait.
   *
   * Overdue, or inside a week. A dot for anything merely due next month would
   * be on permanently, and a mark that is always lit stops being a mark.
   */
  const pressing = useCallback(
    (docs: TrackedDocument[]) => docs.some((doc) => daysUntil(doc.expiryDate) <= 7),
    []
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
                 * Expired is a different fact from due soon, and one figure
                 * covering both flattens the one already costing money into
                 * the three that are not.
                 *
                 * "Four need you" was the other half of this and read as a
                 * plea with the request missing: need you to do what? A
                 * masthead states, the way "All quiet" and "Two expired" do.
                 */}
                {documents.length > 0 && (
                  <ThemedText type="verdict" style={styles.verdict}>
                    {allClear
                      ? 'All quiet.'
                      : expired.length > 0
                        ? `${countWord(expired.length)} expired.`
                        : `${countWord(soon.length)} due soon.`}
                  </ThemedText>
                )}
                {allClear && next && documents.length > 0 && (
                  <ThemedText type="body" themeColor="textSecondary" style={styles.reassurance}>
                    Next: {next.title}, {countdownShort(daysUntil(next.expiryDate))}.
                  </ThemedText>
                )}
              </View>

              {/*
                * Offered only once there is something on both sides. A control
                * that splits one item from nothing asks a question with one
                * answer.
                */}
              {halves.documents.length > 0 && halves.subscriptions.length > 0 && (
                <View style={styles.segmented}>
                  <Segmented
                    value={side}
                    onChange={setSide}
                    segments={[
                      {
                        value: 'documents',
                        label: 'Documents',
                        attention: pressing(halves.documents),
                      },
                      {
                        value: 'subscriptions',
                        label: 'Subscriptions',
                        attention: pressing(halves.subscriptions),
                      },
                    ]}
                  />
                </View>
              )}

              {notificationsOn !== false &&
                allClear &&
                next &&
                daysUntil(next.expiryDate) > 120 &&
                missingAnnual.length > 0 && (
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

              {/*
                * Roughly where the list stops fitting on one screen.
                *
                * Was eight, which is a number rather than a reason: somebody
                * with seven items was already scrolling past things and had no
                * way to jump to one. A header carrying a permanent search field
                * for a person with three items is worse, so it still appears
                * rather than always being there — just at the point scrolling
                * actually starts.
                */}
              {documents.length >= 6 && (
                <View
                  style={[
                    styles.search,
                    { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                  ]}>
                  <MaterialCommunityIcons name="magnify" size={17} color={theme.textTertiary} />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder={
                      side === 'subscriptions' ? 'Search your subscriptions' : 'Search your papers'
                    }
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

              {/*
                * At most one of these, ever.
                *
                * Two banners could stack — "nothing due for months" and
                * "reminders are off" — rendered identically, one on top of the
                * other, above the list they were both interrupting. Two cards
                * that look the same are two things asking equally to be read,
                * which means neither gets read.
                *
                * Reminders win when both apply. One is a suggestion about what
                * else to track; the other is the app quietly not working.
                */}
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
          renderSectionHeader={({ section }) => (
            <TimelineSectionHeader title={section.title} />
          )}
          renderItem={({ item }) => (
            <TimelineRow doc={item} onPress={() => router.push(`/document/${item.id}`)} />
          )}
          ListEmptyComponent={
            loaded && documents.length === 0 ? (
              <EmptyState onAdd={() => router.push('/add')} />
            ) : halves.documents.length > 0 && halves.subscriptions.length > 0 && !query.trim() ? (
              /*
               * The half you are on is empty but the other is not — which only
               * happens because the list is split, so the way out is named
               * rather than left to be guessed at.
               */
              <View style={styles.empty}>
                <ThemedText type="body" themeColor="textSecondary">
                  {side === 'documents'
                    ? 'Nothing here that expires on its own. Your subscriptions are on the other tab.'
                    : 'Nothing here that charges you. Your documents are on the other tab.'}
                </ThemedText>
              </View>
            ) : query.trim() ? (
              elsewhere > 0 ? (
                /*
                 * Says where the thing went, and goes there. An empty list
                 * under a search that did match something is the worst of the
                 * three answers this screen can give.
                 */
                <Pressable
                  onPress={() => setSide(side === 'documents' ? 'subscriptions' : 'documents')}
                  accessibilityRole="button">
                  {({ pressed }) => (
                    <ThemedText
                      type="small"
                      themeColor="textTertiary"
                      style={[styles.noResults, pressed && styles.dim]}>
                      {elsewhere === 1 ? 'One match' : `${elsewhere} matches`} under{' '}
                      {side === 'documents' ? 'Subscriptions' : 'Documents'}.
                    </ThemedText>
                  )}
                </Pressable>
              ) : (
                <ThemedText type="small" themeColor="textTertiary" style={styles.noResults}>
                  Nothing matches “{query.trim()}”.
                </ThemedText>
              )
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
  segmented: { paddingTop: Spacing.four },
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
