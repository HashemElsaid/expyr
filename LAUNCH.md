# Expyr, launch checklist

Current as of 6 September 2026, in dependency order. Nothing in a step can
start before the step above it is done.

**YOU** means only you can do it: payment, identity, an Apple account, a
decision. **ME** means ask Claude and it gets done.

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

## 1. Apple admits you — YOU, in progress

- [x] Enrol as an **Individual**, $99, paid 6 September
- [ ] Wait. The first two attempts were rejected for a name mismatch, fixed on
      the third
- [ ] If nothing arrives in a few days, call rather than email:
      Mon–Fri, **12:00 to 21:00 Dubai**, from developer.apple.com/contact

## 2. The day you are admitted — YOU

- [ ] **Enrol in the App Store Small Business Program, before setting any
      prices.** Apple's cut drops from 30% to 15% for the year. Free, and it
      roughly doubles the margin on everything
- [ ] Create the app record in App Store Connect, bundle id `com.expyr.app`
- [ ] Create **one non-consumable**: Expyr Pro, AED 149, Family Shareable
- [ ] Create **three consumables**: `credits.small`, `credits.medium`,
      `credits.large`. Set a base price and let Apple generate the other 174
      storefronts. **The local prices in `src/lib/credit-packs.ts` are
      placeholders written from memory.** Replace them with what Apple
      generates

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

## 7. Make reading finish — ME, needs 3

Still the one feature that does not work. A 14-page contract reached 12 pages
and gave up. Everything cheap has been tried: parallel batches, a page count
that costs nothing, streaming, per-batch banking, a retry pass, half the server
work removed.

- [ ] Try again on the paid plan, which is the last untested variable
- [ ] Cap a document at **30 pages**. A 50-page contract is unbounded in both
      time and cost. Say "read the first 30 pages of 52" rather than truncating
      quietly

## 8. Decisions still open — YOU

- [ ] **Brand icons.** Subscription logos come from Google's undocumented
      favicon endpoint, which is awkward against Guideline 5.2.2's "specifically
      permitted under the service's terms". Bundling a small set of your own
      would remove the question and a network call
- [ ] **The summary model.** The brief runs on Sonnet 5 at roughly twice the
      price of everything around it. Worth comparing Haiku on a real contract
- [ ] **Your name.** The app shows "Mine" and "Hashim" as two cards because it
      cannot tell they are the same person. iOS stopped giving apps the device
      name in iOS 16, so it cannot be inferred. Sign in with Apple would supply
      it for paying users; everybody else needs to be asked, or the rename on
      the Mine card needs to set it

## 9. The things a listing needs — YOU, with ME where useful

- [ ] **App icon**, 1024×1024, no transparency, no alpha
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
