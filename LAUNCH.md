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

**App Store Connect is finished, as of 7 September.** The account, the listing
and all four products are configured, and nothing there is waiting on a
decision any more. Two things block submission and both need the app itself:
screenshots, and a build.

---

## Handover to the coding session, 7 September

Everything here was done or found in App Store Connect today. It sits in this
file rather than in `business/` because it is work for whoever is writing code.

### The three values `eas.json` needs

`submit.production` is empty and now has real values:

```
appleId:     hashimsherif2005@gmail.com
ascAppId:    6809437011
appleTeamId: BZ5RDB2NVC
```

### The four product identifiers, fixed forever

```
pro.lifetime     Non-Consumable, AED 149.00, Family Sharing ON
credits.small    Consumable, $2.99
credits.medium   Consumable, $4.99
credits.large    Consumable, $9.99
```

StoreKit matches these literally. Family Sharing on `pro.lifetime` is
irreversible and was confirmed deliberately: the flat-rate product is shared,
credits are not, and Apple does not offer sharing on consumables anyway.

### Three wrong prices in `purchases.ts`

Apple generated the whole matrix from a base of AED 149.00. `PRICE_POINTS` is
wrong in three places. **A Saudi user would currently be quoted SAR 149.99 and
charged SAR 179.99**, which is precisely what that table's own comment says
Guideline 3.1.2 exists to prevent.

```
SA: 'SAR 149.99'        ->  'SAR 179.99'     (20% low)
GB: '£34.99'            ->  '£39.99'
DE, FR, ES, IT, NL:
    '€39.99'            ->  '€44.99'
```

Confirmed correct, leave alone: `AE 'AED 149'`, `QA 'QAR 149.99'`, `US '$39.99'`.

Still unverified and should be treated as wrong until read off App Store
Connect: `KW`, `BH`, `OM`, `EG`, `CA`, `IN`, `PK`, `PH`.

The table dies when StoreKit is wired, since `displayPrice` comes back already
localised. Until then it is what the paywall shows.

### `/health` answers 404 to a HEAD request

GET returns 200. `server/routes.ts` registers `/health` as `method: 'GET'` and
matches exactly, so every load balancer, uptime checker and platform probe that
leads with HEAD reads this service as broken. Found the hard way: a new uptime
monitor reported the service down while it was demonstrably up.

### The credit ledger needs a durable store that is not a Render disk

Render stays on the free plan by decision, so there is no persistent disk.
`server/credit-ledger.ts` correctly refuses to sell into a store that forgets,
which means **credits cannot reach a paying user at all** in the current shape.
It needs a free durable backend: Postgres, Turso, Upstash, whatever fits. The
same question applies to `EXPYR_GUIDANCE_DIR`, which is memory-only today.

### The service is now kept awake, deliberately

An UptimeRobot keyword monitor hits `/health` every five minutes, looking for
the string `"ok":true`. Cold start was measured at **52.7 seconds** and is now
about 0.2. So the free instance no longer sleeps, and the in-memory guidance
cache survives between requests. That is intentional, not a fluke.

### A Bill category would make the listing honest

The App Store description now mentions bills. Today they are reachable only
through **Other plus recurrence**, which works but is thin. A first-class Bill
type in `src/data/document-types.ts`, with a sensible default lead time and a
generic label, would make the claim solid rather than merely defensible. No
UAE-specific guidance needed.

### International work, already briefed separately

- `trade-license` has no `genericLabel`, so a US user sees a UAE concept
- `driving-license` carries the British spelling in a listing now declared as
  English (U.S.)
- The type picker may still offer Emirates ID to somebody in Canada
- **Do not remove the verified/generated distinction.** It is what stops AI
  guidance reading as authoritative, and the App Review notes now describe it
  to Apple explicitly

---

## 1. Apple admits you — YOU, done

- [x] Enrol as an **Individual**, $99, paid 6 September
- [x] **Admitted**, confirmed 7 September. The third attempt was the one that
      worked, after the name on the Apple Account was corrected to match the
      government ID. Support case 102951349112 was never needed

## 2. App Store Connect — YOU, done 7 September

**All of it is finished.** The ordered version, with the reasoning and the
exact screens, is **`business/APP-STORE-CONNECT.md`**. What was done:

