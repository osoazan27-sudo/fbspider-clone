// Unit tests for the pure bridge logic (no browser needed).
import assert from 'node:assert';
import {
  stripFbPrefix, parseFbResponse, computeJazoest, fillPlaceholders,
  extractSessionFromHtml, GraphAPI, normalizeAdAccount,
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

console.log(`\n${pass} tests passed.`);
