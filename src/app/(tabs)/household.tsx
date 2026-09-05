import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton, SecondaryButton } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { labelForId } from '@/data/document-types';
import { findGaps } from '@/data/gaps';
import { buildHousehold, MINE, personSummary, type Person } from '@/domain/household';
import { useTheme } from '@/hooks/use-theme';
import { countdownShort, daysUntil, shortDate } from '@/lib/dates';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { useDocuments } from '@/store/documents';
import { useSettings } from '@/store/settings';
import type { TrackedDocument } from '@/types';

/**
 * Who you are keeping track of, one card each.
 *
 * This was a single column: every person's name, their gaps, then their items,
 * scrolling past each other into one grey wall. It answered "what is in here"
 * and not "who needs me", which is the question a household page exists for —
 * you cannot compare two people by scrolling between them.
 *
 * A card each, side by side, and the comparison is the layout. The card you are
 * on is whole, the next one is visible at the edge so the swipe suggests
 * itself, and the last card is how somebody gets added — which until now was
 * impossible, because a person only existed by owning something.
 *
 * Deliberately not a board with draggable cards. What makes a Kanban a Kanban
 * is moving something from one column to the next, and there is nowhere for a
 * passport to move to: it does not go from "todo" to "doing", it just expires.
 * The columns are worth having; the dragging would be an affordance that does
 * nothing.
 */

/** Enough of the next card shows to say there is one. */
const CARD_WIDTH = Math.min(320, Dimensions.get('window').width * 0.78);
/** How many of a person's items fit before the card starts scrolling itself. */
const ITEMS_SHOWN = 4;

