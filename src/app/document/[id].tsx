import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import {
  hasReading,
  isReading,
  loadBrief,
  readDocumentFully,
  readsOnArrival,
  summariseDocument,
  type Brief,
  type ReadStage,
} from '@/lib/reading';
import { shareDocumentCopy } from '@/lib/share-copy';
import { hasGuidance } from '@/data/countries';
import { getDocumentType, numberFieldFor } from '@/data/document-types';
import { findBlockers, notesFor } from '@/data/prerequisites';
import { portalFor, whereFor } from '@/data/regions';
import { RENEWAL_PERIOD_DAYS } from '@/data/renewal-actions';
import { useTheme } from '@/hooks/use-theme';
import { useUrgency } from '@/hooks/use-urgency';
import { dayMonth, daysUntil, longDate, shortDate, verdictPhrase } from '@/lib/dates';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { useDocuments } from '@/store/documents';
import { FREE_READ_LIMIT, useSettings } from '@/store/settings';
import { TrackedDocument } from '@/types';

/** Reminder dates derived from the schedule — no extra state to keep in sync. */
function reminderDates(doc: TrackedDocument) {
  const expiry = new Date(`${doc.expiryDate}T09:00:00`);
  return [...doc.leadDays]
    .sort((a, b) => b - a)
    .map((lead) => {
      const date = new Date(expiry);
      date.setDate(date.getDate() - lead);
      return { lead, date, past: date.getTime() < Date.now() };
    });
}

