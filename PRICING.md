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

### Expyr Pro — AED 149, once

Unchanged. Removes the three ceilings on the tracker: items, scans, and
document readings. Not a subscription, for the reason settled in September —
the app is built to be silent, and renting silence invites "what am I paying
for?" at every renewal.

### Expyr AI — sold by the document, not by the month

**Twenty document reads included with Pro. Top-up packs when they run out.**

Questions about a document already read are **free and unlimited**. The read is
the unit that is paid for; asking is the thing that was bought.

### Why not a subscription

$3/month nets $2.10 after Apple's cut — about twenty-five questions. One
curious user is underwater in the first week.

$5/month nets $3.50, or $4.25 under the **App Store Small Business Program**
(15% instead of 30% for developers under $1M a year — worth enrolling in
regardless, it nearly doubles the margin on everything). Survivable, but
unlimited use against a fixed monthly fee is the same unbounded liability that
made the one-off purchase risky, wearing a different hat.

### Why not a visible money balance

A credit balance denominated in dollars was considered and rejected, on
evidence gathered the hard way: watching a balance fall from $1.28 to $1.13
produced the immediate reaction *"I will keep losing money like this with
nothing in return."*

That is exactly what a user would feel, and it is fatal for this feature in
particular. A draining balance makes people ration. Every question becomes a
purchase decision, and hesitation before each question destroys the thing being
sold.

**Count documents, not money.** "17 of your 20 reads left" is concrete, feels
generous, and nobody does arithmetic before asking a question. "$4.20
remaining" is a meter running. Identical economics; opposite psychology.

---

## What bounds the downside

The worry that prompted this: *somebody keeps trying to read a very large PDF
that keeps timing out, and it costs us every time.*

Four things already in the code:

1. **Completed batches are banked.** A retry buys only the missing pages, so a
   repeatedly-failing read converges instead of multiplying.
2. **A finished read is cached on the phone.** Re-opening the document is free
   forever.
3. **Only a successful read counts** against the allowance. A failure delivers
   nothing and is charged for nothing.
4. **Questions are bounded** by `ASK_TEXT_BUDGET` regardless of library size.

Still to do:

- **Cap pages per document at 30.** A 50-page contract is ~$0.40 with no
  ceiling today. Thirty pages bounds the worst case at ~$0.25 and is honest —
  say "read the first 30 pages of 52" rather than truncating quietly.
- **Consider Haiku for the brief** and compare the output.

---

## The numbers to hold on to

- A free user costs **under a cent**, for good.
- A Pro user who never touches Expyr AI costs **under a cent**, for good.
- A Pro user who reads all twenty included documents and asks freely costs
  **about $3.50** — against a AED 149 (~$40) purchase.
- Hosting is **$7/month** once the service moves off Render's free plan, which
  is required before submission anyway.

The tracker funds itself many times over. Expyr AI is the part that needs
watching, and twenty documents is the number that keeps it watched.
