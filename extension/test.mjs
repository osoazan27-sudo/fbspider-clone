// Unit tests for the pure bridge logic (no browser needed).
import assert from 'node:assert';
import {
  stripFbPrefix, parseFbResponse, computeJazoest, fillPlaceholders,
  extractSessionFromHtml, GraphAPI, normalizeAdAccount,
  normalizePixel, normalizeAdPost, normalizeAdAccountInsights,
  describeFbError, isWriteOk, extractAccessToken,
  nonexistentField, stripFieldFromUrl,
} from './lib/fb.js';

let pass = 0;
const t = (name, fn) => { fn(); console.log('  ✓', name); pass++; };

// --- FB response prefix stripping ---
t('strips for(;;); guard', () => {
  assert.deepEqual(parseFbResponse('for (;;);{"a":1}').data, { a: 1 });
});
t('strips )]}\' guard', () => {
  assert.deepEqual(parseFbResponse(')]}\'\n{"b":2}').data, { b: 2 });
});
t('plain json passes through', () => {
  assert.deepEqual(parseFbResponse('{"c":3}').data, { c: 3 });
});
t('non-json returns raw', () => {
  const r = parseFbResponse('for (;;);oops');
  assert.equal(r.ok, false);
});

// --- jazoest ---
t('jazoest = 2 + sum(charCodes)', () => {
  // "AB" -> 65+66 = 131 -> "2131"
  assert.equal(computeJazoest('AB'), '2131');
});

// --- placeholder substitution ---
t('fills known placeholders', () => {
  const s = { accessToken: 'EAAB123', fb_dtsg: 'DTSG', user: '100' };
  const url = fillPlaceholders('x?access_token=@token@&__user=@__user@&fb_dtsg=@fb_dtsg@', s);
  assert.equal(url, 'x?access_token=EAAB123&__user=100&fb_dtsg=DTSG');
});
t('removes unknown placeholders (no leak)', () => {
  assert.equal(fillPlaceholders('a=@bogus@b', {}), 'a=b');
});
t('token falls back to eaab', () => {
  assert.equal(fillPlaceholders('@token@', { eaab: 'EAABX' }), 'EAABX');
});
t('jazoest placeholder derives from fb_dtsg when absent', () => {
  assert.equal(fillPlaceholders('@jazoest@', { fb_dtsg: 'AB' }), '2131');
});

// --- session extraction from HTML fixtures ---
t('extracts fb_dtsg / lsd / user / EAA token', () => {
  const html = `
    ["DTSGInitialData",[],{"token":"NAcMxyz:123"},258]
    ["LSD",[],{"token":"AbCdEf"},259]
    "USER_ID":"61550000000001"
    something access_token":"EAABwzLixnjYBO1234567890abcdefXYZ" more`;
  const s = extractSessionFromHtml(html);
  assert.equal(s.fb_dtsg, 'NAcMxyz:123');
  assert.equal(s.lsd, 'AbCdEf');
  assert.equal(s.user, '61550000000001');
  assert.ok(s.accessToken.startsWith('EAAB'));
  assert.equal(s.jazoest, computeJazoest('NAcMxyz:123'));
});
t('falls back to name=fb_dtsg markup', () => {
  const s = extractSessionFromHtml('<input name="fb_dtsg" value="Zzz123" />');
  assert.equal(s.fb_dtsg, 'Zzz123');
});

// --- Graph API URL builders carry the token placeholder ---
t('adAccounts url has me/adaccounts + @token@', () => {
  const u = GraphAPI.adAccounts();
  assert.ok(u.includes('/me/adaccounts'));
  assert.ok(u.includes('access_token=@token@'));
});
t('renameAdAccount encodes name + act_ prefix', () => {
  const u = GraphAPI.renameAdAccount('123', 'New Name');
  assert.ok(u.includes('/act_123?'));
  assert.ok(u.includes('name=New%20Name'));
});

