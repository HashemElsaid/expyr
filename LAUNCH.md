# Expyr — launch checklist

In dependency order. Nothing below step 1 can start until step 1 is done.

**YOU** = only you can do it (payment, identity, Apple account, decisions).
**ME** = ask Claude and it gets done.

---

## 1. Enrol in the Apple Developer Program — YOU

- [ ] Enrol as an **Individual** at developer.apple.com/programs/enroll — $99/year
- [ ] Have ready: Apple ID with two-factor on, a payment card, government photo ID
- [ ] Approval usually takes 24–48 hours

Blocks everything else. Start today.

## 2. Apply to the Small Business Program — YOU

- [ ] Apply once enrolment is approved

Drops Apple's commission from 30% to **15% from day one**, on one-off purchases
and subscriptions alike. Takes a few days to approve, so start it early.

## 3. Publish the web pages — YOU (2 minutes)

- [ ] Make the GitHub repo **public** (required for free GitHub Pages)
- [ ] Optional: rename the repo `renewly` → `expyr`, then update the git remote
- [ ] Settings → Pages → Source: `main` branch, `/docs` folder
- [ ] Confirm `…/privacy.html` and `…/support.html` both load

Apple asks for both URLs at submission. The pages are already written and committed.

## 4. Decide the price — YOU, then ME

- [ ] Decide, then tell Claude to update `src/lib/purchases.ts`

Currently AED 129/year + AED 399 lifetime. Recommendation after finding Expiro
at AED 119.99 one-time: **single one-off at AED 149, no subscription.**

Must be settled before step 6 — the products have to match exactly.

## 5. Create the app in App Store Connect — YOU

- [ ] New App → reserve the name **Expyr**
- [ ] Bundle ID `com.expyr.app`
- [ ] Primary language English, SKU anything

Reserve the name early. If "Expyr" has gone, everything downstream changes.

## 6. Create the in-app purchase products — YOU

- [ ] Create products matching step 4's prices exactly
- [ ] Tick **Family Sharing** on each

Family Sharing is what stops a household pooling onto one phone — Apple caps a
family at six and limits how often anyone can switch.

## 7. First EAS build — ME

- [ ] Ask Claude to run it once you are enrolled

`eas.json` is already configured. EAS handles certificates automatically and
builds iOS from Windows — no Mac needed. This is where Expo Go stops and a real
app begins.

## 8. Test on your actual phone — YOU

Nothing has ever run outside Expo Go. The important one:

- [ ] Add a document
- [ ] Set a reminder a few minutes out
- [ ] **Close the app completely**
- [ ] Wait for the notification, then tap it
- [ ] It should open that document

That cold-start path was broken until 31 Aug and can only be verified on a real
build.

- [ ] Also check: camera scan, PDF upload, Face ID lock, backup and restore

## 9. Screenshots — YOU + ME

- [ ] 6.7" iPhone only (iPad support is switched off)
- [ ] Five or six, from the real app, with realistic documents

## 10. Upgrade Render to `starter` — YOU

- [ ] Change the plan in the Render dashboard (~$7/month)

Must happen before real users. On the free plan the service sleeps and
cold-starts in ~50 seconds, so the first scan of the day times out and looks
broken — including to a reviewer.

- [ ] Also set an Anthropic spend limit and billing alerts

## 11. Wire real purchases — ME

- [ ] Ask Claude once step 6 exists

Replaces the deliberate stub in `src/lib/purchases.ts` with StoreKit/RevenueCat.

## 12. App Store Connect paperwork — YOU

- [ ] Paste the full review notes from `STORE.md` into App Review Information
- [ ] Attach a sample document image so the reviewer can test scanning
- [ ] Privacy labels: declare that scans go to our server and on to Anthropic
- [ ] Age rating questionnaire
- [ ] Export compliance (encryption) declaration
- [ ] Leave the Beta App Review sign-in fields blank; there is no account

Reviewers reject what they cannot test. `STORE.md` also lists the five reasons
the previous app was rejected and what was changed here to avoid each one.

## 13. TestFlight — YOU

- [ ] Push the build, add a few testers, let it run about a week

## 14. Submit

- [ ] Submit for review

---

## Running in parallel, not blocking

- [ ] The e-Trader licence question — settle before money actually moves
- [ ] Confirm how Apple pays into a UAE bank account in your name

---

## Already done

- Product code complete, both packages typecheck
- Named Expyr, renamed throughout
- App icon drawn and wired in, no alpha channel
- Privacy, support and terms pages written in `docs/`
- Free tier: 10 items, 15 scans
- Country gate — guidance shown only where it has been verified
- Data model prepared for family sync
- Cold-start reminder tap fixed
- iPad support switched off
