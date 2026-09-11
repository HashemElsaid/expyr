# What happens after somebody installs it

Written 7 September 2026, before there is anybody to support. That is the right
time: the first angry email is a bad moment to be deciding policy.

---

## The address, which needs changing before launch

`docs/support.html` and `docs/privacy.html` both publish
**hashim.elsaeed@gmail.com**, and App Store Connect will carry it as the
support URL. That is your personal address, on a public page, permanently.

Three problems, in ascending order of seriousness:

1. **It cannot be handed to anyone.** Not today's problem, and it is the kind
   of thing that is impossible to change later once it is in a thousand app
   listings and a hundred email threads
2. **Support and personal mail arrive in the same place**, so a bug report
   sits next to everything else and gets read at the same rate
3. **It is scraped.** A public address on an App Store listing collects spam
   for as long as the listing exists, and the address is also your Apple
   Account

**Recommendation: buy a domain and use `support@` on it.** Roughly $15 a year.
It fixes all three at once, gives the policy pages a real home instead of a
github.io subdomain, and gives the guides in `GTM.md` somewhere to live that
looks like a product rather than a repository.

If that is not worth doing yet, a separate free mailbox is most of the benefit
for none of the money. What should not happen is launching with a personal
Gmail on the listing because it was already there.

---

## Refunds, which are not yours to give

**You cannot refund an App Store purchase.** Apple decides, through
reportaproblem.apple.com, and it does so without consulting you. This surprises
developers and it will surprise your users, who will write to you asking for
their money back.

The reply is short and it should never be defensive: point them at Apple, say
plainly that Apple handles this and you have no way to do it yourself, and
offer to fix whatever went wrong instead.

Two things to know about refunds here specifically:

- **Consumable credits can be refunded after they are spent.** Somebody can
  read a fifty page contract and then get the top-up refunded, and there is no
  mechanism to take the pages back. The exposure is one pack, at most $6.50 of
  cost, and it is not worth building anything to prevent
- **Expyr Pro is Family Shareable**, which is a deliberate decision. One
  purchase can serve a household. That is a feature, and the arithmetic in
  `MONEY.md` already assumes it

---

## Reviews are support, and they are public

Apple lets developers reply to App Store reviews, and the reply appears under
it. **Reply to every one and two star review**, without exception and without
argument.

The audience is not the person who wrote it. It is the next hundred people
reading the reviews before deciding, and what they are judging is whether
somebody is home. A calm reply naming the actual problem does more for
conversion than the star rating it sits under.

Ratings also feed App Store search ranking, so the first twenty reviews matter
more than any twenty after them.

---

## What to expect, and what would be a warning

For a utility app, **one to three support messages per hundred installs** is
ordinary. `GTM.md` lists it as a metric for that reason.

The number is less useful than the shape. Count messages by cause, not by
volume:

| Cause | What it means |
|---|---|
| A scan read the wrong date | Expected, and the reason the field is editable. Only a problem if it is most of the mail |
| Nothing arrived when it should have | **Serious.** The whole product is the reminder. Anything here goes straight to the coding session |
| Credits vanished or a read failed after paying | **Serious, and it is money.** Refund the credits, then find out why |
| How do I get it on my other phone | Not a bug. It is the deliberate no-accounts decision, and the answer is the iPhone backup |
| Asking for a refund | Apple's, see above |

**Answer within 24 hours.** Not because anybody promised, but because at this
volume it is easy, and it stops being easy exactly when it starts mattering.

---

## Replies worth writing before they are needed

Short, plain, no apology theatre. The app's own voice, which is
numbers over prose.

**A wrong date from a scan.** "Thanks for sending it over. Tap the date on the
item and you can correct it, and the reminder reschedules itself. If you can
send the photo it misread I will use it to test against."

**A reminder that did not fire.** "That should not happen and I want to find
out why. Two questions: is Expyr allowed to send notifications in iOS
Settings, and what reminder hour is set in the app? If you can tell me which
document it was, I can check the schedule it built."

**A refund request.** "Refunds go through Apple rather than through me, at
reportaproblem.apple.com. I have no way to issue one myself. If something is
not working, tell me what it is and I will fix it."

**Credits spent on a read that failed.** "That is on my side and I have put the
credits back. Reads are charged per page as each page arrives, so a failure
should not cost anything. This one did, which means something is wrong. Thank
you for telling me."

**Another device.** "Expyr keeps everything on the phone, with no account and
no server copy, which is deliberate for documents like these. It travels with
your iPhone backup, so a new iPhone restored from backup arrives with
everything. There is a JSON backup in Settings if you would rather move it by
hand."

---

## Giving someone Pro without charging them

Three ways exist, and only two of them work on the shipped app.

**Promo codes are the answer for a friend, a reviewer or a journalist.** App
Store Connect issues codes for an in-app purchase, up to 100 per product every
six months, each valid for 28 days after it is made. The person redeems it in
the App Store app under their profile, Redeem Gift Card or Code, then opens
Expyr and taps Restore Purchases if Pro has not appeared on its own. Apple
records it as a real transaction at zero proceeds, so it behaves exactly like a
purchase, including the 1.0.1 credit grant keyed on the transaction id. Costs
nothing and needs nothing installed beyond the real app.

**TestFlight is the answer for testing the next build.** A tester installed
through TestFlight gets every in-app purchase free, because TestFlight runs
against the sandbox. Right for someone hunting bugs in 1.0.1 before it ships,
wrong for someone who just wants to use the app, because the TestFlight copy
expires after 90 days and is not the App Store copy.

**The sandbox account does not help here.** It only takes effect in TestFlight
and development builds. On the App Store build, purchases are real whatever
account is in Settings.

## Where things go

- **A bug, a crash, a wrong reminder** goes to the coding session, with the
  device, the iOS version and what the person actually did
- **A refund, an App Store problem, a payment failure** goes to Apple
- **A pricing complaint** goes nowhere for now. Note it, count it, and change
  nothing until there are enough of them to be a signal rather than a mood
- **A feature request** gets a real reply and a note in a list. Most of them
  will be sync, which is answered above and is not changing

---

## One decision still open

**Whether to publish a changelog.** Not required, and worth it for an app whose
whole promise is that it will still be working in eleven months. A dated page
saying what changed is the cheapest evidence that somebody is still here.

It would live on the same site as the guides, so it depends on the domain
question at the top of this document.
