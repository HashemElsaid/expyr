# How the first thousand people find it

Rewritten 9 September 2026, after the app went worldwide and grew a
subscriptions feature. `STORE.md` holds the listing copy. This is everything
that happens outside the listing.

---

## The one thing to understand first

**Expyr has two audiences, and they are not the same people.**

**In the UAE** it is a renewal authority. Verified guidance, the right portal,
the actual fine for being late. The moat is knowledge nobody else has bothered
to check, and the hook is search intent at the moment somebody is panicking
about a visa.

**Everywhere else** it is a plain tracker with a subscription scanner. The
guidance is labelled generated rather than verified, the portals are absent,
and the categories go generic. What is left is genuinely useful and
undifferentiated.

Marketing one app to both means **two motions, not one campaign with two
headlines.** Everything below is organised that way.

---

## The distribution problem, stated honestly

Expyr is built to be silent, which is right for the product and a problem for
growth. **Nobody tells a friend about a reminder that worked.** The payoff
arrives months later, invisibly, as a fine that did not happen.

Two consequences to hold on to:

- **Do not plan around virality for the tracker.** Plan around finding people
  at the moment they are already in pain
- **Retention metrics will look terrible and be fine.** Somebody who opens the
  app twice a year and renews on time is a total success and a churned user on
  any standard dashboard. Do not optimise against that number

---

## What is actually shareable

One feature breaks the silence rule: **the subscription scan.**

"Screenshot your App Store subscriptions list and it reads every one of them,
what it costs and when it renews" is demonstrable in fifteen seconds, needs no
explanation, and produces a number about the viewer's own life. Document expiry
reminders do none of that.

**So the subscription scan is the top of the worldwide funnel**, whether or not
it is the most valuable thing the app does. It is the part that travels.

And it carries the line that matters most: **nothing is connected to your bank,
nothing reads your email.** Every serious subscription tracker works by linking
a bank account or scraping an inbox. Expyr reads a screen. For an app that also
holds passports, that is the whole trust argument in one sentence.

---

## Phase 0. Launch week: do nothing

**No marketing at all for the first seven days.** The purpose of this week is
information, and marketing on top of an unmeasured product buys noise.

Watch four things, all free in App Store Connect:

| Number | Why |
|---|---|
| Crash rate and scan failure rate | Anything above trivial and stop everything else |
| Product page views to installs | Tests the screenshots and subtitle, nothing else. Industry is around 30% |
| Installs to Pro | The only number that pays for anything. **Break-even is 0.29%** |
| Support messages per 100 installs | Under 3 is normal. Count them by cause, not volume |

**Where those live.** App Store Connect → the app → **Analytics** for
impressions, page views, App Units, crashes and retention; **Sales and
Trends** for every download and every in-app purchase as a transaction, broken
out by product and country, which is where Expyr Pro versus each credit pack
is counted. Both lag a day or more. Installs and purchases are complete;
sessions, active devices and retention count only people who opted in to
sharing analytics with developers, so treat them as a sample. Apple reports
counts, never identities.

**First outside user, 11 September.** A driving licence scanned, three
subscriptions imported from a screenshot, and both came through with the right
dates and prices first time, on the shipped binary. One data point, but it is
the one that says the two features the listing leads on work for a stranger.

Two more that decide the pricing question in `MONEY.md`: **how many installs
open Expyr AI at all**, and **how many Pro buyers ever top up.** The second is
arithmetic on Sales and Trends: credit-pack purchases over Pro purchases. The
first is invisible to Apple, because it is behaviour inside an app that ships
no analytics SDK on purpose. It has to be counted on the server, where every
`/extract`, `/read` and `/ask` already arrives: calls per day, and distinct
install tokens that ever read. No tracking of anyone, and it is the only way
to answer the question at week eight.

---

## Phase 1, weeks 2 to 6. The UAE motion

This is where the product is best and the competition is thinnest.

### The renewal guides, published as web pages

**Drafted 9 September, awaiting verification.** Five pages at `docs/guides/`:
Emirates ID, residence visa, Mulkiya, driving licence and Ejari, linked from
the landing page and from each other.

