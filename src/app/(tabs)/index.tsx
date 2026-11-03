import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/form';
import { GroupedItem, SubscriptionRow } from '@/components/item-row';
import { PageFooter, PageHeader, RemindersOffBanner, StatStrip } from '@/components/page';
import { useTabBarFrame } from '@/components/pager';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TimelineSectionHeader } from '@/components/timeline-row';
import { YearCard } from '@/components/year-card';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { isSubscription } from '@/domain/documents';
import { yearlyTotal } from '@/domain/money';
import { buildSections } from '@/domain/timeline';
import { dueWithin } from '@/domain/year';
import { ensureBrandIcon, guessDomain } from '@/lib/brand-icons';
import { shortMoney } from '@/lib/figures';
import { useTheme } from '@/hooks/use-theme';
import { useDocuments } from '@/store/documents';
import { FREE_SUBSCRIPTION_REMINDERS } from '@/store/settings';

/**
 * Subscriptions: the page Expyr opens on.
 *
 * The year's cost on the card first, because that is the number nobody
 * knows and everybody is a little afraid of. Then three figures for the
 * month ahead, then every subscription in the order it charges, grouped by
 * month so "what's coming" reads straight down the page.
 *
 * Documents have their own page beside this one now. They were the other
 * half of one list behind a switch, which meant half of what somebody
 * tracked was always hidden.
 */
export default function SubscriptionsPage() {
  const router = useRouter();
  const { documents, loaded, reminded } = useDocuments();
  const bar = useTabBarFrame();
  /** Bumped when an icon lands, so the rows redraw wearing it. */
  const [, setIconsFetched] = useState(0);

  const subscriptions = useMemo(() => documents.filter(isSubscription), [documents]);
  const sections = useMemo(() => buildSections(subscriptions), [subscriptions]);

  /** How many charges nothing is reminding them about, on the free plan. */
  const unwatched = subscriptions.filter((doc) => !reminded.has(doc.id)).length;
  const total = yearlyTotal(subscriptions);
  const currency = total.kind === 'none' ? null : total.currency;
  const due = dueWithin(subscriptions, currency ?? '');

  /*
   * One pass over the subscriptions when the page appears, fetching any
   * service icon this phone has not got yet. ensureBrandIcon does nothing when
   * the file is already there, so this costs one request per service, once.
   */
  useEffect(() => {
    let live = true;
    (async () => {
      let fetched = false;
      for (const doc of subscriptions) {
        const got = await ensureBrandIcon(doc.iconDomain ?? guessDomain(doc.title));
        fetched = fetched || got;
      }
      // The rows read the icon off the disk while rendering, so redraw them.
      if (fetched && live) setIconsFetched((n) => n + 1);
    })();
    return () => {
      live = false;
    };
  }, [subscriptions]);

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
              <PageHeader title="Subscriptions" />
              {subscriptions.length > 0 && <YearCard subscriptions={subscriptions} />}
              {unwatched > 0 && (
                <AllowanceNotice unwatched={unwatched} onPro={() => router.push('/paywall')} />
              )}
              <RemindersOffBanner />
              {subscriptions.length > 0 && (
                <StatStrip
                  stats={[
                    { value: String(due.count), label: 'Next 30 days' },
                    {
                      value: currency ? shortMoney(due.amount, currency) : '0',
                      label: 'Due in 30 days',
                    },
                    { value: String(subscriptions.length), label: 'Tracked' },
                  ]}
                />
              )}
            </View>
          }
          renderSectionHeader={({ section }) => <TimelineSectionHeader title={section.title} />}
          renderItem={({ item, index, section }) => (
            <GroupedItem first={index === 0} last={index === section.data.length - 1}>
              <SubscriptionRow doc={item} onPress={() => router.push(`/document/${item.id}`)} />
            </GroupedItem>
          )}
          ListEmptyComponent={
            loaded ? <EmptySubscriptions onAdd={() => router.push('/subscriptions')} /> : undefined
          }
          ListFooterComponent={<PageFooter />}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

/**
 * Under the year card on the free plan, once some charges have nothing
 * reminding them. The figure above is the problem; this is where the fix is
 * offered, in the words of what it does.
 */
function AllowanceNotice({ unwatched, onPro }: { unwatched: number; onPro: () => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.notice, { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.noticeText}>
        <ThemedText type="headline">
          {unwatched} {unwatched === 1 ? 'charge' : 'charges'} with no reminder
        </ThemedText>
        <ThemedText type="footnote" themeColor="textSecondary">
          The free plan reminds you about {FREE_SUBSCRIPTION_REMINDERS}. Pro reminds you before
          every one.
        </ThemedText>
      </View>
      <PrimaryButton label="Remind me before every charge" onPress={onPro} />
    </View>
  );
}

/**
 * Before the first one. Says the one thing to do, which is the screenshot,
 * because iOS already keeps the list and copying it out by hand is exactly
 * the chore that lets subscriptions go unnoticed.
 */
function EmptySubscriptions({ onAdd }: { onAdd: () => void }) {
  return (
    <View style={styles.empty}>
      <ThemedText type="title2">Every subscription, from one screenshot</ThemedText>
      <ThemedText type="body" themeColor="textSecondary">
        Open iPhone Settings, tap your name, then Subscriptions, and take a screenshot. Expyr
        reads every one.
      </ThemedText>
      <PrimaryButton label="Add from a screenshot" onPress={onAdd} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  list: { paddingHorizontal: 20, paddingTop: Spacing.two },
  empty: { gap: Spacing.three, paddingTop: Spacing.four },
  notice: {
    marginTop: Spacing.three,
    padding: Spacing.three,
    borderRadius: 18,
    gap: Spacing.three,
  },
  noticeText: { gap: 2 },
});
