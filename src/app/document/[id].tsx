import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ActionMenu, MenuButton, PrimaryAction, SecondaryAction, type MenuAction } from '@/components/document/actions';
import { DataRow } from '@/components/document/data-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ValuePrompt } from '@/components/value-prompt';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { expiryVerb, isSubscription } from '@/domain/documents';
import { displayFields, withFieldValue } from '@/domain/fields';
import { provenanceNote, worthShowing } from '@/domain/renewal-guidance';
import { runningLateFee } from '@/domain/late-fee';
import { useDocumentReading } from '@/hooks/use-document-reading';
import { useRenewalGuidance } from '@/hooks/use-renewal-guidance';
import { shareDocumentCopy } from '@/lib/share-copy';
import { hasGuidance } from '@/data/countries';
import { getDocumentType, numberFieldFor } from '@/data/document-types';
import { findBlockers, notesFor } from '@/data/prerequisites';
import { portalFor, whereFor } from '@/data/regions';
import { RENEWAL_PERIOD_DAYS } from '@/data/renewal-actions';
import { useTheme } from '@/hooks/use-theme';
import { useUrgency } from '@/hooks/use-urgency';
import { buildRunway, spanLabel } from '@/domain/runway';
import { dayMonth, daysUntil, longDate, shortDate, verdictPhrase } from '@/lib/dates';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { useDocuments } from '@/store/documents';
import { useSettings } from '@/store/settings';
import { ExtractedField, TrackedDocument } from '@/types';

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
  const { documents, archived, removeDocument, setArchived, updateDocument } = useDocuments();
  const { settings } = useSettings();
  const [guideOpen, setGuideOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [pointsOpen, setPointsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  /**
   * The field being corrected, and what it is being corrected to.
   *
   * A very clear passport came back with its holder's name misspelled and
   * nothing in the app could change it. The form deliberately keeps these
   * read-only, which is right, because eleven text inputs would bury the
   * handful of things the app acts on. So the correcting happens here, where
   * there is room to read them.
   */
  const [editing, setEditing] = useState<ExtractedField | null>(null);
  const [draft, setDraft] = useState('');

  const doc = [...documents, ...archived].find((d) => d.id === id);
  /*
   * Reading, and the rule about which reads spend one of the free two, live in
   * their own hook — it was the most intricate thing this screen did and had
   * nothing to do with drawing it.
   */
  const { brief, readable, stage, progress, readNow, retrySummary, shortOfCredits } =
    useDocumentReading(doc);
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
    /*
     * Archiving is offered here rather than only in the menu above it.
     *
     * Deleting takes the photo of somebody's passport and everything read from
     * it, permanently, and the only other option was three taps away under a
     * different word. Somebody who has finished with a document almost always
     * means "archive" — they want it out of the list, not gone — and the moment
     * they are about to lose it is the moment to say so.
     */
    Alert.alert(
      'Stop tracking?',
      `Deleting “${doc.title}” also removes its photos and anything Expyr read from them. That cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Archive instead', onPress: toggleArchive },
        { text: 'Delete', style: 'destructive', onPress: remove },
      ]
    );
  }

  async function toggleArchive() {
    if (!doc) return;
    await setArchived(doc.id, !doc.archivedAt);
    successFeedback();
    if (!doc.archivedAt) router.back();
  }

  /*
   * Secondary actions live behind the ⋯ so the screen stays calm, and the menu
   * opens under the button that was pressed.
   *
   * This used to hand the job to ActionSheetIOS, which iOS now floats in the
   * middle of the screen rather than sliding up from the bottom — a long way
   * from the corner the finger is in, and nothing to do with the thing it acts
   * on. A small card in the corner is the whole of what was wanted.
   */
  const menuActions: MenuAction[] = doc
    ? [
        // Sending a copy of a passport or licence is a routine errand here.
        ...(doc.files[0]
          ? [
              {
                label: 'Share a copy',
                icon: 'tray-arrow-up',
                run: () => openAttachment(doc.files[0].uri, doc.files[0].type),
              },
            ]
          : []),
        {
          label: 'Edit details',
          icon: 'pencil-outline',
          run: () => router.push(`/add?id=${doc.id}`),
        },
        {
          label: doc.archivedAt ? 'Move back to my items' : 'Archive',
          icon: doc.archivedAt ? 'tray-full' : 'archive-outline',
          run: toggleArchive,
        },
        {
          label: 'Delete permanently',
          icon: 'delete-outline',
          run: confirmDelete,
          destructive: true,
        },
      ]
    : [];

  useEffect(() => {
    navigation.setOptions({
      title: '',
      headerRight: () => (
        <MenuButton
          onPress={() => {
            tapFeedback();
            setMenuOpen(true);
          }}
        />
      ),
    });
    // Re-bind when the document or theme changes so the handler stays current.
  }, [navigation, doc, theme.textSecondary]);

  /*
   * Above the early return, because hooks run on every render and one called
   * only when a document exists is one React refuses. It does nothing until the
   * section is opened, so an unopened guide costs no request.
   */
  const guideType = doc ? getDocumentType(doc.typeId) : null;
  const renewal = useRenewalGuidance({
    type: guideType,
    country: settings.country,
    // Renewal is run by the emirate here, and by the state or province elsewhere.
    region: settings.emirate ?? '',
    verifiedWhere:
      doc && guideType ? (whereFor(doc.typeId, settings.emirate) ?? guideType.guide.where) : '',
    /*
     * A subscription asks a different question, so it hands over what the
     * question is about: the service, not the category it was filed under.
     */
    subscription:
      doc && isSubscription(doc) ? { title: doc.title, iconDomain: doc.iconDomain } : undefined,
    enabled: guideOpen,
  });

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
  /*
   * What the delay has cost, for the documents whose fine the app has verified
   * as a daily rate. The rule about grace periods lives in the domain, with
   * tests — it is the one figure here about somebody's money.
   */
  const running = guided ? runningLateFee(days, type.guide) : null;
  // Everything the scan read that the screen does not already show elsewhere.
  const scanned = displayFields(doc);

  const canRoll = RENEWAL_PERIOD_DAYS[doc.typeId] !== undefined;
  const period = RENEWAL_PERIOD_DAYS[doc.typeId];
  const reminders = reminderDates(doc);
  const runway = buildRunway(days, doc.leadDays, period);
  const blockers = guided ? findBlockers(doc, documents) : [];
  const notes = guided ? notesFor(doc.typeId) : [];
  const fired = reminders.filter((r) => r.past);

  function markRenewed() {
    tapFeedback();
    router.push(canRoll ? `/add?id=${doc!.id}&renew=1` : `/add?id=${doc!.id}`);
  }

  /**
   * Writes one corrected field back.
   *
   * The whole document goes back through `updateDocument`, which is the only
   * way in: it rebuilds the record, keeps the attachments and stamps the time.
   * Spreading the document into it preserves the archive flag and the renewal
   * history, which are on the record rather than in the form.
   *
   * An emptied value removes the field. A scan that invented a row is the
   * other half of one that misread it, and there would otherwise be no way to
   * be rid of it.
   */
  async function saveField() {
    const target = editing;
    const next = draft;
    setEditing(null);
    if (!doc || !target) return;

    await updateDocument(doc.id, {
      ...doc,
      fields: withFieldValue(doc.fields ?? [], target, next),
    });
    successFeedback();
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

  function openSource(url: string) {
    tapFeedback();
    Linking.openURL(url).catch(() =>
      Alert.alert('Could not open', `Visit ${url} in your browser.`)
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
      <ActionMenu open={menuOpen} onClose={() => setMenuOpen(false)} actions={menuActions} />

      <ValuePrompt
        visible={editing !== null}
        title={editing?.label ?? ''}
        hint="As it is printed on the document. Clear it to remove the line."
        value={draft}
        placeholder={editing?.label}
        /*
         * Nothing is capitalised for them. These are copied off a document
         * character for character, and a name in a passport is upper case
         * while a policy number is whatever the insurer chose.
         */
        autoCapitalize="none"
        allowEmpty
        onChange={setDraft}
        onCancel={() => setEditing(null)}
        onSubmit={saveField}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { borderBottomColor: theme.border }]}>
          <ThemedText type="largeTitle" style={[styles.verdict, { color }]}>
            {verdictPhrase(days)}
          </ThemedText>
          <ThemedText type="body" themeColor="textSecondary">
            {/* It did not expire in the future, and a subscription never expires. */}
            {doc.title} {expiryVerb(doc, days < 0)} {longDate(doc.expiryDate)}.
          </ThemedText>

          {runway && (
            <View style={styles.runway}>
              {/*
                * Inset by the radius of the marker, so the marker still sits
                * whole inside the track on the day itself, when it is at 100%.
                */}
              <View style={styles.runwayTrack}>
                <View style={[styles.runwayRail, { backgroundColor: theme.border }]} />
                <View
                  style={[
                    styles.runwayFill,
                    { backgroundColor: color, width: `${runway.now * 100}%` },
                  ]}
                />
                {/*
                  * Only the warnings still ahead, so every mark here sits on
                  * the bare rail and means one thing: you will be told again
                  * on this day. The sent ones were punched through the filled
                  * part in the page colour and read as the screen tearing.
                  */}
                {runway.reminders.map((at, i) => (
                  <View
                    key={i}
                    style={[
                      styles.runwayNotch,
                      { backgroundColor: theme.textTertiary, left: `${at * 100}%` },
                    ]}
                  />
                ))}
                {/*
                  * The ring around the marker is the page colour, so wherever
                  * today has already passed a reminder the marker punches a
                  * clean hole through it rather than smudging into it.
                  */}
                <View
                  style={[
                    styles.runwayNow,
                    {
                      backgroundColor: color,
                      borderColor: theme.background,
                      left: `${runway.now * 100}%`,
                    },
                  ]}
                />
              </View>

              <View style={styles.runwayScale}>
                <ThemedText type="footnote" themeColor="textTertiary">
                  {spanLabel(runway)}
                </ThemedText>
                {/*
                  * Names the end of the axis rather than repeating the date,
                  * which the sentence two lines above has already given in
                  * full. A chart caption that echoes the paragraph over it is
                  * the second time somebody reads the same thing.
                  */}
                <ThemedText type="footnote" themeColor="textTertiary">
                  {doc.renewsEvery ? 'Renews' : 'Expires'}
                </ThemedText>
              </View>
            </View>
          )}

          {/*
           * Every warning date, not just the next one. The whole promise of the
           * app is "you will be told in time", and the only way to believe that
           * is to see the dates it will happen on.
           */}
          {reminders.length === 0 ? (
            <ThemedText type="footnote" themeColor="textTertiary">
              No reminders set
            </ThemedText>
          ) : (
            <View style={styles.reminderRow}>
              {reminders.map((r) => (
                <ThemedText
                  key={r.lead}
                  type="footnote"
                  themeColor={r.past ? 'textTertiary' : 'textSecondary'}
                  style={r.past && styles.sent}>
                  {dayMonth(r.date)}
                </ThemedText>
              ))}
              <ThemedText type="footnote" themeColor="textTertiary">
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
            <ThemedText type="footnote" themeColor="textTertiary" style={styles.flex}>
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
                /*
                 * Nobody looks up their Emirates ID number to admire it. It is
                 * being typed into a form on another screen, and reading it off
                 * one and typing it into the other is where the digits get
                 * transposed.
                 */
                copyable
              />
            )}
            {doc.notes && <DataRow label="Notes" value={doc.notes} />}
          </View>
        )}

        {/*
          * What the scan read, beyond the date.
          *
          * This is the half of the app that pays off today rather than in two
          * years: the name as printed, the policy number, who issued it, what
          * it costs. Numbers are copyable for the same reason the one above is
          * — they exist to be pasted into somebody else's form.
          */}
        {scanned.length > 0 && (
          <View>
            <View style={styles.sectionHeader}>
              <ThemedText type="footnote" themeColor="textTertiary">
                On the document
              </ThemedText>
              <View style={[styles.rule, { backgroundColor: theme.border }]} />
            </View>
            <View style={styles.plainRows}>
              {scanned.map((entry, index) => (
                <DataRow
                  key={`${entry.label}-${entry.value}`}
                  label={entry.label}
                  value={entry.value}
                  bordered={index > 0}
                  copyable={entry.kind === 'number' || entry.kind === 'money'}
                  onEdit={() => {
                    tapFeedback();
                    setDraft(entry.value);
                    setEditing(entry);
                  }}
                />
              ))}
            </View>
            <ThemedText type="footnote" themeColor="textTertiary" style={styles.disclaimer}>
              Read off the document, so check anything you are about to rely on. Tap a line to
              correct it, or clear it to remove it.
            </ThemedText>
          </View>
        )}

        {blockers.length > 0 && (
          <View style={[styles.blocker, { borderColor: theme.urgentSoft }]}>
            <MaterialCommunityIcons name="alert-outline" size={18} color={theme.urgentSoft} />
            <View style={styles.flex}>
              <ThemedText type="headline" style={{ color: theme.urgentSoft }}>
                Do this first
              </ThemedText>
              {blockers.map(({ rule, blocking }) => (
                <ThemedText key={rule.requires} type="footnote" themeColor="textSecondary">
                  {rule.warning} Yours expires {shortDate(blocking.expiryDate)}.
                </ThemedText>
              ))}
            </View>
          </View>
        )}

        {/* The penalty is the reason to act today, so it never hides. */}
        {guided && type.guide.lateFee !== '' && (
          <View style={styles.lateRow}>
            <ThemedText type="footnote" themeColor="textTertiary">
              {running === null ? 'If you leave it' : 'What it has cost so far'}
            </ThemedText>
            {/*
             * A rate is a fact about the rules. A running total is a fact about
             * you, and it is the one that gets somebody to the typing centre on
             * their way home. Shown only where the app knows the grace period
             * and the rate, and always with the rate beside it so the number
             * can be checked rather than believed.
             */}
            {running !== null && (
              <ThemedText type="figure" style={{ color: theme.urgentStrong }}>
                {running.currency} {running.owed.toLocaleString()}
                {running.capped ? ' (the cap)' : ''}
              </ThemedText>
            )}
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
        {doc.files.length > 0 && !brief && (
          <Pressable
            onPress={
              /*
               * A refusal that leads somewhere. Running out mid-document is a
               * thing to fix, not an error to sit under, so the card that says
               * so is also the way to the top-up.
               */
              shortOfCredits ? () => router.push('/top-up') : readable ? retrySummary : readNow
            }
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
                  <ThemedText type="headline">
                    {stage === 'counting'
                      ? 'Checking the document…'
                      : stage === 'transcribing'
                        ? 'Reading it…'
                        : stage === 'summarising'
                        ? 'Working out what it says…'
                        : shortOfCredits
                          ? 'Not enough credits to read this'
                          : readable
                            ? 'Summarise this document'
                            : 'Read this document'}
                  </ThemedText>
                  <ThemedText type="footnote" themeColor="textTertiary">
                    {stage === 'counting'
                      ? 'Counting the pages.'
                      : /*
                         * A moving count, and nothing else. Everything this
                         * line used to add — how long it takes, that it only
                         * happens once — was either guesswork or something the
                         * count already says by moving.
                         */
                        stage === 'transcribing'
                        ? progress
                          ? progress.total > progress.of
                            ? `Page ${progress.page} of ${progress.of}, of ${progress.total}`
                            : `Page ${progress.page} of ${progress.of}`
                          : ''
                        : stage === 'summarising'
                          ? 'Almost there.'
                          : readable
                            ? 'Read. The summary did not finish, but you can ask it questions.'
                            : /* The one thing worth saying, because this one costs credits. */
                              'Find out what you agreed to, then ask it anything.'}
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
            icon="creation-outline"
            label="Ask about this document"
            onPress={() => router.navigate(`/ask?id=${doc.id}`)}
          />
        )}

        {brief && (
          <View style={styles.brief}>
            <View style={styles.sectionHeader}>
              <ThemedText type="footnote" themeColor="textTertiary">
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
                <ThemedText type="footnote" style={styles.flex}>
                  {item.detail}
                  {item.where ? (
                    <ThemedText type="footnote" themeColor="textTertiary">
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
                <ThemedText type="footnoteStrong" style={{ color: theme.accent }}>
                  {pointsOpen
                    ? 'Hide the detail'
                    : `Everything else it says (${brief.points.length})`}
                </ThemedText>
              </Pressable>
            )}

            {pointsOpen &&
              brief.points.map((point) => (
                <View key={point.label} style={styles.pointRow}>
                  <ThemedText type="footnoteStrong">{point.label}</ThemedText>
                  <ThemedText type="footnote" themeColor="textSecondary">
                    {point.detail}
                  </ThemedText>
                  {point.where ? (
                    <ThemedText type="footnote" themeColor="textTertiary">
                      {point.where}
                    </ThemedText>
                  ) : null}
                </View>
              ))}

            <SecondaryAction
              icon="creation-outline"
              label="Ask about this document"
              onPress={() => router.navigate(`/ask?id=${doc.id}`)}
            />
          </View>
        )}

        {(
          <Pressable
            onPress={() => setGuideOpen((open) => !open)}
            accessibilityRole="button"
            accessibilityLabel={guideOpen ? 'Hide renewal guidance' : 'Show renewal guidance'}>
            <View style={styles.sectionHeader}>
              <ThemedText type="footnote" themeColor="textTertiary">
                {/*
                  * A subscription is not renewed, it renews itself. What
                  * somebody opening this wants is the way out of it, and the
                  * reminder that brought them here said so too.
                  */}
                {isSubscription(doc) ? 'How to cancel or change it' : 'How to renew'}
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

        {guideOpen && (
          <View style={styles.guide}>
            {renewal.loading && (
              <ThemedText type="body" themeColor="textSecondary">
                Looking up how this is renewed where you are...
              </ThemedText>
            )}

            {renewal.error && !renewal.guidance && (
              <View style={styles.notes}>
                <ThemedText type="body" themeColor="textSecondary">
                  {renewal.error}
                </ThemedText>
                <SecondaryAction icon="refresh" label="Try again" onPress={renewal.retry} />
              </View>
            )}

            {renewal.guidance && worthShowing(renewal.guidance) && (
              <>
                {/*
                  * Said before the steps rather than after them, because a note
                  * under a procedure is read once the procedure has already been
                  * believed. It comes from the domain, so it is impossible to
                  * draw the guidance without it.
                  */}
                <ThemedText
                  type="footnote"
                  themeColor={renewal.guidance.standing === 'thin' ? 'urgentSoft' : 'textTertiary'}>
                  {provenanceNote(renewal.guidance)}
                </ThemedText>

                {renewal.guidance.summary !== '' && (
                  <ThemedText type="body" themeColor="textSecondary">
                    {renewal.guidance.summary}
                  </ThemedText>
                )}

                {notes.length > 0 && (
                  <View style={styles.notes}>
                    {notes.map((note) => (
                      <ThemedText key={note} type="footnote" themeColor="textTertiary">
                        {note}
                      </ThemedText>
                    ))}
                  </View>
                )}

                <View style={styles.steps}>
                  {renewal.guidance.steps.map((step, i) => (
                    <View key={step} style={styles.stepRow}>
                      <ThemedText
                        type="figure"
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

                {renewal.guidance.needed.length > 0 && (
                  <View style={styles.notes}>
                    <ThemedText type="footnote" themeColor="textTertiary">
                      What to bring
                    </ThemedText>
                    {renewal.guidance.needed.map((item) => (
                      <ThemedText key={item} type="body" themeColor="textSecondary">
                        {item}
                      </ThemedText>
                    ))}
                  </View>
                )}

                {/* A blank means we have nothing to say, which beats a row saying so. */}
                {renewal.guidance.where !== '' && (
                  <DataRow label="Where" value={renewal.guidance.where} bordered />
                )}
                {renewal.guidance.typicalCost !== '' && (
                  <DataRow label="Cost" value={renewal.guidance.typicalCost} bordered />
                )}
                {renewal.guidance.processingTime !== '' && (
                  <DataRow label="Takes" value={renewal.guidance.processingTime} bordered />
                )}

                {/*
                  * The pages this came from, so somebody about to spend a morning
                  * on it can check. The authority's own page sorts first.
                  */}
                {renewal.guidance.sources.length > 0 && (
                  <View style={styles.notes}>
                    <ThemedText type="footnote" themeColor="textTertiary">
                      Where this came from
                    </ThemedText>
                    {renewal.guidance.sources.map((source) => (
                      <Pressable
                        key={source.url}
                        onPress={() => openSource(source.url)}
                        accessibilityRole="link"
                        accessibilityLabel={`Open ${source.title}`}>
                        <ThemedText type="footnote" style={{ color: theme.accent }}>
                          {source.title}
                          {source.official ? ' · official' : ''}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>
                )}

                <ThemedText type="footnote" themeColor="textTertiary" style={styles.disclaimer}>
                  {renewal.guidance.provenance === 'generated'
                    ? `Looked up on ${shortDate(renewal.guidance.checkedOn)}${
                        renewal.refreshing ? ' · checking for anything newer' : ''
                      }`
                    : 'Figures are indicative, so confirm with the official channel.'}
                </ThemedText>
              </>
            )}

            {renewal.guidance && !worthShowing(renewal.guidance) && (
              <ThemedText type="body" themeColor="textSecondary">
                Expyr could not establish how this is renewed where you are. It will still keep
                the date and remind you in time.
              </ThemedText>
            )}
          </View>
        )}

        {doc.history && doc.history.length > 0 && (
          <DataRow
            label="Renewed"
            value={`${doc.history.length} time${doc.history.length === 1 ? '' : 's'} · last ${isSubscription(doc) ? 'charged' : 'expired'} ${shortDate(doc.history[doc.history.length - 1])}`}
            bordered
          />
        )}

        <View style={styles.actions}>
          {isSubscription(doc) ? (
            /*
             * A subscription needs no confirming. rollForwardAll() in the
             * document store already moves it past its date on every launch
             * and every return to the foreground, so a button asking the user
             * to report the renewal asks them to keep the app's books for it —
             * every month, for every service they pay.
             *
             * What they know and the app cannot work out is that they stopped
             * paying. Nothing in a date can tell us that, so that is the one
             * thing worth a button. It archives rather than deletes: the
             * reminders stop, the record and its history stay, and the archive
             * screen puts it back in one tap if they were wrong.
             */
            <PrimaryAction
              icon="close-circle-outline"
              label="I cancelled this"
              onPress={toggleArchive}
            />
          ) : portal ? (
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
  runway: { paddingTop: Spacing.one, gap: 2 },
  runwayTrack: { height: 26, marginHorizontal: 8 },
  runwayRail: { position: 'absolute', left: 0, right: 0, top: 10, height: 6, borderRadius: 3 },
  runwayFill: { position: 'absolute', left: 0, top: 10, height: 6, borderRadius: 3 },
  runwayNotch: { position: 'absolute', top: 5, width: 2, height: 16, borderRadius: 1, marginLeft: -1 },
  runwayNow: {
    position: 'absolute',
    top: 3,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    marginLeft: -10,
  },
  runwayScale: { flexDirection: 'row', justifyContent: 'space-between' },
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
  actions: { gap: Spacing.two, paddingTop: Spacing.four },
});
