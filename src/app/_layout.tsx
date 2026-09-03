import AsyncStorage from '@react-native-async-storage/async-storage';
import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LockGate } from '@/components/lock-gate';
import { Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import {
  ACTION_RENEWED,
  ACTION_SNOOZE,
  registerNotificationActions,
} from '@/lib/notifications';
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
  title: { fontFamily: Fonts.display, fontSize: 34, lineHeight: 38, textAlign: 'center' },
  body: { fontFamily: Fonts.body, fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 320 },
  detail: { fontFamily: Fonts.body, fontSize: 12, textAlign: 'center', maxWidth: 320 },
  button: { borderRadius: 999, paddingHorizontal: 24, paddingVertical: 14, marginTop: 8 },
  buttonLabel: { fontFamily: Fonts.bodyMedium, fontSize: 13 },
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    [Fonts.display]: InstrumentSerif_400Regular,
    [Fonts.body]: DMSans_400Regular,
    [Fonts.bodyMedium]: DMSans_500Medium,
    [Fonts.bodyBold]: DMSans_700Bold,
  });

  useEffect(() => {
    // Reveal the app once type is ready; a font failure should not trap the user.
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

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

function ModalCancelButton() {
  const theme = useTheme();
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.back()}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Cancel">
      {({ pressed }) => (
        <Text
          style={{
            fontFamily: Fonts.body,
            fontSize: 17,
            color: theme.accent,
            opacity: pressed ? 0.6 : 1,
          }}>
          Cancel
        </Text>
      )}
    </Pressable>
  );
}

function AppShell() {
  const theme = useTheme();
  const scheme = useColorScheme();
  const router = useRouter();
  const { settings, loaded } = useSettings();
  const { snoozeDocument } = useDocuments();

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
      router.push(`/document/${documentId}`);
    },
    [router, snoozeDocument]
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

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.background },
          // Back chevrons and bar buttons take the accent; titles stay ink.
          headerTintColor: theme.accent,
          headerTitleStyle: { fontFamily: Fonts.bodyMedium, fontSize: 17, color: theme.text },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.background },
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="add"
          options={{
            presentation: 'modal',
            title: 'Add',
            // A modal needs a visible way out; swiping down is not discoverable.
            headerLeft: () => <ModalCancelButton />,
          }}
        />
        <Stack.Screen name="document/[id]" options={{ title: '' }} />
        <Stack.Screen name="privacy" options={{ title: 'Privacy' }} />
        <Stack.Screen name="terms" options={{ title: 'Terms' }} />
        <Stack.Screen name="archive" options={{ title: 'Archive' }} />
        <Stack.Screen name="household" options={{ title: 'Household' }} />
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
      </Stack>
    </>
  );
}
