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

### What Apple actually generated, 7 September

Base price AED 149.00 on the UAE storefront. Apple produced the other 174 from
local tax and exchange rates. The six that matter, with what each one actually
pays after the local tax Apple remits and the 15% commission:

| Storefront | Price | Local tax | Proceeds | ≈ USD |
|---|---|---|---|---|
| **United Arab Emirates** | AED 149.00 | 5% | **AED 120.62** | $32.84 |
| United States | $39.99 | varies by state | **$33.99** | $33.99 |
| Germany and eurozone | €44.99 | 19% | **€32.14** | ~$35.03 |
| United Kingdom | £39.99 | 20% | **£28.33** | ~$35.98 |
| Saudi Arabia | SAR 179.99 | 15% | **SAR 133.03** | ~$35.47 |
| Qatar | QAR 149.99 | none | **QAR 127.49** | ~$35.02 |

The local-currency figures are exact arithmetic. The dollar column moves with
exchange rates and is there for comparison only.

**The UAE pays you the least of the six.** AED 149 is about $40.57 gross, which
looks like the highest price on the list, and it produces the lowest proceeds
because everywhere else Apple placed the price a band higher. The spread is
$32.84 to $35.98, so it is not worth acting on. It is worth knowing before
somebody concludes the home market is the profitable one.

### The credit pack prices were wrong too

Read off a real sandbox purchase on 7 September, against a US base of $2.99,
$4.99 and $9.99:

| Pack | credit-packs.ts guesses | Apple actually charges |
|---|---|---|
| Small | AED 10.99 | **AED 12.99** |
| Medium | AED 18.99 | **AED 19.99** |
| Large | AED 36.99 | **AED 39.99** |

Apple does not convert, it places the price at a local point that absorbs tax,
so every guess came out low. This one does not bite today: the purchase
screenshots show StoreKit returning the real prices and the app displaying
them, which is what use-store-prices.ts is for. The table is only the fallback,
and the fallback is wrong.

### The guesses in the code were wrong in three places

`src/lib/purchases.ts` holds a `PRICE_POINTS` table written from memory, and
its own comment says showing a person a number they are not about to be charged
is what Guideline 3.1.2 exists to stop. Measured against what Apple generated:

| Storefront | Code said | Apple generated | |
|---|---|---|---|
| AE | AED 149 | AED 149.00 | correct |
| QA | QAR 149.99 | QAR 149.99 | correct |
| US | $39.99 | $39.99 | correct |
| **SA** | SAR 149.99 | **SAR 179.99** | **20% low** |
| **GB** | £34.99 | **£39.99** | **£5 low** |
| **DE, FR, ES, IT, NL** | €39.99 | **€44.99** | **€5 low** |

A Saudi user would have been shown SAR 149.99 and charged SAR 179.99.

Eight more entries in that table are still unverified, because they were not
read off the screen: KW, BH, OM, EG, CA, IN, PK, PH. They should be treated as
wrong until checked.

The table dies the moment StoreKit is wired, because `displayPrice` on the
product comes back already localised and correct. Until then it is what the
paywall shows, so the three known errors need fixing rather than waiting.

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

## When the money actually arrives

Separate from how much, and it lands later than people expect.

**Apple pays 33 days after the end of its own fiscal month**, which does not
line up with the calendar. A sale in early October is money in the account
around mid-December.

**There is a minimum before Apple sends anything.** For most international bank
accounts, including a UAE one, it is **$40**. Below that the balance rolls
forward and keeps accumulating.

That threshold bites at exactly this stage. One Expyr Pro sale nets $32.84,
which is **under** it. So a month with a single sale pays nothing at all; it
carries. **Two Pro sales in a month is roughly where the first real payout
happens.**

Nothing in this chain asks for a UAE business licence. Apple does not check for
one, and a personal account receiving foreign income is ordinary. The point at
which it could come up is a bank taking the view that large regular business
income belongs in a business account, which is a question of volume rather than
of law. See COMPANY.md.

Some UAE banks also hold a first inbound international payment until a purpose
of transfer code is confirmed in the banking app. Worth knowing before a
payment appears stuck.

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

## The cost the free plan created, and why it is no longer a cost

**Resolved: Render is on the paid Starter plan, with a disk at `/var/data` and
both cache directories set.** The analysis below is kept because it is the
argument that produced that outcome, and because the arithmetic still explains
what a persistent cache is worth. Nothing in it is an open problem any more.

### The finding, as it stood

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

Two things fixed it, in the end. An external ping keeps the process alive, so
the memory cache survives between requests. And the disk arrived anyway, which
is the real fix: the guidance cache now survives a deploy, not merely an idle
period, and the credit ledger has somewhere durable to live.

**So the $7 bought back something like $84 a month of regenerated guidance at
the ceiling, plus the ability to sell credits at all.** It was the cheapest line
item on the list and the one with the largest downside attached.

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
