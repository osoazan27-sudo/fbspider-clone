// 工单系统 (support tickets)
const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();
const now = () => Math.floor(Date.now() / 1000);
const fmt = (ts) => new Date(ts * 1000).toISOString().slice(0, 19).replace('T', ' ');
const ok = (data, info = 'success') => ({ status: 1, data, info });
const fail = (info, data = []) => ({ status: 0, data, info });

const STATUS_LABEL = { 0: '待处理', 1: '处理中', 2: '已关闭' };

router.get('/list', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM tickets WHERE uid=? ORDER BY update_time DESC').all(req.uid)
    .map((t) => ({ ...t, status_label: STATUS_LABEL[t.status] || '未知',
      create_time_str: fmt(t.create_time), last_reply: t.last_reply || '暂无回复' }));
  return res.json(ok(rows));
});

router.post('/create', requireAuth, (req, res) => {
  const { type, title, content } = req.body || {};
  if (!title) return res.json(fail('请填写标题'));
  const info = db.prepare(`INSERT INTO tickets (uid,type,title,content,status,handler,last_reply,create_time,update_time)
    VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(req.uid, type || '其他', title, content || '', 0, '客服', '暂无回复', now(), now());
  const id = info.lastInsertRowid;
  db.prepare('INSERT INTO ticket_replies (ticket_id,from_admin,content,create_time) VALUES (?,?,?,?)')
    .run(id, 0, content || '', now());
  return res.json(ok({ id }, '工单已创建'));
});

router.get('/detail', requireAuth, (req, res) => {
  const t = db.prepare('SELECT * FROM tickets WHERE id=? AND uid=?').get(Number(req.query.id), req.uid);
  if (!t) return res.json(fail('工单不存在'));
  const replies = db.prepare('SELECT from_admin, content, create_time FROM ticket_replies WHERE ticket_id=? ORDER BY id')
    .all(t.id).map((r) => ({ ...r, create_time_str: fmt(r.create_time) }));
  return res.json(ok({ ...t, status_label: STATUS_LABEL[t.status], replies }));
});

router.post('/reply', requireAuth, (req, res) => {
  const { id, content } = req.body || {};
  const t = db.prepare('SELECT * FROM tickets WHERE id=? AND uid=?').get(Number(id), req.uid);
  if (!t) return res.json(fail('工单不存在'));
  db.prepare('INSERT INTO ticket_replies (ticket_id,from_admin,content,create_time) VALUES (?,?,?,?)')
    .run(t.id, 0, content || '', now());
  db.prepare('UPDATE tickets SET last_reply=?, update_time=?, status=1 WHERE id=?').run(content || '', now(), t.id);
  // auto canned admin reply so the thread feels alive
  db.prepare('INSERT INTO ticket_replies (ticket_id,from_admin,content,create_time) VALUES (?,?,?,?)')
    .run(t.id, 1, '您好，已收到您的问题，我们会尽快处理。', now() + 1);
  return res.json(ok([], '回复成功'));
});

module.exports = router;
