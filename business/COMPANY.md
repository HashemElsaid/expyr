# Who the seller is, and what it owes

Written 7 September 2026. Nothing here is legal or tax advice. It is the
research, the arithmetic, and the specific questions to put to an accountant,
so the hour you pay for is spent on your situation rather than on explaining
what the App Store is.

---

## What you are today

**An individual, enrolled in the Apple Developer Program on 6 September 2026.**

That has one consequence that is public and feels permanent: **your legal name
is the seller name on the App Store listing.** Not "Expyr", not a company. The
name that had to match your government ID before Apple would admit you.

Changing it means a separate Organization enrolment, which needs a trade
licence and a D-U-N-S number. It is not an upgrade to the existing membership,
it is a different membership, and apps have to be transferred between them.

**This is fine and should not be changed before launch.** Individual seller
names are ordinary on the App Store, nobody reads them as amateur, and the
alternative costs money and weeks for a cosmetic gain. Revisit when there is a
trigger listed at the bottom of this document, not before.

---

## Tax, in four parts

### 1. VAT and sales tax: already handled, by Apple

Apple is the **merchant of record** in the UAE and over seventy other
countries. It collects the local VAT, GST or sales tax from the buyer and
remits it to that government itself. In the UAE that is 5%, and it comes off
before Apple calculates its commission, which is why `MONEY.md` starts from
AED 141.90 rather than AED 149.

**You do not register for VAT in each country. You do not file anything
abroad.** This is the largest piece of administrative work that selling
software internationally used to involve, and Apple absorbs it.

### 2. US withholding: a form, and probably no tax

The UAE has income tax treaties with many countries. **The United States is not
one of them.** There is no reduced treaty rate to claim, so the W-8BEN goes in
without claiming treaty benefits.

That sounds alarming and probably is not, for a structural reason: the default
30% US withholding attaches to US-source **royalties**. Apple's App Store
arrangement is a sale-and-commission structure rather than a royalty licence,
which is why non-US developers generally see no withholding on App Store
proceeds. Apple's book store historically worked differently.

**Do not take that as settled.** Apple's own tax questionnaire states the rate
it applies, on screen, at submission. Read it and record it. If it says 30%,
that is material and `MONEY.md` needs rewriting rather than adjusting.

### 3. UAE corporate tax: almost certainly not yet

A **natural person** falls within UAE corporate tax only if turnover from
business activity exceeds **AED 1,000,000 in a calendar year**. Below that
there is no registration obligation and no return.

Above it:

- 0% on taxable income up to AED 375,000
- 9% above that
- Registration due by 31 March of the following year, with an automatic
  AED 10,000 penalty for missing it

For scale: AED 1,000,000 of turnover, at AED 120.62 net per Pro sale, is about
**8,300 Pro sales in one calendar year**. That is a good year, not a likely
first one, and if it happens you will have seen it coming for months.

**One thing not to plan around.** Small Business Relief, which exempts revenue
up to AED 3,000,000, applies only to tax periods ending **on or before 31
December 2026**. It is expiring as this launches. Any advice you read that
leans on it is describing a rule about to stop existing.

### 4. UAE VAT on your own supply: ask an accountant

A different question from part 1, and the one genuinely unclear point here.

Your supply is not to the UAE consumer, it is to Apple's distributing entity,
which sits outside the UAE. That is normally an export of services and normally
zero-rated, which would mean no registration obligation at any size. The
mandatory registration threshold is AED 375,000 of taxable supplies.

Zero-rated supplies still count toward some thresholds on some readings, which
is exactly the sort of question a UAE accountant settles in ten minutes and I
should not settle at all.

**Not urgent.** It cannot bite before revenue exists.

---

## The question I cannot answer without you

**Does selling an app as an individual require a licence, given your
residency?**

The UAE requires a licence to conduct business activity. For individuals that
is usually a **freelance permit**, issued by a free zone rather than the
mainland DED, cheaper and lighter than a full trade licence, and available for
technology work.

Whether you need one turns on facts I do not have:

- Are you a UAE resident, and on what visa? Employment, golden, dependent and
  freelance visas all sit differently here
- If you are on an employment visa, do your contract and the MOHRE rules permit
  outside business activity? This is the one that catches people, and it is a
  contract question before it is a licensing one
- Are you resident somewhere else entirely, in which case none of the analysis
  above is the right analysis

**Tell me these three and I will finish this section properly.** Until then the
tax analysis above is conditional on UAE residency.

---

## The US LLC idea

You were researching this before enrolment, to get a company seller name. Worth
writing down why it is probably the wrong tool.

**It does not do the thing you wanted.** A US LLC does not by itself produce a
company seller name on the App Store. That needs Organization enrolment, a
D-U-N-S number, and a legal entity Apple accepts. Switching means a new
membership and an app transfer wherever the entity is registered.

**It does not reduce tax.** A single-member LLC owned by a non-resident is
disregarded for US federal tax. It does not change your UAE position and it
cannot create a US treaty position where none exists.

**It adds an obligation with a large penalty attached.** A foreign-owned
single-member US LLC has to file **Form 5472 with a pro-forma 1120 every
year**, with no US income and no activity. The penalty for failing to file is
understood to be **$25,000**. That is a real annual chore with a real fine,
bought in exchange for nothing you were trying to buy.

**Recommendation: no.** If a company seller name matters later, a UAE free zone
licence gets you there in the jurisdiction you actually live in, and answers
the freelance-permit question in the same application.

---

## When to revisit the entity

Not on a schedule, on a trigger. Any one of these is worth an accountant's
hour:

- Turnover approaching **AED 1,000,000** in a calendar year
- Wanting the seller name to read as a company rather than as you
- Taking money from anybody, or bringing in a partner
- Hiring, or paying a contractor regularly
- A second app, or any revenue that is not the App Store

Until one of those fires, an individual seller with a clean W-8BEN and no UAE
registration obligation is the correct and cheapest shape.

---

## Account identifiers

Kept here because they are needed in three different places and are otherwise
only visible while logged in.

| | |
|---|---|
| Apple Team ID | BZ5RDB2NVC |
| Developer account email | hashimsherif2005@gmail.com |
| Legal name on the membership | Hashem Elsaid |
| Bank account name at FAB | HASHEM SHERIF MAMDOUH M ELSAID |

The Team ID is what the submit block in eas.json needs, alongside the Apple ID
and the App Store Connect app id once the app record exists. That block is
currently empty.

Note that the **developer account email is not the support address**. The app
and both policy pages publish hashim.elsaeed@gmail.com, and Apple corresponds
with hashimsherif2005@gmail.com. Neither is wrong, but a build failure notice
and a user complaint will arrive in different inboxes, and only one of them is
being watched. See SUPPORT.md on replacing the published address entirely.

## The paperwork, and where it stands

| Thing | Where | State |
|---|---|---|
| Apple Developer Program | Apple | Active, individual, renews around 6 Sept 2027, $99 |
| Paid Applications agreement | App Store Connect | **Unsigned. Blocks everything else** |
| W-8BEN | App Store Connect | Not submitted |
| Bank account | App Store Connect | Not added |
| Terms of use | hashemelsaid.github.io/expyr/terms.html | Live |
| Privacy policy | hashemelsaid.github.io/expyr/privacy.html | Live, and **becomes false the moment sign-in ships**. `LAUNCH.md` §6 lists all six places that have to change together |
| Business licence | none | Open question above |
| UAE corporate tax registration | none | Not required below AED 1M turnover |
