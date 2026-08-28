// Real Facebook write operations, keyed by module + the button's label.
//
// Anything registered here actually hits Graph API through the extension when
// 实时 mode is on. Anything NOT registered is refused in 实时 mode rather than
// faked — a simulated "成功" for an operation that never touched Facebook is
// worse than an honest "not implemented".
import { fbOp } from './fbBridge';

// Normalise a bridge reply into the {status,message} row ActionProgress renders.
function toResult(r, okMsg) {
  const ok = !!(r && r.success);
  return {
    status: ok ? 1 : 0,
    message: ok ? (r.info || okMsg || '成功') : ((r && (r.info || r.error)) || '失败'),
  };
}

export const ACTIONS = {
  bm: {
    '移出BM': {
      danger: true,
      confirm: '将把你自己从选中的 BM 中移除。移除后需要对方重新邀请才能再次加入。',
      run: (row) => fbOp('removeSelfFromBusiness', { businessId: row.id }).then((r) => toResult(r, '已移出 BM')),
    },
  },

  pixel: {
    'BM间分享': {
      // ctx.targetBm comes from the dialog
      requires: (ctx) => (ctx && ctx.targetBm ? null : '请输入目标 BM ID'),
      run: (row, ctx) => fbOp('sharePixelToBusiness', { pixelId: row.id, businessId: ctx.targetBm })
        .then((r) => toResult(r, '已分享给 BM ' + ctx.targetBm)),
    },
    '取消BM分享': {
      danger: true,
      requires: (ctx) => (ctx && ctx.targetBm ? null : '请输入目标 BM ID'),
      run: (row, ctx) => fbOp('unsharePixelFromBusiness', { pixelId: row.id, businessId: ctx.targetBm })
        .then((r) => toResult(r, '已取消分享')),
    },
    '分配给账号': {
      requires: (ctx) => (ctx && ctx.accountId ? null : '请输入广告账号 ID'),
      run: (row, ctx) => fbOp('sharePixelToAdAccount', { pixelId: row.id, accountId: ctx.accountId })
        .then((r) => toResult(r, '已分配给账号 ' + ctx.accountId)),
    },
    '取消账号分配': {
      danger: true,
      requires: (ctx) => (ctx && ctx.accountId ? null : '请输入广告账号 ID'),
      run: (row, ctx) => fbOp('unsharePixelFromAdAccount', { pixelId: row.id, accountId: ctx.accountId })
        .then((r) => toResult(r, '已取消分配')),
    },
  },

  adaccount: {
    '账号重命名': {
      requires: (ctx) => (ctx && ctx.name ? null : '请输入新的账号名称'),
      run: (row, ctx) => fbOp('renameAdAccount', { actId: row.account_id || row.id, name: ctx.name })
        .then((r) => toResult(r, '已重命名')),
    },
  },
};

export function getAction(moduleName, label) {
  return (ACTIONS[moduleName] && ACTIONS[moduleName][label]) || null;
}
export function hasRealAction(moduleName, label) {
  return !!getAction(moduleName, label);
}

// Run a real action across the selected rows, one at a time so Facebook isn't
// hammered and each row gets its own pass/fail line.
export async function runRealAction(moduleName, label, targets, ctx = {}, onProgress) {
  const action = getAction(moduleName, label);
  if (!action) throw new Error('NO_ACTION');
  const missing = action.requires ? action.requires(ctx) : null;
  if (missing) return { error: missing };

  const results = [];
  for (const t of targets) {
    let res;
    try {
      res = await action.run(t, ctx);
    } catch (e) {
      res = { status: 0, message: String((e && e.message) || e).slice(0, 160) };
    }
    const row = {
      obj_id: String(t.id ?? ''),
      name: t.name || t.account || t.fbid || String(t.id ?? ''),
      ...res,
    };
    results.push(row);
    if (onProgress) onProgress(row, results.length, targets.length);
  }
  return { results };
}
