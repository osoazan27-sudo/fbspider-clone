// Real Facebook operations, keyed by module + the button's label.
//
// Anything registered here actually hits Graph API through the extension when
// 实时 mode is on. Anything NOT registered is refused in 实时 mode rather than
// faked — a simulated "成功" for an operation that never touched Facebook is
// worse than an honest "not implemented".
//
// `fields` declares the inputs the operation needs; ActionDialog renders them.
import { fbOp } from './fbBridge';

function toResult(r, okMsg) {
  const ok = !!(r && r.success);
  return {
    status: ok ? 1 : 0,
    message: ok ? (r.info || okMsg || '成功') : ((r && (r.info || r.error)) || '失败'),
  };
}

// ad-account permission levels, as Graph API names them
const ACCOUNT_TASKS = [
  { value: 'ANALYST', label: '分析员（只读）' },
  { value: 'ADVERTISER', label: '广告主（可投放）' },
  { value: 'MANAGE', label: '管理员（完全控制）' },
];
const uidField = (label = 'Facebook 用户 UID') => ({
  key: 'uid', label, placeholder: '请输入对方的 Facebook 数字 UID',
  hint: '必须是数字 UID，不是用户名或邮箱',
});

export const ACTIONS = {
  adaccount: {
    '账号重命名': {
      title: '重命名广告账号',
      fields: [{ key: 'name', label: '新名称', placeholder: '请输入新的账号名称' }],
      run: (row, ctx) => fbOp('renameAdAccount', { actId: row.account_id || row.id, name: ctx.name })
        .then((r) => toResult(r, '已重命名')),
    },
    '增加授权': {
      title: '给广告账号增加授权',
      fields: [uidField(), { key: 'tasks', label: '权限', type: 'select', options: ACCOUNT_TASKS, default: 'ANALYST' }],
      run: (row, ctx) => fbOp('addAdAccountUser', { actId: row.account_id || row.id, uid: ctx.uid, tasks: ctx.tasks })
        .then((r) => toResult(r, '已授权')),
    },
    '删除授权': {
      danger: true,
      title: '移除广告账号授权',
      confirm: '将把该用户从选中的广告账号中移除。',
      fields: [uidField('要移除的用户 UID')],
      run: (row, ctx) => fbOp('removeAdAccountUser', { actId: row.account_id || row.id, uid: ctx.uid })
        .then((r) => toResult(r, '已移除授权')),
    },
    '设置限额': {
      title: '设置账户消费限额',
      fields: [{ key: 'amount', label: '限额（账户币种）', type: 'number', min: 0, default: 100, placeholder: '例如 500' }],
      run: (row, ctx) => fbOp('setAdAccountSpendCap', { actId: row.account_id || row.id, amount: ctx.amount })
        .then((r) => toResult(r, '限额已设置')),
    },
    '重置限额': {
      danger: true,
      title: '重置消费限额',
      confirm: '将清除选中账户的消费限额（设为不限额）。',
      fields: [],
      run: (row) => fbOp('setAdAccountSpendCap', { actId: row.account_id || row.id, amount: 0 })
        .then((r) => toResult(r, '已重置限额')),
    },
    '添加到BM': {
      title: '把广告账号添加到 BM',
      fields: [{ key: 'businessId', label: '目标 BM ID', placeholder: '请输入 BM ID' }],
      run: (row, ctx) => fbOp('addAdAccountToBusiness', { businessId: ctx.businessId, actId: row.account_id || row.id })
        .then((r) => toResult(r, '已添加到 BM')),
    },
  },

  bm: {
    '移出BM': {
      danger: true,
      title: '移出 BM',
      confirm: '将把你自己从选中的 BM 中移除。移除后需要对方重新邀请才能再次加入。',
      fields: [],
      run: (row) => fbOp('removeSelfFromBusiness', { businessId: row.id }).then((r) => toResult(r, '已移出 BM')),
    },
    '邀请人员': {
      title: '邀请人员加入 BM',
      fields: [
        { key: 'email', label: '邮箱', placeholder: '请输入对方邮箱' },
        { key: 'role', label: '角色', type: 'select', default: 'EMPLOYEE', options: [
          { value: 'EMPLOYEE', label: '职员' },
          { value: 'ADMIN', label: '管理员（完全控制）' },
        ] },
      ],
      run: (row, ctx) => fbOp('inviteBusinessUser', { businessId: row.id, email: ctx.email, role: ctx.role })
        .then((r) => toResult(r, '邀请已发送')),
    },
  },

  pixel: {
    'BM间分享': {
      title: 'BM 之间分享像素',
      fields: [{ key: 'targetBm', label: '目标 BM ID', placeholder: '输入你要分享给的 BM ID' }],
      run: (row, ctx) => fbOp('sharePixelToBusiness', { pixelId: row.id, businessId: ctx.targetBm })
        .then((r) => toResult(r, '已分享')),
    },
    '删除合作伙伴': {
      danger: true,
      title: '取消 BM 分享',
      confirm: '将把像素从该 BM 收回。',
      fields: [{ key: 'targetBm', label: '目标 BM ID', placeholder: '输入要取消分享的 BM ID' }],
      run: (row, ctx) => fbOp('unsharePixelFromBusiness', { pixelId: row.id, businessId: ctx.targetBm })
        .then((r) => toResult(r, '已取消分享')),
    },
    '分配给账号': {
      title: '分配像素给广告账号',
      fields: [{ key: 'accountId', label: '广告账号 ID', placeholder: '可带或不带 act_ 前缀' }],
      run: (row, ctx) => fbOp('sharePixelToAdAccount', { pixelId: row.id, accountId: ctx.accountId })
        .then((r) => toResult(r, '已分配')),
    },
    '删除广告账号': {
      danger: true,
      title: '取消像素的账号分配',
      confirm: '将把像素从该广告账号收回。',
      fields: [{ key: 'accountId', label: '广告账号 ID', placeholder: '可带或不带 act_ 前缀' }],
      run: (row, ctx) => fbOp('unsharePixelFromAdAccount', { pixelId: row.id, accountId: ctx.accountId })
        .then((r) => toResult(r, '已取消分配')),
    },
    '分配给人员': {
      title: '把像素分配给人员',
      fields: [uidField(), { key: 'tasks', label: '权限', type: 'select', default: 'ANALYZE', options: [
        { value: 'ANALYZE', label: '查看数据' },
        { value: 'EDIT', label: '编辑' },
      ] }],
      run: (row, ctx) => fbOp('addPixelUser', { pixelId: row.id, uid: ctx.uid, tasks: ctx.tasks })
        .then((r) => toResult(r, '已分配')),
    },
    '删除管理员': {
      danger: true,
      title: '移除像素管理员',
      confirm: '将把该用户从选中的像素中移除。',
      fields: [uidField('要移除的用户 UID')],
      run: (row, ctx) => fbOp('removePixelUser', { pixelId: row.id, uid: ctx.uid })
        .then((r) => toResult(r, '已移除')),
    },
    '分享查询': {
      title: '查询像素分享情况',
      fields: [],
      run: (row) => fbOp('getPixelShares', { pixelId: row.id }).then((r) => {
        if (!r || !r.success) return toResult(r);
        const bm = (r.businesses || []).map((b) => b.name || b.id);
        const ac = (r.accounts || []).map((a) => a.name || a.account_id);
        return { status: 1, message: `BM：${bm.join('、') || '无'}；账号：${ac.join('、') || '无'}` };
      }),
    },
  },

  page: {
    '修改主页名称': {
      title: '修改主页名称',
      fields: [{ key: 'name', label: '新名称', placeholder: '请输入新的主页名称' }],
      run: (row, ctx) => fbOp('renamePage', { pageId: row.id, name: ctx.name }).then((r) => toResult(r, '已改名')),
    },
    '停用主页': {
      danger: true,
      title: '停用主页',
      confirm: '将把主页设为未发布状态（访客无法看到）。',
      fields: [],
      run: (row) => fbOp('setPagePublished', { pageId: row.id, published: false }).then((r) => toResult(r, '已停用')),
    },
    '重新启用主页': {
      title: '重新发布主页',
      fields: [],
      run: (row) => fbOp('setPagePublished', { pageId: row.id, published: true }).then((r) => toResult(r, '已重新启用')),
    },
    '屏蔽词设置': {
      title: '设置主页屏蔽词',
      fields: [{ key: 'words', label: '屏蔽词', type: 'textarea', placeholder: '多个词用英文逗号分隔',
        hint: '会覆盖主页现有的屏蔽词列表' }],
      run: (row, ctx) => fbOp('setPageBannedWords', { pageId: row.id, words: ctx.words })
        .then((r) => toResult(r, '屏蔽词已更新')),
    },
    '黑名单设置': {
      danger: true,
      title: '把用户加入主页黑名单',
      fields: [{ key: 'user', label: '用户 UID 或主页名', placeholder: '请输入要拉黑的用户 UID' }],
      run: (row, ctx) => fbOp('blockPageUser', { pageId: row.id, user: ctx.user })
        .then((r) => toResult(r, '已加入黑名单')),
    },
  },
};

