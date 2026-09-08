# App Store listing

Draft copy for App Store Connect. Editable — a starting point, not a finished
submission.

**The numbers below come from the code.** The free limits are
`FREE_ITEM_LIMIT`, `FREE_SCAN_LIMIT` and `FREE_READ_LIMIT` in
`src/store/settings.tsx`; the price is `PRICE_POINTS` in `src/lib/purchases.ts`.
A previous version of this file advertised a free tier twice as generous as the
app delivers, and a subscription the app does not sell. If you change a limit or
a price, change it here in the same commit.

Compliance findings live in `APP-REVIEW.md`.

---

## Name (30 characters max)

```
Expyr: Expiry Reminders
```

## Subtitle (30 characters max)

```
Visa, documents & renewals
```

26 characters. Changed 7 September, from `Visa, licence & renewal alerts`.

Two reasons. Ten of the thirteen categories are documents and the old subtitle
never said so, which undersold the app to anybody reading the one line they get
before deciding to tap. And "alerts" was dead weight: "Reminders" is already in
the app name, and Apple indexes name and subtitle together, so it was a word
bought twice.

**Bills were considered and rejected.** There is no bill category. No DEWA, no
du, no Etisalat, nothing recurring. Advertising one would be Guideline 2.3.1,
and the same shape as the AED 79/year price this file used to carry.

## Pricing

**One non-consumable in-app purchase. Paid once. Nothing renews.**

`AED 149` in the UAE, with per-storefront price points listed in
`src/lib/purchases.ts`. Not a subscription — the app is built to be silent, and
the months where nothing expires are it working rather than failing. Renting
silence invites "what am I paying for?" at every renewal.

Free plan, enforced in code:

| Ceiling | Free |
|---|---|
| Items tracked | **5** |
| Photos scanned | **10** |

Expyr AI is separate, and paid for in credits rather than capped: ten credits
reads a page, twenty answers a question, and a new install starts with thirty
pages' worth. See `PRICING.md`.

Five items is deliberate: it fits one person's own papers, so the wall lands on
the sixth item, which is almost always someone else's.

## Two English listings, not one

Decided 7 September 2026, when availability went from UAE-only to all 175
storefronts. The listing below used to open with "Photograph your Emirates ID,
visa, Mulkiya or tenancy contract", which is the right sentence for Dubai and
gibberish in Denver.

The fix is not to strip the UAE out. **App Store metadata is localized by
language, and Apple's English locales map to different storefronts:**

- **English (U.S.)** is the primary and the global fallback. Anyone whose
  storefront has no closer match sees it
- **English (U.K.)** serves the UK, the Commonwealth and the Middle East,
  including the UAE

So Expyr gets two listings rather than one compromise, and **two keyword fields
rather than one**, which is 100 extra indexed characters for free. Each is
written for the people who will actually read it.

Add English (U.K.) as a second localization in App Store Connect. If the
storefront mapping turns out differently from expected, nothing breaks: the
U.S. listing remains the fallback everywhere.

---

# English (U.S.) — the international listing

## Subtitle (30 characters max)

```
Documents, bills & renewals
```

27 characters. Changed 7 September from `Visa, documents & renewals`, to widen
past documents. `visa` moves to the keyword field, where it keeps its search
value without spending a third of the subtitle, and the UAE listing keeps it in
the subtitle where it earns its place.

## Promotional text (170 characters, changeable without review)

```
Documents, subscriptions and bills all have dates you cannot afford to miss. Photograph them once. Expyr reads the date, reminds you in time, and tells you how to renew.
```

169 characters, one under the limit. Do not add a word to it without counting.

## Description

