// fbspider bridge — MV3 service worker.
// Holds the current Facebook session tokens and performs authenticated fetches
// to Facebook on behalf of the fbspider-clone web app. Runs as the signed-in
// user (cookies are attached because the extension has host permissions).

import {
  parseFbResponse, fillPlaceholders, extractSessionFromHtml,
  computeJazoest, GraphAPI, normalizeAdAccount,
  normalizePixel, normalizeAdPost, normalizeAdAccountInsights,
} from './lib/fb.js';

const SESSION_KEY = 'fbSession';

async function getSession() {
  const o = await chrome.storage.local.get(SESSION_KEY);
  return o[SESSION_KEY] || {};
}
async function setSession(patch) {
  const cur = await getSession();
  const next = { ...cur, ...patch, updatedAt: Date.now() };
  await chrome.storage.local.set({ [SESSION_KEY]: next });
  return next;
}

// read the c_user cookie -> actor id (__user)
async function readUserCookie() {
  try {
    const c = await chrome.cookies.get({ url: 'https://www.facebook.com', name: 'c_user' });
    return c ? c.value : '';
  } catch { return ''; }
}

// Pull tokens by fetching Facebook pages with the user's cookies and scraping.
async function refreshSession() {
  const status = { sources: [] };
  const user = await readUserCookie();
  if (user) status.user = user;

  const pages = [
    'https://www.facebook.com/',
    'https://business.facebook.com/business_locations',
    'https://www.facebook.com/adsmanager/manage/accounts',
  ];
  const merged = { user };
  for (const url of pages) {
    try {
      const res = await fetch(url, { credentials: 'include', headers: { 'accept': 'text/html' } });
      const html = await res.text();
      const found = extractSessionFromHtml(html);
      status.sources.push({ url, ok: res.ok, got: Object.keys(found).filter((k) => found[k]) });
      for (const k of Object.keys(found)) if (found[k] && !merged[k]) merged[k] = found[k];
    } catch (e) {
      status.sources.push({ url, ok: false, error: String(e).slice(0, 120) });
    }
  }
  if (merged.fb_dtsg && !merged.jazoest) merged.jazoest = computeJazoest(merged.fb_dtsg);
  const saved = await setSession(merged);
  status.session = summarize(saved);
  return status;
}

function summarize(s) {
  const mask = (v) => (v ? String(v).slice(0, 6) + '…' + String(v).length : null);
  return {
    user: s.user || null,
    fb_dtsg: mask(s.fb_dtsg),
    lsd: mask(s.lsd),
    accessToken: mask(s.accessToken),
    eaab: mask(s.eaab),
    updatedAt: s.updatedAt || null,
  };
}

// Core: execute a scripted Facebook request from the web app.
// req = { url, options?:{method,headers,body}, body? }
async function executeScript(req) {
  const session = await getSession();
  if (!session.user) {
    return { success: false, error: 'NO_SESSION', info: '未检测到 Facebook 登录，请先在浏览器登录 Facebook 并点击插件刷新会话' };
  }
  const url = fillPlaceholders(req.url || '', session);
  const opt = req.options || {};
  const method = (opt.method || 'GET').toUpperCase();
  const headers = { ...(opt.headers || {}) };
  let body = opt.body != null ? opt.body : req.body;

  if (body && typeof body === 'string') body = fillPlaceholders(body, session);

  // POSTs to facebook.com graphql/ajax want form-encoding + dtsg by default
  if (method === 'POST' && body && !headers['content-type'] && !headers['Content-Type']) {
    headers['content-type'] = 'application/x-www-form-urlencoded';
  }

  try {
    const res = await fetch(url, {
      method,
      credentials: 'include',
      headers,
      body: method === 'GET' || method === 'HEAD' ? undefined : body,
    });
    const text = await res.text();
    const parsed = parseFbResponse(text);
    return { success: res.ok, status: res.status, data: parsed.data, raw: parsed.ok ? undefined : String(parsed.data).slice(0, 500) };
  } catch (e) {
    return { success: false, error: 'FETCH_ERROR', info: String(e).slice(0, 200) };
  }
}

async function executeCookie(req) {
  try {
    const domain = req.domain || 'facebook.com';
    const cookies = await chrome.cookies.getAll({ domain });
    if (req.name) { const c = cookies.find((x) => x.name === req.name); return { success: true, data: c ? c.value : null }; }
    return { success: true, data: Object.fromEntries(cookies.map((c) => [c.name, c.value])) };
  } catch (e) {
    return { success: false, error: String(e).slice(0, 160) };
  }
}

