import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { PLANS, PREMIUM_FEATURES, purchase, restore, type Plan } from '@/lib/purchases';
import { FREE_ITEM_LIMIT } from '@/store/settings';

export default function PaywallScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [selected, setSelected] = useState<Plan['id']>('annual');
  const [busy, setBusy] = useState(false);

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
            Renewly is free for {FREE_ITEM_LIMIT} items. Unlock it once and track everything you
            own, for everyone in the house.
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
          <ThemedText type="small" themeColor="textTertiary">
            Restore a previous purchase
          </ThemedText>
        </Pressable>

        <ThemedText type="small" themeColor="textTertiary" style={styles.centered}>
          Cancel any time from your Apple ID settings.
        </ThemedText>
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
  dim: { opacity: 0.6 },
});
