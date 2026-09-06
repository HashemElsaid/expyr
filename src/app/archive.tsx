import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { DocumentCard } from '@/components/document-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { useDocuments } from '@/store/documents';

export default function ArchiveScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { archived, setArchived } = useDocuments();

  return (
    <ThemedView style={styles.container}>
      {archived.length === 0 ? (
        <View style={styles.empty}>
          <ThemedText type="body" themeColor="textSecondary" style={styles.centered}>
            Nothing archived yet. When you are finished with something, whether a document you
            replaced or a deadline that has passed, archive it and it moves here, out of the way but
            not lost.
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={archived}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <ThemedText type="small" themeColor="textTertiary" style={styles.intro}>
              These are kept but no longer remind you.
            </ThemedText>
          }
          renderItem={({ item }) => (
            <View style={styles.cardWrap}>
              <DocumentCard doc={item} onPress={() => router.push(`/document/${item.id}`)} />

              {/*
                * Here, rather than only inside the document.
                *
                * Getting something back meant opening it, finding the ⋯, and
                * knowing the word "archive" was the one to look under — three
                * taps deep on the one screen whose entire purpose is putting
                * things back.
                */}
              <Pressable
                onPress={async () => {
                  tapFeedback();
                  await setArchived(item.id, false);
                  successFeedback();
                }}
                accessibilityRole="button"
                accessibilityLabel={`Move ${item.title} back to my items`}
                style={styles.restore}>
                {({ pressed }) => (
                  <View style={[styles.restoreRow, pressed && styles.dim]}>
                    <MaterialCommunityIcons name="tray-full" size={15} color={theme.accent} />
                    <ThemedText type="smallBold" style={{ color: theme.accent }}>
                      Move back to my items
                    </ThemedText>
                  </View>
                )}
              </Pressable>
            </View>
          )}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: {
    padding: Spacing.four,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  intro: { paddingBottom: Spacing.three },
  cardWrap: { paddingBottom: Spacing.three },
  restore: { paddingTop: Spacing.two },
  restoreRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dim: { opacity: 0.6 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.five },
  centered: { textAlign: 'center' },
});
