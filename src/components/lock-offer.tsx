import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { authenticate, checkBiometricSupport } from '@/lib/biometrics';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { useDocuments } from '@/store/documents';
import { useSettings } from '@/store/settings';

/**
 * The one time Expyr asks to be locked.
 *
 * The switch has always been in Settings, where a new user never goes, so the
 * app that holds somebody's passport sat open to anyone holding the phone. It
 * is offered here instead — once, at the moment there is finally something
 * worth locking, which is the first photograph of a document — and then never
 * again whatever the answer.
 *
 * Not on by default, deliberately. Forcing biometrics on somebody who wanted to
 * track their Mulkiya is its own kind of rude, and a lock nobody chose is a
 * lock they turn off the second it interrupts them.
 */
export function LockOffer() {
  const theme = useTheme();
  const { settings, loaded, update } = useSettings();
  const { documents } = useDocuments();
  const [biometrics, setBiometrics] = useState({ available: false, label: 'Face ID' });

  useEffect(() => {
    checkBiometricSupport().then(setBiometrics).catch(() => {});
  }, []);

  /*
   * A document with a photo attached to it — a passport, an ID, the things
   * somebody would mind a stranger seeing. A typed-in expiry date on its own
   * is not worth interrupting anybody for.
   */
  const holdsSomethingPrivate = documents.some((doc) => doc.files.length > 0);

  const show =
    loaded &&
    Platform.OS !== 'web' &&
    settings.onboarded &&
    !settings.lockOffered &&
    !settings.lockEnabled &&
    biometrics.available &&
    holdsSomethingPrivate;

  async function turnOn() {
    tapFeedback();
    // Proving it works now is better than discovering later that it does not.
    if (await authenticate(`Turn on ${biometrics.label} for Expyr`)) {
      update({ lockEnabled: true, lockOffered: true });
      successFeedback();
    } else {
      update({ lockOffered: true });
    }
  }

  return (
    <Modal visible={show} animationType="fade" transparent onRequestClose={() => update({ lockOffered: true })}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: theme.background }]}>
          <MaterialCommunityIcons name="lock-outline" size={28} color={theme.accent} />

          <ThemedText type="headline" style={styles.centered}>
            Lock Expyr with {biometrics.label}?
          </ThemedText>
          <ThemedText type="body" themeColor="textSecondary" style={styles.centered}>
            You have just put a document in here. {biometrics.label} keeps it from anyone who picks
            up your phone unlocked, and it is asked for again after you have been away a while.
          </ThemedText>

          <Pressable onPress={turnOn} accessibilityRole="button">
            {({ pressed }) => (
              <View
                style={[styles.primary, { backgroundColor: theme.accent }, pressed && styles.dim]}>
                <ThemedText type="smallBold" style={{ color: theme.accentContrast }}>
                  Turn on {biometrics.label}
                </ThemedText>
              </View>
            )}
          </Pressable>

          <Pressable
            onPress={() => update({ lockOffered: true })}
            accessibilityRole="button"
            style={styles.later}>
            <ThemedText type="smallBold" themeColor="textTertiary">
              Not now
            </ThemedText>
          </Pressable>

          <ThemedText type="small" themeColor="textTertiary" style={styles.centered}>
            You can change this later in Settings, under Security.
          </ThemedText>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  sheet: {
    borderRadius: Radius.large,
    padding: Spacing.four,
    gap: Spacing.three,
    alignItems: 'center',
  },
  centered: { textAlign: 'center' },
  primary: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  later: { paddingVertical: Spacing.two },
  dim: { opacity: 0.6 },
});
