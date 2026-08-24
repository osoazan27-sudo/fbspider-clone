// Browser port of server/mock.js — deterministic synthetic Facebook data used
// by the standalone (backend-free) build's demo mode. Live mode never uses this.

function seeded(seed) {
  let s = seed % 2147483647; if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
const CUR = ['USD', 'HKD', 'EUR', 'GBP', 'VND', 'THB'];
const TZ = ['America/Los_Angeles', 'Asia/Hong_Kong', 'Asia/Shanghai', 'Asia/Bangkok', 'Europe/London'];
const ROLES = ['管理员', '广告主', '分析员'];
const CO = ['US', 'HK', 'SG', 'VN', 'TH', 'GB'];
const PAY = ['信用卡', 'PayPal', '预付费'];
const pad = (n, l = 15) => String(n).padStart(l, '0');

export function genAdAccounts(uid, n = 12) {
  const r = seeded(uid * 7 + 1001); const out = [];
  for (let i = 0; i < n; i++) {
    const spend = Math.floor(r() * 50000) / 100;
    out.push({
      id: 'act_' + pad(1e14 + Math.floor(r() * 8e13)), account_id: pad(1e14 + Math.floor(r() * 8e13)),
      name: 'Ad Account ' + (i + 1), status: r() > 0.2 ? 1 : 2,
      account_status_label: r() > 0.2 ? '活跃' : '已停用', account_type: r() > 0.5 ? '后付费' : '预付费',
      amount_spent: spend.toFixed(2), balance: (Math.floor(r() * 20000) / 100).toFixed(2),
      spend_cap: [0, 250, 1500, 5000][Math.floor(r() * 4)] ? '2000.00' : '不限额', spend_used: spend.toFixed(2),
      threshold: [25, 50, 250, 500][Math.floor(r() * 4)], daily_limit: [0, 50, 250, 1500][Math.floor(r() * 4)] || '不限额',
      bill_amount: (Math.floor(r() * 5000) / 100).toFixed(2), currency: CUR[Math.floor(r() * CUR.length)],
      owner_role: ROLES[Math.floor(r() * ROLES.length)], pay_method: PAY[Math.floor(r() * PAY.length)],
      bill_period: '月结', disable_reason: r() > 0.85 ? '违反广告政策' : '', timezone: TZ[Math.floor(r() * TZ.length)],
      created_time: '2025-0' + (1 + Math.floor(r() * 8)) + '-' + (10 + Math.floor(r() * 18)),
      origin_id: pad(1e14 + Math.floor(r() * 8e13)), business_id: pad(1e11 + Math.floor(r() * 8e11), 12),
      business_name: 'Business ' + (1 + Math.floor(r() * 20)), country: CO[Math.floor(r() * CO.length)],
      admins: 1 + Math.floor(r() * 4), hidden_admins: Math.floor(r() * 2),
      push_status: ['未推送', '已推送', '待确认'][Math.floor(r() * 3)],
    });
  }
  return out;
}
export function genBMs(uid, n = 8) {
  const r = seeded(uid * 13 + 2002); const out = [];
  for (let i = 0; i < n; i++) out.push({
    id: pad(1e11 + Math.floor(r() * 8e11), 12), name: 'Business Manager ' + (i + 1), status: r() > 0.2 ? 1 : 2,
    bm_type: r() > 0.5 ? '企业' : '个人', owner_role: ROLES[Math.floor(r() * ROLES.length)],
    daily_limit: [0, 1500, 5000][Math.floor(r() * 3)] || '不限额', verify_status: r() > 0.4 ? '已认证' : '未认证',
    created_time: '2025-0' + (1 + Math.floor(r() * 8)) + '-' + (10 + Math.floor(r() * 18)),
    admins: 1 + Math.floor(r() * 5), hidden_admins: Math.floor(r() * 3), quality: ['正常', '受限', '优质'][Math.floor(r() * 3)],
    partners: Math.floor(r() * 4), ad_accounts: Math.floor(r() * 10), push_status: ['未推送', '已推送', '待确认'][Math.floor(r() * 3)],
  });
  return out;
}
export function genPages(uid, n = 10) {
  const r = seeded(uid * 17 + 3003); const out = [];
  for (let i = 0; i < n; i++) out.push({
    id: pad(1e14 + Math.floor(r() * 8e13)), name: 'Page ' + (i + 1), status: r() > 0.2 ? 1 : 2,
    page_status_label: r() > 0.2 ? '正常' : '停用', create_channel: r() > 0.5 ? '个人公共主页' : 'BM公共主页',
    created_time: '2025-0' + (1 + Math.floor(r() * 8)) + '-' + (10 + Math.floor(r() * 18)),
    appeal_time: r() > 0.8 ? '2025-06-15' : '', publish_status: r() > 0.3 ? '已发布' : '未发布',
    allow_comment: r() > 0.3 ? '允许' : '不允许', hide_profanity: r() > 0.5 ? '隐藏' : '不隐藏',
    page_verify: r() > 0.7 ? '是' : '否', push_status: ['未推送', '已推送', '待确认'][Math.floor(r() * 3)],
  });
  return out;
}
export function genPixels(uid, n = 9) {
  const r = seeded(uid * 19 + 4004); const out = [];
  for (let i = 0; i < n; i++) out.push({
    id: pad(1e14 + Math.floor(r() * 8e13)), name: 'Pixel ' + (i + 1), business_id: pad(1e11 + Math.floor(r() * 8e11), 12),
    business_name: 'Business ' + (1 + Math.floor(r() * 20)), owner: 'Business ' + (1 + Math.floor(r() * 20)),
    role: ROLES[Math.floor(r() * ROLES.length)], is_active: r() > 0.3 ? 1 : 0, active_label: r() > 0.3 ? '活跃' : '不活跃',
    last_active: '2025-08-' + (10 + Math.floor(r() * 18)), share_status: r() > 0.5 ? '已分享' : '未分享',
    type: r() > 0.5 ? '事件数据集' : '传统 Pixel',
  });
  return out;
}
export function genComments(uid, n = 14) {
  const r = seeded(uid * 23 + 5005); const out = []; const st = ['监控中', '未监控', '监控暂停'];
  for (let i = 0; i < n; i++) out.push({
    id: pad(1e14 + Math.floor(r() * 8e13)), post_id: pad(1e14 + Math.floor(r() * 8e13)), title: '广告贴标题 ' + (i + 1),
    switch: r() > 0.3 ? 1 : 0, status: st[Math.floor(r() * st.length)], manage_account: 'FB User ' + (1 + Math.floor(r() * 5)),
    page_name: 'Page ' + (1 + Math.floor(r() * 10)), page_type: r() > 0.5 ? '公共主页' : '个人主页',
    created_time: '2025-08-' + (10 + Math.floor(r() * 18)), auto_block: r() > 0.5 ? '开' : '关',
  });
  return out;
}
export function genFriends(uid, n = 8) {
  const r = seeded(uid * 29 + 6006); const out = [];
  for (let i = 0; i < n; i++) out.push({
    id: pad(1e14 + Math.floor(r() * 8e13)), name: 'User ' + (i + 1), apply_time: '2025-08-' + (10 + Math.floor(r() * 18)),
    mutual_friends: Math.floor(r() * 30), status: ['待处理', '已同意', '已拒绝'][Math.floor(r() * 3)],
  });
  return out;
}
export function genLibrary(uid, kw = '', n = 12) {
  const r = seeded((uid + kw.length * 31) * 3 + 7007); const out = [];
  for (let i = 0; i < n; i++) out.push({
    id: pad(1e14 + Math.floor(r() * 8e13)), page_name: (kw || 'Advertiser') + ' ' + (i + 1),
    ad_text: '这是一条广告文案示例 ' + (i + 1), cta: ['了解详情', '立即购买', '注册', '下载'][Math.floor(r() * 4)],
    start_date: '2025-08-' + (1 + Math.floor(r() * 27)), platforms: ['Facebook', 'Instagram', 'Audience Network'].slice(0, 1 + Math.floor(r() * 3)),
    thumbnail: 'https://picsum.photos/seed/fb' + i + '/320/180', video_url: 'https://example.com/mock-video-' + i + '.mp4',
  });
  return out;
}
export function genInterests(kw) {
  const types = ['人口统计', '兴趣', '行为']; const out = [];
  for (let i = 0; i < 18; i++) { const t = types[i % 3];
    out.push({ id: String(6e11 + i + kw.length * 100), keyword: kw + ' · ' + t + ' ' + (i + 1),
      category: t + ' > ' + ['购物', '科技', '旅游', '美妆', '游戏'][i % 5],
      audience: (Math.floor(Math.random() * 9e7) + 1e6).toLocaleString('en-US'),
      link: 'https://www.facebook.com/adsmanager/audiences', type: t }); }
  return out;
}
