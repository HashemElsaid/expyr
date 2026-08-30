import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { DocIcon } from '@/components/doc-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { DOCUMENT_TYPES, getDocumentType } from '@/data/document-types';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { toISODate } from '@/lib/dates';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { attachFile, pickDocument, pickImage, scanFile, type PickedFile, type ScanResult } from '@/lib/scan';
import { orderForPersona } from '@/data/personas';
import { RENEWAL_PERIOD_DAYS } from '@/data/renewal-actions';
import { useDocuments } from '@/store/documents';
import { FREE_ITEM_LIMIT, useSettings } from '@/store/settings';
import { DocumentType, DocumentTypeId } from '@/types';

type Step = 'choose' | 'type' | 'form';

/** Offered in the reminder editor; a document can use any combination. */
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
  /** Editing an existing item is never blocked, only adding a new one. */
  const overFreeLimit = !editing && !settings.premium && documents.length >= FREE_ITEM_LIMIT;

  const [step, setStep] = useState<Step>(editing ? 'form' : 'choose');
  const [typeId, setTypeId] = useState<DocumentTypeId | null>(editing?.typeId ?? null);
  const [title, setTitle] = useState(editing?.title ?? '');
  const [expiry, setExpiry] = useState<Date>(() => {
    if (!editing) return defaultExpiry();
    const current = new Date(`${editing.expiryDate}T00:00:00`);
    if (params.renew !== '1') return current;
    // Roll forward from whichever is later: today, or the old expiry.
    const period = RENEWAL_PERIOD_DAYS[editing.typeId] ?? 365;
    const base = current.getTime() > Date.now() ? current : new Date();
    const rolled = new Date(base);
    rolled.setDate(rolled.getDate() + period);
    return rolled;
  });
  const [documentNumber, setDocumentNumber] = useState(editing?.documentNumber ?? '');
  const [owner, setOwner] = useState(editing?.owner ?? '');
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [showNotes, setShowNotes] = useState(Boolean(editing?.notes));
  const [fileUri, setFileUri] = useState<string | undefined>(editing?.fileUri);
  const [fileType, setFileType] = useState<'image' | 'pdf' | undefined>(editing?.fileType);
  const [leadDays, setLeadDays] = useState<number[]>(editing?.leadDays ?? []);
  const [busy, setBusy] = useState<'scanning' | 'attaching' | null>(null);
  const [scanNote, setScanNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: renewing ? 'Renewed' : editing ? 'Edit' : 'Add' });
  }, [navigation, editing, renewing]);

  const type = useMemo(() => (typeId ? getDocumentType(typeId) : null), [typeId]);

  /** Names already in use, so the second family member is one tap. */
  const knownOwners = useMemo(
    () => [...new Set(documents.map((d) => d.owner).filter((o): o is string => !!o))].slice(0, 6),
    [documents]
  );

  function applyScan(result: ScanResult, scannedUri: string, scannedType_: 'image' | 'pdf') {
    const scannedType = getDocumentType(result.typeId);
    setTypeId(result.typeId);
    setTitle(result.title || scannedType.label);
    if (result.expiryDate) {
      const parsed = new Date(`${result.expiryDate}T00:00:00`);
      if (!Number.isNaN(parsed.getTime())) setExpiry(parsed);
    }
    setDocumentNumber(scannedType.numberField ? result.documentNumber : '');
    setLeadDays(scannedType.defaultLeadDays);
    setFileUri(scannedUri);
    setFileType(scannedType_);
    setScanNote(
      result.confidence === 'high'
        ? result.note
        : `${result.note} Please double-check the date before saving.`
    );
    setStep('form');
  }

  async function runScan(source: 'camera' | 'library' | 'files') {
    setError(null);
    try {
      const picked: PickedFile | null =
        source === 'files' ? await pickDocument() : await pickImage(source);
      if (!picked) return;
      setBusy('scanning');
      const { result, fileUri: scannedUri } = await scanFile(picked);
      if (!result.found) {
        setError(result.note || 'No expiry date was found in that file.');
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
      const picked: PickedFile | null =
        source === 'files' ? await pickDocument() : await pickImage(source);
      if (!picked) return;
      setBusy('attaching');
      setFileUri(await attachFile(picked));
      setFileType(picked.type);
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

  async function save() {
    if (!typeId || !title.trim() || saving) return;
    setSaving(true);
    const draft = {
      typeId,
      title: title.trim(),
      expiryDate: toISODate(expiry),
      documentNumber: documentNumber.trim() || undefined,
      notes: notes.trim() || undefined,
      owner: owner.trim() || undefined,
      fileUri,
      fileType,
      leadDays,
    };
    if (editing) {
      await updateDocument(editing.id, { ...draft, archivedAt: editing.archivedAt });
    } else {
      await addDocument(draft);
    }
    successFeedback();
    router.back();
  }

  if (overFreeLimit) {
    return (
      <ThemedView style={[styles.container, styles.centered, styles.limitPane]}>
        <MaterialCommunityIcons name="archive-outline" size={40} color={theme.textTertiary} />
        <ThemedText type="headline" style={styles.centeredText}>
          You have filled the free plan
        </ThemedText>
        <ThemedText type="body" themeColor="textSecondary" style={styles.centeredText}>
          Renewly tracks {FREE_ITEM_LIMIT} items free. Unlock it to keep adding — including
          documents for the rest of your family.
        </ThemedText>
        <PrimaryButton label="See the options" onPress={() => router.replace('/paywall')} />
        <Pressable onPress={() => router.back()} style={styles.manualLink}>
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
        <ThemedText type="smallBold" style={styles.centeredText}>
          {busy === 'scanning' ? 'Reading your document…' : 'Adding your photo…'}
        </ThemedText>
        {busy === 'scanning' && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
            This usually takes a few seconds.
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
            Just show it to Renewly
          </ThemedText>
          <ThemedText type="body" themeColor="textSecondary" style={styles.centeredText}>
            Photograph a document, a food label, or a screenshot — or upload a PDF like a tenancy
            contract. Renewly reads the date and fills everything in.
          </ThemedText>

          {error && <ErrorNote message={error} />}

          <PrimaryButton label="Take a photo" onPress={() => runScan('camera')} />
          <SecondaryButton
            label="Choose a photo or screenshot"
            icon="image-outline"
            onPress={() => runScan('library')}
          />
          <SecondaryButton
            label="Upload a PDF from Files"
            icon="folder-open-outline"
            onPress={() => runScan('files')}
          />

          <Pressable onPress={() => setStep('type')} style={styles.manualLink}>
            <ThemedText type="small" themeColor="textSecondary">
              Or enter the details myself
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
          <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
            What do you want to track?
          </ThemedText>
          <View style={styles.typeGrid}>
            {orderForPersona(DOCUMENT_TYPES, settings.persona).map((t) => (
              <Pressable key={t.id} onPress={() => pickType(t)} style={styles.typeCellWrap}>
                {({ pressed }) => (
                  <ThemedView
                    type={pressed ? 'backgroundSelected' : 'backgroundElement'}
                    style={[styles.typeCell, { borderColor: theme.border }]}>
                    <DocIcon typeId={t.id} size={34} />
                    <ThemedText type="smallBold" numberOfLines={2} style={styles.typeCellLabel}>
                      {t.label}
                    </ThemedText>
                  </ThemedView>
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
          <ThemedView type="backgroundElement" style={styles.scanNote}>
            <ThemedText type="small">
              We have moved the date forward by the usual period. Check it against your new document
              before saving.
            </ThemedText>
          </ThemedView>
        )}

        {scanNote && (
          <ThemedView type="backgroundElement" style={styles.scanNote}>
            <ThemedText type="small">✨ {scanNote}</ThemedText>
          </ThemedView>
        )}
        {error && <ErrorNote message={error} />}

        <Pressable onPress={() => !editing && setStep('type')} disabled={!!editing}>
          <ThemedView
            type="backgroundElement"
            style={[styles.typeSummary, { borderColor: theme.border }]}>
            <DocIcon typeId={type!.id} size={40} fileType={fileType} />
            <View style={{ flex: 1 }}>
              <ThemedText type="bodyMedium">{type!.label}</ThemedText>
              <ThemedText type="small" themeColor="textTertiary">
                Typical validity: {type!.typicalValidity}
              </ThemedText>
            </View>
            {!editing && (
              <ThemedText type="small" themeColor="textSecondary">
                Change
              </ThemedText>
            )}
          </ThemedView>
        </Pressable>

        <Field label="Name">
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={type!.label}
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
          />
        </Field>

        <Field label={type!.id === 'assignment' ? 'Due date' : 'Expiry date'}>
          {Platform.OS === 'ios' ? (
            <View style={styles.iosDateRow}>
              <DateTimePicker
                value={expiry}
                mode="date"
                // `compact` keeps the field legible; `inline` renders a washed-out
                // calendar against our warm background.
                display="compact"
                themeVariant={scheme}
                accentColor={theme.accent}
                onChange={(_, date) => date && setExpiry(date)}
              />
              <ThemedText type="small" themeColor="textTertiary" style={styles.flexOne}>
                {expiry.toLocaleDateString('en-GB', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </ThemedText>
            </View>
          ) : Platform.OS === 'android' ? (
            <AndroidDateField value={expiry} onChange={setExpiry} />
          ) : (
            <WebDateField value={expiry} onChange={setExpiry} />
          )}
        </Field>

        <Field label="Who is this for? (optional)">
          <TextInput
            value={owner}
            onChangeText={setOwner}
            placeholder="Leave blank for yourself"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
          />
          {knownOwners.length > 0 && (
            <View style={styles.chipRow}>
              {knownOwners.map((name) => (
                <Pressable key={name} onPress={() => setOwner(name)}>
                  <View style={[styles.chip, { borderColor: theme.border }]}>
                    <ThemedText type="smallBold">{name}</ThemedText>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </Field>

        {type!.numberField && (
          <Field label={`${type!.numberField.label} (optional)`}>
            <TextInput
              value={documentNumber}
              onChangeText={setDocumentNumber}
              placeholder={type!.numberField.placeholder}
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="characters"
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            />
          </Field>
        )}

        <Field label="Attachment">
          {fileUri ? (
            <View style={styles.photoRow}>
              {fileType === 'pdf' ? (
                <View style={[styles.pdfPreview, { borderColor: theme.border }]}>
                  <MaterialCommunityIcons
                    name="file-pdf-box"
                    size={34}
                    color={theme.textSecondary}
                  />
                </View>
              ) : (
                <Image source={{ uri: fileUri }} style={styles.photoPreview} resizeMode="cover" />
              )}
              <View style={styles.photoActions}>
                <ThemedText type="small" themeColor="textSecondary">
                  {fileType === 'pdf' ? 'PDF kept' : 'Photo kept'} privately on this device.
                </ThemedText>
                <Pressable onPress={() => addAttachment('files')}>
                  <ThemedText type="smallBold" style={{ color: theme.accent }}>
                    Replace
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setFileUri(undefined);
                    setFileType(undefined);
                  }}>
                  <ThemedText type="smallBold" style={{ color: theme.urgentStrong }}>
                    Remove
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.photoButtons}>
              <SecondaryButton
                label="Camera"
                icon="camera-outline"
                onPress={() => addAttachment('camera')}
                compact
              />
              <SecondaryButton
                label="Files"
                icon="folder-open-outline"
                onPress={() => addAttachment('files')}
                compact
              />
            </View>
          )}
        </Field>

        <Field label="Remind me before">
          <View style={styles.chipRow}>
            {LEAD_DAY_OPTIONS.map((day) => {
              const on = leadDays.includes(day);
              return (
                <Pressable key={day} onPress={() => toggleLeadDay(day)}>
                  <View
                    style={[
                      styles.chip,
                      {
                        backgroundColor: on ? theme.accent : 'transparent',
                        borderColor: on ? theme.accent : theme.border,
                      },
                    ]}>
                    <ThemedText
                      type="smallBold"
                      style={on ? { color: theme.accentContrast } : undefined}>
                      {day === 1 ? '1 day' : `${day} days`}
                    </ThemedText>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {leadDays.length === 0
              ? 'No reminders — you will not be warned before this expires.'
              : `${leadDays.length} reminder${leadDays.length > 1 ? 's' : ''}, each at 9am.`}
          </ThemedText>
        </Field>

        {showNotes ? (
          <Field label="Notes">
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Anything to remember for next time"
              placeholderTextColor={theme.textSecondary}
              multiline
              style={[
                styles.input,
                styles.notesInput,
                { color: theme.text, backgroundColor: theme.backgroundElement },
              ]}
            />
          </Field>
        ) : (
          <Pressable onPress={() => setShowNotes(true)}>
            <ThemedText type="small" themeColor="textSecondary">
              + Add a note
            </ThemedText>
          </Pressable>
        )}

        <PrimaryButton
          label={editing ? 'Save changes' : 'Start tracking'}
          onPress={save}
          disabled={!title.trim() || saving}
        />
      </ScrollView>
    </ThemedView>
  );
}

function AndroidDateField({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable onPress={() => setOpen(true)}>
        <ThemedView type="backgroundElement" style={styles.input}>
          <ThemedText>{value.toLocaleDateString('en-GB')}</ThemedText>
        </ThemedView>
      </Pressable>
      {open && (
        <DateTimePicker
          value={value}
          mode="date"
          display="default"
          onChange={(_, date) => {
            setOpen(false);
            if (date) onChange(date);
          }}
        />
      )}
    </>
  );
}

/** Browser fallback — the native picker has no web implementation. */
function WebDateField({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  const theme = useTheme();
  const [text, setText] = useState(toISODate(value));

  return (
    <TextInput
      value={text}
      onChangeText={(next) => {
        setText(next);
        const parsed = new Date(`${next}T00:00:00`);
        if (/^\d{4}-\d{2}-\d{2}$/.test(next) && !Number.isNaN(parsed.getTime())) onChange(parsed);
      }}
      placeholder="YYYY-MM-DD"
      placeholderTextColor={theme.textSecondary}
      style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
    />
  );
}

function ErrorNote({ message }: { message: string }) {
  const theme = useTheme();
  return (
    <ThemedView type="backgroundElement" style={styles.errorNote}>
      <ThemedText type="small" style={{ color: theme.urgentStrong }}>
        {message}
      </ThemedText>
    </ThemedView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      {children}
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
    <Pressable onPress={onPress} disabled={disabled}>
      {({ pressed }) => (
        <View
          style={[
            styles.primaryButton,
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
  compact,
  icon,
}: {
  label: string;
  onPress: () => void;
  compact?: boolean;
  icon?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={compact ? styles.flexOne : undefined}>
      {({ pressed }) => (
        <ThemedView
          type={pressed ? 'backgroundSelected' : 'backgroundElement'}
          style={[styles.secondaryButton, { borderColor: theme.border }]}>
          {icon && (
            <MaterialCommunityIcons name={icon as never} size={17} color={theme.textSecondary} />
          )}
          <ThemedText type="smallBold">{label}</ThemedText>
        </ThemedView>
      )}
    </Pressable>
  );
}

function defaultExpiry(): Date {
  const d = new Date();
  d.setMonth(d.getMonth() + 6);
  return d;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  limitPane: { padding: Spacing.five, gap: Spacing.three },
  centeredText: { textAlign: 'center' },
  flexOne: { flex: 1 },
  chooseContent: { padding: Spacing.four, gap: Spacing.three, alignItems: 'stretch' },
  chooseIcon: { alignItems: 'center', marginTop: Spacing.five, marginBottom: Spacing.two },
  manualLink: { alignItems: 'center', paddingVertical: Spacing.three },
  typeGridContent: { padding: Spacing.four },
  sectionLabel: { marginBottom: Spacing.three },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  typeCellWrap: { width: '48%', flexGrow: 1 },
  typeCell: {
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    justifyContent: 'space-between',
    // Fixed rather than content-driven, so two-line labels never make a taller box.
    height: 112,
  },
  typeCellLabel: { minHeight: 38 },
  formContent: { padding: Spacing.four, gap: Spacing.four },
  scanNote: { borderRadius: Radius.medium, padding: Spacing.three },
  errorNote: { borderRadius: Radius.medium, padding: Spacing.three },
  typeSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
  },
  field: { gap: Spacing.two },
  input: {
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 15,
  },
  notesInput: { minHeight: 80, textAlignVertical: 'top' },
  iosDateRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  photoRow: { flexDirection: 'row', gap: Spacing.three, alignItems: 'center' },
  photoPreview: { width: 88, height: 88, borderRadius: Radius.small },
  pdfPreview: {
    width: 88,
    height: 88,
    borderRadius: Radius.small,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoActions: { flex: 1, gap: Spacing.two },
  photoButtons: { flexDirection: 'row', gap: Spacing.two },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  primaryButton: {
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  secondaryButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.two,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  dim: { opacity: 0.6 },
});
