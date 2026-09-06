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
Visa, licence & renewal alerts
```

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
| Contracts read and answered | **2** |

Five items is deliberate: it fits one person's own papers, so the wall lands on
the sixth item, which is almost always someone else's.

## Promotional text (170 characters, changeable without review)

```
Photograph your Emirates ID, visa, Mulkiya or tenancy contract. Expyr reads the date, reminds you in time, and tells you exactly how to renew it.
```

## Description

```
Expyr makes sure nothing in your life expires without warning.

Photograph a document and Expyr reads the expiry date for you. No typing, no
forms. It works on residence visas, Emirates ID, passports, car registration,
insurance policies, tenancy contracts, driving licences, trade licences and
work permits, from a photo, a PDF, or a screenshot of an email.

WHAT IT DOES

• Reads the date from a photo, a PDF, or a screenshot
• Pulls out the whole document, not just the date: names, numbers, issuing
  authority, amounts — so it is useful the moment you scan it
• Reminds you weeks or months ahead, not the day before
• Lets you snooze or mark something done from the reminder itself
• Tracks subscriptions alongside documents, on their own tab: what renews,
  when, and what it costs you
• Tells you how to renew: where to go, what it typically costs, and the fine
  for being late
• Opens the right government portal for you
• Keeps the whole family in one place, so you can see what everyone needs
• Holds both sides of an ID, and shares a copy when someone asks for one
• Shows your year as a timeline, so you can see what is coming
• Rolls the date forward when you renew, and remembers that you did

ASK YOUR PAPERWORK A QUESTION

When is my notice period? What is the excess on this policy? Can I cancel
early? Expyr reads the contract once and answers from the document itself,
quoting the clause rather than guessing.

BUILT FOR LIFE IN THE UAE

Expyr knows what a Mulkiya is. Every category carries the renewal steps, the
typical cost, the penalty for leaving it late, and a link to the authority that
actually handles it — Emirates ID, Ejari, RTA, ICP, MOHRE, and the right one
for your own emirate.

This guidance is compiled for you and clearly marked as indicative. Government
fees and procedures change, so Expyr shows you the official source and tells
you to confirm there before you act. It points you at the door; it does not
pretend to be the counter behind it.

Expyr tracks dates and sends reminders wherever you live. Outside the UAE it
keeps your dates and stays quiet about the paperwork rather than guessing.

PRIVATE BY DESIGN

Your documents stay on your phone. Photos are kept in Expyr's own storage,
never your camera roll and never iCloud Photo Library. There is no account, no
sign-up and no server database. Reminders are scheduled by iOS itself, so nobody
else needs to know your dates. Everything travels with your iPhone backup, so a
new phone brings it all back. You can lock Expyr behind Face ID, and export a
copy only you hold.

FREE TO START

Track five items and ten scans free, for as long as you like — enough for your
visa, your Emirates ID and your car. Unlock Expyr with a single payment to
track everything you own, and everyone in your household. One payment. Nothing
renews, nothing to cancel.
```

## Keywords (100 characters, comma separated, no spaces)

```
visa,emirates id,expiry,renewal,reminder,mulkiya,ejari,passport,subscription,deadline,insurance
```

## Categories

- Primary: **Productivity**
- Secondary: **Utilities**

## Age rating

Do **not** assume 4+ any more. Apple's current questionnaire asks about
AI-generated content and chatbot-style features, and Expyr has both: the Ask tab
answers free-text questions with an LLM, and renewal guidance is model-generated
from web search. Answer those questions honestly and accept the rating that
falls out. A wrong answer is caught later and costs more than a higher rating.

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

Paste this whole thing into App Review Information. It answers, in advance,
every question that turns a review into a two-week correspondence: how to get
in without an account, how the money works, and what leaves the phone.
Guideline 2.3.1 rejects generic notes, and every AI feature must be described
with specificity.

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

Expyr is free for 5 tracked items, 10 scans, and 2 contract readings.
Unlocking it removes all three limits.

- There is ONE product: a non-consumable in-app purchase, AED 149, paid once.
- It is NOT a subscription. Nothing auto-renews and there is nothing to cancel.
- There is no other way to pay. No external payment, no web checkout, no link
  out to a website, no Stripe, no coupon, no third-party billing of any kind.
- Nothing in the app is unlocked by any transaction outside In-App Purchase.
- No physical goods or real-world services are sold. The purchase unlocks
  software features only.
- The purchase is marked Family Shareable, up to six people.

Renewal guidance shown in the app describes official UAE procedures. Expyr does
not collect government fees, does not act as an agent for any authority, is not
affiliated with or endorsed by any government body, and does not transact with
one. Links open the authority's own website in the browser.

WHAT LEAVES THE DEVICE, AND WHEN

Only an image or a document the user explicitly picks, and only at the moment
they pick it, plus questions they choose to ask. Images are never written to
disk on our server and are discarded as soon as the response is produced. They
are not used to train any model. Question and answer text is not logged.

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
  photo" and gets a timeout. **The Render service must be on a paid plan before
  submitting** — the free tier cold-starts in roughly twenty seconds, which
  reads as broken.
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
