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

**Phase 0, before anything.** Ship to the **UAE storefront only**. Not a
soft-launch trick, a real one: the guides, the categories and the portals are
UAE-specific, and a Norwegian who installs this finds an app about a country
they do not live in and leaves a two-star review that follows you.

**Phase 1, two quiet weeks.** No marketing at all. Watch four things:

- Crash rate and the scan failure rate
- How many installs open Expyr AI, and how much of the welcome balance they
  spend. Both numbers in `MONEY.md` are guesses until this
- Support volume and, more importantly, what it is about
- Pro conversion. Break-even is 0.29%. If it is under that at fifty installs
  it means nothing yet, and it will feel like it means something

**Phase 2, the guides go live** and the Reddit presence starts. Still no paid
anything.

**Phase 3, widen the storefront** to Saudi Arabia and Qatar, which the pricing
already anticipates, only once the guides for those countries exist. Shipping
to a storefront whose renewal content is wrong is worse than not shipping to
it.

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
