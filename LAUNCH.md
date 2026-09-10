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

2. **A Bill category** in `src/data/document-types.ts`. The listing says
   `Documents, bills & renewals`; today bills are reachable only through Other
   plus recurrence. A first-class type with a generic label and a sensible
   default lead time. No UAE guidance needed.

3. **The AED credit pack fallbacks** in `credit-packs.ts`: 12.99, 19.99 and
   39.99, read off real sandbox purchases. StoreKit shows the real prices, so
   this is the fallback being wrong rather than a live bug.

4. **A rating prompt.** There is none in the app. Use `expo-store-review`, and
   fire it in one place only: **after "I have renewed this"**, when the app has
   just visibly kept its promise. Never on launch, never on a count of opens.
   The first twenty reviews weigh more in search ranking than any twenty after.

5. **Verify subscription import against the free ceiling.** `add.tsx:66` gates
   on `documents.length >= FREE_ITEM_LIMIT` before adding. What happens when
   someone with two items imports six subscriptions? It should import what
   fits and show the paywall for the rest, not fail, and not silently drop the
   last four. This is the single most common first action a new user takes.

6. **Verify Restore Purchases end to end** on a real device: buy, delete the
   app, reinstall, restore, confirm Pro returns. It was never separately
   tested before submission.

7. **Bump the version to 1.0.1** so App Store Connect accepts the build
   against a new version record.

Open and non-blocking, from earlier sections: the dark-mode shadow glow in
section 8, and the Haiku-versus-Sonnet comparison for the brief in
`PRICING.md`.

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
      tracking. **These labels expire the day Sign in with Apple ships**,
      because a subject identifier and a server-side balance are linked to
      identity
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

      Still to do in App Store Connect: the **App Privacy labels** have to
      match. They were set on 7 September for an app with no accounts, and the
      note written with them said they expire the day sign-in ships, which was
      the same evening. Exactly what to change is in `REVIEW-REPLY.md`: add
      User ID and Purchase History as linked, move Device ID to linked, and
      leave the two content types alone.

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
- [ ] **Raise the Anthropic spend limit.** Still $20/month with a $10
      notification, sized for one developer rather than an audience. At roughly
      $0.08 of API cost per install that runs out at about **250 installs in a
      month**, and the failure is not a bill you regret: the API starts
      refusing, scanning stops working, and the first reviews Expyr ever gets
      are about a feature that had simply stopped. Raise to **$150 with the
      notification at $50** before launch. Auto-reload stays off; a breaker that
      rearms itself is not one

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
