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
      /**
       * The service's own website, so its icon can be found: "spotify.com",
       * "anghami.com", "claude.ai". Empty when the service is not one you
       * recognise — a guessed domain fetches a stranger's logo.
       */
      domain: z.string(),
      status: z.enum(['active', 'expired', 'cancelled', 'unknown']),
    })
  ),
  /** What this screen is, or why nothing could be read from it. */
  note: z.string(),
});

export type Subscriptions = z.infer<typeof SubscriptionsSchema>;

const SYSTEM = `You read a screen that shows what somebody is paying for, so Expyr can remind them before the money leaves. Most users live in the UAE.

It might be a list of many: the iOS Subscriptions screen, Google Play's, a card or bank statement. It might equally be one: a receipt, an invoice, a renewal or payment confirmation, or a billing page from the service itself. Read whichever you are given.

- List every subscription the screen shows, in the order it shows them, including any marked expired or cancelled. Mark those with the right status rather than leaving them out: knowing a subscription has lapsed is worth as much as knowing one renews.
- A receipt or an invoice for one service is one subscription. It is not a list, and it is not a reason to return nothing.
- "name" is what a person would call the service — "Claude", not "Claude Pro - Monthly", and the service rather than the company that billed for it: a receipt from Anthropic for a Claude plan is Claude. Put the plan in "plan".
- renewsOn is the day of the next charge, in YYYY-MM-DD. Screens say it in several ways, and all of them count:
  - a renewal date given plainly ("Renews 16 September") is the date;
  - a billing period ("Aug 16 – Sep 16, 2026", "1 March to 1 April") ends on the day the next one begins, so the end of the period is the next charge;
  - a payment date with a stated cycle ("Paid 16 August", "Monthly") means one cycle after the payment.
- Screens usually print a day and month with no year, so work the year out from what the date means: a renewal is in the next twelve months, an expiry already happened, so pick the most recent one before today. "Expired 24 May" on a screen taken in September 2026 is 2026-05-24, not 2025.
- Copy prices exactly as printed, with the currency, and take the total actually charged rather than the amount before tax. Leave price empty rather than converting or guessing one.
- period comes from what is printed anywhere on the screen, and both the plan name and the billing period carry it: "Claude Pro - Monthly" is monthly, a period running 16 August to 16 September is monthly, "200 GB - 1 Year" and "billed annually" are yearly. Use unknown only when nothing says.
- A receipt marked paid is an active subscription unless it says the service has been cancelled.
- Read only what is on the screen. Never add a subscription because it is popular, and never complete a half-visible row from what it probably is.
- domain is the service's main website, lowercase and without www: spotify.com, netflix.com, anghami.com, claude.ai, icloud.com. It is used to find the service's icon, so leave it empty rather than guessing at one you do not recognise — a wrong domain shows somebody a stranger's logo.
- Return an empty array only when the image genuinely shows nothing anybody pays for — a photo of a cat, a boarding pass, a contract. Say what it appears to be in "note", in one sentence, addressed to the person holding the phone.

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
