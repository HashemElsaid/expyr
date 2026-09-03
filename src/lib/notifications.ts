import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { hasGuidance, type Country } from '@/data/countries';
import { getDocumentType, labelFor } from '@/data/document-types';
import { daysUntil, dueIn, longDate } from '@/lib/dates';
import { TrackedDocument } from '@/types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Actions offered on the reminder itself, so a nudge can be dealt with in place. */
export const REMINDER_CATEGORY = 'expyr.reminder';
/**
 * Subscriptions get their own pair. "Already done" is a sensible thing to say
 * about a visa, which waits for you to renew it, and a meaningless thing to say
 * about Netflix, which renews itself whatever you do. The useful answer to a
 * charge you did not want is that you have cancelled it.
 */
export const SUBSCRIPTION_CATEGORY = 'expyr.subscription';
export const ACTION_SNOOZE = 'expyr.snooze';
export const ACTION_RENEWED = 'expyr.renewed';
export const ACTION_CANCELLED = 'expyr.cancelled';

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

/** A one-off nudge a week from now, used when someone snoozes a reminder. */
export async function snoozeReminder(doc: TrackedDocument, days = 7): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  const fireDate = new Date();
  fireDate.setDate(fireDate.getDate() + days);

  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        // Counted from the day it will arrive, not from today.
        title: `${doc.title} expires ${dueIn(daysUntil(doc.expiryDate) - days)}`,
        subtitle: doc.owner ?? '',
        body: longDate(doc.expiryDate),
        data: { documentId: doc.id },
        categoryIdentifier: REMINDER_CATEGORY,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireDate },
    });
  } catch {
    return null;
  }
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

/**
 * When every reminder arrives, for everybody.
 *
 * Nine in the morning is the hour this particular message can be acted on: the
 * typing centres and service centres are open, the insurer answers the phone,
 * and it is early enough that the day has not buried it yet. Earlier competes
 * with the alarm and the commute; the evening arrives after everything that
 * could be done about it has closed.
 *
 * If this ever becomes the user's to choose, it becomes a stored setting again
 * and this constant is the default.
 */
export const REMINDER_TIME = { hour: 9, minute: 0 } as const;

/**
 * Schedules one reminder per lead day at REMINDER_TIME, skipping any that
 * would already be in the past. Returns the scheduled notification ids.
 */
export async function scheduleReminders(
  doc: TrackedDocument,
  country: Country | null = null
): Promise<string[]> {
  if (Platform.OS === 'web') return [];
  const granted = await ensureNotificationPermission();
  if (!granted) return [];

  const type = getDocumentType(doc.typeId);
  const typeLabel = labelFor(type, country);
  /*
   * What being late costs, but only when it is a figure. Several of these read
   * as a paragraph — "no fine, but an expired passport invalidates travel and
   * can complicate visa renewal" — which belongs on the document's screen and
   * not on a lock screen at nine in the morning.
   */
  const fee = hasGuidance(country) ? type.guide.lateFee : '';
  const lateFee = fee.startsWith('AED') ? fee : '';
  const daysLeft = daysUntil(doc.expiryDate);
  const ids: string[] = [];

  for (const lead of doc.leadDays) {
    if (daysLeft < lead) continue;
    const fireDate = new Date(`${doc.expiryDate}T00:00:00`);
    fireDate.setHours(REMINDER_TIME.hour, REMINDER_TIME.minute, 0, 0);
    fireDate.setDate(fireDate.getDate() - lead);
    if (fireDate.getTime() <= Date.now()) continue;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        /*
         * Three lines, laid out the way iOS lays them out: what and when, then
         * whose it is, then the fact. The app's name and icon are already in
         * the header, so nothing here says Expyr and nothing asks to be opened
         * — tapping it is what opening it means.
         */
        title: `${doc.title} expires ${dueIn(lead)}`,
        subtitle: [doc.owner, typeLabel === doc.title.trim() ? null : typeLabel]
          .filter(Boolean)
          .join(' · '),
        body: lateFee
          ? `${longDate(doc.expiryDate)}. Late: ${lateFee}.`
          : longDate(doc.expiryDate),
        data: { documentId: doc.id },
        // A subscription is offered the answer that applies to a subscription.
        categoryIdentifier: doc.renewsEvery ? SUBSCRIPTION_CATEGORY : REMINDER_CATEGORY,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireDate },
    });
    ids.push(id);
  }
  return ids;
}

/**
 * Fires a real reminder a few seconds from now. Waiting weeks to discover that
 * notifications never worked is the worst way to find out.
 */
export async function sendTestReminder(): Promise<'sent' | 'denied' | 'unsupported'> {
  if (Platform.OS === 'web') return 'unsupported';
  if (!(await ensureNotificationPermission())) return 'denied';

  const fireDate = new Date(Date.now() + 5000);
  await Notifications.scheduleNotificationAsync({
    content: {
      // Shaped exactly like a real one, because that is the thing being tested.
      title: 'Emirates ID expires in 30 days',
      subtitle: 'Test reminder',
      body: 'A real one carries the date, and what being late costs.',
      categoryIdentifier: REMINDER_CATEGORY,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireDate },
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

export async function cancelReminders(notificationIds: string[]) {
  if (Platform.OS === 'web') return;
  await Promise.all(
    notificationIds.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {}))
  );
}
