# Expyr, launch checklist

Current as of 7 September 2026, in dependency order. Nothing in a step can
start before the step above it is done.

**YOU** means only you can do it: payment, identity, an Apple account, a
decision. **ME** means ask Claude and it gets done.

**This file is updated as work is finished, in the same commit as the work.**
Not as a courtesy: three documents in this repository have already described a
design that had been replaced, and the tests that catch that for pricing
arithmetic cannot catch it for prose. If something here is ticked, it is done;
if it is open, it is not.

Two documents sit under this one. `APP-REVIEW.md` is the App Store compliance
audit and why each item is there. `PRICING.md` is what everything costs to run
and how the credits are priced. `STORE.md` is the listing copy and the review
notes to paste into App Store Connect.

---

## Where it stands

**The tracker is finished.** Photograph a document, it reads the date, it
reminds you, it tells you how to renew. Notifications were verified on a real
iPhone on 6 September: scheduled by the planner, survived overnight, fired at
the right hour with the right countdown. 265 tests on the app, 108 on the
service.

**Expyr AI is built but cannot yet be sold or relied on.** The credit ledger,
the top-up screen, the Apple identity verification and the account linking all
exist and are tested. Three things stop it working: it cannot take payments,
the balance is held on the phone where it is editable, and reading a long PDF
still does not reliably finish.

**Which means there are two possible v1s, and the choice decides the next
fortnight.** Shipping the tracker alone needs one non-consumable and nothing
else: no accounts, no sign-in, no server-side balance, no account deletion, and
the privacy policy stays true exactly as written. Shipping Expyr AI with it
needs all of those, plus the paid Render plan, plus the one feature that still
does not work. Section 5 onward assumes the second; if the answer is the first,
sections 5, 6 and 7 move behind the launch instead of in front of it.

---

## 1.0.1, and what goes in it

**1.0 is live**, released 10 September from Pending Developer Release. Everything
below is for the next version. The rule for the list: fixes, and things already
decided. Nothing that depends on data the first week has not produced yet, so
no pricing changes, no model changes.

### For the coding session

**1 to 5, 8, 9, 10 and the version bump are on main**, done 10 and 11
September.
The items are left below as the record of why, with what actually shipped
noted against each.

Still open: **6** needs a phone, and **7 has not been started by anybody**
and is nobody's yet.

1. **Bundle 500 credits with Expyr Pro.** Today `premium: true` lifts the item
   and scan ceilings and does nothing else; the 300 welcome credits go to every
   install regardless. So a Pro buyer who has used them has paid AED 149 and
   holds zero Expyr AI. Fifty pages or twenty-five questions costs at most
   $0.50 against AED 120.62 of proceeds, seeds the metered product with the
   people most likely to buy more of it, and turns the paywall's weakest line
   into a reason to buy. **Once per device, keyed on the Apple transaction id,
   never re-granted on restore or reinstall.** Family Sharing means up to six
   grants for one purchase, which is $3 worst case; accept that rather than
   build cross-device dedup for it.

   *Shipped.* `PRO_CREDITS` in `server/products.ts` is the authority and the
   phone mirrors it in `credit-packs.ts`, with the agreement test reading one
   from the other. Granted through the same `redeem()` the packs use, so the
   transaction id already dedups it. A store that cannot hold credits does not
   block the purchase: Apple replays a non-consumable on every launch for
   ever, so the next sweep grants them. The paywall says what is included in
   the footnote and in the Guideline 3.1.2 block.

2. **A Bill category** in `src/data/document-types.ts`. The listing says
   `Documents, bills & renewals`; today bills are reachable only through Other
   plus recurrence. A first-class type with a generic label and a sensible
   default lead time. No UAE guidance needed.

   *Shipped.* `bill`, lead days [7, 1], `receipt-text-outline`, listed after
   Subscription. Deliberately not added to the `isSubscription` category
   fallback: that fallback is for records written before the app asked about
   recurrence, and treating the category as proof would make a one-off invoice
   roll itself forward for ever.

3. **The AED credit pack fallbacks** in `credit-packs.ts`: 12.99, 19.99 and
   39.99, read off real sandbox purchases. StoreKit shows the real prices, so
   this is the fallback being wrong rather than a live bug.

   *Shipped.* The table now also says which rows were read off a real purchase
   and which are still guesses.

4. **A rating prompt.** There is none in the app. Use `expo-store-review`, and
   fire it in one place only: **after "I have renewed this"**, when the app has
   just visibly kept its promise. Never on launch, never on a count of opens.
   The first twenty reviews weigh more in search ranking than any twenty after.

   *Shipped.* `src/lib/rating.ts`, fired from `add.tsx` only when a renewal
   actually moved the date, so correcting a typo does not count. Once per
   install, and the flag is spent only when iOS confirms it showed the sheet:
   `isAvailableAsync` is false in TestFlight, so a build there would otherwise
   burn the one chance on a prompt nobody saw. Which also means it cannot be
   seen before the App Store build.

5. **Verify subscription import against the free ceiling.** `add.tsx:66` gates
   on `documents.length >= FREE_ITEM_LIMIT` before adding. What happens when
   someone with two items imports six subscriptions? It should import what
   fits and show the paywall for the rest, not fail, and not silently drop the
   last four. This is the single most common first action a new user takes.

   *It was broken.* `subscriptions.tsx` wrote every ticked subscription with
   no reference to the ceiling at all, so two items plus six imported tracked
   eight. Fixed with `roomFor` and `splitImport` in `src/domain/capacity.ts`:
   what fits is added, and the rest is named in an alert offering Pro rather
   than dropped.

