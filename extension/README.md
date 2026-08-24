# fbspider bridge — browser extension (real Facebook session)

This MV3 Chrome extension is the piece that makes the dashboard **live**: it runs
in your own browser, reads your logged-in Facebook session, and performs actions
on **your own** ad accounts / pages / pixels / BMs. It's the same architecture the
real fbspider uses (page ↔ content script ↔ background service worker ↔ Facebook).

Your session tokens (`fb_dtsg`, `access_token`, `c_user`, …) stay **only** in the
extension's local storage on your machine. Nothing is sent to the clone's backend.

## Install (Developer Mode — works on normal Google Chrome)

> Google Chrome blocks the `--load-extension` command-line flag, so load it from the UI:

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top-right)
3. Click **Load unpacked**
4. Select this `extension/` folder
5. Pin the "fbspider bridge" icon

## Use

1. Log in to Facebook in the **same** Chrome profile (facebook.com / business.facebook.com).
2. Click the extension icon → **刷新 Facebook 会话**. You should see your Facebook UID,
   `fb_dtsg`, and an access token light up green.
3. Open the dashboard (http://localhost:8080). Top-right, flip the switch from **演示** to **实时**.
4. Module pages now load **your real data**. In live mode the ad-account **重命名** button
   actually renames the selected accounts via the Graph API.

## What's wired to real Facebook right now

| Operation | Endpoint | Status |
|-----------|----------|--------|
| List ad accounts | `GET graph.facebook.com/v19.0/me/adaccounts` | ✅ live |
| List pages | `GET /me/accounts` | ✅ live |
| List businesses (BM) | `GET /me/businesses` | ✅ live |
| List pixels | `GET /{business}/adspixels` | ✅ live (needs a BM id) |
| Ad-account insights (spend) | `GET adsmanager-graph…/act_{id}/insights` | ✅ live |
| Rename ad account | `POST /act_{id}?name=` | ✅ live (write example) |
| Any other call | `EXECUTE_SCRIPT { url, options }` | ✅ generic passthrough |

The generic `EXECUTE_SCRIPT` passthrough + the captured `@fb_dtsg@`/`doc_id` set (see
`_recon/`) let you implement the remaining private-GraphQL write ops (block comment,
change page name, friend requests, partner sharing, …) the same way fbspider does —
each is a `www.facebook.com/api/graphql/` POST with a `doc_id` and `fb_dtsg`.

## How the bridge works

```
web app (localhost)                extension                         Facebook
  fbBridge.js  ── postMessage ──▶  content-bridge.js
                                     └─ chrome.runtime ─▶ background.js
                                                            ├─ fill @token@/@fb_dtsg@…
                                                            └─ fetch(credentials:'include') ─▶ graph/api
  fbBridge.js  ◀─ postMessage ──  content-bridge.js  ◀── response ──┘
```

- `content-fb.js` runs on facebook.com and scrapes `fb_dtsg` / `lsd` / `c_user` /
  `EAA…` access token from the live page, caching them in the background worker.
- `background.js` substitutes the `@placeholder@` tokens and does the authenticated
  `fetch`, stripping Facebook's `for(;;);` response guard.

## Caveats (inherent to this kind of tool)

- Facebook's **private** endpoints and `doc_id`s change over time; live write ops may
  need their `doc_id` refreshed periodically. The **official Graph API** reads
  (ad accounts / pages / businesses) are stable.
- Access-token scraping is best-effort across FB's shifting markup. If the token
  doesn't populate, open Ads Manager once and hit **刷新会话** again.
- Use it only for accounts you own / are authorised to manage. This respects your own
  session; it does not bypass any Facebook permission.

## Tests

- `node test.mjs` — pure logic (placeholder fill, `for(;;);` stripping, jazoest, token
  scraping, Graph URL builders, normalization). 15 assertions.
- `node ../_recon/sim_bridge.mjs` — mounts the real `background.js` + `content-bridge.js`
  in a mocked window/chrome and drives PING / REFRESH / EXECUTE_COOKIE / getAdAccounts /
  EXECUTE_SCRIPT round-trips. 5 assertions.
