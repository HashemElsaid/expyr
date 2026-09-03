import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { hasGuidance, type Country } from '@/data/countries';
import { getDocumentType, labelFor } from '@/data/document-types';
import { countdownLabel, daysUntil, formatDate } from '@/lib/dates';
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
export const ACTION_SNOOZE = 'expyr.snooze';
export const ACTION_RENEWED = 'expyr.renewed';

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
}

/** A one-off nudge a week from now, used when someone snoozes a reminder. */
export async function snoozeReminder(doc: TrackedDocument, days = 7): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  const fireDate = new Date();
  fireDate.setDate(fireDate.getDate() + days);

  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: `${doc.title}`,
        body: `Still expiring ${formatDate(doc.expiryDate)}.`,
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

/** The hour and minute of day the user chose for every reminder. */
export type ReminderTime = { hour: number; minute: number };

const DEFAULT_TIME: ReminderTime = { hour: 9, minute: 0 };

/**
 * Schedules one reminder per lead day at the chosen time, skipping any that
 * would already be in the past. Returns the scheduled notification ids.
 */
export async function scheduleReminders(
  doc: TrackedDocument,
  time: ReminderTime = DEFAULT_TIME,
  country: Country | null = null
): Promise<string[]> {
  if (Platform.OS === 'web') return [];
  const granted = await ensureNotificationPermission();
  if (!granted) return [];

  const type = getDocumentType(doc.typeId);
  const daysLeft = daysUntil(doc.expiryDate);
  const ids: string[] = [];

  for (const lead of doc.leadDays) {
    if (daysLeft < lead) continue;
    const fireDate = new Date(`${doc.expiryDate}T00:00:00`);
    fireDate.setHours(time.hour, time.minute, 0, 0);
    fireDate.setDate(fireDate.getDate() - lead);
    if (fireDate.getTime() <= Date.now()) continue;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `${type.emoji} ${doc.title}: ${countdownLabel(lead)}`,
        // Only promise the renewal advice where we actually have it.
        body: hasGuidance(country)
          ? `${labelFor(type, country)} · open Expyr for what to do and what it costs.`
          : `${labelFor(type, country)} · open Expyr to see the details.`,
        data: { documentId: doc.id },
        categoryIdentifier: REMINDER_CATEGORY,
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
      title: '🪪 This is what a reminder looks like',
      body: 'Expyr will nudge you like this before anything expires.',
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
