# Reply to App Review — Guideline 2.1, submission b510495a

Rejected 8 September 2026 on submission `b510495a-1f97-4424-a62e-9e9beea477f0`,
build 1.0.0 (2), from commit `cb53958`.

**This is not a content rejection.** It is the questionnaire Apple sends every
developer account with no review history, and all four in-app purchases came
back *Ready for Review* alongside it. Answer the seven points and record one
video and it goes back in the queue.

**One thing had to change before replying.** The review notes in `STORE.md` said
"Expyr has no accounts, no login and no server-side user data". That was true
when it was written and is false for the build that was submitted, which
contains Sign in with Apple. Apple's own message asks about "Account
registration, login, and account deletion flows", so they are very likely
looking at the entitlement on the binary and reading notes that deny it. Telling
a reviewer something they can see is untrue turns one rejection into several.
The notes are corrected in the same change as this file.

---

## Paste this as the reply, and into App Review Information → Notes

```
Thank you for the review. Answers to each point below, in order.

1. SCREEN RECORDING

Attached, captured on an iPhone running iOS 26, beginning at app launch.

The recording shows, in order: first launch and country selection; adding a
document by photographing it and by typing it in; the countdown, reminder
dates and renewal guidance on a saved item; Expyr AI reading a document and
answering a question about it; buying a credit pack through In-App Purchase;
signing in with Apple to protect those credits; and deleting that account from
Settings.

There is no user-generated content in Expyr. Nothing a person enters is
visible to any other person, nothing is published, and there is no feed,
profile, comment or message anywhere in the app. There is therefore no
content to report or block, and no reporting or blocking mechanism.

2. WHAT THE APP IS FOR, AND FOR WHOM

Expyr tracks anything with an expiry date and warns you before it lapses:
passports, visas, national ID cards, driving licences, vehicle registration,
insurance, tenancy agreements, professional licences, subscriptions and bills.

The problem it solves is that these deadlines are invisible until they are
missed, and missing one is expensive: a fine, a lapsed insurance policy, a
licence that stops you working, or a subscription that renews for another year
because nobody remembered to cancel it.

You photograph the document once. Expyr reads the expiry date off the picture,
files it, and reminds you well before the day, with the steps for renewing it.

The audience is anybody holding paperwork that expires, and particularly
people living outside their country of citizenship, who hold more of it and
face worse consequences for letting it lapse.

3. HOW TO SET UP AND REACH EVERY FEATURE

No account is needed and no credentials are required to review the app. Sign
in is optional and exists for one narrow purpose described in point 7.

  a. On first launch, choose a country, then an emirate if that country is the
     United Arab Emirates, then allow or decline notifications. Both paths
     work and nothing is gated behind either.
  b. Tap the camera button. "Take a photo" or "Choose a photo" runs the
     scanner. "Enter it myself" adds an item by hand with no camera at all.
  c. To test the scanner without a real document, use the sample insurance
     certificate attached to this submission, or photograph any card or letter
     carrying a printed date. Everything read from the image is shown for
     confirmation before it is saved.
  d. Open a saved item for the countdown, the dates each reminder will arrive,
     the renewal steps, the indicative cost, the late fine, and a link to the
     responsible authority.
  e. The Expyr AI tab answers questions about documents you have had read.
     A new install is given 300 credits so this can be tried without paying.
  f. Settings holds the app lock, backup and export, the credit balance, and
     a button that fires a real reminder notification within seconds.

4. EXTERNAL SERVICES USED

  - Anthropic (Claude API), for three things: reading the expiry date and
    other fields off a photographed document; answering questions about a
    document the user has had transcribed; and researching renewal steps for
    a document type in a given country. All three are described in point 7 of
    our App Review notes and none run without the user asking.
  - Apple: Sign in with Apple for optional identity, and the App Store Server
    API, which our service calls to verify that an in-app purchase genuinely
    happened before any credits are granted.
  - Google favicon service and DuckDuckGo icons, used only to fetch a
    subscription service's own logo from its public domain, so a Netflix
    entry looks like Netflix. No user data is sent; the request contains a
    domain name only.
  - Our own service, hosted on Render in Frankfurt, which sits between the app
    and Anthropic and holds nothing but credit balances.

There is no analytics SDK, no advertising SDK, no attribution SDK and no
third-party tracking of any kind.

5. REGIONAL DIFFERENCES

The app behaves identically everywhere in every respect except one, which is
deliberate and disclosed to the user.

Renewal guidance, meaning the steps, official fees, late fines and the link to
the responsible authority, has only been verified against primary sources for
the United Arab Emirates. Outside the UAE the app does not show it, and says
so plainly during onboarding rather than guessing. We would rather show
nothing than invent a procedure for somebody's visa.

Everything else, which is tracking dates, reminders, scanning, household
organisation, Expyr AI, backup and export, works the same in all 175
territories the app is available in.

6. REGULATED INDUSTRY AND THIRD-PARTY MATERIAL

Expyr is not in a regulated industry and holds no protected third-party
material.

It is a personal reminder tool. It does not transact with any government or
authority, does not collect any official fee, does not submit any application
on anyone's behalf, and is not affiliated with or endorsed by any government
body. Where it describes an official procedure it presents that as indicative,
tells the user to confirm with the official channel, and links to the
authority's own website, which opens in the browser.

Company and service logos shown against subscriptions are each fetched from
that company's own public domain and are used solely to identify the
subscription the user chose to track.

7. WHAT CAN BE BOUGHT, AND HOW TO REACH IT

There is one non-consumable and three consumables. Nothing renews, nothing is
a subscription, and there is nothing to cancel.

  Expyr Pro (pro.lifetime), non-consumable, family shareable.
  Removes the two free limits: 5 tracked items and 10 photo scans.
  To reach it: Settings, then Unlock next to Free plan. Or add a sixth item.

  Credits, small / medium / large (credits.small, credits.medium,
  credits.large), consumable. Credits are spent by Expyr AI: ten credits reads
  a page of a document, twenty answers a question. They are bought because
  each use costs us money, unlike the one-off purchase.
  To reach it: Settings, then Top up next to Expyr AI credits.

Every purchase is made through In-App Purchase. There is no external payment
of any kind: no web checkout, no link out to a website, no third-party billing,
and nothing in the app is unlocked by any transaction outside In-App Purchase.
No physical goods or real-world services are sold.

ACCOUNTS, SINCE THE APP HAS THEM

Expyr works fully without an account and most people will never make one. It
is offered in exactly one place and for exactly one reason.

Credit packs are consumables, and Apple keeps no record of a consumable once
it has been used. Somebody who buys credits, spends half of them and then
changes phone has nothing left for Apple to restore. So after a credit
purchase the app offers Sign in with Apple, which lets those credits follow
the person to a new phone.

  Registration and sign in: Settings, then Sign in on the "Protect my credits"
  row, which appears once the balance is above zero. There is one method,
  Sign in with Apple, and no password is ever created.

  Deletion: Settings, then Delete on the "Credits protected" row. It states
  that unspent credits will be lost, asks Apple to confirm identity, and then
  erases the identifier and the balance from our service immediately.

We request no scopes from Apple, so we never receive a name or an email
address. What our service stores against an account is an opaque identifier
Apple generates for this app, and a number: how many credits remain. No
document, no date, no photograph and no name is ever sent to us or stored by
us, whether or not somebody signs in.
```

