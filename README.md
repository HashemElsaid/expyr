# Expyr

Nothing expires unnoticed.

Expyr tracks the documents that expire on you — residence visas, Emirates ID,
car registration, insurance, tenancy contracts, licences, warranties. You
photograph the document; Claude reads the date; Expyr reminds you in time and
tells you how to renew it.

Built for the UAE first: every category carries the real renewal steps, typical
cost, and the penalty for being late.

The tracker works anywhere — the guidance does not. Renewal steps, costs, fines
and prerequisite chains were verified against UAE sources only, so the app asks
which country you are in and shows the advisory half of the detail screen only
where it has been checked. Everywhere else keeps the dates, the reminders and
the actions, drops the guides, and uses country-neutral category names. Adding a
country means writing its guides and adding it to `WITH_GUIDANCE` in
`src/data/countries.ts`; no screen needs touching.

## Running it

Two processes, in two terminals.

**1. The scanning service** — holds the Anthropic API key, which must never ship
inside the app.

```bash
cd server
```

```bash
npm run dev
```

Copy `server/.env.example` to `server/.env` first and paste a **workspace-scoped**
key from the [Claude Console](https://platform.claude.com/settings/keys). A user
key will be rejected unless you also set `ANTHROPIC_WORKSPACE_ID`.

**2. The app.**

```bash
npx expo start
```

Scan the QR code with an iPhone running Expo Go. The app finds the scanning
service automatically at Metro's host, so nothing needs configuring on the same
Wi-Fi.

> **Expo SDK 57**, React Native 0.86, React 19.2 — matching whatever Expo Go on
> the App Store is currently on, because there is no way to install an older
> Expo Go on an iPhone. See `AGENTS.md` for what changed on the way here.

### Checks

```bash
npm test
```

```bash
npm run typecheck
```

The service has its own pair of the same, in `server/`. CI runs both as separate
jobs, so a red build says which half broke.

## How it is put together

```
src/
  app/              screens (expo-router)
    (tabs)/         Timeline · Household · [camera] · Expyr AI · Settings
    add.tsx         scan-first capture and edit
    document/[id]   detail, renewal guide, reminders
    archive.tsx     items you are finished with
    onboarding.tsx  first run
    paywall.tsx     what Pro lifts
    privacy.tsx     what happens to your data
  components/       shared UI — the ledger row, form pieces, document actions
  data/             categories, renewal guides, countries, authorities, icons,
                    and the document repository
  domain/           the rules, pure and tested: migrations, rolling forward,
                    late fees, expiry dates
  hooks/            theme, urgency, reading a document
  lib/              dates, files, scanning, notifications, reminder planning,
                    backup, biometrics, the HTTP client
  store/            React context over the repository
server/             the reading service — see server/README.md
```

Four rules hold this shape together, and they are worth knowing before changing
it:

1. **`domain/` is pure.** No React, no expo, no clock of its own — every
   function takes `now` as an argument. That is what makes it testable without
   a device, and every bug that has reached a phone came out of a function that
   belongs there.
2. **Storage is behind `DocumentRepository`.** Screens never touch
   AsyncStorage. The interface is shaped the way a syncing store needs — per-
   record writes, tombstones for deletes, an outbox — so adding sync one day is
   a new implementation rather than a rewrite. See
   `src/data/document-repository.ts`.
3. **Reminders are planned, not scheduled.** iOS holds only the 64 soonest
   pending notifications and drops the rest silently, so `lib/reminder-plan.ts`
   chooses which to book across the whole collection and `lib/notifications.ts`
   makes iOS match.
4. **One HTTP client.** Everything the app asks of the service goes through
   `lib/http.ts`, so a lesson about handling a failure is learned once.

## The design

The interface is "the Ledger": no cards, hierarchy carried by type size, and a
runway hairline showing how far through its life each document is. Colour means
urgency and nothing else — anything comfortably in the future stays in quiet
ink. Instrument Serif for headlines and figures, DM Sans for everything else.
Dark mode is a warm, candle-lit brown-black rather than an inversion.

Everything a user creates lives on their phone. There is no account system and
no server database; the service exists only to keep the API key off the device.

## Costs

Scanning runs on `claude-haiku-4-5` at roughly **0.4 fils per scan**. Switch to
`claude-opus-5` in `server/.env` for more accuracy at about six times the cost.

## What is not done yet

- Real in-app purchases — `src/lib/purchases.ts` is a stub until there is an
  Apple Developer account and a RevenueCat project
- The app icon, and a final decision on the name
- Home screen widgets — these need a native widget extension and a development
  build, so they cannot run in Expo Go
- Arabic and right-to-left layout, which matters for this market and is a
  project of its own rather than a bolt-on
- Sync across devices — not built, but no longer designed against. Everything
  is on-device and the iPhone backup covers device loss. When it is built it
  should be a `SyncDocumentRepository` beside the local one, a server holding
  ciphertext it cannot read, and a key that never leaves the Keychain. The
  interface, the tombstones and the outbox are already there for it

`STORE.md` holds the App Store listing draft and the pre-submission checklist.
