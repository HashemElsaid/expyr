import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { authenticate, checkBiometricSupport } from '@/lib/biometrics';
import { successFeedback } from '@/lib/haptics';
import {
  countScheduled,
  ensureNotificationPermission,
  getNotificationPermission,
  REMINDER_TIME,
  sendTestReminder,
} from '@/lib/notifications';
import { formatTime } from '@/lib/dates';
import { countryLabel, type Country } from '@/data/countries';
import { emirateLabel, type Emirate } from '@/data/regions';
import { useDocuments } from '@/store/documents';
import { EMPTY_LEDGER, formatCredits, pagesLeft, topUp } from '@/domain/credits';
import { WELCOME_CREDITS, type ThemePreference, useSettings } from '@/store/settings';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/** The one line the location row shows in place of the pickers. */
function whereYouLive(settings: { country: Country | null; emirate: Emirate | null }): string {
  if (!settings.country) return 'Not set yet';
  const country = countryLabel(settings.country);
  return settings.emirate ? `${emirateLabel(settings.emirate)}, ${country}` : country;
}

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { settings, update } = useSettings();
  const { documents, reminders, rescheduleAll } = useDocuments();
  const [notificationsOn, setNotificationsOn] = useState<boolean | null>(null);
  const [biometrics, setBiometrics] = useState({ available: false, label: 'Face ID' });
  const [testState, setTestState] = useState<'idle' | 'sent'>('idle');
  /** What iOS actually holds, rather than what we think we booked. */
  const [bookedWithIOS, setBookedWithIOS] = useState(0);

  useEffect(() => {
    countScheduled().then(setBookedWithIOS).catch(() => {});
  }, [notificationsOn, documents.length, reminders.booked]);

  const reminderAt = formatTime(REMINDER_TIME.hour, REMINDER_TIME.minute);

  /*
   * Honest about the ceiling. iOS holds 64 pending reminders for an app and
   * silently drops the rest, so Expyr books the soonest and says plainly when
   * there were more — rather than claiming everything is covered when the far
   * end of the list is not booked yet.
   */
  const reminderSummary =
    reminders.wanted > reminders.booked
      ? `${bookedWithIOS} booked with iOS, each at ${reminderAt}. The furthest ${reminders.wanted - reminders.booked} are booked as these arrive, because iOS holds a limited number at once.`
      : `${bookedWithIOS} booked with iOS, each at ${reminderAt}.`;

  useEffect(() => {
    checkBiometricSupport().then(setBiometrics).catch(() => {});
  }, []);

  async function toggleLock(next: boolean) {
    if (!next) {
      // Prove it is really you before removing the lock.
      if (await authenticate('Turn off the app lock')) update({ lockEnabled: false });
      return;
    }
    if (!biometrics.available) {
      Alert.alert(
        'No lock available',
        'Set up Face ID, Touch ID or a passcode on your iPhone first, then come back.'
      );
      return;
    }
    if (await authenticate('Turn on the app lock')) update({ lockEnabled: true });
  }

  const refreshPermission = useCallback(() => {
    getNotificationPermission().then(setNotificationsOn).catch(() => setNotificationsOn(false));
  }, []);

  useEffect(refreshPermission, [refreshPermission]);

  async function enableNotifications() {
    const granted = await ensureNotificationPermission();
    setNotificationsOn(granted);
    if (granted) {
      await rescheduleAll();
    } else if (Platform.OS !== 'web') {
      Alert.alert(
        'Reminders are off',
        'Expyr can only warn you before something expires if notifications are allowed. You can turn them on in iOS Settings.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
    }
  }


  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <ThemedText type="display">Settings</ThemedText>
          </View>

          <Section title="Plan">
            {/*
             * No running totals here. Counting items, scans and readings at
             * someone who is not thinking about any of them is noise, and the
             * comparison behind Unlock says it better anyway.
             */}
            <Row
              icon={settings.premium ? 'star-circle-outline' : 'archive-outline'}
              title={settings.premium ? 'Expyr Pro' : 'Free plan'}
              action={
                settings.premium
                  ? undefined
                  : { label: 'Unlock', onPress: () => router.push('/paywall') }
              }
            />

            {/*
              * Shown here and nowhere else in normal use.
              *
              * Reading a contract and answering questions about it costs real
              * money every time, so the balance is the person's to see. Putting
              * it in Settings rather than over the feature is deliberate: a
              * number that follows you around while you work is a meter, and a
              * meter makes people ask worse questions. This is where somebody
              * comes when they want to know.
              */}
            <Row
              icon="creation-outline"
              title="Expyr AI credits"
              subtitle={`${formatCredits(settings.credits.balance)} · ${pagesLeft(settings.credits)} pages`}
              action={{ label: 'Top up', onPress: () => router.push('/top-up') }}
            />
          </Section>

          {/*
           * Answered once during onboarding and rarely thought about again, so
           * it states the answer and keeps the pickers behind it.
           */}
          <Section title="Where you live">
            <LinkRow
              icon="map-marker-outline"
              title={whereYouLive(settings)}
              onPress={() => router.push('/location')}
            />
          </Section>

          {/*
           * One row, because the answer to "are my reminders working?" is a
           * single fact, and the way to prove it is a single button.
           */}
          <Section title="Reminders">
            <Row
              icon={notificationsOn ? 'bell-outline' : 'bell-off-outline'}
              title={notificationsOn ? 'Notifications allowed' : 'Notifications are off'}
              subtitle={
                notificationsOn === null
                  ? 'Checking…'
                  : !notificationsOn
                    ? 'Expyr cannot warn you about anything until these are allowed.'
                    : testState === 'sent'
                      ? 'Two sent, a few seconds apart: an ordinary one and a subscription. Lock your phone to see them properly, and hold one to see its buttons.'
                      : reminderSummary
              }
              action={
                notificationsOn
                  ? {
                      label: testState === 'sent' ? 'Sent' : 'Test',
                      onPress: async () => {
                        const result = await sendTestReminder();
                        setTestState(result === 'sent' ? 'sent' : 'idle');
                        if (result === 'denied') {
                          Alert.alert('Reminders are off', 'Allow notifications first.');
                        }
                      },
                    }
                  : { label: 'Turn on', onPress: enableNotifications }
              }
            />
          </Section>

          <Section title="Appearance">
            <View style={styles.chipRow}>
              {THEME_OPTIONS.map((option) => {
                const on = settings.themePreference === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => update({ themePreference: option.value })}>
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
                        {option.label}
                      </ThemedText>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </Section>

          <Section title="Security">
            <View style={styles.row}>
              <MaterialCommunityIcons name="lock-outline" size={20} color={theme.textSecondary} />
              <View style={styles.rowBody}>
                <ThemedText type="bodyMedium">Require {biometrics.label}</ThemedText>
                {/* Only worth explaining when the switch will not move. */}
                {!biometrics.available && (
                  <ThemedText type="small" themeColor="textTertiary">
                    Set up Face ID, Touch ID or a passcode on this phone to use this.
                  </ThemedText>
                )}
              </View>
              <Switch
                value={settings.lockEnabled}
                onValueChange={toggleLock}
                disabled={!biometrics.available && !settings.lockEnabled}
                trackColor={{ true: theme.accent, false: theme.backgroundSelected }}
              />
            </View>
          </Section>

          {/*
           * Backing up, exporting and deleting are done once or in a hurry,
           * never while browsing. The same is true of the version and the
           * legal pages. Both move behind a row.
           */}
          <Section title="Your data">
            <LinkRow
              icon="cellphone-check"
              title="Saved on this iPhone"
              onPress={() => router.push('/data')}
            />
          </Section>

          <Section title="About">
            <LinkRow icon="information-outline" title="Expyr" onPress={() => router.push('/about')} />
          </Section>

          {/*
           * Development builds only — __DEV__ is false in anything shipped, so
           * this section does not exist in the App Store build. It is here
           * because testing the free limits uses them up, and a person building
           * the app should not have to delete it and start again to get another
           * ten scans.
           */}
          {__DEV__ && (
            <Section title="Developer">
              <Row
                icon="refresh"
                title="Reset the free allowances"
                subtitle={`${settings.scansUsed} scans used · ${formatCredits(settings.credits.balance)}`}
                action={{
                  label: 'Reset',
                  onPress: () => {
                    /*
                     * Credits go back to the welcome balance rather than to
                     * zero: a developer resetting the allowances wants a fresh
                     * install, and a fresh install has thirty pages.
                     */
                    update({
                      scansUsed: 0,
                      readsUsed: 0,
                      credits: topUp(EMPTY_LEDGER, WELCOME_CREDITS, 'Welcome credits', new Date(), 'reset'),
                    });
                    successFeedback();
                  },
                }}
              />
              <Row
                icon={settings.premium ? 'lock-open-variant-outline' : 'lock-outline'}
                title={settings.premium ? 'Pro is on' : 'Pro is off'}
                subtitle="Flips the entitlement locally, to see both sides of the paywall."
                action={{
                  label: settings.premium ? 'Turn off' : 'Turn on',
                  onPress: () => {
                    update({ premium: !settings.premium });
                    successFeedback();
                  },
                }}
              />
            </Section>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
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

/** A row that only says where it goes: title, chevron, nothing else. */
function LinkRow({ icon, title, onPress }: { icon: string; title: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {({ pressed }) => (
        <View style={[styles.row, pressed && styles.pressed]}>
          <MaterialCommunityIcons name={icon as never} size={20} color={theme.textSecondary} />
          <ThemedText type="bodyMedium" style={styles.flexRow}>
            {title}
          </ThemedText>
          <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textTertiary} />
        </View>
      )}
    </Pressable>
  );
}

function Row({
  icon,
  title,
  subtitle,
  action,
  destructive,
}: {
  icon: string;
  title: string;
  /** Omitted when the title says everything, so the row stays one line. */
  subtitle?: string;
  action?: { label: string; onPress: () => void };
  destructive?: boolean;
}) {
  const theme = useTheme();
  const actionColor = destructive ? theme.urgentStrong : theme.accent;
  return (
    <View style={styles.row}>
      <MaterialCommunityIcons
        name={icon as never}
        size={20}
        color={destructive ? theme.urgentStrong : theme.textSecondary}
      />
      <View style={styles.rowBody}>
        <ThemedText type="bodyMedium">{title}</ThemedText>
        {subtitle !== undefined && (
          <ThemedText type="small" themeColor="textTertiary">
            {subtitle}
          </ThemedText>
        )}
      </View>
      {action && (
        <Pressable onPress={action.onPress}>
          {({ pressed }) => (
            <View
              style={[
                styles.rowAction,
                destructive
                  ? { borderWidth: StyleSheet.hairlineWidth, borderColor: actionColor }
                  : { backgroundColor: actionColor },
                pressed && styles.pressed,
              ]}>
              <ThemedText
                type="smallBold"
                style={{ color: destructive ? actionColor : theme.accentContrast }}>
                {action.label}
              </ThemedText>
            </View>
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  content: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.four },
  header: { paddingTop: Spacing.three, paddingBottom: 0 },
  section: { gap: Spacing.two, paddingTop: Spacing.three },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  sectionBody: { gap: Spacing.three },
  row: { flexDirection: 'row', gap: Spacing.three, alignItems: 'center' },
  flexRow: { flex: 1 },
  rowBody: { flex: 1, gap: 3 },
  rowAction: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  field: { gap: Spacing.two },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  pressed: { opacity: 0.7 },
});
