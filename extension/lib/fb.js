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
    '&access_token=@EAAB@',
  insights: (actId, preset = 'last_30d') =>
    `https://adsmanager-graph.facebook.com/${GV}/act_${actId}/insights?fields=` +
    encodeURIComponent('spend,impressions,clicks,cpc,ctr,account_currency') +
    `&date_preset=${preset}&access_token=@token@`,
  adAccountUsers: (actId) =>
    `https://graph.facebook.com/${GV}/act_${actId}/assigned_users?fields=` +
    encodeURIComponent('id,name,tasks') + '&access_token=@EAAB@',
  // write example (reversible): rename an ad account you own
  renameAdAccount: (actId, name) =>
    `https://graph.facebook.com/${GV}/act_${actId}?name=${encodeURIComponent(name)}&access_token=@token@`,
};

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
