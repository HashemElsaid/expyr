# Expyr reading service

A small HTTP service that reads documents on the phone's behalf. It exists for
one reason: the Anthropic API key must never ship inside the app, where anyone
could extract it and spend your credits.

It stores nothing. There is no database and no user data — the only state is
two in-memory maps of rate-limit counters, cleared on every restart. Documents,
transcripts, questions and answers pass through and are gone.

## Endpoints

| Method | Path             | Credential | Metered | Purpose                                                    |
| ------ | ---------------- | ---------- | ------- | ---------------------------------------------------------- |
| `GET`  | `/health`        | —          | —       | Liveness, and what the service is configured for.          |
| `GET`  | `/icon`          | —          | yes     | A brand's favicon, fetched on the phone's behalf.          |
| `POST` | `/register`      | app token  | yes     | Trades the app token for this install's own credential.    |
| `POST` | `/extract`       | app token  | yes     | One expiry date out of a photo or PDF.                     |
| `POST` | `/read`          | app token  | yes     | A full transcript of a document.                           |
| `POST` | `/brief`         | app token  | yes     | The points and obligations in a transcript.                |
| `POST` | `/ask`           | app token  | yes     | A question, answered from transcripts and Expyr's record.  |
| `POST` | `/subscriptions` | app token  | yes     | Subscriptions read off a screenshot or a receipt.          |

`/icon` needs no credential because on the web the app uses it as an `<img>`
src, and an image tag cannot carry a header. It is rate limited instead, so it
cannot be used as somebody else's free bandwidth.

## How a request is handled

`index.ts` is only the wiring — body, credential, ceilings, dispatch, answer.
What each route does is in `routes.ts`; what it will accept is in `schemas.ts`.

Four ceilings sit between a leaked app token and the bill:

1. **The app token** ships in the bundle, so treat it as public. It buys one
   thing: the right to ask for an install credential.
2. **The install credential** is HMAC-signed rather than stored, so the service
   can recognise a phone without keeping a database. Everything is counted
   against it. See `install-token.ts`.
3. **Per-route buckets and a per-install daily budget** (`rate-limit.ts`) stop a
   burst and a slow drip respectively.
4. **A daily ceiling for the whole service** is the line that cannot be walked
   around, because addresses are free. `EXPYR_DAILY_BUDGET`, default 2000.

Set a monthly spend limit in the Claude Console as well. A billing cap is the
only hard stop.

## Errors

Every failure answers with a status that means what it says and a body of
`{ error, code, request }`. `error` is written for the person holding the
phone; `code` is one of `invalid_request`, `unauthorised`, `rate_limited`,
`too_large`, `not_found`, `unavailable`, `internal`; `request` matches the
`x-request-id` header and the service's own log line for that request.

Validation reasons are deliberately not relayed. They name fields of a request
the user never wrote, and they can quote the values in them.

## What is logged

One JSON line per request: the route, the status, how long it took, the install
id, and counts. **Nothing that came out of a request body is ever logged** — not
the image, not the transcript, not the question, not a subscription's name, and
not an upstream error message, which can quote any of them. See the note at the
top of `log.ts`.

## Environment

| Variable                 | Required | Purpose                                                              |
| ------------------------ | -------- | -------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`      | yes      | A **workspace-scoped** key from the Claude Console.                  |
| `EXPYR_APP_TOKEN`        | in prod  | Shared secret the app sends as `x-expyr-token`.                      |
| `EXPYR_INSTALL_SECRET`   | in prod  | Signs install credentials. Any long random string; rotating it makes every phone register again, silently. |
| `EXPYR_DAILY_BUDGET`     | no       | Requests that may reach the model in one day. Default 2000.          |
| `EXPYR_MODEL`            | no       | Extraction model. Default `claude-haiku-4-5`.                        |
| `EXPYR_READ_MODEL`       | no       | Transcription model. Default `claude-haiku-4-5`.                     |
| `EXPYR_BRIEF_MODEL`      | no       | Briefing model. Default `claude-sonnet-5`.                           |
| `EXPYR_ASK_MODEL`        | no       | Answering model. Default `claude-haiku-4-5`.                         |
| `ANTHROPIC_WORKSPACE_ID` | no       | Only needed for identity-linked (user) API keys.                     |
| `PORT`                   | no       | Defaults to `8787`.                                                  |

## Running locally

```bash
npm install
```

```bash
npm run dev
```

The phone app finds this automatically at Metro's host on port 8787, so no
configuration is needed while developing on the same Wi-Fi.

## Tests

```bash
npm test
```

`node --test` on the sources directly — no framework, no build step. Alongside
the unit tests there is `server.test.ts`, which starts the service on a socket
and exercises it. That one exists because Node runs these TypeScript files
without compiling them, and its type stripping refuses a few things `tsc` is
perfectly happy with: a constructor parameter property once typechecked
cleanly, passed every unit test, and crashed the service on boot.

```bash
npm run typecheck
```

## Deploying

A plain Node HTTP server with no build step, so anywhere running Node 22.6+
will do. `render.yaml` configures it for Render; a `Dockerfile` is included for
platforms that prefer containers.

Then set the service URL in the app's `.env`:

```
EXPO_PUBLIC_EXTRACT_URL=https://your-service.onrender.com/extract
EXPO_PUBLIC_SCAN_TOKEN=the-same-token-as-EXPYR_APP_TOKEN
```

> The service currently runs on Render's free plan, which sleeps between
> visitors — the first request of the day waits around 22 seconds. Fine for
> testing, not for real users.

## A note on the app token

`EXPO_PUBLIC_*` values are compiled into the app bundle, so the token can be
extracted by anyone who cares to. It stops casual abuse; the install
credential, the rate limits and your billing cap are what actually protect the
account. Proper per-user authentication is the fix, and it belongs with real
accounts — which this service deliberately does not have.