// --- ad account normalization (cents -> dollars, status mapping) ---
t('normalizeAdAccount maps status + money', () => {
  const row = normalizeAdAccount({
    account_id: '999', name: 'Acc', account_status: 1,
    amount_spent: '15050', balance: '2000', currency: 'USD',
    timezone_name: 'Asia/Hong_Kong', business: { id: '5', name: 'Biz' }, created_time: '2025-03-01T00:00:00+0000',
  });
  assert.equal(row.id, 'act_999');
  assert.equal(row.status, 1);
  assert.equal(row.account_status_label, '活跃');
  assert.equal(row.amount_spent, '150.50');
  assert.equal(row.balance, '20.00');
  assert.equal(row.business_name, 'Biz');
  assert.equal(row.created_time, '2025-03-01');
});
t('normalizeAdAccount marks disabled', () => {
  const row = normalizeAdAccount({ account_id: '1', account_status: 2, disable_reason: 2 });
  assert.equal(row.status, 2);
  assert.equal(row.account_status_label, '已停用');
});

// --- new live-data builders + normalizers ---
t('adAccountsWithInsights nests the insights edge with a preset', () => {
  const u = GraphAPI.adAccountsWithInsights('last_7d');
  assert.ok(u.includes('me/adaccounts'));
  assert.ok(decodeURIComponent(u).includes('insights.date_preset(last_7d){spend,impressions,clicks,cpc,ctr,account_currency}'));
  assert.ok(u.includes('access_token=@token@'));
});
t('adPosts requests the creative object story', () => {
  const u = GraphAPI.adPosts('123');
  assert.ok(u.includes('act_123/ads'));
  assert.ok(decodeURIComponent(u).includes('effective_object_story_id'));
});
t('adAccountPixels targets the account edge', () => {
  assert.ok(GraphAPI.adAccountPixels('55').includes('act_55/adspixels'));
});

t('normalizePixel keeps the real name + id and derives activity', () => {
  const recent = new Date(Date.now() - 2 * 864e5).toISOString();
  const p = normalizePixel(
    { id: '777', name: 'My Pixel', last_fired_time: recent, is_created_by_business: true,
      owner_business: { id: 'b1', name: 'Biz One' } },
    { id: 'b1', name: 'Biz One' });
  assert.equal(p.id, '777');
  assert.equal(p.name, 'My Pixel');
  assert.equal(p.business_name, 'Biz One');
  assert.equal(p.is_active, true);
  assert.equal(p.active_label, '活跃');
  assert.equal(p.type, 'BM创建');
});
t('normalizePixel marks stale pixels inactive and unnamed ones', () => {
  const old = new Date(Date.now() - 60 * 864e5).toISOString();
  const p = normalizePixel({ id: '1', last_fired_time: old });
  assert.equal(p.is_active, false);
  assert.equal(p.active_label, '不活跃');
  assert.equal(p.name, '(未命名像素)');
  const never = normalizePixel({ id: '2' });
  assert.equal(never.active_label, '未触发');
  assert.equal(never.last_active, '—');
});

t('normalizeAdPost extracts the post id, page id and real page name', () => {
  const row = normalizeAdPost(
    { id: 'ad1', name: 'Summer Sale', effective_status: 'ACTIVE', created_time: '2026-05-02T10:00:00+0000',
      creative: { effective_object_story_id: '1122_3344', title: 'T', body: 'B' } },
    { account_id: '900', name: 'Main Acc' },
    { '1122': 'My Real Page' });
  assert.equal(row.post_id, '1122_3344');
  assert.equal(row.page_id, '1122');
  assert.equal(row.page_name, 'My Real Page');
  assert.equal(row.title, 'Summer Sale');
  assert.equal(row.manage_account, 'Main Acc');
  assert.equal(row.created_time, '2026-05-02');
  assert.equal(row.url, 'https://www.facebook.com/1122/posts/3344');
  // table expects monitor-state strings, not delivery state
  assert.equal(row.status, '未监控');
  assert.equal(row.delivery_status, 'ACTIVE');
});
t('normalizeAdPost falls back when there is no story id', () => {
  const row = normalizeAdPost({ id: 'ad9', creative: {} }, {}, {});
  assert.equal(row.post_id, 'ad9');
  assert.equal(row.page_id, '');
  assert.equal(row.page_name, '—');
  assert.equal(row.url, '');
});