6. **Verify Restore Purchases end to end** on a real device: buy, delete the
   app, reinstall, restore, confirm Pro returns. It was never separately
   tested before submission.

7. **Count feature use on the server.** The week-eight pricing decision needs
   how many installs ever open Expyr AI, and Apple cannot see inside the app.
   Every `/extract`, `/read` and `/ask` already lands on Render. Count calls per
   day per route, and distinct install tokens that have ever hit `/read`, and
   expose it somewhere the account holder can read: a `/stats` route behind the
   shared token, or a daily line in the logs. No per-person tracking, no new
   SDK, nothing the privacy labels would have to mention.

8. **Bring `document-types.ts` into line with the verified guides.** The
   driving-licence eye test is listed at about AED 50 and costs AED 140 to 180;
   the Mulkiya late fee is AED 10 a month capped at AED 500, not a flat ~AED
   500, and driving in the 30-day grace period is allowed with valid insurance;
   Ejari online registration is AED 178, not 120; the visa fee is about AED 560
   for a standard renewal, not 300 to 1,200; the overstay fine is a unified AED
   50 a day since February 2026. Same numbers in-app and on the web pages.

   *Shipped.* The pages were already right, so this was the app catching up to
   them, and the two now say the same thing about all five: fee, fine, grace
   period and how long it takes. The Mulkiya was the one worth hurrying: a flat
   ~AED 500 against AED 10 a month capped at AED 500 is a fiftieth of what
   somebody would have budgeted for, and the old sentence also implied they
   could not drive during the grace period when they can, while the insurance
   is valid.

   Two things deliberately not done. The Mulkiya and licence fines are monthly,
   and `lateFeeRate` only speaks in days, so they stay sentences rather than
   running totals; AED 10 a month is not worth a new shape in the type. And the
   visa still has no `lateFeeRate` even though its AED 50 a day is now
   verified, because the grace period is thirty days *usually* and up to a
   hundred and eighty for Golden and Green holders, and the app cannot tell
   which somebody holds. A running figure would tell one of them they owe five
   thousand dirhams while they owe nothing. The file says so, where the next
   person will be tempted.

   The paywall line from item 10 moved with it, from AED 1,870 to AED 2,208 for
   five household papers, almost all of it the visa going from a guessed AED
   300 to a checked AED 560. The pinned total in the test is what caught it.

9. **Use the system font everywhere.** The first outside reader of the
   timeline said it looks machine-made, and named the fonts as the reason:
   Instrument Serif headlines over DM Sans. He asked for Apple's default. So:
   drop both `@expo-google-fonts` packages and the `useFonts` call in
   `_layout.tsx`, and make `Fonts` in `constants/theme.ts` resolve to the
   system font, SF Pro on iOS. Headlines keep their size and get weight
   instead of a serif: `fontWeight: '700'` with slightly tight
   `letterSpacing`, the way Apple's own apps do large titles. Big figures use
   `fontVariant: ['tabular-nums']` so columns of amounts line up. Grep for the
   two literal family names too; `add.tsx` uses them directly. Nothing else
   about the design changes: same paper, ink, spacing and radii. The launch
   screen will need the same treatment if it names a font.

   *Shipped.* Both packages and `useFonts` are gone, `Fonts` carries weight
   rather than a family, and `fontFamily` is left unset rather than named
   'System' so iOS resolves the optical size and the real bold cuts itself.
   Sizes and line heights are untouched; tracking now tightens as the size
   grows. Two judgements the serif never had to make: the large statements
   take 700 and row titles and figures take 600, because 700 at 22 points
   several times down a ledger shouts; and the title field on the add form
   takes 600, since the heaviest weight in the app on an empty input reads as
   a warning. The splash is no longer held waiting for type. Nothing in
   `app.json` named a font, and the PDF stylesheet never did.

10. **The paywall opens with the person's own numbers.** Above the plan table,
    one line built from their data: "You are tracking 5 items worth AED 2,340
    in renewals", using the items they have and the fees from
    `document-types.ts`, falling back to "You are tracking 5 items" when no
    fee is known and to nothing at all when the list is empty. The paywall is
    reached from the item ceiling, the scan ceiling, the subscription import
    and Settings, and in the first three the person has just watched the app
    work; this line makes the screen about what they have rather than what
    they lack. Never show the paywall on launch. The reasoning is in
    `business/MONEY.md`, under the hard-paywall section.

    *Shipped.* `src/domain/renewal-value.ts` reads the money out of the fee
    prose, which is written for people and not for parsers: ranges, tildes, a
    second fee bolted on the end, a word in front of the currency. It takes the
    bottom of every range, because adding up the top of each would make a
    number nobody could defend on a sales screen, and a document with no known
    fee adds nothing rather than an estimate. Five household papers come to
    AED 1,870 today.

    One thing the item did not say, and it matters: the money shows only where
    the fees have been checked, which is the UAE. Everywhere else the app
    already refuses to show renewal fees rather than guess at them, and a
    paywall quoting dirhams to somebody in Karachi is that same invention with
    a price on it. Outside the UAE the line is the count alone.

    "Never on launch" needed no change, and now has a test: the paywall is
    reached from `add.tsx`, `subscriptions.tsx` and Settings, and neither the
    root layout nor onboarding mentions it.

