# App Store listing

Draft copy for App Store Connect. Everything here is editable — treat it as a
starting point, not a finished submission.

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

One tier, not two. AED 79/year or AED 12/month unlocks unlimited items for the
whole household. Tracking family members is a reason to upgrade rather than a
separate product — there is no per-household infrastructure behind it today, so
charging separately would not be honest. Revisit if real cross-device sharing
is ever built.

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
• Reminds you weeks or months ahead, not the day before
• Lets you snooze or mark something done from the reminder itself
• Tells you how to renew: where to go, what it costs, and the fine for being late
• Opens the right government portal for you
• Keeps the whole family in one place, so you can see what everyone needs
• Holds both sides of an ID, and shares a copy when someone asks for one
• Shows your year as a timeline, so you can see what is coming
• Rolls the date forward when you renew, and remembers that you did

BUILT FOR LIFE IN THE UAE

Expyr knows what a Mulkiya is. It knows an Emirates ID renewal costs around
AED 100 per year of validity, that late renewal is fined daily, that Ejari
matters for your DEWA account, and that your landlord must give you 90 days'
notice before raising the rent. Every category carries the steps, the typical
cost, and the penalty for leaving it late.

Expyr tracks dates and sends reminders wherever you live. The renewal steps,
costs and fines have been checked for the UAE only, so outside it Expyr keeps
the dates and stays quiet about the paperwork rather than guessing.

PRIVATE BY DESIGN

Your documents stay on your phone. Photos are kept in Expyr's own storage,
never your camera roll and never iCloud Photo Library. There is no account, no
sign-up and no server database. Reminders are scheduled by iOS itself, so nobody
else needs to know your dates. Everything travels with your iPhone backup, so a
new phone brings it all back. You can lock Expyr behind Face ID, and export a
copy only you hold.

FREE TO START

Track ten items and fifteen scans free, for as long as you like. That is enough
for your visa, your Emirates ID, your car and your tenancy. Unlock Expyr with a
single payment to track everything you own, and everyone in your household.
```

## Keywords (100 characters, comma separated, no spaces)

```
visa,emirates id,expiry,renewal,reminder,mulkiya,ejari,passport,document,deadline,insurance,licence
```

## Categories

- Primary: **Productivity**
- Secondary: **Utilities**

## Age rating

4+ — no objectionable content.

---

## Screenshots to capture (6.7" and 6.5" required)

1. **Home screen** with five or six realistic items, one overdue and one due soon
2. **The scan moment** — camera pointed at a document
3. **The filled form** right after a scan, showing the "✨" note
4. **A detail screen** showing the renewal steps and costs
5. **Timeline** with several months populated
6. **Settings** showing Face ID and the privacy line

Caption each screenshot with a short benefit line rather than a feature name —
"Photograph it once" beats "Camera scanning".

---

## Review notes for Apple

Paste this whole thing into App Review Information. It answers, in advance,
every question that turns a review into a two-week correspondence: how to get
in without an account, how the money works, and what leaves the phone. A
reviewer who has to ask is a reviewer who has already rejected you once.

```
THERE IS NO SIGN-IN, AND NO DEMO ACCOUNT IS NEEDED

Expyr has no accounts, no login and no server-side user data. Open the app and
every feature is available immediately. Nothing is gated behind a sign-in, so
there are no credentials to supply. If the Beta App Review Information asks for
a username and password, please leave it blank: there is nothing to enter.

HOW TO SEE THE WHOLE APP IN TWO MINUTES

1. On first launch, choose an emirate (any) and allow or decline notifications.
   Both paths work.
2. Tap + to add an item. "Take a photo" or "Choose a photo" runs the scanner;
   "Enter it myself" adds an item by hand with no camera at all.
3. To test the scanner without a real document, use the sample image attached to
   this submission, or photograph any card or letter carrying a printed date.
   The extracted date is always shown for confirmation before anything is saved.
4. Open the saved item to see the countdown, the reminder dates, the renewal
   steps, the cost, the late fine and the link to the relevant authority.
5. Settings holds the reminder time, the Face ID lock, backup and export, and a
   "Send a test reminder" button that fires a real notification within seconds.

THE BUSINESS MODEL, IN FULL

Expyr is free to use for 10 tracked items and 15 scans. Unlocking it removes
both limits.

- There is ONE product: a non-consumable in-app purchase, AED 149, paid once.
- It is NOT a subscription. Nothing auto-renews and there is nothing to cancel.
- There is no other way to pay. No external payment, no web checkout, no link
  out to a website, no Stripe, no coupon, no third-party billing of any kind.
- Nothing in the app is unlocked by any transaction outside In-App Purchase.
- No physical goods or real-world services are sold. The purchase unlocks
  software features only.
- The purchase is marked Family Shareable, up to six people.

Renewal guidance shown in the app (government fees, fines, processing times) is
published reference information about official UAE procedures. Expyr does not
collect those fees, does not act as an agent for any authority, and does not
transact with any government body.

WHAT LEAVES THE DEVICE, AND WHEN

Only an image the user explicitly picks, and only at the moment they pick it.
That image is sent once to our extraction service, which forwards it to the
Anthropic Claude API to read the date, and returns the result. The image is
never written to disk on the server and is discarded as soon as the response is
produced. It is not used to train any model.

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

- [ ] A sample document image with a clear printed expiry date, so the reviewer
      can test scanning without owning a UAE document

## Learned from a previous rejection

A prior app of ours was rejected repeatedly on these, so they are worth checking
before every submission.

- **2.1(a), unable to access the app.** The reviewer could not get past a login.
  Expyr has no login, but it has an equivalent trap: if the scanning service is
  asleep or unreachable, the reviewer taps "Take a photo" and gets a timeout.
  **The Render service must be on a paid plan before submitting** — the free
  tier sleeps and cold-starts in roughly fifty seconds, which reads as broken.
- **5.1.1(ii), purpose strings.** Rejected because the photo library string did
  not say what the data would be used for or give an example. Every string in
  `app.json` now names the resource, the reason, and a concrete example.
  Do not shorten them.
- **2.1(a), a broken feature.** Rejected for a sign-in button that did not work.
  Everything visible must function, including the Face ID toggle and the test
  reminder. Test on a real device before submitting, not in a simulator.
- **2.1(b), business model questions.** Weeks were lost explaining who pays whom
  and for what. The notes above answer that upfront, in the reviewer's own
  vocabulary.
- **Reviewed on iPad.** That app claimed iPad support and was reviewed on an
  iPad Air. `supportsTablet` is false here, so review happens on iPhone.

## Required before submission

- [ ] Apple Developer Program membership (USD 99/year)
- [ ] App icon (1024×1024, no transparency, no alpha channel)
- [ ] Privacy policy and support URLs live and reachable (`docs/`, GitHub Pages)
- [ ] The one-time product created in App Store Connect as a NON-CONSUMABLE at
      AED 149, Family Sharing enabled, matching `src/lib/purchases.ts`
- [ ] Real purchases wired, replacing the stubs in `src/lib/purchases.ts`
- [ ] Scanning service on a paid Render plan, `EXPO_PUBLIC_EXTRACT_URL` pointed
      at it, and confirmed responding from a cold start
- [ ] Anthropic spend limit and billing alerts set
- [ ] App Privacy questionnaire completed. Declare that images are transmitted
      for processing and not retained; nothing is linked to the user
- [ ] Tested on a physical iPhone: scan, notification arrival, notification tap
      from a fully closed app, Face ID lock, backup and restore
