import AsyncStorage from '@react-native-async-storage/async-storage';

import { EMPTY_LEDGER, priceOfPages, topUp, type Ledger } from '@/domain/credits';
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
   * Dead, and kept only so an existing install can be read correctly.
   *
   * It counted documents read while reading was capped at two per install.
   * Nothing increments it now: reading costs credits, and the balance is the
   * only thing that decides whether it may happen. The one job left is the
   * migration, which subtracts what an old install already used from the
   * welcome balance so updating neither confiscates nor gifts anything.
   *
   * Removable once no install predating credits is plausibly still out there.
   */
  readsUsed: number;
  /**
   * What Expyr AI has left to spend, and what it has spent.
   *
   * Reading a contract and answering questions about it costs real money every
   * time, and a one-off purchase cannot fund an unbounded amount of it. The
   * balance is the person's, it is visible, and it goes down as they use it —
   * which is the point: it makes the cost legible to whoever is choosing to
   * incur it.
   */
  credits: Ledger;
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
  /**
   * The account credits belong to, once somebody has signed in with Apple.
   *
   * An opaque key derived from Apple's subject identifier, prefixed `apple_`.
   * Not an email, not a name, and nothing that identifies a person to anybody
   * who has not already got their phone. Null until they choose to sign in,
   * and most people never will: it is offered where it matters, which is when
   * they have paid for something worth protecting.
   *
   * Kept only so the app can say whether the credits are protected. Every
   * request still authenticates with the install credential, which the service
   * resolves to this account on its own.
   */
  account: string | null;
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
  credits: EMPTY_LEDGER,
  lockOffered: false,
  people: [],
  ownName: '',
  account: null,
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
 * How many free readings an install used to get, and no longer does.
 *
 * Reading is paid for in credits now. This survives for one purpose: working
 * out how much of the welcome balance an install that predates credits has
 * already spent, so that updating the app neither takes away readings somebody
 * used nor hands back readings they did not.
 *
 * Not a limit any more. Nothing checks it.
 */
export const FREE_READ_LIMIT = 2;

/**
 * What a new install starts with: thirty pages, which is a couple of contracts.
 *
 * The free tier used to allow two readings and count them. Counting documents
 * and counting credits are the same idea with different arithmetic, and two
 * systems gating one feature is how a person ends up refused for a reason
 * neither of them shows. So the allowance became an opening balance.
 *
 * Generous on purpose. Somebody has to be able to see what the thing does
 * before deciding whether it is worth paying for.
 */
export const WELCOME_CREDITS = priceOfPages(30);

/**
 * Reads a stored ledger, or opens one.
 *
 * An install that already spent its free readings does not get them again:
 * the welcome balance arrives already reduced by what was used, so upgrading
 * the app neither takes anything away nor hands anything out.
 */
function readLedger(stored: unknown, readsAlreadyUsed: number): Ledger {
  if (
    stored &&
    typeof stored === 'object' &&
    typeof (stored as Ledger).balance === 'number' &&
    Array.isArray((stored as Ledger).entries)
  ) {
    return stored as Ledger;
  }

  const spent = Math.min(readsAlreadyUsed, FREE_READ_LIMIT) * priceOfPages(14);
  const opening = Math.max(0, WELCOME_CREDITS - spent);
  if (opening === 0) return EMPTY_LEDGER;

  return topUp(EMPTY_LEDGER, opening, 'Welcome credits', new Date(), 'welcome');
}

/**
 * Questions a day, free and paid.
 *
 * Unlike reading, asking is not something anyone needs a ration of: nobody
 * interrogates their own tenancy contract forty times before lunch. These are
 * high enough that a real person will never see them and low enough that a
 * loop, a stuck retry or somebody being clever cannot run up a bill overnight.
 * Every question costs a model call, and the transcripts go with it.
 */
/*
 * A daily question limit used to live here: twenty a day free, a hundred on
 * Pro. It was abuse protection written before anything measured what a
 * question costs, and it became the second gate on a feature that already has
 * one — so somebody with credits in hand could be told to come back tomorrow,
 * for a reason no screen showed them.
 *
 * The credit balance is the limit now. It is the honest one: it reflects what
 * the question actually costs rather than a number chosen for safety, it is
 * visible while they decide, and running out is something they can fix.
 */

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
          /*
           * A ledger that will not parse is replaced rather than repaired. It
           * is somebody's money, so a half-understood balance is worse than a
           * fresh one plus the welcome credits — and an install old enough to
           * have no ledger at all has never spent any.
           */
          credits: readLedger(parsed.credits, parsed.readsUsed ?? 0),
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
          /*
           * Named explicitly, like everything above it. This object is rebuilt
           * field by field, so anything not listed here is silently dropped at
           * the next launch, and an account dropped is credits stranded on the
           * service under a key the phone can no longer name.
           */
          account: typeof parsed.account === 'string' ? parsed.account : null,
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
