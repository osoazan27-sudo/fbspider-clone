// Backend-free implementation of the API surface, for the static (GitHub Pages)
// build. Auth + membership + tickets live in localStorage; module demo data is
// generated client-side. Live Facebook data still comes from the extension.
// Every function returns the same { status, data, info } envelope as the server.
import services from '../mock/services.data.json';
import * as gen from '../mock/generate';

const LS = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { localStorage.setItem(k, JSON.stringify(v)); },
};
const ok = (data, info = 'success') => Promise.resolve({ status: 1, data, info });
const fail = (info, data = []) => Promise.resolve({ status: 0, data, info });
const now = () => Math.floor(Date.now() / 1000);
const uid = () => LS.get('local_uid', 1590533223);

function ensureUser(email) {
  let u = LS.get('local_user', null);
  if (!u) {
    u = { id: 1590533223, email: email || 'you@local', username: (email || 'you').split('@')[0],
      is_active: 1, status: 0, must_change_password: 0,
      registration_time: new Date().toISOString().slice(0, 19).replace('T', ' '), last_login_at: now() };
    LS.set('local_user', u); LS.set('local_uid', u.id);
  }
  if (email) { u.email = email; u.username = email.split('@')[0]; LS.set('local_user', u); }
  return u;
}

// ---- auth (local: any credentials work; it's your own local tool) ----
export const login = (b) => { const u = ensureUser(b.email); return ok({ token: 'Bearer local.' + u.id, ...u }); };
export const register = (b) => login(b);
export const logout = () => ok([]);
export const getInfo = () => ok(ensureUser());
export const getMenu = () => ok([]);
export const updateUserInfo = (b) => { const u = ensureUser(); Object.assign(u, b); LS.set('local_user', u); return ok(u); };
export const updateAccount = (b) => { const u = ensureUser(); if (b.username) u.username = b.username; LS.set('local_user', u); return ok(u, '账号已保存~'); };
export const changePassword = () => ok([], '密码已更新');
export const updateEmail = (b) => { const u = ensureUser(); u.email = b.email; LS.set('local_user', u); return ok([], '邮箱已更新'); };
export const emsSend = () => ok({ ttl: 300 }, '验证码已发送（本地演示固定 000000）');
export const emsCheck = (b) => (String(b.code) === '000000' ? ok([], '验证通过') : fail('验证码错误'));
export const getUserConfig = () => { const fb = LS.get('local_fb', null); return fb ? ok(fb) : fail('不存在该用户配置信息'); };
export const updateUserFb = (b) => { LS.set('local_fb', { fbid: b.fbid, fb_name: b.fb_name }); return ok([], '保存成功'); };

// ---- membership / pay ----
export const getServiceList = () => ok(services);
export const getMyServices = () => ok(LS.get('local_services', []));
export const getMyOrders = () => ok(LS.get('local_orders', []), 'Success');
export const getRecords = (u, moduleId) => {
  const svc = services.find((s) => s.module_id === Number(moduleId) && s.level_id === 0) || { num: 10, total_num: 50 };
  const used = LS.get('local_usage_' + moduleId, 0);
  return ok({ used, num: svc.num, total_num: svc.total_num, reset_day: 1 });
};
export const addRecord = (b) => { const k = 'local_usage_' + b.module_id; LS.set(k, LS.get(k, 0) + (b.num || 1)); return ok([], '记录成功'); };
export const createPaymentIntent = (b) => makeOrder(b, 'stripe');
export const cryptomus = (b) => makeOrder(b, 'cryptomus');
function makeOrder(b, method) {
  const svc = services.find((s) => s.id === b.service_id);
  if (!svc) return fail('服务不存在');
  const months = Number(b.months || 1);
  const amount = (parseFloat(svc.price) * months).toFixed(2);
  const pay = (parseFloat(svc.price) * months * Number(b.discount || 1)).toFixed(2);
  const ordernum = 'FBS' + Date.now() + Math.floor(Math.random() * 900 + 100);
  const orders = LS.get('local_orders', []);
  orders.unshift({ ordernum, uid: uid(), module_id: svc.module_id, module_name: svc.module_name,
    order_type: b.order_type || 'buy', months, currency: b.currency || 'USD', amount, pay_amount: pay,
    pay_method: method, order_status: 0, pay_status: 0, create_time: now() });
  LS.set('local_orders', orders);
  const extra = method === 'cryptomus'
    ? { qr: 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent('crypto:' + ordernum), address: 'TQn9Y2mock' + ordernum.slice(-6) }
    : { client_secret: 'pi_local_' + ordernum };
  return ok({ ordernum, pay_amount: pay, currency: b.currency || 'USD', ...extra });
}
export const mockConfirm = (ordernum) => {
  const orders = LS.get('local_orders', []);
  const o = orders.find((x) => x.ordernum === ordernum);
  if (!o) return fail('订单不存在');
  o.pay_status = 1; o.order_status = 1; o.pay_time = now(); LS.set('local_orders', orders);
  const svc = services.find((s) => s.module_id === o.module_id && s.level_id > 0) || services.find((s) => s.module_id === o.module_id);
  const start = now(); const end = start + o.months * 30 * 86400;
  const list = LS.get('local_services', []).filter((s) => s.module_id !== o.module_id);
  list.push({ uid: uid(), module_id: o.module_id, module_name: o.module_name, level: svc.level, level_id: svc.level_id,
    name: svc.name, num: svc.num, total_num: svc.total_num, months: o.months, start_time: start, end_time: end });
  LS.set('local_services', list);
  return ok({ ordernum, pay_status: 1 }, '支付成功');
};
export const promoInfo = (promo) => {
  const t = { FB10: 0.9, FB20: 0.8, VERYFB: 0.85 }; const p = String(promo).toUpperCase();
  return t[p] ? ok({ promo: p, discount: t[p], label: Math.round((1 - t[p]) * 100) + '% off' }) : fail('优惠券无效');
};

