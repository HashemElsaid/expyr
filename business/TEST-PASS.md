# The 1.0.1 test pass

One phone, Expo Go, the four-column log open beside it: what you did, what
you expected, what happened, which screen. Written 11 September 2026. Part A
can be run now, because it is the server. Part B waits for the coding
session to say the screens are done.

Everything that fails goes in the log. Nothing gets reported one at a time.

---

## Part A. The scan, live now

**Passed, all six, Hashem, 11 September evening**, on the real images.

These hit the server that every App Store user hits, so a pass here is a pass
for them too.

1. **The passport that came back as a residence visa.** Scan it again.
   Expected: category Passport, or a question "This looks like a passport,
   is that right?" if the model was unsure. Title "Egyptian passport" or
   similar, never a person's name.
2. **Your mom's passport.** Scan it. Open the saved document and read the
   name in the fields. Expected: spelled as printed. If not, tap it and
   correct it; the tap must work.
3. **A subscriptions screenshot on the wrong path.** Add, Choose a photo,
   pick the iOS subscriptions list. Expected: a message pointing you to the
   Subscriptions importer, not a wrong document.
4. **The same screenshot on the right path.** Subscriptions, import.
   Expected: every subscription listed with price and date, the yearly
   total shown, then two saved and Pro offered for the rest.
5. **Two documents in one photo.** Put two cards on a table and photograph
   both. Expected: a review list with both, each with the right category
   and date, tick to keep, tap to fix, then both saved.
6. **A date that could be read either way**, such as 03/09/2027. Expected:
   3 September, not 9 March.

## Part B. The screens, once they are done

Reload first. Walk each screen in this order and ask the same three
questions on every one: does anything look generated, can I tell what is
tappable, can I get back without losing anything.

7. **Timeline.** Four cards with counts. Tap Overdue, list filters, tap
   again, clears. Rows in a card, coloured tiles, red tile on anything
   expired. Nothing in uppercase, no sentence headline.
8. **Settings.** No pill buttons. Rows that go somewhere have a chevron;
   rows that do something are green. Credit balance is the value on the
   Expyr AI row. Appearance is a segmented control. Switch to Dark:
   near-black, not brown.
9. **Top Up.** One group of packs under "Choose a pack", circles on the
   unselected, a green check on the selected, the button naming the pack.
   Balance and costs in the footnote below, nowhere else.
10. **Paywall.** Opens with your own numbers. Three rows: Documents 3 /
    unlimited, Subscriptions 2 / unlimited, Expyr AI off / 500 credits. One
    line of fine print. The plan row does not look selectable.
11. **Add, the way out.** Start a scan, land on the form, press Back.
    Expected: the way-in step, with the scan still there. Type something,
    press X. Expected: "Discard changes?" Close by swiping down, reopen.
    Expected: offered to continue.
12. **Add, the pickers.** Category, Remind me, Whose is it. Each returns to
    the form with only that choice changed.
13. **The document screen.** Every scanned field tappable to edit. Bottom
    of the page: no "Read this document" button, an "Ask Expyr AI about
    this" row instead, or "Not read yet" if reading was declined.
14. **Automatic reading.** Attach a short PDF. Expected: read on attach,
    credits deducted, no button pressed. Attach one over 10 pages.
    Expected: one question first, with the page count and cost.
15. **The free tier.** Reset the free allowances in Developer. Add three
    documents: fine. Add a fourth: paywall. Import three subscriptions: two
    saved, paywall for the third. Open Expyr AI: one screen and a button
    to the paywall, no chat.
16. **Household.** Add a person, rename them, check every document naming
    them follows. Delete one: confirmed or undoable, never instant.
17. **Expyr AI, with Pro on in Developer.** Ask a question about a read
    document. Expected: an answer, credits down by 20.
18. **Keyboard.** On any form, Next moves between fields, Done closes, and
    the field you are typing in is never under the keyboard.
19. **Dynamic Type.** iPhone Settings, Accessibility, Display and Text
    Size, drag text size to the largest. Every screen still readable,
    nothing cut off. Put it back after.
20. **VoiceOver, two minutes.** Settings, Accessibility, VoiceOver on.
    Swipe through the Timeline. Every row reads its title and date. Off
    again with a triple-click of the side button if you set that up, or in
    Settings.

## Part C. Not in Expo Go

**Run 12 September on TestFlight 1.0.1 (4). Item 21 passed; item 22
failed**: after a delete and reinstall with no Apple sign-in, Pro returned
(correct) and the balance read 500 again rather than 0, so the Pro grant was
issued twice for one transaction. Cause: the grant was recorded
against the install token, so a reinstall was a new account with a real
receipt the service had no memory of, and the reply reported the product's
face value rather than the outcome. Fixed in b5c2a88: a paid purchase is
its own record keyed on the original transaction id, outliving every install
and the account itself. Server only; retest on the same build: buy, reinstall,
expect Pro on and 0 credits. A reinstall without Protect my credits loses the
balance permanently, so the app must point at protection at the moment of
purchase; see LAUNCH.md item 22.

**Retest 12 September after b5c2a88**: step 1 passes (Pro on, 0 credits after
reinstall), step 2 passes (pack lands). **Step 3 fails**: with Protect my
credits on and 1,500 in the balance, delete, reinstall, sign in again: Pro on,
0 credits, and the balance never returns. Blocking. Cause, found 12
September: the server was right all along; build 4's sign-in wrote the account
and threw away the balance the service handed back, and once signed in the
row that could have retried was hidden. Fixed in 9cf5a35 and 1730b67: the
phone now asks the service for the balance at every launch and adopts its
answer. App-side, so **build 5**, together with item 22 and the truncation.

**Retest on build 5:** install over the top without deleting; open; Pro on and
the balance should arrive on its own at 1,500 (force quit and reopen once if
0 on the very first launch). Then delete, reinstall, open: same. Settings
should show no sign-in row, since the account is attached; if it shows
"Restore my credits", tapping it should also bring 1,500 back.

**Build 5 result, 12 September afternoon: Part C passes.** The balance
arrived on its own at 1,980, which decomposes only one way: the 1,500 pack
plus the first Pro grant net of the one question asked (500 minus 20). A
duplicate grant would have shown 2,000, both pre-fix grants 2,480. Two server
tests replay the week and reach 1,980 with the Pro replay refused. Found on
the way and fixed in bd85b2e: linking an account was rewriting its record and
erasing the fields that stop money being paid twice, masked until now.
Settings still offered Protect my credits because the install credential
lives in the Keychain and survives deletion while the phone's own note of
the account does not; the service now reports the account at launch and the
phone adopts it (ab04b74, build 6). Also in build 6: the toggle reads "Read
automatically" with a one-clause footnote.

Purchases, restore and Sign in with Apple cannot run in Expo Go. They wait
for the development build or the 1.0.1 build:

21. Buy Pro with the sandbox account. Expected: limits lift, 500 credits
    arrive, once.
22. Delete the app, reinstall, Restore Purchases. Expected: Pro returns,
    credits not granted twice.
23. Buy a credit pack. Expected: balance up by the pack, ledger shows it.
