import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { LockGate } from '@/components/lock-gate';
import { LockOffer } from '@/components/lock-offer';
import { SaveWarning } from '@/components/save-warning';
import { Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import {
  ACTION_CANCELLED,
  ACTION_RENEWED,
  ACTION_SNOOZE,
  registerNotificationActions,
} from '@/lib/notifications';
import { topUp } from '@/domain/credits';
import { redeemWithService } from '@/lib/redeem';
import { sweep } from '@/lib/store';
import { DocumentsProvider, useDocuments } from '@/store/documents';
import { SettingsProvider, useSettings } from '@/store/settings';

SplashScreen.preventAutoHideAsync().catch(() => {});

/** Identifier of the last reminder a cold start already acted on. */
const LAST_OPENED_KEY = 'expyr.lastOpenedNotification';

/**
 * Expo Router renders this instead of a blank screen if something throws.
 * Deliberately reassuring: the user's documents are on disk and untouched by
 * whatever just failed.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <SettingsProvider>
      <ErrorScreen error={error} retry={retry} />
    </SettingsProvider>
  );
}

function ErrorScreen({ error, retry }: ErrorBoundaryProps) {
  const theme = useTheme();
  return (
    <View style={[errorStyles.container, { backgroundColor: theme.background }]}>
      <Text style={[errorStyles.title, { color: theme.text }]}>Something went wrong.</Text>
      <Text style={[errorStyles.body, { color: theme.textSecondary }]}>
        Your documents are safe on this phone and nothing was lost. Try again, and if it keeps
        happening, restarting Expyr usually clears it.
      </Text>
      <Text style={[errorStyles.detail, { color: theme.textTertiary }]} numberOfLines={3}>
        {error.message}
      </Text>
      <Pressable onPress={retry} accessibilityRole="button">
        <View style={[errorStyles.button, { backgroundColor: theme.accent }]}>
          <Text style={[errorStyles.buttonLabel, { color: theme.accentContrast }]}>Try again</Text>
        </View>
      </Pressable>
    </View>
  );
}

const errorStyles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 },
  title: { ...Fonts.display, fontSize: 34, lineHeight: 38, letterSpacing: -0.7, textAlign: 'center' },
  body: { ...Fonts.body, fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 320 },
  detail: { ...Fonts.body, fontSize: 12, textAlign: 'center', maxWidth: 320 },
  button: { borderRadius: 999, paddingHorizontal: 24, paddingVertical: 14, marginTop: 8 },
  buttonLabel: { ...Fonts.bodyMedium, fontSize: 13 },
});

export default function RootLayout() {
  /*
   * Straight away, because there is nothing left to wait for.
   *
   * This used to wait on two downloaded faces and render null until they
   * arrived, which is why the app opened on a held splash screen. The system
   * font is already in memory before any of our code runs, so holding it back
   * would be a delay in exchange for nothing.
   *
   * The splash is still held rather than hidden automatically, and hidden
   * here, so the first frame is a laid-out screen instead of an empty one.
   */
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <SettingsProvider>
      <DocumentsProvider>
        <LockGate>
          <AppShell />
        </LockGate>
      </DocumentsProvider>
    </SettingsProvider>
  );
}

/**
 * The way out of the add sheet.
 *
 * It used to be the word "Cancel", which sat immediately beside the title and
 * left the two reading as one line — "Cancel New entry". A cross says the same
 * thing in the space of a glyph, matches the close on the paywall sheet, and
 * leaves the title the middle of the bar to itself.
 */
function ModalCloseButton() {
  const theme = useTheme();
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.back()}
      hitSlop={16}
      accessibilityRole="button"
      accessibilityLabel="Cancel">
      {({ pressed }) => (
        <Icon
          name="xmark"
          size={24}
          color={pressed ? theme.text : theme.textSecondary}
        />
      )}
    </Pressable>
  );
}

