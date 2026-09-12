import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Platform, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ListRow, ListSection } from '@/components/list';
import { Segmented } from '@/components/segmented';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { canSignIn, deleteAccount, signIn } from '@/lib/identity';
import { useTheme } from '@/hooks/use-theme';
import { authenticate, checkBiometricSupport } from '@/lib/biometrics';
import { successFeedback } from '@/lib/haptics';
import {
  countScheduled,
  ensureNotificationPermission,
  getNotificationPermission,
  sendTestReminder,
} from '@/lib/notifications';
import { countryLabel, type Country } from '@/data/countries';
import { emirateLabel, type Emirate } from '@/data/regions';
import { useDocuments } from '@/store/documents';
import { EMPTY_LEDGER, adoptBalance, formatCredits, topUp } from '@/domain/credits';
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

  /*
   * Offered, never required, and only where it earns its place. Somebody who
   * has never bought credits has nothing an account would protect, and an app
   * that asks anyway is an app that wanted the account for its own sake.
   */
  const [canProtect, setCanProtect] = useState(false);

  useEffect(() => {
    // Catching, like every other promise on this screen: an unhandled
    // rejection in Expo Go is a red toast over the app.
    canSignIn().then(setCanProtect).catch(() => setCanProtect(false));
  }, []);

  async function protectCredits() {
    const outcome = await signIn();
    if (outcome.ok) {
      /*
       * The service's balance, which is the one that counts. This is the route
       * somebody takes on a new phone, so it is usually the whole point: the
       * credits are on the account and this is what brings them onto the
       * screen.
       */
      update({
        account: outcome.account,
        credits: adoptBalance(settings.credits, outcome.balance, new Date()),
      });
      successFeedback();
      return;
    }
    if (outcome.cancelled) return;
    Alert.alert('That did not work', outcome.message);
  }

  /*
   * Guideline 5.1.1(v) requires this to be reachable from inside the app, and
   * the forfeit has to be said before it happens rather than discovered after.
   * Apple handles refunds; we cannot give credits back once the account that
   * held them is gone.
   */
  function confirmDeleteAccount() {
    const balance = settings.credits.balance;
    Alert.alert(
      'Delete your account?',
      balance > 0
        ? `Your ${formatCredits(balance)} will be lost and cannot be restored, and restoring your purchases later will not bring them back. Your documents stay on this phone either way.`
        : 'Your documents stay on this phone either way.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const outcome = await deleteAccount();
            if (outcome.ok) {
              update({ account: null, credits: EMPTY_LEDGER });
              successFeedback();
              return;
            }
            if (outcome.cancelled) return;
            Alert.alert('Nothing was deleted', outcome.message);
          },
        },
      ]
    );
  }
  const { documents, reminders, rescheduleAll } = useDocuments();
  const [notificationsOn, setNotificationsOn] = useState<boolean | null>(null);
  const [biometrics, setBiometrics] = useState({ available: false, label: 'Face ID' });
  const [testState, setTestState] = useState<'idle' | 'sent'>('idle');
  /** What iOS actually holds, rather than what we think we booked. */
  const [bookedWithIOS, setBookedWithIOS] = useState(0);

  useEffect(() => {
    countScheduled().then(setBookedWithIOS).catch(() => {});
  }, [notificationsOn, documents.length, reminders.booked]);

  /**
   * Honest about the ceiling, in figures rather than a paragraph.
   *
   * iOS holds 64 pending notifications per app and silently drops the rest, so
   * Expyr books the soonest and has to say when there were more, or it is
   * claiming cover it has not booked. That used to be two sentences in a grey
   * subtitle, ending in a full stop, explaining the platform's limits to
   * somebody who only wanted to know whether reminders were on.
   *
   * "25 of 40 scheduled" is the same fact. The group's footer explains it once,
   * and only in the case where it is true.
   */
  const shortOfCover = reminders.wanted > reminders.booked;
  const scheduled = shortOfCover
    ? `${bookedWithIOS} of ${reminders.wanted} scheduled`
    : `${bookedWithIOS} scheduled`;

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
          <ThemedText type="largeTitle" style={styles.header}>
            Settings
          </ThemedText>

          <ListSection title="Plan">
            <ListRow
              symbol={settings.premium ? 'checkmark.seal.fill' : 'square.stack'}
              tint={settings.premium ? 'green' : 'gray'}
              title={settings.premium ? 'Expyr Pro' : 'Free plan'}
              /*
               * A chevron rather than the word Unlock. Unlock was a mint pill,
               * and as the row's value it would be grey text reading like a
               * state: "Free plan … Unlock" says the plan is called Unlock.
               * The row goes to the paywall, which is where the unlocking is,
               * and Settings is full of rows that state a plan and open it.
               */
              {...(settings.premium ? {} : { onPress: () => router.push('/paywall') })}
            />

            {/*
              * The balance is the row's value, which is where Settings puts
              * the answer to a row. It used to be a subtitle reading "0
              * credits · 0 pages", two figures of the same fact joined by a
              * middot, under a mint pill that said Top up. The row goes to
              * Top up now, like every other row that goes somewhere.
              */}
            {/*
              * Credits are a Pro thing now, so a free account is offered the
              * plan rather than a shop it cannot buy from. The balance is
              * still shown, because a balance granted before this change is
              * still theirs and becomes spendable the day they buy.
              */}
            <ListRow
              symbol="sparkles"
              tint="purple"
              title="Expyr AI credits"
              value={settings.premium ? formatCredits(settings.credits.balance) : 'With Pro'}
              onPress={() => router.push(settings.premium ? '/top-up' : '/paywall')}
            />

            {/*
              * Shown to anybody who has bought something, which is two people
              * rather than one.
              *
              * The obvious one has credits on this phone and signing in is
              * what keeps them. The other has just reinstalled: Pro came back
              * off Apple's replay, the credits did not, and they are sitting
              * on the account waiting to be claimed. This row is the only way
              * to claim them.
              *
              * It used to require a balance above zero, which hid it from the
              * second person entirely. Their credits were safe, the service
              * would have handed them over, and the app offered no way to
              * ask. That is the dead end item 20 rules out, and it was on the
              * one path somebody had paid to be on.
              *
              * Still nothing for somebody who has never bought anything. An
              * app that asks those people for an account is an app that
              * wanted the account for its own sake.
              */}
            {canProtect &&
              settings.account === null &&
              (settings.credits.balance > 0 || settings.premium) && (
                <ListRow
                  symbol="person.badge.key"
                  tint="blue"
                  title={
                    settings.credits.balance > 0 ? 'Protect my credits' : 'Restore my credits'
                  }
                  subtitle={
                    settings.credits.balance > 0
                      ? undefined
                      : 'Signs in with Apple and brings back credits held on your account'
                  }
                  chevron={false}
                  onPress={protectCredits}
                />
              )}

            {settings.account !== null && (
              <ListRow
                symbol="person.badge.key"
                tint="blue"
                title="Delete my account"
                chevron={false}
                destructive
                onPress={confirmDeleteAccount}
              />
            )}
          </ListSection>

          {/*
            * Only with Pro, because reading is what Pro buys and a switch that
            * controls nothing is worse than no switch.
            */}
          {settings.premium && (
            <ListSection
              title="Expyr AI"
              footer="Reads a document when you open it">
              <ListRow
                symbol="text.magnifyingglass"
                tint="blue"
                title="Read automatically"
                control={
                  <Switch
                    value={settings.autoRead}
                    onValueChange={(next) => update({ autoRead: next })}
                    trackColor={{ true: theme.accent, false: theme.backgroundSelected }}
                  />
                }
              />
            </ListSection>
          )}

          {/*
           * Answered once during onboarding and rarely thought about again, so
           * it states the answer and keeps the pickers behind it.
           */}
          <ListSection title="Where you live">
            <ListRow
              symbol="mappin.and.ellipse"
              tint="orange"
              title={whereYouLive(settings)}
              onPress={() => router.push('/location')}
            />
          </ListSection>

          {/*
           * Two rows, because there are two things here and they are different
           * kinds of thing: a state, and an action. They used to be one row
           * with a mint Test pill in it and a subtitle reading "25 booked with
           * iOS, each at 9am.", which is a sentence about plumbing.
           */}
          <ListSection
            title="Reminders"
            footer={
              notificationsOn === false
                ? 'Expyr cannot warn you about anything until these are allowed'
                : testState === 'sent'
                  ? 'Two sent, a few seconds apart. Lock your phone to see them properly'
                  : shortOfCover
                    ? 'iOS holds a limited number at a time, so the furthest are booked as the nearer ones arrive'
                    : undefined
            }>
            <ListRow
              symbol={notificationsOn ? 'bell.badge.fill' : 'bell.slash.fill'}
              tint={notificationsOn ? 'red' : 'gray'}
              title={notificationsOn ? 'Notifications allowed' : 'Notifications are off'}
              value={
                notificationsOn === null ? undefined : notificationsOn ? scheduled : undefined
              }
              {...(notificationsOn === false
                ? { chevron: false, onPress: enableNotifications, title: 'Turn on notifications' }
                : {})}
            />

            {notificationsOn === true && (
              <ListRow
                symbol="paperplane.fill"
                tint="blue"
                title={testState === 'sent' ? 'Test reminder sent' : 'Send a test reminder'}
                chevron={false}
                onPress={async () => {
                  const result = await sendTestReminder(documents);
                  setTestState(result === 'sent' ? 'sent' : 'idle');
                  if (result === 'denied') {
                    Alert.alert('Reminders are off', 'Allow notifications first.');
                  }
                }}
              />
            )}
          </ListSection>

          {/*
           * A segmented control, which is what iOS uses for three exclusive
           * choices. Three mint pills were a set of buttons that happened to
           * be exclusive, which is a different thing and read as one.
           */}
          <ListSection title="Appearance">
            <View style={styles.control}>
              <Segmented
                value={settings.themePreference}
                onChange={(next) => update({ themePreference: next })}
                segments={THEME_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
              />
            </View>
          </ListSection>

          <ListSection
            title="Security"
            footer={
              biometrics.available
                ? undefined
                : `Set up ${biometrics.label} or a passcode on this phone to use this`
            }>
            <ListRow
              symbol="lock.fill"
              tint="blue"
              title={`Require ${biometrics.label}`}
              control={
                <Switch
                  value={settings.lockEnabled}
                  onValueChange={toggleLock}
                  disabled={!biometrics.available && !settings.lockEnabled}
                  trackColor={{ true: theme.accent, false: theme.backgroundSelected }}
                />
              }
            />
          </ListSection>

          {/*
           * Backing up, exporting and deleting are done once or in a hurry,
           * never while browsing. The same is true of the version and the
           * legal pages. Both live behind a row.
           */}
          <ListSection>
            <ListRow
              symbol="iphone"
              tint="gray"
              title="Saved on this iPhone"
              onPress={() => router.push('/data')}
            />
            <ListRow
              symbol="info.circle.fill"
              tint="gray"
              title="About Expyr"
              onPress={() => router.push('/about')}
            />
          </ListSection>

          {/*
           * Development builds only: __DEV__ is false in anything shipped, so
           * this group does not exist in the App Store build. It is here
           * because testing the free limits uses them up, and a person
           * building the app should not have to delete it and start again to
           * get another ten scans.
           */}
          {__DEV__ && (
            <ListSection title="Developer">
              <ListRow
                symbol="arrow.counterclockwise"
                tint="indigo"
                title="Reset the free allowances"
                chevron={false}
                onPress={() => {
                  /*
                   * Credits go back to the welcome balance rather than to
                   * zero: a developer resetting the allowances wants a fresh
                   * install, and a fresh install has thirty pages.
                   */
                  update({
                    scansUsed: 0,
                    readsUsed: 0,
                    credits: topUp(
                      EMPTY_LEDGER,
                      WELCOME_CREDITS,
                      'Welcome credits',
                      new Date(),
                      'reset'
                    ),
                  });
                  successFeedback();
                }}
              />
              <ListRow
                symbol="lock.open.fill"
                tint="indigo"
                title={settings.premium ? 'Turn Pro off' : 'Turn Pro on'}
                chevron={false}
                onPress={() => {
                  update({ premium: !settings.premium });
                  successFeedback();
                }}
              />
            </ListSection>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  safeArea: { flex: 1, maxWidth: MaxContentWidth, width: '100%' },
  content: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.six },
  header: { paddingTop: Spacing.three },
  /** A control rather than a row, so it gets the padding a row would have. */
  control: { padding: Spacing.three },
});
