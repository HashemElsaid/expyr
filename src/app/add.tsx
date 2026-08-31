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

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { DOCUMENT_TYPES, getDocumentType } from '@/data/document-types';
import { orderForPersona } from '@/data/personas';
import { RENEWAL_PERIOD_DAYS } from '@/data/renewal-actions';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { countWord, dayMonth, longDate, shortDate, toISODate } from '@/lib/dates';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { newAttachmentKey } from '@/lib/files';
import { attachFile, pickDocument, pickImage, scanFile, type ScanResult } from '@/lib/scan';
import { useDocuments } from '@/store/documents';
import { FREE_ITEM_LIMIT, useSettings } from '@/store/settings';
import { Attachment, DocumentType, DocumentTypeId, TrackedDocument } from '@/types';

type Step = 'choose' | 'type' | 'form';

const LEAD_DAY_OPTIONS = [1, 3, 7, 14, 30, 60, 90, 180];

export default function AddDocumentScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const theme = useTheme();
  const scheme = useColorScheme();
  const { documents, addDocument, updateDocument } = useDocuments();
  const { settings } = useSettings();
  const params = useLocalSearchParams<{ id?: string; renew?: string }>();

  const editing = params.id ? documents.find((d) => d.id === params.id) : undefined;
  const renewing = params.renew === '1' && !!editing;
  const overFreeLimit = !editing && !settings.premium && documents.length >= FREE_ITEM_LIMIT;

  const [step, setStep] = useState<Step>(editing ? 'form' : 'choose');
  const [typeId, setTypeId] = useState<DocumentTypeId | null>(editing?.typeId ?? null);
  const [title, setTitle] = useState(editing?.title ?? '');
  const [expiry, setExpiry] = useState<Date>(() =>
    editing ? startingExpiry(editing, params.renew === '1') : defaultExpiry()
  );
  const [documentNumber, setDocumentNumber] = useState(editing?.documentNumber ?? '');
  const [owner, setOwner] = useState(editing?.owner ?? '');
  const [namingOwner, setNamingOwner] = useState(false);
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [showNotes, setShowNotes] = useState(Boolean(editing?.notes));
  const [files, setFiles] = useState<Attachment[]>(editing?.files ?? []);
  const [leadDays, setLeadDays] = useState<number[]>(editing?.leadDays ?? []);
  const [busy, setBusy] = useState<'scanning' | 'attaching' | null>(null);
  const [scanNote, setScanNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: renewing ? 'Renewed' : editing ? 'Edit' : 'New entry' });
  }, [navigation, editing, renewing]);

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

  const knownOwners = useMemo(
    () => [...new Set(documents.map((d) => d.owner).filter((o): o is string => !!o))].slice(0, 5),
    [documents]
  );

  /** The actual dates the reminders will arrive — more useful than day counts. */
  const nudgeSummary = useMemo(() => {
    if (leadDays.length === 0) return 'No reminders — you will not be warned.';
    const dates = [...leadDays]
      .sort((a, b) => b - a)
      .map((lead) => {
        const d = new Date(expiry);
        d.setDate(d.getDate() - lead);
        return dayMonth(d);
      });
    return `${countWord(leadDays.length)} nudge${leadDays.length === 1 ? '' : 's'}: ${dates.join(', ')} — each at 9am.`;
  }, [leadDays, expiry]);

  function applyScan(result: ScanResult, scannedUri: string, scannedKind: 'image' | 'pdf') {
    const scannedType = getDocumentType(result.typeId);
    setTypeId(result.typeId);
    setTitle(result.title || scannedType.label);
    if (result.expiryDate) {
      const parsed = new Date(`${result.expiryDate}T00:00:00`);
      if (!Number.isNaN(parsed.getTime())) setExpiry(parsed);
    }
    setDocumentNumber(scannedType.numberField ? result.documentNumber : '');
    setLeadDays(scannedType.defaultLeadDays);
    setFiles([{ uri: scannedUri, type: scannedKind, key: newAttachmentKey() }]);
    setScanNote(
      result.confidence === 'high' ? result.note : `${result.note} Check the date before saving.`
    );
    setStep('form');
  }

  async function runScan(source: 'camera' | 'library' | 'files') {
    setError(null);
    try {
      const picked = source === 'files' ? await pickDocument() : await pickImage(source);
      if (!picked) return;
      setBusy('scanning');
      const { result, fileUri: scannedUri } = await scanFile(picked);
      if (!result.found) {
        setError(result.note || 'No date found in that file.');
        setStep('type');
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
    const isAutoTitle =
      !title.trim() || DOCUMENT_TYPES.some((candidate) => candidate.label === title.trim());
    setTypeId(t.id);
    if (isAutoTitle) setTitle(t.label);
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
      return;
    }

    const created = await addDocument(draft);
    successFeedback();

    // The first item is the moment to show the promise being kept: the
    // countdown, the reminder dates and what renewing actually involves.
    if (isFirstItem) router.replace(`/document/${created.id}`);
    else router.back();
  }

  if (overFreeLimit) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ThemedText type="verdict">That is {FREE_ITEM_LIMIT}.</ThemedText>
        <ThemedText type="body" themeColor="textSecondary" style={styles.centeredText}>
          The free plan holds {FREE_ITEM_LIMIT} items. Unlock Renewly to track everything you own,
          and everyone in the house.
        </ThemedText>
        <PrimaryButton label="See the options" onPress={() => router.replace('/paywall')} />
        <Pressable onPress={() => router.back()} style={styles.link}>
          <ThemedText type="small" themeColor="textTertiary">
            Not now
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
            Show it to Renewly
          </ThemedText>
          <ThemedText type="body" themeColor="textSecondary" style={styles.centeredText}>
            A document, a screenshot, or a PDF. Renewly reads the date.
          </ThemedText>

          {error && <ErrorNote message={error} />}

          <PrimaryButton label="Take a photo" onPress={() => runScan('camera')} />
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

          <Pressable onPress={() => setStep('type')} style={styles.link}>
            <ThemedText type="small" themeColor="textTertiary">
              Enter it myself
            </ThemedText>
          </Pressable>
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
            {orderForPersona(DOCUMENT_TYPES, settings.persona).map((t) => (
              <Pressable key={t.id} onPress={() => pickType(t)} accessibilityRole="button">
                {({ pressed }) => (
                  <View
                    style={[
                      styles.typeRow,
                      { borderBottomColor: theme.border },
                      pressed && styles.dim,
                    ]}>
                    <ThemedText type="ledgerTitle" style={styles.flex}>
                      {t.label}
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
            placeholder={type!.label}
            placeholderTextColor={theme.textTertiary}
            style={[styles.serifInput, { color: theme.text, borderBottomColor: theme.textTertiary }]}
          />
        </Field>

        <Field label="Category">
          <Pressable onPress={() => !editing && setStep('type')} disabled={!!editing}>
            <View style={[styles.ruledRow, { borderBottomColor: theme.border }]}>
              <ThemedText type="fieldValue" style={styles.flex}>
                {type!.label}
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
            <ThemedText type="fieldValue" style={styles.flex}>
              {longDate(toISODate(expiry))}
            </ThemedText>
            {Platform.OS === 'ios' ? (
              <DateTimePicker
                value={expiry}
                mode="date"
                display="compact"
                themeVariant={scheme}
                accentColor={theme.accent}
                onChange={(_, date) => date && setExpiry(date)}
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
                if (date) setExpiry(date);
              }}
            />
          )}
          {Platform.OS === 'web' && (
            <TextInput
              value={toISODate(expiry)}
              onChangeText={(next) => {
                const parsed = new Date(`${next}T00:00:00`);
                if (/^\d{4}-\d{2}-\d{2}$/.test(next) && !Number.isNaN(parsed.getTime()))
                  setExpiry(parsed);
              }}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.textTertiary}
              style={[styles.webDate, { color: theme.textSecondary }]}
            />
          )}
        </Field>

        <Field label="Whose is it">
          <View style={styles.chipRow}>
            <Chip label="Mine" active={!owner} onPress={() => { setOwner(''); setNamingOwner(false); }} />
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

        {type!.numberField && (
          <Field label={`${type!.numberField.label} · optional`}>
            <TextInput
              value={documentNumber}
              onChangeText={setDocumentNumber}
              placeholder={type!.numberField.placeholder}
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
          <View style={styles.chipRow}>
            {LEAD_DAY_OPTIONS.map((day, i) => (
              <Chip
                key={day}
                label={i === 0 ? '1 day' : i === LEAD_DAY_OPTIONS.length - 1 ? '180 days' : String(day)}
                active={leadDays.includes(day)}
                onPress={() => toggleLeadDay(day)}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <ThemedText type="label" themeColor="textTertiary">
        {label}
      </ThemedText>
      {children}
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <View
        style={[
          styles.chip,
          {
            backgroundColor: active ? theme.accent : 'transparent',
            borderColor: active ? theme.accent : theme.border,
          },
        ]}>
        <ThemedText type="smallBold" style={active ? { color: theme.accentContrast } : undefined}>
          {label}
        </ThemedText>
      </View>
    </Pressable>
  );
}

function Note({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.note, { backgroundColor: theme.backgroundSelected }]}>
      <ThemedText type="small">{text}</ThemedText>
    </View>
  );
}

function ErrorNote({ message }: { message: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.note, { backgroundColor: theme.backgroundSelected }]}>
      <ThemedText type="small" style={{ color: theme.urgentStrong }}>
        {message}
      </ThemedText>
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button">
      {({ pressed }) => (
        <View
          style={[
            styles.primary,
            { backgroundColor: theme.accent },
            (pressed || disabled) && styles.dim,
          ]}>
          <ThemedText type="smallBold" style={{ color: theme.accentContrast }}>
            {label}
          </ThemedText>
        </View>
      )}
    </Pressable>
  );
}

function SecondaryButton({
  label,
  onPress,
  icon,
}: {
  label: string;
  onPress: () => void;
  icon?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {({ pressed }) => (
        <View style={[styles.secondary, { borderColor: theme.border }, pressed && styles.dim]}>
          {icon && (
            <MaterialCommunityIcons name={icon as never} size={17} color={theme.textSecondary} />
          )}
          <ThemedText type="smallBold">{label}</ThemedText>
        </View>
      )}
    </Pressable>
  );
}

function defaultExpiry(): Date {
  const d = new Date();
  d.setMonth(d.getMonth() + 6);
  return d;
}

/** The date the form opens on — rolled forward when marking something renewed. */
function startingExpiry(doc: TrackedDocument, renew: boolean): Date {
  const current = new Date(`${doc.expiryDate}T00:00:00`);
  if (!renew) return current;
  const period = RENEWAL_PERIOD_DAYS[doc.typeId] ?? 365;
  const base = current.getTime() > Date.now() ? current : new Date();
  const rolled = new Date(base);
  rolled.setDate(rolled.getDate() + period);
  return rolled;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  dim: { opacity: 0.6 },
  centered: { alignItems: 'center', justifyContent: 'center', gap: Spacing.three, padding: Spacing.five },
  centeredText: { textAlign: 'center' },
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
  note: { borderRadius: 12, paddingHorizontal: Spacing.three, paddingVertical: 12 },
  field: { gap: 6 },
  serifInput: {
    fontFamily: 'InstrumentSerif',
    fontSize: 26,
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
    fontFamily: 'DMSans',
    fontSize: 17,
    lineHeight: 24,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  webDate: { fontFamily: 'DMSans', fontSize: 13, paddingTop: 6 },
  notes: { minHeight: 60, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: 9,
  },
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
  primary: { borderRadius: Radius.pill, paddingVertical: Spacing.three, alignItems: 'center' },
  secondary: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.three,
  },
});
