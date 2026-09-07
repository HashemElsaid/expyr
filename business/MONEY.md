# What Expyr earns and what it costs

Worked out 7 September 2026, after Apple admitted the account. Supersedes the
revenue arithmetic in `PRICING.md`, which was calculated against a 30%
commission. The Small Business Program makes that number 15%, and it changes
every figure below.

`PRICING.md` remains correct on the *cost* side and on why credits exist. This
document is the other half: what actually arrives.

---

## What one sale pays

### Expyr Pro, AED 149

Apple is the merchant of record in the UAE and over seventy other countries.
It collects and remits the 5% VAT itself, and it does so **before** taking its
commission, so the price on the screen is not the base of the commission.

```
AED 149.00   what somebody pays
AED 141.90   less 5% UAE VAT, which Apple remits
AED 120.62   less 15% commission            = USD 32.84
AED  99.33   less 30% commission            = USD 27.05
```

**The Small Business Program is worth AED 21.29 on every Pro sale**, or 21%
more revenue, for a form that takes five minutes. That is the whole argument
for step 2 of `APP-STORE-CONNECT.md`.

### The credit packs

Credits are priced to recover cost, not to profit. `credit-packs.ts` sizes
every pack to survive Apple's *worst* case, 30%, which is correct and
conservative. At 15% the surplus roughly doubles.

| Pack | Price | Credits cost us | Arrives at 15% | Surplus | (at 30%) |
|---|---|---|---|---|---|
| Small | $2.99 | $1.50 | $2.54 | **$1.04** | $0.59 |
| Medium | $4.99 | $3.00 | $4.24 | **$1.24** | $0.49 |
| Large | $9.99 | $6.50 | $8.49 | **$1.99** | $0.49 |

That surplus is not profit and should not be spent as though it were. **It is
what pays for the welcome credits given to people who never buy anything.**
One medium pack funds about eight free installs. One Pro sale funds about a
hundred and thirty.

The `APPLE_SHARE = 0.3` constant in the code should stay at 0.3. It is a floor
test, not a forecast, and a floor test that assumes the good case is not a
test.

---

## What the year costs

Fixed, and it is almost nothing:

| | Per month | Per year |
|---|---|---|
| Apple Developer Program | $8.25 | $99 |
| Render, Starter plan | $7.00 | $84 |
| Domain, hosting for the policy pages | $0 | $0 |
| **Fixed total** | **$15.25** | **$183** |

**Six Pro sales cover the entire year.** One sale every two months keeps the
lights on.

Variable, per install, in the first month:

| | Cost | Note |
|---|---|---|
| Scanning, about 8 items | $0.024 | $0.003 each, Haiku |
| Welcome credits actually spent | $0.056 | see the assumption below |
| Renewal guidance | ~$0 | generated once per category and region, cached 90 days, shared by everybody |
| **Per install** | **~$0.08** | |

The welcome figure assumes 35% of installs try Expyr AI at all, and that those
who do spend about twenty of their thirty free pages. **Both are guesses and
both need replacing with observed numbers in the first month.** The worst case,
where everybody uses it and burns all thirty pages, is $0.32 per install.

---

## The one thing that breaks first

**The Anthropic spend cap is set at $20/month with a $10 notification.**
`LAUNCH.md` notes it was "sized for one developer rather than an audience".
Here is what that means in installs:

- At $0.08 per install, the cap is reached at about **250 new installs in a
  month**
- In the worst case, $0.32 per install, at about **62**

Sixty-two installs is a quiet launch day. And the failure is not a bill you
regret, it is worse than that: the API starts refusing, scanning stops
working, and the app looks broken to everybody who opened it that week. The
first reviews Expyr ever gets would be about a feature that had simply
stopped.

**Before launch, three things:**

1. Raise the monthly cap to **$150**, which covers roughly two thousand
   installs a month and is still an amount you can afford to lose outright
2. Move the notification to **$50**, so it warns at a third rather than at
   half of a number that is too small anyway
3. Ask the coding session what the app does when the API refuses. If the
   answer is "shows an error", that is a launch blocker. Credits taken for a
   read that then fails on our side must come back, and the failure should
   name itself as ours

Auto-reload stays off. The cap is a circuit breaker, and a breaker that
rearms itself is not one.

---

## The cost the free plan creates

Measured 7 September against the live service. `/health` returns
`guidanceCache: "memory"` and `guidanceHeld: 0`, and the same request took
**52.7 seconds** because the instance was asleep.

`PRICING.md` describes renewal guidance as costing about $0.07 to generate and
then $0 forever, cached 90 days and shared by every user. **That is true only
with a disk.** Without one the cache is held in the process, and on Render's
free plan the process is killed after fifteen idle minutes. So the guidance is
regenerated after every idle period rather than once.

The ceiling is set by `EXPYR_GUIDANCE_DAILY_NEW`, which allows 40 new
generations a day. At $0.07 each that is **$2.80 a day, or about $84 a month**,
against a $7 disk and a $20 monthly Anthropic cap that it would exhaust in a
week.

Real traffic will sit far below that ceiling while there are few users. The
point is the direction: **the free plan is not free, it converts a one-off cost
into a recurring one**, and the saving it produces is smaller than the spend it
causes as soon as there is any traffic at all.

Keeping the service warm with an external ping fixes most of this for nothing,
because the memory cache survives as long as the process does. It does not fix
the credit ledger, which needs durable storage rather than a live process.

---

## Three scenarios

Assuming 2% of installs buy Pro, 1% buy a credit pack, and the per-install
costs above.

| Installs / month | Revenue | Cost | Net |
|---|---|---|---|
| 100 | $70 | $26 | **+$44** |
| 1,000 | $699 | $125 | **+$574** |
| 5,000 | $3,496 | $565 | **+$2,931** |

At 5,000 a month the Render Starter plan is worth re-examining, but nothing
else in the structure changes.

### The downside, which is small

A thousand installs a month and **nobody at all buys anything**: costs about
$95 a month, earns nothing, loses $95. That is the floor, and it is bounded
because credits are bought before they are spent and the tracker costs a third
of a cent per item.

### The number to actually watch

At a thousand installs a month, Expyr breaks even at **0.29% Pro conversion**.
Three people in a thousand.

That is the number that decides whether this works, and it is low enough that
the risk is not economic. The risk is whether anybody installs it at all,
which is `GTM.md`.

---

## What an install is worth

At the assumed conversions, each install is worth about **$0.70** in gross
revenue and costs about $0.08 to serve. **Roughly $0.62 net per install.**

That is the ceiling on paid acquisition. Anything that reliably buys an
install for under about forty cents is worth doing, with the margin left over
covering the ones that never convert. Anything over sixty cents loses money at
these conversion rates and should not be attempted until the conversion rates
are measured rather than assumed.

---

## Open, and blocking nothing yet

- **The withholding rate Apple shows at tax-form submission.** Expected to be
  0% on App Store proceeds. If it comes back 30%, every figure above falls by
  the share of revenue that is US, and this document needs rewriting rather
  than adjusting. See `APP-STORE-CONNECT.md` §3
- **The brief model.** `PRICING.md` flags that the summary runs on Sonnet 5 at
  twice the price of everything near it. Worth one comparison against Haiku on
  a real contract. It is a cost question, so it belongs here, but it needs the
  coding session to run it
- **Local prices.** Every non-USD figure in the code is a guess. Apple has the
  real ones once step 7 of the runbook is done
