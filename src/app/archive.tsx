import { useRouter } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';

import { DocumentCard } from '@/components/document-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useDocuments } from '@/store/documents';

export default function ArchiveScreen() {
  const router = useRouter();
  const { archived } = useDocuments();

  return (
    <ThemedView style={styles.container}>
      {archived.length === 0 ? (
        <View style={styles.empty}>
          <ThemedText type="body" themeColor="textSecondary" style={styles.centered}>
            Nothing archived yet. When you are finished with something — a document you replaced, a
            deadline that has passed — archive it and it moves here, out of the way but not lost.
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
              These are kept but no longer remind you. Open one to move it back.
            </ThemedText>
          }
          renderItem={({ item }) => (
            <View style={styles.cardWrap}>
              <DocumentCard doc={item} onPress={() => router.push(`/document/${item.id}`)} />
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
  cardWrap: { paddingBottom: Spacing.two },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.five },
  centered: { textAlign: 'center' },
});
