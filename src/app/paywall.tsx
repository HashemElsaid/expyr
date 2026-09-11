import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { topUp } from '@/domain/credits';
import { trackedSentence } from '@/domain/renewal-value';
import { useStorePrices } from '@/hooks/use-store-prices';
import { useTheme } from '@/hooks/use-theme';
import { PRO_CREDITS, PRO_PAGES } from '@/lib/credit-packs';
import { successFeedback } from '@/lib/haptics';
import { PRO_PRODUCT_ID, plans, purchase, restore, type PurchaseOutcome } from '@/lib/purchases';
import { useDocuments } from '@/store/documents';
import { FREE_ITEM_LIMIT, FREE_SCAN_LIMIT, useSettings } from '@/store/settings';

/** Shorter than the word, and it reads the same in any language. */
const UNLIMITED = '∞';

/*
 * Only the three ceilings the app actually enforces. Reminders, renewal steps,
 * PDF copies and backups are the same on both plans, and a comparison that
 * quietly implies otherwise is the kind of thing App Review reads closely.
 */
const COMPARISON: { label: string; free: string }[] = [
  { label: 'Items you track', free: String(FREE_ITEM_LIMIT) },
  { label: 'Photos scanned', free: String(FREE_SCAN_LIMIT) },
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
              <MaterialCommunityIcons
                name="close"
                size={24}
                color={pressed ? theme.text : theme.textTertiary}
              />
            )}
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Enter step={0} style={styles.hero}>
            <ThemedText type="headline">Free, or everything.</ThemedText>
            {opener && (
              <ThemedText type="body" themeColor="textSecondary">
                {opener}.
              </ThemedText>
            )}
          </Enter>

          <Enter step={1}>
            <View style={[styles.table, { borderColor: theme.border }]}>
              <View style={styles.tableHead}>
                <View style={styles.flex} />
                <View style={[styles.cell, styles.headCell]}>
                  <ThemedText type="label" themeColor="textTertiary">
                    Free
                  </ThemedText>
                </View>
                <View
                  style={[styles.cell, styles.headCell, { backgroundColor: theme.backgroundSelected }]}>
                  <ThemedText type="label" style={{ color: theme.accent }}>
                    Pro
                  </ThemedText>
                </View>
              </View>

              {COMPARISON.map((row, index) => (
                <View
                  key={row.label}
                  style={[styles.tableRow, index > 0 && { borderTopColor: theme.border }]}>
                  <ThemedText type="body" style={styles.flex}>
                    {row.label}
                  </ThemedText>
                  <View style={styles.cell}>
                    <ThemedText type="numeral" themeColor="textTertiary">
                      {row.free}
                    </ThemedText>
                  </View>
                  <View style={[styles.cell, { backgroundColor: theme.backgroundSelected }]}>
                    <ThemedText type="numeral" style={{ color: theme.accent }}>
                      {UNLIMITED}
                    </ThemedText>
                  </View>
                </View>
              ))}
            </View>

            <ThemedText type="small" themeColor="textTertiary" style={styles.footnote}>
              Pro comes with {PRO_CREDITS.toLocaleString('en-US')} Expyr AI credits, enough to
              read {PRO_PAGES} pages. More can be bought any time.
            </ThemedText>
          </Enter>

          <Enter step={2} style={styles.buy}>
            <View
              style={[
                styles.price,
                { borderColor: theme.accent, backgroundColor: theme.backgroundSelected },
              ]}>
              <View style={styles.flex}>
                <ThemedText type="bodyMedium">{plan.title}</ThemedText>
                {plan.footnote && (
                  <ThemedText type="small" themeColor="textTertiary">
                    {plan.footnote}
                  </ThemedText>
                )}
              </View>
              <View style={styles.priceFigure}>
                <ThemedText type="numeral">{price}</ThemedText>
                <ThemedText type="label" themeColor="textTertiary">
                  {plan.cadence}
                </ThemedText>
              </View>
            </View>

            <Pressable onPress={buy} disabled={busy} accessibilityRole="button">
              {({ pressed }) => (
                <View
                  style={[
                    styles.primary,
                    { backgroundColor: theme.accent },
                    (pressed || busy) && styles.dim,
                  ]}>
                  <ThemedText type="smallBold" style={{ color: theme.accentContrast }}>
                    {busy ? 'One moment…' : 'Unlock Expyr Pro'}
                  </ThemedText>
                </View>
              )}
            </Pressable>

            <Pressable onPress={restorePurchases} style={styles.restore} accessibilityRole="button">
              <ThemedText type="smallBold" style={{ color: theme.accent }}>
                Restore a previous purchase
              </ThemedText>
            </Pressable>

            {/*
             * Guideline 3.1.2 asks for the title, price and terms of the
             * purchase on the screen where it is made, with working links to
             * the Terms and Privacy Policy. The auto-renewal disclosure it also
             * requires is for subscriptions — there is none here, and claiming
             * one would be worse than leaving it out.
             */}
            <View style={[styles.legal, { borderTopColor: theme.border }]}>
              <ThemedText type="small" themeColor="textTertiary">
                {plan.title}, {price}, {plan.cadence}. Payment is charged to your Apple Account
                at confirmation. This is a one-off purchase: it does not renew, there is nothing to
                cancel, and you will not be charged again. It removes the free limits on tracked
                items and photo scans, and includes {PRO_CREDITS.toLocaleString('en-US')} Expyr AI
                credits. It can be shared with your Apple Family group, up to six people.
              </ThemedText>

              <View style={styles.legalLinks}>
                <Pressable accessibilityRole="link" onPress={() => router.push('/terms')}>
                  <ThemedText type="smallBold" style={{ color: theme.accent }}>
                    Terms of Use
                  </ThemedText>
                </Pressable>
                <ThemedText type="small" themeColor="textTertiary">
                  ·
                </ThemedText>
                <Pressable accessibilityRole="link" onPress={() => router.push('/privacy')}>
                  <ThemedText type="smallBold" style={{ color: theme.accent }}>
                    Privacy Policy
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          </Enter>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

/**
 * Each band rises into place a beat after the one above it, so the screen
 * arrives in the order it is meant to be read rather than all at once.
 */
function Enter({
  step,
  style,
  children,
}: {
  step: number;
  style?: object;
  children: React.ReactNode;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 420,
      delay: step * 90,
      easing: Easing.out(Easing.cubic),
      // react-native-web has no native driver, and says so loudly in the console.
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [progress, step]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
          ],
        },
      ]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center' },
  closeRow: { alignItems: 'flex-end', paddingHorizontal: Spacing.four, paddingTop: Spacing.three },
  content: { padding: Spacing.four, paddingTop: Spacing.two, gap: Spacing.five },
  hero: { gap: Spacing.two },
  flex: { flex: 1 },
  table: {
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    paddingLeft: Spacing.three,
    overflow: 'hidden',
  },
  tableHead: { flexDirection: 'row', alignItems: 'center' },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'transparent',
  },
  cell: { width: 76, alignItems: 'center', paddingVertical: Spacing.three },
  /** Column headings sit tighter than the rows they label. */
  headCell: { paddingVertical: Spacing.two },
  footnote: { paddingTop: Spacing.three, paddingHorizontal: Spacing.one },
  buy: { gap: Spacing.three },
  price: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
  },
  priceFigure: { alignItems: 'flex-end', gap: 2 },
  primary: { borderRadius: Radius.pill, paddingVertical: Spacing.three, alignItems: 'center' },
  restore: { alignItems: 'center' },
  legal: {
    gap: Spacing.two,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  legalLinks: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.two },
  dim: { opacity: 0.6 },
});
