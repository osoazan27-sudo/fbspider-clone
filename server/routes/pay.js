const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();
const now = () => Math.floor(Date.now() / 1000);
const ok = (data, info = 'success') => ({ status: 1, data, info });
const fail = (info, data = []) => ({ status: 0, data, info });

// GET /api/pay/getServiceList  -> all plans (public)
router.get('/getServiceList', (_req, res) => {
  const rows = db.prepare('SELECT * FROM services ORDER BY module_id, sort').all();
  return res.json(ok(rows));
});

// GET /api/pay/getMyservicesList -> the current user's active memberships
router.get('/getMyservicesList', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM user_services WHERE uid=?').all(req.uid);
  return res.json(ok(rows));
});

// GET /api/pay/getMyorder -> order history
router.get('/getMyorder', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM orders WHERE uid=? ORDER BY create_time DESC').all(req.uid);
  return res.json(ok(rows, 'Success'));
});

router.get('/getOrderDetail', requireAuth, (req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE ordernum=? AND uid=?').get(req.query.ordernum, req.uid);
  return res.json(o ? ok(o) : fail('订单不存在'));
});
router.get('/orderInfo', requireAuth, (req, res) => {
  const o = db.prepare('SELECT * FROM orders WHERE ordernum=? AND uid=?').get(req.query.ordernum, req.uid);
  return res.json(o ? ok(o) : fail('订单不存在'));
});

// GET /api/pay/promoInfo?promo=CODE  (mock discount)
router.get('/promoInfo', (req, res) => {
  const promo = String(req.query.promo || '').toUpperCase();
  const table = { FB10: 0.9, FB20: 0.8, VERYFB: 0.85 };
  if (table[promo]) return res.json(ok({ promo, discount: table[promo], label: `${Math.round((1 - table[promo]) * 100)}% off` }));
  return res.json(fail('优惠券无效'));
});
router.get('/discount', requireAuth, (_req, res) => res.json(ok({ discount: 1 })));

// unpaid order helpers
router.get('/unpaidOrder', requireAuth, (req, res) => {
  const o = db.prepare("SELECT * FROM orders WHERE uid=? AND pay_status=0 ORDER BY create_time DESC LIMIT 1").get(req.uid);
  return res.json(ok(o || null));
});
router.post('/dropUnpaidOrder', requireAuth, (req, res) => {
  db.prepare("DELETE FROM orders WHERE uid=? AND pay_status=0 AND ordernum=?").run(req.uid, req.body?.ordernum || '');
  return res.json(ok([], '删除旧订单成功'));
});

