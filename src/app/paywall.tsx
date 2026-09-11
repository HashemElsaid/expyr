import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { topUp } from '@/domain/credits';
import { trackedSentence } from '@/domain/renewal-value';
import { useStorePrices } from '@/hooks/use-store-prices';
import { useTheme } from '@/hooks/use-theme';
import { PRO_CREDITS } from '@/lib/credit-packs';
import { successFeedback } from '@/lib/haptics';
import { PRO_PRODUCT_ID, plans, purchase, restore, type PurchaseOutcome } from '@/lib/purchases';
import { useDocuments } from '@/store/documents';
import { FREE_ITEM_LIMIT, FREE_SCAN_LIMIT, WELCOME_CREDITS, useSettings } from '@/store/settings';

/** Shorter than the word, and it reads the same in any language. */
const UNLIMITED = '∞';

/*
 * Only the ceilings the app actually enforces. Reminders, renewal steps, PDF
 * copies and backups are the same on both plans, and a comparison that quietly
 * implies otherwise is the kind of thing App Review reads closely.
 *
 * Credits are the third row, and the only one whose Pro side is a number
 * rather than an infinity: the two ceilings come off, and the credits are a
 * larger allowance rather than an endless one. That was a grey paragraph under
 * the table, which is where a claim goes to be skipped. One figure each says
 * it, and says it in the one place a person is comparing the two plans.
 */
const COMPARISON: { label: string; free: string; pro: string }[] = [
  { label: 'Items you track', free: String(FREE_ITEM_LIMIT), pro: UNLIMITED },
  { label: 'Photos scanned', free: String(FREE_SCAN_LIMIT), pro: UNLIMITED },
  {
    label: 'Expyr AI credits',
    free: String(WELCOME_CREDITS),
    pro: String(WELCOME_CREDITS + PRO_CREDITS),
  },
];

