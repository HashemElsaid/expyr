import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { successFeedback } from '@/lib/haptics';
import { signIn } from '@/lib/identity';
import { useSettings } from '@/store/settings';

/**
 * What a purchase confirms, and the one thing worth doing about it.
 *
 * Credits belong to the install token until somebody signs in, and deleting
 * the app issues a new one. The service will not pay the same Apple purchase
 * twice, so credits lost that way are lost for good: signing in afterwards
 * cannot bring them back, because the token that held them is gone from every
 * phone and the new install has no way to prove it was that one.
 *
 * That makes this the only moment the offer is worth anything. A settings row
 * is where somebody goes after losing them, which is too late, and the row
 * stays there for exactly the person who reads settings. This is for everybody
 * else, at the one moment they have something to lose.
 *
 * Never a blocker. The purchase is already done and already granted before
 * this appears; `Not now` is a whole answer, and it is not asked again for
 * that purchase. An offer that has to be got past to reach what was paid for
 * would be the app holding a purchase hostage for an account.
 */
export function ProtectCredits({
  /** What they just bought, said plainly. This screen confirms it. */
  heading,
  onDone,
}: {
  heading: string;
  onDone: () => void;
}) {
  const theme = useTheme();
  const { update } = useSettings();
  const [busy, setBusy] = useState(false);

  async function protect() {
    setBusy(true);
    const outcome = await signIn();
    setBusy(false);

    if (outcome.ok) {
      update({ account: outcome.account });
      successFeedback();
      onDone();
      return;
    }
    /*
     * Backing out of Apple's sheet is an answer, not a fault, and it leaves
     * them here rather than closing the screen out from under them: they chose
     * against the sheet, not against the offer.
     */
    if (outcome.cancelled) return;
    Alert.alert('That did not work', outcome.message);
  }

  return (
    <View style={styles.container}>
      <View style={styles.body}>
        <Icon name="checkmark.circle.fill" size={56} color={theme.accent} />
        <ThemedText type="title2" style={styles.centered}>
          {heading}
        </ThemedText>
        <ThemedText type="body" style={styles.centered}>
          Keep these credits if you change phones
        </ThemedText>
        <ThemedText type="footnote" themeColor="textSecondary" style={styles.centered}>
          They live on this phone until you sign in. Reinstall Expyr without an account and they
          are gone, and signing in later cannot bring them back.
        </ThemedText>
      </View>

      <View style={styles.foot}>
        <Pressable
          onPress={protect}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Sign in with Apple to keep these credits"
          style={({ pressed }) => [
            styles.primary,
            { backgroundColor: theme.accent },
            (pressed || busy) && styles.dim,
          ]}>
          <ThemedText type="headline" style={{ color: theme.accentContrast }}>
            Sign in with Apple
          </ThemedText>
        </Pressable>

        <Pressable
          onPress={onDone}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Not now"
          style={({ pressed }) => [styles.secondary, pressed && styles.dim]}>
          <ThemedText type="body" style={{ color: theme.accent }}>
            Not now
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: Spacing.three },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.two },
  centered: { textAlign: 'center' },
  foot: { paddingBottom: Spacing.two, gap: Spacing.one },
  primary: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.medium,
    paddingVertical: 14,
  },
  secondary: { alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  dim: { opacity: 0.6 },
});