---

## The screen recording — shot list

One continuous recording, on the phone, starting at app launch. Aim for four to
six minutes. Apple wants to see the app work, not a polished advert, so a plain
recording with no narration is fine.

Record with **Settings → Control Centre → Screen Recording**, then swipe down
and tap the record button.

| # | Show | Why Apple asked |
|---|---|---|
| 1 | Launch from the home screen, onboarding, pick a country | "must begin with launching the app" |
| 2 | Add a document with the camera, then one with "Enter it myself" | The typical user flow |
| 3 | Open it: countdown, reminder dates, renewal steps | The core value |
| 4 | Expyr AI reading a document and answering a question | An AI feature, described in point 4 |
| 5 | **Settings → Top up → buy a credit pack, sandbox** | "Accessing paid content or features" |
| 6 | **Settings → Protect my credits → Sign in with Apple** | "Account registration, login" |
| 7 | **Settings → Credits protected → Delete → confirm** | "Account deletion is required" |

Items 5, 6 and 7 are the ones this rejection is actually about. Do not skip any
of them, and let each finish on screen: the balance going up, the row changing
to "Credits protected", and the row disappearing after deletion.

Sign in again afterwards if you want your own credits back.

---

## Also attach

- [ ] `assets/review/sample-insurance-certificate.jpg`, so a reviewer can test
      scanning without owning a UAE document

## And check before resubmitting

- [ ] **App Privacy labels** must now declare an identifier and a balance are
      collected. They were written when the app had no accounts. A label saying
      "no data collected" contradicts both the privacy policy and the traffic a
      reviewer can observe, and that is its own rejection.