// High-level convenience ops the web app can call by name (stable Graph API).
async function highLevel(op, params = {}) {
  switch (op) {
    case 'getAdAccounts': {
      const r = await executeScript({ url: GraphAPI.adAccounts() });
      if (r.success && r.data && Array.isArray(r.data.data)) r.rows = r.data.data.map(normalizeAdAccount);
      return r;
    }
    case 'getBusinesses': return executeScript({ url: GraphAPI.businesses() });
    case 'getPages': return executeScript({ url: GraphAPI.pages() });
    case 'getPixels': return executeScript({ url: GraphAPI.pixels(params.businessId) });
    case 'getInsights': return executeScript({ url: GraphAPI.insights(params.actId, params.preset) });

    // Ad accounts with spend rolled in — a single request, so the data page can
    // show real numbers without N per-account insights calls.
    case 'getAdAccountsWithInsights': {
      const r = await executeScript({ url: GraphAPI.adAccountsWithInsights(params.preset || 'maximum') });
      if (r.success && r.data && Array.isArray(r.data.data)) r.rows = r.data.data.map(normalizeAdAccountInsights);
      return r;
    }

    // Every pixel the user can see: walk their businesses, then (optionally)
    // their ad accounts to catch pixels that aren't under any business.
    case 'getAllPixels': {
      const seen = new Map();
      const errors = [];
      const biz = await executeScript({ url: GraphAPI.businesses() });
      const bizList = (biz.success && biz.data && biz.data.data) || [];
      for (const b of bizList) {
        const r = await executeScript({ url: GraphAPI.pixels(b.id) });
        if (r.success && r.data && Array.isArray(r.data.data)) {
          for (const p of r.data.data) if (!seen.has(p.id)) seen.set(p.id, normalizePixel(p, b));
        } else if (r.data && r.data.error) errors.push(b.name + ': ' + r.data.error.message);
      }
      // also sweep ad accounts (capped — these are one request each)
      const cap = params.accountCap == null ? 25 : params.accountCap;
      let scanned = 0, total = 0;
      if (params.includeAccounts !== false) {
        const acc = await executeScript({ url: GraphAPI.adAccounts() });
        const accList = (acc.success && acc.data && acc.data.data) || [];
        total = accList.length;
        for (const a of accList.slice(0, cap)) {
          scanned++;
          const r = await executeScript({ url: GraphAPI.adAccountPixels(a.account_id) });
          if (r.success && r.data && Array.isArray(r.data.data)) {
            for (const p of r.data.data) if (!seen.has(p.id)) seen.set(p.id, normalizePixel(p, { id: a.account_id, name: a.name }));
          }
        }
      }
      return {
        success: true,
        rows: [...seen.values()],
        data: { data: [...seen.values()] },
        meta: { businesses: bizList.length, accountsScanned: scanned, accountsTotal: total, errors },
      };
    }

    // Real ad posts (the object story behind each ad) across the user's accounts.
    case 'getAdPosts': {
      const cap = params.accountCap == null ? 10 : params.accountCap;
      const acc = await executeScript({ url: GraphAPI.adAccounts() });
      if (!acc.success) return acc;
      const accList = (acc.data && acc.data.data) || [];
      // prefer active accounts; they're the ones with live posts
      const ordered = [...accList].sort((x, y) => (x.account_status === 1 ? -1 : 1) - (y.account_status === 1 ? -1 : 1));
      const picked = ordered.slice(0, cap);
      const rows = [];
      const errors = [];
      // resolve real page names once so posts show a name, not a bare page id
      const pageNames = {};
      const pg = await executeScript({ url: GraphAPI.pages() });
      if (pg.success && pg.data && Array.isArray(pg.data.data)) {
        for (const p of pg.data.data) pageNames[p.id] = p.name;
      }
      for (const a of picked) {
        const r = await executeScript({ url: GraphAPI.adPosts(a.account_id) });
        if (r.success && r.data && Array.isArray(r.data.data)) {
          for (const ad of r.data.data) rows.push(normalizeAdPost(ad, a, pageNames));
        } else if (r.data && r.data.error) errors.push(a.name + ': ' + r.data.error.message);
      }
      // de-dupe by the underlying post, keeping the first ad that referenced it
      const seen = new Map();
      for (const row of rows) { const k = row.post_id || row.id; if (!seen.has(k)) seen.set(k, row); }
      return {
        success: true,
        rows: [...seen.values()],
        data: { data: [...seen.values()] },
        meta: { accountsScanned: picked.length, accountsTotal: accList.length, ads: rows.length, errors },
      };
    }
    case 'renameAdAccount': return executeScript({ url: GraphAPI.renameAdAccount(params.actId, params.name), options: { method: 'POST' } });
    default: return { success: false, error: 'UNKNOWN_OP', info: op };
  }
}

// Router for both content-script relays and externally_connectable senders.
async function handle(msg) {
  switch (msg && msg.type) {
    case 'PING': { const s = await getSession(); return { success: true, installed: true, version: '3.0.0', hasSession: !!s.user, user: s.user || null }; }
    case 'CAPTURE_TOKENS': {
      const t = msg.tokens || {};
      const clean = {};
      for (const k of Object.keys(t)) if (t[k]) clean[k] = t[k];
      if (Object.keys(clean).length) await setSession(clean);
      return { success: true };
    }
    case 'REFRESH_SESSION': return refreshSession();
    case 'GET_SESSION': return { success: true, data: summarize(await getSession()) };
    case 'EXECUTE_SCRIPT': return executeScript(msg.data || {});
    case 'EXECUTE_COOKIE': return executeCookie(msg.data || {});
    case 'FB_OP': return highLevel(msg.op, msg.params);
    default: return { success: false, error: 'UNKNOWN_TYPE', info: msg && msg.type };
  }
}

// messages relayed by our content scripts (same-extension)
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  handle(msg).then((r) => sendResponse({ ...r, uniqueRequestId: msg && msg.uniqueRequestId }))
    .catch((e) => sendResponse({ success: false, error: String(e), uniqueRequestId: msg && msg.uniqueRequestId }));
  return true; // async
});

// messages from web pages via externally_connectable
chrome.runtime.onMessageExternal.addListener((msg, _sender, sendResponse) => {
  handle(msg).then((r) => sendResponse({ ...r, uniqueRequestId: msg && msg.uniqueRequestId }))
    .catch((e) => sendResponse({ success: false, error: String(e), uniqueRequestId: msg && msg.uniqueRequestId }));
  return true;
});

// opportunistically capture tokens whenever an FB tab reports them
chrome.runtime.onInstalled.addListener(() => { refreshSession().catch(() => {}); });
