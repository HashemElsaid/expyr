import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { Country } from '@/data/countries';
import { testReminderExamples } from '@/domain/test-reminder';
import {
  planReminders,
  REMINDER_CATEGORY,
  REMINDER_TIME,
  SUBSCRIPTION_CATEGORY,
  type PlannedReminder,
} from '@/lib/reminder-plan';
import { TrackedDocument } from '@/types';

/**
 * Booking reminders with iOS.
 *
 * Everything about *which* reminders to book lives in `reminder-plan.ts`, which
 * is pure and tested. This file is the half that cannot be: it talks to
 * expo-notifications, and its job is to make what iOS holds match the plan
 * using as few calls as it can get away with.
 */

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/*
 * Re-exported so callers have one place to import notification vocabulary from,
 * even though the categories themselves are decided by the planner.
 */
export { REMINDER_CATEGORY, REMINDER_TIME, SUBSCRIPTION_CATEGORY };

export const ACTION_SNOOZE = 'expyr.snooze';
export const ACTION_RENEWED = 'expyr.renewed';
export const ACTION_CANCELLED = 'expyr.cancelled';

/**
 * What Expyr currently has booked, and the plan it was booked from.
 *
 * Kept here rather than on each document because a reminder is no longer a
 * property of one item — the plan is chosen across all of them at once, so the
 * bookings belong to the collection.
 */
const BOOKED_KEY = 'expyr.reminders.v1';

type Booked = { fingerprint: string; ids: string[] };

/**
 * True when this phone has never booked reminders under the plan.
 *
 * Versions before the planner kept a notification id on each document, and this
 * file has no way to learn what those were. Booking a plan on top of them would
 * leave every reminder duplicated until the old copies fired. So the first pass
 * after an upgrade clears the queue outright and starts from the plan — which
 * is safe, because the plan is derived from the documents and describes
 * everything that ought to be booked anyway.
 */
async function neverPlanned(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(BOOKED_KEY)) === null;
  } catch {
    return false;
  }
}

async function readBooked(): Promise<Booked> {
  try {
    const raw = await AsyncStorage.getItem(BOOKED_KEY);
    if (!raw) return { fingerprint: '', ids: [] };
    const parsed = JSON.parse(raw) as Partial<Booked>;
    return {
      fingerprint: typeof parsed.fingerprint === 'string' ? parsed.fingerprint : '',
      ids: Array.isArray(parsed.ids) ? parsed.ids.filter((id) => typeof id === 'string') : [],
    };
  } catch {
    // An unreadable record means rebooking from scratch, which is always safe.
    return { fingerprint: '', ids: [] };
  }
}

/**
 * Registered once at startup. Two actions is the practical maximum before a
 * notification stops being a quick decision and becomes a menu.
 */
export async function registerNotificationActions() {
  if (Platform.OS === 'web') return;
  await Notifications.setNotificationCategoryAsync(REMINDER_CATEGORY, [
    { identifier: ACTION_SNOOZE, buttonTitle: 'Remind me in a week' },
    { identifier: ACTION_RENEWED, buttonTitle: 'Already done' },
  ]).catch(() => {});

  await Notifications.setNotificationCategoryAsync(SUBSCRIPTION_CATEGORY, [
    { identifier: ACTION_SNOOZE, buttonTitle: 'Remind me in a week' },
    { identifier: ACTION_CANCELLED, buttonTitle: 'I cancelled this' },
  ]).catch(() => {});
}

export async function getNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const settings = await Notifications.getPermissionsAsync();
  return settings.granted;
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return true;
  const request = await Notifications.requestPermissionsAsync();
  return request.granted;
}

async function book(reminder: PlannedReminder): Promise<string | null> {
  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: reminder.title,
        subtitle: reminder.subtitle,
        body: reminder.body,
        data: { documentId: reminder.documentId },
        categoryIdentifier: reminder.categoryIdentifier,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminder.fireAt,
      },
    });
  } catch {
    /*
     * One reminder that would not book must not cost the other fifty-nine.
     * The count returned to the caller is of what actually landed, so Settings
     * shows the truth rather than the intention.
     */
    return null;
  }
}

export type ReminderStatus = {
  /** How many are booked with iOS now. */
  booked: number;
  /** How many the documents between them asked for. */
  wanted: number;
  /** True when nothing needed doing, so no calls were made. */
  unchanged: boolean;
};

/**
 * Makes what iOS holds match the plan for these documents.
 *
 * Called after anything that could change the plan — an edit, an import, a
 * snooze, or simply the app opening on a later day. The fingerprint check is
 * what makes that affordable: rebooking sixty reminders is a hundred and twenty
 * round trips to iOS, and on an ordinary launch none of them are needed.
 */
