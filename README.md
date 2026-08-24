# fbspider-clone

A faithful, runnable clone of **fbspider.com** — the Facebook ads-team toolkit (Vue 3 + Arco
Design SPA with a Node backend). Reverse-engineered from the live site and rebuilt with the same
tech stack, menu, routes, table columns, pricing model, and API contract.

It runs in two ways:

- **Standalone (no backend)** — a fully static build for **GitHub Pages**. Data is generated
  client-side and persisted in `localStorage`; login accepts any email/password. This is what
  gets deployed by the included GitHub Actions workflow.
- **Full-stack** — the Vue SPA served by the Node/Express backend for a closer mirror of the
  original API contract.

In both modes, **live Facebook data comes from the browser extension**, never from a server.

## What's included (all 11 modules + shell)

| Route | Module | Notes |
|-------|--------|-------|
| `/dashboard` | 仪表盘 | account panel, FB-binding detect, all-functions grid, more-business |
| `/adaccount` | 广告账号管理 | full action bar (授权/推送/限额/重命名/公司信息/导出csv) + 28-col table |
| `/adsManager` | 广告及数据 | 我的数据 / 汇报数据, date ranges, spend totals, CSV export |
| `/bm` | BM管理 | invite / push / remove, hidden-admins |
| `/page` | 主页管理 | authorize / push / blacklist / block-words / disable / rename |
| `/pixel` | 像素分享 | BM-to-BM share, assign, batch create |
| `/target` | 兴趣定位 | interest search (人口统计/兴趣/行为), save keyword files |
| `/adcomment` | 广告贴差评管理 | add post, global/single comment-control config |
| `/friend` | 添加好友 | received / sent requests, approve / withdraw |
| `/library` | 广告资料库视频下载 | ad-library video grid + download |
| `/dataManager` | 资产接收 | ACC / BM / Page receiving tabs |
| `/pagecreate` | 创建主页 | batch page creation with intervals + records |
| `/payment` | 会员购买 | 4-step wizard, real pricing, promo codes, stripe/crypto (mocked) |
| `/user` | 用户中心 | 功能管理 / 订单管理 / 用户设置 (password, email) |
| `/support` | 我的工单 | ticket list / create / chat thread |

## Architecture

- **web/** — Vue 3 + Vite + Arco Design + Pinia + vue-router + vue-i18n + axios.
  Mirrors the original's axios interceptors (`{status,data,info}` envelope, Bearer + `uid` headers,
  `status:-1` → login redirect) and its server-driven-menu fallback to static routes.
- **server/** — Node + Express + built-in `node:sqlite` (no native build). JWT Bearer auth
  (`sub`=uid), the real pricing seeded from the live `getServiceList`, and all module list/action
  endpoints. Serves the built SPA from `web/dist`.

## Live mode — real Facebook via the browser extension

The dashboard has two data sources, switchable from the top-right **实时 / 演示** toggle:

- **演示 (mock)** — realistic demo data from the Node backend (`/api/mock/*`, `server/mock.js`).
  Great for clicking around without touching Facebook.
- **实时 (live)** — drives your **own** logged-in Facebook session through the `extension/`
  browser extension, exactly like the real fbspider (page ↔ content script ↔ background
  service worker ↔ Facebook). See [extension/README.md](extension/README.md) to install it
  (Developer Mode → Load unpacked) and which operations are wired live (ad accounts / pages /
  businesses / pixels reads via the stable Graph API, ad-account rename as a write example,
  plus a generic `EXECUTE_SCRIPT` passthrough for the rest).

Session tokens live only in the extension on your machine — never sent to this backend.
Use it for accounts you own or are authorised to manage; it uses your own session and bypasses
no Facebook permission. Facebook's private `doc_id` endpoints drift over time, so live write ops
may need periodic `doc_id` refreshes (the captured set is in `_recon/`); the Graph API reads are stable.

## Deploy to GitHub Pages (standalone, no backend)

The repo ships a GitHub Actions workflow ([.github/workflows/deploy.yml](.github/workflows/deploy.yml))
that builds the static app and publishes it to Pages on every push to `main`. No server required.

1. Create a repo on GitHub and push this project (see below).
2. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Push to `main`. The workflow builds `web/` with `VITE_STANDALONE=1` and a base path derived
   automatically from the repo name, then deploys.
4. Your site is at `https://<user>.github.io/<repo>/`.

```bash
# from the project root
git init
git add -A
git commit -m "fbspider-clone"
git branch -M main
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```

> The free Pages tier requires a **public** repo. If you name the repo `<user>.github.io`
> (a user page served from `/`), set `VITE_BASE=/` in the workflow env.

## Run locally

Standalone (matches the deployed site, no backend):

```bash
cd web
npm install
VITE_STANDALONE=1 npm run build
npx serve dist          # or: python -m http.server -d dist 4200
```

Full-stack (Vue SPA + Node API):

```bash
# 1. backend (installs, seeds services + a demo user, serves API + built SPA on :8080)
cd server
npm install
node seed.js
node create_user.js you@example.com yourpassword   # or defaults: demo@example.com / demo1234
node index.js                                       # http://localhost:8080

# 2. frontend build (rebuild if you change it)
cd ../web
npm install
npm run build

# live frontend dev with hot reload (proxies /api -> :8080):
npm run dev                                         # http://localhost:5173
```

## Recon artifacts

`_recon/` (git-ignored, kept only on the dev machine) holds what was pulled from the live site:
`routes.json`, `api_endpoints.json`, `i18n_zh.json`, `module_strings.json`, `services_full.json`,
and the headless-Chrome screenshotter/login harness used to verify rendering. It is excluded from
the repo because it also contains a captured session; nothing there is needed to build or run the app.