11. **Bump the version to 1.0.1** so App Store Connect accepts the build
    against a new version record.

Open and non-blocking, from earlier sections: the dark-mode shadow glow in
section 8, and the Haiku-versus-Sonnet comparison for the brief in
`PRICING.md`.

### From the first outside users, 11 September

Three stumbles from three people in one afternoon, all in the scan, which is
the feature the listing leads on. These outrank everything above that is not
already done.

12. **The document type is guessed wrong.** A passport came back as an
    Emirates ID once and as a residence visa twice; the entry read "Residence
    Visa for AEHED SAID SHERIF" with the note "Expiry date printed as
    20/08/2026 in the visa details". Extraction runs on `claude-haiku-4-5`
    by default (`EXPYR_MODEL` in `server/extract.ts`) and the prompt lists
    the categories with no tells for telling them apart. Three parts:
    - **Move `/extract` to `claude-sonnet-5`.** About $0.015 a scan against
      $0.003; ten free scans is $0.15 an install worst case, and the whole
      product is "it read the document right". Costed in `MONEY.md`.
    - **Give the prompt the physical tells**, not keywords. A passport is a
      booklet data page with a two-line MRZ beginning `P<`, and it stays a
      passport even though it names a nationality and a visa may be stuck in
      it. An Emirates ID is a card headed UNITED ARAB EMIRATES / IDENTITY
      CARD with a 784 number and a three-line MRZ beginning `I<`. A residence
      visa is a passport page or e-visa printout carrying UID, file number,
      sponsor and RESIDENCE. Decide the type from what the object is, then
      read the dates.
    - **Return a type confidence.** When it is not high, the add screen asks
      one question before anything else: "This looks like a passport. Is that
      right?" with the category picker one tap away. A wrong category is
      wrong guidance, wrong lead time and a wrong title, so it is the one
      thing worth interrupting for.

13. **One screenshot, many things.** The prompt says "Return exactly one
    item". So "Choose a photo" on the document path, given an iOS
    subscriptions list, returned the first subscription as a document and
    dropped the rest. The subscriptions path in `subscriptions.tsx` reads
    lists fine, but the person does not know there are two paths, and should
    not have to. One entry point: the model first says what the image is, a
    document, several documents, or a list of subscriptions, and returns
    every item it finds. The app then shows a review list, "Found 4 things in
    this screenshot", each with its category and date, tick to keep, tap to
    fix, then saves them against the free ceiling with the paywall for any
    that do not fit. Two sides of one Emirates ID are one item; two cards on
    a table are two.

14. **A clear passport, a misspelled name, and no way to fix it.** Two
    faults. The name should come from the MRZ on passports and Emirates IDs,
    read alongside the printed name, preferred, and flagged when they
    disagree. Correction from the coding session: the MRZ name itself carries
    no check digit under ICAO 9303; the document number, birth date, expiry
    and a composite do. Those still make the zone trustworthy as a whole,
    since a read that gets four check digits right did not invent the name
    beside them, and one failed digit drops the zone entirely. And every
    extracted field must be editable somewhere. `add.tsx` around line 102
    keeps them read-only on purpose, to keep the form short, which is right,
    but the document's own screen then has to allow tap-to-edit on each
    field, including the person's name. A household member created from a
    scan needs the same. A name nobody can correct is worse than no name,
    because it goes into a government form.

**All three on main, 11 September** (a4f862d, 134de9d, c051c0e; 421 app
tests and 193 service tests). What shipped against the brief: Sonnet 5 on
`/extract`, a separate type confidence so a perfect date and an invented
category no longer average to "high", the one-question confirm below high, a
scan-written title dropped when its category was wrong, "other" exempt from
the question. For 13, the service first says whether the picture is a
document, documents or a subscriptions list, and a list is handed to the
existing importer with the original image rather than the document prompt
learning a second copy of that job; several documents get the review list,
dates corrected on the item's own page rather than inline. For 14, the MRZ
expiry is check-digit protected and unambiguous, which also settles the
category; guarded to passports and Emirates IDs; every scanned field is
tappable on the document screen. Household members needed nothing, since no
scan creates a person and renaming already rewrites their documents.

**Pushed and deployed 11 September**, on Hashem's say-so, because the
service change reaches 1.0 users the moment it is on origin: scans go from
$0.003 to $0.015 and a subscriptions screenshot on the document path stops
returning a wrong item and starts pointing at the importer. Render restarted
on the push and `/health` answered ok within a minute. The coding session
then made three live `/extract` calls, about 4 cents: one document classified
and dated with 1.0's fields intact at the top level; a subscriptions list
returning no items and a note that sends old builds to the importer; two
cards in one frame returning two items, both day-first dates read day-first.
Still needing a phone: the review list, the "is this a passport" question,
and the MRZ path on a real passport.

Before and after, run the three actual images through: the passport that
became a visa, the subscriptions screenshot, and the misspelled passport.
They are on Hashem's phone and stay out of the repo.

