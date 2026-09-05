import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { labelForId } from '@/data/document-types';
import { findGaps } from '@/data/gaps';
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

  /*
   * Shown for everybody, not only for households. One person's own file has
   * gaps too, and the first thing a new user learns here is which of the
   * papers they carry Expyr has never been shown.
   */
  const gapsFor = useCallback(
    (person: Person) => findGaps(person.items, settings.country),
    [settings.country]
  );

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
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.header}>
            <ThemedText type="display">Household</ThemedText>
          </View>
          <View style={styles.empty}>
            <ThemedText type="body" themeColor="textSecondary" style={styles.centered}>
              Once you say who a document belongs to, everyone in the house shows up here.
            </ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <ThemedText type="display">Household</ThemedText>
        </View>
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

            {/* "All clear" above a red warning is a lie, so it defers to one. */}
            <ThemedText type="small" themeColor="textTertiary">
              {person.urgent > 0
                ? `${person.urgent} need${person.urgent === 1 ? 's' : ''} attention`
                : gapsFor(person).some((gap) => gap.severity === 'blocked')
                  ? `Next ${countdownShort(daysUntil(person.next!.expiryDate))} · one thing to sort out first`
                  : `All clear · next ${countdownShort(daysUntil(person.next!.expiryDate))}`}
            </ThemedText>

            {/*
             * The half of somebody's file that is not in front of them: what
             * their papers need from each other, and what is not here at all.
             */}
            {gapsFor(person).map((gap) => (
              <View key={gap.text} style={styles.gap}>
                <MaterialCommunityIcons
                  name={
                    gap.severity === 'blocked'
                      ? 'alert-outline'
                      : gap.severity === 'missing'
                        ? 'link-variant-off'
                        : 'tray-remove'
                  }
                  size={15}
                  color={gap.severity === 'blocked' ? theme.urgentStrong : theme.textTertiary}
                />
                <ThemedText
                  type="small"
                  themeColor={gap.severity === 'blocked' ? 'text' : 'textTertiary'}
                  style={styles.flex}>
                  {gap.text}
                </ThemedText>
              </View>
            ))}

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
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center' },
  header: { paddingTop: Spacing.three, paddingBottom: Spacing.two },
  container: { flex: 1 },
  content: {
    paddingHorizontal: 28,
    paddingBottom: 72,
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
  gap: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start', paddingTop: Spacing.two },
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