function AppShell() {
  const theme = useTheme();
  const scheme = useColorScheme();
  const router = useRouter();
  const { settings, loaded, update } = useSettings();
  const { setArchived, snoozeDocument } = useDocuments();

  // Send first-time users through onboarding before they see an empty list.
  useEffect(() => {
    if (loaded && !settings.onboarded) router.replace('/onboarding');
  }, [loaded, settings.onboarded, router]);

  useEffect(() => {
    registerNotificationActions();
  }, []);

  // A reminder can be dealt with from the notification itself, or opened.
  const handleResponse = useCallback(
    (response: Notifications.NotificationResponse) => {
      const documentId = response.notification.request.content.data?.documentId;
      if (typeof documentId !== 'string') return;

      if (response.actionIdentifier === ACTION_SNOOZE) {
        snoozeDocument(documentId);
        return;
      }
      if (response.actionIdentifier === ACTION_RENEWED) {
        router.push(`/add?id=${documentId}&renew=1`);
        return;
      }
      /*
       * Cancelled from the notification itself: archived rather than deleted,
       * because the record of what it cost and when it ran is worth keeping,
       * and because undoing an archive is one tap while undoing a delete is
       * not possible.
       */
      if (response.actionIdentifier === ACTION_CANCELLED) {
        setArchived(documentId, true);
        return;
      }
      router.push(`/document/${documentId}`);
    },
    [router, setArchived, snoozeDocument]
  );

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(handleResponse);
    return () => sub.remove();
  }, [handleResponse]);

  /*
   * The listener above only hears taps while the app is already running. A
   * reminder fires weeks later, when the app is closed — tapping it launches
   * the app too late for the listener to exist, and the tap is lost. iOS keeps
   * the last response, so a cold start has to collect it here.
   *
   * That response persists across launches, so the identifier of the one we
   * acted on is remembered. Without it, every ordinary launch after a tapped
   * reminder would jump the user back into the same document.
   */
  const coldStartChecked = useRef(false);
  useEffect(() => {
    if (!loaded || coldStartChecked.current) return;
    coldStartChecked.current = true;

    (async () => {
      try {
        const response = await Notifications.getLastNotificationResponseAsync();
        if (!response) return;
        const id = response.notification.request.identifier;
        if ((await AsyncStorage.getItem(LAST_OPENED_KEY)) === id) return;
        await AsyncStorage.setItem(LAST_OPENED_KEY, id);
        handleResponse(response);
      } catch {
        // A missed cold start is not worth blocking the app over.
      }
    })();
  }, [loaded, handleResponse]);

  /**
   * Finishes any purchase that was interrupted.
   *
   * A transaction is never finished with Apple until the service has granted
   * what it bought, so a crash, a dead network, or an app killed while the
   * sheet was open all leave it unfinished. Apple then offers it again on
   * every launch, and this is what accepts it.
   *
   * Which means somebody who paid and then lost their connection gets their
   * credits the next time they open Expyr, without doing anything and without
   * being told there was a problem. Silent on purpose: an alert about a
   * purchase that has just quietly worked is a fright, not news.
   *
   * Restoring Expyr Pro on a new phone goes through the same code, because on
   * iOS it is the same operation.
   */
  const purchasesChecked = useRef(false);
  useEffect(() => {
    if (!loaded || purchasesChecked.current) return;
    purchasesChecked.current = true;

    (async () => {
      try {
        const recovered = await sweep(redeemWithService);
        if (recovered.length === 0) return;

        /*
         * Built from the settings this effect closed over, then written once.
         * Reading the store again between the two would be reading a value
         * this update is about to replace.
         */
        let credits = settings.credits;
        let pro = settings.premium;
        for (const item of recovered) {
          if (item.pro) pro = true;
          if (typeof item.credits === 'number') {
            credits = topUp(
              credits,
              item.credits,
              // Pro carries credits of its own, and the statement should say
              // which purchase a line came from rather than only how much.
              `${item.credits.toLocaleString('en-US')} credits${item.pro ? ' with Expyr Pro' : ''}`,
              new Date(),
              item.transactionId
            );
          }
        }
        update({ credits, premium: pro });
      } catch {
        // Left with Apple, which will offer it again. Nothing to say here.
      }
    })();
    // Deliberately not depending on settings: this runs once, at launch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.background },
          // Back chevrons and bar buttons take the accent; titles stay ink.
          headerTintColor: theme.accent,
          headerTitleStyle: { ...Fonts.bodyMedium, fontSize: 17, color: theme.text },
          headerShadowVisible: false,
          headerTitleAlign: 'center',
          /*
           * The chevron alone, with no word beside it.
           *
           * iOS labels a back button with the previous screen's title, and the
           * previous screen here is a route group — so it read "‹ (tabs)",
           * which is a filename leaking onto a document about somebody's visa.
           * Naming the group would only trade one wrong word for another: this
           * button always means back, and the screen behind it is always the
           * list, so the glyph says everything the word would.
           */
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: theme.background },
          /*
           * Pushed screens come in from the right and leave the way they came,
           * which is the gesture the swipe-back already implies — a screen that
           * appears without travelling gives the finger nothing to have moved.
           */
          animation: 'slide_from_right',
        }}>
        {/* Titled even though its header is hidden — anything that reads a
            route's title, back buttons included, should find a word rather
            than the name of a directory. */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Expyr' }} />
        <Stack.Screen
          name="add"
          options={{
            presentation: 'modal',
            title: 'Add',
            // Centred so the title never runs into the button beside it.
            headerTitleAlign: 'center',
            // A modal needs a visible way out; swiping down is not discoverable.
            headerLeft: () => <ModalCloseButton />,
          }}
        />
        <Stack.Screen name="document/[id]" options={{ title: '' }} />
        {/* Titled from inside, once the person is known. */}
        <Stack.Screen name="person/[name]" options={{ title: '' }} />
        <Stack.Screen name="privacy" options={{ title: 'Privacy' }} />
        <Stack.Screen name="terms" options={{ title: 'Terms' }} />
        <Stack.Screen name="archive" options={{ title: 'Archive' }} />
        <Stack.Screen name="location" options={{ title: 'Where you live' }} />
        <Stack.Screen name="data" options={{ title: 'Your data' }} />
        <Stack.Screen name="subscriptions" options={{ title: 'Subscriptions' }} />
        <Stack.Screen name="about" options={{ title: 'About Expyr' }} />
        <Stack.Screen
          name="onboarding"
          options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }}
        />
        {/*
         * No header: the screen carries its own close button, and a title bar
         * over a comparison this short only crowds it. The modal still slides
         * up and still swipes down.
         */}
        <Stack.Screen
          name="paywall"
          options={{ presentation: 'modal', headerShown: false, animation: 'slide_from_bottom' }}
        />
        {/*
          * Same treatment as the paywall: its own close, and no navigation bar
          * above it. Left to the default it grew a title reading "top-up" and a
          * back chevron beside the screen's own close, which is two ways out and
          * a strip of dead space to hold them.
          */}
        <Stack.Screen
          name="top-up"
          options={{ presentation: 'modal', headerShown: false, animation: 'slide_from_bottom' }}
        />
      </Stack>

      {/*
       * Over everything, because it is asked once and answered in a second, and
       * because the moment it matters is the moment a document has just been
       * saved — whichever screen that happened on.
       */}
      <LockOffer />

      {/*
       * Above everything as well, and above the lock offer: a save that failed
       * is the one thing in this app that must not be discovered later.
       */}
      <SaveWarning />
    </>
  );
}
