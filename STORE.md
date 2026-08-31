# App Store listing

Draft copy for App Store Connect. Everything here is editable — treat it as a
starting point, not a finished submission.

---

## Name (30 characters max)

```
Expyr: Expiry Reminders
```

## Subtitle (30 characters max)

```
Visa, licence & renewal alerts
```

## Pricing

One tier, not two. AED 79/year or AED 12/month unlocks unlimited items for the
whole household. Tracking family members is a reason to upgrade rather than a
separate product — there is no per-household infrastructure behind it today, so
charging separately would not be honest. Revisit if real cross-device sharing
is ever built.

## Promotional text (170 characters, changeable without review)

```
Photograph your Emirates ID, visa, Mulkiya or tenancy contract. Expyr reads the date, reminds you in time, and tells you exactly how to renew it.
```

## Description

```
Expyr makes sure nothing in your life expires without warning.

Photograph a document and Expyr reads the expiry date for you. No typing, no
forms. It works on residence visas, Emirates ID, passports, car registration,
insurance policies, tenancy contracts, driving licences, trade licences and
work permits — from a photo, a PDF, or a screenshot of an email.

WHAT IT DOES

• Reads the date from a photo, a PDF, or a screenshot
• Reminds you weeks or months ahead, not the day before
• Lets you snooze or mark something done from the reminder itself
• Tells you how to renew: where to go, what it costs, and the fine for being late
• Opens the right government portal for you
• Keeps the whole family in one place, so you can see what everyone needs
• Holds both sides of an ID, and shares a copy when someone asks for one
• Shows your year as a timeline, so you can see what is coming
• Rolls the date forward when you renew, and remembers that you did

BUILT FOR LIFE IN THE UAE

Expyr knows what a Mulkiya is. It knows an Emirates ID renewal costs around
AED 100 per year of validity, that late renewal is fined daily, that Ejari
matters for your DEWA account, and that your landlord must give you 90 days'
notice before raising the rent. Every category carries the steps, the typical
cost, and the penalty for leaving it late.

Expyr tracks dates and sends reminders wherever you live. The renewal steps,
costs and fines have been checked for the UAE only, so outside it Expyr keeps
the dates and stays quiet about the paperwork rather than guessing.

PRIVATE BY DESIGN

Your documents stay on your phone. Photos are kept in Expyr's own storage —
never your camera roll, never iCloud Photo Library. There is no account, no
sign-up and no server database. Reminders are scheduled by iOS itself, so nobody
else needs to know your dates. Everything travels with your iPhone backup, so a
new phone brings it all back. You can lock Expyr behind Face ID, and export a
copy only you hold.

FREE TO START

Track ten items free, for as long as you like — enough for your visa, your
Emirates ID, your car and your tenancy. Unlock Expyr to track everything you
own, and everyone in your household.
```

## Keywords (100 characters, comma separated, no spaces)

```
visa,emirates id,expiry,renewal,reminder,mulkiya,ejari,passport,document,deadline,insurance,licence
```

## Categories

- Primary: **Productivity**
- Secondary: **Utilities**

## Age rating

4+ — no objectionable content.

---

## Screenshots to capture (6.7" and 6.5" required)

1. **Home screen** with five or six realistic items, one overdue and one due soon
2. **The scan moment** — camera pointed at a document
3. **The filled form** right after a scan, showing the "✨" note
4. **A detail screen** showing the renewal steps and costs
5. **Timeline** with several months populated
6. **Settings** showing Face ID and the privacy line

Caption each screenshot with a short benefit line rather than a feature name —
"Photograph it once" beats "Camera scanning".

---

## Review notes for Apple

```
Expyr reads expiry dates from photos the user chooses. Images are sent once to
our own service, which forwards them to the Anthropic Claude API for text
extraction, and are not stored. No account is required. All user data is kept
locally on the device.

To test scanning, photograph any document containing an expiry date —
for example a passport, a driving licence, or an insurance certificate.
```

## Required before submission

- [ ] Apple Developer Program membership (USD 99/year)
- [ ] App icon (1024×1024, no transparency, no rounded corners)
- [ ] Privacy policy hosted at a public URL — the text is in `src/app/privacy.tsx`
- [ ] Subscription products created in App Store Connect, matching `src/lib/purchases.ts`
- [ ] RevenueCat project connected, replacing the stubs in `src/lib/purchases.ts`
- [ ] Scanning service deployed and `EXPO_PUBLIC_EXTRACT_URL` pointed at it
- [ ] App Privacy questionnaire completed (data is not collected or linked to the user)