export default function PaywallScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { settings, update } = useSettings();
  const { documents } = useDocuments();
  const [busy, setBusy] = useState(false);

  /*
   * Their own paperwork, at the top of the screen that is about to ask them
   * for money. Three of the four ways in here are a ceiling they just hit, so
   * they arrive having watched the app work and then be stopped; this is the
   * one line on the screen they can check against what they are holding.
   *
   * Null on an empty list, which can only be somebody who came from Settings.
   * "You are tracking 0 items" on the screen selling a tracker argues the
   * other way.
   */
  const opener = trackedSentence(documents, settings.country);
  /*
   * Read once per render rather than at module load, so the price follows the
   * phone's region — and, once StoreKit is wired, the storefront's own
   * formatted price rather than anything written here.
   */
  const plan = plans()[0];
  /*
   * Apple's own price for this storefront, which is correct by construction
   * and stays correct when prices change. The written table is what shows
   * until the store answers, and on any build with no store in it.
   */
  const storePrices = useStorePrices();
  const price = storePrices[PRO_PRODUCT_ID] ?? plan.price;

  /*
   * Normally this modal sits on top of Settings, but it can also be the first
   * screen of the session — a deep link, or a cold start straight into it —
   * and going back from there lands nowhere.
   */
  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/settings');
  }

  /**
   * Writes down what the purchase turned out to be worth.
   *
   * The service has already granted the credits that come with Pro and its
   * balance is the one that counts; this is the phone's copy, keyed on Apple's
   * transaction identifier so the entitlement Apple replays at every launch is
   * only ever written once.
   *
   * `credits` is whatever the service said, never PRO_CREDITS. The constant is
   * for the sentence on this screen; the grant is the service's business.
   */
  function keep(outcome: Extract<PurchaseOutcome, { ok: true }>) {
    const { credits = 0, transactionId } = outcome.redeemed;
    update({
      premium: true,
      ...(credits > 0
        ? {
            credits: topUp(
              settings.credits,
              credits,
              `${credits.toLocaleString('en-US')} credits with Expyr Pro`,
              new Date(),
              transactionId
            ),
          }
        : {}),
    });
  }

  async function buy() {
    setBusy(true);
    const outcome = await purchase(plan.id);
    setBusy(false);

    if (outcome.ok) {
      keep(outcome);
      successFeedback();
      close();
      return;
    }
    // Changing your mind is not an error, and an alert about it is a scolding.
    if (outcome.cancelled) return;
    Alert.alert('That did not go through', outcome.message);
  }

  async function restorePurchases() {
    setBusy(true);
    const outcome = await restore();
    setBusy(false);

    if (outcome.ok) {
      keep(outcome);
      successFeedback();
      close();
      return;
    }
    if (outcome.cancelled) return;
    Alert.alert('Nothing to restore', outcome.message);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.closeRow}>
          <Pressable
            onPress={close}
            hitSlop={12}
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

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/*
            * The name of the thing being sold. It was "Free, or everything.",
            * which is a slogan with a full stop where iOS puts the title of
            * the screen, and a person who has just been stopped by a ceiling
            * does not need to be sold a mood.
            */}
          <ThemedText type="largeTitle">Expyr Pro</ThemedText>

          {opener && (
            <ThemedText type="body" themeColor="textSecondary" style={styles.opener}>
              {opener}.
            </ThemedText>
          )}

          {/*
            * A card on the grouped background, like every other group in the
            * app now, rather than a bordered box. Three rows, two columns, and
            * the Pro column tinted so the eye lands on the side being offered.
            */}
          <View style={[styles.table, { backgroundColor: theme.backgroundElement }]}>
            <View style={styles.tableHead}>
              <View style={styles.flex} />
              <View style={styles.cell}>
                <ThemedText type="footnote" themeColor="textSecondary">
                  Free
                </ThemedText>
              </View>
              <View style={[styles.cell, { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText type="footnote" style={{ color: theme.accent }}>
                  Pro
                </ThemedText>
              </View>
            </View>

            {COMPARISON.map((row, index) => (
              <View key={row.label}>
                {index > 0 && (
                  <View style={[styles.separator, { backgroundColor: theme.border }]} />
                )}
                <View style={styles.tableRow}>
                  <ThemedText type="body" style={styles.flex}>
                    {row.label}
                  </ThemedText>
                  <View style={styles.cell}>
                    <ThemedText type="figure" themeColor="textSecondary">
                      {row.free}
                    </ThemedText>
                  </View>
                  <View style={[styles.cell, { backgroundColor: theme.backgroundSelected }]}>
                    <ThemedText type="figure" style={{ color: theme.accent }}>
                      {row.pro}
                    </ThemedText>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={styles.foot}>
          {/*
            * The price is on the button, which is where iOS puts it, so the
            * bordered box that quoted it above the button is gone. Guideline
            * 3.1.2 wants the title, the price and the terms on the screen
            * where the purchase is made: the first two are on this button and
            * the third is the line under it.
            */}
          <Pressable onPress={buy} disabled={busy} accessibilityRole="button">
            {({ pressed }) => (
              <View
                style={[
                  styles.primary,
                  { backgroundColor: theme.accent },
                  (pressed || busy) && styles.dim,
                ]}>
                <ThemedText type="headline" style={{ color: theme.accentContrast }}>
                  {busy ? 'One moment' : `Unlock ${plan.title} for ${price}`}
                </ThemedText>
              </View>
            )}
          </Pressable>

          {/*
            * One line, from seven sentences. What the guideline needs is that
            * a person can see what they are buying, what it costs and on what
            * terms before they buy it; what it does not need is the whole of
            * the terms, which is what Terms of Use is for and why it is linked
            * here. Nothing renews, so the auto-renewal disclosure does not
            * apply and claiming one would be worse than leaving it out.
            */}
          <ThemedText type="footnote" themeColor="textTertiary" style={styles.legal}>
            One-time purchase. Nothing renews. Shares with your Apple Family.
          </ThemedText>

          <View style={styles.links}>
            <Pressable onPress={restorePurchases} accessibilityRole="button" hitSlop={8}>
              {({ pressed }) => (
                <ThemedText type="footnote" style={[{ color: theme.accent }, pressed && styles.dim]}>
                  Restore
                </ThemedText>
              )}
            </Pressable>
            <Pressable accessibilityRole="link" onPress={() => router.push('/terms')} hitSlop={8}>
              {({ pressed }) => (
                <ThemedText type="footnote" style={[{ color: theme.accent }, pressed && styles.dim]}>
                  Terms of Use
                </ThemedText>
              )}
            </Pressable>
            <Pressable accessibilityRole="link" onPress={() => router.push('/privacy')} hitSlop={8}>
              {({ pressed }) => (
                <ThemedText type="footnote" style={[{ color: theme.accent }, pressed && styles.dim]}>
                  Privacy Policy
                </ThemedText>
              )}
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center' },
  closeRow: { alignItems: 'flex-end', paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  content: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.four },
  flex: { flex: 1 },
  opener: { paddingTop: Spacing.two },
  table: { borderRadius: Radius.medium, overflow: 'hidden', marginTop: Spacing.four },
  tableHead: { flexDirection: 'row', alignItems: 'center' },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: Spacing.three },
  cell: { width: 84, alignItems: 'center', paddingVertical: 11 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: Spacing.three },
  /* The button sits where a thumb already is, under the list rather than in it. */
  foot: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.two, gap: Spacing.two },
  primary: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.medium,
    paddingVertical: 14,
  },
  legal: { textAlign: 'center' },
  links: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.four },
  dim: { opacity: 0.6 },
});
