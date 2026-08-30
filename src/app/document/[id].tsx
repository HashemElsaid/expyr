import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect } from 'react';
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
import { getDocumentType } from '@/data/document-types';
import { RENEWAL_PERIOD_DAYS, RENEWAL_PORTALS } from '@/data/renewal-actions';
import { useTheme } from '@/hooks/use-theme';
import { useUrgency } from '@/hooks/use-urgency';
import { dayMonth, daysUntil, longDate, shortDate, verdictPhrase } from '@/lib/dates';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { useDocuments } from '@/store/documents';
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
    const canShare = Boolean(doc.fileUri);

    const actions: { label: string; run: () => void; destructive?: boolean }[] = [
      ...(canShare
        ? [{ label: 'Share a copy', run: () => openAttachment(doc.fileUri!, doc.fileType) }]
        : []),
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

  if (!doc) return <ThemedView style={styles.container} />;

  const type = getDocumentType(doc.typeId);
  const portal = RENEWAL_PORTALS[doc.typeId];
  const canRoll = RENEWAL_PERIOD_DAYS[doc.typeId] !== undefined;
  const period = RENEWAL_PERIOD_DAYS[doc.typeId];
  const reminders = reminderDates(doc);
  const fired = reminders.filter((r) => r.past);
  const next = reminders.find((r) => !r.past);

  function markRenewed() {
    tapFeedback();
    router.push(canRoll ? `/add?id=${doc!.id}&renew=1` : `/add?id=${doc!.id}`);
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

          <ThemedText type="label" themeColor="textTertiary">
            {reminders.length === 0
              ? 'No reminders set'
              : [
                  fired.length ? `${fired.length} sent` : null,
                  next ? `next ${dayMonth(next.date)}` : 'none upcoming',
                ]
                  .filter(Boolean)
                  .join(' · ')}
          </ThemedText>
        </View>

        {doc.fileUri && (
          <Pressable onPress={() => openAttachment(doc.fileUri!, doc.fileType)}>
            {({ pressed }) => (
              <View
                style={[styles.fileRow, { borderBottomColor: theme.border }, pressed && styles.dim]}>
                {doc.fileType === 'pdf' ? (
                  <View style={[styles.thumb, { borderColor: theme.border }]}>
                    <MaterialCommunityIcons
                      name="file-pdf-box"
                      size={20}
                      color={theme.textSecondary}
                    />
                  </View>
                ) : (
                  <Image
                    source={{ uri: doc.fileUri }}
                    style={[styles.thumb, { borderColor: theme.border }]}
                    resizeMode="cover"
                  />
                )}
                <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                  {doc.fileType === 'pdf' ? 'PDF' : 'Photo'} kept on this phone
                </ThemedText>
                <ThemedText type="smallBold" style={{ color: theme.accent }}>
                  View
                </ThemedText>
              </View>
            )}
          </Pressable>
        )}

        {(doc.documentNumber || doc.notes) && (
          <View style={styles.plainRows}>
            {doc.documentNumber && (
              <DataRow label={type.numberField?.label ?? 'Number'} value={doc.documentNumber} />
            )}
            {doc.notes && <DataRow label="Notes" value={doc.notes} />}
          </View>
        )}

        <View style={styles.sectionHeader}>
          <ThemedText type="label" themeColor="textTertiary">
            Do these, in order
          </ThemedText>
          <View style={[styles.rule, { backgroundColor: theme.border }]} />
        </View>

        <View style={styles.steps}>
          {type.guide.steps.map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <ThemedText type="ledgerFigure" themeColor="textTertiary" style={styles.stepNumber}>
                {i + 1}
              </ThemedText>
              <ThemedText type="body" style={styles.flex}>
                {step}
              </ThemedText>
            </View>
          ))}
        </View>

        {doc.history && doc.history.length > 0 && (
          <DataRow
            label="Renewed"
            value={`${doc.history.length} time${doc.history.length === 1 ? '' : 's'} · last expired ${shortDate(doc.history[doc.history.length - 1])}`}
            bordered
          />
        )}

        <DataRow label="Where" value={type.guide.where} bordered />
        <DataRow label="Cost" value={type.guide.typicalCost} bordered />
        <DataRow label="If late" value={type.guide.lateFee} bordered />
        <DataRow label="Takes" value={type.guide.processingTime} bordered />

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
  runway: { height: 8, justifyContent: 'center' },
  runwayLine: { position: 'absolute', left: 0, right: 0, top: 3, height: 2 },
  tick: { position: 'absolute', top: 0, width: 1, height: 8 },
  dot: { position: 'absolute', top: 1, width: 6, height: 6, borderRadius: 3, marginLeft: -3 },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
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
