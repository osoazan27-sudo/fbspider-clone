// Pure helpers shared by the service worker. No DOM, no chrome.* here so these
// can be unit-tested in plain Node.

// Facebook prefixes JSON responses with an anti-hijack guard. Strip it.
export function stripFbPrefix(text) {
  if (typeof text !== 'string') return text;
  return text.replace(/^\s*(?:for\s*\(;;\);|while\(1\);|\)\]\}',?)\s*/, '');
}

export function parseFbResponse(text) {
  const cleaned = stripFbPrefix(text);
  try { return { ok: true, data: JSON.parse(cleaned) }; }
  catch { return { ok: false, data: cleaned }; }
}

// jazoest is derived from fb_dtsg: the literal "2" followed by the sum of the
// char codes of every character in fb_dtsg.
export function computeJazoest(fbDtsg) {
  if (!fbDtsg) return '';
  let sum = 0;
  for (let i = 0; i < fbDtsg.length; i++) sum += fbDtsg.charCodeAt(i);
  return '2' + sum;
}

// Replace the @placeholder@ tokens the web app embeds in URLs/bodies with the
// current session values. Unknown placeholders are removed so a stale template
// can't leak a literal "@foo@" into a request.
export function fillPlaceholders(str, session) {
  if (typeof str !== 'string' || !str.includes('@')) return str;
  const map = {
    '@token@': session.accessToken || session.eaab || '',
    '@EAAB@': session.eaab || session.accessToken || '',
    '@access_token@': session.accessToken || session.eaab || '',
    '@fb_dtsg@': session.fb_dtsg || '',
    '@jazoest@': session.jazoest || computeJazoest(session.fb_dtsg) || '',
    '@lsd@': session.lsd || '',
    '@__user@': session.user || '',
    '@__a@': '1',
    '@__comet_req@': '15',
    '@__hsi@': session.hsi || '',
    '@__dyn@': session.dyn || '',
    '@__csr@': session.csr || '',
    '@__spin_r@': session.spin_r || '',
    '@__spin_b@': session.spin_b || 'trunk',
    '@__spin_t@': session.spin_t || '',
    '@av@': session.user || '',
  };
  return str.replace(/@[A-Za-z_]+@/g, (m) => (m in map ? map[m] : ''));
}

// Pull the Graph access token out of a page body.
//
// Facebook's EAA tokens are base64url-ish: letters, digits, underscore and
// hyphen. A charset of [A-Za-z0-9] silently truncates at the first _ or -,
// producing a token that looks plausible but fails with code 190. Tokens are
// also frequently JSON-escaped in inline scripts, so unescape first.
export function extractAccessToken(html) {
  if (typeof html !== 'string') return '';
  const text = html
    .replace(/\\u0025/g, '%')
    .replace(/\\\//g, '/')
    .replace(/\\"/g, '"');
  const found = new Set();
  // prefer an explicitly labelled token, then any bare EAA… run
  for (const re of [
    /"(?:access_token|accessToken)"\s*:\s*"(EAA[0-9A-Za-z_-]+)"/g,
    /access_token=(EAA[0-9A-Za-z_-]+)/g,
    /\b(EAA[0-9A-Za-z_-]{20,})\b/g,
  ]) {
    for (const m of text.matchAll(re)) if (m[1]) found.add(m[1]);
  }
  if (!found.size) return '';
  // longest wins: shorter hits are usually prefixes of the real token
  return [...found].sort((a, b) => b.length - a.length)[0];
}

// Extract session tokens from a Facebook HTML/JS page body. Best-effort with
// multiple fallbacks because Facebook's markup shifts over time.
export function extractSessionFromHtml(html) {
  const out = {};
  const first = (patterns) => {
    for (const re of patterns) { const m = html.match(re); if (m && m[1]) return m[1]; }
    return '';
  };
  out.fb_dtsg = first([
    /\["DTSGInitialData",\[\],\{"token":"([^"]+)"/,
    /\["DTSGInitData",\[\],\{"token":"([^"]+)"/,
    /name="fb_dtsg" value="([^"]+)"/,
    /"dtsg":\{"token":"([^"]+)"/,
  ]);
  out.lsd = first([
    /\["LSD",\[\],\{"token":"([^"]+)"/,
    /name="lsd" value="([^"]+)"/,
    /"lsd":\{"token":"([^"]+)"/,
  ]);
  out.user = first([
    /"USER_ID":"(\d+)"/,
    /"actorID":"(\d+)"/,
    /\["CurrentUserInitialData",\[\],\{[^}]*"USER_ID":"(\d+)"/,
  ]);
  // Graph access token (EAA…). The charset MUST include _ and - : real tokens
  // contain both, and stopping at the first one yields a truncated token that
  // Facebook rejects with "Malformed access token (code 190)".
  out.accessToken = extractAccessToken(html) || '';
  out.spin_r = first([/"__spin_r":(\d+)/, /"spin_r":(\d+)/]);
  out.spin_t = first([/"__spin_t":(\d+)/, /"spin_t":(\d+)/]);
  out.spin_b = first([/"__spin_b":"([^"]+)"/]);
  out.hsi = first([/"hsi":"([^"]+)"/, /"__hsi":"([^"]+)"/]);
  out.dyn = first([/"__dyn":"([^"]+)"/]);
  if (out.fb_dtsg) out.jazoest = computeJazoest(out.fb_dtsg);
  return out;
}

