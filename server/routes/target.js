// 兴趣定位 (interest targeting) — saved keyword files + interest search
const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const ok = (data, info = 'success') => ({ status: 1, data, info });
const fail = (info, data = []) => ({ status: 0, data, info });

// mock Facebook interest search: returns 人口统计 / 兴趣 / 行为 buckets
function searchInterests(kw) {
  const types = ['人口统计', '兴趣', '行为'];
  const out = [];
  for (let i = 0; i < 18; i++) {
    const t = types[i % 3];
    out.push({
      id: String(600000000000 + i + kw.length * 100),
      keyword: kw + ' · ' + t + ' ' + (i + 1),
      category: t + ' > ' + ['购物', '科技', '旅游', '美妆', '游戏'][i % 5],
      audience: (Math.floor(Math.random() * 90000000) + 1000000).toLocaleString('en-US'),
      link: 'https://www.facebook.com/adsmanager/audiences',
      type: t,
    });
  }
  return out;
}

const keywordsx = express.Router();

// GET /api/keywordsx/index?uid=&page=&limit=  -> saved keyword "files"
keywordsx.get('/index', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT id, name, create_time FROM keyword_files WHERE uid=? ORDER BY id DESC').all(req.uid);
  return res.json(ok(rows));
});

// GET /api/keywordsx/search?kw=  -> interest search (extra endpoint for this clone)
keywordsx.get('/search', requireAuth, (req, res) => {
  return res.json(ok(searchInterests(String(req.query.kw || '关键词'))));
});

// POST /api/keywordsx/save?uid=  { name, items:[{keyword,category,audience,link}] }
keywordsx.post('/save', requireAuth, (req, res) => {
  const { name, items = [] } = req.body || {};
  if (!name) return res.json(fail('请输入文件名'));
  const info = db.prepare('INSERT INTO keyword_files (uid,name,create_time) VALUES (?,?,?)')
    .run(req.uid, name, new Date().toISOString().slice(0, 19).replace('T', ' '));
  const cat = info.lastInsertRowid;
  const ins = db.prepare('INSERT INTO keyword_items (uid,cat,keyword,category,audience,link) VALUES (?,?,?,?,?,?)');
  const tx = db.transaction((list) => { for (const it of list) ins.run(req.uid, cat, it.keyword, it.category, it.audience, it.link); });
  tx(items);
  return res.json(ok({ id: cat }, '保存成功'));
});

keywordsx.get('/delete', requireAuth, (req, res) => {
  db.prepare('DELETE FROM keyword_files WHERE uid=? AND id=?').run(req.uid, Number(req.query.id));
  db.prepare('DELETE FROM keyword_items WHERE uid=? AND cat=?').run(req.uid, Number(req.query.id));
  return res.json(ok([], '已删除'));
});

const keywordsItem = express.Router();
// GET /api/keywords_item/index?uid=&cat=  -> items within a file
keywordsItem.get('/index', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT id, keyword, category, audience, link FROM keyword_items WHERE uid=? AND cat=?')
    .all(req.uid, Number(req.query.cat));
  return res.json(ok(rows));
});
keywordsItem.get('/delete', requireAuth, (req, res) => {
  db.prepare('DELETE FROM keyword_items WHERE uid=? AND id=?').run(req.uid, Number(req.query.id));
  return res.json(ok([], '已删除'));
});
keywordsItem.get('/batch_delete', requireAuth, (req, res) => {
  const ids = String(req.query.ids || '').split(',').map(Number).filter(Boolean);
  const del = db.prepare('DELETE FROM keyword_items WHERE uid=? AND id=?');
  const tx = db.transaction(() => { for (const id of ids) del.run(req.uid, id); });
  tx();
  return res.json(ok([], '已删除'));
});

module.exports = { keywordsx, keywordsItem };
