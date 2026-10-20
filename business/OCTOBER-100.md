# 100 installs by 31 October

Set 20 October 2026. Target: 100 first-time downloads in App Store Connect
between 21 and 31 October.

**Strangers only.** Hashem decided on 20 October that every install should
come from people who do not know him: no friends, family, WhatsApp contacts or
asking people to forward it. So every channel below is public or paid.

**On hold, 20 October: no ads until the audit is back.** Hashem's call:
everything in the app has to work and the store page has to match the app
before money goes on ads. Two facts behind it:

- **The redesign was never shipped.** A redesign made with Codex sits as
  uncommitted changes (56 files, 17 September to 11 October) in the main
  checkout. The live app is 1.0.1 build 8, the September design. The App
  Development session was asked on 20 October to save it on a branch, audit
  the live app and the redesign, and recommend: ads now on 1.0.1, or ship the
  redesign as 1.0.2 first.
- **Audit back, 20 October: no blocker in the live app.** But the live
  listing's first screenshot shows a real personal document from the phone
  it was captured on, not demo data, and Apple Ads shows the first
  screenshots in the ad itself. So ads wait for 1.0.2 and its new
  screenshots, which come from the 13 September recordings: demo household
  only, checked frame by frame. Never reuse any earlier "frame 01".
- **Screenshots only change with a new version.** Better store screenshots
  mean a 1.0.2 and another Apple review either way. Submissions are blocked
  until Hashem accepts Apple's updated Developer Program License Agreement in
  App Store Connect.

## Where we start

App Analytics, 20 September to 19 October:

| | |
|---|---|
| First-time downloads | 11 |
| Product page views | 89 |
| Impressions | 256 |

About one in eight people who open the store page install. The page works;
almost nobody reaches it. At this pace the 11 days bring about 4 installs, so
roughly 96 have to come from new work.

## The plan, by channel

| Channel | Who does it | Target | How sure |
|---|---|---|---|
| Apple Ads on UAE search | Hashem adds the card, the rest is set out below | 70 | Medium. Depends on the cost per install, unknown until day two |
| UAE expat Facebook groups | Hashem posts, one group a day | 10 | Low to medium. Depends on each group's rules |
| Reddit, r/iosapps and r/SideProject | Hashem posts | 10 | Low to medium |
| TikTok (ReelFarm, running), press, Product Hunt | Running, or Hashem sends | 10 | Low. Bonus, do not count on it |

**The ads carry it.** The free channels together are realistically 15 to 35
installs. The rest has to be paid.

**What the ads cost, honestly.** `MONEY.md` values an install at about USD 0.62
net. My estimate for UAE search ads, until two days of real data replace it, is
USD 1 to 3 an install, so 70 installs is roughly USD 70 to 210. The ads lose
money on each install. What they buy is the target, App Store ranking from the
extra downloads, and a real cost-per-install number for later. `GTM.md` said
no paid before week eight (early November); this target moves that forward by
about a week, Hashem's call.

**Never:** install-buying services, paid or swapped reviews, or rewards for a
rating. Apple treats all of it as manipulation and can remove the app or the
developer account.

---

## 1. Apple Ads, set up once, about 20 minutes

1. Go to ads.apple.com and sign in with the same Apple account as App Store
   Connect. Accept Apple Ads' terms and add a card yourself.
2. If it offers **Basic**: choose Expyr, country United Arab Emirates, monthly
   budget USD 200, **maximum cost per install USD 2.50**. You pay only when
   someone installs, so USD 200 buys at least 80.
3. If only **Advanced**: one campaign, United Arab Emirates, daily budget
   USD 20, end date 31 October. Search match off. Exact-match keywords:
   `emirates id`, `emirates id renewal`, `visa renewal`, `uae visa`,
   `mulkiya`, `car registration renewal`, `expiry reminder`,
   `renewal reminder`, `document reminder`, `subscription tracker`,
   `subscription manager`, `bill reminder`. Max cost per tap USD 1.00.
4. After two days, read the cost per install. Over USD 3: cut the
   keywords that cost the most. Under USD 1.50: raise the daily budget if you
   want more, since the rest of the plan is uncertain.

## 2. Facebook groups, from Thursday

UAE expat groups (Dubai, Abu Dhabi, Sharjah expats, Q&A groups). Read each
group's rules first. Many allow promotion only on one day a week or in a
pinned thread; posting outside it gets you removed. One group a day, not
all at once.

```
I'm a UAE resident and I built a free iPhone app because I kept nearly
missing renewal dates. Take a photo of your Emirates ID, visa, passport or
Mulkiya and it reads the expiry date and reminds you weeks before. It also
reads a screenshot of your App Store subscriptions and shows what they cost
you in a year. Nothing connects to your bank. Feedback very welcome:
https://apps.apple.com/app/id6809437011
```

Answer every comment the same day.

## 3. Reddit, the subreddits that allow it

Not r/dubai or r/UAE: they ban self-promotion and `REDDIT.md` keeps those for
answering questions. r/iosapps and r/SideProject are built for developers
posting their own apps. Read the rules and use the flair they ask for. One
post each, a day apart, and reply to every comment.

**Title:**

```
I made an app that reads a screenshot of your iPhone subscriptions and shows every charge date and the yearly total
```

**Body:**

```
Solo developer in the UAE. Expyr reads one screenshot of Settings, your name,
Subscriptions, and lists every subscription with its price and next charge
date, adds up what the year costs, and reminds you a few days before each
charge. It also reads documents from a photo (passport, ID, licence, lease)
and reminds you weeks before they expire.

Nothing connects to your bank or your email. Free to try; Pro is a one-time
purchase, not a subscription, which felt like the only honest option for an
app about subscriptions.

I'd really like blunt feedback, especially on the first few minutes.

https://apps.apple.com/app/id6809437011
```

## 4. Running already, or optional

- **TikTok:** ReelFarm posts twice a day on @theadultingmanual1 with the new
  app-screen slides.
- **Press:** the pitch in `GTM.md` was meant to go out the day 1.0.1 was
  approved. If it has not gone, send it this week.
- **Product Hunt:** mostly a US audience. One evening, worth it only if the
  rest is done.

---

## Tracking

Apple's numbers lag a day or two and run on UTC days.

| Date | First-time downloads, running total since 21 Oct | Ads spend | Note |
|---|---|---|---|
| 20 Oct | 0 | 0 | Plan set, strangers only |