function makeOrder(uid, body) {
  const svc = db.prepare('SELECT * FROM services WHERE id=?').get(body.service_id);
  if (!svc) return null;
  const months = Number(body.months || 1);
  const unit = parseFloat(svc.price);
  const amount = (unit * months).toFixed(2);
  const discount = Number(body.discount || 1);
  const pay = (unit * months * discount).toFixed(2);
  const ordernum = 'FBS' + Date.now() + Math.floor(Math.random() * 900 + 100);
  db.prepare(`INSERT INTO orders
    (ordernum,uid,module_id,module_name,order_type,months,currency,amount,pay_amount,pay_method,order_status,pay_status,create_time)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(ordernum, uid, svc.module_id, svc.module_name, body.order_type || 'buy', months,
      body.currency || 'USD', amount, pay, body.pay_method || 'stripe', 0, 0, now());
  return { ordernum, svc, months, amount, pay_amount: pay };
}

// POST /api/pay/createPaymentIntent (stripe mock) { service_id, months, order_type, pay_method, discount }
router.post('/createPaymentIntent', requireAuth, (req, res) => {
  const o = makeOrder(req.uid, req.body || {});
  if (!o) return res.json(fail('服务不存在'));
  return res.json(ok({
    ordernum: o.ordernum,
    client_secret: 'pi_mock_' + o.ordernum,
    pay_amount: o.pay_amount,
    currency: req.body.currency || 'USD',
    // In this clone we expose a demo pay URL that auto-confirms.
    pay_url: `/api/pay/mockConfirm?ordernum=${o.ordernum}`,
  }, '创建支付成功（演示）'));
});

// POST /api/pay/cryptomus (crypto mock)
router.post('/cryptomus', requireAuth, (req, res) => {
  const o = makeOrder(req.uid, { ...req.body, pay_method: 'cryptomus' });
  if (!o) return res.json(fail('服务不存在'));
  return res.json(ok({
    ordernum: o.ordernum,
    qr: 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent('crypto:' + o.ordernum),
    address: 'TQn9Y2khEsLMWD1mockCryptoAddr' + (o.ordernum.slice(-6)),
    pay_amount: o.pay_amount,
    pay_url: `/api/pay/mockConfirm?ordernum=${o.ordernum}`,
  }, '创建支付成功（演示）'));
});

// GET/POST /api/pay/mockConfirm?ordernum= -> mark paid and grant membership
function confirm(req, res) {
  const ordernum = req.query.ordernum || req.body?.ordernum;
  const o = db.prepare('SELECT * FROM orders WHERE ordernum=? AND uid=?').get(ordernum, req.uid);
  if (!o) return res.json(fail('订单不存在'));
  if (o.pay_status === 1) return res.json(ok(o, '已支付'));
  db.prepare('UPDATE orders SET pay_status=1, order_status=1, pay_time=? WHERE ordernum=?').run(now(), ordernum);
  const svc = db.prepare('SELECT * FROM services WHERE module_id=? AND level_id>0 ORDER BY level_id LIMIT 1').get(o.module_id)
    || db.prepare('SELECT * FROM services WHERE module_id=? ORDER BY sort LIMIT 1').get(o.module_id);
  const start = now();
  const end = start + o.months * 30 * 86400;
  db.prepare(`INSERT INTO user_services (uid,module_id,module_name,level,level_id,name,num,total_num,months,start_time,end_time)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(uid,module_id) DO UPDATE SET
      level=excluded.level, level_id=excluded.level_id, name=excluded.name,
      num=excluded.num, total_num=excluded.total_num,
      months=user_services.months+excluded.months,
      end_time=MAX(user_services.end_time, ?)+excluded.months*30*86400`)
    .run(req.uid, o.module_id, o.module_name, svc.level, svc.level_id, svc.name,
      svc.num, svc.total_num, o.months, start, end, start);
  return res.json(ok({ ordernum, pay_status: 1 }, '支付成功'));
}
router.get('/mockConfirm', requireAuth, confirm);
router.post('/mockConfirm', requireAuth, confirm);

// GET /api/pay/getRecords?uid=&module_id=  -> per-module usage record
router.get('/getRecords', requireAuth, (req, res) => {
  const module_id = Number(req.query.module_id || 0);
  const rec = db.prepare('SELECT used, reset_day FROM usage_records WHERE uid=? AND module_id=?').get(req.uid, module_id)
    || { used: 0, reset_day: 1 };
  const svc = db.prepare('SELECT num, total_num FROM user_services WHERE uid=? AND module_id=?').get(req.uid, module_id)
    || db.prepare('SELECT num, total_num FROM services WHERE module_id=? AND level_id=0 LIMIT 1').get(module_id)
    || { num: 10, total_num: 50 };
  return res.json(ok({ used: rec.used, num: svc.num, total_num: svc.total_num, reset_day: rec.reset_day }));
});
router.post('/addRecord', requireAuth, (req, res) => {
  const module_id = Number(req.body?.module_id || 0);
  const inc = Number(req.body?.num || 1);
  db.prepare(`INSERT INTO usage_records (uid,module_id,used,reset_day) VALUES (?,?,?,1)
    ON CONFLICT(uid,module_id) DO UPDATE SET used=used+?`).run(req.uid, module_id, inc, inc);
  return res.json(ok([], '记录成功'));
});
router.get('/clearRecords', requireAuth, (req, res) => {
  db.prepare('UPDATE usage_records SET used=0 WHERE uid=? AND module_id=?').run(req.uid, Number(req.query.module_id || 0));
  return res.json(ok([], '已清除'));
});

module.exports = router;
