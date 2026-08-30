# Renewly scanning service

A small HTTP service that reads expiry dates out of photos. It exists for one
reason: the Anthropic API key must never ship inside the phone app, where anyone
could extract it and spend your credits.

## Endpoints

| Method | Path       | Purpose                                              |
| ------ | ---------- | ---------------------------------------------------- |
| `GET`  | `/health`  | Liveness check; reports whether the API key is set.  |
| `POST` | `/extract` | Takes a base64 image, returns the extracted details. |

## Environment

| Variable                | Required | Purpose                                                                 |
| ----------------------- | -------- | ----------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`     | yes      | A **workspace-scoped** key from the Claude Console.                     |
| `RENEWLY_APP_TOKEN`     | in prod  | Shared secret the app must send as `x-renewly-token`.                   |
| `RENEWLY_MODEL`         | no       | Defaults to `claude-haiku-4-5`. Use `claude-opus-5` for more accuracy.  |
| `ANTHROPIC_WORKSPACE_ID`| no       | Only needed for identity-linked (user) API keys.                        |
| `PORT`                  | no       | Defaults to `8787`.                                                     |

## Running locally

```bash
npm install
npm run dev
```

The phone app finds this automatically at Metro's host on port 8787, so no
configuration is needed while developing on the same Wi-Fi.

## Deploying

The service is a plain Node HTTP server with no build step, so anywhere that
runs Node 22.6+ will do. A `Dockerfile` is included for platforms that prefer
containers.

1. Push this repository to GitHub.
2. Create a Web Service on [Render](https://render.com), [Railway](https://railway.app)
   or [Fly.io](https://fly.io), pointing at the `server/` directory.
3. Set the start command to `npm start`.
4. Add `ANTHROPIC_API_KEY` and `RENEWLY_APP_TOKEN` as environment variables.
5. Copy the service URL and set it in the app's `.env`:

   ```
   EXPO_PUBLIC_EXTRACT_URL=https://your-service.onrender.com/extract
   EXPO_PUBLIC_SCAN_TOKEN=the-same-token
   ```

Set a monthly spend limit in the Claude Console as well. The rate limiter caps
each client at 20 scans per 10 minutes, but a billing cap is the only hard stop.

## A note on the app token

`EXPO_PUBLIC_*` values are compiled into the app bundle, so the token can be
extracted by someone determined. It stops casual abuse; the rate limit and your
billing cap are what actually protect the account. Proper per-user
authentication is the fix, and it belongs with real accounts.
