import { useEffect, useState } from 'react';
import { InteractionManager, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { wantsLockOffer } from '@/domain/lock-offer';
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
 *
 * It waits for the interface to be still before it presents, and that is not a
 * nicety. This froze the app for every first-time user, and it took a force
 * quit to get out of.
 *
 * The moment this wants to show is the moment the first document with a photo
 * is saved. Adding is a screen iOS presents as a modal, and saving the first
 * item replaces it with the document screen, so iOS is asked to dismiss one
 * presentation and make another in the same frame as this Modal appears. It
 * loses: the sheet never draws, and the presentation that swallowed the touches
 * no longer has a view to draw them on. The app is alive and cannot be touched.
 *
 * Which is also why it was only ever the first document. Replacing the add
 * screen happens only when the list was empty, and this can only first turn
 * true on the save that puts a photograph in the app, which for a new user is
 * the same save.
 */
/**
 * How long to wait for the screen to stop moving.
 *
 * Long enough to be clear of one screen dismissing and another arriving, which
 * on iOS is two transitions of about a third of a second each, and short enough
 * that the sheet still reads as an answer to what the person just did.
 *
 * The timer is the load-bearing part. runAfterInteractions is there because it
 * costs nothing, but a native stack transition is not a JS interaction, so it
 * can and does fire straight into the middle of one.
 */
const SETTLE_MS = 900;

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

  const wanted =
    Platform.OS !== 'web' &&
    wantsLockOffer({
      loaded,
      onboarded: settings.onboarded,
      alreadyOffered: settings.lockOffered,
      lockEnabled: settings.lockEnabled,
      biometricsAvailable: biometrics.available,
      holdsSomethingPrivate,
    });

  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!wanted) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const task = InteractionManager.runAfterInteractions(() => {
      timer = setTimeout(() => setSettled(true), SETTLE_MS);
    });

    return () => {
      task.cancel();
      if (timer) clearTimeout(timer);
    };
  }, [wanted]);

  const show = wanted && settled;

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
          <Icon name="lock" size={28} color={theme.accent} />

          <ThemedText type="largeTitle" style={styles.centered}>
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
                <ThemedText type="footnoteStrong" style={{ color: theme.accentContrast }}>
                  Turn on {biometrics.label}
                </ThemedText>
              </View>
            )}
          </Pressable>

          <Pressable
            onPress={() => update({ lockOffered: true })}
            accessibilityRole="button"
            style={styles.later}>
            <ThemedText type="footnoteStrong" themeColor="textTertiary">
              Not now
            </ThemedText>
          </Pressable>

          <ThemedText type="footnote" themeColor="textTertiary" style={styles.centered}>
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
