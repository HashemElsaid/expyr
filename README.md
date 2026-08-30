# Renewly

Nothing expires unnoticed.

Renewly tracks anything with a deadline — residence visas, Emirates ID, car
registration, insurance, tenancy contracts, coursework deadlines, even the milk
in the fridge. You photograph the thing; Claude reads the date; Renewly reminds
you in time and tells you how to renew it.

Built for the UAE first: every category carries the real renewal steps, typical
cost, and the penalty for being late.

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

> Pinned to **Expo SDK 54** on purpose: Expo Go on the App Store is frozen at 54,
> and SDK 55+ needs a paid Apple Developer account to run on a physical phone.

## How it is put together

```
src/
  app/              screens (expo-router)
    (tabs)/         Items, Timeline, Settings
    add.tsx         scan-first capture and edit
    document/[id]   detail, renewal guide, reminders
    onboarding.tsx  first run
    paywall.tsx     subscription
    privacy.tsx     what happens to your data
  components/       shared UI
  data/             document categories, renewal guides, icons, personas
  hooks/            theme and urgency
  lib/              dates, images, scanning, notifications, backup, biometrics
  store/            documents and settings (AsyncStorage)
server/             the scanning service — see server/README.md
```

Everything a user creates lives on their phone. There is no account system and
no server database; the service exists only to keep the API key off the device.

## Costs

Scanning runs on `claude-haiku-4-5` at roughly **0.4 fils per scan**. Switch to
`claude-opus-5` in `server/.env` for more accuracy at about six times the cost.

## What is not done yet

- Real in-app purchases — `src/lib/purchases.ts` is a stub until there is an
  Apple Developer account and a RevenueCat project
- Home screen widgets — these need a native widget extension and a development
  build, so they cannot run in Expo Go
- The app icon
- The scanning service is not deployed, so scanning only works on your own Wi-Fi

`STORE.md` holds the App Store listing draft and the pre-submission checklist.
