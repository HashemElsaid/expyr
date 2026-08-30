import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect } from 'react';
import {
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { DocIcon } from '@/components/doc-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { getDocumentType } from '@/data/document-types';
import { RENEWAL_PERIOD_DAYS, RENEWAL_PORTALS } from '@/data/renewal-actions';
import { useTheme } from '@/hooks/use-theme';
import { useUrgency } from '@/hooks/use-urgency';
import { countdownParts, daysUntil, formatDate } from '@/lib/dates';
import { successFeedback, tapFeedback } from '@/lib/haptics';
import { useDocuments } from '@/store/documents';

export default function DocumentDetailScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { documents, archived, removeDocument, setArchived } = useDocuments();

  const doc = [...documents, ...archived].find((d) => d.id === id);
  const days = doc ? daysUntil(doc.expiryDate) : 0;
  const { color } = useUrgency(days);

  useEffect(() => {
    if (doc) navigation.setOptions({ title: doc.title });
  }, [navigation, doc]);

  if (!doc) return <ThemedView style={styles.container} />;

  const type = getDocumentType(doc.typeId);
  const countdown = countdownParts(days);
  const canRoll = RENEWAL_PERIOD_DAYS[doc.typeId] !== undefined;
  const portal = RENEWAL_PORTALS[doc.typeId];

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
    Alert.alert('Stop tracking?', `“${doc.title}” will be removed along with its reminders.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: remove },
    ]);
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <ThemedText type="numeral" style={[styles.heroFigure, { color }]}>
            {countdown.value}
          </ThemedText>
          <ThemedText type="label" themeColor="textTertiary">
            {countdown.unit}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.heroDate}>
            {type.label} · {formatDate(doc.expiryDate)}
          </ThemedText>
        </View>

        {doc.imageUri && (
          <Image
            source={{ uri: doc.imageUri }}
            style={[styles.photo, { borderColor: theme.border }]}
            resizeMode="cover"
          />
        )}

        {(doc.documentNumber || doc.notes || doc.owner) && (
          <Section title="Details">
            {doc.owner && <Row label="Belongs to" value={doc.owner} />}
            {doc.documentNumber && (
              <Row label={type.numberField?.label ?? 'Number'} value={doc.documentNumber} />
            )}
            {doc.notes && <Row label="Notes" value={doc.notes} />}
          </Section>
        )}

        <Section title="How to renew">
          <Row label="Where" value={type.guide.where} />
          <View style={styles.steps}>
            {type.guide.steps.map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <ThemedText type="numeral" themeColor="textTertiary" style={styles.stepNumber}>
                  {i + 1}
                </ThemedText>
                <ThemedText type="body" style={styles.stepText}>
                  {step}
                </ThemedText>
              </View>
            ))}
          </View>
          <Row label="Typical cost" value={type.guide.typicalCost} />
          <Row label="If you are late" value={type.guide.lateFee} />
          <Row label="Processing time" value={type.guide.processingTime} />
          <ThemedText type="small" themeColor="textTertiary">
            Figures are indicative — always confirm with the official channel.
          </ThemedText>
        </Section>

        <Section title="Reminders">
          <View style={styles.reminderRow}>
            <DocIcon typeId={doc.typeId} size={38} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
              {doc.leadDays.length === 0
                ? 'No reminders set for this item.'
                : `${doc.leadDays.map((d) => (d === 1 ? '1 day' : `${d} days`)).join(', ')} before, at 9am.${
                    doc.notificationIds.length === 0 ? ' None are still upcoming.' : ''
                  }`}
            </ThemedText>
          </View>
        </Section>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              tapFeedback();
              router.push(canRoll ? `/add?id=${doc.id}&renew=1` : `/add?id=${doc.id}`);
            }}>
            {({ pressed }) => (
              <View
                style={[
                  styles.primaryAction,
                  { backgroundColor: theme.accent },
                  pressed && styles.pressed,
                ]}>
                <MaterialCommunityIcons
                  name="check-circle-outline"
                  size={17}
                  color={theme.accentContrast}
                />
                <ThemedText type="smallBold" style={{ color: theme.accentContrast }}>
                  {canRoll ? 'I have renewed this' : 'Update the date'}
                </ThemedText>
              </View>
            )}
          </Pressable>

          {portal && (
            <SecondaryAction
              icon="open-in-new"
              label={`Renew at ${portal.name}`}
              onPress={() => {
                tapFeedback();
                Linking.openURL(portal.url).catch(() =>
                  Alert.alert('Could not open', `Visit ${portal.url} in your browser.`)
                );
              }}
            />
          )}

          <SecondaryAction
            icon="pencil-outline"
            label="Edit details"
            onPress={() => router.push(`/add?id=${doc.id}`)}
          />

          <SecondaryAction
            icon={doc.archivedAt ? 'archive-arrow-up-outline' : 'archive-arrow-down-outline'}
            label={doc.archivedAt ? 'Move back to my items' : 'Archive — I am done with this'}
            onPress={async () => {
              await setArchived(doc.id, !doc.archivedAt);
              successFeedback();
              if (!doc.archivedAt) router.back();
            }}
          />

          <SecondaryAction
            icon="trash-can-outline"
            label="Delete permanently"
            tint={theme.urgentStrong}
            onPress={confirmDelete}
          />
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function SecondaryAction({
  icon,
  label,
  onPress,
  tint,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  tint?: string;
}) {
  const theme = useTheme();
  const color = tint ?? theme.textSecondary;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>
      {({ pressed }) => (
        <View style={[styles.secondaryAction, pressed && styles.pressed]}>
          <MaterialCommunityIcons name={icon as never} size={17} color={color} />
          <ThemedText type="smallBold" style={{ color }}>
            {label}
          </ThemedText>
        </View>
      )}
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <ThemedText type="label" themeColor="textTertiary">
          {title}
        </ThemedText>
        <View style={[styles.rule, { backgroundColor: theme.border }]} />
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <ThemedText type="small" themeColor="textTertiary">
        {label}
      </ThemedText>
      <ThemedText type="body">{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: Spacing.four,
    gap: Spacing.four,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  flex: { flex: 1 },
  hero: { alignItems: 'center', gap: Spacing.one, paddingVertical: Spacing.three },
  heroFigure: { fontSize: 72, lineHeight: 76 },
  heroDate: { marginTop: Spacing.two },
  photo: {
    width: '100%',
    height: 200,
    borderRadius: Radius.medium,
    borderWidth: StyleSheet.hairlineWidth,
  },
  section: { gap: Spacing.three },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  sectionBody: { gap: Spacing.three },
  row: { gap: 3 },
  steps: { gap: Spacing.three },
  stepRow: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-start' },
  stepNumber: { fontSize: 22, lineHeight: 24, width: 22 },
  stepText: { flex: 1 },
  reminderRow: { flexDirection: 'row', gap: Spacing.three, alignItems: 'center' },
  actions: { gap: Spacing.two, paddingTop: Spacing.two },
  primaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
  },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  pressed: { opacity: 0.7 },
});
