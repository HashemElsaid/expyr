import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { PLANS, PREMIUM_FEATURES, purchase, restore, type Plan } from '@/lib/purchases';
import { FREE_ITEM_LIMIT, FREE_SCAN_LIMIT } from '@/store/settings';

export default function PaywallScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [selected, setSelected] = useState<Plan['id']>('annual');
  const [busy, setBusy] = useState(false);
  const selectedPlan = PLANS.find((p) => p.id === selected) ?? PLANS[0];

  async function buy() {
    setBusy(true);
    const outcome = await purchase(selected);
    setBusy(false);
    if (outcome.ok) router.back();
    else Alert.alert('Not available yet', outcome.message);
  }

  async function restorePurchases() {
    const outcome = await restore();
    if (outcome.ok) router.back();
    else Alert.alert('Nothing to restore', outcome.message);
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <ThemedText type="headline" style={styles.centered}>
            Keep everything covered
          </ThemedText>
          <ThemedText type="body" themeColor="textSecondary" style={styles.centered}>
            Expyr is free for {FREE_ITEM_LIMIT} items and {FREE_SCAN_LIMIT} scans. Unlock it to
            track everything you own, for everyone in the house.
          </ThemedText>
        </View>

        <View style={styles.features}>
          {PREMIUM_FEATURES.map((feature) => (
            <View key={feature} style={styles.feature}>
              <MaterialCommunityIcons name="check" size={18} color={theme.accent} />
              <ThemedText type="body" style={styles.flex}>
                {feature}
              </ThemedText>
            </View>
          ))}
        </View>

        <View style={styles.plans}>
          {PLANS.map((plan) => {
            const on = selected === plan.id;
            return (
              <Pressable key={plan.id} onPress={() => setSelected(plan.id)}>
                <View
                  style={[
                    styles.plan,
                    {
                      borderColor: on ? theme.accent : theme.border,
                      backgroundColor: on ? theme.backgroundSelected : theme.backgroundElement,
                    },
                  ]}>
                  <View style={styles.flex}>
                    <View style={styles.planTitleRow}>
                      <ThemedText type="bodyMedium">{plan.title}</ThemedText>
                      {plan.highlight && (
                        <View style={[styles.badge, { backgroundColor: theme.accent }]}>
                          <ThemedText type="label" style={{ color: theme.accentContrast }}>
                            {plan.highlight}
                          </ThemedText>
                        </View>
                      )}
                    </View>
                    {plan.footnote && (
                      <ThemedText type="small" themeColor="textTertiary">
                        {plan.footnote}
                      </ThemedText>
                    )}
                  </View>
                  <View style={styles.planPrice}>
                    <ThemedText type="numeral">{plan.price}</ThemedText>
                    <ThemedText type="label" themeColor="textTertiary">
                      {plan.cadence}
                    </ThemedText>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Pressable onPress={buy} disabled={busy}>
          {({ pressed }) => (
            <View
              style={[
                styles.primary,
                { backgroundColor: theme.accent },
                (pressed || busy) && styles.dim,
              ]}>
              <ThemedText type="smallBold" style={{ color: theme.accentContrast }}>
                {busy ? 'One moment…' : 'Continue'}
              </ThemedText>
            </View>
          )}
        </Pressable>

        <Pressable onPress={restorePurchases} style={styles.restore}>
          <ThemedText type="smallBold" style={{ color: theme.accent }}>
            Restore a previous purchase
          </ThemedText>
        </Pressable>

        {/*
         * Required by App Store Review Guideline 3.1.2: the title, length and
         * price of the subscription, the auto-renewal terms, and working links
         * to the Terms of Use and Privacy Policy must all be on the screen
         * where the purchase is made.
         */}
        <View style={[styles.legal, { borderTopColor: theme.border }]}>
          <ThemedText type="small" themeColor="textTertiary">
            {selectedPlan.title} — {selectedPlan.price} {selectedPlan.cadence}. Payment is charged
            to your Apple Account at confirmation.{' '}
            {selectedPlan.renews
              ? 'The subscription renews automatically unless cancelled at least 24 hours before the end of the current period, and renewal is charged within 24 hours before the period ends. Manage or cancel it any time in your Apple Account settings.'
              : 'This is a one-off purchase. Nothing renews, and there is nothing to cancel.'}{' '}
            Expyr can be shared with your Apple Family group, up to six people.
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
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: Spacing.four,
    gap: Spacing.four,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  hero: { gap: Spacing.two, paddingTop: Spacing.three },
  centered: { textAlign: 'center' },
  flex: { flex: 1 },
  features: { gap: Spacing.three },
  feature: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  plans: { gap: Spacing.two },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
  },
  planTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  badge: { borderRadius: Radius.pill, paddingHorizontal: Spacing.two, paddingVertical: 3 },
  planPrice: { alignItems: 'flex-end', gap: 2 },
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
