import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { getDocumentType } from '@/data/document-types';
import { countdownLabel, daysUntil } from '@/lib/dates';
import { TrackedDocument } from '@/types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

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
 * Schedules one reminder per lead day at 09:00 local time, skipping any that
 * would already be in the past. Returns the scheduled notification ids.
 */
export async function scheduleReminders(
  doc: TrackedDocument,
  reminderHour = 9
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
    fireDate.setHours(reminderHour, 0, 0, 0);
    fireDate.setDate(fireDate.getDate() - lead);
    if (fireDate.getTime() <= Date.now()) continue;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `${type.emoji} ${doc.title}: ${countdownLabel(lead)}`,
        body: `${type.label} · open Renewly for what to do and what it costs.`,
        data: { documentId: doc.id },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireDate },
    });
    ids.push(id);
  }
  return ids;
}

export async function cancelReminders(notificationIds: string[]) {
  if (Platform.OS === 'web') return;
  await Promise.all(
    notificationIds.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {}))
  );
}
