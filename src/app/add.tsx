import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { ErrorNote, Note, PrimaryButton } from '@/components/form';
import { Icon, type SFSymbol } from '@/components/icon';
import { ListInput, ListRow, ListSection } from '@/components/list';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { iconFor, tintFor } from '@/data/document-icons';
import {
  articleFor,
  DOCUMENT_TYPES,
  getDocumentType,
  inSentence,
  labelFor,
  numberFieldFor,
  titleExampleFor,
} from '@/data/document-types';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { defaultExpiry, startingExpiry } from '@/domain/expiry';
import { roomFor, splitImport } from '@/domain/capacity';
import { needsTypeConfirmation, titleAfterCorrection } from '@/domain/scan-review';
import { useTheme } from '@/hooks/use-theme';
import { countWord, dayMonth, formatTime, longDate, shortDate, toISODate } from '@/lib/dates';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { newAttachmentKey } from '@/lib/files';
import { REMINDER_TIME } from '@/lib/notifications';
import { askForReview } from '@/lib/rating';
import { leadLabel } from '@/lib/reminder-plan';
import {
  attachFile,
  pickDocument,
  pickImage,
  scanFile,
  type ScanItem,
  type ScanResult,
} from '@/lib/scan';
import { useDocuments } from '@/store/documents';
import { FREE_ITEM_LIMIT, FREE_SCAN_LIMIT, useSettings } from '@/store/settings';
import { Attachment, DocumentType, DocumentTypeId, ExtractedField, TrackedDocument } from '@/types';

type Step = 'choose' | 'type' | 'confirmType' | 'review' | 'remind' | 'form' | 'scansSpent';

/**
 * One of several things found in a single picture, waiting to be confirmed.
 *
 * Carries the scan's own item so that everything read off the document goes
 * into the record, and the two things a person is most likely to want to fix
 * before saving: what it is, and what it is called. The date is not editable
 * here on purpose. Four inline date pickers in a list is a worse screen than
 * one correction made afterwards on the item's own page, which already has
 * "Update the date" on it.
 */
type Reviewed = {
  item: ScanItem;
  typeId: DocumentTypeId;
  title: string;
  keep: boolean;
};

const LEAD_DAY_OPTIONS = [1, 3, 7, 14, 30, 60, 90, 180];

