# App Store review readiness

Audited 6 September 2026 against Apple's
[App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/).

**What this document is not.** It is not a guarantee. App Review is partly
discretionary, and roughly 200 clauses exist that no static audit can fully
settle — a reviewer's read of your screenshots, your description, or how the
guidance feature "feels" is not something code can pre-empt. What this removes
is the *mechanical* rejection causes: the ones that fire automatically on
upload, or that a reviewer catches in the first two minutes. Those are the ones
that cause the fix-resubmit-wait loop, and they are all listed below.

---

## 1. Blockers — would be rejected today

### 1.1 In-app purchase does not work — Guideline 2.1, 3.1.1

`src/lib/purchases.ts` returns `ok: false` from both `purchase()` and
`restore()`. The paywall is reachable, priced, and cannot complete a sale.

> 2.1: "Submissions to App Review should be final versions ... Make sure your
> app has been tested on-device for bugs and stability before you submit it."

A paywall that cannot take money is the single most reliable rejection in this
list. Fix before submitting, not after.

**Needed:** StoreKit 2 or RevenueCat, plus the non-consumable configured in App
Store Connect, marked **Family Shareable**, at the price points already in
`PRICE_POINTS`.

### 1.2 ~~No hosted privacy policy URL~~ — RESOLVED 6 September

Live at **https://hashemelsaid.github.io/expyr/privacy.html**, served by GitHub
Pages from the repository's own `docs/` folder. The repository was renamed to
`expyr` and made public to allow it: Pages does not serve private repositories
on a free plan, and serving the page from Render instead would have been worse
— the free plan spins down, so a reviewer opening the privacy URL could meet a
thirty-second cold start or a timeout, which is a rejection rather than a wait.

Checked before going public: `.env` has never been tracked, and no secret-shaped
string appears anywhere in the history or the working tree.

The original finding follows.

### 1.2a The finding, as written — Guideline 5.1.1(i)

> "All apps must include a link to their privacy policy in the App Store
> Connect metadata field **and** within the app in an easily accessible manner."

The in-app half is done and is genuinely good (`src/app/privacy.tsx` — it names
Anthropic explicitly, which is what 5.1.2(i) demands). The hosted half does not
exist. App Store Connect will not accept a submission without a working URL.

**Needed:** a public page. A GitHub Pages file or a single Render route is
enough; it must be reachable without login and must match the in-app text.

### 1.3 ~~No support URL~~ — RESOLVED 6 September

Live at **https://hashemelsaid.github.io/expyr/support.html**, alongside terms
at `/terms.html`. The privacy page carries a contact address.

### 1.4 STORE.md contradicts the app — Guideline 2.3.1

`STORE.md` still advertises **"AED 79/year or AED 12/month"**. The app sells a
**one-off AED 149** non-consumable. If that copy is pasted into App Store
Connect it is a metadata mismatch, and pricing mismatches are read strictly.

Rewrite before you copy anything out of it.

---

## 2. Fixed in this pass

### 2.1 Privacy manifest — was missing, now declared

Required for all submissions since May 2024, and Expo does **not** generate one
for you. Missing it produces an automated rejection email on upload, before a
human ever looks at the build.

Added to `app.json` under `ios.privacyManifests`, covering the four required-
reason APIs this dependency set touches:

| API category | Reason | Why |
|---|---|---|
| `UserDefaults` | `CA92.1` | AsyncStorage — app's own data only |
| `FileTimestamp` | `C617.1` | expo-file-system — attachments in the app container |
| `DiskSpace` | `E174.1` | expo-file-system — space checks before writing photos |
| `SystemBootTime` | `35F9.1` | expo-modules-core — elapsed-time calculations |

### 2.2 Export compliance — was unanswered, now declared

`ITSAppUsesNonExemptEncryption: false` added to `ios.infoPlist`. The app uses
only HTTPS and the OS keychain, both exempt. Without this every single build
stops and waits for you to answer the question by hand in App Store Connect.

---

## 3. Only you can do these — App Store Connect

Nothing here is code. All of it is required.

