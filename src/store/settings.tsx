import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { Country } from '@/data/countries';
import { nameFromDevice } from '@/domain/household';
import type { Emirate } from '@/data/regions';

const STORAGE_KEY = 'expyr.settings.v1';
/** Where settings lived before the app was renamed. */
const LEGACY_STORAGE_KEY = 'renewly.settings.v1';

export type ThemePreference = 'system' | 'light' | 'dark';

export type Settings = {
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
  /** Questions asked today, and the day they were asked — see askAllowance. */
  questionsAsked: number;
  questionsOn: string;
  /**
   * Whether the offer to lock the app has been made. Asked once, at the moment
   * it starts to matter, and never again — an app that keeps asking for
   * permissions it was refused is one people learn to dismiss without reading.
   */
  lockOffered: boolean;
  /**
   * People added by name on the Household page, who may not own anything yet.
   *
   * A person used to exist only as a side effect of owning a document, which
   * meant there was no way to add one — and a relative you have not filed
   * anything for is the largest gap on the page whose job is finding gaps.
   * Names on documents are still the main source; this is the rest.
   */
  people: string[];
  /**
   * What the person holding the phone is called.
   *
   * Their card said "Mine", which is fine on its own and reads oddly beside
   * "Reem" and "Laila" — one row in the household written in a different
   * grammar from the rest. It also made naming yourself in "Whose is it" put
   * you on the page twice.
   *
   * iOS will not tell us this. The Apple ID name is reachable only through Sign
   * in with Apple, which needs a tap, a paid developer account, and the user's
   * permission — and they may withhold the name even then. So it is seeded from
   * what they called their phone, which is usually right and always editable,
   * and left blank when that does not parse.
   */
  ownName: string;
};

const DEFAULTS: Settings = {
  themePreference: 'system',
  lockEnabled: false,
  onboarded: false,
  country: null,
  emirate: null,
  premium: false,
  scansUsed: 0,
  readsUsed: 0,
  questionsAsked: 0,
  questionsOn: '',
  lockOffered: false,
  people: [],
  ownName: '',
};

/**
 * How many items a free account can track.
 *
 * Ten was a plan nobody ever hit. One person's own papers — Emirates ID,
 * passport, driving licence, Mulkiya, insurance — come to about five, so the
 * ceiling sat above the whole audience and the tracker was, in effect, free
 * forever. Five is the same set: enough to put yourself in, see the countdowns
 * and get a reminder, and the wall arrives at the sixth — a partner's ID, a
 * second car, a child's passport, the tenancy. That is a household, and a
 * household is what this is worth paying for.
 */
export const FREE_ITEM_LIMIT = 5;

/**
 * Free scans, for the lifetime of the install. Two per free item, which covers
 * photographing everything you already own with room for the shots that come
 * out blurred, and closes an unmetered model bill that would otherwise stay
 * open forever. Running out never breaks the app: typing a date in by hand
 * stays free and unlimited.
 */
export const FREE_SCAN_LIMIT = 10;

/**
 * Free documents read in full, for the lifetime of the install.
 *
 * Two is enough to feel what it does. Somebody reads the tenancy contract they
 * signed without reading, finds the clause that renews it for another year on
 * its own, and the price argues itself. It is also the only per-document cost
 * in the app, so leaving it open would mean paying for people who never pay.
 */
export const FREE_READ_LIMIT = 2;

/**
 * Questions a day, free and paid.
 *
 * Unlike reading, asking is not something anyone needs a ration of: nobody
 * interrogates their own tenancy contract forty times before lunch. These are
 * high enough that a real person will never see them and low enough that a
 * loop, a stuck retry or somebody being clever cannot run up a bill overnight.
 * Every question costs a model call, and the transcripts go with it.
 */
export const DAILY_QUESTION_LIMIT = { free: 20, premium: 100 };

/** Today's date as the app counts it — local, because the user's day is local. */
export function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

/** How many questions are left today, and the patch that records asking one. */
export function askAllowance(settings: Settings): {
  left: number;
  limit: number;
  spend: () => Partial<Settings>;
} {
  const limit = settings.premium ? DAILY_QUESTION_LIMIT.premium : DAILY_QUESTION_LIMIT.free;
  // A new day starts the count again, so nothing has to be swept or cleaned up.
  const asked = settings.questionsOn === today() ? settings.questionsAsked : 0;
  return {
    left: Math.max(0, limit - asked),
    limit,
    spend: () => ({ questionsAsked: asked + 1, questionsOn: today() }),
  };
}

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
        if (!raw) {
          // Nothing saved yet: still worth knowing whose phone this is.
          const guess = nameFromDevice(Constants.deviceName);
          if (guess) setSettings((current) => ({ ...current, ownName: guess }));
          return;
        }
        const parsed = JSON.parse(raw) as Partial<Settings>;
        if (!stored) AsyncStorage.setItem(STORAGE_KEY, raw).catch(() => {});
        setSettings({
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
          questionsAsked: parsed.questionsAsked ?? DEFAULTS.questionsAsked,
          questionsOn: parsed.questionsOn ?? DEFAULTS.questionsOn,
          lockOffered: parsed.lockOffered ?? DEFAULTS.lockOffered,
          people: Array.isArray(parsed.people)
            ? parsed.people.filter((name): name is string => typeof name === 'string')
            : DEFAULTS.people,
          /*
           * Seeded on first read rather than asked for. An extra onboarding
           * question to learn something the phone already implies is a question
           * not worth asking, and the guess is only ever a label they can change.
           */
          ownName:
            typeof parsed.ownName === 'string' && parsed.ownName
              ? parsed.ownName
              : nameFromDevice(Constants.deviceName),
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
