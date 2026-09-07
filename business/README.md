# Running Expyr, the business

The code is handled in another session. This folder is the company around it:
what it owes, what it earns, who it sells to, and what happens when somebody
writes in.

Five documents, in the order they matter today:

1. `APP-STORE-CONNECT.md` — the setup runbook. Apple admitted the account on
   6 September. Seven things have to happen in order before anything can be
   sold, and the first one gates the other six. Start here.
2. `MONEY.md` — what each sale actually pays, what the year costs, and the
   number of sales that covers it.
3. `COMPANY.md` — who the seller is, which taxes apply, and whether the
   entity should change.
4. `GTM.md` — how the first thousand people find it.
5. `SUPPORT.md` — what happens after they do.

## Who does what

**YOU** is anything that needs your identity, a payment, a bank account, or a
decision that is yours. **ME** is research, arithmetic, drafting, and filing
work I can do and hand you finished.

This is not the same split as `LAUNCH.md`. There, ME meant writing code. Here
it means everything except the moment somebody has to be you.

## What is true right now

- Apple Developer Program: **admitted**, individual enrolment, 6 September
- App Store Connect setup: **not started**, and it blocks everything
- Selling: **impossible today**. StoreKit is stubbed, which is the coding
  session's problem, but the Paid Apps agreement is this session's and it is
  unsigned
- Costs running: $99/year Apple, $0/month Render on the free plan, Anthropic
  capped at $20/month
- Revenue to date: **zero**, and it cannot be otherwise until step 1 below

## The rhythm

Weekly until launch, monthly after:

- Reconcile what Apple reported against what `MONEY.md` predicted
- Check Anthropic spend against the cap, and against installs. The cap is a
  circuit breaker on a real service, not a budget line
- Read every support message and count them by cause, not by volume
- Update the numbers here in the same commit as the reconciliation

The reason for that last rule is the one already written into `LAUNCH.md`:
prose goes stale silently and no test catches it. A figure in this folder is
either current or it is a lie.
