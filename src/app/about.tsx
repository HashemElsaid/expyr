import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

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
            <MaterialCommunityIcons name="history" size={20} color={theme.textSecondary} />
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
          icon="cellphone-lock"
          title="Your documents stay on this phone"
          subtitle="Read exactly what is stored, and what happens when you scan."
          onPress={() => router.push('/privacy')}
        />
        <LinkRow
          icon="script-text-outline"
          title="Terms of use"
          subtitle="What Expyr promises, and what it does not."
          onPress={() => router.push('/terms')}
        />
      </ScrollView>
    </ThemedView>
  );
}

function LinkRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {({ pressed }) => (
        <View style={[styles.row, pressed && styles.dim]}>
          <MaterialCommunityIcons name={icon as never} size={20} color={theme.textSecondary} />
          <View style={styles.rowBody}>
            <ThemedText type="headline">{title}</ThemedText>
            <ThemedText type="footnote" themeColor="textTertiary">
              {subtitle}
            </ThemedText>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textTertiary} />
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
