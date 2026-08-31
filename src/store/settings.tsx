import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'renewly.settings.v1';

export type ThemePreference = 'system' | 'light' | 'dark';
export type Persona = 'student' | 'resident' | 'both';

export type Settings = {
  /** Local hour of day (0–23) that reminders fire. */
  reminderHour: number;
  themePreference: ThemePreference;
  /** Require Face ID, Touch ID or the device passcode to open the app. */
  lockEnabled: boolean;
  /** False until the first-run flow has been completed. */
  onboarded: boolean;
  /** Decides which categories are offered first. */
  persona: Persona;
  /**
   * Local entitlement flag. Replace the read of this with RevenueCat's
   * customer info once real purchases are wired up.
   */
  premium: boolean;
};

const DEFAULTS: Settings = {
  reminderHour: 9,
  themePreference: 'system',
  lockEnabled: false,
  onboarded: false,
  persona: 'resident',
  premium: false,
};

/**
 * How many items a free account can track. Set high enough that someone can
 * put their whole life in and feel a reminder arrive before meeting the wall —
 * a typical UAE resident has eight or so documents before anything unusual.
 */
export const FREE_ITEM_LIMIT = 10;

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
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw) as Partial<Settings>;
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
          persona: parsed.persona ?? DEFAULTS.persona,
          premium: parsed.premium ?? DEFAULTS.premium,
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
