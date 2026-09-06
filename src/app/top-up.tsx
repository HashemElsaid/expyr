import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { CREDITS_PER_PAGE, CREDITS_PER_QUESTION, pagesLeft } from '@/domain/credits';
import { useTheme } from '@/hooks/use-theme';
import { pagesIn, PACKS, priceOf, type Pack } from '@/lib/credit-packs';
import { region } from '@/lib/purchases';
import { tapFeedback } from '@/lib/haptics';
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
  const { settings } = useSettings();
  /** The middle pack, which is the one most people should take. */
  const [chosen, setChosen] = useState<Pack>(PACKS[1]);
  const [busy, setBusy] = useState(false);

  const balance = settings.credits.balance;
  const left = pagesLeft(settings.credits);
  /*
   * Read once per render, so the packs are priced in the same currency the
   * paywall quotes Expyr Pro in. Seeing AED against one product and dollars
   * against another is the app looking like two apps.
   */
  const here = region();

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/settings');
  }

  async function buy() {
    tapFeedback();
    setBusy(true);
    /*
     * Nothing is granted until StoreKit is wired. A screen that handed out
     * credits on a tap would be a way to read documents for free, and the
     * pretence would have to be unpicked later anyway. When it is wired, the
     * grant belongs here and nowhere else.
     */
    setBusy(false);
    Alert.alert(
      'Not available yet',
      'Buying credits needs App Store Connect. Everything else works.'
    );
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
          <View>
            <ThemedText type="display" style={styles.balance}>
              {balance.toLocaleString('en-US')}
            </ThemedText>
            <ThemedText type="body" themeColor="textSecondary">
              credits left, enough for {left} more page{left === 1 ? '' : 's'}
            </ThemedText>
          </View>

          <View style={[styles.rates, { borderColor: theme.border }]}>
            <View style={styles.rateRow}>
              <ThemedText type="body" style={styles.flex}>
                Read a page
              </ThemedText>
              <ThemedText type="numeral" themeColor="textSecondary">
                {CREDITS_PER_PAGE}
              </ThemedText>
            </View>
            <View style={[styles.rateRow, { borderTopWidth: 1, borderTopColor: theme.border }]}>
              <ThemedText type="body" style={styles.flex}>
                Ask a question
              </ThemedText>
              <ThemedText type="numeral" themeColor="textSecondary">
                {CREDITS_PER_QUESTION}
              </ThemedText>
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
                  accessibilityLabel={`${pack.credits} credits for ${priceOf(pack, here)}`}>
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
                      <ThemedText type="numeral">{priceOf(pack, here)}</ThemedText>
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
                    {busy ? 'One moment' : `Buy for ${priceOf(chosen, here)}`}
                  </ThemedText>
                </View>
              )}
            </Pressable>

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