15. **One rule for titles.** Decided with Hashem 11 September, after the
    scan wrote "Residence Visa for AEHED SAID SHERIF". The title says what
    the thing is; the owner field says whose it is; the app shows them
    together. A title is the thing in the words a person would say, with one
    distinguishing detail when there is one: "Egyptian passport", "Toyota
    Corolla Mulkiya", "Marina Heights tenancy", "Driving licence", "Netflix".
    Never a date and never a person's name, because the name already lives
    in Whose is it and two copies drift. Word order is the way a person
    speaks it, kind last: "Egyptian passport", not "Passport, Egyptian"; the
    list already scans by kind because the category is printed beside any
    title that does not contain it. The extraction prompt writes titles by
    this rule, the placeholder on the add screen shows it, and every list
    row shows the owner beside the title so nothing is lost by taking the
    name out.

    **On main as e9bea67, deployed 11 September.** Verified against the real
    model before deploying: "Toyota Corolla car insurance", "Gold Gym Dubai
    membership", "Samsung TV warranty", with the insured person's name in the
    fields rather than the title. The rows already showed the owner; what was
    actually wrong was a document filed under your own name printing your
    name beside it, and one `isMine` rule now serves the row and the
    household page. The title field stays prefilled with the category name,
    so the placeholder only appears to somebody who clears it; stopping the
    prefill was offered and declined, because the category name is a correct
    title under this rule for most items.

16. **A test file inside the routes folder broke Expo Go**, found by Hashem
    11 September on the first design pass: expo-router bundles every file
    under `src/app` as a screen, so `paywall.test.ts` went into the app and
    its Node import failed on the phone. Every test passed while the app was
    broken, because vitest does not care where a file lives. Fixed on main as
    5657e49: the file moved to `src/paywall.test.ts`, and `src/bundle.test.ts`
    now fails on any test file under `src/app` and on any Node import from
    there. Verified by `npx expo export --platform ios` producing one clean
    bundle. **Run that export once before every build**; about ninety
    seconds, and it catches this whole class before a build is spent on it.
    Also on main as 51365a7: `/health` reports the running commit, so a
    deploy is proven by comparing it with `origin/main` rather than by the
    service merely answering.

17. **The screens still read as machine-made, and the font was only the
    first tell.** Hashem, 11 September, with three screenshots and the
    offending parts circled, on the system font: tracked uppercase eyebrows
    ("FRIDAY 11 SEPTEMBER", "CREDITS", "OVERDUE", "PLAN"), a big numeral
    with a shrunken unit beside it ("10 credits"), a chatty grey second line
    under every row with a full stop ("25 booked with iOS, each at 9am."),
    the middot-joined caption, the three-sentence fine print under a buy
    button, a mint pill button inside every row, and a headline that is a
    sentence with a period ("One expired."). Each is a signature of
    generated interfaces; together they are unmistakable. This is a
    restructure of the visual language, not a style tweak, and the rule is:
    **Expyr uses Apple's own vocabulary, so that a screen set beside
    Settings or Reminders reads as a native app rather than an imitation.**

    The vocabulary, applied everywhere:
    - **Type**: Apple's text styles only, at their sizes and weights: Large
      Title, Title 2, Headline, Body, Subheadline, Footnote, Caption. No
      `letterSpacing` anywhere; SF tracks itself. No `textTransform:
      uppercase` outside grouped-list section headers, and those are
      Footnote grey with no added tracking, as in Settings. Dynamic Type on.
      The `label` style in `themed-text.tsx`, 1.1 tracking and uppercase,
      goes.
    - **Lists**: inset grouped lists, the Settings pattern: rounded group,
      rows with a leading SF Symbol, title, a value or chevron on the right.
      Settings, Top up, the document screen and Household use it.
    - **Buttons**: one filled primary button per screen, at the bottom.
      Row-level actions are tinted text ("Top Up", "Unlock") or a chevron.
      No pills inside rows, no "Test" and "Reset" buttons beside labels.
    - **Numbers**: number and unit in one size, "10 credits", "1,500
      credits", "AED 12.99", right-aligned in the row. The unit never
      shrinks and never floats beside a display numeral.
    - **Secondary lines**: only when they carry a fact the person acts on;
      sentence fragments, no full stop, no middot. "25 booked with iOS, each
      at 9am." becomes "25 scheduled" or nothing. "Saved on this iPhone ·
      included in your backup" becomes a Footnote under the group, one
      clause.
    - **Headlines**: a Large Title that names the screen, "Timeline",
      "Settings", "Expyr AI". Not a sentence, no period. The date line above
      it goes; the day is in the status bar. State lives in section headers:
      an "Overdue" header in red over the overdue rows.
    - **Fine print**: one line under a buy button, the least Apple requires:
      "One-time purchase. Credits do not expire." Nothing else.
    - **Icons**: SF Symbols via `expo-symbols`, nothing from
      MaterialCommunityIcons, including the tab bar and the document tiles.
    - **Colour**: keep paper and ink and the mint tint, and use iOS semantic
      colours for secondary and tertiary text rather than custom browns, so
      the greys are the greys people already know.
    - **The timeline row**: a normal row, title, "Expired 20 Aug" as the
      subheadline, the SF Symbol tile on the left. The big-date tile with the
      dot goes.

    Delivery: screen by screen, Timeline, Settings, Top up, Paywall, Add,
    the document screen, Household, Expyr AI. Hashem checks each in Expo Go.
    The test is the one he gave: if it still looks generated, it is not
    done, and removing an element beats restyling it.

    **Progress, 11 September evening.** Foundation (Apple type scale, no
    tracking, unit with the number, iOS greys) in b1c2818; Timeline in
    a384b65 and 0f73e67: Large Title, red Overdue header, category symbol
    tiles in Apple's system colours fixed per category with red reserved for
    the overdue state, four summary cards (Overdue, Next 30 days, All,
    Household) that filter the list, inset grouped card; iOS system
    backgrounds in both modes with mint as tint only. The Expo Go toast was
    expo-iap resolving its native module lazily behind a Proxy, so the
    import guard never fired; fixed in a93a640 by asking at initConnection,
    and purchases are now known to be untestable in Expo Go by design.
    Decisions: "Next 30 days" not "This month"; empty state keeps one button;
    the collapsing Large Title is **deferred past 1.0.1**, because a real one
    needs a native stack inside each tab and a JavaScript imitation is the
    kind of near-miss that reads as fake. Settings in dc5f135: pills
    gone, action rows in tint, chevrons for navigation, balance as the row
    value, "25 scheduled" with a "25 of 40" form for the iOS 64-notification
    cap, Appearance as a segmented control. **Hashem approved Timeline and
    Settings and kept the forest-green accent.** Remaining: Top up, Paywall,
    Add, the document screen, Household, Expyr AI.

