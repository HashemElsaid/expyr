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

The business side of the launch lives in `business/`, which is run from a
separate session: the App Store Connect runbook, the unit economics, the
company and tax position, go-to-market, and support. Start at
`business/README.md`.

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

---

## 1. Apple admits you — YOU, done

- [x] Enrol as an **Individual**, $99, paid 6 September
- [x] **Admitted**, confirmed 7 September. The third attempt was the one that
      worked, after the name on the Apple Account was corrected to match the
      government ID. Support case 102951349112 was never needed

## 2. App Store Connect — YOU, and it now has its own runbook

The ordered version of this section, with the reasoning and the exact screens,
is **`business/APP-STORE-CONNECT.md`**. It is eight steps and each one is
refused until the one above it is done. The summary:

- [x] **Digital Services Act trader question**, answered 7 September: not a
      trader, because distribution is UAE-first. Active. Declaring trader would
      have published a home address and phone number on the product page in all
      27 EU territories, and would have needed business documents that do not
      exist. Reversible per account and per app
- [x] **Legal entity information** updated
- [x] **Paid Apps agreement signed**, 7 September
- [x] **Small Business Program**, submitted 7 September. All four
      associated-account questions No, proceeds declaration ticked.

      This entry used to say "before setting any prices", and that is not
      Apple's rule. The rule is a lag: the reduced rate applies fifteen days
      after the end of the fiscal month in which enrolment is approved
- [x] **Two tax forms**, both Active, 7 September. Apple asked for the U.S.
      Certificate of Foreign Status first, which carries no treaty section and
      no TIN field, then the W-8BEN itself, which carries both. Part II left
      empty because there is no US treaty with the UAE, and both TIN fields
      left empty because the UAE issues no tax number to individuals
- [x] **Banking added**, FAB, AED, 7 September. Processing, verifies within 24
      hours. The Paid Apps agreement stays at Pending User Info until it does.

      Two things to check when it clears. Royalty currency reads USD against an
      AED account, so FAB may be taking the conversion rather than Apple. And
      the account name is the full legal version, which is correct because
      Apple validates against the bank, but is the first thing to look at if
      verification fails
- [ ] Create the app record, bundle id `com.expyr.app`, name
      `Expyr: Expiry Reminders`, primary language English (U.K.)
- [ ] Create **one non-consumable**: Expyr Pro, AED 149, Family Shareable
- [ ] Create **three consumables**: `credits.small`, `credits.medium`,
      `credits.large`. Set a base price and let Apple generate the other 174
      storefronts. **The local prices in `src/lib/credit-packs.ts` are
      placeholders written from memory.** Replace them with what Apple
      generates

## 3. Render — YOU, deferred 7 September

**Decision: no upgrade until there is revenue.** Recorded rather than argued.
The consequences are specific and they land on other steps rather than on this
one.

The $7 Starter plan bought three things, and deferring it keeps all three
problems:

- **Credits cannot be sold.** The ledger needs a **persistent disk**. Without
  one `server/credit-ledger.ts` falls back to memory and refuses to sell into a
  store that forgets. That refusal is correct behaviour, not a bug, and it is
  absolute rather than degraded
- **The cold start stays, and it is far worse than this file used to say.**
  Measured on 7 September against the live service, cold: **52.7 seconds** to
  answer `/health`. This file recorded 22 seconds. Scanning is the app's core
  action, so that is most of a minute of nothing happening on the one thing the
  app is for, and it is a Guideline 2.1 rejection waiting to be met.

  Corroborated the same evening: the first check from the new uptime monitor,
  run from North Virginia, timed out during the wake and reported the service
  **down**. It was not down, it was asleep. That is the conclusion an automated
  client reached about this service, unprompted, and it is the conclusion a
  reviewer would reach too
- **The guidance cache is wiped every time the service sleeps.** `/health`
  reports `guidanceCache: "memory"` and `guidanceHeld: 0`, because there is no
  disk. The cache lives in the process, and on the free plan the process dies
  every fifteen idle minutes. So renewal guidance is not generated once and
  shared forever, as `PRICING.md` describes. It is regenerated after every idle
  period, at roughly $0.07 of Sonnet and web search each time, capped at
  `EXPYR_GUIDANCE_DAILY_NEW` of 40 a day. That ceiling is **$2.80 a day**, or
  $84 a month, against a $7 disk and a $20 monthly Anthropic cap
- **The reading bug stays undiagnosed.** The paid plan was the last untested
  explanation for a 14 page contract stopping at page 12

Two of the three have free workarounds. The third does not.

