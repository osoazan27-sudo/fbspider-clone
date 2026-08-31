// fbspider bridge — MV3 service worker.
// Holds the current Facebook session tokens and performs authenticated fetches
// to Facebook on behalf of the fbspider-clone web app. Runs as the signed-in
// user (cookies are attached because the extension has host permissions).

import {
  parseFbResponse, fillPlaceholders, extractSessionFromHtml,
  computeJazoest, GraphAPI, normalizeAdAccount,
  normalizePixel, normalizeAdPost, normalizeAdAccountInsights,
  normalizeInterest, describeFbError, isWriteOk,
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

// Most page-level writes need a PAGE token, not the user token. Fetch it once
// per page and cache for the life of the worker.
const pageTokenCache = new Map();
async function pageTokenFor(pageId) {
  if (pageTokenCache.has(pageId)) return { ok: true, token: pageTokenCache.get(pageId) };
  const r = await executeScript({ url: GraphAPI.pageToken(pageId) });
  const token = r && r.success && r.data && r.data.access_token;
  if (!token) {
    return { ok: false, info: '拿不到该主页的 access_token（通常是你不是该主页管理员，或会话缺少 pages 权限）：' + describeFbError(r) };
  }
  pageTokenCache.set(pageId, token);
  return { ok: true, token };
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

    // ---- real writes ----
    // Leave a Business Manager: find your own business_user node, then delete it.
    case 'removeSelfFromBusiness': {
      const businessId = params.businessId;
      if (!businessId) return { success: false, info: '缺少 BM ID' };
      const session = await getSession();
      const me = String(session.user || '');
      if (!me) return { success: false, info: '未获取到当前 Facebook 用户，请先刷新会话' };
      const list = await executeScript({ url: GraphAPI.businessUsers(businessId) });
      if (!list.success || !list.data || !Array.isArray(list.data.data)) {
        return { success: false, info: '读取 BM 成员失败：' + describeFbError(list) };
      }
      const mine = list.data.data.find((u) => String(u.user && u.user.id) === me);
      if (!mine) return { success: false, info: '你不是该 BM 的成员，或无权限查看成员列表' };
      const del = await executeScript({ url: GraphAPI.deleteBusinessUser(mine.id), options: { method: 'DELETE' } });
      return isWriteOk(del)
        ? { success: true, data: del.data, info: '已移出 BM' }
        : { success: false, info: describeFbError(del) };
    }

    // Share / unshare a pixel with another business (BM -> BM).
    case 'sharePixelToBusiness': {
      const { pixelId, businessId } = params;
      if (!pixelId || !businessId) return { success: false, info: '缺少像素 ID 或目标 BM ID' };
      const r = await executeScript({ url: GraphAPI.pixelShareToBusiness(pixelId, businessId), options: { method: 'POST' } });
      return isWriteOk(r) ? { success: true, data: r.data, info: '已分享' } : { success: false, info: describeFbError(r) };
    }
    case 'unsharePixelFromBusiness': {
      const { pixelId, businessId } = params;
      if (!pixelId || !businessId) return { success: false, info: '缺少像素 ID 或目标 BM ID' };
      const r = await executeScript({ url: GraphAPI.pixelUnshareFromBusiness(pixelId, businessId), options: { method: 'DELETE' } });
      return isWriteOk(r) ? { success: true, data: r.data, info: '已取消分享' } : { success: false, info: describeFbError(r) };
    }

    // Assign / unassign a pixel to one of your ad accounts.
    case 'sharePixelToAdAccount': {
      const { pixelId, accountId } = params;
      if (!pixelId || !accountId) return { success: false, info: '缺少像素 ID 或广告账号 ID' };
      const r = await executeScript({ url: GraphAPI.pixelShareToAdAccount(pixelId, accountId), options: { method: 'POST' } });
      return isWriteOk(r) ? { success: true, data: r.data, info: '已分配' } : { success: false, info: describeFbError(r) };
    }
    case 'unsharePixelFromAdAccount': {
      const { pixelId, accountId } = params;
      if (!pixelId || !accountId) return { success: false, info: '缺少像素 ID 或广告账号 ID' };
      const r = await executeScript({ url: GraphAPI.pixelUnshareFromAdAccount(pixelId, accountId), options: { method: 'DELETE' } });
      return isWriteOk(r) ? { success: true, data: r.data, info: '已取消分配' } : { success: false, info: describeFbError(r) };
    }

    // ---- ad account: people + spend cap + BM ----
    case 'addAdAccountUser': {
      const { actId, uid, tasks } = params;
      if (!actId || !uid) return { success: false, info: '缺少广告账号或用户 UID' };
      const r = await executeScript({ url: GraphAPI.addAdAccountUser(actId, uid, tasks), options: { method: 'POST' } });
      return isWriteOk(r) ? { success: true, data: r.data, info: '已授权' } : { success: false, info: describeFbError(r) };
    }
    case 'removeAdAccountUser': {
      const { actId, uid } = params;
      if (!actId || !uid) return { success: false, info: '缺少广告账号或用户 UID' };
      const r = await executeScript({ url: GraphAPI.removeAdAccountUser(actId, uid), options: { method: 'DELETE' } });
      return isWriteOk(r) ? { success: true, data: r.data, info: '已移除授权' } : { success: false, info: describeFbError(r) };
    }
    case 'setAdAccountSpendCap': {
      const { actId, amount } = params;
      if (!actId) return { success: false, info: '缺少广告账号' };
      // the API takes minor units; callers pass whole currency units
      const cents = Math.round(Number(amount || 0) * 100);
      if (!Number.isFinite(cents) || cents < 0) return { success: false, info: '限额必须是不小于 0 的数字' };
      const r = await executeScript({ url: GraphAPI.setAdAccountSpendCap(actId, cents), options: { method: 'POST' } });
      return isWriteOk(r)
        ? { success: true, data: r.data, info: cents === 0 ? '已重置限额' : '限额已设为 ' + amount }
        : { success: false, info: describeFbError(r) };
    }
    case 'addAdAccountToBusiness': {
      const { businessId, actId } = params;
      if (!businessId || !actId) return { success: false, info: '缺少 BM ID 或广告账号' };
      const r = await executeScript({ url: GraphAPI.addAdAccountToBusiness(businessId, actId), options: { method: 'POST' } });
      return isWriteOk(r) ? { success: true, data: r.data, info: '已添加到 BM' } : { success: false, info: describeFbError(r) };
    }

    // ---- business: invite a person ----
    case 'inviteBusinessUser': {
      const { businessId, email, role } = params;
      if (!businessId || !email) return { success: false, info: '缺少 BM ID 或邮箱' };
      const r = await executeScript({ url: GraphAPI.inviteBusinessUser(businessId, email, role), options: { method: 'POST' } });
      return isWriteOk(r) ? { success: true, data: r.data, info: '邀请已发送' } : { success: false, info: describeFbError(r) };
    }

    // ---- pixel: create + people ----
    case 'createPixel': {
      const { businessId, name } = params;
      if (!businessId || !name) return { success: false, info: '缺少 BM ID 或像素名称' };
      const r = await executeScript({ url: GraphAPI.createPixel(businessId, name), options: { method: 'POST' } });
      return isWriteOk(r) ? { success: true, data: r.data, info: '已创建：' + (r.data.id || name) } : { success: false, info: describeFbError(r) };
    }
    case 'addPixelUser': {
      const { pixelId, uid, tasks } = params;
      if (!pixelId || !uid) return { success: false, info: '缺少像素 ID 或用户 UID' };
      const r = await executeScript({ url: GraphAPI.addPixelUser(pixelId, uid, tasks), options: { method: 'POST' } });
      return isWriteOk(r) ? { success: true, data: r.data, info: '已分配' } : { success: false, info: describeFbError(r) };
    }
    case 'removePixelUser': {
      const { pixelId, uid } = params;
      if (!pixelId || !uid) return { success: false, info: '缺少像素 ID 或用户 UID' };
      const r = await executeScript({ url: GraphAPI.removePixelUser(pixelId, uid), options: { method: 'DELETE' } });
      return isWriteOk(r) ? { success: true, data: r.data, info: '已移除' } : { success: false, info: describeFbError(r) };
    }

    // ---- pages (these need a page-scoped token) ----
    case 'renamePage': {
      const { pageId, name } = params;
      if (!pageId || !name) return { success: false, info: '缺少主页 ID 或新名称' };
      const tk = await pageTokenFor(pageId);
      if (!tk.ok) return { success: false, info: tk.info };
      const r = await executeScript({ url: GraphAPI.renamePage(pageId, name, tk.token), options: { method: 'POST' } });
      return isWriteOk(r) ? { success: true, data: r.data, info: '已改名' } : { success: false, info: describeFbError(r) };
    }
    case 'setPagePublished': {
      const { pageId, published } = params;
      if (!pageId) return { success: false, info: '缺少主页 ID' };
      const tk = await pageTokenFor(pageId);
      if (!tk.ok) return { success: false, info: tk.info };
      const r = await executeScript({ url: GraphAPI.setPagePublished(pageId, published, tk.token), options: { method: 'POST' } });
      return isWriteOk(r)
        ? { success: true, data: r.data, info: published ? '已重新启用' : '已停用' }
        : { success: false, info: describeFbError(r) };
    }
    case 'setPageBannedWords': {
      const { pageId, words } = params;
      if (!pageId || !words) return { success: false, info: '缺少主页 ID 或屏蔽词' };
      const tk = await pageTokenFor(pageId);
      if (!tk.ok) return { success: false, info: tk.info };
      const r = await executeScript({ url: GraphAPI.setPageBannedWords(pageId, words, tk.token), options: { method: 'POST' } });
      return isWriteOk(r) ? { success: true, data: r.data, info: '屏蔽词已更新' } : { success: false, info: describeFbError(r) };
    }
    case 'blockPageUser': {
      const { pageId, user } = params;
      if (!pageId || !user) return { success: false, info: '缺少主页 ID 或用户' };
      const tk = await pageTokenFor(pageId);
      if (!tk.ok) return { success: false, info: tk.info };
      const r = await executeScript({ url: GraphAPI.blockPageUser(pageId, user, tk.token), options: { method: 'POST' } });
      return isWriteOk(r) ? { success: true, data: r.data, info: '已加入黑名单' } : { success: false, info: describeFbError(r) };
    }

    // ---- interest targeting search ----
    case 'searchInterests': {
      const { q, limit } = params;
      if (!q) return { success: false, info: '缺少关键词' };
      const r = await executeScript({ url: GraphAPI.searchInterests(q, limit) });
      if (!r.success || !r.data || !Array.isArray(r.data.data)) return { success: false, info: describeFbError(r) };
      return { success: true, rows: r.data.data.map(normalizeInterest), data: r.data };
    }

    // ---- post comments ----
    case 'getPostComments': {
      const { postId } = params;
      if (!postId) return { success: false, info: '缺少帖子 ID' };
      const r = await executeScript({ url: GraphAPI.postComments(postId, params.limit) });
      if (!r.success || !r.data || !Array.isArray(r.data.data)) return { success: false, info: describeFbError(r) };
      return { success: true, rows: r.data.data, data: r.data };
    }
    case 'hideComment': {
      const { commentId, hidden, pageId } = params;
      if (!commentId) return { success: false, info: '缺少评论 ID' };
      const tk = pageId ? await pageTokenFor(pageId) : { ok: true, token: null };
      if (!tk.ok) return { success: false, info: tk.info };
      const r = await executeScript({ url: GraphAPI.hideComment(commentId, hidden !== false, tk.token), options: { method: 'POST' } });
      return isWriteOk(r) ? { success: true, data: r.data, info: hidden !== false ? '已隐藏' : '已取消隐藏' } : { success: false, info: describeFbError(r) };
    }
    case 'deleteComment': {
      const { commentId, pageId } = params;
      if (!commentId) return { success: false, info: '缺少评论 ID' };
      const tk = pageId ? await pageTokenFor(pageId) : { ok: true, token: null };
      if (!tk.ok) return { success: false, info: tk.info };
      const r = await executeScript({ url: GraphAPI.deleteComment(commentId, tk.token), options: { method: 'DELETE' } });
      return isWriteOk(r) ? { success: true, data: r.data, info: '已删除' } : { success: false, info: describeFbError(r) };
    }

    // Who is this pixel currently shared with?
    case 'getPixelShares': {
      const { pixelId } = params;
      if (!pixelId) return { success: false, info: '缺少像素 ID' };
      const [ag, acc] = await Promise.all([
        executeScript({ url: GraphAPI.pixelSharedAgencies(pixelId) }),
        executeScript({ url: GraphAPI.pixelSharedAccounts(pixelId) }),
      ]);
      return {
        success: true,
        businesses: (ag.success && ag.data && ag.data.data) || [],
        accounts: (acc.success && acc.data && acc.data.data) || [],
        info: ag.success ? '' : describeFbError(ag),
      };
    }
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
