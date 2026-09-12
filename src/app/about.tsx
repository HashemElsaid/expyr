import Constants from 'expo-constants';
import type { SFSymbol } from 'expo-symbols';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useDocuments } from '@/store/documents';

/**
 * The version, the two legal pages and the one statistic worth keeping. All of
 * it is looked at once, if ever, which is exactly what a second screen is for.
 */
export default function AboutScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { documents } = useDocuments();
  const renewalsRecorded = documents.reduce((sum, d) => sum + (d.history?.length ?? 0), 0);

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <ThemedText type="largeTitle">Expyr</ThemedText>
          <ThemedText type="footnote" themeColor="textTertiary">
            Version {Constants.expoConfig?.version ?? '1.0.0'}
          </ThemedText>
        </View>

        {renewalsRecorded > 0 && (
          <View style={styles.row}>
            <Icon name="clock.arrow.circlepath" size={20} color={theme.textSecondary} />
            <View style={styles.rowBody}>
              <ThemedText type="headline">
                {renewalsRecorded} renewal{renewalsRecorded === 1 ? '' : 's'} behind you
              </ThemedText>
              <ThemedText type="footnote" themeColor="textTertiary">
                Expyr remembers each time you have renewed something.
              </ThemedText>
            </View>
          </View>
        )}

        <LinkRow
          icon="lock.iphone"
          title="Your documents stay on this phone"
          subtitle="Read exactly what is stored, and what happens when you scan."
          onPress={() => router.push('/privacy')}
        />
        <LinkRow
          icon="doc.text"
          title="Terms of use"
          subtitle="What Expyr promises, and what it does not."
          onPress={() => router.push('/terms')}
        />
      </ScrollView>
    </ThemedView>
  );
}

/**
 * Typed against the symbol catalogue, like every other icon in the app.
 *
 * It used to take a `string` and cast it away at the call to `Icon`, which is
 * the one thing that defeats the catalogue: a wrong name stops being a
 * compile error and becomes nothing on the screen, because `Icon` falls back
 * to drawing nothing rather than a box. Both names here were
 * MaterialCommunityIcons left behind by the conversion, so this screen had
 * two blank gaps where its icons belong, and nothing said so.
 */
function LinkRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: SFSymbol;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {({ pressed }) => (
        <View style={[styles.row, pressed && styles.dim]}>
          <Icon name={icon} size={20} color={theme.textSecondary} />
          <View style={styles.rowBody}>
            <ThemedText type="headline">{title}</ThemedText>
            <ThemedText type="footnote" themeColor="textTertiary">
              {subtitle}
            </ThemedText>
          </View>
          <Icon name="chevron.right" size={20} color={theme.textTertiary} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  hero: { gap: 2 },
  row: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-start' },
  rowBody: { flex: 1, gap: 3 },
  dim: { opacity: 0.6 },
});