```
Expyr makes sure nothing in your life expires without warning.

Photograph a document and Expyr reads the date for you. No typing, no forms.
Passports, driver's licenses, residence permits and visas, national ID cards,
vehicle registration, insurance policies, leases and tenancy contracts, work
permits and warranties, from a photo, a PDF, or a screenshot of an email.

SUBSCRIPTIONS AND BILLS, NOT JUST DOCUMENTS

Take a screenshot of your App Store subscriptions list and Expyr reads every
one of them: what it is, what it costs, and when it renews. Add the ones that
are not on that list by hand, a gym membership, a phone plan, a payment that
falls due every month, and see what your year costs before it arrives.

Nothing is connected to your bank. Nothing reads your email. You show Expyr a
screen and it reads the screen.

WHAT IT DOES

• Reads the date from a photo, a PDF, or a screenshot
• Pulls out the whole document, not just the date: names, numbers, issuing
  authority, amounts, so it is useful the moment you scan it
• Reminds you weeks or months ahead, not the day before
• Lets you snooze or mark something done from the reminder itself
• Rolls the date forward when you renew, and remembers that you did
• Repeats anything that comes round again, monthly or yearly
• Keeps the whole family in one place, so you can see what everyone needs
• Holds both sides of an ID, and shares a copy when someone asks for one
• Shows your year as a timeline, so you can see what is coming
• Tells you how to renew: where to go, what it typically costs, and what being
  late usually costs

ASK YOUR PAPERWORK A QUESTION

When is my notice period? What is the excess on this policy? Can I cancel
early? Expyr reads the contract once and answers from the document itself,
quoting the clause rather than guessing.

IT TELLS YOU HOW TO RENEW

Every category carries renewal guidance: the steps, what it typically costs,
and the penalty for leaving it late. That guidance is compiled for you and
marked as indicative, because fees and procedures change. Expyr shows you the
official source and tells you to confirm there before you act. It points you at
the door. It does not pretend to be the counter behind it.

The guidance goes deepest in the United Arab Emirates, where every step has
been checked against the authority that handles it, and Expyr opens the right
government portal for you. Everywhere else it keeps your dates, tells you what
it can, and says plainly when something has not been verified.

PRIVATE BY DESIGN

Your documents stay on your phone. Photos are kept in Expyr's own storage,
never your camera roll and never iCloud Photo Library. Reminders are scheduled
by iOS itself, so nobody else needs to know your dates. Everything travels with
your iPhone backup, so a new phone brings it all back. You can lock Expyr
behind Face ID, and export a copy only you hold.

Expyr works without an account and most people never make one. Signing in with
Apple is offered in one place only: after you buy credits, so those credits
follow you to a new phone. It stores an anonymous identifier and a number.
Never your name, never your email, never your documents. Delete it from
Settings whenever you like.

FREE TO START

Track five items and ten scans free, for as long as you like. Enough for your
passport, your license and your car. Unlock Expyr with a single payment to
track everything you own, and everyone in your household. One payment. Nothing
renews, nothing to cancel.
```

### What changed, and the one thing to watch

**Subscriptions got its own section, above the feature list.** It was mentioned
in a single bullet before, which badly undersold a feature with dedicated code
behind it: `src/lib/subscriptions.ts` reads an entire App Store subscriptions
list off one screenshot. That is a demonstration, not a bullet point, and it is
the thing most likely to make a browsing consumer stop.

**"Nothing is connected to your bank. Nothing reads your email."** This is the
sharpest competitive line in the whole listing. Every serious subscription
tracker on the store works by linking a bank account or scraping an inbox.
Expyr does the same job by reading a screen, which is the one thing a person
worried about their documents will actually care about.

**Bills is the claim to watch.** There is no Bill category. The thirteen types
are documents, a subscription/membership type, a warranty type and Other. Bills
are served by **Other plus the recurrence feature**, which does work: a monthly
recurring item with a due date gets reminders and rolls forward.

So the copy above stays inside what the app does. It says "a payment that falls
due every month" rather than promising bill tracking as a feature, and the
subtitle pairs `bills` with `documents` and `renewals` rather than leading on
it.

**The right fix is a Bill category**, which is a small addition to
`src/data/document-types.ts` and would make this positioning solid instead of
merely defensible. Raised with the coding session. Until it exists, do not
strengthen this language.

## Keywords (100 characters, comma separated, no spaces)

```
visa,passport,license,insurance,warranty,subscriptions,lease,registration,permit,tracker,id,car
```

94 characters. `visa` comes back into the keyword field now that the subtitle no
longer carries it, and `documents`, `bills` and `renewals` stay out because the
subtitle indexes them already.

# English (U.K.) — the Middle East listing

Add this as a second localization. It is the original UAE copy, which was
always right for this audience, and it is what people in the UAE, the wider
Gulf and the UK will see.

## Subtitle (30 characters max)

```
Emirates ID, visa & renewals
```

28 characters. In the UAE, "Emirates ID" is the single highest-intent phrase
anybody types. Worth more in this storefront than the generic "documents".

## Promotional text (170 characters)

```
Photograph your Emirates ID, visa, Mulkiya or tenancy contract. Expyr reads the date, reminds you in time, and tells you exactly how to renew it.
```

## Description

Use the international description above with two sections swapped back:

Replace the second paragraph's list with: *residence visas, Emirates ID,
passports, car registration, insurance policies, tenancy contracts, driving
licences, trade licences and work permits.*