// The stable Graph API request builders (reads). These mirror the fields
// fbspider requests so the web app gets the same columns.
const GV = 'v19.0';
export const GraphAPI = {
  // Field lists kept to ones the Graph API reliably returns. adtrust_dsl / age /
  // min_daily_budget / owner were dropped: Facebook now rejects the WHOLE
  // request with code 100 "nonexisting field" if any one is invalid.
  adAccounts: () =>
    `https://graph.facebook.com/${GV}/me/adaccounts?fields=` +
    encodeURIComponent(
      'name,account_id,account_status,disable_reason,currency,timezone_name,' +
      'amount_spent,balance,spend_cap,funding_source_details,' +
      'business{id,name},created_time'
    ) + '&limit=500&access_token=@token@',
  businesses: () =>
    `https://graph.facebook.com/${GV}/me/businesses?fields=` +
    encodeURIComponent('id,name,verification_status,created_time,primary_page') +
    '&limit=200&access_token=@token@',
  pages: () =>
    `https://graph.facebook.com/${GV}/me/accounts?fields=` +
    encodeURIComponent('id,name,category,fan_count,link,is_published,verification_status,tasks,access_token') +
    '&limit=200&access_token=@token@',
  pixels: (businessId) =>
    `https://graph.facebook.com/${GV}/${businessId}/adspixels?fields=` +
    encodeURIComponent('id,name,last_fired_time,is_created_by_business,owner_business{id,name}') +
    '&limit=200&access_token=@EAAB@',
  // pixels owned/used by a single ad account (catches ones not under a business)
  adAccountPixels: (actId) =>
    `https://graph.facebook.com/${GV}/act_${actId}/adspixels?fields=` +
    encodeURIComponent('id,name,last_fired_time,is_created_by_business,owner_business{id,name}') +
    '&limit=200&access_token=@EAAB@',
  insights: (actId, preset = 'last_30d') =>
    `https://adsmanager-graph.facebook.com/${GV}/act_${actId}/insights?fields=` +
    encodeURIComponent('spend,impressions,clicks,cpc,ctr,account_currency') +
    `&date_preset=${preset}&access_token=@token@`,
  // ad accounts WITH their spend rolled in — one request instead of N per-account
  // insights calls. Nested edge syntax: insights.date_preset(x){fields}
  adAccountsWithInsights: (preset = 'maximum') =>
    `https://graph.facebook.com/${GV}/me/adaccounts?fields=` +
    encodeURIComponent(
      'name,account_id,account_status,currency,timezone_name,amount_spent,balance,' +
      'funding_source_details,business{id,name},' +
      `insights.date_preset(${preset}){spend,impressions,clicks,cpc,ctr,account_currency}`
    ) + '&limit=500&access_token=@token@',
  // real ad posts (the object story behind each ad) for the comment module
  adPosts: (actId) =>
    `https://graph.facebook.com/${GV}/act_${actId}/ads?fields=` +
    encodeURIComponent(
      'id,name,status,effective_status,created_time,' +
      'creative{id,effective_object_story_id,object_story_id,title,body,thumbnail_url}'
    ) + '&limit=100&access_token=@token@',
  adAccountUsers: (actId) =>
    `https://graph.facebook.com/${GV}/act_${actId}/assigned_users?fields=` +
    encodeURIComponent('id,name,tasks') + '&access_token=@EAAB@',
  // write example (reversible): rename an ad account you own
  renameAdAccount: (actId, name) =>
    `https://graph.facebook.com/${GV}/act_${actId}?name=${encodeURIComponent(name)}&access_token=@token@`,

  // ---- writes ----
  // people in a business (used to find your own business_user id)
  businessUsers: (businessId) =>
    `https://graph.facebook.com/${GV}/${businessId}/business_users?fields=` +
    encodeURIComponent('id,name,role,user{id}') + '&limit=500&access_token=@token@',
  // removes that person from the business (DELETE on the business_user node)
  deleteBusinessUser: (businessUserId) =>
    `https://graph.facebook.com/${GV}/${businessUserId}?access_token=@token@`,

  // share a pixel with another business (BM -> BM), and the reverse
  pixelShareToBusiness: (pixelId, businessId) =>
    `https://graph.facebook.com/${GV}/${pixelId}/agencies?business=${encodeURIComponent(businessId)}&access_token=@token@`,
  pixelUnshareFromBusiness: (pixelId, businessId) =>
    `https://graph.facebook.com/${GV}/${pixelId}/agencies?business=${encodeURIComponent(businessId)}&access_token=@token@`,
  // assign a pixel to one of your ad accounts
  pixelShareToAdAccount: (pixelId, accountId) =>
    `https://graph.facebook.com/${GV}/${pixelId}/shared_accounts?account_id=${encodeURIComponent(String(accountId).replace(/^act_/, ''))}&access_token=@token@`,
  pixelUnshareFromAdAccount: (pixelId, accountId) =>
    `https://graph.facebook.com/${GV}/${pixelId}/shared_accounts?account_id=${encodeURIComponent(String(accountId).replace(/^act_/, ''))}&access_token=@token@`,
  // --- ad account people + limits ---
  // grant someone access to an ad account. tasks: ANALYST | ADVERTISER | MANAGE
  addAdAccountUser: (actId, uid, tasks) =>
    `https://graph.facebook.com/${GV}/act_${String(actId).replace(/^act_/, '')}/assigned_users` +
    `?user=${encodeURIComponent(uid)}&tasks=${encodeURIComponent(JSON.stringify([].concat(tasks || 'ANALYST')))}` +
    '&access_token=@token@',
  removeAdAccountUser: (actId, uid) =>
    `https://graph.facebook.com/${GV}/act_${String(actId).replace(/^act_/, '')}/assigned_users` +
    `?user=${encodeURIComponent(uid)}&access_token=@token@`,
  // spend cap is in minor units (cents); 0 clears it
  setAdAccountSpendCap: (actId, cents) =>
    `https://graph.facebook.com/${GV}/act_${String(actId).replace(/^act_/, '')}` +
    `?spend_cap=${encodeURIComponent(cents)}&access_token=@token@`,
  // hand an ad account to a business as a client account
  addAdAccountToBusiness: (businessId, actId) =>
    `https://graph.facebook.com/${GV}/${businessId}/client_ad_accounts` +
    `?adaccount_id=act_${String(actId).replace(/^act_/, '')}&access_token=@token@`,

  // --- business people ---
  inviteBusinessUser: (businessId, email, role) =>
    `https://graph.facebook.com/${GV}/${businessId}/business_users` +
    `?email=${encodeURIComponent(email)}&role=${encodeURIComponent(role || 'EMPLOYEE')}&access_token=@token@`,

  // --- pixel people + creation ---
  createPixel: (businessId, name) =>
    `https://graph.facebook.com/${GV}/${businessId}/adspixels?name=${encodeURIComponent(name)}&access_token=@token@`,
  addPixelUser: (pixelId, uid, tasks) =>
    `https://graph.facebook.com/${GV}/${pixelId}/assigned_users` +
    `?user=${encodeURIComponent(uid)}&tasks=${encodeURIComponent(JSON.stringify([].concat(tasks || 'ANALYZE')))}` +
    '&access_token=@token@',
  removePixelUser: (pixelId, uid) =>
    `https://graph.facebook.com/${GV}/${pixelId}/assigned_users?user=${encodeURIComponent(uid)}&access_token=@token@`,

  // --- pages ---
  renamePage: (pageId, name, pageToken) =>
    `https://graph.facebook.com/${GV}/${pageId}?name=${encodeURIComponent(name)}` +
    `&access_token=${encodeURIComponent(pageToken || '@token@')}`,
  setPagePublished: (pageId, published, pageToken) =>
    `https://graph.facebook.com/${GV}/${pageId}?is_published=${published ? 'true' : 'false'}` +
    `&access_token=${encodeURIComponent(pageToken || '@token@')}`,
  // page moderation word list (comma separated) and visitor blocking
  setPageBannedWords: (pageId, words, pageToken) =>
    `https://graph.facebook.com/${GV}/${pageId}/settings` +
    `?setting=MODERATION_LIST&value=${encodeURIComponent(words)}` +
    `&access_token=${encodeURIComponent(pageToken || '@token@')}`,
  blockPageUser: (pageId, userIdOrName, pageToken) =>
    `https://graph.facebook.com/${GV}/${pageId}/blocked?user=${encodeURIComponent(userIdOrName)}` +
    `&access_token=${encodeURIComponent(pageToken || '@token@')}`,
  // one page's token, needed for most page-level writes
  pageToken: (pageId) =>
    `https://graph.facebook.com/${GV}/${pageId}?fields=access_token,name&access_token=@token@`,

  // --- interests (ad targeting search) ---
  searchInterests: (q, limit = 50) =>
    `https://graph.facebook.com/${GV}/search?type=adinterest&q=${encodeURIComponent(q)}` +
    `&limit=${limit}&access_token=@token@`,

  // --- post comments (for the ad-comment module) ---
  postComments: (postId, limit = 100) =>
    `https://graph.facebook.com/${GV}/${postId}/comments?fields=` +
    encodeURIComponent('id,message,created_time,from{id,name},is_hidden,like_count') +
    `&filter=stream&limit=${limit}&access_token=@token@`,
  hideComment: (commentId, hidden, pageToken) =>
    `https://graph.facebook.com/${GV}/${commentId}?is_hidden=${hidden ? 'true' : 'false'}` +
    `&access_token=${encodeURIComponent(pageToken || '@token@')}`,
  deleteComment: (commentId, pageToken) =>
    `https://graph.facebook.com/${GV}/${commentId}?access_token=${encodeURIComponent(pageToken || '@token@')}`,

  // who a pixel is currently shared with
  pixelSharedAgencies: (pixelId) =>
    `https://graph.facebook.com/${GV}/${pixelId}/agencies?fields=` +
    encodeURIComponent('id,name') + '&limit=200&access_token=@token@',
  pixelSharedAccounts: (pixelId) =>
    `https://graph.facebook.com/${GV}/${pixelId}/shared_accounts?fields=` +
    encodeURIComponent('id,name,account_id') + '&limit=200&access_token=@token@',
};