18. **Reading is not a step.** Hashem, 11 September: a person adds a
    document and Expyr AI can only answer about it after they scroll to the
    bottom of the document page and tap "Read this document", which nobody
    finds. Design: a photo scan comes back already read, the extract call
    returning the page text alongside the fields at no extra credits, since
    Sonnet has already looked at the page; an attached PDF is read on attach,
    charged per page, silently up to 10 pages and with one sheet beyond
    ("Read all 24 pages for 240 credits?"); with no credits the document
    saves unread and the page says "Not read yet. Top up to ask Expyr AI";
    the button becomes a tinted "Ask Expyr AI about this" row; subscriptions
    are never read; a Settings toggle "Read documents automatically", on by
    default. Ordered after the screen restructure since it changes the
    document page's bottom half.

### Not code, but goes on the same version

- **The angled screenshots**, seven frames at 1284 x 2778 in
  `Downloads/expyr-appstore-angled`. Screenshots cannot change on an approved
  version, so they wait for this one
- **The App Preview video**, once recorded. Shot list is in `business/GTM.md`
- **The Expyr Pro product description** in App Store Connect, if the credit
  grant ships: `Unlimited items and scans. 50 AI pages free.` is 44 of 45
  characters. Changing an in-app purchase's localisation resubmits that
  product for review, so it rides with the version
- **English (U.K.) localisation** for the Middle East storefronts, if not yet
  added. Copy is in `STORE.md`

### Already done on main, kept here so nobody redoes it

The HEAD 404 on `/health`, the three wrong Pro prices in `PRICE_POINTS`, the
product identifiers, server-side spending in `routes.ts` via `charge()`,
Sign in with Apple, account deletion, and the four policy rewrites.

---

## 1. Apple admits you — YOU, done

- [x] Enrol as an **Individual**, $99, paid 6 September
- [x] **Admitted 7 September.** App Store Connect access confirmed by email

## 2. App Store Connect — YOU, done 7 September

**All of it.** The ordered version, with the reasoning and the exact screens, is
`business/APP-STORE-CONNECT.md`. What was done, in the order Apple forces:

- [x] **Digital Services Act trader question.** Answered *not a trader*, because
      there is no plan to sell in the EU. Declaring trader would have published a
      home address and phone number on the product page in all 27 EU
      territories, and would have needed business documents that do not exist.
      Reversible per account and per app
- [x] **Legal entity information**, which blocks the agreement until it is set
- [x] **Paid Applications agreement signed**, and **Active** the same afternoon
- [x] **Banking**, FAB, AED. Active faster than the 24 hours Apple warned about.
      One thing still worth a look: royalty currency reads USD against an AED
      account, so FAB may be taking the conversion spread rather than Apple
- [x] **Two US tax forms**, both Active. Apple asked for the Certificate of
      Foreign Status first, which carries no treaty section and no TIN field,
      then the W-8BEN, which carries both. Part II left empty because there is
      no US treaty with the UAE, and both TIN fields left empty because the UAE
      issues no tax number to individuals
- [x] **Small Business Program submitted.** All four associated-account
      questions No. Apple's own page says the reduced rate applies **fifteen
      days after the end of the fiscal month in which enrolment is approved**,
      so roughly six weeks, which is why it was worth doing before there was
      anything to sell
- [x] **App record created.** Apple ID `6809437011`, bundle `com.expyr.app`,
      SKU `expyr-ios-01`, name `Expyr: Expiry Reminders`, primary language
      **English (U.S.)**. The user-facing "licence" spellings stay British
      anyway, because the RTA issues a driving licence and the document in the
      reader's hand says so
- [x] **Subtitle, categories, content rights.** `Documents, bills & renewals`,
      Productivity and Utilities, content rights answered **yes** because brand
      logos are third-party content shown under nominative use
- [x] **Age rating: 4+**, no override
- [x] **Pricing and availability.** Free app, **all 175 storefronts** and future
      ones automatically. Apple Silicon Mac and Vision Pro both unticked:
      untested platforms, and Apple itself flagged 1.0 as incompatible with
      Vision Pro
- [x] **App Privacy published.** Photos or Videos, Other User Content and Device
      ID, all **Data Not Linked to You**, all App Functionality, none used for
      tracking. **Updated during the review exchange, 7 to 8 September, and correct as of 10
      September:** five types. Photos or Videos and Other User Content stay Not
      Linked, read and discarded. User ID, Device ID and Purchase History are
      Linked to identity, all App Functionality, none used for tracking. No
      Contact Info, because no email scope is requested. Verified against the
      live App Privacy page.