Replace **IT TELLS YOU HOW TO RENEW** with:

```
BUILT FOR LIFE IN THE UAE

Expyr knows what a Mulkiya is. Every category carries the renewal steps, the
typical cost, the penalty for leaving it late, and a link to the authority that
actually handles it: Emirates ID, Ejari, RTA, ICP, MOHRE, and the right one for
your own emirate.

This guidance is compiled for you and clearly marked as indicative. Government
fees and procedures change, so Expyr shows you the official source and tells
you to confirm there before you act. It points you at the door. It does not
pretend to be the counter behind it.
```

And in **FREE TO START**, "enough for your passport, your license and your car"
becomes "enough for your visa, your Emirates ID and your car".

Note the British spellings throughout this variant. *Licence*, not license.
The RTA issues a driving licence and the document in the reader's hand says so.

## Keywords (100 characters, comma separated, no spaces)

```
emirates,id,licence,mulkiya,istimara,ejari,tenancy,labour,trade,passport,insurance,subscriptions
```

96 characters, and a completely different set from the U.S. one. This is the
free half of running two localizations: `mulkiya` and `ejari` are close to
uncontested in the storefront where anybody searches them, and they cost
nothing in the storefront where nobody does.

`istimara` is the Gulf term for vehicle registration outside the UAE, held here
for the Saudi and Qatari storefronts.

---

## Categories

- Primary: **Productivity**
- Secondary: **Utilities**

## Age rating

**4+**, completed 7 September 2026. Every answer across all six content steps
was NONE or NO, and 4+ is what the questionnaire calculated.

This entry used to say "do not assume 4+ any more", on the grounds that Apple's
questionnaire asks about AI-generated content and chatbot features. **It does
not.** Walked end to end on 7 September, the seven steps are: in-app controls
and capabilities, mature themes, medical or wellness, sexuality or nudity,
violence, chance-based activities, and then a summary. There is no AI question
anywhere in it. The nearest thing is "Messaging and Chat", which is defined as
users communicating *with one another*, and Expyr has no user-to-user anything.

Three answers that needed thought rather than reflex:

- **Unrestricted Web Access: NO.** There is no WebView and no in-app browser.
  Portal links hand off to Safari through `Linking.openURL`, which is outside
  the app
- **Medical or Treatment Information: NONE**, despite Health Insurance being a
  tracked category. Its guide is administrative: where to renew, what it costs,
  that a lapse blocks visa renewal. Answering "frequent" would have dragged the
  app into declaring whether it is a regulated medical device
- **Loot Boxes: NO.** Credit packs are fixed quantities at fixed prices, stated
  before purchase. Nothing about them is randomised

### Two options deliberately not taken

**Made for Kids.** Not a label, a separate compliance regime: no third-party
analytics, no behavioural advertising, and no links out of the app without a
parental gate. Expyr deep-links to ICP, RTA and MOHRE. Every one would need a
gate.

**Override to Higher Age Rating.** Considered because the Ask tab runs an LLM
and LLM output is not fully predictable. Rejected because Ask is scoped to a
document the user supplied rather than being an open-ended companion chatbot,
which is the shape Apple actually worries about; and because a voluntary
override is a signal. A reviewer seeing a document tracker self-rated 12+ asks
why, and the honest answer is a feature you would rather they understood
properly.

**The AI gets declared in the review notes instead**, in the section below that
states all three AI features plainly. Full disclosure where a reviewer reads it,
rather than a rating bump that says something is wrong without saying what.

---

## Screenshots to capture (6.7" and 6.5" required)

1. **Home screen** with five or six realistic items, one overdue and one due soon
2. **The scan moment** — camera pointed at a document
3. **The filled form** right after a scan, showing every field it pulled out
4. **A detail screen** showing the renewal steps, costs, and the source link
5. **The Ask tab** mid-answer, quoting a clause
6. **Timeline** with several months populated

Caption each screenshot with a short benefit line rather than a feature name —
"Photograph it once" beats "Camera scanning". Guideline 2.3.3 rejects
screenshots that show only title art or a splash screen.

---

## Review notes for Apple

**Do not paste the block below. It does not fit.**

App Review Information caps Notes at **4,000 characters** and the version below
is 6,034. This file never checked, and pasting it would silently truncate
somewhere in the middle of the business model section, which is the part most
likely to prevent a rejection.

The version to actually paste lives in **review-notes.txt** at the repository
root: 3,993 characters, seven to spare. It keeps everything that prevents a
rejection and drops the permissions section, because app.json already carries
purpose strings that APP-REVIEW.md rates better than most shipping apps, and
Apple reads those directly.

