import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { tapFeedback } from '@/lib/haptics';
import { useDocuments } from '@/store/documents';

/**
 * The one thing this app must never do quietly.
 *
 * A write to storage can fail — a phone with nothing left on it is the common
 * way — and every write in Expyr used to swallow that failure. The document
 * stayed on screen, the person believed it was saved, and it was gone at the
 * next launch. For something whose whole job is remembering on your behalf,
 * forgetting in silence is the worst thing it could do.
 *
 * So it says so, over whatever screen the person is on, and offers to try
 * again. Dismissible, because being unable to dismiss it would make a full
 * phone unusable rather than merely inconvenient — but it comes straight back
 * the next time a save fails, which is the honest behaviour.
 */
export function SaveWarning() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { saveProblem } = useDocuments();
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  if (!saveProblem || dismissed === saveProblem.message) return null;

  return (
    <View
      style={[styles.wrap, { top: insets.top + Spacing.two }]}
      pointerEvents="box-none"
      accessibilityLiveRegion="assertive">
      <View
        style={[
          styles.card,
          { backgroundColor: theme.backgroundElement, borderColor: theme.urgentStrong },
        ]}>
        <View style={styles.header}>
          <MaterialCommunityIcons
            name="alert-circle-outline"
            size={18}
            color={theme.urgentStrong}
          />
          <ThemedText type="smallBold" style={{ color: theme.urgentStrong }}>
            Not saved
          </ThemedText>
        </View>

        <ThemedText type="body" themeColor="textSecondary">
          {saveProblem.message}
        </ThemedText>

        <View style={styles.actions}>
          <Pressable
            onPress={async () => {
              tapFeedback();
              setRetrying(true);
              try {
                await saveProblem.retry();
              } finally {
                setRetrying(false);
              }
            }}
            disabled={retrying}
            accessibilityRole="button">
            <View style={[styles.button, { backgroundColor: theme.accent }]}>
              <ThemedText type="smallBold" style={{ color: theme.accentContrast }}>
                {retrying ? 'Trying…' : 'Try again'}
              </ThemedText>
            </View>
          </Pressable>

          <Pressable
            onPress={() => {
              tapFeedback();
              setDismissed(saveProblem.message);
            }}
            accessibilityRole="button">
            <View style={styles.button}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                Not now
              </ThemedText>
            </View>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, paddingHorizontal: Spacing.three },
  card: {
    borderRadius: Radius.medium,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.two,
    // Lifted off the screen behind it, so it reads as an interruption.
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 8,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  actions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.one },
  button: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});
