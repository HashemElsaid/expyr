import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

import { attachmentBlock, getClient, THINKING_CAPABLE, type SupportedMediaType } from './comprehend.ts';

/**
 * Reading a list of subscriptions off a screenshot.
 *
 * No app can ask iOS what somebody else's apps are charging them: a build only
 * ever sees transactions carrying its own bundle id, and that is deliberate.
 * The alternatives the subscription trackers use — a bank connection that sees
 * every transaction a person makes, or a mailbox full of their receipts — buy
 * automation with exactly the thing Expyr promises not to want.
 *
 * The screen already exists, though. iOS lists every subscription with its
 * renewal date under Settings, and a person can photograph a screen as easily
 * as a passport. So this reads that list the way the rest of the app reads a
 * contract: once, on the way past, keeping nothing.
 *
 * It works on more than Apple's screen. A bank statement, a card statement, or
 * Google Play's equivalent list are all the same job — names, amounts, dates.
 */

const MODEL = process.env.EXPYR_SUBSCRIPTIONS_MODEL ?? 'claude-haiku-4-5';

export const SubscriptionsSchema = z.object({
  subscriptions: z.array(
    z.object({
      /** What the person would call it: "Claude", "Netflix", "iCloud+". */
      name: z.string(),
      /** The plan as printed, when the screen names one. */
      plan: z.string(),
      /** As printed, with its currency. Empty when the screen does not say. */
      price: z.string(),
      period: z.enum(['weekly', 'monthly', 'quarterly', 'yearly', 'unknown']),
      /** The next charge, as YYYY-MM-DD. Empty when the screen does not say. */
      renewsOn: z.string(),
      status: z.enum(['active', 'expired', 'cancelled', 'unknown']),
    })
  ),
  /** What this screen is, or why nothing could be read from it. */
  note: z.string(),
});

export type Subscriptions = z.infer<typeof SubscriptionsSchema>;

const SYSTEM = `You read a screenshot of somebody's subscriptions for Expyr, so they can be reminded before each one charges them. Most users live in the UAE.

The screen is usually the iOS Subscriptions list, and may also be Google Play's, a bank or card statement, or a page from a service's own site.

- List every subscription the screen shows, in the order it shows them, including the ones marked expired or cancelled. Mark those with the right status rather than leaving them out: knowing a subscription has lapsed is worth as much as knowing one renews.
- "name" is what a person would call the service — "Claude", not "Claude Pro - Monthly". Put the plan in "plan".
- renewsOn is the date the screen gives for that row, in YYYY-MM-DD. Screens usually print a day and month with no year, so work the year out from what the date means: a renewal is the next twelve months, an expiry already happened, so pick the most recent one before today. "Expired 24 May" on a screen taken in September 2026 is 2026-05-24, not 2025.
- Copy prices exactly as printed, with the currency. Leave price empty rather than converting or guessing one.
- period comes from what is printed anywhere in the row, and the plan name usually carries it: "Claude Pro - Monthly" is monthly, "200 GB - 1 Year" is yearly, "billed annually" is yearly. Use unknown only when nothing on the row says, and never infer it from the price.
- Read only what is on the screen. Never add a subscription because it is popular, and never complete a half-visible row from what it probably is.
- If the image is not a list of subscriptions, return an empty array and say what it appears to be in "note".

Today's date is provided with the image; use it to resolve years.`;

export async function readSubscriptions(opts: {
  imageBase64: string;
  mediaType: SupportedMediaType;
  today: string;
}): Promise<Subscriptions> {
  const response = await getClient().messages.parse({
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM,
    ...(THINKING_CAPABLE.includes(MODEL) ? { thinking: { type: 'adaptive' as const } } : {}),
    output_config: { format: zodOutputFormat(SubscriptionsSchema) },
    messages: [
      {
        role: 'user',
        content: [
          attachmentBlock(opts.imageBase64, opts.mediaType),
          { type: 'text', text: `Today is ${opts.today}. List the subscriptions on this screen.` },
        ],
      },
    ],
  });

  const parsed = response.parsed_output;
  if (!parsed) throw new Error('Could not read that screen');
  return parsed;
}