The long version below is kept as the source of record. Edit it, then re-cut
review-notes.txt from it, and check the count before pasting.

It answers, in advance, every question that turns a review into a two-week
correspondence: how to get in without an account, how the money works, and what
leaves the phone. Guideline 2.3.1 rejects generic notes, and every AI feature
must be described with specificity.

```
THERE IS NO SIGN-IN, AND NO DEMO ACCOUNT IS NEEDED

Expyr has no accounts, no login and no server-side user data. Open the app and
every feature is available immediately. Nothing is gated behind a sign-in, so
there are no credentials to supply. If the Beta App Review Information asks for
a username and password, please leave it blank: there is nothing to enter.

HOW TO SEE THE WHOLE APP IN TWO MINUTES

1. On first launch, choose a country, then an emirate if the country is the UAE,
   and allow or decline notifications. Both paths work.
2. Tap + to add an item. "Take a photo" or "Choose a photo" runs the scanner;
   "Enter it myself" adds an item by hand with no camera at all.
3. To test the scanner without a real document, use the sample image attached to
   this submission, or photograph any card or letter carrying a printed date.
   The extracted details are always shown for confirmation before anything is
   saved.
4. Open the saved item to see the countdown, the reminder dates, the renewal
   steps, the indicative cost, the late fine and the link to the authority.
5. The Ask tab answers questions about a saved document.
6. Settings holds the reminder time, the Face ID lock, backup and export, and a
   "Send a test reminder" button that fires a real notification within seconds.

USE OF AI, STATED PLAINLY

Three features use a large language model, all of them user-initiated. None run
in the background and none are required to use the app.

1. SCANNING. An image the user explicitly selects is sent once to our own
   service, which forwards it to the Anthropic Claude API to extract the expiry
   date and the other fields on the document. The extracted values are shown to
   the user for confirmation before anything is saved.

2. ASK. The user may have a saved document transcribed, after which they can ask
   free-text questions about it. The question and the stored transcription are
   sent to be answered. Answers are drawn from the document itself.

3. RENEWAL GUIDANCE. Steps, fees and processing times for a document type in a
   given region are generated by a model using web search, cached, and reused
   across users. It is presented as indicative, carries the wording "confirm
   with the official channel", and links to the official source. Expyr does not
   present it as official instruction.

THE BUSINESS MODEL, IN FULL

Expyr is free for 5 tracked items and 10 scans. Unlocking it removes both
limits.

Expyr AI, which reads a document in full and answers questions about it, is
paid for separately in credits, because it costs us money every time it is
used rather than once.

- There is ONE non-consumable in-app purchase: AED 149, paid once, which
  removes the two limits above.
- There are THREE consumable in-app purchases: credit packs, which are spent
  as Expyr AI is used. Ten credits reads a page; twenty answers a question. A
  new install is given thirty pages' worth so it can be tried before it is
  bought.
- Credits are spent, not subscribed to. Nothing renews.
- It is NOT a subscription. Nothing auto-renews and there is nothing to cancel.
- There is no other way to pay. No external payment, no web checkout, no link
  out to a website, no Stripe, no coupon, no third-party billing of any kind.
- Nothing in the app is unlocked by any transaction outside In-App Purchase.
- No physical goods or real-world services are sold. The purchase unlocks
  software features only.
- The purchase is marked Family Shareable, up to six people.

AVAILABILITY AND WHAT DIFFERS BY COUNTRY

Expyr is available in all storefronts. Its renewal guidance has been checked
against the responsible authority only for the United Arab Emirates, and the
app says so rather than pretending otherwise. Outside the UAE, document type
names fall back to generic ones, guidance is labelled as generated rather than
verified, and features that depend on checked UAE data are switched off. A user
anywhere gets a working tracker; a user in the UAE additionally gets guidance
that has been verified and links to the correct authority.

Renewal guidance for the UAE describes official procedures. Expyr does not
collect government fees, does not act as an agent for any authority, is not
affiliated with or endorsed by any government body, and does not transact with
one. Links open the authority's own website in the browser.

WHAT LEAVES THE DEVICE, AND WHEN

Only an image or a document the user explicitly picks, and only at the moment
they pick it, plus questions they choose to ask. Images are never written to
disk on our own server and are discarded as soon as the response is produced,
and question and answer text is not logged by us. The image and the text are
forwarded to the Anthropic Claude API, which may retain them for a limited
period for its own trust and safety purposes. They are not used to train any
model. This is why the App Store privacy labels declare Photos and Other User
Content as collected rather than claiming no collection: they leave the device,
even though nothing is kept here.

Nothing else is transmitted. Documents, dates, reference numbers, notes and
photos are stored only in the app's private storage on the device. Reminders are
scheduled locally by iOS, never pushed from a server. There is no analytics SDK,
no advertising SDK, and no third-party tracking.

Scanning is optional throughout. "Enter it myself" adds any item by hand, and
photos can be attached without being scanned, in which case nothing leaves the
phone at all.

PERMISSIONS, AND WHY

- Camera: to photograph a document so the expiry date can be read from it.
- Photo library: to open the specific images the user selects, for the same
  purpose. The app never enumerates or scans the library.
- Face ID: optional app lock, off by default, so stored identity documents are
  not visible to anyone who picks up the phone.
- Notifications: local reminders before a document expires. This is the app's
  core function.

DEVICE SUPPORT

iPhone only. The app does not claim iPad support.
```