- [x] **All four products created**, priced and localised. The identifiers match
      `PRO_PRODUCT_ID` and `PACKS` in the code, which is the authority:

      | Identifier | Type | Base price |
      |---|---|---|
      | `pro.lifetime` | Non-Consumable, **Family Sharing on, irreversibly** | AED 149.00, UAE |
      | `credits.small` | Consumable | $2.99, US |
      | `credits.medium` | Consumable | $4.99, US |
      | `credits.large` | Consumable | $9.99, US |

      Pro is based in the UAE because AED 149 is a judgment about what the home
      market pays. Credits are based in the US because the cost is in dollars
      and the margin test in `credit-packs.test.ts` is written in dollars.

      **What Apple generated pays less at home than abroad.** After local tax
      and the 15% commission: UAE **AED 120.62** (~$32.84), US **$33.99**,
      eurozone **€32.14**, UK **£28.33**, Saudi **SAR 133.03**, Qatar
      **QAR 127.49**. The UAE is the lowest of the six
- [x] **Sandbox tester**, UAE region so it sees AED 149. Idle until there is a
      development build, because IAPs do not run in Expo Go
- [x] **The 1.0 version page**: promotional text, description, keywords, support
      URL, copyright, review notes, sample document attached. Release set to
      **manual**, so the app does not go live at 3am

## 3. Upgrade Render to the $7 plan — YOU, done 7 September

Not optional any more, and it buys three things at once:

- The credit ledger needs a **persistent disk**. Without one it falls back to
  memory and refuses to sell, which is correct and also means credits cannot
  work at all
- The **22 second cold start** goes. App Review would read that as a broken app
- It is the leading remaining explanation for **reading not finishing**: a
  tenth of a shared CPU parsing multi-megabyte PDFs

- [x] Upgrade the instance. Starter, 0.5 CPU rather than 0.1
- [x] Attach a disk at `/var/data` and set `EXPYR_CREDITS_DIR`
- [x] Set `EXPYR_GUIDANCE_DIR` too, so the guidance cache survives a deploy
- [x] Set the three Apple keys, or `/purchase/redeem` refuses every purchase:

      | Variable | Value |
      |---|---|
      | `EXPYR_APPLE_KEY_ID` | `2AX49534J2` |
      | `EXPYR_APPLE_ISSUER_ID` | `51eccb44-a2ab-4d3c-852f-362796657233` |
      | `EXPYR_APPLE_KEY` | the contents of the .p8, which never goes in this repo |

      **Paste the whole .p8, including the BEGIN and END lines.** Without them
      it is base64 text rather than a PEM key, and it fails at the first
      purchase as a 401 from Apple with no explanation. It happened.

- [x] **Verified live.** `GET /health` reports every one of these, so a deploy
      that half worked says so instead of looking identical to one that did:

      ```
      creditStore: disk        credits can be sold
      appleKeyUsable: true     the key actually signs, not merely exists
      guidanceCache: disk      the disk is mounted and writable
      ```

## 4. A development build — ME, needs 1

Sign in with Apple needs a native entitlement and **does not run in Expo Go**.
This is the wall between here and credits surviving a new phone.

- [ ] `eas build` for a development client
- [ ] Install it on your iPhone in place of Expo Go

## 5. Make the money work — ME, needs 2 and 3

- [x] **StoreKit wired**, on expo-iap rather than a third party. `purchase()`,
      `purchaseCredits()` and `restore()` are real; the paywall and the top-up
      screen call them; an interrupted purchase is recovered at launch
- [x] **Credits granted on a verified purchase.** The service asks Apple's App
      Store Server API what the transaction was, `server/products.ts` decides
      what it is worth, and the ledger pays a transaction identifier once
- [x] **Tested on the phone, 7 September.** All three of them: a credit pack
      credited 0 to 1,500, a second pack added rather than replaced, and Expyr
      Pro entitled instantly. The balance survived a force quit, which is the
      one that proves the credits live on Render's disk rather than in the
      phone's memory, and is what the paid plan was bought for.

      Two things had to be true that were not obvious. The sandbox account is
      signed in under **Settings, Developer, Sandbox Apple Account**, not
      Settings, App Store, where Apple's own documentation still points; and a
      real Apple Account cannot buy in the sandbox at all, which surfaces as
      "not authorised to make purchases" and reads like a code fault.

- [x] **Paid Applications agreement Active, 7 September.** With banking
      (AED, royalties in USD), both tax forms, and the Digital Services Act
      declaration, across 175 countries. Nothing commercial blocks selling any
      more; what remains before launch is the app itself
- [ ] Move spending to the server. `/read` and `/ask` still trust the balance
      the phone reports, and a balance in local storage is a number its owner
      can edit
- [x] **Sign in with Apple on the phone.** Offered rather than required, and
      only where it earns its place: on the top-up screen and in Settings, and
      only once somebody has credits worth protecting. Asks Apple for no scopes
      at all, so no name and no email is ever received

## 6. What accounts oblige you to add — ME, needs 5

- [x] **In-app account deletion**, under Settings, as Guideline 5.1.1(v)
      requires. Proved with a fresh Apple sheet rather than the install
      credential, because an install token is something a stolen phone already
      has and this erases a balance somebody paid for
- [x] **Unspent credits are forfeited, and the app says so before you tap.**
      There is no honest alternative: Apple handles refunds, and a balance kept
      "just in case" after somebody asked to be deleted is exactly the data
      they asked us not to hold
