import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionMenu, type MenuAction } from '@/components/document/actions';
import { PrimaryButton, SecondaryButton } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { findGaps } from '@/data/gaps';
import { buildHousehold, MINE, personSummary, type Person } from '@/domain/household';
import { useTheme } from '@/hooks/use-theme';
import { countdownShort, daysUntil } from '@/lib/dates';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { useDocuments } from '@/store/documents';
import { useSettings } from '@/store/settings';

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

/**
 * Where a person's own file lives.
 *
 * The object form rather than a built string: expo-router encodes the parameter
 * itself, which matters the moment somebody is called "Abu Bakr" or has an
 * apostrophe in their name. "mine" travels as a literal because a route
 * parameter cannot be empty and the phone's owner is stored with no name.
 */
/** Adding something, already knowing whose it is. */
function addForHref(person: Person) {
  return person.name === MINE
    ? ({ pathname: '/add' as const })
    : ({ pathname: '/add' as const, params: { owner: person.name } });
}

function personHref(person: Person) {
  return {
    pathname: '/person/[name]' as const,
    params: { name: person.name === MINE ? 'mine' : person.name },
  };
}

/**
 * Two to a row, down the page.
 *
 * This was one wide card per person, swiped sideways — which meant seeing the
 * second person cost a gesture, and comparing four of them was impossible. Two
 * columns puts the whole household on one screen, which is the question this
 * page exists to answer: who needs me. The tile is a doorway rather than a
 * summary now; the detail is one tap away on the person's own page.
 */
const COLUMNS = 2;
const PAGE_PADDING = 20;
const GAP = 12;

/** A tile this narrow shows the next few; the rest are behind the tap. */
const ITEMS_SHOWN = 3;

/**
 * Every tile the same height, whatever is in it.
 *
 * Sized to the fullest a tile can get — a name, a status, two lines of gap, and
 * three items with a "+N more" under them — because the alternative is a grid
 * whose rows step up and down with whoever happens to own the most documents.
 * A person with two items is not a smaller person, and a tile that shrinks to
 * fit them reads as though something is missing from it.
 *
 * The content is bounded by the two constants above and the line limits on the
 * text, so nothing can grow past this; overflow is hidden as a backstop rather
 * than as a plan.
 *
 * Measured rather than guessed, and the first guess was wrong by fourteen
 * points — which did not clip anything, it silently squeezed "3 need you" to
 * nothing while the item rows underneath kept their space. A card that quietly
 * drops the one line saying somebody needs you is worse than one that is too
 * tall, so the pieces below declare which of them may give way.
 */
const CARD_HEIGHT = 214;

