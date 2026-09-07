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

## 1. Apple admits you — YOU, done

- [x] Enrol as an **Individual**, $99, paid 6 September
- [x] **Admitted 7 September.** App Store Connect access confirmed by email

## 2. The day you are admitted — YOU

- [ ] **Enrol in the App Store Small Business Program.** Apple's cut drops from
      30% to 15%, which doubles what arrives from every sale. Free, no
      downside, and the only reason to hurry is the calendar: the reduced rate
      starts on the **first day of the month after Apple approves you**, so a
      week's delay can cost a whole month at the higher rate.

      It does *not* block pricing, despite what this file used to say. The
      credit packs in `src/lib/credit-packs.ts` are already priced to clear
      their own cost at the full 30%, and there is a test that fails if they
      ever stop doing so. Fifteen per cent is upside on top, not a premise.
- [ ] Create the app record in App Store Connect, bundle id `com.expyr.app`.
      Everything else in App Store Connect hangs off this existing

- [ ] **Sign the Paid Applications agreement, and get banking and tax to
      Active.** Nothing can be sold until all three say Active in Business.
      Bank details alone are not enough, and the tax forms are the slow part.
      This blocks selling even after every product below exists.

- [ ] **Create exactly these four products.** The identifiers are permanent:
      Apple does not allow one to be renamed, reused or deleted once created,
      so a typo here is a product that has to be abandoned. They are read from
      the code, not invented, and the code is the authority.

      | Identifier | Type | Credits | Price | Source in repo |
      |---|---|---|---|---|
      | `pro.lifetime` | Non-Consumable, Family Shareable | n/a | AED 149 | `PRO_PRODUCT_ID` in `src/lib/purchases.ts` |
      | `credits.small` | Consumable | 1,500 | $2.99 | `PACKS` in `src/lib/credit-packs.ts` |
      | `credits.medium` | Consumable | 3,000 | $4.99 | same |
      | `credits.large` | Consumable | 6,500 | $9.99 | same |

      Set one base price per product and let Apple generate the other 174
      storefronts. **The local prices in both files are placeholders written
      from memory**; replace them with whatever Apple actually generates.

- [ ] Create a **sandbox tester** under Users and Access. A real Apple Account
      cannot buy from a build that is not on the store, so without this there
      is no way to test a purchase at all

## 3. Upgrade Render to the $7 plan — YOU

Not optional any more, and it buys three things at once:

- The credit ledger needs a **persistent disk**. Without one it falls back to
  memory and refuses to sell, which is correct and also means credits cannot
  work at all
- The **22 second cold start** goes. App Review would read that as a broken app
- It is the leading remaining explanation for **reading not finishing**: a
  tenth of a shared CPU parsing multi-megabyte PDFs

- [ ] Upgrade the instance
- [ ] Attach a disk and set `EXPYR_CREDITS_DIR` to a path on it
- [ ] Set `EXPYR_GUIDANCE_DIR` too, so the guidance cache survives a deploy
- [ ] Set the three Apple keys, or `/purchase/redeem` refuses every purchase:

      | Variable | Value |
      |---|---|
      | `EXPYR_APPLE_KEY_ID` | `2AX49534J2` |
      | `EXPYR_APPLE_ISSUER_ID` | `51eccb44-a2ab-4d3c-852f-362796657233` |
      | `EXPYR_APPLE_KEY` | the contents of the .p8, which never goes in this repo |

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
- [ ] **Test a sandbox purchase on the phone.** Needs a new development build,
      the three Apple environment variables, the paid Render plan, and a
      sandbox tester. Nothing above has been through a real till
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