export default function AddDocumentScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const theme = useTheme();
  const scheme = useColorScheme();
  const { documents, addDocument, updateDocument } = useDocuments();
  const { settings, update } = useSettings();
  const params = useLocalSearchParams<{
    id?: string;
    renew?: string;
    owner?: string;
    /**
     * Opens straight on the category list instead of the camera.
     *
     * That list is the honest answer to "what can this app track", and it was
     * three taps down: other ways to add, enter it myself, change. Somewhere
     * had to be able to point at it, and pointing at the real one means there
     * is never a second list to keep in step.
     */
    start?: string;
  }>();

  /** Set when you arrived from a person, so the form already knows whose this is. */
  const forOwner = typeof params.owner === 'string' ? params.owner : undefined;

  const editing = params.id ? documents.find((d) => d.id === params.id) : undefined;
  const renewing = params.renew === '1' && !!editing;
  const overFreeLimit = !editing && !settings.premium && documents.length >= FREE_ITEM_LIMIT;
  const outOfScans = !settings.premium && settings.scansUsed >= FREE_SCAN_LIMIT;
  const scansLeft = Math.max(0, FREE_SCAN_LIMIT - settings.scansUsed);

  const [step, setStep] = useState<Step>(
    editing ? 'form' : params.start === 'type' ? 'type' : 'choose'
  );
  /**
   * The steps behind this one, so there is a way back that keeps what has been
   * done.
   *
   * These steps are state in one screen rather than routes in a stack, so
   * there was no Back: the only way out of the entry form was the X, which
   * threw away the scan and the form and started the flow again. Somebody who
   * photographed the wrong side of a card had to redo all of it.
   *
   * A trail rather than a table of which step precedes which, because several
   * of them have more than one predecessor: the category picker is reached
   * from the way-in step, from the form's Category row, and from the
   * confirmation question, and each has to return where it came from.
   *
   * Going back never clears anything. Every field lives in this component, so
   * a step is only ever which part of it is on screen.
   */
  const [trail, setTrail] = useState<Step[]>([]);
  const [typeId, setTypeId] = useState<DocumentTypeId | null>(editing?.typeId ?? null);
  const [title, setTitle] = useState(editing?.title ?? '');
  /**
   * Whether the date on screen is one somebody chose, or just where the wheel
   * opened. Editing an item or renewing one both arrive with a real date; a
   * blank form does not, and must not be saveable until it does.
   */
  const [dateChosen, setDateChosen] = useState(Boolean(editing));

  const [expiry, setExpiry] = useState<Date>(() =>
    editing ? startingExpiry(editing, params.renew === '1') : defaultExpiry()
  );
  const [documentNumber, setDocumentNumber] = useState(editing?.documentNumber ?? '');
  /*
   * Prefilled when you got here from somebody — their card, their page, their
   * menu. Tapping "Add something for them" and then having to say who they are
   * is the app forgetting what you just told it.
   */
  const [owner, setOwner] = useState(editing?.owner ?? forOwner ?? '');
  const [namingOwner, setNamingOwner] = useState(false);
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [files, setFiles] = useState<Attachment[]>(editing?.files ?? []);
  const [leadDays, setLeadDays] = useState<number[]>(editing?.leadDays ?? []);
  const [busy, setBusy] = useState<'scanning' | 'attaching' | null>(null);
  const [slowScan, setSlowScan] = useState(false);
  const [scanNote, setScanNote] = useState<string | null>(null);
  /*
   * Everything else the scan read off the document. Not editable here: the form
   * is for the handful of things the app acts on, and turning a transcription
   * into eleven text inputs would bury them. It is shown on the document's own
   * screen, where there is room to read it.
   */
  const [fields, setFields] = useState<ExtractedField[]>(editing?.fields ?? []);
  /**
   * The category the scan guessed, kept only while it is being questioned.
   *
   * Needed for two things the confirmation step cannot do without: naming it
   * in the question, and deciding whether the title the scan wrote is a title
   * that names the thing it got wrong.
   */
  const [guessed, setGuessed] = useState<DocumentType | null>(null);
  /**
   * Everything found in one picture, when it held more than one thing.
   *
   * The prompt used to say "return exactly one item", so somebody who
   * photographed two ID cards on a table got one of them and no word about the
   * other. Nothing is dropped in silence now: everything found is listed, and
   * what somebody unticks is theirs to untick.
   */
  const [review, setReview] = useState<Reviewed[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);

  /**
   * Forward, remembering where from.
   *
   * Not every change of step is a move forward, and the difference decides
   * where Back lands. Answering "this looks like a passport" swaps the
   * question for the form, so it uses setStep and leaves the trail alone:
   * Back from the form then returns to the way in, which is what somebody
   * retaking a photo wants, rather than asking them the question again.
   */
  function go(next: Step) {
    setTrail((behind) => [...behind, step]);
    setStep(next);
  }

  /** Back, to wherever this step was reached from. */
  function back() {
    setTrail((behind) => {
      const previous = behind[behind.length - 1];
      if (previous !== undefined) setStep(previous);
      return behind.slice(0, -1);
    });
  }

  /**
   * Whether there is anything here worth not throwing away.
   *
   * Decides two things: whether closing asks first, and whether the sheet can
   * be swiped away at all. A blank form should never interrupt somebody who
   * has changed their mind about starting.
   */
  const dirty =
    !editing &&
    (title.trim() !== '' ||
      files.length > 0 ||
      dateChosen ||
      notes.trim() !== '' ||
      documentNumber.trim() !== '' ||
      review !== null);

  /**
   * Closing the whole sheet, which is what the X and the swipe do.
   *
   * One native alert when there is something to lose, and nothing at all when
   * there is not.
   */
  function close() {
    if (!dirty) {
      router.back();
      return;
    }
    Alert.alert('Discard this?', 'What you have entered will not be saved.', [
      { text: 'Keep Editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => router.back() },
    ]);
  }

  useEffect(() => {
    navigation.setOptions({
      title: renewing ? 'Renewed' : editing ? 'Edit' : 'New entry',
      /*
       * Back where there is somewhere to go back to, and the X beside it so
       * there is always a way out as well as a way back. Set from here rather
       * than in the route's options because only this screen knows how deep
       * into the flow somebody is.
       */
      headerLeft: () =>
        trail.length > 0 ? (
          <HeaderAction symbol="chevron.left" label="Back" onPress={back} />
        ) : (
          <HeaderAction symbol="xmark" label="Cancel" onPress={close} />
        ),
      headerRight: () =>
        trail.length > 0 ? (
          <HeaderAction symbol="xmark" label="Cancel" onPress={close} />
        ) : undefined,
      /*
       * The sheet cannot be swiped away while there is something in it.
       *
       * This is UIKit's own behaviour: isModalInPresentation exists so a sheet
       * with unsaved work refuses the gesture and makes the person use the
       * button, which can ask. Without it the swipe discards silently, and
       * expo-router does not export the hook that would let the gesture be
       * intercepted instead.
       */
      gestureEnabled: !dirty,
    });
    // Rebuilt whenever the depth or the dirtiness changes, which is what the
    // two controls are about.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, editing, renewing, trail.length, dirty]);

  // Long enough that a normal read never trips it.
  useEffect(() => {
    if (busy !== 'scanning') {
      setSlowScan(false);
      return;
    }
    const timer = setTimeout(() => setSlowScan(true), 6000);
    return () => clearTimeout(timer);
  }, [busy]);

  /**
   * Documents load from storage asynchronously, so opening this screen by URL
   * can mount it before the item exists. Fill the form in once it arrives.
   */
  const hydrated = useRef(Boolean(editing));
  useEffect(() => {
    if (!editing || hydrated.current) return;
    hydrated.current = true;
    setTypeId(editing.typeId);
    setTitle(editing.title);
    setExpiry(startingExpiry(editing, params.renew === '1'));
    setDocumentNumber(editing.documentNumber ?? '');
    setOwner(editing.owner ?? '');
    setNotes(editing.notes ?? '');
    setFiles(editing.files);
    setLeadDays(editing.leadDays);
    setStep('form');
  }, [editing, params.renew]);

  const type = useMemo(() => (typeId ? getDocumentType(typeId) : null), [typeId]);
  const numberField = type ? numberFieldFor(type, settings.country) : undefined;

  /**
   * Everyone this could belong to.
   *
   * Was the owners already written on documents, and nobody else — so somebody
   * added on the Household page owned nothing, therefore did not exist here,
   * and had to be typed in again. Type it slightly differently and you had two
   * of them. The two screens are about the same people and now read from the
   * same place.
   */
  const knownOwners = useMemo(() => {
    const mine = settings.ownName.trim().toLowerCase();
    const seen = new Set<string>();
    const names: string[] = [];

    for (const name of [
      ...documents.map((d) => d.owner ?? ''),
      ...settings.people,
    ]) {
      const trimmed = name.trim();
      const key = trimmed.toLowerCase();
      // Your own name is the "Mine" chip; it must not appear twice.
      if (!trimmed || key === mine || seen.has(key)) continue;
      seen.add(key);
      names.push(trimmed);
    }

    return names.slice(0, 6);
  }, [documents, settings.people, settings.ownName]);

  const reminderAt = formatTime(REMINDER_TIME.hour, REMINDER_TIME.minute);

  /** The actual dates the reminders will arrive — more useful than day counts. */
  const nudgeSummary = useMemo(() => {
    if (leadDays.length === 0) return 'No reminders set, so you will not be warned.';
    const dates = [...leadDays]
      .sort((a, b) => b - a)
      .map((lead) => {
        const d = new Date(expiry);
        d.setDate(d.getDate() - lead);
        return dayMonth(d);
      });
    return `${countWord(leadDays.length)} reminder${leadDays.length === 1 ? '' : 's'}: ${dates.join(', ')}, each at ${reminderAt}.`;
    // The hour is the user's, so quoting 9am at everybody was simply wrong.
  }, [leadDays, expiry, reminderAt]);

  function applyScan(result: ScanResult, scannedUri: string, scannedKind: 'image' | 'pdf') {
    const scannedType = getDocumentType(result.typeId);
    setTypeId(result.typeId);
    setTitle(result.title || labelFor(scannedType, settings.country));
    if (result.expiryDate) {
      const parsed = new Date(`${result.expiryDate}T00:00:00`);
      if (!Number.isNaN(parsed.getTime())) {
        setExpiry(parsed);
        setDateChosen(true);
      }
    }
    setDocumentNumber(scannedType.numberField ? result.documentNumber : '');
    setLeadDays(scannedType.defaultLeadDays);
    setFiles([{ uri: scannedUri, type: scannedKind, key: newAttachmentKey() }]);
    setFields(result.fields ?? []);
    setScanNote(
      result.confidence === 'high' ? result.note : `${result.note} Check the date before saving.`
    );

    /*
     * One question, before the form, when the service was not sure what the
     * object was. A wrong category is the wrong renewal guidance, the wrong
     * lead times and a wrong title, and it stays wrong for as long as the
     * document is tracked, so it is the one thing here worth interrupting for.
     *
     * Everything read off the document is already in state behind this, so
     * answering either way costs a single tap and loses nothing.
     */
    if (needsTypeConfirmation(result.typeConfidence)) {
      /*
       * "Other" is not a guess, it is the absence of one, so there is nothing
       * to confirm and "this looks like an other" is not a sentence. The
       * category list is the useful answer instead, with everything read off
       * the document already waiting behind it.
       */
      if (result.typeId === 'other') {
        setGuessed(null);
        go('type');
        return;
      }
      setGuessed(scannedType);
      go('confirmType');
      return;
    }

    setGuessed(null);
    go('form');
  }

  /**
   * Saves everything still ticked, as far as the free plan allows.
   *
   * The same arithmetic the subscription import uses, for the same reason: a
   * picture can hold more things than the plan has room for, and the two
   * answers that are not acceptable are refusing the lot and silently keeping
   * the first few. What fits is saved and the rest is named out loud.
   */
  async function saveReview() {
    if (!review) return;
    const keepers = review.filter((row) => row.keep);
    if (keepers.length === 0) return;

    const room = roomFor({
      tracked: documents.length,
      limit: FREE_ITEM_LIMIT,
      premium: settings.premium,
    });
    const { take, blocked } = splitImport(keepers.length, room);

    if (take === 0) {
      router.replace('/paywall');
      return;
    }

    setSaving(true);
    try {
      for (const row of keepers.slice(0, take)) {
        const type = getDocumentType(row.typeId);
        await addDocument({
          typeId: row.typeId,
          title: row.title.trim() || labelFor(type, settings.country),
          expiryDate: row.item.expiryDate,
          documentNumber: type.numberField ? row.item.documentNumber : undefined,
          // The picture is of all of them, so each record carries it.
          files,
          leadDays: type.defaultLeadDays,
          fields: row.item.fields.length > 0 ? row.item.fields : undefined,
        });
      }
      successFeedback();

      if (blocked > 0) {
        Alert.alert(
          `${take} added. ${blocked} more need Expyr Pro.`,
          `The free plan holds ${FREE_ITEM_LIMIT} items. Pro takes the limit off, so the rest of what was in that picture can be tracked too.`,
          [
            { text: 'Not now', style: 'cancel', onPress: () => router.back() },
            { text: 'See Pro', onPress: () => router.replace('/paywall') },
          ]
        );
        return;
      }
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Those could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  /**
   * What is left of the free scans, and only once the end is in sight.
   *
   * The group's footer, which is where iOS explains a group, rather than a
   * centred line under the buttons.
   */
  function footerForScans(): string | undefined {
    if (settings.premium || scansLeft > 3) return undefined;
    return scansLeft === 0
      ? 'No free scans left. Typing a date in is still free'
      : `${scansLeft} free ${scansLeft === 1 ? 'scan' : 'scans'} left`;
  }

  async function runScan(source: 'camera' | 'library' | 'files') {
    setError(null);
    if (outOfScans) {
      go('scansSpent');
      return;
    }
    try {
      const picked = source === 'files' ? await pickDocument() : await pickImage(source);
      if (!picked) return;
      setBusy('scanning');
      const { result, fileUri: scannedUri } = await scanFile(picked, settings.country);

      /*
       * A list of subscriptions, which has a reader of its own that does it
       * properly. The person chose a photo and it turned out to be their
       * Subscriptions screen; they are not supposed to know there are two
       * readers, so the picture goes to the right one rather than the person
       * being told to start again somewhere else.
       *
       * Not counted against the scan allowance here, because that screen
       * counts its own read and this one produced nothing.
       */
      if (result.imageKind === 'subscriptions') {
        /*
         * The picture they picked, not the copy that was sent. `scanFile`
         * downscales before uploading, and handing that on would compress a
         * screenshot full of small text twice before the reader that has to
         * read every line of it ever sees it.
         */
        router.replace({ pathname: '/subscriptions', params: { image: picked.uri } });
        return;
      }

      const many = (result.items ?? []).filter((item) => item.found);

      // Only a scan that actually read something counts against the allowance.
      if (!result.found && many.length === 0) {
        setError(result.note || 'No date found in that file.');
        go('type');
        return;
      }
      if (!settings.premium) update({ scansUsed: settings.scansUsed + 1 });

      /*
       * Two cards on a table are two items. One card photographed front and
       * back is one, which the service decides rather than this screen.
       */
      if (many.length > 1) {
        setReview(
          many.map((item) => ({
            item,
            typeId: item.typeId,
            title: item.title || labelFor(getDocumentType(item.typeId), settings.country),
            keep: true,
          }))
        );
        setFiles([{ uri: scannedUri, type: picked.type, key: newAttachmentKey() }]);
        go('review');
        return;
      }

      applyScan(result, scannedUri, picked.type);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong while scanning.');
    } finally {
      setBusy(null);
    }
  }

  async function addAttachment(source: 'camera' | 'library' | 'files') {
    setError(null);
    try {
      const picked = source === 'files' ? await pickDocument() : await pickImage(source);
      if (!picked) return;
      setBusy('attaching');
      const uri = await attachFile(picked);
      setFiles((current) => [
        ...current,
        { uri, type: picked.type, key: newAttachmentKey() },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That file could not be added.');
    } finally {
      setBusy(null);
    }
  }

  function pickType(t: DocumentType) {
    // A title the user never touched is one of ours, under either naming.
    const isAutoTitle =
      !title.trim() ||
      DOCUMENT_TYPES.some(
        (c) => c.label === title.trim() || c.genericLabel === title.trim()
      );
    setTypeId(t.id);
    /*
     * Correcting a scan is a different case from choosing a category by hand.
     * The scan writes its own title, so it is not "one of ours" and would
     * survive the correction: the entry that started this read "Residence Visa
     * for AEHED SAID SHERIF" on a passport, and the wrong words would have
     * stayed in the one place the person reads every time.
     */
    if (guessed) {
      setTitle(
        titleAfterCorrection(title, labelFor(guessed, settings.country), labelFor(t, settings.country))
      );
      setGuessed(null);
    } else if (isAutoTitle) setTitle(labelFor(t, settings.country));
    if (!t.numberField) setDocumentNumber('');
    if (leadDays.length === 0 || !editing) setLeadDays(t.defaultLeadDays);
    setScanNote(null);
    /*
     * Return rather than advance when the picker was opened from the form,
     * which is the Category row. Opened from the way-in step it is the first
     * choice made and the form comes next.
     */
    if (trail[trail.length - 1] === 'form') back();
    else go('form');
  }

  function toggleLeadDay(day: number) {
    tapFeedback();
    setLeadDays((current) =>
      current.includes(day)
        ? current.filter((d) => d !== day)
        : [...current, day].sort((a, b) => b - a)
    );
  }

  /** Same category, same person, within a few days — almost certainly the same thing. */
  function findDuplicate(): TrackedDocument | undefined {
    if (editing) return undefined;
    const target = toISODate(expiry);
    const number = documentNumber.trim().toLowerCase();
    return documents.find((d) => {
      if (number && d.documentNumber?.trim().toLowerCase() === number) return true;
      if (d.typeId !== typeId) return false;
      if ((d.owner ?? '') !== owner.trim()) return false;
      const gap = Math.abs(
        (new Date(`${d.expiryDate}T00:00:00`).getTime() -
          new Date(`${target}T00:00:00`).getTime()) /
          86_400_000
      );
      return gap <= 3;
    });
  }

  async function save() {
    if (!typeId || !title.trim() || saving) return;

    const duplicate = findDuplicate();
    if (duplicate) {
      Alert.alert(
        'You already track this',
        `“${duplicate.title}” expires ${shortDate(duplicate.expiryDate)}. Add another anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open the existing one', onPress: () => router.replace(`/document/${duplicate.id}`) },
          { text: 'Add anyway', onPress: () => persist() },
        ]
      );
      return;
    }
    persist();
  }

  async function persist() {
    if (!typeId || saving) return;

    /*
     * Said out loud rather than refused in silence. The button stays live and
     * explains what is missing — a disabled control that gives no reason is
     * indistinguishable from an app that has stopped working.
     */
    if (!dateChosen) {
      setError('Choose the date this expires. Expyr cannot remind you without it.');
      return;
    }

    setError(null);
    setSaving(true);
    const draft = {
      typeId,
      title: title.trim(),
      expiryDate: toISODate(expiry),
      documentNumber: documentNumber.trim() || undefined,
      notes: notes.trim() || undefined,
      owner: owner.trim() || undefined,
      files,
      leadDays,
      // Undefined rather than an empty list, so a hand-typed item carries no
      // trace of a feature it never used.
      fields: fields.length > 0 ? fields : undefined,
    };
    const isFirstItem = documents.length === 0;

    if (editing) {
      // Renewing keeps the date it used to carry, so the item shows its past.
      const movedOn = renewing && draft.expiryDate !== editing.expiryDate;
      await updateDocument(editing.id, {
        ...draft,
        archivedAt: editing.archivedAt,
        history: movedOn ? [...(editing.history ?? []), editing.expiryDate] : editing.history,
      });
      successFeedback();
      router.back();

      /*
       * The one place Expyr asks to be rated.
       *
       * Not on launch and not on an open count: here, where a document that
       * would have lapsed did not, because the app said so in time. Only when
       * the date actually moved, so correcting a typo is not treated as a
       * renewal, and only once per install. The flag is set only if iOS says
       * it really showed the sheet, since it refuses in TestFlight and says
       * nothing about having refused.
       */
      if (movedOn && !settings.ratingAsked) {
        void askForReview().then((asked) => {
          if (asked) update({ ratingAsked: true });
        });
      }
      return;
    }

    const created = await addDocument(draft);
    successFeedback();

    /*
     * Reading used to start here, the moment a contract was saved, so the
     * answers were usually waiting by the time anyone went looking.
     *
     * It cannot start here any more. Reading costs credits now, and this call
     * carried no balance to check and nothing to charge: saving a contract
     * spent money and billed nobody. Worse, because reads in flight are shared,
     * the document screen would join this one and skip its own charge too, so
     * one unbudgeted read made the next one free as well.
     *
     * The document screen owns reading now. It has the balance, the charging
     * and somewhere to say no. The cost is a few seconds of head start.
     */

    // The first item is the moment to show the promise being kept: the
    // countdown, the reminder dates and what renewing actually involves.
    if (isFirstItem) router.replace(`/document/${created.id}`);
    else router.back();
  }

  if (overFreeLimit) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        {/*
          * "That is 5." was a statement of a count, and it read as one — a
          * headline telling somebody how many items they have, in front of
          * somebody who has more than that. The situation goes in the
          * headline and the number goes in the sentence that explains it.
          */}
        <ThemedText type="largeTitle">The free plan is full.</ThemedText>
        <ThemedText type="body" themeColor="textSecondary" style={styles.centeredText}>
          It holds {FREE_ITEM_LIMIT} items. Unlock Expyr to track everything you own, and everyone
          in the house.
        </ThemedText>
        <View style={styles.wallAction}>
          <PrimaryButton label="See the options" onPress={() => router.replace('/paywall')} />
        </View>
        <Pressable onPress={() => router.back()} style={styles.link}>
          <ThemedText type="footnote" themeColor="textTertiary">
            Not now
          </ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  /*
   * Running out of scans must never look like a broken app. The way in is still
   * open — it just costs you typing the date instead of photographing it.
   */
  /*
   * One question, and only when the service hedged on the category.
   *
   * It names its guess rather than asking an open question, because "what is
   * this?" in front of somebody who has just photographed the thing is the app
   * admitting it did not look. A yes is one tap and everything read off the
   * document is already behind this screen; a no goes to the same category list
   * the manual path uses, which is the picker being one tap away.
   */
  if (step === 'confirmType' && guessed) {
    const named = inSentence(labelFor(guessed, settings.country));
    const article = articleFor(named);
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ThemedText type="largeTitle" style={styles.centeredText}>
          This looks like {article} {named}.
        </ThemedText>
        <ThemedText type="body" themeColor="textSecondary" style={styles.centeredText}>
          Is that right? The category decides how Expyr reminds you and what it tells you about
          renewing this, so it is worth a second.
        </ThemedText>
        <View style={styles.wallAction}>
          <PrimaryButton
            label={`Yes, it is ${article} ${named}`}
            onPress={() => {
              tapFeedback();
              setGuessed(null);
              setStep('form');
            }}
          />
        </View>
        <Pressable onPress={() => go('type')} style={styles.link}>
          <ThemedText type="footnote" themeColor="textTertiary">
            No, it is something else
          </ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  if (step === 'scansSpent') {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ThemedText type="largeTitle">Free scans are spent.</ThemedText>
        <ThemedText type="body" themeColor="textSecondary" style={styles.centeredText}>
          Reading a date off a photo costs us something every time, so the free plan includes{' '}
          {FREE_SCAN_LIMIT} of them. Unlock Expyr to scan without counting.
        </ThemedText>
        <ThemedText type="footnote" themeColor="textTertiary" style={styles.centeredText}>
          You can still add anything you like by typing the date, and that stays free.
        </ThemedText>
        <View style={styles.wallAction}>
          <PrimaryButton label="See the options" onPress={() => router.replace('/paywall')} />
        </View>
        <Pressable onPress={() => setStep('type')} style={styles.link}>
          <ThemedText type="footnote" themeColor="textTertiary">
            Enter it myself
          </ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  if (busy) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={theme.accent} />
        <ThemedText type="body" style={styles.centeredText}>
          {busy === 'scanning' ? 'Reading your document…' : 'Adding your file…'}
        </ThemedText>
        {/*
         * A warm read takes about three seconds; the first one after a quiet
         * spell can take thirty. A spinner alone for that long reads as broken,
         * so once it runs long the wait gets explained rather than hidden.
         */}
        {slowScan && (
          <ThemedText type="footnote" themeColor="textTertiary" style={styles.centeredText}>
            Still working.
          </ThemedText>
        )}
      </ThemedView>
    );
  }

  if (step === 'choose') {
    return (
      <ThemedView style={styles.container}>
        <ScrollView contentContainerStyle={styles.chooseContent}>
          <View style={styles.chooseIcon}>
            <Icon name="doc.viewfinder" size={52} color={theme.accent} />
          </View>
          <ThemedText type="body" themeColor="textSecondary" style={styles.centeredText}>
            A document, a screenshot, or a PDF. Expyr reads the date off it.
          </ThemedText>

          {error && <ErrorNote message={error} />}

          {/*
            * Five rows in a group, where there used to be one filled button,
            * a disclosure reading "Other ways to add", and four more buttons
            * behind it.
            *
            * The disclosure existed because four outlined pills stacked under
            * a filled one was clutter, and it was solving the right problem
            * the wrong way: rows in a list are not clutter. A person reads
            * five of them at a glance and takes the first, which is the
            * camera, which is the app's whole pitch.
            *
            * The cost is that the camera is no longer the only loud thing on
            * the screen. It is first, it is the only blue tile, and the symbol
            * above is a viewfinder.
            */}
          <ListSection footer={footerForScans()}>
            <ListRow
              symbol="camera.fill"
              tint="blue"
              title="Take a photo"
              onPress={() => runScan('camera')}
            />
            <ListRow
              symbol="photo.on.rectangle"
              tint="gray"
              title="Choose a photo"
              onPress={() => runScan('library')}
            />
            <ListRow
              symbol="folder.fill"
              tint="gray"
              title="Upload a PDF"
              onPress={() => runScan('files')}
            />
            {/*
              * A different job from the others: one screenshot stands for
              * every subscription somebody pays for, rather than one document.
              */}
            <ListRow
              symbol="repeat"
              tint="purple"
              title="Import my subscriptions"
              onPress={() => router.replace('/subscriptions')}
            />
            <ListRow
              symbol="keyboard"
              tint="gray"
              title="Enter it myself"
              onPress={() => go('type')}
            />
          </ListSection>
        </ScrollView>
      </ThemedView>
    );
  }

  /*
   * Everything found in one picture, and what happens to it.
   *
   * The old prompt returned exactly one item, so a photograph of two cards
   * produced one record and not a word about the other. Listing them is the
   * fix, and the list is also where the two things most likely to be wrong can
   * be put right before anything is written: what each one is, and what it is
   * called.
   */
  if (step === 'review' && review) {
    const keeping = review.filter((row) => row.keep).length;
    return (
      <ThemedView style={styles.container}>
        <ScrollView contentContainerStyle={styles.listContent}>
          {error && <ErrorNote message={error} />}

          <ListSection
            title={`Found ${countWord(review.length).toLowerCase()} things`}
            /*
              * Keep or leave, and nothing else. The list used to offer
              * renaming and recategorising too, which meant every item
              * appeared twice: once to tick and once to correct.
              *
              * Both are still possible, on the item's own screen, after it is
              * saved. That is the same trade the date already makes here, and
              * it is only defensible because the category is now editable
              * afterwards, which it was not until this commit.
              */
            footer="Anything wrong is editable once it is saved">
            {review.map((row, index) => (
              <ListRow
                key={`${row.title}-${index}`}
                symbol={iconFor(row.typeId)}
                tint={row.keep ? undefined : 'gray'}
                title={row.title}
                subtitle={`${labelFor(getDocumentType(row.typeId), settings.country)}${
                  row.item.expiryDate ? `, ${longDate(row.item.expiryDate)}` : ''
                }`}
                chevron={false}
                onPress={() => {
                  tapFeedback();
                  setReview(
                    (current) =>
                      current?.map((other, at) =>
                        at === index ? { ...other, keep: !other.keep } : other
                      ) ?? null
                  );
                }}
                control={
                  row.keep ? (
                    <Icon name="checkmark" size={15} weight="semibold" color={theme.accent} />
                  ) : undefined
                }
              />
            ))}
          </ListSection>

        </ScrollView>

        <View style={styles.foot}>
          <PrimaryButton
            label={
              saving
                ? 'Adding'
                : keeping === 0
                  ? 'Nothing selected'
                  : `Track ${keeping} ${keeping === 1 ? 'thing' : 'things'}`
            }
            onPress={saveReview}
            disabled={keeping === 0 || saving}
          />
        </View>

      </ThemedView>
    );
  }

  if (step === 'type') {
    return (
      <ThemedView style={styles.container}>
        <ScrollView contentContainerStyle={styles.listContent}>
          {error && <ErrorNote message={error} />}
          {/*
            * The catalogue, as a grouped list with its own colours. It was
            * fifteen ruled rows with a chevron each, which is a table of
            * contents; this is a list somebody can find a passport in without
            * reading every line, because the blue ones are the identity
            * documents and they are at the top.
            */}
          <ListSection title="What are you tracking?">
            {DOCUMENT_TYPES.map((t) => (
              <ListRow
                key={t.id}
                symbol={iconFor(t.id)}
                tint={tintFor(t.id)}
                title={labelFor(t, settings.country)}
                onPress={() => pickType(t)}
              />
            ))}
          </ListSection>
        </ScrollView>
      </ThemedView>
    );
  }

  /* Which reminders to book, chosen the way iOS chooses several from a list. */
  if (step === 'remind') {
    return (
      <ThemedView style={styles.container}>
        <ScrollView contentContainerStyle={styles.listContent}>
          <ListSection title="Remind me before" footer={nudgeSummary}>
            {LEAD_DAY_OPTIONS.map((day) => (
              <ListRow
                key={day}
                symbol="bell.fill"
                tint={leadDays.includes(day) ? 'red' : 'gray'}
                title={leadLabel(day)}
                chevron={false}
                onPress={() => toggleLeadDay(day)}
                control={
                  leadDays.includes(day) ? (
                    <Icon name="checkmark" size={15} weight="semibold" color={theme.accent} />
                  ) : undefined
                }
              />
            ))}
          </ListSection>
        </ScrollView>

        <View style={styles.foot}>
          <PrimaryButton label="Done" onPress={back} />
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        /* So the field being typed into is never behind the keyboard. */
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="interactive">
        {renewing && (
          <Note text="Date moved forward by the usual period. Check it against the new document." />
        )}
        {scanNote && <Note text={scanNote} />}
        {error && <ErrorNote message={error} />}

        {/*
          * The form is grouped lists now, which is how Contacts, Calendar and
          * Reminders all edit. It was ruled lines under grey labels, with a 26
          * point semibold field for the name: a paper form, carefully set, on
          * a phone where every form looks like this instead.
          */}
        <ListSection>
          <ListInput
            symbol={iconFor(typeId!)}
            tint={tintFor(typeId!)}
            value={title}
            onChangeText={setTitle}
            /*
             * An example rather than a repeat of the category, for the one
             * moment it is read: somebody has cleared the prefilled name to
             * write their own, and what they need then is the pattern.
             */
            placeholder={titleExampleFor(type!, settings.country)}
            autoCapitalize="words"
          />

          {/*
            * Editable on an existing item, which it was not before: the row
            * was disabled once a document had been saved, so a passport that
            * came back as a residence visa could not be put right at all
            * without deleting it and starting again. That is the aftermath of
            * the scan bug, and the reason the review list can afford to be a
            * plain checklist.
            */}
          <ListRow
            symbol="tag.fill"
            tint="gray"
            title="Category"
            value={labelFor(type!, settings.country)}
            onPress={() => go('type')}
          />
        </ListSection>

        <ListSection>
          {/*
            * The date, with the platform's own compact picker on the right of
            * the row. Blank rather than plausible until somebody chooses: a
            * date nobody picked, printed in the same type as one they did, is
            * indistinguishable from an answer.
            */}
          <ListRow
            symbol="calendar"
            tint={tintFor(typeId!)}
            title={dateChosen ? 'Expires' : 'Expires'}
            value={Platform.OS === 'ios' ? undefined : dateChosen ? longDate(toISODate(expiry)) : 'Not set yet'}
            control={
              Platform.OS === 'ios' ? (
                <DateTimePicker
                  value={expiry}
                  mode="date"
                  display="compact"
                  themeVariant={scheme}
                  accentColor={theme.accent}
                  onChange={(_, date) => {
                    if (!date) return;
                    setExpiry(date);
                    setDateChosen(true);
                  }}
                />
              ) : (
                <Pressable
                  onPress={() => setShowAndroidPicker(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Change the date">
                  <Icon name="calendar" size={18} color={theme.accent} />
                </Pressable>
              )
            }
          />

          {Platform.OS === 'android' && showAndroidPicker && (
            <DateTimePicker
              value={expiry}
              mode="date"
              display="default"
              onChange={(_, date) => {
                setShowAndroidPicker(false);
                if (!date) return;
                setExpiry(date);
                setDateChosen(true);
              }}
            />
          )}

          {/*
            * The lead times behind a row, which is how Calendar keeps Repeat
            * and Alert. Eight pills in a grid was the whole choice on screen
            * at all times, for a decision most people make once and never
            * revisit.
            */}
          <ListRow
            symbol="bell.fill"
            tint="red"
            title="Remind me"
            value={
              leadDays.length === 0
                ? 'Never'
                : `${leadDays.length} ${leadDays.length === 1 ? 'reminder' : 'reminders'}`
            }
            onPress={() => go('remind')}
          />
        </ListSection>

        {/*
          * Whose it is, as a checklist. It was a row of pills, one per person,
          * and a pill reading "+ Someone new" which is a button pretending to
          * be an option.
          */}
        <ListSection title="Whose is it">
          <ListRow
            symbol="person.fill"
            tint={!owner ? 'green' : 'gray'}
            title={settings.ownName || 'Mine'}
            chevron={false}
            onPress={() => {
              setOwner('');
              setNamingOwner(false);
            }}
            control={
              !owner ? (
                <Icon name="checkmark" size={15} weight="semibold" color={theme.accent} />
              ) : undefined
            }
          />
          {knownOwners.map((name) => (
            <ListRow
              key={name}
              symbol="person.fill"
              tint={owner === name ? 'green' : 'gray'}
              title={name}
              chevron={false}
              onPress={() => {
                setOwner(name);
                setNamingOwner(false);
              }}
              control={
                owner === name ? (
                  <Icon name="checkmark" size={15} weight="semibold" color={theme.accent} />
                ) : undefined
              }
            />
          ))}
          {namingOwner ? (
            <ListInput
              symbol="person.badge.plus"
              tint="green"
              value={owner}
              onChangeText={setOwner}
              placeholder="Their name"
              autoCapitalize="words"
              autoFocus
            />
          ) : (
            <ListRow
              symbol="person.badge.plus"
              tint="gray"
              title="Someone else"
              chevron={false}
              onPress={() => {
                setOwner('');
                setNamingOwner(true);
              }}
            />
          )}
        </ListSection>

        {numberField && (
          <ListSection footer="Optional">
            <ListInput
              symbol="number"
              tint="gray"
              label={numberField.label}
              value={documentNumber}
              onChangeText={setDocumentNumber}
              placeholder={numberField.placeholder}
              autoCapitalize="characters"
            />
          </ListSection>
        )}

        <ListSection
          title="Attachments"
          footer={files.length === 0 ? 'Nothing attached yet' : 'Kept on this phone only'}>
          <View style={styles.thumbRow}>
            {files.map((file) => (
              <View key={file.key}>
                {file.type === 'pdf' ? (
                  <View style={[styles.thumb, { backgroundColor: theme.backgroundSelected }]}>
                    <Icon name="doc.fill" size={20} color={theme.textSecondary} />
                  </View>
                ) : (
                  <Image
                    source={{ uri: file.uri }}
                    style={styles.thumb}
                    resizeMode="cover"
                  />
                )}
                <Pressable
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Remove this attachment"
                  onPress={() => setFiles((c) => c.filter((f) => f.key !== file.key))}
                  style={styles.removeBadge}>
                  <Icon name="xmark.circle.fill" size={20} color={theme.textSecondary} />
                </Pressable>
              </View>
            ))}

            <Pressable
              onPress={() => addAttachment('camera')}
              accessibilityRole="button"
              accessibilityLabel="Take a photo">
              <View style={[styles.addThumb, { backgroundColor: theme.backgroundSelected }]}>
                <Icon name="camera.fill" size={18} color={theme.accent} />
              </View>
            </Pressable>
            <Pressable
              onPress={() => addAttachment('files')}
              accessibilityRole="button"
              accessibilityLabel="Choose a file">
              <View style={[styles.addThumb, { backgroundColor: theme.backgroundSelected }]}>
                <Icon name="folder.fill" size={18} color={theme.accent} />
              </View>
            </Pressable>
          </View>
        </ListSection>

        <ListSection title="Notes">
          <ListInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Anything to remember"
            multiline
          />
        </ListSection>
      </ScrollView>

      <View style={styles.foot}>
        <PrimaryButton
          label={editing ? 'Save' : 'Start tracking'}
          onPress={save}
          disabled={!title.trim() || saving}
        />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  dim: { opacity: 0.6 },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.five,
  },
  centeredText: { textAlign: 'center' },
  /* An explicit width, so a button fills the column rather than its label. */
  wallAction: { width: '100%', maxWidth: MaxContentWidth },
  link: { alignItems: 'center', paddingVertical: Spacing.three },
  /** Every list on this screen, inset the way a grouped list is. */
  listContent: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.four,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  chooseContent: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  chooseIcon: { alignItems: 'center', marginTop: Spacing.five, marginBottom: Spacing.two },
  /* The button sits where a thumb already is, under the list rather than in it. */
  foot: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  thumbRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  thumb: { width: 56, height: 56, borderRadius: Radius.small, alignItems: 'center', justifyContent: 'center' },
  addThumb: {
    width: 56,
    height: 56,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBadge: { position: 'absolute', top: -6, right: -6 },
});

/**
 * A button in the navigation bar: the symbol alone, tinted, with a real label
 * for anybody who cannot see it.
 *
 * Its own component because this screen now puts two of them up, Back and
 * Cancel, and which side each sits on changes with how deep into the flow
 * somebody is.
 */
function HeaderAction({
  symbol,
  label,
  onPress,
}: {
  symbol: SFSymbol;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={16} accessibilityRole="button" accessibilityLabel={label}>
      {({ pressed }) => (
        <Icon
          name={symbol}
          size={symbol === 'xmark' ? 20 : 22}
          weight="semibold"
          color={pressed ? theme.textSecondary : theme.accent}
        />
      )}
    </Pressable>
  );
}