- [x] **Digital Services Act trader question**, answered 7 September: not a
      trader, because there is no plan to sell in the EU. Active. Declaring
      trader would
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
- [x] **Banking**, FAB, AED. **Active** the same afternoon, faster than the 24
      hours Apple warned about, which took the Paid Apps agreement to Active
      with it.

      One thing still worth a look: royalty currency reads USD against an AED
      account, so FAB may be taking the conversion spread rather than Apple.
- [x] **App record created.** Apple ID `6809437011`, bundle `com.expyr.app`,
      SKU `expyr-ios-01`, name `Expyr: Expiry Reminders`, primary language
      **English (U.S.)**, not U.K. as this entry used to say. All 17 user-facing
      "colour" spellings turned out to be code comments, and the user-facing
      "licence" spellings stay British because the RTA issues a driving licence
      and the document in the reader's hand says so
- [x] **Subtitle, categories, content rights, age rating.** Subtitle
      `Documents, bills & renewals`, Productivity and Utilities, content rights
      answered **yes** because brand logos are third-party content shown under
      nominative use, age rating **4+** with no override
- [x] **Pricing and availability.** Free app, **all 175 storefronts** and
      future ones automatically. Apple Silicon Mac and Apple Vision Pro both
      unticked: untested platforms, and Apple itself flagged 1.0 as
      incompatible with Vision Pro
- [x] **App Privacy published.** Three data types, all **Data Not Linked to
      You**, all App Functionality, none used for tracking: Photos or Videos,
      Other User Content, Device ID. **These labels expire the day Sign in with
      Apple ships**, because an Apple subject identifier and a server-side
      balance are data linked to identity
- [x] **All four in-app purchases created**, priced and localised. See the
      handover above for the identifiers and the three price corrections they
      revealed
- [x] **Sandbox tester** created, UAE region, so it sees AED 149. Idle until a
      development build exists, because IAPs do not run in Expo Go
- [x] **The 1.0 version page**: promotional text, description, keywords,
      support URL, copyright, review notes and the sample document attached.
      Release set to **manual**, so the app does not go live at 3am
- [ ] **Screenshots**, 6.7" and 6.5", plus one purchase-screen shot attached to
      each of the four products. **Needs the app running.** This and a build
      are the only things left before submission

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
- [x] **Sample document attached** to App Review Information, so a reviewer can
      test scanning without owning a UAE document
- [x] **App Privacy labels published.** Photos or Videos, Other User Content and
      Device ID, all Data Not Linked to You, all App Functionality, none used
      for tracking. Declaring "no data collected" would have contradicted both
      the privacy policy and the observable traffic
- [x] **Age rating: 4+**, no override. This entry used to warn that Apple's
      questionnaire asks about AI and chatbots. **It does not.** Walked end to
      end on 7 September: seven steps, none of them about AI. The nearest is
      "Messaging and Chat", defined as users communicating with one another,
      which Expyr has none of. The AI is disclosed in the review notes instead,
      which is where a reviewer actually reads it
- [x] **Review notes pasted**, from `review-notes.txt` rather than `STORE.md`.
      **The block in `STORE.md` is 6,034 characters and the field caps at
      4,000.** It would have truncated silently, mid-way through the business
      model section, which is the part that prevents a 3.1.1 rejection. The
      cut version is 3,993 characters
- [ ] **Screenshots**, 6.7" and 6.5". Guideline 2.3.3 rejects title art and
      splash screens; show the app in use. **One should show the subscription
      scan working**, since that feature sells itself by being seen rather than
      listed, and the listing now leads on it

## 10. Submit

- [ ] Test everything on the development build, not Expo Go
- [x] **Cold start handled.** Measured at 52.7 seconds on the free plan, which
      an uptime monitor read as the service being down. Now about 0.2 seconds,
      because an UptimeRobot keyword monitor hits `/health` every five minutes
      and the instance never sleeps. Free, and inside Render's 750 monthly
      instance hours with roughly six to spare in a 31 day month
- [ ] **Raise the Anthropic spend limit.** Still $20/month with a $10
      notification, sized for one developer rather than an audience. At roughly
      $0.08 of API cost per install that runs out at about **250 installs in a
      month**, and the failure is not a bill you regret: the API starts
      refusing, scanning stops working, and the first reviews Expyr ever gets
      are about a feature that had simply stopped. Raise to **$150 with the
      notification at $50** before launch. Auto-reload stays off; a breaker
      that rearms itself is not one

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