export default function HouseholdScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { documents, updateDocument, removeDocument } = useDocuments();
  const { settings, update } = useSettings();
  const { width } = useWindowDimensions();

  /** Two to a row, whatever the phone is. */
  const cardWidth = Math.floor(
    (width - PAGE_PADDING * 2 - GAP * (COLUMNS - 1)) / COLUMNS
  );

  const [renaming, setRenaming] = useState<Person | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  /**
   * Which card's menu is open, and where its button is on screen.
   *
   * The position travels with it because a menu that opens under the header
   * when the button is halfway down the page is a menu pointing at nothing.
   */
  const [menu, setMenu] = useState<{ person: Person; top: number; right: number } | null>(null);

  const people = useMemo(
    () => buildHousehold(documents, settings.people, settings.ownName),
    [documents, settings.people, settings.ownName]
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
    if (!person || !next) return;

    /*
     * Renaming yourself is a different operation from renaming somebody else.
     * Your documents carry no owner at all — being the default is what makes
     * them yours — so this changes the label rather than rewriting six records
     * to say the same thing.
     */
    if (person.name === MINE) {
      update({ ownName: next });
      successFeedback();
      return;
    }

    if (next === person.name) return;

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

  /**
   * Removing somebody, and being plain about what goes with them.
   *
   * Their documents are the question. Silently moving a partner's passport into
   * your own file is wrong, and silently deleting it is worse — so the choice
   * is put to the person making it, with the count in front of them.
   */
  function confirmRemove(person: Person) {
    const count = person.items.length;

    const forget = () =>
      update({
        people: settings.people.filter(
          (name) => name.trim().toLowerCase() !== person.name.trim().toLowerCase()
        ),
      });

    const reassign = async () => {
      for (const doc of person.items) {
        await updateDocument(doc.id, {
          typeId: doc.typeId,
          title: doc.title,
          expiryDate: doc.expiryDate,
          documentNumber: doc.documentNumber,
          notes: doc.notes,
          owner: '',
          files: doc.files,
          leadDays: doc.leadDays,
          archivedAt: doc.archivedAt,
          history: doc.history,
          fields: doc.fields,
        });
      }
      forget();
      successFeedback();
    };

    const erase = async () => {
      for (const doc of person.items) await removeDocument(doc.id);
      forget();
      successFeedback();
    };

    if (count === 0) {
      forget();
      successFeedback();
      return;
    }

    Alert.alert(
      `Remove ${person.label}?`,
      `${person.label} has ${count} ${count === 1 ? 'item' : 'items'}. What should happen to ${
        count === 1 ? 'it' : 'them'
      }?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Keep as mine', onPress: reassign },
        { text: `Delete ${count === 1 ? 'it' : 'them'}`, style: 'destructive', onPress: erase },
      ]
    );
  }

  function actionsFor(person: Person): MenuAction[] {
    return [
      {
        label: 'Open their file',
        icon: 'account-details-outline',
        run: () => router.push(personHref(person)),
      },
      {
        label: person.name === MINE ? 'Add something' : `Add something for ${person.label}`,
        icon: 'camera-outline',
        run: () => router.push(addForHref(person)),
      },
      {
        label: person.name === MINE ? 'Change my name' : 'Rename',
        icon: 'pencil-outline',
        run: () => {
          setDraft(person.name === MINE ? settings.ownName : person.name);
          setRenaming(person);
        },
      },
      ...(person.name === MINE
        ? []
        : [
            {
              label: `Remove ${person.label}`,
              icon: 'account-remove-outline',
              run: () => confirmRemove(person),
              destructive: true,
            },
          ]),
    ];
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

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.grid}>
          {people.map((person) => (
            <PersonCard
              key={person.label}
              person={person}
              gaps={gapsFor(person)}
              width={cardWidth}
              onOpenPerson={() => {
                tapFeedback();
                /*
                 * An unnamed own-card with nothing under it opens the one
                 * thing worth doing to it. Its timeline is empty by
                 * definition, so sending somebody there answers a question
                 * they did not ask and hides the one the card just put to
                 * them.
                 */
                if (person.unnamed && person.empty) {
                  setDraft(settings.ownName);
                  setRenaming(person);
                  return;
                }
                router.push(personHref(person));
              }}
              onMenu={(at) => {
                tapFeedback();
                setMenu({ person, ...at });
              }}
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
                  { width: cardWidth, borderColor: theme.border },
                  pressed && styles.dim,
                ]}>
                <MaterialCommunityIcons
                  name="account-plus-outline"
                  size={24}
                  color={theme.textTertiary}
                />
                <ThemedText type="small" themeColor="textSecondary" style={styles.centred}>
                  Add someone
                </ThemedText>
              </View>
            )}
          </Pressable>
        </ScrollView>
      </SafeAreaView>

      <ActionMenu
        open={menu !== null}
        onClose={() => setMenu(null)}
        anchor={menu ? { top: menu.top, right: menu.right } : undefined}
        actions={menu ? actionsFor(menu.person) : []}
      />

      <NamePrompt
        visible={adding || renaming !== null}
        title={
          adding
            ? 'Add a family member'
            : renaming?.name === MINE
              ? 'What should Expyr call you?'
              : 'What should they be called?'
        }
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
  width,
  onOpenPerson,
  onMenu,
}: {
  person: Person;
  gaps: ReturnType<typeof findGaps>;
  width: number;
  onOpenPerson: () => void;
  onMenu: (at: { top: number; right: number }) => void;
}) {
  const theme = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const menuButton = useRef<View>(null);

  const shown = person.items.slice(0, ITEMS_SHOWN);
  const rest = person.items.length - shown.length;

  /*
   * The most serious one, and only as far as a tile this wide can carry it.
   * Every gap in full is on the person's own page, which is one tap away — a
   * tile that tried to print three sentences about missing paperwork would be
   * mostly paperwork.
   */
  const worst = gaps[0];

  /*
   * The tile is not one big button with a smaller button inside it.
   *
   * That is what it was, and a nested pressable is invalid on the web and
   * ambiguous everywhere else — the browser said so out loud. Two siblings
   * instead: the ⋯ opens the menu, and everything else opens the person. Both
   * regions do the same thing, so it still behaves like one tile.
   */
  const open = (
    <>
      <ThemedText
        type="small"
        themeColor={person.urgent > 0 ? 'urgentStrong' : 'textTertiary'}
        numberOfLines={1}
        style={styles.keep}>
        {personSummary(person)}
      </ThemedText>

      {worst && (
        <View style={[styles.gap, styles.keep]}>
          <MaterialCommunityIcons
            name={worst.severity === 'blocked' ? 'alert-outline' : 'tray-arrow-up'}
            size={13}
            color={worst.severity === 'blocked' ? theme.urgentSoft : theme.textTertiary}
          />
          <ThemedText type="small" themeColor="textTertiary" numberOfLines={2} style={styles.flex}>
            {worst.text}
          </ThemedText>
        </View>
      )}

      {shown.length > 0 && (
        <View style={[styles.items, { borderTopColor: theme.border }]}>
          {shown.map((doc) => {
            const days = daysUntil(doc.expiryDate);
            return (
              <View key={doc.id} style={styles.item}>
                <ThemedText type="small" numberOfLines={1} style={styles.flex}>
                  {doc.title}
                </ThemedText>
                <ThemedText
                  type="small"
                  themeColor={days <= 30 ? 'urgentStrong' : 'textTertiary'}>
                  {countdownShort(days)}
                </ThemedText>
              </View>
            );
          })}

          {rest > 0 && (
            <ThemedText type="small" themeColor="textTertiary">
              +{rest} more
            </ThemedText>
          )}
        </View>
      )}
    </>
  );

  return (
    <View
      style={[
        styles.card,
        { width, borderColor: theme.border, backgroundColor: theme.backgroundElement },
      ]}>
      <View style={styles.nameRow}>
        <Pressable
          onPress={onOpenPerson}
          accessibilityRole="button"
          accessibilityLabel={`Open ${person.label}`}
          style={styles.flex}>
          {({ pressed }) => (
            <ThemedText type="title" numberOfLines={1} style={pressed ? styles.dim : undefined}>
              {person.label}
            </ThemedText>
          )}
        </Pressable>

        {/*
         * Everything you can do *to* a person; the rest of the tile is the way
         * *to* them. A sibling of the tap target, never inside it.
         */}
        <Pressable
          ref={menuButton}
          onPress={() => {
            /*
             * Measured when pressed, not on layout — the grid reflows as people
             * are added, and where this was when the screen drew is not where
             * the finger just touched.
             */
            menuButton.current?.measureInWindow((x, y, w) => {
              onMenu({ top: y + w, right: Math.max(8, screenWidth - (x + w)) });
            });
          }}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={`More for ${person.label}`}>
          <MaterialCommunityIcons name="dots-horizontal" size={18} color={theme.textTertiary} />
        </Pressable>
      </View>

      <Pressable
        onPress={onOpenPerson}
        accessibilityRole="button"
        accessibilityLabel={`Open ${person.label}`}
        style={styles.flex}>
        {({ pressed }) => (
          <View style={[styles.body, pressed && styles.dim]}>{open}</View>
        )}
      </Pressable>
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  dim: { opacity: 0.6 },
  centred: { textAlign: 'center' },
  header: { paddingHorizontal: PAGE_PADDING, paddingTop: 8, paddingBottom: 18, gap: 6 },

  /*
   * Wrapping rows rather than one long line. Aligned to the top so a person
   * with less to keep track of is a shorter tile beside a taller one, not a
   * mostly-empty box stretched to match.
   */
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    paddingHorizontal: PAGE_PADDING,
    gap: GAP,
    paddingBottom: 96,
  },
  card: {
    height: CARD_HEIGHT,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 14,
    gap: 4,
    overflow: 'hidden',
  },
  addCard: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderStyle: 'dashed',
  },

  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  body: { flex: 1, gap: 4 },
  /*
   * Never squeezed. Whether somebody needs you, and why, is the whole reason
   * this tile is on the page; the list of items underneath is the part that can
   * afford to lose a row.
   */
  keep: { flexShrink: 0 },
  gap: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },

  items: { paddingTop: 8, marginTop: 2, gap: 6, borderTopWidth: StyleSheet.hairlineWidth },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8 },

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
