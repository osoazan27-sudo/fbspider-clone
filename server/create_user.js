// Seed the demo account that mirrors the fbspider test login.
const bcrypt = require('bcryptjs');
const db = require('./db');

// Credentials come from CLI args or env; defaults are generic demo values.
// Pass your own: `node create_user.js you@example.com yourpassword`
const email = process.argv[2] || process.env.SEED_EMAIL || 'demo@example.com';
const password = process.argv[3] || process.env.SEED_PASSWORD || 'demo1234';

const now = Math.floor(Date.now() / 1000);
const fmt = new Date(now * 1000).toISOString().slice(0, 19).replace('T', ' ');

const existing = db.prepare('SELECT id FROM users WHERE email=?').get(email);
if (existing) {
  db.prepare('UPDATE users SET password_hash=? WHERE email=?').run(bcrypt.hashSync(password, 10), email);
  console.log('Updated password for', email, '(id', existing.id + ')');
} else {
  const id = 3149972161; // reuse the real uid for parity
  db.prepare(`INSERT INTO users (id,email,username,password_hash,is_active,status,registration_time,last_login_at)
              VALUES (?,?,?,?,?,?,?,?)`)
    .run(id, email, email.split('@')[0], bcrypt.hashSync(password, 10), 0, 0, fmt, now);
  console.log('Created', email, 'id', id, 'password', password);
}
