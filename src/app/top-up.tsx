import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import {
  CREDITS_PER_PAGE,
  CREDITS_PER_QUESTION,
  documentsLeft,
  formatCredits,
} from '@/domain/credits';
import { useTheme } from '@/hooks/use-theme';
import { documentsIn, PACKS, TYPICAL_PAGES, type Pack } from '@/lib/credit-packs';
import { tapFeedback } from '@/lib/haptics';
import { useSettings } from '@/store/settings';

/**
 * Buying more of what Expyr AI runs on.
 *
 * Reading a contract and answering questions about it costs real money every
 * time, and unlike everything else in the app that cost does not stop. Credits
 * exist so the person choosing to spend it can see it — which is also why this
 * screen leads with what they have rather than with what they could buy.
 *
 * The packs are sold at close to what the credits cost us. The profit is in
 * Expyr Pro; this is the meter, not the margin.
 */
export default function TopUpScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { settings } = useSettings();
  const [busy, setBusy] = useState<Pack['id'] | null>(null);

  const balance = settings.credits.balance;
  const left = documentsLeft(settings.credits, TYPICAL_PAGES);

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/settings');
  }

  async function buy(pack: Pack) {
    tapFeedback();
    setBusy(pack.id);

    /*
     * Nothing is charged and nothing is granted until StoreKit is wired: a
     * screen that handed out credits on a tap would be a way to read documents
     * for free, and the pretence would have to be unpicked later anyway.
     *
     * When it is wired, the grant belongs here and nowhere else: one place
     * that turns a completed purchase into a topUp() entry on the ledger.
     */
    setBusy(null);
    Alert.alert(
      'Not available yet',
      'Top-ups need an Apple Developer account and products set up in App Store Connect. Everything else about credits already works.'
    );
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
          {/*
            * What they have, before what they could buy. Somebody arriving here
            * because a read was refused already knows they want more; somebody
            * arriving from Settings mostly wants to know where they stand.
            */}
          <View style={styles.hero}>
            <ThemedText type="display" style={styles.balance}>
              {balance.toLocaleString('en-US')}
            </ThemedText>
            <ThemedText type="body" themeColor="textSecondary">
              credits left — about {left} more document{left === 1 ? '' : 's'}.
            </ThemedText>
          </View>

          <View style={[styles.rates, { borderColor: theme.border }]}>
            <View style={styles.rateRow}>
              <ThemedText type="body" style={styles.flex}>
                Reading a page
              </ThemedText>
              <ThemedText type="numeral" themeColor="textSecondary">
                {CREDITS_PER_PAGE}
              </ThemedText>
            </View>
            <View style={[styles.rateRow, { borderTopColor: theme.border, borderTopWidth: 1 }]}>
              <ThemedText type="body" style={styles.flex}>
                Asking a question
              </ThemedText>
              <ThemedText type="numeral" themeColor="textSecondary">
                {CREDITS_PER_QUESTION}
              </ThemedText>
            </View>
          </View>

          <ThemedText type="small" themeColor="textTertiary" style={styles.footnote}>
            A {TYPICAL_PAGES}-page contract costs {TYPICAL_PAGES * CREDITS_PER_PAGE} credits to
            read, once. After that you can ask it anything, and only the questions cost.
          </ThemedText>

          <View style={styles.packs}>
            {PACKS.map((pack) => (
              <Pressable
                key={pack.id}
                onPress={() => buy(pack)}
                disabled={busy !== null}
                accessibilityRole="button"
                accessibilityLabel={`Buy ${formatCredits(pack.credits)} for ${pack.price}`}>
                {({ pressed }) => (
                  <View
                    style={[
                      styles.pack,
                      { borderColor: theme.border },
                      (pressed || busy === pack.id) && styles.dim,
                    ]}>
                    <View style={styles.flex}>
                      <ThemedText type="bodyMedium">{formatCredits(pack.credits)}</ThemedText>
                      <ThemedText type="small" themeColor="textTertiary">
                        About {documentsIn(pack)} documents
                      </ThemedText>
                    </View>
                    <ThemedText type="numeral">{pack.price}</ThemedText>
                  </View>
                )}
              </Pressable>
            ))}
          </View>

          {/*
            * Guideline 3.1.2 wants the title, price and terms of a purchase on
            * the screen where it is made. These are consumables: they are spent,
            * they do not renew, and — the part people are caught out by — Apple
            * does not restore them, so saying so here is the honest thing rather
            * than the small print.
            */}
          <View style={[styles.legal, { borderTopColor: theme.border }]}>
            <ThemedText type="small" themeColor="textTertiary">
              Credits are a one-off purchase, charged to your Apple Account at confirmation. They do
              not renew and there is nothing to cancel. They are spent as you use Expyr AI, they do
              not expire, and any unused balance stays on this phone.
            </ThemedText>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  dim: { opacity: 0.6 },
  closeRow: { alignItems: 'flex-end', paddingHorizontal: Spacing.four, paddingTop: Spacing.two },
  content: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.four,
  },
  hero: { gap: 4, paddingTop: Spacing.two },
  balance: { fontSize: 52, lineHeight: 54 },
  rates: { borderWidth: 1, borderRadius: Radius.medium, overflow: 'hidden' },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  footnote: { marginTop: -Spacing.two },
  packs: { gap: Spacing.two },
  pack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  legal: { borderTopWidth: 1, paddingTop: Spacing.three },
});
