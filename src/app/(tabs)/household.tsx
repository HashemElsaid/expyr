import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionMenu, type MenuAction } from '@/components/document/actions';
import { ListRow, ListSection } from '@/components/list';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ValuePrompt } from '@/components/value-prompt';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { findGaps } from '@/data/gaps';
import { buildHousehold, MINE, personSummary, type Person } from '@/domain/household';
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
export default function HouseholdScreen() {
  const router = useRouter();
  const { documents, updateDocument, removeDocument } = useDocuments();
  const { settings, update } = useSettings();

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
        icon: 'person.text.rectangle',
        run: () => router.push(personHref(person)),
      },
      {
        label: person.name === MINE ? 'Add something' : `Add something for ${person.label}`,
        icon: 'camera.fill',
        run: () => router.push(addForHref(person)),
      },
      {
        label: person.name === MINE ? 'Change my name' : 'Rename',
        icon: 'pencil',
        run: () => {
          setDraft(person.name === MINE ? settings.ownName : person.name);
          setRenaming(person);
        },
      },
      ...(person.name === MINE
        ? []
        : ([
            {
              label: `Remove ${person.label}`,
              icon: 'person.badge.minus',
              run: () => confirmRemove(person),
              destructive: true,
            },
          ] satisfies MenuAction[])),
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
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <ThemedText type="largeTitle" style={styles.header}>
            Household
          </ThemedText>

          {/*
            * A list, where this was a two-column grid of tiles.
            *
            * Each tile carried a name, a summary, the worst gap and up to
            * three of that person's items, which is a lot of typesetting to
            * say what a row says in one line, and none of it was the shape
            * anything else in the app had taken.
            *
            * The per-person menu is a long press now, which is the gesture
            * iOS uses for a context menu, and every action in it is also on
            * the person's own page one tap away. A trailing ellipsis beside a
            * chevron would be two things on the right of a row, which is the
            * rule this app just adopted.
            */}
          <ListSection
            footer={`${people.length} ${people.length === 1 ? 'person' : 'people'}, ${documents.length} ${
              documents.length === 1 ? 'item' : 'items'
            }`}>
            {people.map((person) => {
              const worst = gapsFor(person)[0];
              return (
                <ListRow
                  key={person.label}
                  symbol={person.unnamed ? 'person.crop.circle.badge.questionmark' : 'person.fill'}
                  tint={person.urgent > 0 ? 'red' : 'blue'}
                  title={person.label}
                  /*
                   * What needs doing, or what is missing, or nothing. The
                   * summary already says "2 due soon"; a gap is worth more
                   * than a count, so it wins when there is one.
                   */
                  subtitle={worst ? worst.brief : personSummary(person)}
                  value={
                    person.items.length > 0
                      ? `${person.items.length}`
                      : undefined
                  }
                  onPress={() => {
                    tapFeedback();
                    /*
                     * An unnamed own-row with nothing under it opens the one
                     * thing worth doing to it. Its timeline is empty by
                     * definition, so sending somebody there answers a question
                     * they did not ask.
                     */
                    if (person.unnamed && person.empty) {
                      setDraft(settings.ownName);
                      setRenaming(person);
                      return;
                    }
                    router.push(personHref(person));
                  }}
                  onLongPress={() => {
                    tapFeedback();
                    setMenu({ person, top: 120, right: Spacing.three });
                  }}
                />
              );
            })}
          </ListSection>

          <ListSection>
            <ListRow
              symbol="person.badge.plus"
              tint="green"
              title="Add someone"
              chevron={false}
              onPress={() => {
                tapFeedback();
                setDraft('');
                setAdding(true);
              }}
            />
          </ListSection>
        </ScrollView>
      </SafeAreaView>

      <ActionMenu
        open={menu !== null}
        onClose={() => setMenu(null)}
        anchor={menu ? { top: menu.top, right: menu.right } : undefined}
        actions={menu ? actionsFor(menu.person) : []}
      />

      <ValuePrompt
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
        placeholder="Their name"
        autoCapitalize="words"
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.three,
    paddingBottom: 72,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  header: { paddingTop: Spacing.three },
});
