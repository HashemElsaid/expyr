import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { labelForId } from '@/data/document-types';
import { useTheme } from '@/hooks/use-theme';
import { urgencyColor } from '@/hooks/use-urgency';
import { countdownShort, daysUntil, shortDate, urgencyFor } from '@/lib/dates';
import { successFeedback } from '@/lib/haptics';
import { useDocuments } from '@/store/documents';
import { useSettings } from '@/store/settings';
import { TrackedDocument } from '@/types';

/** Blank owner means the phone's owner — shown as "Mine". */
const MINE = '';

type Person = {
  name: string;
  label: string;
  items: TrackedDocument[];
  urgent: number;
  next?: TrackedDocument;
};

function buildPeople(documents: TrackedDocument[]): Person[] {
  const byPerson = new Map<string, TrackedDocument[]>();
  for (const doc of documents) {
    const key = doc.owner ?? MINE;
    const existing = byPerson.get(key);
    if (existing) existing.push(doc);
    else byPerson.set(key, [doc]);
  }

  return [...byPerson.entries()]
    .map(([name, items]) => {
      const sorted = [...items].sort(
        (a, b) => daysUntil(a.expiryDate) - daysUntil(b.expiryDate)
      );
      return {
        name,
        label: name || 'Mine',
        items: sorted,
        urgent: sorted.filter((d) => daysUntil(d.expiryDate) <= 30).length,
        next: sorted[0],
      };
    })
    .sort((a, b) => {
      // Whoever needs attention soonest comes first; "Mine" wins a tie.
      if (b.urgent !== a.urgent) return b.urgent - a.urgent;
      if (a.name === MINE) return -1;
      if (b.name === MINE) return 1;
      return a.label.localeCompare(b.label);
    });
}

export default function HouseholdScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { documents, updateDocument } = useDocuments();
  const { settings } = useSettings();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');

  const people = useMemo(() => buildPeople(documents), [documents]);

  /** Renaming touches every one of that person's items, so it is done in one pass. */
  async function commitRename(person: Person) {
    const next = draftName.trim();
    setRenaming(null);
    if (!next || next === person.name) return;

    for (const doc of person.items) {
      await updateDocument(doc.id, {
        typeId: doc.typeId,
        title: doc.title,
        expiryDate: doc.expiryDate,
        documentNumber: doc.documentNumber,
        notes: doc.notes,
        owner: next,
        files: doc.files,
        leadDays: doc.leadDays,
        archivedAt: doc.archivedAt,
        history: doc.history,
      });
    }
    successFeedback();
  }

  if (documents.length === 0) {
    return (
      <ThemedView style={[styles.container, styles.empty]}>
        <ThemedText type="body" themeColor="textSecondary" style={styles.centered}>
          Once you say who a document belongs to, everyone in the house shows up here.
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ThemedText type="body" themeColor="textSecondary" style={styles.intro}>
          {people.length === 1
            ? 'Everything here is yours. Set “Whose is it” on an item to track someone else too.'
            : `${people.length} people, ${documents.length} items.`}
        </ThemedText>

        {people.map((person) => (
          <View key={person.name || 'mine'} style={styles.person}>
            <View style={styles.personHeader}>
              {renaming === person.name ? (
                <TextInput
                  value={draftName}
                  onChangeText={setDraftName}
                  onBlur={() => commitRename(person)}
                  onSubmitEditing={() => commitRename(person)}
                  autoFocus
                  placeholder="Their name"
                  placeholderTextColor={theme.textTertiary}
                  style={[styles.renameInput, { color: theme.text, borderBottomColor: theme.accent }]}
                />
              ) : (
                <ThemedText type="ledgerTitle" style={styles.flex}>
                  {person.label}
                </ThemedText>
              )}

              {person.name !== MINE && renaming !== person.name && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Rename ${person.label}`}
                  hitSlop={10}
                  onPress={() => {
                    setDraftName(person.name);
                    setRenaming(person.name);
                  }}>
                  <MaterialCommunityIcons
                    name="pencil-outline"
                    size={18}
                    color={theme.textTertiary}
                  />
                </Pressable>
              )}
            </View>

            <ThemedText type="small" themeColor="textTertiary">
              {person.urgent > 0
                ? `${person.urgent} need${person.urgent === 1 ? 's' : ''} attention`
                : `All clear · next ${countdownShort(daysUntil(person.next!.expiryDate))}`}
            </ThemedText>

            <View style={styles.items}>
              {person.items.slice(0, 4).map((doc) => {
                const days = daysUntil(doc.expiryDate);
                const color = urgencyColor(urgencyFor(days), theme);
                return (
                  <Pressable
                    key={doc.id}
                    accessibilityRole="button"
                    onPress={() => router.push(`/document/${doc.id}`)}>
                    {({ pressed }) => (
                      <View
                        style={[
                          styles.itemRow,
                          { borderBottomColor: theme.border },
                          pressed && styles.dim,
                        ]}>
                        <View style={styles.flex}>
                          <ThemedText type="body" numberOfLines={1}>
                            {doc.title}
                          </ThemedText>
                          <ThemedText type="small" themeColor="textTertiary" numberOfLines={1}>
                            {labelForId(doc.typeId, settings.country)} ·{' '}
                            {shortDate(doc.expiryDate)}
                          </ThemedText>
                        </View>
                        <ThemedText type="smallBold" style={{ color }}>
                          {countdownShort(days)}
                        </ThemedText>
                      </View>
                    )}
                  </Pressable>
                );
              })}
              {person.items.length > 4 && (
                <ThemedText type="small" themeColor="textTertiary" style={styles.more}>
                  and {person.items.length - 4} more
                </ThemedText>
              )}
            </View>
          </View>
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingHorizontal: 28,
    paddingBottom: Spacing.six,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  intro: { paddingTop: Spacing.three, paddingBottom: Spacing.two },
  flex: { flex: 1 },
  dim: { opacity: 0.6 },
  empty: { alignItems: 'center', justifyContent: 'center', padding: Spacing.five },
  centered: { textAlign: 'center' },
  person: { paddingTop: Spacing.four, gap: 4 },
  personHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  renameInput: {
    flex: 1,
    fontFamily: 'InstrumentSerif',
    fontSize: 22,
    lineHeight: 26,
    paddingBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  items: { paddingTop: Spacing.two },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  more: { paddingTop: Spacing.two },
});