- [x] **Service kept warm by an external ping**, done 7 September. UptimeRobot free plan. **Keyword** monitor named Expyr scanner, 5 minute interval, email alerts to hashim.elsaeed@gmail.com, raising an incident when the string ok true is absent from /health. Keyword rather than plain HTTP for the reason below, and it is the better check anyway: it asks whether the service reported itself healthy, not merely whether something answered. Measured before and after against the live service: **52.673s cold, then 0.241s, 0.429s, 0.188s warm**.

      One thing found in the doing: **/health answers 404 to a HEAD request**
      and 200 to a GET. UptimeRobot sends HEAD by default, so the monitor sat
      red while the service was demonstrably awake. UptimeRobot only exposes the HTTP
      method setting on paid plans, so it cannot be changed to GET. Worked
      around with a Keyword monitor, which has to download the body to search
      it and therefore sends a GET regardless of the locked setting. The underlying bug is still there:
      server/routes.ts registers /health as method GET and matches exactly, so
      every load balancer, uptime checker and platform probe that leads with
      HEAD will read this service as broken. Worth fixing in the router. A free scheduler hitting
      `https://renewly-scanner.onrender.com/health` every 5 to 10 minutes stops
      it sleeping. That endpoint is unauthenticated, unmetered and costs
      nothing, which is why it is the right one to hit.

      This does two jobs, not one. It removes the 52 second cold start, and it
      keeps the process alive so the in-memory guidance cache survives. On the
      free plan those are the same fix.

      The arithmetic is tighter than it first looks. Render allows **750
      instance hours per workspace per month**, shared across every free
      service, and hours are only consumed while the service is awake. Staying
      awake all month costs 720 hours in a 30 day month and **744 in a 31 day
      month**, against an allowance of 750. It fits, with six hours of margin,
      and only if renewly-scanner is the sole free service in the workspace.

      Running out suspends **all** free web services until the start of the
      next month, so the counter is worth checking in the first week rather
      than assuming
- [ ] **Move the ledger to a free durable store** if credits are to ship at
      all: a free Postgres, Upstash, Turso or equivalent. This substitutes
      engineering time for $7 a month, and it is work the coding session has
      not yet been asked for
- [ ] **Reading may stay broken.** There is no free substitute for a faster
      CPU. If it does not finish on the free plan, the choice is to pay the $7
      or to ship without it

This sits against §5 and §7, which both assume credits can be sold and reading
can be made to work. Version one was kept at both features on the same day this
was deferred. The collision is noted here so it is not discovered later.

## 4. A development build — ME, needs 1

Sign in with Apple needs a native entitlement and **does not run in Expo Go**.
This is the wall between here and credits surviving a new phone.

- [ ] `eas build` for a development client
- [ ] Install it on your iPhone in place of Expo Go

## 5. Make the money work — ME, needs 2 and 3

- [ ] Wire StoreKit: `purchase()` and `restore()` in `src/lib/purchases.ts`
      currently return `ok: false`, which is a guaranteed rejection under
      Guideline 2.1
- [ ] Grant credits on a completed consumable purchase, in the one place
      `top-up.tsx` reserves for it
- [ ] Move spending to the server. `/read` and `/ask` still trust the balance
      the phone reports, and a balance in local storage is a number its owner
      can edit
- [ ] Sign in with Apple on the phone. The whole server half is done and tested

## 6. What accounts oblige you to add — ME, needs 5

- [ ] **In-app account deletion.** Guideline 5.1.1(v) requires it the moment an
      app supports account creation. Expyr is exempt today because it has no
      accounts; adding sign-in ends that exemption
- [ ] Decide what happens to unspent credits when somebody deletes
- [ ] **Rewrite both privacy policies before sign-in ships, not after.** They
      currently say, in these words, that there is "no account and no server
      database". That is true today and becomes false the moment an Apple
      subject identifier and a balance are held on the service. A privacy
      policy that denies the thing the app does is worse than no policy: it is
      a statement Apple can read, a user can rely on, and neither would
      forgive.

      Six places say it, and all six have to change together:

      - `src/app/privacy.tsx` line 11 and line 53
      - `docs/privacy.html` line 27 and line 72
      - `docs/index.html` line 37
      - `src/app/data.tsx` line 72, "Nothing is kept on a server."

      The App Privacy labels in App Store Connect have to change with them:
      an identifier and a balance held server-side is data collection, and a
      label saying otherwise contradicts both the policy and the traffic

## 7. Make reading finish — ME, needs 3

Still the one feature that does not work. A 14-page contract reached 12 pages
and gave up. Everything cheap has been tried: parallel batches, a page count
that costs nothing, streaming, per-batch banking, a retry pass, half the server
work removed.

- [ ] Try again on the paid plan, which is the last untested variable
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
      the design system on 31 August. Android adaptive and splash variants too.
      Worth one check at home-screen size, where the fold may be too fine to
      read, but this is not an outstanding item
- [ ] **Screenshots**, 6.7" and 6.5". Guideline 2.3.3 rejects title art and
      splash screens; show the app in use
- [ ] Attach `assets/review/sample-insurance-certificate.jpg` so a reviewer can
      test scanning without owning a UAE document
- [ ] **App Privacy labels.** Declare that images and document text are sent
      for processing, not retained, not linked to identity, not used for
      tracking. Declaring "no data collected" would contradict the privacy
      policy and the observable network traffic
- [ ] **Age rating.** Answer the AI and chatbot questions honestly. Do not
      assume 4+ any more
- [ ] Paste the review notes from `STORE.md`, including the section stating all
      three AI features plainly

## 10. Submit

- [ ] Test everything on the development build, not Expo Go
- [ ] Confirm the scanning service answers from cold
- [ ] Set an Anthropic spend limit for production traffic. Currently $20/month
      with a $10 notification, sized for one developer rather than an audience

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
  auto-reload off
