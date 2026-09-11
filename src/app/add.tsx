import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
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
  TextInput,
  View,
} from 'react-native';

import { Chip, ErrorNote, Field, Note, PrimaryButton, SecondaryButton } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { DOCUMENT_TYPES, getDocumentType, labelFor, numberFieldFor } from '@/data/document-types';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { defaultExpiry, startingExpiry } from '@/domain/expiry';
import { useTheme } from '@/hooks/use-theme';
import { countWord, dayMonth, formatTime, longDate, shortDate, toISODate } from '@/lib/dates';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { newAttachmentKey } from '@/lib/files';
import { REMINDER_TIME } from '@/lib/notifications';
import { askForReview } from '@/lib/rating';
import { leadLabel } from '@/lib/reminder-plan';
import { attachFile, pickDocument, pickImage, scanFile, type ScanResult } from '@/lib/scan';
import { useDocuments } from '@/store/documents';
import { FREE_ITEM_LIMIT, FREE_SCAN_LIMIT, useSettings } from '@/store/settings';
import { Attachment, DocumentType, DocumentTypeId, ExtractedField, TrackedDocument } from '@/types';

type Step = 'choose' | 'type' | 'form' | 'scansSpent';

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
  const [showNotes, setShowNotes] = useState(Boolean(editing?.notes));
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
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);
  /** The four other ways in, folded away until somebody asks for them. */
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: renewing ? 'Renewed' : editing ? 'Edit' : 'New entry' });
  }, [navigation, editing, renewing]);

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
    setShowNotes(Boolean(editing.notes));
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
    setStep('form');
  }

  async function runScan(source: 'camera' | 'library' | 'files') {
    setError(null);
    if (outOfScans) {
      setStep('scansSpent');
      return;
    }
    try {
      const picked = source === 'files' ? await pickDocument() : await pickImage(source);
      if (!picked) return;
      setBusy('scanning');
      const { result, fileUri: scannedUri } = await scanFile(picked, settings.country);
      // Only a scan that actually read something counts against the allowance.
      if (!result.found) {
        setError(result.note || 'No date found in that file.');
        setStep('type');
        return;
      }
      if (!settings.premium) update({ scansUsed: settings.scansUsed + 1 });
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
    if (isAutoTitle) setTitle(labelFor(t, settings.country));
    if (!t.numberField) setDocumentNumber('');
    if (leadDays.length === 0 || !editing) setLeadDays(t.defaultLeadDays);
    setScanNote(null);
    setStep('form');
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
        <ThemedText type="verdict">The free plan is full.</ThemedText>
        <ThemedText type="body" themeColor="textSecondary" style={styles.centeredText}>
          It holds {FREE_ITEM_LIMIT} items. Unlock Expyr to track everything you own, and everyone
          in the house.
        </ThemedText>
        <View style={styles.wallAction}>
          <PrimaryButton label="See the options" onPress={() => router.replace('/paywall')} />
        </View>
        <Pressable onPress={() => router.back()} style={styles.link}>
          <ThemedText type="small" themeColor="textTertiary">
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
  if (step === 'scansSpent') {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ThemedText type="verdict">Free scans are spent.</ThemedText>
        <ThemedText type="body" themeColor="textSecondary" style={styles.centeredText}>
          Reading a date off a photo costs us something every time, so the free plan includes{' '}
          {FREE_SCAN_LIMIT} of them. Unlock Expyr to scan without counting.
        </ThemedText>
        <ThemedText type="small" themeColor="textTertiary" style={styles.centeredText}>
          You can still add anything you like by typing the date, and that stays free.
        </ThemedText>
        <View style={styles.wallAction}>
          <PrimaryButton label="See the options" onPress={() => router.replace('/paywall')} />
        </View>
        <Pressable onPress={() => setStep('type')} style={styles.link}>
          <ThemedText type="small" themeColor="textTertiary">
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
          <ThemedText type="small" themeColor="textTertiary" style={styles.centeredText}>
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
            <MaterialCommunityIcons name="line-scan" size={44} color={theme.textTertiary} />
          </View>
          <ThemedText type="headline" style={styles.centeredText}>
            Show it to Expyr
          </ThemedText>
          <ThemedText type="body" themeColor="textSecondary" style={styles.centeredText}>
            A document, a screenshot, or a PDF. Expyr reads the date.
          </ThemedText>

          {error && <ErrorNote message={error} />}

          {/*
           * One way in, and four others behind a word.
           *
           * This screen used to offer five: photograph, pick from the library,
           * upload a PDF, import subscriptions, type it in — three of them
           * rendered identically, one under the next. Every one is worth having
           * and none of them is the answer. The app's whole pitch is "point the
           * camera at it", so that is the button, and the rest wait to be
           * asked for.
           *
           * The photo library and the PDF picker are not lesser features; they
           * are lesser *first moves*. Somebody who wants them knows they want
           * them and will look.
           */}
          <PrimaryButton label="Take a photo" onPress={() => runScan('camera')} />

          <Pressable
            onPress={() => {
              tapFeedback();
              setMoreOpen((open) => !open);
            }}
            accessibilityRole="button"
            accessibilityState={{ expanded: moreOpen }}
            style={styles.link}>
            <View style={styles.moreRow}>
              <ThemedText type="small" themeColor="textTertiary">
                {moreOpen ? 'Fewer ways' : 'Other ways to add'}
              </ThemedText>
              <MaterialCommunityIcons
                name={moreOpen ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={theme.textTertiary}
              />
            </View>
          </Pressable>

          {moreOpen && (
            /*
             * A plain View, not an entering animation. reanimated's `entering`
             * left every one of these on the page with visibility: hidden and
             * never cleared it — four options, correctly rendered, permanently
             * invisible. A fade is decoration; the options are the feature, and
             * shipping something invisible on one platform is the thing this
             * whole change was meant to stop.
             */
            <View style={styles.moreWays}>
              <SecondaryButton
                label="Choose a photo"
                icon="image-outline"
                onPress={() => runScan('library')}
              />
              <SecondaryButton
                label="Upload a PDF"
                icon="folder-open-outline"
                onPress={() => runScan('files')}
              />
              {/*
               * A different job from the others: one screenshot stands for every
               * subscription somebody pays for, rather than one document.
               */}
              <SecondaryButton
                label="Import my subscriptions"
                icon="repeat-variant"
                onPress={() => router.replace('/subscriptions')}
              />
              <Pressable onPress={() => setStep('type')} style={styles.link}>
                <ThemedText type="small" themeColor="textTertiary">
                  Enter it myself
                </ThemedText>
              </Pressable>
            </View>
          )}

          {/* Only worth mentioning once the end is actually in sight. */}
          {!settings.premium && scansLeft <= 3 && (
            <ThemedText type="small" themeColor="textTertiary" style={styles.centeredText}>
              {scansLeft === 0
                ? 'No free scans left. Typing a date in is still free.'
                : `${scansLeft} free ${scansLeft === 1 ? 'scan' : 'scans'} left.`}
            </ThemedText>
          )}
        </ScrollView>
      </ThemedView>
    );
  }

  if (step === 'type') {
    return (
      <ThemedView style={styles.container}>
        <ScrollView contentContainerStyle={styles.typeGridContent}>
          {error && <ErrorNote message={error} />}
          <ThemedText type="label" themeColor="textTertiary" style={styles.sectionLabel}>
            What are you tracking?
          </ThemedText>
          <View style={styles.typeList}>
            {DOCUMENT_TYPES.map((t) => (
              <Pressable key={t.id} onPress={() => pickType(t)} accessibilityRole="button">
                {({ pressed }) => (
                  <View
                    style={[
                      styles.typeRow,
                      { borderBottomColor: theme.border },
                      pressed && styles.dim,
                    ]}>
                    <ThemedText type="ledgerTitle" style={styles.flex}>
                      {labelFor(t, settings.country)}
                    </ThemedText>
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={20}
                      color={theme.textTertiary}
                    />
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
        {renewing && (
          <Note text="Date moved forward by the usual period. Check it against the new document." />
        )}
        {scanNote && <Note text={scanNote} />}
        {error && <ErrorNote message={error} />}

        <Field label="Name">
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={labelFor(type!, settings.country)}
            placeholderTextColor={theme.textTertiary}
            style={[styles.titleInput, { color: theme.text, borderBottomColor: theme.textTertiary }]}
          />
        </Field>

        <Field label="Category">
          <Pressable onPress={() => !editing && setStep('type')} disabled={!!editing}>
            <View style={[styles.ruledRow, { borderBottomColor: theme.border }]}>
              <ThemedText type="fieldValue" style={styles.flex}>
                {labelFor(type!, settings.country)}
              </ThemedText>
              {!editing && (
                <ThemedText type="smallBold" style={{ color: theme.accent }}>
                  Change
                </ThemedText>
              )}
            </View>
          </Pressable>
        </Field>

        <Field label="Expires">
          <View style={[styles.ruledRow, { borderBottomColor: theme.border }]}>
            {/*
              * Blank rather than plausible. A date nobody chose, printed in the
              * same type as one they did, is indistinguishable from an answer.
              */}
            <ThemedText
              type="fieldValue"
              themeColor={dateChosen ? 'text' : 'textTertiary'}
              style={styles.flex}>
              {dateChosen ? longDate(toISODate(expiry)) : 'Not set yet'}
            </ThemedText>
            {Platform.OS === 'ios' ? (
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
                onPress={() => (Platform.OS === 'android' ? setShowAndroidPicker(true) : null)}
                accessibilityRole="button"
                accessibilityLabel="Change the date">
                <MaterialCommunityIcons
                  name="calendar-blank-outline"
                  size={18}
                  color={theme.textSecondary}
                />
              </Pressable>
            )}
          </View>
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
          {Platform.OS === 'web' && (
            <TextInput
              value={toISODate(expiry)}
              onChangeText={(next) => {
                const parsed = new Date(`${next}T00:00:00`);
                if (/^\d{4}-\d{2}-\d{2}$/.test(next) && !Number.isNaN(parsed.getTime())) {
                  setExpiry(parsed);
                  setDateChosen(true);
                }
              }}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.textTertiary}
              style={[styles.webDate, { color: theme.textSecondary }]}
            />
          )}
        </Field>

        <Field label="Whose is it">
          <View style={styles.chipRow}>
            <Chip
              label={settings.ownName || 'Mine'}
              active={!owner}
              onPress={() => {
                setOwner('');
                setNamingOwner(false);
              }}
            />
            {knownOwners.map((name) => (
              <Chip
                key={name}
                label={name}
                active={owner === name}
                onPress={() => { setOwner(name); setNamingOwner(false); }}
              />
            ))}
            <Chip label="+ Someone new" active={namingOwner} onPress={() => setNamingOwner(true)} />
          </View>
          {namingOwner && (
            <TextInput
              value={owner}
              onChangeText={setOwner}
              placeholder="Their name"
              placeholderTextColor={theme.textTertiary}
              autoFocus
              style={[styles.ruledInput, { color: theme.text, borderBottomColor: theme.border }]}
            />
          )}
        </Field>

        {numberField && (
          <Field label={`${numberField.label} · optional`}>
            <TextInput
              value={documentNumber}
              onChangeText={setDocumentNumber}
              placeholder={numberField.placeholder}
              placeholderTextColor={theme.textTertiary}
              autoCapitalize="characters"
              style={[styles.ruledInput, { color: theme.text, borderBottomColor: theme.border }]}
            />
          </Field>
        )}

        <Field
          label={
            files.length > 1
              ? `Attachments · ${files.length}`
              : type!.id === 'emirates-id' || type!.id === 'driving-license'
                ? 'Attachments · both sides if you like'
                : 'Attachment'
          }>
          <View style={styles.thumbRow}>
            {files.map((file) => (
              <Pressable
                key={file.key}
                accessibilityRole="button"
                accessibilityLabel="Remove this attachment"
                onLongPress={() => setFiles((c) => c.filter((f) => f.key !== file.key))}>
                <View>
                  {file.type === 'pdf' ? (
                    <View style={[styles.thumb, { borderColor: theme.border }]}>
                      <MaterialCommunityIcons
                        name="file-pdf-box"
                        size={20}
                        color={theme.textSecondary}
                      />
                    </View>
                  ) : (
                    <Image
                      source={{ uri: file.uri }}
                      style={[styles.thumb, { borderColor: theme.border }]}
                      resizeMode="cover"
                    />
                  )}
                  <Pressable
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Remove"
                    onPress={() => setFiles((c) => c.filter((f) => f.key !== file.key))}
                    style={[styles.removeBadge, { backgroundColor: theme.background }]}>
                    <MaterialCommunityIcons
                      name="close-circle"
                      size={18}
                      color={theme.textTertiary}
                    />
                  </Pressable>
                </View>
              </Pressable>
            ))}

            <Pressable
              onPress={() => addAttachment('camera')}
              accessibilityRole="button"
              accessibilityLabel="Take a photo">
              <View style={[styles.addThumb, { borderColor: theme.border }]}>
                <MaterialCommunityIcons name="camera-outline" size={18} color={theme.textSecondary} />
              </View>
            </Pressable>
            <Pressable
              onPress={() => addAttachment('files')}
              accessibilityRole="button"
              accessibilityLabel="Choose a file">
              <View style={[styles.addThumb, { borderColor: theme.border }]}>
                <MaterialCommunityIcons
                  name="folder-open-outline"
                  size={18}
                  color={theme.textSecondary}
                />
              </View>
            </Pressable>
          </View>
          <ThemedText type="small" themeColor="textTertiary">
            {files.length === 0 ? 'Nothing attached yet.' : 'Kept on this phone only.'}
          </ThemedText>
        </Field>

        <Field label="Remind me before">
          {/*
            * Four to a row, every chip the same width, every label in the same
            * grammar. It was a wrap that ran out wherever it happened to, with
            * the first option labelled "1 day", the last "180 days" and the
            * middle six as bare numbers.
            */}
          <View style={styles.leadGrid}>
            {LEAD_DAY_OPTIONS.map((day) => (
              <Chip
                key={day}
                label={leadLabel(day)}
                active={leadDays.includes(day)}
                onPress={() => toggleLeadDay(day)}
                style={styles.leadChip}
                tight
              />
            ))}
          </View>
          <ThemedText type="small" themeColor="textTertiary">
            {nudgeSummary}
          </ThemedText>
        </Field>

        {showNotes ? (
          <Field label="Notes">
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Anything to remember"
              placeholderTextColor={theme.textTertiary}
              multiline
              style={[
                styles.ruledInput,
                styles.notes,
                { color: theme.text, borderBottomColor: theme.border },
              ]}
            />
          </Field>
        ) : (
          <Pressable onPress={() => setShowNotes(true)}>
            <ThemedText type="small" themeColor="textTertiary">
              + Add a note
            </ThemedText>
          </Pressable>
        )}

        <PrimaryButton
          label={editing ? 'Save' : 'Start tracking'}
          onPress={save}
          disabled={!title.trim() || saving}
        />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  dim: { opacity: 0.6 },
  centered: { alignItems: 'center', justifyContent: 'center', gap: Spacing.three, padding: Spacing.five },
  centeredText: { textAlign: 'center' },
  moreRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  moreWays: { gap: Spacing.two, width: '100%' },
  // An explicit width, so the button fills the column instead of shrinking to
  // its label. Not alignSelf: 'stretch' — that would override the centring.
  wallAction: { width: '100%', maxWidth: MaxContentWidth },
  link: { alignItems: 'center', paddingVertical: Spacing.three },
  chooseContent: { padding: 28, gap: Spacing.three, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center' },
  chooseIcon: { alignItems: 'center', marginTop: Spacing.five, marginBottom: Spacing.two },
  typeGridContent: { padding: 28, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center' },
  sectionLabel: { marginBottom: Spacing.three },
  typeList: { gap: 0 },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  formContent: {
    padding: 28,
    gap: 26,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  /*
    * The document's own name, set large on a ruled line. Semibold rather than
    * bold: it is a field somebody is typing into, and the heaviest weight in
    * the app on an empty input reads as a warning.
    */
  titleInput: {
    ...Fonts.strong,
    fontSize: 26,
    letterSpacing: -0.3,
    lineHeight: 32,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  ruledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  ruledInput: {
    ...Fonts.body,
    fontSize: 17,
    lineHeight: 24,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  webDate: { ...Fonts.body, fontSize: 13, paddingTop: 6 },
  notes: { minHeight: 60, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  /*
   * Four columns on any phone. The basis is a percentage so the count does not
   * change with the screen, and every chip grows into the remainder equally so
   * the rows line up rather than trailing off.
   */
  leadGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  leadChip: { flexGrow: 1, flexBasis: '21%' },
  thumbRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, alignItems: 'center' },
  thumb: {
    width: 56,
    height: 40,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addThumb: {
    width: 56,
    height: 40,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBadge: { position: 'absolute', top: -7, right: -7, borderRadius: 9 },
});
