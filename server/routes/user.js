const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { sign, requireAuth } = require('../auth');

const router = express.Router();

const now = () => Math.floor(Date.now() / 1000);
const fmt = (ts) => new Date(ts * 1000).toISOString().slice(0, 19).replace('T', ' ');
const ok = (data, info = 'success') => ({ status: 1, data, info });
const fail = (info, data = []) => ({ status: 0, data, info });

// numeric-ish user id similar to fbspider (10-digit)
function newUid() {
  let id;
  do { id = 1000000000 + Math.floor(Math.random() * 8999999999); }
  while (db.prepare('SELECT 1 FROM users WHERE id=?').get(id));
  return id;
}

function publicUser(u) {
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    is_active: u.is_active,
    status: u.status,
    must_change_password: u.must_change_password,
    registration_time: u.registration_time,
    last_login_at: u.last_login_at,
    fbid: u.fb_uid || '',
    fb_name: u.fb_name || '',
  };
}

// POST /api/user/register  { email, password }
router.post('/register', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) return res.json(fail('邮箱格式错误'));
  if (!password || password.length < 6) return res.json(fail('密码长度应在6-30个字符之间'));
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) return res.json(fail('该邮箱已注册'));
  const id = newUid();
  db.prepare(`INSERT INTO users (id,email,username,password_hash,is_active,status,registration_time,last_login_at)
              VALUES (?,?,?,?,?,?,?,?)`)
    .run(id, email, email.split('@')[0], bcrypt.hashSync(password, 10), 0, 0, fmt(now()), now());
  return res.json(ok({ token: sign(id), ...publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(id)) }));
});

// POST /api/user/login  { email, password }
router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) return res.json(fail('邮箱或密码格式错误'));
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(email);
  if (!u || !bcrypt.compareSync(password || '', u.password_hash)) return res.json(fail('密码不正确，请重新输入'));
  db.prepare('UPDATE users SET last_login_at=? WHERE id=?').run(now(), u.id);
  u.last_login_at = now();
  return res.json(ok({ token: sign(u.id), ...publicUser(u) }));
});

router.post('/logout', (_req, res) => res.json(ok([])));

// POST /api/user/info
router.post('/info', requireAuth, (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.uid);
  if (!u) return res.json(fail('用户不存在'));
  return res.json(ok(publicUser(u)));
});

// POST /api/user/menu  (server-driven menu; empty like the real one -> client falls back to static routes)
router.post('/menu', requireAuth, (_req, res) => res.json(ok([])));

// POST /api/user/update_user_info  { fbid, fb_name, ... }
router.post('/update_user_info', requireAuth, (req, res) => {
  const { fbid, fb_name } = req.body || {};
  if (fbid !== undefined) db.prepare('UPDATE users SET fb_uid=? WHERE id=?').run(String(fbid), req.uid);
  if (fb_name !== undefined) db.prepare('UPDATE users SET fb_name=? WHERE id=?').run(String(fb_name), req.uid);
  return res.json(ok(publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(req.uid))));
});

// POST /api/user/update  { username }
router.post('/update', requireAuth, (req, res) => {
  const { username } = req.body || {};
  if (username) db.prepare('UPDATE users SET username=? WHERE id=?').run(username, req.uid);
  return res.json(ok(publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(req.uid)), '账号已保存~'));
});

// POST /api/user/change-password { current, password }
router.post('/change-password', requireAuth, (req, res) => {
  const { current, password } = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.uid);
  if (!bcrypt.compareSync(current || '', u.password_hash)) return res.json(fail('当前密码不正确'));
  if (!password || password.length < 6) return res.json(fail('密码长度应在6-30个字符之间'));
  db.prepare('UPDATE users SET password_hash=?, must_change_password=0 WHERE id=?').run(bcrypt.hashSync(password, 10), req.uid);
  return res.json(ok([], '密码已更新'));
});

// POST /api/user/updateEmail { email, code }
router.post('/updateEmail', requireAuth, (req, res) => {
  const { email } = req.body || {};
  if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) return res.json(fail('邮箱格式不正确'));
  if (db.prepare('SELECT 1 FROM users WHERE email=? AND id<>?').get(email, req.uid)) return res.json(fail('该邮箱已被占用'));
  db.prepare('UPDATE users SET email=? WHERE id=?').run(email, req.uid);
  return res.json(ok([], '邮箱已更新'));
});

router.get('/infobyemail', (req, res) => {
  const u = db.prepare('SELECT id,email,username FROM users WHERE email=?').get(req.query.email || '');
  return res.json(u ? ok(u) : fail('用户不存在'));
});

router.get('/searchUserByEmail', requireAuth, (req, res) => {
  const u = db.prepare('SELECT id,email,username FROM users WHERE email=?').get(req.query.email || '');
  return res.json(u ? ok(u) : fail('未找到该用户'));
});

// email verification code (mock: accept 000000)
const ems = express.Router();
ems.post('/send', (_req, res) => res.json(ok({ ttl: 300 }, '验证码已发送（演示环境固定为 000000）')));
ems.post('/check', (req, res) => {
  const { code } = req.body || {};
  return String(code) === '000000' ? res.json(ok([], '验证通过')) : res.json(fail('验证码错误'));
});

// optconfig (user's FB binding + module reset-day settings)
const optconfig = express.Router();
optconfig.get('/getUserConfig', requireAuth, (req, res) => {
  const u = db.prepare('SELECT fb_uid, fb_name FROM users WHERE id=?').get(req.uid);
  if (!u || !u.fb_uid) return res.json(fail('不存在该用户配置信息'));
  return res.json(ok({ fbid: u.fb_uid, fb_name: u.fb_name }));
});
optconfig.post('/updateUserFb', requireAuth, (req, res) => {
  const { fbid, fb_name } = req.body || {};
  db.prepare('UPDATE users SET fb_uid=?, fb_name=? WHERE id=?').run(String(fbid || ''), String(fb_name || ''), req.uid);
  return res.json(ok([], '保存成功'));
});

module.exports = router;
module.exports.ems = ems;
module.exports.optconfig = optconfig;
