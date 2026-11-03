import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { offerFor } from '@/domain/store-offer';
import { useStorePrices } from '@/hooks/use-store-prices';
import { useTheme } from '@/hooks/use-theme';
import { PRO_PRODUCT_ID, plans } from '@/lib/purchases';

/** Apple's standard licence, which these terms sit on top of. */
const APPLE_EULA = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

const SECTIONS: { title: string; body: string }[] = [
  {
    title: 'What Expyr is',
    body: 'Expyr records dates you give it and reminds you before they pass. It is a personal organiser, not a legal, immigration or financial service, and it does not act on your behalf with any authority.',
  },
  {
    title: 'The renewal guidance',
    body: 'Costs, fines, processing times and steps shown in the app are indicative and were correct to the best of our knowledge when written. Government fees and procedures change. Always confirm with the official channel before acting. Expyr is not responsible for a fine, a lapsed document or a missed deadline.',
  },
  {
    title: 'Reminders',
    body: 'Reminders are scheduled by your phone. If notifications are switched off, the phone is off, or iOS delays them, they may not arrive. Expyr is a helpful backup for your memory, not a guarantee.',
  },
  {
    title: 'Your content',
    body: 'The documents, photos and notes you add are yours. They are stored on your device. We claim no ownership and no licence over them.',
  },
  {
    title: 'Paying for Expyr',
    body: 'Expyr is free to use. It tracks every subscription you add, with reminders for a limited number of them, and a limited number of documents and scans. Unlocking it lifts those limits and costs one payment. It is not a subscription: payment is charged to your Apple Account at confirmation, nothing renews, there is nothing to cancel, and you will not be charged again. The purchase can be shared with your Apple Family group, up to six people.',
  },
  {
    title: 'Ending your use',
    body: 'You can delete your data at any time from Settings, and you can delete the app. Doing so removes everything held on the device.',
  },
];

export default function TermsScreen() {
  const theme = useTheme();
  const plan = plans()[0];
  /*
   * Apple's own price for this storefront, the same one the paywall shows, so
   * the terms never quote a different figure from the button. The written
   * table only shows until StoreKit answers, or where it never does.
   */
  const offer = offerFor(useStorePrices(), PRO_PRODUCT_ID, plan.price);
  const price = offer.kind === 'unavailable' ? plan.price : offer.price;

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ThemedText type="largeTitle">Terms of use</ThemedText>
        <ThemedText type="body" themeColor="textSecondary">
          Plain terms for a small app. Apple&apos;s standard licence applies as well.
        </ThemedText>

        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThemedText type="footnote" themeColor="textTertiary">
                {section.title}
              </ThemedText>
              <View style={[styles.rule, { backgroundColor: theme.border }]} />
            </View>
            <ThemedText type="body" themeColor="textSecondary">
              {section.body}
            </ThemedText>
          </View>
        ))}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText type="footnote" themeColor="textTertiary">
              Current prices
            </ThemedText>
            <View style={[styles.rule, { backgroundColor: theme.border }]} />
          </View>
          <ThemedText type="body" themeColor="textSecondary">
            {plan.title}, {price}, {plan.cadence}. Prices may differ by region and are shown
            in the App Store before you confirm.
          </ThemedText>
        </View>

        <Pressable
          accessibilityRole="link"
          onPress={() => Linking.openURL(APPLE_EULA).catch(() => {})}>
          <ThemedText type="footnoteStrong" style={[styles.link, { color: theme.accent }]}>
            Read Apple&apos;s standard licence agreement
          </ThemedText>
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: 28,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  section: { gap: Spacing.two, paddingTop: Spacing.three },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  link: { paddingTop: Spacing.four },
});
