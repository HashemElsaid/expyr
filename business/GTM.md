# How the first thousand people find it

Written 7 September 2026. `STORE.md` holds the listing copy: name, subtitle,
keywords, description, screenshots. This is everything that happens outside
the listing.

---

## The distribution problem, stated honestly

Expyr is built to be silent. That is the right product decision and it is a
marketing problem, because **nobody tells a friend about a reminder that
worked.** The payoff arrives months after install, invisibly, as a fine that
did not happen. There is no moment of delight to screenshot.

Two consequences:

- **Word of mouth will be weak.** Do not plan around virality. Plan around
  finding people at the moment they are already in pain
- **Retention metrics will look bad and be fine.** Somebody who opens the app
  twice a year and renews on time is a total success and a churned user by any
  standard dashboard. Do not optimise against that number

The moment of pain is specific and it is searchable: somebody has just been
fined, or has just realised a document expires soon, and they are typing a
question into Google or the App Store.

---

## The asset nobody is using yet

**The renewal guides are the marketing, and they are locked inside the app.**

`src/data/renewal-actions.ts` and the generated guidance answer exactly the
questions people type at the moment of intent: how to renew an Emirates ID,
what a Mulkiya renewal costs, what the fine is for a late visa. That content
already exists, it is already cached and shared, and it is currently visible
only to people who have already installed.

**Publish the guides as web pages on the existing GitHub Pages site.** It is
free, it needs nothing from the coding session, and it turns the content moat
into the acquisition channel. Somebody who lands on "how to renew your
Emirates ID" while panicking about a renewal is the highest-intent visitor
this app will ever get, and the page can end by offering to remember the next
one for them.

Three conditions on doing it:

1. **Verify every guide before it is published.** In-app they carry a label
   saying to check against official sources, which is honest for a tool
   somebody chose to install. A public web page that ranks in search is read
   as authoritative whatever the label says, and a wrong fee or a dead portal
   link damages more than it earns
2. **Publish a few, well, rather than all of them.** Start with the five
   highest-volume: Emirates ID, residence visa, Mulkiya, driving licence,
   Ejari
3. **Date every page and link the official source at the top**, not the
   bottom. It is what a person came for and it is what makes the page
   trustworthy

This is the single highest-leverage marketing item on the list, and I can
draft the pages once you say go.

---

## Channels, ranked by what they are actually worth

**1. App Store search.** Highest intent, and free. Covered by `STORE.md`.
Worth knowing that ranking moves on downloads and on ratings, so the first
reviews matter disproportionately.

**2. Search, via the published guides.** See above. Slow to start, compounds,
and it is the only channel here that keeps working while you sleep.

**3. Reddit, r/dubai and r/UAE.** Precisely the audience: expats dealing with
exactly these documents, asking exactly these questions, every day. Also
strict about self-promotion and quick to punish it.

The way in is to be useful for weeks before mentioning anything. Answer
renewal questions properly, from the guides you already have. Mention the app
rarely and only where it genuinely answers the question asked. One good
comment thread there is worth more than a hundred impressions anywhere else,
and one promotional post will cost you the channel permanently.

**4. UAE expat Facebook groups.** Large, active, far less strict than Reddit,
lower quality per member. Worth doing after Reddit, with the same content.

**5. Instagram and TikTok, short vertical video.** UAE life-admin content
performs well. The format that fits is "the fine you did not know about",
built straight from a guide. Cheap to try, hard to sustain, and it needs a
face or a voice.

**6. Local press.** Gulf News, Khaleej Times and TimeOut Dubai all run app and
tech roundups, and a UAE-specific utility built by a UAE resident is a story
they take. Free to pitch, one email each, worth doing in launch week.

**7. Product Hunt.** Low UAE relevance and a mostly US audience. Do it because
it costs an evening, not because it will move installs.

---

## The launch sequence

**Phase 0. Ship worldwide.** Decided 7 September, overriding the UAE-only
launch this section used to argue for. Availability is set to all 175
storefronts, and future ones automatically.

