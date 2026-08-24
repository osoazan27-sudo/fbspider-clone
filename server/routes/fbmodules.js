const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');
const mock = require('../mock');

const ok = (data, info = 'success') => ({ status: 1, data, info });
const fail = (info, data = []) => ({ status: 0, data, info });

// ---- /api/account ----
const account = express.Router();

// GET /api/account/accountList?uid=  -> bound FB "operating" accounts (the FB logins the plugin controls)
account.get('/accountList', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT id, fbid, name, created_at FROM fb_accounts WHERE uid=?').all(req.uid);
  // always surface the user's own bound FB identity as the first "account"
  const u = db.prepare('SELECT fb_uid, fb_name FROM users WHERE id=?').get(req.uid);
  const list = [];
  if (u && u.fb_uid) list.push({ id: 0, fbid: u.fb_uid, name: u.fb_name || ('FB ' + u.fb_uid), self: 1 });
  for (const r of rows) list.push({ id: r.id, fbid: r.fbid, name: r.name, self: 0 });
  return res.json(ok(list));
});

// POST /api/account/addAccount { fbid, name }
account.post('/addAccount', requireAuth, (req, res) => {
  const { fbid, name } = req.body || {};
  if (!fbid) return res.json(fail('fbid 缺失'));
  const exists = db.prepare('SELECT 1 FROM fb_accounts WHERE uid=? AND fbid=?').get(req.uid, String(fbid));
  if (exists) return res.json(fail('已添加过了'));
  db.prepare('INSERT INTO fb_accounts (uid,fbid,name,created_at) VALUES (?,?,?,?)')
    .run(req.uid, String(fbid), name || ('FB ' + fbid), Math.floor(Date.now() / 1000));
  return res.json(ok([], '添加成功'));
});

// ---- /api/mock/<module> : the scraped-data lists ----
const mockRouter = express.Router();

// helper: note/favourite overlay for a module
function withMeta(uid, module_id, rows) {
  const metas = db.prepare('SELECT obj_id, note, favourite FROM obj_meta WHERE uid=? AND module_id=?').all(uid, module_id);
  const map = new Map(metas.map((m) => [m.obj_id, m]));
  return rows.map((r) => {
    const m = map.get(String(r.id));
    return { ...r, note: m ? m.note : '', favourite: m ? m.favourite : 0 };
  });
}

const GEN = {
  1: (uid) => mock.genAdAccounts(uid),
  7: (uid) => mock.genBMs(uid),
  3: (uid) => mock.genPages(uid),
  4: (uid) => mock.genPixels(uid),
  5: (uid) => mock.genComments(uid),
  9: (uid) => mock.genFriendRequests(uid),
};

function listHandler(module_id) {
  return (req, res) => {
    const rows = withMeta(req.uid, module_id, GEN[module_id](req.uid));
    return res.json(ok(rows));
  };
}

mockRouter.get('/adaccount', requireAuth, listHandler(1));
mockRouter.get('/bm', requireAuth, listHandler(7));
mockRouter.get('/page', requireAuth, listHandler(3));
mockRouter.get('/pixel', requireAuth, listHandler(4));
mockRouter.get('/adcomment', requireAuth, listHandler(5));
mockRouter.get('/friend', requireAuth, (req, res) => {
  res.json(ok({
    received: mock.genFriendRequests(req.uid, 8),
    sent: mock.genFriendRequests(req.uid + 999, 5).map((r) => ({ ...r, status: '已发送' })),
  }));
});

// data manager (资产接收) supports acc/bm/page tabs
mockRouter.get('/dataManager', requireAuth, (req, res) => {
  const kind = req.query.kind || 'acc';
  return res.json(ok(mock.genDataManager(req.uid, kind)));
});

// ad library video search
mockRouter.get('/library', requireAuth, (req, res) => {
  return res.json(ok(mock.genLibraryVideos(req.uid, String(req.query.keyword || ''))));
});

// adsManager (广告及数据) — insights rows per ad account
mockRouter.get('/adsManager', requireAuth, (req, res) => {
  const accounts = mock.genAdAccounts(req.uid, 8).map((a) => ({
    id: a.id, name: a.name, currency: a.currency, timezone: a.timezone,
    owner_role: a.owner_role, account_type: a.account_type, business_name: a.business_name,
    spend: a.amount_spent, status: a.status,
  }));
  return res.json(ok(accounts));
});

// generic note / favourite writer used by several module pages
mockRouter.post('/setNote', requireAuth, (req, res) => {
  const { module_id, obj_id, note } = req.body || {};
  db.prepare(`INSERT INTO obj_meta (uid,module_id,obj_id,note,favourite) VALUES (?,?,?,?,0)
    ON CONFLICT(uid,module_id,obj_id) DO UPDATE SET note=excluded.note`)
    .run(req.uid, Number(module_id), String(obj_id), String(note || ''));
  return res.json(ok([], '备注已保存'));
});
mockRouter.post('/toggleFav', requireAuth, (req, res) => {
  const { module_id, obj_id, favourite } = req.body || {};
  db.prepare(`INSERT INTO obj_meta (uid,module_id,obj_id,note,favourite) VALUES (?,?,?, '',?)
    ON CONFLICT(uid,module_id,obj_id) DO UPDATE SET favourite=excluded.favourite`)
    .run(req.uid, Number(module_id), String(obj_id), favourite ? 1 : 0);
  return res.json(ok([], favourite ? '已收藏' : '已取消收藏'));
});

// generic "action" endpoints (授权/推送/黑名单/拉黑/创建 ...) — simulate success progress
mockRouter.post('/action', requireAuth, (req, res) => {
  const { targets = [] } = req.body || {};
  const results = (targets.length ? targets : ['obj']).map((t, i) => ({
    obj_id: String(t), name: typeof t === 'object' ? t.name : ('对象 ' + (i + 1)),
    status: Math.random() > 0.1 ? 1 : 0,
    message: Math.random() > 0.1 ? '成功' : '失败',
  }));
  return res.json(ok(results, '操作完成'));
});

// create pages (创建主页) — returns created page ids
mockRouter.post('/createPages', requireAuth, (req, res) => {
  const { names = [], type = '个人公共主页' } = req.body || {};
  const created = names.map((n, i) => ({
    id: String(100000000000000 + Math.floor(Math.random() * 8e13)),
    name: n, type, create_channel: type, created_time: new Date().toISOString().slice(0, 10),
    status: 1, result: '成功',
  }));
  return res.json(ok(created, '创建成功~'));
});

module.exports = { account, mock: mockRouter };