// Operations Facebook's public Graph API simply does not expose. Listing them
// here lets the UI explain WHY instead of a bare "not implemented".
export const UNSUPPORTED = {
  'bm/隐藏管理员': 'Facebook 没有这个概念，原站是自己在界面上隐藏，不是 FB 的功能',
  'bm/BM推送': '需要 FB 私有 GraphQL（doc_id），官方 API 无此接口',
  'adaccount/隐藏管理员': 'Facebook 没有这个概念',
  'adaccount/账号推送': '需要 FB 私有 GraphQL（doc_id），官方 API 无此接口',
  'adaccount/BM合作伙伴': '需要 FB 私有 GraphQL（doc_id）',
  'adaccount/更新公司信息': 'Graph API 不允许修改广告账户的公司主体信息',
  'adaccount/支付记录': '需要账单权限，官方 API 未开放给普通会话',
  'page/主页推送': '需要 FB 私有 GraphQL（doc_id）',
  'page/授权': '主页授权要走 BM 资产分配流程，需先把主页加入 BM',
  'pixel/批量创建': '需要指定 BM，且 FB 对新建像素数量有限制（可用「分享查询」确认现有像素）',
};

export function getAction(moduleName, label) {
  return (ACTIONS[moduleName] && ACTIONS[moduleName][label]) || null;
}
export function hasRealAction(moduleName, label) {
  return !!getAction(moduleName, label);
}
export function whyUnsupported(moduleName, label) {
  return UNSUPPORTED[`${moduleName}/${label}`] || null;
}
// Does this action need the user to fill something in first?
export function needsInput(moduleName, label) {
  const a = getAction(moduleName, label);
  return !!(a && ((a.fields && a.fields.length) || a.confirm));
}

// Run a real action across the selected rows, one at a time so Facebook isn't
// hammered and each row gets its own pass/fail line.
export async function runRealAction(moduleName, label, targets, ctx = {}, onProgress) {
  const action = getAction(moduleName, label);
  if (!action) throw new Error('NO_ACTION');
  for (const f of action.fields || []) {
    if (f.required === false) continue;
    const v = ctx[f.key];
    if (v === '' || v == null) return { error: '请填写' + f.label };
  }

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
