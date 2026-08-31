import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { exportBackup, exportCsv, importBackup } from '@/lib/backup';
import { authenticate, checkBiometricSupport } from '@/lib/biometrics';
import {
  countScheduled,
  ensureNotificationPermission,
  getNotificationPermission,
  sendTestReminder,
} from '@/lib/notifications';
import { COUNTRIES, usesEmirates } from '@/data/countries';
import { EMIRATES } from '@/data/regions';
import { useDocuments } from '@/store/documents';
import {
  FREE_ITEM_LIMIT,
  FREE_SCAN_LIMIT,
  useSettings,
  type ThemePreference,
} from '@/store/settings';

const REMINDER_HOURS = [7, 8, 9, 12, 18, 20];
const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { settings, update } = useSettings();
  const { documents, rescheduleAll, replaceAll, deleteEverything } = useDocuments();
  const [notificationsOn, setNotificationsOn] = useState<boolean | null>(null);
  const [rescheduling, setRescheduling] = useState(false);
  const [biometrics, setBiometrics] = useState({ available: false, label: 'Face ID' });
  const [busy, setBusy] = useState<string | null>(null);
  const [testState, setTestState] = useState<'idle' | 'sent'>('idle');
  /** What iOS actually holds, rather than what we think we booked. */
  const [bookedWithIOS, setBookedWithIOS] = useState(0);

  useEffect(() => {
    countScheduled().then(setBookedWithIOS).catch(() => {});
  }, [notificationsOn, settings.reminderHour, documents.length]);

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

  async function run(label: string, action: () => Promise<void>) {
    setBusy(label);
    try {
      await action();
    } catch (error) {
      Alert.alert('Something went wrong', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  }

  function restore() {
    run('restore', async () => {
      const result = await importBackup();
      if (!result) return;
      Alert.alert(
        'Replace everything?',
        `This backup holds ${result.count} item${result.count === 1 ? '' : 's'}. Restoring replaces what is currently in Renewly.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore',
            style: 'destructive',
            onPress: () => replaceAll(result.documents),
          },
        ]
      );
    });
  }

  function wipe() {
    Alert.alert(
      'Delete everything?',
      'Every item, photo and reminder will be removed from this phone. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete all', style: 'destructive', onPress: () => deleteEverything() },
      ]
    );
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
        'Renewly can only warn you before something expires if notifications are allowed. You can turn them on in iOS Settings.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
    }
  }

  async function changeHour(hour: number) {
    update({ reminderHour: hour });
    setRescheduling(true);
    // The stored hour is read through a ref, so this picks up the new value.
    setTimeout(async () => {
      await rescheduleAll();
      setRescheduling(false);
    }, 0);
  }

  const scheduledCount = documents.reduce((sum, d) => sum + d.notificationIds.length, 0);
  const peopleCount = new Set(documents.map((d) => d.owner ?? '')).size || 1;
  const renewalsRecorded = documents.reduce((sum, d) => sum + (d.history?.length ?? 0), 0);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <ThemedText type="display">Settings</ThemedText>
          </View>

          <Section title="Plan">
            <Row
              icon={settings.premium ? 'star-circle-outline' : 'archive-outline'}
              title={settings.premium ? 'Renewly unlocked' : 'Free plan'}
              subtitle={
                settings.premium
                  ? 'Unlimited items and scans, for everyone in the family.'
                  : `${documents.length} of ${FREE_ITEM_LIMIT} items · ${Math.max(
                      0,
                      FREE_SCAN_LIMIT - settings.scansUsed
                    )} of ${FREE_SCAN_LIMIT} scans left.`
              }
              action={
                settings.premium
                  ? undefined
                  : { label: 'Unlock', onPress: () => router.push('/paywall') }
              }
            />
          </Section>

          {/* Only worth showing once there is actually more than one person. */}
          {peopleCount > 1 && (
            <Section title="Household">
              <Pressable onPress={() => router.push('/household')} accessibilityRole="button">
                {({ pressed }) => (
                  <View style={[styles.row, pressed && styles.pressed]}>
                    <MaterialCommunityIcons
                      name="account-multiple-outline"
                      size={20}
                      color={theme.textSecondary}
                    />
                    <View style={styles.rowBody}>
                      <ThemedText type="bodyMedium">
                        {peopleCount} people in this household
                      </ThemedText>
                      <ThemedText type="small" themeColor="textTertiary">
                        See what everyone needs, and rename anyone.
                      </ThemedText>
                    </View>
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={20}
                      color={theme.textTertiary}
                    />
                  </View>
                )}
              </Pressable>
            </Section>
          )}

          <Section title="Where you live">
            <View style={styles.chipRow}>
              {COUNTRIES.map((option) => {
                const on = settings.country === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() =>
                      update(
                        option.value === 'ae'
                          ? { country: option.value }
                          : { country: option.value, emirate: null }
                      )
                    }>
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

            {usesEmirates(settings.country) && (
              <>
                <View style={styles.chipRow}>
                  {EMIRATES.map((option) => {
                    const on = settings.emirate === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        onPress={() => update({ emirate: option.value })}>
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
                <ThemedText type="small" themeColor="textTertiary">
                  {settings.emirate
                    ? 'Renewal steps and portals follow your emirate — vehicles and licences are run locally, not federally.'
                    : 'Pick your emirate and Renewly will point you at the right authority.'}
                </ThemedText>
              </>
            )}

            {!usesEmirates(settings.country) && (
              <ThemedText type="small" themeColor="textTertiary">
                {settings.country
                  ? 'Renewly tracks your dates anywhere. Renewal steps, costs and fines are verified for the UAE only, so they stay hidden here rather than being guessed.'
                  : 'Set this so Renewly knows whether it can tell you how to renew things where you are.'}
              </ThemedText>
            )}
          </Section>

          <Section title="Reminders">
            <Row
              icon={notificationsOn ? 'bell-outline' : 'bell-off-outline'}
              title={notificationsOn ? 'Notifications allowed' : 'Notifications are off'}
              subtitle={
                notificationsOn === null
                  ? 'Checking…'
                  : notificationsOn
                    ? `${scheduledCount} reminder${scheduledCount === 1 ? '' : 's'} booked across ${documents.length} item${documents.length === 1 ? '' : 's'}.`
                    : 'Renewly cannot warn you about anything until these are allowed.'
              }
              action={
                notificationsOn
                  ? undefined
                  : { label: 'Turn on', onPress: enableNotifications }
              }
            />

            {notificationsOn && (
              <Row
                icon="bell-ring-outline"
                title="Check they arrive"
                subtitle={
                  testState === 'sent'
                    ? 'Sent — it should appear in a few seconds. Lock your phone to see it properly.'
                    : `${bookedWithIOS} booked with iOS right now. Send one to yourself to be sure.`
                }
                action={{
                  label: testState === 'sent' ? 'Sent' : 'Send one',
                  onPress: async () => {
                    const result = await sendTestReminder();
                    setTestState(result === 'sent' ? 'sent' : 'idle');
                    if (result === 'denied') {
                      Alert.alert('Reminders are off', 'Allow notifications first.');
                    }
                  },
                }}
              />
            )}

            <View style={styles.field}>
              <ThemedText type="small" themeColor="textTertiary">
                What time of day
              </ThemedText>
              <View style={styles.chipRow}>
                {REMINDER_HOURS.map((hour) => {
                  const on = settings.reminderHour === hour;
                  return (
                    <Pressable key={hour} onPress={() => changeHour(hour)} disabled={rescheduling}>
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
                          {formatHour(hour)}
                        </ThemedText>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              <ThemedText type="small" themeColor="textTertiary">
                {rescheduling
                  ? 'Rebooking your reminders…'
                  : `Every reminder arrives at ${formatHour(settings.reminderHour)}.`}
              </ThemedText>
            </View>
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
                <ThemedText type="small" themeColor="textTertiary">
                  {biometrics.available
                    ? 'Renewly asks for it whenever you open the app after being away.'
                    : 'Set up Face ID, Touch ID or a passcode on this phone to use this.'}
                </ThemedText>
              </View>
              <Switch
                value={settings.lockEnabled}
                onValueChange={toggleLock}
                disabled={!biometrics.available && !settings.lockEnabled}
                trackColor={{ true: theme.accent, false: theme.backgroundSelected }}
              />
            </View>
          </Section>

          <Section title="Your data">
            <Row
              icon="cellphone-check"
              title="Saved on this iPhone"
              subtitle="Your items and photos live in Renewly's private storage, and they travel with your iPhone backup — restore a new phone from iCloud and they come back. Nothing is stored on a server."
            />
            <Row
              icon="tray-arrow-up"
              title="Keep your own copy"
              subtitle="A single file with everything, to store wherever you like."
              action={{
                label: busy === 'backup' ? 'Working…' : 'Back up',
                onPress: () => run('backup', () => exportBackup(documents)),
              }}
            />
            <Row
              icon="tray-arrow-down"
              title="Restore from a backup"
              subtitle="Replaces what is in Renewly with the contents of a backup file."
              action={{ label: busy === 'restore' ? 'Working…' : 'Restore', onPress: restore }}
            />
            <Row
              icon="file-delimited-outline"
              title="Export as a spreadsheet"
              subtitle="A plain CSV of what you track, without photos."
              action={{
                label: busy === 'csv' ? 'Working…' : 'Export',
                onPress: () => run('csv', () => exportCsv(documents, settings.country)),
              }}
            />
            <Row
              icon="delete-outline"
              title="Delete everything"
              subtitle="Removes every item, photo and reminder from this phone."
              destructive
              action={{ label: 'Delete', onPress: wipe }}
            />
          </Section>

          <Section title="Legal">
            <Pressable onPress={() => router.push('/terms')} accessibilityRole="button">
              {({ pressed }) => (
                <View style={[styles.row, pressed && styles.pressed]}>
                  <MaterialCommunityIcons
                    name="script-text-outline"
                    size={20}
                    color={theme.textSecondary}
                  />
                  <View style={styles.rowBody}>
                    <ThemedText type="bodyMedium">Terms of use</ThemedText>
                    <ThemedText type="small" themeColor="textTertiary">
                      What Renewly promises, and what it does not.
                    </ThemedText>
                  </View>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={20}
                    color={theme.textTertiary}
                  />
                </View>
              )}
            </Pressable>

            <Pressable onPress={() => router.push('/privacy')}>
              {({ pressed }) => (
                <View style={[styles.row, pressed && styles.pressed]}>
                  <MaterialCommunityIcons
                    name="cellphone-lock"
                    size={20}
                    color={theme.textSecondary}
                  />
                  <View style={styles.rowBody}>
                    <ThemedText type="bodyMedium">Your documents stay on this phone</ThemedText>
                    <ThemedText type="small" themeColor="textTertiary">
                      Read exactly what is stored, and what happens when you scan.
                    </ThemedText>
                  </View>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={20}
                    color={theme.textTertiary}
                  />
                </View>
              )}
            </Pressable>
          </Section>

          <Section title="About">
            <Row
              icon="information-outline"
              title="Renewly"
              subtitle={`Version ${Constants.expoConfig?.version ?? '1.0.0'}`}
            />
            {renewalsRecorded > 0 && (
              <Row
                icon="history"
                title={`${renewalsRecorded} renewal${renewalsRecorded === 1 ? '' : 's'} behind you`}
                subtitle="Renewly remembers each time you have renewed something."
              />
            )}
          </Section>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function formatHour(hour: number): string {
  if (hour === 0) return 'midnight';
  if (hour === 12) return 'noon';
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
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

function Row({
  icon,
  title,
  subtitle,
  action,
  destructive,
}: {
  icon: string;
  title: string;
  subtitle: string;
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
        <ThemedText type="small" themeColor="textTertiary">
          {subtitle}
        </ThemedText>
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
  content: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.six },
  header: { paddingTop: Spacing.four, paddingBottom: Spacing.two },
  section: { gap: Spacing.three, paddingTop: Spacing.four },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  sectionBody: { gap: Spacing.four },
  row: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-start' },
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
