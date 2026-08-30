import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { LockGate } from '@/components/lock-gate';
import { Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { DocumentsProvider } from '@/store/documents';
import { SettingsProvider, useSettings } from '@/store/settings';

SplashScreen.preventAutoHideAsync().catch(() => {});

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

function AppShell() {
  const theme = useTheme();
  const scheme = useColorScheme();
  const router = useRouter();
  const { settings, loaded } = useSettings();

  // Send first-time users through onboarding before they see an empty list.
  useEffect(() => {
    if (loaded && !settings.onboarded) router.replace('/onboarding');
  }, [loaded, settings.onboarded, router]);

  // Tapping a reminder should land on the thing that is expiring.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const documentId = response.notification.request.content.data?.documentId;
      if (typeof documentId === 'string') router.push(`/document/${documentId}`);
    });
    return () => sub.remove();
  }, [router]);

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          headerTitleStyle: { fontFamily: Fonts.bodyMedium, fontSize: 17 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.background },
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="add" options={{ presentation: 'modal', title: 'Add' }} />
        <Stack.Screen name="document/[id]" options={{ title: '' }} />
        <Stack.Screen name="privacy" options={{ title: 'Privacy' }} />
        <Stack.Screen name="archive" options={{ title: 'Archive' }} />
        <Stack.Screen
          name="onboarding"
          options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }}
        />
        <Stack.Screen name="paywall" options={{ presentation: 'modal', title: 'Renewly' }} />
      </Stack>
    </>
  );
}