The reversal is on evidence rather than ambition. The app already degrades
honestly outside the UAE rather than breaking. `src/data/countries.ts` says so
in its own words: the UAE is "the only country whose renewal knowledge we have
actually checked, portal by portal and fee by fee. Everywhere else gets the
tracker and nothing more." Concretely, outside the UAE:

- Document labels fall back to generic ones. Mulkiya becomes vehicle
  registration, Ejari becomes a tenancy contract
- Guidance still appears but is labelled `generated` rather than `verified`, so
  nobody is shown UAE instructions dressed as fact
- Gap analysis and late fees switch off, because those were checked against UAE
  authorities and nothing else

Someone in Toronto gets a plain working tracker, not a broken app. That is a
defensible thing to ship.

**Three things to hold on to as a result.**

**The US is where the moat is not.** In the UAE you compete on knowing what a
Mulkiya is and which portal renews it. In the US that knowledge does not exist
and the underlying need is thinner, because citizens do not renew residency.
What remains is passports, driver's licenses, car insurance and warranties,
against a crowded field of generic reminder apps. Expect UAE and US conversion
to look very different, and do not read a weak US number as a fault in the app.

**Early reviews now come from a mixed audience.** The first twenty ratings
weigh more in search ranking than any twenty after them, and a UAE user rating
the full experience and a US user rating a plain tracker are one to two stars
apart. This was the argument for launching UAE-first, and it is the price of
not doing so.

**The guidance cost surface multiplies.** Guidance is cached per document type
**and region**. UAE-only is thirteen combinations. Worldwide is thirteen times
however many countries people actually arrive from.

This was the sharpest argument against going wide on the free Render plan, where
the cache lived in memory and died every fifteen idle minutes. **Render moved to
the paid plan on 7 September with a disk**, so the cache now survives a deploy
rather than an idle period, and the multiplication is a one-off generation cost
per country rather than a recurring one. The ceiling of
`EXPYR_GUIDANCE_DAILY_NEW` at 40 new generations a day still applies, and still
means a user who hits it gets nothing that day. See `MONEY.md`.

The coding session has been briefed to make the app genuinely good
internationally rather than merely not-broken: `trade-license` has no generic
label, `driving-license` carries the British spelling, and the type picker may
still offer Emirates ID to somebody in Canada.

**Phase 1, two quiet weeks.** No marketing at all. Watch four things:

- Crash rate and the scan failure rate
- How many installs open Expyr AI, and how much of the welcome balance they
  spend. Both numbers in `MONEY.md` are guesses until this
- Support volume and, more importantly, what it is about
- Pro conversion. Break-even is 0.29%. If it is under that at fifty installs
  it means nothing yet, and it will feel like it means something

**Phase 2, the guides go live** and the Reddit presence starts. Still no paid
anything.

**Phase 3, deepen rather than widen**, since the widening already happened.
Saudi Arabia and Qatar are the first two countries worth researching guides for
properly, promoting them from `generated` to `verified`. The pricing already
anticipates both. Verified guidance is the moat, and it is the only thing that
makes a storefront worth more than the one next to it.

---

## Money for marketing

**Start at zero.** Every channel above is free, and paid acquisition against
unmeasured conversion rates is guessing with a credit card.

When there is a measured conversion rate, `MONEY.md` sets the ceiling:
an install is worth about **$0.62 net**. Anything reliably under **$0.40 per
install** is worth doing. Anything over sixty cents loses money at the assumed
rates, and the assumed rates are optimistic until proven.

---

## What to measure, and what to ignore

App Store Connect gives impressions, product page views, installs and
conversion for free. The four numbers that matter:

| Number | Why | Break-even |
|---|---|---|
| Product page view to install | Tests the screenshots and subtitle, nothing else | industry ~30% |
| Install to Pro | The only number that pays for anything | **0.29%** |
| Install to AI use | Replaces the 35% guess in `MONEY.md` | n/a |
| Support tickets per 100 installs | An early warning that something is broken | under 3 |

Ignore day-7 and day-30 retention. They will look terrible, and for this app
that is what success looks like.