### Attach to the submission

- [ ] `assets/review/sample-insurance-certificate.jpg`

A fictional motor insurance certificate carrying four dates: an issue date, a
period start, a period end and a date of birth. Only the period end is the
answer, so it proves the scanner picks the right one rather than the first one
it sees. Verified against the live service: it returns 19 March 2027, files it
as Car Insurance, and reads the policy number.

It is clearly marked as a sample and is not a real or official document, so a
reviewer can test the whole flow without owning a UAE document.

## Rejection causes to check before every submission

- **2.1(a), unable to access the app.** Expyr has no login, but it has an
  equivalent trap: if the scanning service is asleep, the reviewer taps "Take a
  photo" and gets a timeout.

  Measured 7 September against the live service: a cold start takes **52.7
  seconds**, not the twenty this entry used to claim. An uptime monitor
  reported the service **down** the first time it looked, which is the same
  conclusion a reviewer reaches.

  The Render paid plan is deferred until there is revenue, so this is handled
  instead by an external ping every five minutes that stops the instance
  sleeping. **Confirm the service answers fast before submitting**, and check
  the UptimeRobot monitor is still green. See LAUNCH.md section 3.
- **5.1.1(ii), purpose strings.** A string that does not say what the data is
  used for, with an example, gets rejected. Every string in `app.json` names the
  resource, the reason and a concrete example. Do not shorten them.
- **2.1(a), a broken feature.** Everything visible must function, including the
  Face ID toggle, the test reminder, and Restore Purchases. Test on a real
  device, not a simulator.
- **2.1(b), business-model questions.** Answered upfront in the notes above, in
  the reviewer's own vocabulary.
- **Reviewed on iPad.** `supportsTablet` is false, so review happens on iPhone.

## Required before submission

See `APP-REVIEW.md` for the full compliance audit. The blocking items:

- [x] Apple Developer Program membership — ordered 6 September 2026
- [x] Privacy manifest declared in `app.json`
- [x] `ITSAppUsesNonExemptEncryption` declared
- [ ] Tested on a physical iPhone: scan, notification arrival, notification tap
      from a fully closed app, Face ID lock, backup and restore
- [ ] Real purchases wired, replacing the stubs in `src/lib/purchases.ts`
- [ ] The product created in App Store Connect as a NON-CONSUMABLE at AED 149,
      Family Sharing enabled, matching `src/lib/purchases.ts`
- [ ] Three CONSUMABLE credit packs created: credits.small, credits.medium and
      credits.large, at the USD prices in `src/lib/credit-packs.ts`. Apple has
      no fixed tiers any more, so set the base price and let it generate the
      other 174 storefronts. **The local prices in that file are placeholders
      written from memory, not looked up.** Replace them with what App Store
      Connect actually generates, and delete the table entirely once StoreKit
      returns the storefront's own formatted price.
- [x] Privacy policy and support URLs live and reachable —
      https://hashemelsaid.github.io/expyr/privacy.html and /support.html
- [ ] App icon (1024×1024, no transparency, no alpha channel)
- [ ] Scanning service on a paid Render plan, `EXPO_PUBLIC_EXTRACT_URL` pointed
      at it, and confirmed responding from a cold start
- [ ] Anthropic spend limit and billing alerts set
- [ ] App Privacy questionnaire completed. Declare that images and document text
      are transmitted for processing and not retained; nothing is linked to the
      user; nothing is used for tracking
- [ ] Age rating questionnaire completed honestly on the AI questions
