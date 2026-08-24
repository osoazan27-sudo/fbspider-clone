const jwt = require('jsonwebtoken');

const SECRET = process.env.FBSPIDER_JWT_SECRET || 'fbspider-clone-dev-secret-change-me';
const TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function sign(uid) {
  const now = Math.floor(Date.now() / 1000);
  const token = jwt.sign(
    { sv: 1, iss: 'fbspider-auth', sub: String(uid), iat: now, exp: now + TTL_SECONDS },
    SECRET
  );
  return 'Bearer ' + token;
}

function verify(authHeader) {
  if (!authHeader) return null;
  const raw = authHeader.replace(/^Bearer\s+/i, '');
  try {
    const payload = jwt.verify(raw, SECRET);
    return payload.sub;
  } catch {
    return null;
  }
}

// Express middleware: requires a valid Bearer token, sets req.uid
function requireAuth(req, res, next) {
  const uid = verify(req.headers.authorization);
  if (!uid) return res.json({ status: -1, data: [], info: 'token authentication failed' });
  req.uid = Number(uid);
  next();
}

module.exports = { sign, verify, requireAuth, SECRET };
