import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { authenticate, checkBiometricSupport } from '@/lib/biometrics';
import { useSettings } from '@/store/settings';

/** Re-locking after a moment away avoids prompting on every quick app switch. */
const RELOCK_AFTER_MS = 30_000;

export function LockGate({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const { settings, loaded } = useSettings();
  const [unlocked, setUnlocked] = useState(false);
  const [prompting, setPrompting] = useState(false);
  const [label, setLabel] = useState('Face ID');
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    checkBiometricSupport().then((s) => setLabel(s.label)).catch(() => {});
  }, []);

  const unlock = useCallback(async () => {
    if (prompting) return;
    setPrompting(true);
    try {
      if (await authenticate()) setUnlocked(true);
    } finally {
      setPrompting(false);
    }
  }, [prompting]);

  // Prompt as soon as the gate appears.
  useEffect(() => {
    if (loaded && settings.lockEnabled && !unlocked) unlock();
    // Only re-run when the gate itself opens, never on each prompt attempt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, settings.lockEnabled]);

  useEffect(() => {
    if (!settings.lockEnabled) return;
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'background' || state === 'inactive') {
        backgroundedAt.current = Date.now();
        return;
      }
      if (state === 'active' && backgroundedAt.current) {
        const away = Date.now() - backgroundedAt.current;
        backgroundedAt.current = null;
        if (away > RELOCK_AFTER_MS) setUnlocked(false);
      }
    });
    return () => sub.remove();
  }, [settings.lockEnabled]);

  if (!settings.lockEnabled || unlocked) return <>{children}</>;

  return (
    <ThemedView style={styles.container}>
      <View style={styles.inner}>
        <Icon name="lock" size={40} color={theme.textTertiary} />
        <ThemedText type="largeTitle" style={styles.centered}>
          Expyr is locked
        </ThemedText>
        <ThemedText type="body" themeColor="textSecondary" style={styles.centered}>
          Your documents are private. Unlock with {label} to continue.
        </ThemedText>
        <Pressable onPress={unlock} disabled={prompting}>
          {({ pressed }) => (
            <View
              style={[
                styles.button,
                { backgroundColor: theme.accent },
                (pressed || prompting) && styles.dim,
              ]}>
              <ThemedText type="footnoteStrong" style={{ color: theme.accentContrast }}>
                {prompting ? 'Waiting…' : `Unlock with ${label}`}
              </ThemedText>
            </View>
          )}
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.five },
  inner: { alignItems: 'center', gap: Spacing.three, maxWidth: 340 },
  centered: { textAlign: 'center' },
  button: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    marginTop: Spacing.two,
  },
  dim: { opacity: 0.6 },
});