- [x] **Both privacy policies rewritten, in the same change as sign-in.** The
      absolute claim is gone from all six places; what replaced it is narrower
      and still true: nothing you track is ever sent to a server. A new section
      says what an account does hold, which is an opaque identifier and a
      number, and that deleting it erases both.

      **The App Privacy labels match, done during the review exchange and
      verified on the live page 10 September.** User ID and Purchase History
      added as linked, Device ID moved to linked, the two content types left
      unlinked, no Contact Info. The reasoning is in `REVIEW-REPLY.md`.

## 7. Make reading finish — ME, needs 3

Still the one feature that does not work. A 14-page contract reached 12 pages
and gave up. Everything cheap has been tried: parallel batches, a page count
that costs nothing, streaming, per-batch banking, a retry pass, half the server
work removed.

- [x] **It works.** Tested 7 September on the paid plan against a real Asteco
      tenancy contract with a Schedule of Fees and a separate Terms and
      Conditions bundle. It read the whole thing and returned clause-cited
      findings: the early-termination penalty, the deposit deduction clause,
      the bounced-cheque escalation, the late-renewal daily charge, the parking
      fine, the contents-insurance disclaimer. Clause 10, Clause 25, Clause 34,
      Schedule of Fees.

      **A full CPU was the answer.** Everything cheap had already been tried
      and none of it was the problem: it was a tenth of a shared core parsing
      multi-megabyte PDFs. The  plan was the fix.

      Expyr AI ships. The Ask tab does not need hiding, and section 4 of
      APP-REVIEW.md, which asked whether a parked feature should keep a visible
      tab, is now moot.
- [x] **Nothing is read without being agreed to, and nothing is read in part.**
      The 30 page cap was built and then removed: a contract read to page
      thirty cannot answer about page forty, and every answer carried a hole
      the reader could not see. Pages are counted first, which is free, and the
      price is put to somebody before a page is fetched. Reading no longer
      starts on its own either, which it used to do the moment a document was
      opened

## 8. Decisions still open — YOU

- [x] **Brand icons — keep pulling them, and the reason changed on inspection.**
      Bundling logos would mean shipping copies of other companies' trademarks
      inside the binary, which is a stronger claim on their marks than linking
      a publicly served favicon, not a weaker one. It would also lose the long
      tail this app most needs: Shahid, du, STC, Careem.

      The silent-breakage risk was smaller than I described. Icons are stored
      on the phone after the first fetch, the server caches across users, and a
      missing icon already falls back to the category glyph without saying
      anything.

      The real bug was the opposite of the one I raised: a guessed domain with
      no icon, like mygym.com from "My gym", was asked for on every launch
      forever. A definite no is now remembered for thirty days; a timeout or a
      502 still retries, because that is about the moment rather than the
      domain.

- [ ] **The summary model.** The brief runs on Sonnet 5 at roughly twice the
      price of everything around it. Worth comparing Haiku on a real contract
- [x] **Your name** — handled, and it needed no new decision. Renaming "Mine"
      already set ownName and buildHousehold already folded a matching person
      into the owner's card; nothing said so. The card now reads "Tap to add
      your name" when there is nothing more urgent to say, and tapping it opens
      the rename rather than an empty timeline. Sign in with Apple can still
      pre-fill it later for anybody who signs in
- [ ] **The glow in dark mode.** Shadows are tinted with `theme.text`, which is
      near-white in dark mode, so the camera button wears a halo rather than a
      shadow. Longstanding rather than new, and a taste question: shadows are
      usually dark in both themes. Worth a look on the phone before deciding

## 9. The things a listing needs — YOU, with ME where useful

- [x] **App icon** — already exists at `assets/images/icon.png`: a sheet of
      paper with the corner turned, deep green on warm off-white, built from
      the design system on 31 August. Android adaptive and splash variants too
- [x] **Sample document attached** to App Review Information, so a reviewer can
      test scanning without owning a UAE document
- [x] **App Privacy labels published.** Declared as collected rather than not,
      because Apple's definition of "collect" covers what a third-party partner
      can access, and Anthropic can. Not linked to identity, not used for
      tracking
- [x] **Age rating: 4+**, no override. This entry used to warn that Apple's
      questionnaire asks about AI and chatbots. **It does not.** Walked end to
      end on 7 September: seven steps, none about AI. The nearest is "Messaging
      and Chat", defined as users communicating *with one another*, which Expyr
      has none of. The AI is disclosed in the review notes instead, which is
      where a reviewer actually reads it
- [x] **Review notes pasted**, from `review-notes.txt` rather than `STORE.md`.
      **The block in `STORE.md` is 6,034 characters and the field caps at
      4,000.** It would have truncated silently, part-way through the business
      model section, which is the part that prevents a 3.1.1 rejection. The cut
      version is 3,993
- [x] **Screenshots done**, 7 September. Seven frames at **1284 x 2778**, the
      6.5 inch slot. Note the size: 1290 x 2796 is the 6.9 inch slot and App
      Store Connect rejects it in the 6.5 one.

      Each is the app on warm paper with an Instrument Serif headline, which is
      the app's own display face, so the listing and the product read as one
      thing. Status bars repainted to 9:41 with a full battery, because a 22
      percent battery in every shot is the kind of small scruffiness that makes
      a listing look unfinished.

      Seeded with an invented American household, Michael and Sarah Bennett,
      and an invented Denver lease, because these pages are public forever and
      a real tenancy contract has a real person's name on it.
