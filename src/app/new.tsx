import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type SFSymbol } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { tapFeedback } from '@/lib/haptics';

/**
 * What the plus button opens: the two ways anything gets into Expyr.
 *
 * A subscription comes from a screenshot, of iPhone Settings or of a receipt,
 * and a document from the camera. There is no third way to type one in on
 * purpose: copying out what iOS already lists is the chore that lets
 * subscriptions go unnoticed in the first place.
 *
 * A sheet that fits its two rows rather than a screen, because it is a choice
 * made in a second and the page behind should still be in view.
 */
export default function NewSheet() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <ThemedView style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.three }]}>
      <ThemedText type="title2" style={styles.title}>
        Add
      </ThemedText>

      <ThemedText type="sectionHeader" themeColor="textSecondary" style={styles.header}>
        Subscriptions
      </ThemedText>
      <Option
        symbol="photo.on.rectangle"
        title="Add from a screenshot"
        detail="A receipt email or iPhone Settings"
        onPress={() => router.replace('/subscriptions')}
      />

      <ThemedText type="sectionHeader" themeColor="textSecondary" style={styles.header}>
        Documents
      </ThemedText>
      <Option
        symbol="doc.viewfinder"
        title="Scan a document"
        detail="Passport, ID, licence or insurance"
        onPress={() => router.replace('/add')}
      />
    </ThemedView>
  );
}

function Option({
  symbol,
  title,
  detail,
  onPress,
}: {
  symbol: SFSymbol;
  title: string;
  detail: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}`}>
      {({ pressed }) => (
        <View
          style={[
            styles.option,
            { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement },
          ]}>
          <View style={[styles.tile, { backgroundColor: theme.tile }]}>
            <Icon name={symbol} size={22} color={theme.accent} />
          </View>
          <View style={styles.words}>
            <ThemedText type="headline">{title}</ThemedText>
            <ThemedText type="footnote" themeColor="textSecondary">
              {detail}
            </ThemedText>
          </View>
          <Icon name="chevron.right" size={14} weight="semibold" color={theme.textTertiary} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sheet: { paddingHorizontal: 20, paddingTop: Spacing.four },
  title: { marginBottom: Spacing.one },
  header: { marginTop: Spacing.three, marginBottom: Spacing.two, marginLeft: 4 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 18,
  },
  tile: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  words: { flex: 1, gap: 2 },
});
