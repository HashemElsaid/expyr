import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { Country } from '@/data/countries';
import type { Emirate } from '@/data/regions';

const STORAGE_KEY = 'expyr.settings.v1';
/** Where settings lived before the app was renamed. */
const LEGACY_STORAGE_KEY = 'renewly.settings.v1';

export type ThemePreference = 'system' | 'light' | 'dark';

export type Settings = {
  /** Local hour of day (0–23) that reminders fire. */
  reminderHour: number;
  themePreference: ThemePreference;
  /** Require Face ID, Touch ID or the device passcode to open the app. */
  lockEnabled: boolean;
  /** False until the first-run flow has been completed. */
  onboarded: boolean;
  /**
   * Decides whether renewal guidance is shown at all — we only have verified
   * steps for the UAE. Null means we have not asked yet.
   */
  country: Country | null;
  /**
   * Vehicle and licence services are run by the emirate, so guidance is wrong
   * without this. Only meaningful when country is 'ae'.
   */
  emirate: Emirate | null;
  /**
   * Local entitlement flag. Replace the read of this with RevenueCat's
   * customer info once real purchases are wired up.
   */
  premium: boolean;
  /**
   * Lifetime count of successful scans. Reading a date costs us a model call
   * every time, so the free tier buys a fixed number rather than an unlimited
   * supply — see FREE_SCAN_LIMIT.
   */
  scansUsed: number;
  /**
   * Lifetime count of documents read in full. Reading is the one thing here
   * with a real cost per document rather than per tap — see FREE_READ_LIMIT.
   */
  readsUsed: number;
};

const DEFAULTS: Settings = {
  reminderHour: 9,
  themePreference: 'system',
  lockEnabled: false,
  onboarded: false,
  country: null,
  emirate: null,
  premium: false,
  scansUsed: 0,
  readsUsed: 0,
};

/**
 * How many items a free account can track. Set high enough that someone can
 * put their whole life in and feel a reminder arrive before meeting the wall —
 * a typical UAE resident has eight or so documents before anything unusual.
 */
export const FREE_ITEM_LIMIT = 10;

/**
 * Free scans, for the lifetime of the install. Set to comfortably cover
 * photographing everything you already own — the moment the app earns its
 * place — without leaving an unmetered model bill open forever. Running out
 * never breaks the app: typing a date in by hand stays free and unlimited.
 */
export const FREE_SCAN_LIMIT = 15;

/**
 * Free documents read in full, for the lifetime of the install.
 *
 * Two is enough to feel what it does. Somebody reads the tenancy contract they
 * signed without reading, finds the clause that renews it for another year on
 * its own, and the price argues itself. It is also the only per-document cost
 * in the app, so leaving it open would mean paying for people who never pay.
 */
export const FREE_READ_LIMIT = 2;

type SettingsContextValue = {
  settings: Settings;
  loaded: boolean;
  update: (patch: Partial<Settings>) => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(async (stored) => {
        // Settings saved under the old app name are adopted rather than lost.
        const raw = stored ?? (await AsyncStorage.getItem(LEGACY_STORAGE_KEY));
        if (!raw) return;
        const parsed = JSON.parse(raw) as Partial<Settings>;
        if (!stored) AsyncStorage.setItem(STORAGE_KEY, raw).catch(() => {});
        setSettings({
          reminderHour:
            typeof parsed.reminderHour === 'number' &&
            parsed.reminderHour >= 0 &&
            parsed.reminderHour <= 23
              ? parsed.reminderHour
              : DEFAULTS.reminderHour,
          themePreference: parsed.themePreference ?? DEFAULTS.themePreference,
          lockEnabled: parsed.lockEnabled ?? DEFAULTS.lockEnabled,
          onboarded: parsed.onboarded ?? DEFAULTS.onboarded,
          // Installs that pre-date the country question had already answered it
          // implicitly by picking an emirate.
          country: parsed.country ?? (parsed.emirate ? 'ae' : DEFAULTS.country),
          emirate: parsed.emirate ?? DEFAULTS.emirate,
          premium: parsed.premium ?? DEFAULTS.premium,
          scansUsed: parsed.scansUsed ?? DEFAULTS.scansUsed,
          readsUsed: parsed.readsUsed ?? DEFAULTS.readsUsed,
        });
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo(() => ({ settings, loaded, update }), [settings, loaded, update]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
