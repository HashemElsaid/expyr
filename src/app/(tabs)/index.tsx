import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { labelForId } from '@/data/document-types';
import { ensureBrandIcon, guessDomain } from '@/lib/brand-icons';
import { Segmented } from '@/components/segmented';
import { isSubscription } from '@/domain/documents';
import { TimelineRow, TimelineSectionHeader } from '@/components/timeline-row';
import { TimelineSummary, type Focus } from '@/components/timeline-summary';
import { buildHousehold } from '@/domain/household';
import { buildSections } from '@/domain/timeline';
import { searchableText } from '@/domain/fields';
import { useTheme } from '@/hooks/use-theme';
import { daysUntil } from '@/lib/dates';
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
  /**
   * Which of the summary cards is pressed, and so which slice is listed.
   *
   * A filter rather than a screen, because the whole list is three taps of
   * scrolling long and pushing a filtered copy of it would put the same rows
   * behind a back button for no reason.
   */
  const [focus, setFocus] = useState<Focus>('all');
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

  /**
   * How many people the household holds, for the fourth card.
   *
   * The same builder the Household page uses rather than a count of distinct
   * owners, so the two screens cannot disagree about how many people there
   * are. That page counts the phone's owner even with nothing filed, and a
   * card saying three next to a page listing four would be the kind of small
   * wrongness that makes somebody stop trusting the numbers.
   */
  const people = useMemo(
    () => buildHousehold(documents, settings.people, settings.ownName).length,
    [documents, settings.people, settings.ownName]
  );

  /** What the pressed card narrows the half you are reading down to. */
  const shown = useMemo(() => {
    if (focus === 'overdue') return inView.filter((doc) => daysUntil(doc.expiryDate) < 0);
    if (focus === 'soon') {
      return inView.filter((doc) => {
        const days = daysUntil(doc.expiryDate);
        return days >= 0 && days <= 30;
      });
    }
    return inView;
  }, [inView, focus]);

  const sections = useMemo(() => buildSections(shown), [shown]);

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
                {/*
                  * The name of the screen, and that is all.
                  *
                  * This was a masthead: a tracked uppercase date, then a
                  * verdict set as a sentence with a full stop, "One expired.",
                  * then a line of reassurance under it. Three pieces of
                  * invented furniture where iOS puts one Large Title, and the
                  * first thing anybody saw on opening the app.
                  *
                  * The state did not go missing; it moved to where iOS keeps
                  * it. A red "Overdue" header sits over the overdue rows, and
                  * each row reddens its own date once it has passed.
                  */}
                <ThemedText type="largeTitle">Timeline</ThemedText>
              </View>

              {/*
                * Four cards, the way Reminders opens, and the answer to "a bit
                * simple". Stripping the invented furniture left a screen of
                * grey rows that says nothing until it is read; this answers
                * the only question anybody opens the app with, in a glance,
                * and turns the two states that matter into filters.
                */}
              {documents.length > 0 && (
                <TimelineSummary
                  overdue={expired.length}
                  soon={soon.length}
                  all={onThisSide.length}
                  people={people}
                  focus={focus}
                  onFocus={setFocus}
                  onHousehold={() => router.push('/household')}
                />
              )}

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
                      <Icon name="calendar.badge.clock" size={18} color={theme.textTertiary} />
                      <ThemedText type="footnote" style={styles.flex}>
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
                  <Icon name="magnifyingglass" size={16} color={theme.textTertiary} />
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
                      <Icon name="xmark.circle.fill" size={17} color={theme.textTertiary} />
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
                    <Icon name="bell.slash" size={18} color={theme.urgentSoft} />
                    <ThemedText type="footnote" style={styles.flex}>
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
          renderItem={({ item, index, section }) => {
            /*
             * An inset grouped card, which is what iOS puts a list inside: the
             * rows on a white card with rounded ends, hairlines between them
             * inset to where the text starts, and the section header outside
             * it on the grey. Built per row because a SectionList has no
             * wrapper to put around a section, and the first and last rows are
             * the only ones that need corners.
             */
            const first = index === 0;
            const last = index === section.data.length - 1;
            return (
              <View
                style={[
                  styles.card,
                  { backgroundColor: theme.backgroundElement },
                  first && styles.cardTop,
                  last && styles.cardBottom,
                ]}>
                <TimelineRow doc={item} onPress={() => router.push(`/document/${item.id}`)} />
                {!last && <View style={[styles.separator, { backgroundColor: theme.border }]} />}
              </View>
            );
          }}
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
                      type="footnote"
                      themeColor="textTertiary"
                      style={[styles.noResults, pressed && styles.dim]}>
                      {elsewhere === 1 ? 'One match' : `${elsewhere} matches`} under{' '}
                      {side === 'documents' ? 'Subscriptions' : 'Documents'}.
                    </ThemedText>
                  )}
                </Pressable>
              ) : (
                <ThemedText type="footnote" themeColor="textTertiary" style={styles.noResults}>
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
                    <ThemedText type="footnote" themeColor="textTertiary">
                      {archived.length} archived
                    </ThemedText>
                    <Icon name="chevron.right" size={14} weight="semibold" color={theme.textTertiary} />
                  </Pressable>
                )}
                {/*
                  * Answers the question a sign-in screen usually answers. One
                  * clause now: it was two joined by a middot, which is a
                  * punctuation mark almost nothing on iOS uses in a caption.
                  */}
                <ThemedText type="footnote" themeColor="textTertiary" style={styles.assurance}>
                  Saved on this iPhone
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
      {/*
        * Grey text in the middle of the screen, which is how Reminders says
        * "No Reminders" and how iOS says nothing-here everywhere else. This
        * was a Title 2 under the Large Title, so the screen carried two
        * headings, one of them a sentence with a full stop.
        *
        * The second line stays because it is the only place the app says what
        * it is for, and a new person reading "Nothing tracked yet" on its own
        * would be told what they can already see. The list of categories it
        * used to link to is one tap inside the button.
        */}
      <ThemedText type="body" themeColor="textSecondary" style={styles.centered}>
        Nothing tracked yet
      </ThemedText>
      <ThemedText type="footnote" themeColor="textTertiary" style={styles.centered}>
        A passport, a tenancy contract, the car insurance. The gym, the internet bill, a streaming
        plan. Anything with a date on it.
      </ThemedText>
      <Pressable onPress={onAdd} accessibilityRole="button">
        {({ pressed }) => (
          <View style={[styles.cta, { backgroundColor: theme.accent }, pressed && styles.dim]}>
            <ThemedText type="headline" style={{ color: theme.accentContrast }}>
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
  /* The card the rows sit on, squared in the middle and rounded at the ends. */
  card: { paddingHorizontal: Spacing.three },
  cardTop: { borderTopLeftRadius: Radius.medium, borderTopRightRadius: Radius.medium },
  cardBottom: { borderBottomLeftRadius: Radius.medium, borderBottomRightRadius: Radius.medium },
  /*
   * Inset to where the title starts, past the tile and the gap, which is how
   * iOS draws a separator and why its lists read as rows rather than as a
   * table.
   */
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 40 + Spacing.three },
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
  searchInput: { flex: 1, ...Fonts.body, fontSize: 15, paddingVertical: 2 },
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
