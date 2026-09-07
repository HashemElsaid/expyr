import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { CREDITS_PER_PAGE, CREDITS_PER_QUESTION, topUp } from '@/domain/credits';
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
    canSignIn().then(setCanProtect);
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
              <MaterialCommunityIcons
                name="close"
                size={24}
                color={pressed ? theme.text : theme.textTertiary}
              />
            )}
          </Pressable>
        </View>

        <View style={styles.body}>
          {/*
            * The label goes above the number and nothing goes below it. A
            * sentence under a figure that large reads as an apology for it,
            * and everything it said is derivable from the two rates directly
            * beneath: ten credits a page, three hundred credits, thirty pages.
            */}
          <View>
            <ThemedText type="label" themeColor="textTertiary">
              Credits
            </ThemedText>
            <ThemedText type="display" style={styles.balance}>
              {balance.toLocaleString('en-US')}
            </ThemedText>
          </View>

          <View style={[styles.rates, { borderColor: theme.border }]}>
            <View style={styles.rateRow}>
              <ThemedText type="body" style={styles.flex}>
                Read a page
              </ThemedText>
              <View style={styles.rateValue}>
                <ThemedText type="numeral" themeColor="textSecondary">
                  {CREDITS_PER_PAGE}
                </ThemedText>
                <ThemedText type="small" themeColor="textTertiary">
                  credits
                </ThemedText>
              </View>
            </View>
            <View style={[styles.rateRow, { borderTopWidth: 1, borderTopColor: theme.border }]}>
              <ThemedText type="body" style={styles.flex}>
                Ask a question
              </ThemedText>
              <View style={styles.rateValue}>
                <ThemedText type="numeral" themeColor="textSecondary">
                  {CREDITS_PER_QUESTION}
                </ThemedText>
                <ThemedText type="small" themeColor="textTertiary">
                  credits
                </ThemedText>
              </View>
            </View>
          </View>

          <View style={styles.packs}>
            {PACKS.map((pack) => {
              const picked = pack.id === chosen.id;
              return (
                <Pressable
                  key={pack.id}
                  onPress={() => {
                    tapFeedback();
                    setChosen(pack);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: picked }}
                  accessibilityLabel={`${pack.credits} credits for ${priceFor(pack)}`}>
                  {({ pressed }) => (
                    <View
                      style={[
                        styles.pack,
                        {
                          borderColor: picked ? theme.accent : theme.border,
                          backgroundColor: picked ? theme.backgroundSelected : 'transparent',
                        },
                        pressed && styles.dim,
                      ]}>
                      <MaterialCommunityIcons
                        name={picked ? 'circle-slice-8' : 'circle-outline'}
                        size={20}
                        color={picked ? theme.accent : theme.textTertiary}
                      />
                      <View style={styles.flex}>
                        <ThemedText type="bodyMedium">
                          {pack.credits.toLocaleString('en-US')} credits
                        </ThemedText>
                        <ThemedText type="small" themeColor="textTertiary">
                          {pagesIn(pack).toLocaleString('en-US')} pages
                        </ThemedText>
                      </View>
                      <ThemedText type="numeral">{priceFor(pack)}</ThemedText>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          <View style={styles.foot}>
            <Pressable onPress={buy} disabled={busy} accessibilityRole="button">
              {({ pressed }) => (
                <View
                  style={[
                    styles.primary,
                    { backgroundColor: theme.accent },
                    (pressed || busy) && styles.dim,
                  ]}>
                  <ThemedText type="smallBold" style={{ color: theme.accentContrast }}>
                    {busy ? 'One moment' : `Buy for ${priceFor(chosen)}`}
                  </ThemedText>
                </View>
              )}
            </Pressable>

            {/*
              * Says what is actually at stake rather than "sign in", which
              * sounds like admin somebody can skip. Credits are a consumable
              * and Apple keeps no record of one that has been used, so a new
              * phone takes them unless there is an account to follow.
              */}
            {canProtect && settings.account === null && (
              <Pressable onPress={protectCredits} disabled={busy} accessibilityRole="button">
                {({ pressed }) => (
                  <ThemedText
                    type="small"
                    themeColor="textSecondary"
                    style={[styles.legal, pressed && styles.dim]}>
                    Keep these credits if you change phone
                  </ThemedText>
                )}
              </Pressable>
            )}

            {settings.account !== null && (
              <ThemedText type="small" themeColor="textTertiary" style={styles.legal}>
                These credits follow your Apple Account to a new phone.
              </ThemedText>
            )}

            {/* Guideline 3.1.2 wants the terms where the purchase is made. */}
            <ThemedText type="small" themeColor="textTertiary" style={styles.legal}>
              One off purchase, charged to your Apple Account. Nothing renews. Credits do not
              expire.
            </ThemedText>
          </View>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  dim: { opacity: 0.6 },
  top: { alignItems: 'flex-end', paddingHorizontal: Spacing.four, paddingTop: Spacing.two },
  body: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.three,
  },
  balance: { fontSize: 52, lineHeight: 56 },
  rateValue: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  rates: { borderWidth: 1, borderRadius: Radius.medium, overflow: 'hidden' },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  packs: { gap: Spacing.two },
  pack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  /* Pushed to the bottom so the button sits where a thumb already is. */
  foot: { marginTop: 'auto', gap: Spacing.two },
  primary: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
  },
  legal: { textAlign: 'center' },
});
