// Client for the fbspider browser extension. Speaks the same window.postMessage
// protocol the extension's content-bridge relays to its background worker.
// When the extension is installed, these calls drive the user's real Facebook
// session; otherwise the app falls back to the mock backend.

const TAG = '__FBSPIDER_BRIDGE__';
let ready = false;
const pending = new Map();

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  const msg = event.data;
  if (!msg || msg[TAG] !== true) return;
  if (msg.type === 'BRIDGE_READY') { ready = true; return; }
  if (msg.__fromExt && msg.uniqueRequestId && pending.has(msg.uniqueRequestId)) {
    const { resolve, timer } = pending.get(msg.uniqueRequestId);
    clearTimeout(timer);
    pending.delete(msg.uniqueRequestId);
    resolve(msg.response);
  }
});

function rpc(type, extra = {}, timeout = 30000) {
  return new Promise((resolve) => {
    const uniqueRequestId = Date.now().toString() + '_' + Math.random().toString(36).slice(2, 11);
    const timer = setTimeout(() => {
      if (pending.has(uniqueRequestId)) { pending.delete(uniqueRequestId); resolve({ success: false, error: 'TIMEOUT', info: '插件无响应（未安装或未刷新会话）' }); }
    }, timeout);
    pending.set(uniqueRequestId, { resolve, timer });
    window.postMessage({ [TAG]: true, type, uniqueRequestId, ...extra }, window.location.origin);
  });
}

// Detect the extension. Resolves quickly; caches the result.
let installedCache = null;
export async function isExtensionInstalled() {
  if (installedCache !== null) return installedCache;
  const r = await rpc('PING', {}, 1500);
  installedCache = !!(r && r.success && r.installed);
  return installedCache;
}

export async function pingSession() {
  const r = await rpc('PING', {}, 1500);
  return r || { success: false };
}
export const refreshSession = () => rpc('REFRESH_SESSION', {}, 20000);
export const getSession = () => rpc('GET_SESSION', {}, 3000);

// low-level: run any scripted Facebook request through the user's session
export const executeScript = (data) => rpc('EXECUTE_SCRIPT', { data }, 40000);
export const executeCookie = (data) => rpc('EXECUTE_COOKIE', { data }, 5000);

// high-level stable Graph API ops implemented in the background worker
export const fbOp = (op, params = {}) => rpc('FB_OP', { op, params }, 40000);

export const getAdAccounts = () => fbOp('getAdAccounts');
export const getBusinesses = () => fbOp('getBusinesses');
export const getPages = () => fbOp('getPages');
export const getPixels = (businessId) => fbOp('getPixels', { businessId });
export const getInsights = (actId, preset) => fbOp('getInsights', { actId, preset });
export const renameAdAccount = (actId, name) => fbOp('renameAdAccount', { actId, name });

// These sweep several endpoints, so they get a longer ceiling than the 40s default.
export const getAllPixels = (params = {}) => rpc('FB_OP', { op: 'getAllPixels', params }, 180000);
export const getAdPosts = (params = {}) => rpc('FB_OP', { op: 'getAdPosts', params }, 180000);
export const getAdAccountsWithInsights = (preset) => rpc('FB_OP', { op: 'getAdAccountsWithInsights', params: { preset } }, 90000);

export function bridgeReady() { return ready; }