t('normalizeAdAccountInsights prefers insights spend over amount_spent', () => {
  const row = normalizeAdAccountInsights({
    account_id: '42', name: 'Acc', account_status: 1, currency: 'USD', amount_spent: '99999',
    insights: { data: [{ spend: '123.4', impressions: 5000, clicks: 250, cpc: '0.4936', ctr: '5', account_currency: 'HKD' }] },
  });
  assert.equal(row.spend, '123.40');
  assert.equal(row.currency, 'HKD');
  assert.equal(row.impressions, '5000');
  assert.equal(row.clicks, '250');
  assert.equal(row.cpc, '0.494');
  assert.equal(row.ctr, '5.00%');
});
t('normalizeAdAccountInsights falls back to amount_spent when no insights', () => {
  const row = normalizeAdAccountInsights({ account_id: '7', account_status: 2, currency: 'USD', amount_spent: '15050' });
  assert.equal(row.spend, '150.50');
  assert.equal(row.impressions, '0');
  assert.equal(row.ctr, '0.00%');
  assert.equal(row.status, 2);
});

// --- write builders + result interpretation ---
t('write URL builders target the right edges', () => {
  assert.ok(GraphAPI.businessUsers('B1').includes('/B1/business_users'));
  assert.ok(GraphAPI.deleteBusinessUser('BU9').includes('/BU9?'));
  assert.ok(GraphAPI.pixelShareToBusiness('PX', 'B2').includes('/PX/agencies?business=B2'));
  assert.ok(GraphAPI.pixelUnshareFromBusiness('PX', 'B2').includes('/PX/agencies?business=B2'));
  assert.ok(GraphAPI.pixelSharedAgencies('PX').includes('/PX/agencies?fields='));
});
t('pixel-to-account share strips an act_ prefix', () => {
  assert.ok(GraphAPI.pixelShareToAdAccount('PX', 'act_123').includes('account_id=123'));
  assert.ok(GraphAPI.pixelShareToAdAccount('PX', '456').includes('account_id=456'));
});

t('isWriteOk accepts real successes', () => {
  assert.equal(isWriteOk({ success: true, data: { success: true } }), true);
  assert.equal(isWriteOk({ success: true, data: { id: '123' } }), true);
  assert.equal(isWriteOk({ success: true, data: {} }), true);        // empty 200 body
});
t('isWriteOk rejects a Graph error body even on HTTP success', () => {
  // the important one: FB returns 200 with an error object
  assert.equal(isWriteOk({ success: true, data: { error: { message: 'nope', code: 200 } } }), false);
  assert.equal(isWriteOk({ success: false, data: { success: true } }), false);
  assert.equal(isWriteOk({ success: true, data: null }), false);
  assert.equal(isWriteOk(null), false);
});
t('describeFbError surfaces what Facebook actually said', () => {
  assert.equal(
    describeFbError({ data: { error: { message: 'Permissions error', code: 200, error_subcode: 1349004 } } }),
    'Permissions error · code 200/1349004');
  // the user-facing message wins when present
  assert.equal(
    describeFbError({ data: { error: { message: 'x', error_user_msg: '你没有权限', code: 10 } } }),
    '你没有权限 · code 10');
  assert.equal(describeFbError(null), '无响应');
});