- **App Privacy labels.** Must declare that document photos and contract text
  leave the device and go to a third party. Declaring "no data collected"
  because it feels on-device would be false, and a mismatch between the label
  and observed network traffic is a hard rejection. The honest shape is: data
  is sent, is **not linked to identity**, and is **not used for tracking**.
- **Age rating questionnaire.** Apple's 2025 questionnaire asks about
  AI-generated content and chatbots. The "Ask" feature answers free-text
  questions about a document with an LLM. Answer yes and let it rate what it
  rates; a wrong answer here is caught later and costs more.
- **Notes for Review.** 2.3.1 rejects generic notes. Say explicitly: documents
  are photographed, sent once to your own service, forwarded to Anthropic's
  Claude API, not stored server-side, and the renewal guidance is AI-generated
  and labelled as unverified in the UI. Reviewers reject what surprises them.
- **Screenshots.** 2.3.3 — the app in use, not a splash screen.
- **Demo content.** Reviewers will not have a UAE visa to photograph. Ship them
  a sample image, or the scan flow appears broken and gets rejected under 2.1.

---

## 4. Judgment calls — real risk, not certain

### 4.1 Brand icons — Guideline 5.2.2

`server/brand-icon.ts` fetches subscription logos from Google's
`s2/favicons` endpoint and DuckDuckGo's `ip3`.

> 5.2.2: "If your app uses, accesses, monetizes access to, or displays content
> from a third-party service, ensure that you are specifically permitted to do
> so under the service's terms of use."

Google's favicon endpoint is undocumented and not a published API, so "specifically
permitted" is hard to argue. The privacy reasoning for proxying it is sound and
worth keeping — the exposure is the *source*, not the design.

Low likelihood of being caught, non-trivial cost if it is. Cheapest de-risk:
bundle a small set of your own icons for the common services and fall back to a
lettermark, which also removes a network dependency and a cold-start delay.

### 4.2 Not looking official — Guideline 4.1, 5.2.5

The app deep-links to ICP, RTA, MOHRE and TAMM and says it "knows what a
Mulkiya is." That is fine. What is not fine is anything implying government
endorsement: no authority logos, no crests, no name or icon that reads as
official. Worth a deliberate check of the final icon and screenshots.

### 4.3 AI guidance accuracy — Guideline 2.3

Already handled well: guidance is labelled as needing verification and links to
official sources. Keep that label prominent. If it ever reads as authoritative
instruction on a government process, that becomes a 2.3 problem.

---

## 5. Already compliant — no action

- **Permission strings** (`app.json`) — specific, purpose-first, and better
  than most shipping apps. This is a common rejection cause and it is closed.
- **No accounts.** 5.1.1(v) requires in-app account deletion only if you offer
  account creation. You don't, so it does not apply.
- **Local notifications, not push.** Most of 4.5.4 is inapplicable; nothing
  sensitive traverses a server to reach the user.
- **Face ID via LocalAuthentication** — exactly what 2.5.13 requires.
- **Third-party AI disclosed in-app** — 5.1.2(i) satisfied by name.
- **Restore Purchases present** — 3.1.1 satisfied structurally; it needs to
  actually work once StoreKit is wired.
- **Minimum functionality (4.2)** — not close to a concern.

---

## Order of work

1. ~~Test on a physical iPhone~~ — done 6 September. Notifications verified:
   scheduled by the global planner, survived overnight, fired at the reminder
   hour with the correct countdown.
2. ~~Host the privacy policy and support page~~ — done, §1.2 and §1.3.
3. ~~Rewrite `STORE.md`~~ — done, §1.4.
4. **Decide the Ask tab.** Contract reading is parked (see `PRICING.md` for why
   its economics are the problem, not just its reliability). A parked feature
   that still has a tab is a *visible feature that fails*, which is what 2.1
   rejects — and is the same shape as a previous rejection. Parking it means
   hiding it, not merely not fixing it.
5. Wire StoreKit / RevenueCat — §1.1. Blocked on the Developer account.
6. Decide the brand-icon question — §4.1.
7. Fill in App Store Connect — §3.
