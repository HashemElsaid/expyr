import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { ListRow, ListSection } from '@/components/list';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { CREDITS_PER_PAGE, CREDITS_PER_QUESTION, formatCredits, topUp } from '@/domain/credits';
import { useStorePrices } from '@/hooks/use-store-prices';
import { useTheme } from '@/hooks/use-theme';
import { pagesIn, PACKS, priceOf, type Pack } from '@/lib/credit-packs';
import { region } from '@/lib/purchases';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { canSignIn, signIn } from '@/lib/identity';
import { purchaseCredits } from '@/lib/purchases';
import { useSettings } from '@/store/settings';

/**
 * Buying more of what Expyr AI runs on.
 *
 * One screenful, no scrolling. Somebody here is doing one thing, and a page
 * that explains itself at length before letting them do it is a page that
 * doubts whether the thing is worth buying.
 *
 * Pick a pack, press the button. The packs are rows because rows compare; the
 * button is a button because a bordered box is not one.
 */
export default function TopUpScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { settings, update } = useSettings();
  /** The middle pack, which is the one most people should take. */
  const [chosen, setChosen] = useState<Pack>(PACKS[1]);
  const [busy, setBusy] = useState(false);
  /*
   * Offered rather than required, and only where it pays for itself: on the
   * screen where somebody is spending money on something a new phone would
   * otherwise take from them. Hidden once they have done it, and hidden on any
   * phone that cannot do it at all.
   */
  const [canProtect, setCanProtect] = useState(false);

  useEffect(() => {
    // Catching, like every other promise on this screen: an unhandled
    // rejection in Expo Go is a red toast over the app.
    canSignIn().then(setCanProtect).catch(() => setCanProtect(false));
  }, []);

  async function protectCredits() {
    tapFeedback();
    setBusy(true);
    const outcome = await signIn();
    setBusy(false);

    if (outcome.ok) {
      update({ account: outcome.account });
      successFeedback();
      return;
    }
    if (outcome.cancelled) return;
    Alert.alert('That did not work', outcome.message);
  }

  const balance = settings.credits.balance;
  /*
   * Read once per render, so the packs are priced in the same currency the
   * paywall quotes Expyr Pro in. Seeing AED against one product and dollars
   * against another is the app looking like two apps.
   */
  const here = region();
  /*
   * Apple's own prices, which are right for all 175 storefronts rather than
   * the nineteen written down, and right when they change. `priceOf` is the
   * fallback for a build with no store in it.
   */
  const storePrices = useStorePrices();
  const priceFor = (pack: Pack): string => storePrices[pack.id] ?? priceOf(pack, here);

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/settings');
  }

  async function buy() {
    tapFeedback();
    setBusy(true);
    const outcome = await purchaseCredits(chosen.id);
    setBusy(false);

    // Changing your mind is not an error, and an alert about it is a scolding.
    if (!outcome.ok) {
      if (outcome.cancelled) return;
      Alert.alert('That did not go through', outcome.message);
      return;
    }

    /*
     * The service has already granted them and its balance is the one that
     * counts. This writes the phone's copy, keyed on Apple's transaction id so
     * the same purchase arriving twice, which it will, is recorded once.
     */
    const { credits = 0, transactionId } = outcome.redeemed;
    update({
      credits: topUp(settings.credits, credits, `${credits.toLocaleString('en-US')} credits`, new Date(), transactionId),
    });
    successFeedback();
    close();
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.top}>
          <Pressable
            onPress={close}
            hitSlop={16}
            accessibilityRole="button"
            accessibilityLabel="Close">
            {({ pressed }) => (
              <Icon
                name="xmark.circle.fill"
                size={26}
                color={pressed ? theme.textSecondary : theme.textTertiary}
              />
            )}
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <ThemedText type="largeTitle">Top Up</ThemedText>

          {/*
            * One group, and everything else is a footnote under it.
            *
            * The balance had a row, the two rates had a group of their own,
            * and the three packs were a third group of the same shape, so
            * nothing on the screen said which rows were a choice. Two of those
            * three were facts, and facts do not belong in a group that looks
            * like a set of options, or in a card above them where they are
            * read first.
            *
            * So the header says what to do, the circles say these are the
            * options, and what a person needs to know to choose between them
            * sits underneath in one sentence.
            */}
          <ListSection
            title="Choose a pack"
            footer={`You have ${formatCredits(balance)}. ${CREDITS_PER_PAGE} credits reads a page, ${CREDITS_PER_QUESTION} answers a question.`}>
            {PACKS.map((pack) => (
              <ListRow
                key={pack.id}
                title={`${pack.credits.toLocaleString('en-US')} credits`}
                subtitle={`${pagesIn(pack).toLocaleString('en-US')} pages`}
                value={priceFor(pack)}
                selected={pack.id === chosen.id}
                onPress={() => {
                  tapFeedback();
                  setChosen(pack);
                }}
              />
            ))}
          </ListSection>

          {/*
            * Says what is actually at stake rather than "sign in", which
            * sounds like admin somebody can skip. Credits are a consumable and
            * Apple keeps no record of one that has been used, so a new phone
            * takes them unless there is an account to follow.
            */}
          {canProtect && settings.account === null && (
            <ListSection>
              <ListRow
                symbol="person.badge.key"
                tint="blue"
                title="Keep these credits if you change phone"
                chevron={false}
                onPress={protectCredits}
              />
            </ListSection>
          )}
        </ScrollView>

        <View style={styles.foot}>
          <Pressable onPress={buy} disabled={busy} accessibilityRole="button">
            {({ pressed }) => (
              <View
                style={[
                  styles.primary,
                  { backgroundColor: theme.accent },
                  (pressed || busy) && styles.dim,
                ]}>
                <ThemedText type="headline" style={{ color: theme.accentContrast }}>
                  {busy
                    ? 'One moment'
                    : `Buy ${chosen.credits.toLocaleString('en-US')} credits for ${priceFor(chosen)}`}
                </ThemedText>
              </View>
            )}
          </Pressable>

          {/*
            * One line, which is what Guideline 3.1.2 needs here: the price and
            * the title are on the button above it, and the terms are these.
            * It was three sentences, and the one about credits following an
            * Apple Account has its own row when it applies.
            */}
          <ThemedText type="footnote" themeColor="textTertiary" style={styles.legal}>
            One-time purchase. Nothing renews. Credits do not expire.
          </ThemedText>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  dim: { opacity: 0.6 },
  top: { alignItems: 'flex-end', paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  body: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.four,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  /* The button sits where a thumb already is, under the list rather than in it. */
  foot: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  primary: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.medium,
    paddingVertical: 14,
  },
  legal: { textAlign: 'center' },
});
