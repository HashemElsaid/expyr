# Apple Ads, the small test first

Decided 3 November 2026, Hashem's call. Replaces the ads section of
`OCTOBER-100.md`, whose target date has passed.

**The plan in two steps.** A small test the day the redesign is live, to learn
what an install costs and which message pulls. The real money waits for the
bank statement feature in `POSITIONING.md`, because "You could save AED 1,140"
is a far stronger ad than "subscription tracker".

**Why not before the redesign:** ads show the first screenshots, and the live
first screenshot is not demo data. The redesign version replaces them.

---

## Before the day, once, Hashem only

1. Go to ads.apple.com, sign in with the same Apple account as App Store
   Connect, and choose **Apple Ads Advanced**, not Basic. Advanced lets us pick
   the searches, which the test needs.
2. Accept the terms and add a card. Nothing is charged until a campaign runs.

## The test

| | |
|---|---|
| Starts | The day the redesign version is live in the store |
| Country | United Arab Emirates |
| Placement | Search results only |
| Budget | **USD 10 a day for 7 days, total budget capped at USD 70** |
| Bid | Max cost per tap USD 1.00 |
| Matching | Exact match only, Search Match off |

Two ad groups with the same daily budget, USD 5 each, so the result also
answers the positioning question:

| Ad group | Exact-match searches |
|---|---|
| Subscriptions | `subscription tracker`, `subscription manager`, `track subscriptions`, `cancel subscriptions`, `free trial reminder`, `bill reminder` |
| Documents | `emirates id renewal`, `visa renewal`, `uae visa`, `mulkiya`, `expiry reminder`, `renewal reminder` |

Claude sets it up from this page and confirms the budget with Hashem before
pressing start. The total cap means it cannot spend more than USD 70 whatever
happens.

## What we read after 7 days

| Number | Where |
|---|---|
| Cost per install, per ad group | Apple Ads |
| Tap-through and conversion rate, per ad group | Apple Ads |
| First-time downloads against the week before | App Store Connect, App Analytics |
| Pro purchases | RevenueCat, if it shipped in the same build; otherwise App Store Connect Sales |

**Then:**
- **Under USD 1.50 an install:** good. Hold the budget for the bank statement
  release and scale there.
- **USD 1.50 to 3:** cut the searches that cost most, keep the rest running
  small until the statement release.
- **Over USD 3:** stop. Paid waits for the statement release and a better ad.
- **Whichever ad group wins** goes into `POSITIONING.md`. If documents beat
  subscriptions clearly, that is worth knowing before the big push.

`MONEY.md` values an install at about USD 0.62 net at the assumed conversion,
so this test is expected to lose money per install. What it buys is two
numbers we do not have: what an install costs, and which message works.

## Results

| Dates | Spend | Installs | Cost per install | Winner | Note |
|---|---|---|---|---|---|
| | | | | | |
