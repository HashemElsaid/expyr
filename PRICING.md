# Pricing and the cost of Expyr AI

Decided 6 September 2026. Supersedes the pricing note in `STORE.md`, which
describes the tracker alone.

Two products, priced differently because they cost differently. The tracker is
almost free to run and is sold once. Expyr AI has a real, recurring, per-use
cost and is sold by the document.

---

## What each thing actually costs to run

Measured against the models the code uses today, at Claude Haiku 4.5 ($1.00 per
million input tokens, $5.00 per million output) and Claude Sonnet 5 ($2.00 /
$10.00).

| What happens | Model | Cost | How often |
|---|---|---|---|
| Scan a document for its date and fields | Haiku | **~$0.003** | Once per item |
| Read a 14-page PDF in full | Haiku | **~$0.11** | Once per document |
| Summarise it (the "brief") | **Sonnet 5** | **~$0.04** | Once per document |
| Answer one question | Haiku | **~$0.02** | **Every time** |
| Renewal guidance | Sonnet 5 + web search | ~$0.07 to generate, then **$0** | Once per document-type + region, cached 90 days and shared by every user |
| Reminders, storage, brand icons | — | **$0** | — |
| Hosting (Render) | — | $0 free / $7 paid | Monthly |

**The tracker — scan, remind, renewal guidance — costs about a third of a US
cent per item.** A person tracking twenty things costs about six cents, once,
for the life of the app. That is why it can be sold outright.

**Expyr AI costs roughly $0.15 for the first document and $0.02 for every
question after.** That is fifty times the tracker, it recurs, and it cannot be
engineered away: answering *any* question about a contract reliably means
having read *all* of it.

### Two costs that hid

- **The brief runs on Sonnet 5**, not Haiku — `BRIEF_MODEL` in
  `server/comprehend.ts`. Twice the price per token of everything around it.
  Worth testing Haiku on a contract summary; if the difference is not visible,
  that is a free saving.
- **Questions cost more in aggregate than reading does.** Reading happens once;
  asking repeats forever. `/ask` used to send the transcript of *every* read
  document with each question — a dozen contracts read meant ~180,000 tokens to
  ask when a visa expires. Now bounded by `ASK_TEXT_BUDGET`, which leaves the
  common case (a question asked from one document's screen) untouched.

---

## The decision

### Expyr Pro, AED 149, once

Unchanged. Takes the ceilings off the tracker: items and scans. Not a
subscription, for the reason settled in September. The app is built to be
silent, and renting silence invites "what am I paying for?" at every renewal.

### Expyr AI, paid for in credits

**Credits, bought in packs, spent as they are used.** Ten credits reads a page,
twenty answers a question. A new install starts with thirty pages' worth so
somebody can see what it does before deciding whether it is worth paying for.

| Pack | Credits | Pages | USD |
|---|---|---|---|
| Small | 1,500 | 150 | $2.99 |
| Medium | 3,000 | 300 | $4.99 |
| Large | 6,500 | 650 | $9.99 |

Pages rather than documents, and this is not a presentational choice. Documents
needs an assumed length, which makes the number a guess presented as a fact:
at fourteen pages each, 3,000 credits was advertised as twenty-one documents,
and somebody whose tenancy contract runs to thirty would have got ten. A credit
is a tenth of a page by definition, so pages are arithmetic. And a page is
something anybody can count before they buy.

Each pack holds a little under seventy percent of its price in credits. That is
not a markup. It is the price minus Apple's thirty percent, which is the money
that actually arrives: sell five dollars of credits for five dollars and every
top-up loses a dollar fifty. Every pack clears its own cost by 49 cents, and
the rate per credit improves with size. Both are asserted in
`src/lib/credit-packs.test.ts`, which caught the large pack being worse value
per credit than the medium one before it shipped.

The local prices in the code are placeholders written from memory. Apple has
had no fixed tiers since 2023: you set a base price and it generates the other
174 storefronts. Replace them with what App Store Connect produces, and delete
the table entirely once StoreKit returns the storefront's own formatted price.

### Why credits rather than a subscription

$3/month nets $2.10 after Apple's cut, which is about twenty-five questions.
One curious user is underwater in the first week. $5/month nets $3.50, or $4.25
under the **App Store Small Business Program** (15% instead of 30% for
developers under $1M a year; apply the day the Developer Program admits you,
before setting any prices).

Neither survives the real problem, which is that a fixed monthly fee against
unbounded use is the same unbounded liability that made a one-off purchase
risky, wearing a different hat. Credits map cost to revenue exactly, so there
is no amount of use that turns a customer into a loss.

### Why credits are counted, not shown as money

A balance in dollars was considered and rejected, on evidence gathered the hard
way. Watching a credit balance fall from $1.28 to $1.13 produced the immediate
reaction *"I will keep losing money like this with nothing in return."*

That is what a user would feel, and it is fatal for this feature: a draining
balance makes people ration, every question becomes a purchase decision, and
hesitation before each question destroys the thing being sold.

It is also arithmetic. Apple takes thirty percent, so a five dollar top-up
cannot buy five dollars of anything. Denominating in credits prices a product,
which is honest; denominating in dollars reports a dollar that is not a dollar,
which is not.

The rationing effect is still wanted, and still there. It just arrives as
"140 credits left, enough for 14 more pages" rather than as a meter.

## What bounds the downside

The worry that prompted this: *somebody keeps trying to read a very large PDF
that keeps timing out, and it costs us every time.*

Four things already in the code:

1. **Completed batches are banked.** A retry buys only the missing pages, so a
   repeatedly-failing read converges instead of multiplying.
2. **A finished read is cached on the phone.** Re-opening the document is free
   forever.
3. **Only pages that arrived are charged for.** A read is charged per page as
   each batch lands, so a failure delivers nothing and costs nothing, and a
   resumed read buys only the pages it adds.
4. **Questions are bounded** by `ASK_TEXT_BUDGET` regardless of library size.
5. **The balance is checked before a page is fetched**, after the free page
   count comes back, so a refusal costs nothing and never leaves half a
   document.

Still to do:

- **Move enforcement to the server.** The balance is currently held on the
  phone, which means it is a number the owner of the phone can edit. It is
  honest with honest users and trivially bypassed by anyone else.
  `server/credit-ledger.ts` is the one that cannot be edited, and `/read` and
  `/ask` do not debit it yet. It also needs a durable store, which the free
  Render plan cannot provide, and the ledger correctly refuses to sell into a
  store that forgets.
- ~~Cap pages per document at 30.~~ Done and then undone, and the second
  decision is the right one. A cap meant a contract read to page thirty could
  not answer about page forty, so every answer about a long document carried a
  hole the reader could not see. Half a transcript is worse than none, because
  none is obviously none.

  What bounds the cost now is the person. Pages are counted first, which is
  free, and the price is put to them in credits before a page is fetched:
  "52 pages, about 3 minutes. Costs 520 credits, leaving you 180." Nothing is
  read that has not been agreed to, and nothing is read in part.
- **Consider Haiku for the brief** and compare the output.

---

## The numbers to hold on to

- A free user costs **under a cent**, for good.
- A Pro user who never touches Expyr AI costs **under a cent**, for good.
- A new install's thirty welcome pages cost **about 24 cents**, once.
- Everything after that is bought before it is spent, so no amount of use by
  one person can cost more than they have paid.
- Hosting is **$7/month** once the service moves off Render's free plan, which
  is required before submission anyway.

The tracker funds itself many times over. Expyr AI cannot lose money by
design, because nothing is spent that was not bought first. What it can still
do is fail while somebody is paying attention, which is why the reading has to
work before any of this is sold.