export default function HouseholdScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { documents, updateDocument } = useDocuments();
  const { settings, update } = useSettings();

  const [renaming, setRenaming] = useState<Person | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  const people = useMemo(
    () => buildHousehold(documents, settings.people),
    [documents, settings.people]
  );

  const gapsFor = useCallback(
    (person: Person) => findGaps(person.items, settings.country),
    [settings.country]
  );

  /** Renaming touches every one of that person's items, so it is done in one pass. */
  async function commitRename() {
    const person = renaming;
    const next = draft.trim();
    setRenaming(null);
    if (!person || !next || next === person.name) return;

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
        fields: doc.fields,
      });
    }

    /*
     * The old name may also be in the explicit list. Renaming has to move it
     * there too, or the person reappears beside themselves under their old
     * name with nothing in it.
     */
    const named = settings.people.filter(
      (name) => name.trim().toLowerCase() !== person.name.trim().toLowerCase()
    );
    if (person.empty) named.push(next);
    update({ people: named });

    successFeedback();
  }

  function commitAdd() {
    const next = draft.trim();
    setAdding(false);
    if (!next) return;

    const already = people.some((p) => p.label.toLowerCase() === next.toLowerCase());
    if (already) return;

    update({ people: [...settings.people, next] });
    successFeedback();
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <ThemedText type="display">Household</ThemedText>
          <ThemedText type="body" themeColor="textSecondary">
            {people.length} {people.length === 1 ? 'person' : 'people'}, {documents.length}{' '}
            {documents.length === 1 ? 'item' : 'items'}.
          </ThemedText>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          // Settles on a card rather than anywhere, so a swipe lands somewhere
          // deliberate instead of halfway between two people.
          snapToInterval={CARD_WIDTH + GAP}
          snapToAlignment="start"
          contentContainerStyle={styles.deck}>
          {people.map((person) => (
            <PersonCard
              key={person.label}
              person={person}
              gaps={gapsFor(person)}
              country={settings.country}
              onRename={() => {
                tapFeedback();
                setDraft(person.name);
                setRenaming(person);
              }}
              onOpen={(doc) => router.push(`/document/${doc.id}`)}
              onAddItem={() => router.push('/add')}
            />
          ))}

          <Pressable
            onPress={() => {
              tapFeedback();
              setDraft('');
              setAdding(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Add a family member">
            {({ pressed }) => (
              <View
                style={[
                  styles.card,
                  styles.addCard,
                  { borderColor: theme.border },
                  pressed && styles.dim,
                ]}>
                <MaterialCommunityIcons
                  name="account-plus-outline"
                  size={26}
                  color={theme.textTertiary}
                />
                <ThemedText type="bodyMedium" style={styles.centred}>
                  Add a family member
                </ThemedText>
                <ThemedText type="small" themeColor="textTertiary" style={styles.centred}>
                  Track a partner&rsquo;s visa or a child&rsquo;s passport alongside your own.
                </ThemedText>
              </View>
            )}
          </Pressable>
        </ScrollView>
      </SafeAreaView>

      <NamePrompt
        visible={adding || renaming !== null}
        title={adding ? 'Add a family member' : 'What should they be called?'}
        value={draft}
        onChange={setDraft}
        onCancel={() => {
          setAdding(false);
          setRenaming(null);
        }}
        onSubmit={adding ? commitAdd : commitRename}
      />
    </ThemedView>
  );
}

function PersonCard({
  person,
  gaps,
  country,
  onRename,
  onOpen,
  onAddItem,
}: {
  person: Person;
  gaps: ReturnType<typeof findGaps>;
  country: Parameters<typeof labelForId>[1];
  onRename: () => void;
  onOpen: (doc: TrackedDocument) => void;
  onAddItem: () => void;
}) {
  const theme = useTheme();
  const shown = person.items.slice(0, ITEMS_SHOWN);
  const rest = person.items.length - shown.length;

  /*
   * One line, not the wall of them the old page showed. The most serious thing
   * is the only thing a card has room for, and the rest are on the item itself
   * where they can be acted on.
   */
  const worst = gaps[0];

  return (
    <View style={[styles.card, { borderColor: theme.border }]}>
      <Pressable onPress={onRename} accessibilityRole="button" accessibilityLabel="Rename">
        <View style={styles.nameRow}>
          <ThemedText type="headline" numberOfLines={1} style={styles.flex}>
            {person.label}
          </ThemedText>
          {/* Only somebody with a name of their own can be renamed. */}
          {person.name !== MINE && (
            <MaterialCommunityIcons name="pencil" size={15} color={theme.textTertiary} />
          )}
        </View>
      </Pressable>

      <ThemedText
        type="small"
        themeColor={person.urgent > 0 ? 'urgentStrong' : 'textTertiary'}>
        {personSummary(person)}
      </ThemedText>

      {worst && (
        <View style={styles.gap}>
          <MaterialCommunityIcons
            name={worst.severity === 'blocked' ? 'alert-outline' : 'tray-arrow-up'}
            size={15}
            color={worst.severity === 'blocked' ? theme.urgentSoft : theme.textTertiary}
          />
          <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
            {worst.text}
          </ThemedText>
        </View>
      )}

      <View style={styles.items}>
        {shown.map((doc) => {
          const days = daysUntil(doc.expiryDate);
          return (
            <Pressable
              key={doc.id}
              onPress={() => onOpen(doc)}
              accessibilityRole="button"
              accessibilityLabel={`Open ${doc.title}`}>
              {({ pressed }) => (
                <View
                  style={[styles.item, { borderTopColor: theme.border }, pressed && styles.dim]}>
                  <View style={styles.flex}>
                    <ThemedText type="bodyMedium" numberOfLines={1}>
                      {doc.title}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textTertiary" numberOfLines={1}>
                      {labelForId(doc.typeId, country)} · {shortDate(doc.expiryDate)}
                    </ThemedText>
                  </View>
                  <ThemedText
                    type="small"
                    themeColor={days <= 30 ? 'urgentStrong' : 'textTertiary'}>
                    {countdownShort(days)}
                  </ThemedText>
                </View>
              )}
            </Pressable>
          );
        })}

        {rest > 0 && (
          <ThemedText type="small" themeColor="textTertiary" style={styles.more}>
            and {rest} more
          </ThemedText>
        )}

        {person.empty && (
          <View style={styles.emptyCard}>
            <SecondaryButton icon="camera-outline" label="Add something" onPress={onAddItem} />
          </View>
        )}
      </View>
    </View>
  );
}

/**
 * Asking for a name. A modal rather than Alert.prompt, which exists on iOS
 * only — a household is not an iPhone-only idea, and a control that silently
 * does nothing on one platform is worse than a plainer one that works.
 */
function NamePrompt({
  visible,
  title,
  value,
  onChange,
  onCancel,
  onSubmit,
}: {
  visible: boolean;
  title: string;
  value: string;
  onChange: (next: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        {/* Stops a tap inside the card counting as a tap on the backdrop. */}
        <Pressable
          style={[
            styles.prompt,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ]}
          onPress={() => {}}>
          <ThemedText type="bodyMedium">{title}</ThemedText>

          <TextInput
            value={value}
            onChangeText={onChange}
            placeholder="Their name"
            placeholderTextColor={theme.textTertiary}
            autoFocus
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={onSubmit}
            style={[styles.input, { borderColor: theme.border, color: theme.text }]}
          />

          <View style={styles.promptActions}>
            <SecondaryButton label="Cancel" onPress={onCancel} />
            <View style={styles.flex}>
              <PrimaryButton label="Save" onPress={onSubmit} disabled={!value.trim()} />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const GAP = 12;

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  dim: { opacity: 0.6 },
  centred: { textAlign: 'center' },
  header: { paddingHorizontal: 28, paddingTop: 8, paddingBottom: 20, gap: 6 },

  /*
   * Aligned to the top rather than stretched. A row of cards inside a scroll
   * view stretches each to the tallest by default, which left the shorter
   * person as a mostly-empty box — reading as though something had failed to
   * load rather than as somebody with less to keep track of.
   */
  deck: { paddingHorizontal: 28, gap: GAP, paddingBottom: 90, alignItems: 'flex-start' },
  card: {
    width: CARD_WIDTH,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 18,
    gap: 8,
  },
  addCard: { alignItems: 'center', justifyContent: 'center', gap: 10, borderStyle: 'dashed' },

  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  gap: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingTop: 4 },

  items: { paddingTop: 8 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  more: { paddingTop: 12 },
  emptyCard: { paddingTop: 8 },

  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  prompt: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    gap: 14,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  promptActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