// ---- bound FB "operating" accounts ----
export const accountList = () => {
  const fb = LS.get('local_fb', null); const extra = LS.get('local_fb_accounts', []);
  const list = [];
  if (fb && fb.fbid) list.push({ id: 0, fbid: fb.fbid, name: fb.fb_name || ('FB ' + fb.fbid), self: 1 });
  extra.forEach((a, i) => list.push({ id: i + 1, fbid: a.fbid, name: a.name, self: 0 }));
  return ok(list);
};
export const addAccount = (b) => {
  if (!b.fbid) return fail('fbid 缺失');
  const extra = LS.get('local_fb_accounts', []);
  if (extra.find((a) => a.fbid === String(b.fbid))) return fail('已添加过了');
  extra.push({ fbid: String(b.fbid), name: b.name || ('FB ' + b.fbid) }); LS.set('local_fb_accounts', extra);
  return ok([], '添加成功');
};

// ---- module demo data ----
const GEN = { adaccount: () => gen.genAdAccounts(uid()), bm: () => gen.genBMs(uid()), page: () => gen.genPages(uid()),
  pixel: () => gen.genPixels(uid()), adcomment: () => gen.genComments(uid()) };
export const moduleList = (name, params = '') => {
  if (name === 'friend') return ok({ received: gen.genFriends(uid(), 8), sent: gen.genFriends(uid() + 999, 5).map((r) => ({ ...r, status: '已发送' })) });
  if (name === 'dataManager') { const kind = (params.match(/kind=(\w+)/) || [])[1] || 'acc';
    return ok(kind === 'bm' ? gen.genBMs(uid()) : kind === 'page' ? gen.genPages(uid()) : gen.genAdAccounts(uid())); }
  if (name === 'library') { const kw = decodeURIComponent((params.match(/keyword=([^&]*)/) || [])[1] || ''); return ok(gen.genLibrary(uid(), kw)); }
  if (name === 'adsManager') return ok(gen.genAdAccounts(uid(), 8).map((a) => ({ id: a.id, name: a.name, currency: a.currency, timezone: a.timezone, owner_role: a.owner_role, account_type: a.account_type, business_name: a.business_name, spend: a.amount_spent, status: a.status })));
  return ok((GEN[name] ? GEN[name]() : []).map((x) => ({ ...x, note: '', favourite: 0 })));
};
export const moduleAction = (b) => ok((b.targets || [{}]).map((t, i) => ({ obj_id: String(t.id || i), name: t.name || ('对象 ' + (i + 1)), status: Math.random() > 0.1 ? 1 : 0, message: Math.random() > 0.1 ? '成功' : '失败' })), '操作完成');
export const setNote = () => ok([], '备注已保存');
export const toggleFav = () => ok([], '已更新');
export const createPages = (b) => ok((b.names || []).map((n) => ({ id: String(1e14 + Math.floor(Math.random() * 8e13)), name: n, type: b.type, create_channel: b.type, created_time: new Date().toISOString().slice(0, 10), status: 1, result: '成功' })), '创建成功~');

// ---- interest targeting ----
export const interestSearch = (kw) => ok(gen.genInterests(kw));
export const keywordFiles = () => ok(LS.get('local_kwfiles', []));
export const saveKeywordFile = (u, b) => { const files = LS.get('local_kwfiles', []); const id = Date.now(); files.unshift({ id, name: b.name, create_time: new Date().toISOString().slice(0, 19).replace('T', ' ') }); LS.set('local_kwfiles', files); LS.set('local_kwitems_' + id, b.items || []); return ok({ id }, '保存成功'); };
export const deleteKeywordFile = (u, id) => { LS.set('local_kwfiles', LS.get('local_kwfiles', []).filter((f) => f.id !== Number(id))); return ok([], '已删除'); };
export const keywordItems = (u, cat) => ok(LS.get('local_kwitems_' + cat, []));

// ---- support tickets ----
export const ticketList = () => ok(LS.get('local_tickets', []).map((t) => ({ ...t, status_label: ['待处理', '处理中', '已关闭'][t.status] || '未知', last_reply: t.last_reply || '暂无回复' })));
export const ticketCreate = (b) => { const list = LS.get('local_tickets', []); const id = (list[0]?.id || 0) + 1; list.unshift({ id, type: b.type || '其他', title: b.title, content: b.content, status: 0, handler: '客服', last_reply: '暂无回复', create_time: now(), replies: [{ from_admin: 0, content: b.content, create_time_str: new Date().toLocaleString() }] }); LS.set('local_tickets', list); return ok({ id }, '工单已创建'); };
export const ticketDetail = (id) => { const t = LS.get('local_tickets', []).find((x) => x.id === Number(id)); return t ? ok({ ...t, status_label: ['待处理', '处理中', '已关闭'][t.status] }) : fail('工单不存在'); };
export const ticketReply = (b) => { const list = LS.get('local_tickets', []); const t = list.find((x) => x.id === Number(b.id)); if (!t) return fail('工单不存在'); t.replies = t.replies || []; t.replies.push({ from_admin: 0, content: b.content, create_time_str: new Date().toLocaleString() }); t.replies.push({ from_admin: 1, content: '您好，已收到您的问题，我们会尽快处理。', create_time_str: new Date().toLocaleString() }); t.status = 1; t.last_reply = b.content; LS.set('local_tickets', list); return ok([], '回复成功'); };
