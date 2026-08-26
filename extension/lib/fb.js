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
  // Graph access token (EAA…). Prefer longer matches.
  const tokens = [...html.matchAll(/EAA[A-Za-z0-9]{20,}/g)].map((m) => m[0]);
  if (tokens.length) out.accessToken = tokens.sort((a, b) => b.length - a.length)[0];
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
  adAccounts: () =>
    `https://graph.facebook.com/${GV}/me/adaccounts?fields=` +
    encodeURIComponent(
      'name,account_id,account_status,disable_reason,currency,timezone_name,' +
      'amount_spent,balance,spend_cap,min_daily_budget,funding_source_details,' +
      'business{id,name},owner,created_time,age,adtrust_dsl'
    ) + '&limit=500&access_token=@token@',
  businesses: () =>
    `https://graph.facebook.com/${GV}/me/businesses?fields=` +
    encodeURIComponent('id,name,verification_status,created_time,primary_page,two_factor_type,is_disabled_for_integrity_reasons') +
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
};

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
