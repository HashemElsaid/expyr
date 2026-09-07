# App Store Connect, the setup runbook

Apple admitted the account on 6 September 2026, individual enrolment. Nothing
below needs code. All of it needs you, and it is in dependency order: each
step is refused until the one above it is done.

Sign in at [appstoreconnect.apple.com](https://appstoreconnect.apple.com) with
the Apple Account that holds the membership.

---

## Progress, 7 September 2026

- [x] Digital Services Act, answered not a trader. **Active**
- [x] Legal entity information
- [x] Paid Apps agreement signed. Sits at **Pending User Info** until banking is added
- [x] U.S. Certificate of Foreign Status of Beneficial Owner. **Active**
- [x] U.S. Form W-8BEN, no treaty claimed, no TIN given. **Active**
- [x] Bank account added, FAB, AED. **Processing**, verifies within 24 hours
- [x] Small Business Program, submitted 7 September. Four associated-account questions all No, proceeds declaration ticked. Awaiting approval
- [x] App record created 7 September. Apple ID **6809437011**, name Expyr: Expiry Reminders, primary language English (U.S.), status 1.0 Prepare for Submission
- [x] Subtitle, categories, content rights, age rating, all 7 September.
      Subtitle **Visa, documents & renewals**, Productivity and Utilities,
      content rights answered **yes** because brand logos are third-party
      content shown under nominative use, and the age rating came out **4+**
      with no override
- [x] Pricing and Availability, 7 September. **Free** app, base country US
      (immaterial for a free app), **all 175 storefronts and future ones**,
      tax category App Store software, Public distribution. Apple Silicon Mac
      and Apple Vision Pro both **unticked**: untested platforms, and Apple
      itself flagged version 1.0 as incompatible with Vision Pro
- [ ] App Privacy
- [ ] In-app purchases and prices, blocked until the bank verifies

Two details worth keeping. Apple routes payouts by **royalty currency**, and
this account shows bank currency AED with royalty currency USD, so proceeds may
arrive as dollars converted by FAB rather than by Apple. Worth checking under
See More once verification clears, because the spread is FAB's rather than
Apple's. And the account name is the full legal version, HASHEM SHERIF MAMDOUH
M ELSAID, rather than the shorter name on the membership. That is correct,
because Apple validates against the bank, but it is the first thing to look at
if verification fails.

Apple asked for **two** tax forms rather than one, which is normal. The
Certificate of Foreign Status came first and carried no treaty section and no
TIN field. The W-8BEN itself came second and carried both, and both were left
empty: Part II blank because there is no US treaty with the UAE, and the TIN
fields blank because the UAE issues no tax number to individuals.

---

## 1. Clear the two banners that block the Paid Apps agreement

Two notices sit above the agreements list, and both have to be answered before
Apple will let you sign anything.

### The Digital Services Act trader question

**Answer: "I am not a trader under the DSA or I do not plan to distribute in
the EU"**, decided 7 September 2026.

Which half of that sentence is doing the work matters. Selling Expyr Pro
*would* make you a trader if you distributed in the EU, so the first half is
not true. The second is: the launch plan is the UAE storefront, then Saudi
Arabia and Qatar, and the guides are UAE-specific.

Four reasons, in order of weight:

- **Declaring trader publishes your home address.** Articles 30 and 31 require
  Apple to display a trader address, phone number and email on the product page
  in all 27 EU territories. As an individual that is Al Raha St., Abu Dhabi,
  and your personal number, public
- **Verification would stall you.** Apple asks for documentation verifying a
  business name and address. There is no trade licence, which is the open
  question in COMPANY.md.
- **It is reversible**, account-wide under Business, Agreements, Compliance,
  and per app under App Information, App Store Regulations and Permits
- **It costs nothing that existed.** The only consequence is no EU sales, which
  was not this year's plan

Two things to carry forward. EU consumers are told that consumer protection
rights do not apply to contracts with a non-trader, which is a fair description
of an app not sold there. And when the EU does matter, individuals may publish
a **P.O. Box** rather than a home address, with proof of association.

### Legal entity information

The second banner says legal entity information must be updated before the
Paid Apps agreement can be signed. **Edit Legal Entity**, next to the address.
The UAE postcode field currently holds 00000 and is the one likely to argue.

## 2. Sign the Paid Apps agreement — it gates everything

**Business → Agreements**, find **Paid Applications**, accept it.

This is the gate. Until it is signed you cannot enrol in the Small Business
Program, you cannot submit tax forms, you cannot add a bank account, and you
cannot create a paid product. It is a five minute reading job and the whole
rest of the list is downstream of it.

The agreement is the one Apple calls Schedule 2. Accepting it is also the
prerequisite Apple names for Small Business Program enrolment.

## 3. Enrol in the App Store Small Business Program — today, not later

[developer.apple.com/app-store/small-business-program](https://developer.apple.com/app-store/small-business-program/),
Enroll. You must be the Account Holder, which as an individual you are.

Commission drops from 30% to 15%. On Expyr Pro that is **AED 21.29 more per
sale**, which is 21% more revenue for a form.

**Correction to `LAUNCH.md`.** That file says to enrol "before setting any
prices". That is not Apple's rule and it is worth correcting, because it makes
the deadline sound like something it is not. Apple's actual rule is a lag: the
reduced rate takes effect **fifteen days after the end of the fiscal month in
which your enrolment is approved**. Apple's fiscal months do not line up with
calendar months.

So the reason to do it today is not prices. It is that the discount arrives
roughly six weeks after you ask for it, and you want it already running on the
day the first sale happens rather than starting a month into selling.

Two conditions worth knowing:

- Qualification is **up to $1M in proceeds in the prior calendar year**. New
  developers qualify automatically, which is you.
- If you cross $1M mid-year, the 30% rate returns for the rest of that year.
  That is a problem worth having and it is years away.

## 4. Submit the tax forms — you are a UAE individual with no US treaty

**Business → Agreements → Tax Forms.** Apple asks a series of questions and
routes you to the right form. As a non-US individual that is the **W-8BEN**.

Two things to get right:

- **Do not claim tax treaty benefits.** The UAE has treaties with many
  countries and the United States is not one of them. There is no rate to
  claim, and claiming one you are not entitled to is a false certification on
  a US tax form.
- **This does not mean 30% comes off your US sales.** The default 30% US
  withholding applies to US-source *royalties*. Apple's App Store arrangement
  is structured as a sale and commission rather than a royalty licence, which
  is why App Store proceeds are generally not withheld on for non-US
  developers. Books and some other Apple stores work differently.

  Take that as the expected outcome, not as a promise from me. Apple's own
  questionnaire will tell you the withholding rate it is applying. **Read the
  rate on the confirmation screen and write it down.** If it says 30%, stop
  and get an accountant before you set prices, because it changes every number
  in `MONEY.md`.

## 5. Add banking — the name has to match, exactly

**Business → Payments and Financial Reports → Bank Accounts.**

The account holder name must match the legal name on the Developer Program
membership. That is the same name that had to match your government ID before
Apple would admit you, so it should already agree. A mismatch here fails the
same way the enrolment did, and just as quietly.

A UAE account with an IBAN is what Apple expects. Have the IBAN and the SWIFT
or BIC to hand.

## 6. Create the app record

**Apps → New App.**

- Platform: iOS
- Bundle ID: `com.expyr.app`, which must already be registered as an App ID in
  the Developer portal. If the dropdown is empty, that is why
- SKU: anything private and stable, `expyr-ios-01` is fine
- Primary language: English (U.K.) if the copy is British, and it is. Check
  `STORE.md` before choosing, because this is awkward to change later
- User Access: Full

## 7. Create the four in-app purchases

**Your app → Monetization → In-App Purchases.**

| Product ID | Type | What it is |
|---|---|---|
| (choose one, e.g. `pro.lifetime`) | Non-Consumable | Expyr Pro, **Family Sharing on** |
| `credits.small` | Consumable | 1,500 credits, 150 pages |
| `credits.medium` | Consumable | 3,000 credits, 300 pages |
| `credits.large` | Consumable | 6,500 credits, 650 pages |

The three credit identifiers are not free choices. They are the exact strings
in `src/lib/credit-packs.ts` and StoreKit matches on them literally. The Pro
identifier is still open because the code reads it from one place.

**Family Sharing on the non-consumable only.** It is a deliberate product
decision already made, and consumable credits cannot be shared anyway.

## 8. Set prices, then bring the real ones back into the code

Apple has had no fixed price tiers since 2023. You set a base price for one
storefront and Apple generates the other 174.

Base prices to enter:

| Product | Base | Storefront |
|---|---|---|
| Expyr Pro | AED 149 | United Arab Emirates |
| credits.small | $2.99 | United States |
| credits.medium | $4.99 | United States |
| credits.large | $9.99 | United States |

Then **export what Apple generated and hand it to me**. Every local price in
`src/lib/credit-packs.ts` and `src/lib/purchases.ts` was written from memory
and both files say so in their comments. The AED, SAR, QAR, GBP and EUR
figures in the code are guesses about what Apple would produce. Apple has now
produced the real ones, and a guessed price shown next to a real charge is the
kind of mismatch Guideline 2.3.1 exists for.

---

## What this does not cover

Three App Store Connect jobs are listed in `LAUNCH.md` §9 and belong to the
listing rather than the account: App Privacy labels, the age rating
questionnaire, and screenshots. They are blocked on decisions the coding
session is still making, chiefly whether the Ask tab ships at all.

## After you finish

Tell me which steps completed and what Apple showed you at step 3. The
withholding rate is the one fact in this list that can move the whole model,
and it is the one I could not look up on your behalf.