- [ ] (superseded) **Screenshots**, 6.7" and 6.5". Guideline 2.3.3 rejects title art and
      splash screens; show the app in use. **One should show the subscription
      scan working**, since the listing now leads on it and that feature sells
      itself by being seen rather than listed
- [ ] **One purchase-screen shot attached to each of the four products.** Apple
      will not let a product leave Prepare for Submission without it

## 10. Submit

- [x] **Approved, 10 September 2026, 21:18.** First submission, no rejection,
      three days after the developer account was admitted. Status is Pending
      Developer Release because release was set to manual, so nothing goes live
      until the button is pressed. **Released the same evening.** Apple says up
      to 24 hours to appear in every storefront.

      **The angled screenshots do not go on this version.** Screenshots,
      description and keywords require a new version once approved; only
      promotional text, URLs, copyright, pricing and availability can change
      without re-review. Cancelling the release to swap them would mean a
      fresh reviewer and one to three more days against an approval already in
      hand. They ship with 1.0.1, which needs a new build anyway. The finished
      set is in Downloads/expyr-appstore-angled, seven frames at 1284 x 2778.


- [x] **Build 1.0.0 (2) uploaded to App Store Connect**, 7 September, 23:43.
      Production profile, App Store distribution provisioning, and EAS confirmed
      loading both production environment variables, so the shipped app reaches
      Render rather than talking to itself. Processing at Apple.

      The App Store Connect API key was generated as **APP_MANAGER**, not the
      default ADMIN. The key lives on EAS servers, and ADMIN over an account
      that now holds banking details, tax forms and signed agreements is more
      authority than uploading a binary needs.

      One thing found on the way: the EAS account already held a submit key for
      **Team 92YVBQMR64, Majed Salem**, from an earlier project. Choosing it
      would have tried to upload Expyr into somebody else's developer account,
      and the error would not have said so. Do not pick it on a future submit.
- [x] **EXPO_PUBLIC_EXTRACT_URL and EXPO_PUBLIC_SCAN_TOKEN set on EAS**, for
      production and preview. This was a submission blocker that fails
      silently.

      A development build is safe: developmentClient means the JavaScript comes
      from Metro, which reads the local .env. A release build inlines
      EXPO_PUBLIC_* during the EAS build instead, and .env is gitignored so EAS
      never receives it. Both variables are then undefined, and service.ts
      falls back to http://<hostUri>:8787, where hostUri is undefined in
      production, giving **http://localhost:8787**. localhost matches the
      private-host allowlist, so assertEncrypted raises nothing.

      No error, no warning, a healthy-looking build, and every scan, read and
      purchase verification quietly trying to reach a server on the phone
      itself. Plain text visibility is correct: anything prefixed EXPO_PUBLIC_
      is inlined into the bundle and readable by anyone who unpacks the app,
      which is exactly why the per-install token in install-token.ts exists.
- [x] **Purchases proven end to end on the development build**, 7 September,
      against the sandbox account. A purchase completes and credits are
      granted. That closes the largest rejection risk on this list: a paywall
      that cannot take money is what APP-REVIEW.md calls the single most
      reliable rejection there is.
- [ ] **Restore Purchases**, which is a separate requirement under 3.1.1 and the
      one that gets skipped because the purchase itself worked. Delete the app,
      reinstall, tap Restore, watch Pro come back
- [ ] Test the rest on the development build, not Expo Go
- [x] **Cold start handled.** Measured at 52.7 seconds on the free plan, which
      an uptime monitor read as the service being *down* the first time it
      looked. That is the conclusion App Review would have reached. An
      UptimeRobot keyword monitor now hits `/health` every five minutes looking
      for `"ok":true`, and the paid plan does not sleep in any case
- [x] **Anthropic spend limit raised, 11 September.** Still $20/month with a $10
      notification, sized for one developer rather than an audience. At roughly
      $0.08 of API cost per install that runs out at about **250 installs in a
      month**, and the failure is not a bill you regret: the API starts
      refusing, scanning stops working, and the first reviews Expyr ever gets
      are about a feature that had simply stopped. Raise to **$150 with the
      notification at $50** before launch.

      **What was actually set**, one day after release and two users in:
      $20 of credits bought, auto-reload on at $5 back up to $20, monthly
      limit **$60**, notification **$20**. A cautious tier chosen on purpose:
      the limit caps the worst month at what a few hundred installs would
      have to earn, and the $20 email is the trigger to raise it. If that
      email arrives, it is because the app is being used, which is the
      problem worth having. **Auto-reload on**, $25 when the balance drops below $10. This file used to
      say leave it off, on the grounds that a breaker which rearms itself is
      not one. That was wrong for a prepaid account: with auto-reload off the
      *balance* becomes the breaker, at whatever number was last loaded, which
      nobody chose for the purpose. The monthly limit is the breaker; auto-reload
      only stops the balance being the accidental one

---

## Already done

Kept so nothing gets redone by accident.

- Notifications, verified on a real iPhone
- Privacy manifest and export compliance declared in `app.json`
- Privacy policy, support and terms pages live at
  hashemelsaid.github.io/expyr, and set as the App Store Connect URLs
- Permission strings written to Guideline 5.1.1(ii)'s standard
- The credit ledger, the top-up screen, per-page charging, resumable reads
- Apple identity verification and account linking on the service
- Every React Native 0.86 deprecation cleared
- Anthropic spending capped three ways: $10 notification, $20 limit,
  auto-reload off. Superseded: see the Anthropic item in section 10