export async function applyReminderPlan(
  documents: TrackedDocument[],
  country: Country | null
): Promise<ReminderStatus> {
  if (Platform.OS === 'web') return { booked: 0, wanted: 0, unchanged: true };

  const plan = planReminders(documents, country);
  const previous = await readBooked();
  const upgrading = await neverPlanned();
  if (upgrading) {
    await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
  }

  /*
   * Permission can be taken away in iOS Settings at any time. Asking here would
   * put a system prompt in front of somebody who was only opening the app, so
   * this checks rather than asks — the prompt belongs to the screens that offer
   * reminders, and there is one on the Timeline and one in Settings.
   */
  if (!(await getNotificationPermission())) {
    if (previous.ids.length > 0) await cancelBooked(previous.ids);
    await AsyncStorage.setItem(
      BOOKED_KEY,
      JSON.stringify({ fingerprint: '', ids: [] } satisfies Booked)
    ).catch(() => {});
    return { booked: 0, wanted: plan.wanted, unchanged: false };
  }

  if (!upgrading && previous.fingerprint === plan.fingerprint && previous.fingerprint !== '') {
    /*
     * The plan has not moved. Trust it only as far as iOS agrees: a restore
     * from a backup, or a reminder that has since fired, leaves the record
     * describing bookings that are no longer there.
     */
    const live = await countScheduled();
    if (live >= previous.ids.length) {
      return { booked: previous.ids.length, wanted: plan.wanted, unchanged: true };
    }
  }

  await cancelBooked(previous.ids);

  const ids: string[] = [];
  for (const reminder of plan.book) {
    const id = await book(reminder);
    if (id) ids.push(id);
  }

  await AsyncStorage.setItem(
    BOOKED_KEY,
    JSON.stringify({ fingerprint: plan.fingerprint, ids } satisfies Booked)
  ).catch(() => {});

  return { booked: ids.length, wanted: plan.wanted, unchanged: false };
}

async function cancelBooked(ids: string[]) {
  await Promise.all(
    ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {}))
  );
}

/**
 * Cancels everything Expyr has booked and forgets the record. Used when the
 * whole collection goes — deleting everything must not leave reminders behind
 * for documents that no longer exist.
 */
export async function cancelAllReminders() {
  if (Platform.OS === 'web') return;
  const { ids } = await readBooked();
  await cancelBooked(ids);
  /*
   * Belt and braces. Bookings made by a version of the app that kept ids on
   * each document are not in the record, and would otherwise fire for a
   * document that has been deleted.
   */
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
  await AsyncStorage.setItem(
    BOOKED_KEY,
    JSON.stringify({ fingerprint: '', ids: [] } satisfies Booked)
  ).catch(() => {});
}

/**
 * Two real reminders, a few seconds from now.
 *
 * Waiting weeks to discover that notifications never worked is the worst way to
 * find out. Two rather than one because the pair of buttons differs: a document
 * is offered "Already done", and a subscription — which renews itself whatever
 * anybody does — is offered the answer that actually helps, which is that it
 * has been cancelled. Both carry no document id, so pressing either button on a
 * test does nothing to anybody's file.
 *
 * What they say comes from `testReminderExamples`, which uses the person's own
 * soonest item. It used to be an Emirates ID and Netflix for everybody, which
 * is a fair guess in Dubai and a stranger's paperwork anywhere else.
 */
export async function sendTestReminder(
  documents: readonly TrackedDocument[] = []
): Promise<'sent' | 'denied' | 'unsupported'> {
  if (Platform.OS === 'web') return 'unsupported';
  if (!(await ensureNotificationPermission())) return 'denied';

  const example = testReminderExamples(documents);

  await Notifications.scheduleNotificationAsync({
    content: {
      // Shaped exactly like a real one, because that is the thing being tested.
      title: example.document,
      subtitle: 'Test reminder',
      body: 'This is what a reminder looks like.',
      categoryIdentifier: REMINDER_CATEGORY,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(Date.now() + 5000),
    },
  });

  await Notifications.scheduleNotificationAsync({
    content: {
      title: example.subscription,
      // The title already says which kind this is, and the rules have no
      // middot in them.
      subtitle: 'Test reminder',
      body: 'This is what a reminder looks like.',
      categoryIdentifier: SUBSCRIPTION_CATEGORY,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(Date.now() + 9000),
    },
  });

  return 'sent';
}

/** Everything Expyr currently has booked with iOS. */
export async function countScheduled(): Promise<number> {
  if (Platform.OS === 'web') return 0;
  try {
    return (await Notifications.getAllScheduledNotificationsAsync()).length;
  } catch {
    return 0;
  }
}