// --- access-token extraction (the "Malformed access token / code 190" bug) ---
t('a token containing _ and - is captured whole, not truncated', () => {
  const tok = 'EAABwzLixnjQBO1_abc-DEF' + 'x'.repeat(30);
  assert.equal(extractAccessToken(`{"access_token":"${tok}"}`), tok);
});
t('the old [A-Za-z0-9] charset would have truncated - regression guard', () => {
  const tok = 'EAA' + 'A'.repeat(25) + '_tail-part' + 'B'.repeat(10);
  const got = extractAccessToken('junk ' + tok + ' junk');
  assert.ok(got.includes('_tail-part'), 'lost everything after the underscore');
  assert.equal(got, tok);
});
t('picks the longest candidate, not a prefix', () => {
  const long = 'EAA' + 'z'.repeat(60) + '_end';
  assert.equal(extractAccessToken(`"access_token":"${long.slice(0,30)}" ... ${long}`), long);
});
t('handles JSON-escaped bodies', () => {
  const tok = 'EAA' + 'q'.repeat(40) + '-9';
  assert.equal(extractAccessToken('{\\"access_token\\":\\"' + tok + '\\"}'), tok);
});
t('returns empty when there is no usable token', () => {
  assert.equal(extractAccessToken('nothing here'), '');
  assert.equal(extractAccessToken(null), '');
  assert.equal(extractAccessToken('EAAshort'), '');
});
t('extractSessionFromHtml uses the same token rules', () => {
  const tok = 'EAA' + 'k'.repeat(30) + '_x-y';
  const out = extractSessionFromHtml(`["DTSGInitialData",[],{"token":"DTSG1"}] "access_token":"${tok}"`);
  assert.equal(out.accessToken, tok);
  assert.equal(out.fb_dtsg, 'DTSG1');
});

// --- self-healing deprecated fields (code 100) ---
t('nonexistentField pulls the field name out of a code-100 error', () => {
  assert.equal(nonexistentField({ data: { error: {
    code: 100, message: '(#100) Tried accessing nonexisting field (adtrust_dsl) on node type AdAccount' } } }),
    'adtrust_dsl');
  assert.equal(nonexistentField({ data: { error: { code: 190, message: 'x' } } }), null);
  assert.equal(nonexistentField({ data: { data: [] } }), null);
});
t('stripFieldFromUrl removes a top-level field, keeps the rest', () => {
  const u = 'https://g/me/adaccounts?fields=' + encodeURIComponent('name,account_id,adtrust_dsl,business{id,name}') + '&limit=5&access_token=@token@';
  const out = stripFieldFromUrl(u, 'adtrust_dsl');
  const fields = decodeURIComponent(/fields=([^&]*)/.exec(out)[1]);
  assert.equal(fields, 'name,account_id,business{id,name}');
  assert.ok(out.includes('&limit=5&access_token=@token@'), 'mangled the rest of the url');
});
t('stripFieldFromUrl does not touch a same-named NESTED field', () => {
  const u = 'x?fields=' + encodeURIComponent('name,business{id,name}');
  // "name" appears nested in business{}; only the top-level "name" is dropped
  const out = stripFieldFromUrl(u, 'name');
  assert.equal(decodeURIComponent(/fields=([^&]*)/.exec(out)[1]), 'business{id,name}');
});
t('stripFieldFromUrl leaves the url alone when the field is not top-level', () => {
  const u = 'x?fields=' + encodeURIComponent('name,business{id,foo}');
  assert.equal(stripFieldFromUrl(u, 'foo'), u);   // foo is nested, not stripped
});
t('the live field lists no longer request the deprecated fields', () => {
  const acc = decodeURIComponent(GraphAPI.adAccounts());
  assert.ok(!/adtrust_dsl|min_daily_budget|,age\b|,owner\b/.test(acc), acc);
  const biz = decodeURIComponent(GraphAPI.businesses());
  assert.ok(!/is_disabled_for_integrity_reasons/.test(biz), biz);
});

console.log(`\n${pass} tests passed.`);