export default function DocumentDetailScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { documents, archived, removeDocument, setArchived } = useDocuments();
  const { settings, update } = useSettings();
  const [guideOpen, setGuideOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [readable, setReadable] = useState(false);
  const [stage, setStage] = useState<ReadStage | null>(null);
  const [pointsOpen, setPointsOpen] = useState(false);
  const outOfReads = !settings.premium && settings.readsUsed >= FREE_READ_LIMIT;

  const doc = [...documents, ...archived].find((d) => d.id === id);
  const days = doc ? daysUntil(doc.expiryDate) : 0;
  const { color } = useUrgency(days);

  function confirmDelete() {
    if (!doc) return;
    const remove = async () => {
      await removeDocument(doc.id);
      router.back();
    };
    if (Platform.OS === 'web') {
      remove();
      return;
    }
    Alert.alert('Stop tracking?', `“${doc.title}” and its reminders will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: remove },
    ]);
  }

  async function toggleArchive() {
    if (!doc) return;
    await setArchived(doc.id, !doc.archivedAt);
    successFeedback();
    if (!doc.archivedAt) router.back();
  }

  // Secondary actions live behind the ⋯ so the screen stays calm.
  function openMenu() {
    if (!doc) return;
    tapFeedback();
    const archiveLabel = doc.archivedAt ? 'Move back to my items' : 'Archive';
    // Sending a copy of a passport or licence is a routine errand here.
    const first = doc.files[0];

    const actions: { label: string; run: () => void; destructive?: boolean }[] = [
      ...(first ? [{ label: 'Share a copy', run: () => openAttachment(first.uri, first.type) }] : []),
      { label: 'Edit details', run: () => router.push(`/add?id=${doc.id}`) },
      { label: archiveLabel, run: toggleArchive },
      { label: 'Delete permanently', run: confirmDelete, destructive: true },
    ];

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...actions.map((a) => a.label), 'Cancel'],
          destructiveButtonIndex: actions.findIndex((a) => a.destructive),
          cancelButtonIndex: actions.length,
        },
        (index) => actions[index]?.run()
      );
      return;
    }
    Alert.alert(doc.title, undefined, [
      ...actions.map((a) => ({
        text: a.label,
        style: a.destructive ? ('destructive' as const) : undefined,
        onPress: a.run,
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  }

  useEffect(() => {
    navigation.setOptions({
      title: '',
      headerRight: () => (
        <Pressable
          onPress={openMenu}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="More actions">
          <MaterialCommunityIcons name="dots-horizontal" size={24} color={theme.textSecondary} />
        </Pressable>
      ),
    });
    // Re-bind when the document or theme changes so the handler stays current.
  }, [navigation, doc, theme.textSecondary]);

  /*
   * Above the early return below, because documents load a moment after the
   * screen mounts. A hook placed after it runs on some renders and not others,
   * which React refuses outright.
   */
  useEffect(() => {
    if (!doc) return;
    setBrief(loadBrief(doc.id));
    setReadable(hasReading(doc.id));

    /*
     * Reading normally starts the moment a contract is saved. Picking it up
     * again here covers the times that did not finish: the app was closed too
     * soon, the network was gone, the phone suspended the work. Joining an
     * attempt already running costs nothing, so this is safe to run on arrival.
     */
    const first = doc.files[0];
    if (!first || !readsOnArrival(doc.typeId) || loadBrief(doc.id)) return;

    /*
     * A read already running was started by the screen that saved the document,
     * and that screen counts it. Join it rather than bailing out, so the brief
     * arrives here when it finishes instead of leaving this sitting on
     * "reading it" until the screen is opened again.
     */
    const joined = isReading(doc.id);
    // An already-read document costs nothing to revisit; a new one does.
    const fresh = !hasReading(doc.id);
    if (!joined && !settings.premium && fresh && settings.readsUsed >= FREE_READ_LIMIT) return;

    let live = true;
    readDocumentFully(doc.id, first, (s) => live && setStage(s))
      .then((result) => {
        if (!live) return;
        setReadable(true);
        setBrief(result.brief);
        if (!settings.premium && fresh && !joined) update({ readsUsed: settings.readsUsed + 1 });
      })
      .catch(() => {
        // Offered as a button instead, rather than an alert nobody asked for.
      })
      .finally(() => live && setStage(null));

    return () => {
      live = false;
    };
  }, [doc?.id]);

  if (!doc) return <ThemedView style={styles.container} />;

  const type = getDocumentType(doc.typeId);
  /*
   * Every step, cost, fine and prerequisite in the app was checked against UAE
   * sources. Shown to someone in Doha they would be confident and wrong, so
   * outside the UAE the whole advisory half of this screen stays shut and the
   * tracker half — verdict, runway, reminders, actions — carries on as normal.
   */
  const guided = hasGuidance(settings.country);
  // The right authority depends on which emirate the user actually lives in.
  const portal = guided ? portalFor(doc.typeId, settings.emirate) : undefined;
  const where = whereFor(doc.typeId, settings.emirate) ?? type.guide.where;
  const canRoll = RENEWAL_PERIOD_DAYS[doc.typeId] !== undefined;
  const period = RENEWAL_PERIOD_DAYS[doc.typeId];
  const reminders = reminderDates(doc);
  const blockers = guided ? findBlockers(doc, documents) : [];
  const notes = guided ? notesFor(doc.typeId) : [];
  const fired = reminders.filter((r) => r.past);
  const next = reminders.find((r) => !r.past);

  function markRenewed() {
    tapFeedback();
    router.push(canRoll ? `/add?id=${doc!.id}&renew=1` : `/add?id=${doc!.id}`);
  }

  async function readDocument() {
    if (!doc || stage) return;
    const first = doc.files[0];
    if (!first) return;
    tapFeedback();
    // Only a document being read for the first time spends one of the free reads.
    const fresh = !hasReading(doc.id);
    try {
      const result = await readDocumentFully(doc.id, first, setStage);
      setReadable(true);
      setBrief(result.brief);
      if (!settings.premium && fresh) update({ readsUsed: settings.readsUsed + 1 });
      successFeedback();
    } catch (error) {
      Alert.alert(
        'Could not read that',
        error instanceof Error ? error.message : 'Something went wrong.'
      );
    } finally {
      setStage(null);
    }
  }

  async function retrySummary() {
    if (!doc || stage) return;
    tapFeedback();
    setStage('summarising');
    try {
      setBrief(await summariseDocument(doc.id));
      successFeedback();
    } catch (error) {
      Alert.alert(
        'Could not summarise it',
        error instanceof Error ? error.message : 'Something went wrong.'
      );
    } finally {
      setStage(null);
    }
  }

  async function sendCopy() {
    if (!doc || sending) return;
    tapFeedback();
    setSending(true);
    const outcome = await shareDocumentCopy(doc.files, doc.title);
    setSending(false);
    if (outcome.ok) return;
    Alert.alert(
      'Could not prepare the copy',
      outcome.reason === 'nothing-to-send'
        ? 'Attach a photo of this document first, then it can be sent as a PDF.'
        : 'Something went wrong building the PDF. Try again.'
    );
  }

  function openPortal() {
    if (!portal) return;
    tapFeedback();
    Linking.openURL(portal.url).catch(() =>
      Alert.alert('Could not open', `Visit ${portal.url} in your browser.`)
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { borderBottomColor: theme.border }]}>
          <ThemedText type="display" style={[styles.verdict, { color }]}>
            {verdictPhrase(days)}
          </ThemedText>
          <ThemedText type="body" themeColor="textSecondary">
            {doc.title} expires {longDate(doc.expiryDate)}.
          </ThemedText>

          {period && (
            <View style={styles.runway}>
              <View style={[styles.runwayLine, { backgroundColor: theme.border }]} />
              {reminders.map((r) => {
                const elapsed = (period - r.lead) / period;
                if (elapsed < 0 || elapsed > 1) return null;
                return (
                  <View
                    key={r.lead}
                    style={[
                      styles.tick,
                      { backgroundColor: theme.textTertiary, left: `${Math.round(elapsed * 100)}%` },
                    ]}
                  />
                );
              })}
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: color,
                    left: `${Math.round(Math.min(1, Math.max(0, (period - days) / period)) * 100)}%`,
                  },
                ]}
              />
            </View>
          )}

          {/*
           * Every warning date, not just the next one. The whole promise of the
           * app is "you will be told in time", and the only way to believe that
           * is to see the dates it will happen on.
           */}
          {reminders.length === 0 ? (
            <ThemedText type="label" themeColor="textTertiary">
              No reminders set
            </ThemedText>
          ) : (
            <View style={styles.reminderRow}>
              {reminders.map((r) => (
                <ThemedText
                  key={r.lead}
                  type="label"
                  themeColor={r.past ? 'textTertiary' : 'textSecondary'}
                  style={r.past && styles.sent}>
                  {dayMonth(r.date)}
                </ThemedText>
              ))}
              <ThemedText type="label" themeColor="textTertiary">
                {fired.length === reminders.length
                  ? '· all sent'
                  : fired.length
                    ? `· ${fired.length} sent`
                    : '· none sent yet'}
              </ThemedText>
            </View>
          )}
        </View>

        {doc.files.length > 0 && (
          <View style={[styles.fileRow, { borderBottomColor: theme.border }]}>
            {doc.files.map((file) => (
              <Pressable
                key={file.key}
                accessibilityRole="button"
                accessibilityLabel={file.type === 'pdf' ? 'Open the PDF' : 'Open the photo'}
                onPress={() => openAttachment(file.uri, file.type)}>
                {({ pressed }) =>
                  file.type === 'pdf' ? (
                    <View
                      style={[styles.thumb, { borderColor: theme.border }, pressed && styles.dim]}>
                      <MaterialCommunityIcons
                        name="file-pdf-box"
                        size={20}
                        color={theme.textSecondary}
                      />
                    </View>
                  ) : (
                    <Image
                      source={{ uri: file.uri }}
                      style={[styles.thumb, { borderColor: theme.border }, pressed && styles.dim]}
                      resizeMode="cover"
                    />
                  )
                }
              </Pressable>
            ))}
            <ThemedText type="small" themeColor="textTertiary" style={styles.flex}>
              Kept on this phone · tap to open
            </ThemedText>
          </View>
        )}

        {(doc.documentNumber || doc.notes) && (
          <View style={styles.plainRows}>
            {doc.documentNumber && (
              <DataRow
                label={numberFieldFor(type, settings.country)?.label ?? 'Number'}
                value={doc.documentNumber}
              />
            )}
            {doc.notes && <DataRow label="Notes" value={doc.notes} />}
          </View>
        )}

        {blockers.length > 0 && (
          <View style={[styles.blocker, { borderColor: theme.urgentSoft }]}>
            <MaterialCommunityIcons name="alert-outline" size={18} color={theme.urgentSoft} />
            <View style={styles.flex}>
              <ThemedText type="bodyMedium" style={{ color: theme.urgentSoft }}>
                Do this first
              </ThemedText>
              {blockers.map(({ rule, blocking }) => (
                <ThemedText key={rule.requires} type="small" themeColor="textSecondary">
                  {rule.warning} Yours expires {shortDate(blocking.expiryDate)}.
                </ThemedText>
              ))}
            </View>
          </View>
        )}

        {/* The penalty is the reason to act today, so it never hides. */}
        {guided && type.guide.lateFee !== '' && (
          <View style={styles.lateRow}>
            <ThemedText type="label" themeColor="textTertiary">
              If you leave it
            </ThemedText>
            <ThemedText type="body" style={{ color: theme.urgentSoft }}>
              {type.guide.lateFee}
            </ThemedText>
          </View>
        )}

        {/*
         * Everything below is a tutorial. Someone renewing their third Mulkiya
         * does not need it, so it stays folded until asked for.
         */}
        {/*
         * What this particular piece of paper says, which matters more than the
         * generic renewal guidance below it. Almost nobody reads what they sign.
         */}
        {/*
         * The allowance is spent and this document has never been read. This is
         * the moment the feature is worth paying for, so it says what it would
         * do rather than hiding that anything exists.
         */}
        {doc.files.length > 0 && !brief && !readable && outOfReads && (
          <Pressable onPress={() => router.push('/paywall')} accessibilityRole="button">
            {({ pressed }) => (
              <View
                style={[styles.readPrompt, { borderColor: theme.border }, pressed && styles.dim]}>
                <MaterialCommunityIcons name="text-search" size={20} color={theme.textTertiary} />
                <View style={styles.flex}>
                  <ThemedText type="bodyMedium">Read this document</ThemedText>
                  <ThemedText type="small" themeColor="textTertiary">
                    You have read your {FREE_READ_LIMIT} free documents. Unlock Expyr to read the
                    rest and ask them anything.
                  </ThemedText>
                </View>
              </View>
            )}
          </Pressable>
        )}

        {doc.files.length > 0 && !brief && !(outOfReads && !readable) && (
          <Pressable
            onPress={readable ? retrySummary : readDocument}
            disabled={stage !== null}
            accessibilityRole="button">
            {({ pressed }) => (
              <View
                style={[
                  styles.readPrompt,
                  { borderColor: theme.border },
                  (pressed || stage !== null) && styles.dim,
                ]}>
                <MaterialCommunityIcons name="text-search" size={20} color={theme.accent} />
                <View style={styles.flex}>
                  <ThemedText type="bodyMedium">
                    {stage === 'transcribing'
                      ? 'Reading it…'
                      : stage === 'summarising'
                        ? 'Working out what it says…'
                        : readable
                          ? 'Summarise this document'
                          : 'Read this document'}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textTertiary">
                    {stage === 'transcribing'
                      ? 'A long contract can take half a minute. It only happens once.'
                      : stage === 'summarising'
                        ? 'Almost there.'
                        : readable
                          ? 'It has been read, but the summary did not finish. You can already ask it questions.'
                          : 'Find out what you agreed to, then ask it anything.'}
                  </ThemedText>
                </View>
              </View>
            )}
          </Pressable>
        )}

        {/*
         * Reading survived but summarising did not. The transcript is what
         * answers questions, so the feature is usable and should say so rather
         * than hiding behind a missing summary.
         */}
        {readable && !brief && stage === null && (
          <SecondaryAction
            icon="comment-question-outline"
            label="Ask about this document"
            onPress={() => router.push(`/ask?id=${doc.id}`)}
          />
        )}

        {brief && (
          <View style={styles.brief}>
            <View style={styles.sectionHeader}>
              <ThemedText type="label" themeColor="textTertiary">
                What this says
              </ThemedText>
              <View style={[styles.rule, { backgroundColor: theme.border }]} />
            </View>

            <ThemedText type="body" themeColor="textSecondary">
              {brief.summary}
            </ThemedText>

            {brief.watchOut.map((item) => (
              <View key={item.quote} style={styles.watchRow}>
                <MaterialCommunityIcons
                  name="alert-outline"
                  size={16}
                  color={theme.urgentSoft}
                  style={styles.watchIcon}
                />
                <ThemedText type="small" style={styles.flex}>
                  {item.detail}
                  {item.where ? (
                    <ThemedText type="small" themeColor="textTertiary">
                      {'  '}
                      {item.where}
                    </ThemedText>
                  ) : null}
                </ThemedText>
              </View>
            ))}

            {brief.points.length > 0 && (
              <Pressable
                onPress={() => setPointsOpen((open) => !open)}
                accessibilityRole="button">
                <ThemedText type="smallBold" style={{ color: theme.accent }}>
                  {pointsOpen
                    ? 'Hide the detail'
                    : `Everything else it says (${brief.points.length})`}
                </ThemedText>
              </Pressable>
            )}

            {pointsOpen &&
              brief.points.map((point) => (
                <View key={point.label} style={styles.pointRow}>
                  <ThemedText type="smallBold">{point.label}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {point.detail}
                  </ThemedText>
                  {point.where ? (
                    <ThemedText type="small" themeColor="textTertiary">
                      {point.where}
                    </ThemedText>
                  ) : null}
                </View>
              ))}

            <SecondaryAction
              icon="comment-question-outline"
              label="Ask about this document"
              onPress={() => router.push(`/ask?id=${doc.id}`)}
            />
          </View>
        )}

        {!guided && (
          <View style={styles.lateRow}>
            <ThemedText type="label" themeColor="textTertiary">
              How to renew
            </ThemedText>
            <ThemedText type="body" themeColor="textSecondary">
              Expyr has verified renewal steps for the UAE only. It will keep the date and remind
              you. It just will not guess at the procedure where you are.
            </ThemedText>
          </View>
        )}

        {guided && (
          <Pressable
            onPress={() => setGuideOpen((open) => !open)}
            accessibilityRole="button"
            accessibilityLabel={guideOpen ? 'Hide how to renew' : 'Show how to renew'}>
            <View style={styles.sectionHeader}>
              <ThemedText type="label" themeColor="textTertiary">
                How to renew
              </ThemedText>
              <View style={[styles.rule, { backgroundColor: theme.border }]} />
              <MaterialCommunityIcons
                name={guideOpen ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={theme.textTertiary}
              />
            </View>
          </Pressable>
        )}

        {guided && guideOpen && (
          <View style={styles.guide}>
            {notes.length > 0 && (
              <View style={styles.notes}>
                {notes.map((note) => (
                  <ThemedText key={note} type="small" themeColor="textTertiary">
                    {note}
                  </ThemedText>
                ))}
              </View>
            )}

            <View style={styles.steps}>
              {type.guide.steps.map((step, i) => (
                <View key={i} style={styles.stepRow}>
                  <ThemedText
                    type="ledgerFigure"
                    themeColor="textTertiary"
                    style={styles.stepNumber}>
                    {i + 1}
                  </ThemedText>
                  <ThemedText type="body" style={styles.flex}>
                    {step}
                  </ThemedText>
                </View>
              ))}
            </View>

            {/* A blank means we have nothing to say, which beats a row saying so. */}
            {where !== '' && <DataRow label="Where" value={where} bordered />}
            {type.guide.typicalCost !== '' && (
              <DataRow label="Cost" value={type.guide.typicalCost} bordered />
            )}
            {type.guide.processingTime !== '' && (
              <DataRow label="Takes" value={type.guide.processingTime} bordered />
            )}

            <ThemedText type="small" themeColor="textTertiary" style={styles.disclaimer}>
              Figures are indicative, so confirm with the official channel.
            </ThemedText>
          </View>
        )}

        {doc.history && doc.history.length > 0 && (
          <DataRow
            label="Renewed"
            value={`${doc.history.length} time${doc.history.length === 1 ? '' : 's'} · last expired ${shortDate(doc.history[doc.history.length - 1])}`}
            bordered
          />
        )}

        <View style={styles.actions}>
          {portal ? (
            <>
              <PrimaryAction icon="open-in-new" label={`Renew at ${portal.name}`} onPress={openPortal} />
              <SecondaryAction
                icon="check-circle-outline"
                label="I have renewed this"
                onPress={markRenewed}
              />
            </>
          ) : (
            <PrimaryAction
              icon="check-circle-outline"
              label={canRoll ? 'I have renewed this' : 'Update the date'}
              onPress={markRenewed}
            />
          )}

          {/*
           * The thing people are actually asked for, far more often than they
           * are asked to renew anything.
           */}
          {doc.files.length > 0 && (
            <SecondaryAction
              icon="file-pdf-box"
              label={sending ? 'Preparing…' : 'Send a copy as PDF'}
              onPress={sendCopy}
            />
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

/** iOS Quick Look via the share sheet — no viewer dependency needed. */
async function openAttachment(uri: string, type?: 'image' | 'pdf') {
  try {
    const Sharing = await import('expo-sharing');
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(
        uri,
        type === 'pdf' ? { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' } : {}
      );
      return;
    }
  } catch {
    // Fall through to the alert below.
  }
  Alert.alert('Cannot open', 'This attachment could not be opened on this device.');
}

function DataRow({
  label,
  value,
  bordered,
}: {
  label: string;
  value: string;
  bordered?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.dataRow, bordered && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
      <ThemedText type="small" themeColor="textTertiary" style={styles.dataLabel}>
        {label}
      </ThemedText>
      <ThemedText type="body" style={styles.dataValue}>
        {value}
      </ThemedText>
    </View>
  );
}

function PrimaryAction({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {({ pressed }) => (
        <View
          style={[styles.primary, { backgroundColor: theme.accent }, pressed && styles.dim]}>
          <MaterialCommunityIcons name={icon as never} size={17} color={theme.accentContrast} />
          <ThemedText type="smallBold" style={{ color: theme.accentContrast }}>
            {label}
          </ThemedText>
        </View>
      )}
    </Pressable>
  );
}

function SecondaryAction({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {({ pressed }) => (
        <View style={[styles.secondary, pressed && styles.dim]}>
          <MaterialCommunityIcons name={icon as never} size={17} color={theme.textSecondary} />
          <ThemedText type="smallBold" themeColor="textSecondary">
            {label}
          </ThemedText>
        </View>
      )}
    </Pressable>
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
  flex: { flex: 1 },
  dim: { opacity: 0.6 },
  hero: { gap: 10, paddingBottom: 20, borderBottomWidth: StyleSheet.hairlineWidth },
  verdict: { fontSize: 52, lineHeight: 54 },
  readPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    marginTop: Spacing.three,
  },
  brief: { gap: Spacing.two, paddingTop: Spacing.three },
  watchRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  watchIcon: { marginTop: 2 },
  pointRow: { gap: 2, paddingTop: Spacing.two },
  reminderRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'baseline' },
  sent: { textDecorationLine: 'line-through' },
  runway: { height: 8, justifyContent: 'center' },
  runwayLine: { position: 'absolute', left: 0, right: 0, top: 3, height: 2 },
  tick: { position: 'absolute', top: 0, width: 1, height: 8 },
  dot: { position: 'absolute', top: 1, width: 6, height: 6, borderRadius: 3, marginLeft: -3 },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  thumb: {
    width: 56,
    height: 40,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plainRows: { paddingTop: Spacing.three, gap: Spacing.three },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.two,
  },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  blocker: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.medium,
    padding: Spacing.three,
    marginTop: Spacing.four,
  },
  lateRow: { gap: 3, paddingTop: Spacing.four },
  guide: { paddingTop: Spacing.two },
  notes: { gap: 4, paddingBottom: Spacing.three },
  disclaimer: { paddingTop: Spacing.three },
  steps: { gap: 14, paddingBottom: Spacing.three },
  stepRow: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-start' },
  stepNumber: { width: 22, fontSize: 24, lineHeight: 26 },
  dataRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.three, paddingVertical: 12 },
  dataLabel: { flexShrink: 0 },
  dataValue: { flex: 1, textAlign: 'right' },
  actions: { gap: Spacing.two, paddingTop: Spacing.four },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
  },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: 14,
  },
});