Each carries the same shape: a short version with cost, time and the late fine;
the numbered steps; and a section on the part people get wrong, which is what
makes a page worth linking to rather than skimming. Every page opens by naming
the responsible authority and telling the reader to confirm there, and closes
by saying plainly that it is a summary for planning, not official instruction,
and not affiliated with any government body.

**They must be checked before they go live.** The figures come from
`document-types.ts`, which is the app's own data and has never been audited for
a public page that ranks in search. A wrong fee on a page Google surfaces
damages more than it earns.

**Why this is the best channel available.** Somebody landing on "how to renew
your Emirates ID" while panicking about one is the highest-intent visitor this
app will ever get, and the page ends by offering to remember the next one. It
is slow to start, it compounds, and it is the only thing here that works while
you sleep.

**Publishing checklist**, once the figures are verified:

1. Push to `main`, since GitHub Pages serves `docs/` from there
2. Confirm all five render at hashemelsaid.github.io/expyr/guides/
3. Submit the guides index to Google Search Console. Without it, indexing takes
   weeks rather than days
4. Only then start pointing anybody at them

### Reddit, r/dubai and r/UAE

Precisely the audience: expats dealing with exactly these documents, asking
exactly these questions, daily. Also strict about self-promotion and quick to
punish it permanently.

**Be useful for weeks before mentioning anything.** Answer renewal questions
properly, from the guides you already have. Mention the app rarely and only
where it genuinely answers the question asked. One good thread is worth more
than a hundred impressions anywhere else, and one promotional post costs you
the channel for good.

### Local press, launch week, one email each

Gulf News, Khaleej Times and TimeOut Dubai all run app roundups. A UAE-specific
utility built by a UAE resident is a story they take. Free to pitch, and the
pitch is one paragraph: *a UAE developer built an app that reads your Emirates
ID and tells you what renewing it costs.*

### UAE expat Facebook groups

Large, active, far less strict than Reddit, lower quality per member. Same
content, after Reddit.

---

## Phase 2, weeks 4 to 10. The worldwide motion

Different hook, different content, same app.

### One video, made properly, posted everywhere

**The demo:** open the App Store subscriptions list, screenshot it, feed it to
Expyr, watch five subscriptions and their renewal dates appear. End on the
yearly total.

Fifteen seconds. No voiceover needed. Post it on TikTok, Reels and Shorts, and
as the App Preview video on the listing itself.

The caption is the differentiator, not the feature: **"It never touches your
bank."**

This is the only piece of marketing in this plan that could plausibly reach a
hundred thousand people, and it costs an afternoon.

### Product Hunt

An evening's work. A mostly US audience with low UAE relevance, so treat it as
a link and a badge rather than a growth channel.

### App Store search

Free, highest intent, and already handled by the two localisations in
`STORE.md`. Ranking moves on downloads and ratings, which means **the first
twenty reviews matter more than any twenty after them.** Ask for a rating only
after somebody has completed a renewal, never on second launch.

---

## Phase 3. Paid, and only against a measured number

**Start at zero.** Every channel above is free, and paid acquisition against
unmeasured conversion is guessing with a credit card.

When there is a real conversion rate, `MONEY.md` sets the ceiling: an install
is worth about **$0.62 net**. So:

- Under **$0.40** an install, reliably: worth doing
- Over **$0.60**: loses money at the assumed rates, and the assumed rates are
  optimistic until proven

The first place to spend, when that day comes, is **Apple Search Ads on UAE
document keywords**, because it is the one place where high intent and a real
moat meet.

---

## What not to do

**Do not buy installs before week eight.** You would be paying to find out
something the free channels tell you for nothing.

**Do not promote in a subreddit before contributing to it.** It is a one-way
door and both of your best communities are strict.

**Do not lead with AI.** Nobody searches for an AI app. They search for how to
renew a visa, or for a way to see what their subscriptions cost. The AI is how
it works, not what it is for.

**Do not chase retention.** See above. Optimising a silent app for daily opens
would mean making it noisier, which is the one thing that would kill it.

---

## The order, in one list

1. Submit, and do nothing for a week
2. Read the four numbers, and the two that decide pricing
3. Publish five renewal guides
4. Start being useful on r/dubai and r/UAE
5. Make the subscription video, post it everywhere
6. Pitch three UAE publications
7. Reassess at eight weeks against `MONEY.md`
8. Only then, consider spending money
