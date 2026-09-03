import * as ImageManipulator from 'expo-image-manipulator';

import { forgetInstallToken, installToken } from '@/lib/install';
import type { PickedFile } from '@/lib/scan';
import { serviceBase } from '@/lib/service';
import type { Recurrence } from '@/types';

/**
 * Reading somebody's subscriptions off a screenshot of them.
 *
 * No app can ask iOS what another app charges you — a build only ever sees
 * transactions carrying its own bundle id. The trackers that manage it read
 * your bank or your inbox to do it, which buys the automation with everything
 * this app promises not to want. The list is already on a screen, though, and
 * reading screens is the thing Expyr is for.
 */

const TIMEOUT_MS = 60_000;

export type FoundSubscription = {
  name: string;
  plan: string;
  price: string;
  period: Recurrence | 'unknown';
  /** YYYY-MM-DD, or empty when the screen did not say. */
  renewsOn: string;
  /** The service's website, used only to find its icon. */
  domain: string;
  status: 'active' | 'expired' | 'cancelled' | 'unknown';
};

export type SubscriptionScan = { subscriptions: FoundSubscription[]; note: string };

/**
 * Resized the same way a scan is, and for the same reason: a phone screenshot
 * is three times wider than the text needs to be legible. Kept a little larger
 * than a document scan, because this screen is a list of small grey type.
 */
const MAX_EDGE = 1600;

async function prepare(file: PickedFile): Promise<string> {
  const longestEdge = Math.max(file.width ?? 0, file.height ?? 0);
  const actions: ImageManipulator.Action[] =
    longestEdge > MAX_EDGE
      ? [
          (file.width ?? 0) >= (file.height ?? 0)
            ? { resize: { width: MAX_EDGE } }
            : { resize: { height: MAX_EDGE } },
        ]
      : [];

  const result = await ImageManipulator.manipulateAsync(file.uri, actions, {
    compress: 0.8,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });
  if (!result.base64) throw new Error('That screenshot could not be read.');
  return result.base64;
}

export async function readSubscriptionScreenshot(file: PickedFile): Promise<SubscriptionScan> {
  if (file.type !== 'image') throw new Error('Send a screenshot rather than a PDF.');

  const fileBase64 = await prepare(file);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const token = process.env.EXPO_PUBLIC_SCAN_TOKEN;
    const install = await installToken();
    const response = await fetch(`${serviceBase()}/subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'x-expyr-token': token } : {}),
        ...(install ? { 'x-expyr-install': install } : {}),
      },
      signal: controller.signal,
      body: JSON.stringify({ fileBase64, mediaType: 'image/jpeg' }),
    });

    if (response.status === 429) {
      throw new Error('You have scanned a lot in a short time. Try again in a few minutes.');
    }
    if (response.status === 401) {
      await forgetInstallToken();
      throw new Error('This copy of Expyr is not authorised.');
    }
    if (!response.ok) throw new Error('That screen could not be read. Try a clearer screenshot.');

    return (await response.json()) as SubscriptionScan;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('That took too long. Try again on a stronger connection.');
    }
    if (error instanceof TypeError) {
      throw new Error('Could not reach the reading service. Check your connection.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * When to warn about a charge. Money leaving an account is worth a few days'
 * notice, not a month of it — long enough to move money or cancel, short
 * enough that the warning still means something when it arrives.
 */
export function leadDaysFor(period: Recurrence | 'unknown'): number[] {
  if (period === 'yearly') return [14, 3];
  if (period === 'quarterly') return [7, 3];
  if (period === 'weekly') return [1];
  return [3];
}

/** What the item is called on the list: the service, not the plan. */
export function titleFor(found: FoundSubscription): string {
  return found.name.trim() || 'Subscription';
}

/** Plan and price, kept as the screen printed them. */
export function noteFor(found: FoundSubscription): string {
  return [found.plan, found.price].filter((part) => part.trim().length > 0).join(' · ');
}