// If a Graph read fails with (#100) "nonexisting field (X)", pull out X so the
// caller can drop it and retry. Facebook rejects the whole request on one bad
// field, and it deprecates fields over time, so this keeps reads working.
export function nonexistentField(resp) {
  const e = (resp && resp.data && resp.data.error) || (resp && resp.error);
  if (!e || Number(e.code) !== 100) return null;
  const m = /nonexisting field \(([^)]+)\)/.exec(e.message || '');
  return m ? m[1] : null;
}

// Remove one field from a URL's fields= param, honouring {…} nesting so a bad
// top-level field is dropped without touching a same-named nested one.
export function stripFieldFromUrl(url, field) {
  const m = /([?&]fields=)([^&]*)/.exec(url);
  if (!m) return url;
  const decoded = decodeURIComponent(m[2]);
  const parts = [];
  let depth = 0, cur = '';
  for (const ch of decoded) {
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur) parts.push(cur);
  // a part looks like "name" or "business{id,name}" or "insights.date_preset(x){…}"
  const kept = parts.filter((p) => p.split(/[.{(]/)[0].trim() !== field);
  if (kept.length === parts.length) return url;                 // not top-level; give up
  const rebuilt = m[1] + encodeURIComponent(kept.join(','));
  return url.slice(0, m.index) + rebuilt + url.slice(m.index + m[0].length);
}

// Pull a human-readable reason out of a Graph API error body so failures say
// what Facebook actually objected to instead of a generic "失败".
export function describeFbError(resp) {
  if (!resp) return '无响应';
  // Prefer the structured Graph error, then an already-described message, and
  // only fall back to an opaque code string like 'GRAPH_ERROR' / 'FETCH_ERROR'.
  const e = (resp.data && resp.data.error)
    || (resp.error && typeof resp.error === 'object' ? resp.error : null);
  if (!e) {
    if (resp.info) return resp.info;
    if (typeof resp.error === 'string') return resp.error;
    return '未知错误';
  }
  const parts = [];
  if (e.error_user_msg) parts.push(e.error_user_msg);
  else if (e.message) parts.push(e.message);
  if (e.code != null) parts.push('code ' + e.code + (e.error_subcode ? '/' + e.error_subcode : ''));
  return parts.join(' · ') || '未知错误';
}

// A Graph write succeeded if FB echoed success:true (or returned an id) and
// there is no error object. Never treat an error body as success.
export function isWriteOk(resp) {
  if (!resp || !resp.success) return false;
  const d = resp.data;
  if (!d || typeof d !== 'object') return false;
  if (d.error) return false;
  return d.success === true || !!d.id || Object.keys(d).length === 0;
}

// Map a Graph adspixel row to the pixel table's column shape. `owner` is the
// business (or ad account) the pixel was discovered under.
export function normalizePixel(p, owner = {}) {
  const fired = p.last_fired_time || '';
  // "active" = fired within the last 7 days
  let isActive = false;
  if (fired) {
    const t = Date.parse(fired);
    if (!Number.isNaN(t)) isActive = (Date.now() - t) < 7 * 864e5;
  }
  const ob = p.owner_business || {};
  return {
    id: p.id || '',
    name: p.name || '(未命名像素)',
    business_id: ob.id || owner.id || '',
    business_name: ob.name || owner.name || '个人',
    owner: ob.name || owner.name || '—',
    role: '管理员',
    type: p.is_created_by_business ? 'BM创建' : '账号创建',
    is_active: isActive,
    active_label: fired ? (isActive ? '活跃' : '不活跃') : '未触发',
    last_active: fired ? fired.slice(0, 10) : '—',
    share_status: ob.id && owner.id && ob.id !== owner.id ? '已分享' : '未分享',
    note: '',
    favourite: 0,
  };
}

// Map a Graph ad row to the ad-comment table's column shape. The post id is the
// creative's effective object story id (pageId_postId). `pageNames` resolves the
// owning page's real name so the table shows it instead of a bare id.
export function normalizeAdPost(ad, account = {}, pageNames = {}) {
  const c = ad.creative || {};
  const storyId = c.effective_object_story_id || c.object_story_id || '';
  const pageId = storyId.includes('_') ? storyId.split('_')[0] : '';
  return {
    id: ad.id || '',
    post_id: storyId || ad.id || '',
    page_id: pageId,
    // the table's 广告贴 column reads `title`; keep the real ad name
    title: ad.name || c.title || '(未命名广告)',
    name: ad.name || c.title || '(未命名广告)',
    ad_title: c.title || '',
    body: (c.body || '').slice(0, 120),
    thumbnail: c.thumbnail_url || '',
    // the table compares status against the monitor labels, not delivery state
    status: '未监控',
    switch: 0,
    auto_block: '关',
    delivery_status: ad.effective_status || ad.status || '—',
    is_active: ad.effective_status === 'ACTIVE' ? 1 : 0,
    manage_account: account.name || account.account_id || '—',
    account_id: account.account_id || '',
    page_name: pageNames[pageId] || (pageId ? '主页 ' + pageId : '—'),
    page_type: '公共主页',
    created_time: (ad.created_time || '').slice(0, 10),
    url: storyId ? `https://www.facebook.com/${storyId.replace('_', '/posts/')}` : '',
    note: '',
    favourite: 0,
  };
}

// Map an ad-interest search hit to the 兴趣定位 table's columns.
export function normalizeInterest(i) {
  const path = Array.isArray(i.path) ? i.path.filter(Boolean) : [];
  const type = i.type || (path[0] || '兴趣');
  return {
    id: String(i.id || ''),
    keyword: i.name || '',
    category: path.length ? path.join(' > ') : type,
    audience: i.audience_size_lower_bound != null
      ? Number(i.audience_size_lower_bound).toLocaleString('en-US')
        + (i.audience_size_upper_bound != null ? ' - ' + Number(i.audience_size_upper_bound).toLocaleString('en-US') : '')
      : (i.audience_size != null ? Number(i.audience_size).toLocaleString('en-US') : '—'),
    type,
    topic: i.topic || '',
    link: 'https://www.facebook.com/adsmanager/audiences',
  };
}

// Map an ad account carrying a nested insights edge to the adsManager columns.
export function normalizeAdAccountInsights(a) {
  const ins = (a.insights && a.insights.data && a.insights.data[0]) || {};
  return {
    id: 'act_' + (a.account_id || ''),
    account_id: a.account_id || '',
    name: a.name || '',
    status: a.account_status === 1 ? 1 : 2,
    currency: ins.account_currency || a.currency || '',
    // insights.spend is already a decimal string; amount_spent is in cents
    spend: ins.spend != null ? Number(ins.spend).toFixed(2)
         : (a.amount_spent != null ? (a.amount_spent / 100).toFixed(2) : '0.00'),
    impressions: ins.impressions != null ? String(ins.impressions) : '0',
    clicks: ins.clicks != null ? String(ins.clicks) : '0',
    cpc: ins.cpc != null ? Number(ins.cpc).toFixed(3) : '0.000',
    ctr: ins.ctr != null ? Number(ins.ctr).toFixed(2) + '%' : '0.00%',
    timezone: a.timezone_name || '',
    account_type: (a.funding_source_details && a.funding_source_details.type_name) || '—',
    owner_role: '管理员',
    business_name: a.business ? a.business.name : '个人',
    business_id: a.business ? a.business.id : '',
  };
}

// Map a Graph ad-account row to the column shape the web app table expects.
export function normalizeAdAccount(a) {
  const statusMap = { 1: '活跃', 2: '已停用', 3: '未结算', 7: '待审核', 8: '待结算', 9: '宽限期', 101: '关闭' };
  return {
    id: 'act_' + (a.account_id || ''),
    account_id: a.account_id || '',
    name: a.name || '',
    status: a.account_status === 1 ? 1 : 2,
    account_status_label: statusMap[a.account_status] || ('状态' + a.account_status),
    amount_spent: a.amount_spent != null ? (a.amount_spent / 100).toFixed(2) : '0.00',
    balance: a.balance != null ? (a.balance / 100).toFixed(2) : '0.00',
    spend_cap: a.spend_cap ? (a.spend_cap / 100).toFixed(2) : '不限额',
    currency: a.currency || '',
    timezone: a.timezone_name || '',
    disable_reason: a.disable_reason ? String(a.disable_reason) : '',
    business_name: a.business ? a.business.name : '个人',
    business_id: a.business ? a.business.id : '',
    created_time: (a.created_time || '').slice(0, 10),
    owner_role: '管理员',
    account_type: (a.funding_source_details && a.funding_source_details.type_name) || '—',
    origin_id: a.account_id || '',
    country: '',
  };
}
