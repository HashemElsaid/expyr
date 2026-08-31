# Design brief for Renewly

Paste the block below into Claude Design. It is written to be handed over
whole — it carries the product, the constraints, and the real content the
designer needs so nothing comes back as lorem ipsum.

---

Design a complete iOS app called **Renewly**.

## What it does

Renewly makes sure nothing in your life expires without warning. You photograph
a document — or upload a PDF — and it reads the expiry date, files it, reminds
you weeks or months ahead, and tells you exactly how to renew it: where to go,
what it costs, and the fine for leaving it late.

It tracks residence visas, Emirates ID, passports, car registration (Mulkiya),
car and health insurance, tenancy contracts (Ejari), driving licences, trade
licences and work permits — and also everyday things with dates: medicine and
supplements, warranties, subscriptions, and coursework deadlines.

## Who uses it

Expatriates living in the UAE, where almost everything expires and late renewal
carries a daily fine. A secondary audience is university students tracking
assignment and exam deadlines. Many users track documents for their whole
family, not just themselves.

## How it should feel

Calm, private, and quietly authoritative — the opposite of a government portal.
This app holds photographs of people's identity documents, so it must feel like
a locked drawer, not a social feed. Nothing gamified, no confetti, no streaks.

The core emotion is relief. Someone opens Renewly to find out whether they need
to worry, and most of the time the honest answer is "no, not yet". The design
should make "nothing needs you" feel as considered as "act now".

## The one rule that governs everything

**Colour means urgency and nothing else.** An item expiring in eight months is
rendered in quiet, near-neutral ink. Amber appears only when something is within
about a month. Red only when it is overdue or within days. Colour is never
decorative, never used to brand a category, never used to make a screen look
livelier. A screen where everything is fine should look almost monochrome.

## Screens to design

Design each in **both light and dark**, and include the empty and loading state
where one exists.

1. **Onboarding** — three steps: what the app does; a "what brings you here?"
   choice between *Living here* / *Studying* / *Both*; and a screen explaining
   why notifications matter before iOS asks.
2. **Items list** — the home screen. Sectioned into *Overdue*, *This month* and
   *Later*. Each row shows a photo thumbnail or category icon, a name, a small
   meta line, and a countdown. Include a search field and filter chips for
   family members. Design the empty state and a warning banner for when
   notifications are switched off.
3. **Add — choose method** — three routes: take a photo, choose a photo or
   screenshot, upload a PDF from Files, with a quieter "enter it myself" link.
4. **Add — category grid** — sixteen categories, two columns, equal-height cells,
   each an icon and a name (some names wrap to two lines).
5. **Scanning state** — the few seconds while the document is being read.
6. **Add — form** — category summary, name, date picker, "who is this for?",
   a document-number field that only appears for categories that have one, an
   attachment showing either a photo thumbnail or a PDF marker, and selectable
   reminder chips (1, 3, 7, 14, 30, 60, 90, 180 days).
7. **Document detail** — a large countdown figure at the top, the attachment, a
   numbered "how to renew" list, cost and late-fine rows, the reminder schedule,
   and actions: *I have renewed this*, *Renew at RTA*, *Edit*, *Archive*, *Delete*.
8. **Timeline** — the year laid out in date order, grouped by month, each row
   showing the day as a large figure with its weekday beneath.
9. **Settings** — plan and item usage, persona, reminder time, appearance,
   Face ID toggle, backup/restore/export/delete, privacy link.
10. **Paywall** — free tier is five items; yearly AED 79 and monthly AED 12.
11. **Lock screen** — shown when the app is locked behind Face ID.

## Use this real content, not placeholders

- "Emirates ID — Hashim", expires 9 Sep 2035
- "UAE Driving Licence", expires 10 Sep 2026, 11 days left
- "Toyota Corolla — Mulkiya", expires 2 Mar 2027
- "Marina Heights, Apartment 1204", Ejari, expires 31 Aug 2027
- "CS101 midterm", due 20 Oct 2026
- "Daman health insurance", expires 1 Jan 2027
- A renewal guide reads: *Pay any outstanding traffic fines — renewal is blocked
  until cleared.* Cost: *AED 350–500 plus inspection.* Late: *fines apply after
  the 30-day grace period.*

## Current design language — improve on it, do not discard it

The app already has a considered look. Treat this as the starting point and push
it further rather than replacing it with something generic.

- **Type**: Instrument Serif for the wordmark, headlines and countdown figures;
  DM Sans for everything else. Section headers are small-caps, letterspaced,
  with a hairline rule running to the edge.
- **Surfaces**: warm paper rather than white — `#F7F4EF` light, `#100F0E` dark.
  Text is ink `#191713`, never pure black on pure white.
- **Accent**: deep green `#1D4B39` light, mint `#8ED6B2` dark. Used only for
  primary actions.
- **Urgency**: `#9E2B20` overdue, `#87591A` due soon, quiet grey otherwise.
- **Icons**: monochrome line icons in bordered tiles. Never emoji.

## Hard constraints — a design that ignores these cannot be built

- Built in **React Native (Expo)**, so: no CSS grid, no backdrop blur, no complex
  gradients or blend modes, no custom text layout. Flexbox only.
- **Fonts must be on Google Fonts.** If you change the typefaces, name Google
  Fonts alternatives.
- **Icons must exist in Material Community Icons.** Name the exact glyph.
- Must work in **light and dark**, and at **larger accessibility text sizes** —
  do not rely on text staying one line.
- Touch targets at least **44×44pt**. Respect the notch and home indicator.
- There is a **bottom tab bar** with three tabs: Items, Timeline, Settings.

## What to avoid

Emoji standing in for icons. Coloured pill badges on every row. Purple-to-blue
gradients. Glassmorphism. Rounded-everything cards with uniform drop shadows.
Illustration-heavy empty states. Anything that looks like a generated template —
this app should look like a person with taste designed it for a specific city.

## Deliverables

Artboards for every screen above in both themes, plus a page defining the type
scale, colour tokens, spacing scale, corner radii, and the row, chip, button and
card components with their pressed and disabled states.
