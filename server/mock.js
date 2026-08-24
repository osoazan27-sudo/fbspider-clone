// Deterministic mock generators for the Facebook-facing data that the real
// fbspider scrapes via its browser plugin. Here it's synthesised server-side so
// every module page renders realistic rows without touching Facebook.

function seededRand(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

const CURRENCIES = ['USD', 'HKD', 'EUR', 'GBP', 'VND', 'THB'];
const TIMEZONES = ['America/Los_Angeles', 'Asia/Hong_Kong', 'Asia/Shanghai', 'Asia/Bangkok', 'Europe/London'];
const ROLES = ['管理员', '广告主', '分析员'];
const COUNTRIES = ['US', 'HK', 'SG', 'VN', 'TH', 'GB'];
const PAY = ['信用卡', 'PayPal', '预付费'];

function pad(n, len = 15) { return String(n).padStart(len, '0'); }

function genAdAccounts(uid, n = 12) {
  const rnd = seededRand(uid * 7 + 1001);
  const out = [];
  for (let i = 0; i < n; i++) {
    const spend = Math.floor(rnd() * 50000) / 100;
    const cap = [0, 250, 1500, 5000][Math.floor(rnd() * 4)];
    const cur = CURRENCIES[Math.floor(rnd() * CURRENCIES.length)];
    out.push({
      id: 'act_' + pad(100000000000000 + Math.floor(rnd() * 8e13)),
      account_id: pad(100000000000000 + Math.floor(rnd() * 8e13)),
      name: 'Ad Account ' + (i + 1),
      status: rnd() > 0.2 ? 1 : 2,                     // 1 active, 2 disabled
      account_status_label: rnd() > 0.2 ? '活跃' : '已停用',
      account_type: rnd() > 0.5 ? '后付费' : '预付费',
      amount_spent: spend.toFixed(2),
      balance: (Math.floor(rnd() * 20000) / 100).toFixed(2),
      spend_cap: cap ? cap.toFixed(2) : '不限额',
      spend_used: spend.toFixed(2),
      threshold: [25, 50, 250, 500][Math.floor(rnd() * 4)],
      daily_limit: [0, 50, 250, 1500][Math.floor(rnd() * 4)] || '不限额',
      bill_amount: (Math.floor(rnd() * 5000) / 100).toFixed(2),
      currency: cur,
      owner_role: ROLES[Math.floor(rnd() * ROLES.length)],
      pay_method: PAY[Math.floor(rnd() * PAY.length)],
      bill_period: '月结',
      disable_reason: rnd() > 0.85 ? '违反广告政策' : '',
      timezone: TIMEZONES[Math.floor(rnd() * TIMEZONES.length)],
      created_time: '2025-0' + (1 + Math.floor(rnd() * 8)) + '-' + (10 + Math.floor(rnd() * 18)),
      origin_id: pad(100000000000000 + Math.floor(rnd() * 8e13)),
      business_id: pad(100000000000 + Math.floor(rnd() * 8e11), 12),
      business_name: 'Business ' + (1 + Math.floor(rnd() * 20)),
      country: COUNTRIES[Math.floor(rnd() * COUNTRIES.length)],
      admins: 1 + Math.floor(rnd() * 4),
      hidden_admins: Math.floor(rnd() * 2),
      push_status: ['未推送', '已推送', '待确认'][Math.floor(rnd() * 3)],
    });
  }
  return out;
}

function genBMs(uid, n = 8) {
  const rnd = seededRand(uid * 13 + 2002);
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      id: pad(100000000000 + Math.floor(rnd() * 8e11), 12),
      name: 'Business Manager ' + (i + 1),
      status: rnd() > 0.2 ? 1 : 2,
      bm_type: rnd() > 0.5 ? '企业' : '个人',
      owner_role: ROLES[Math.floor(rnd() * ROLES.length)],
      daily_limit: [0, 1500, 5000][Math.floor(rnd() * 3)] || '不限额',
      verify_status: rnd() > 0.4 ? '已认证' : '未认证',
      created_time: '2025-0' + (1 + Math.floor(rnd() * 8)) + '-' + (10 + Math.floor(rnd() * 18)),
      admins: 1 + Math.floor(rnd() * 5),
      hidden_admins: Math.floor(rnd() * 3),
      quality: ['正常', '受限', '优质'][Math.floor(rnd() * 3)],
      partners: Math.floor(rnd() * 4),
      ad_accounts: Math.floor(rnd() * 10),
      push_status: ['未推送', '已推送', '待确认'][Math.floor(rnd() * 3)],
    });
  }
  return out;
}

function genPages(uid, n = 10) {
  const rnd = seededRand(uid * 17 + 3003);
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      id: pad(100000000000000 + Math.floor(rnd() * 8e13)),
      name: 'Page ' + (i + 1),
      status: rnd() > 0.2 ? 1 : 2,
      page_status_label: rnd() > 0.2 ? '正常' : '停用',
      create_channel: rnd() > 0.5 ? '个人公共主页' : 'BM公共主页',
      created_time: '2025-0' + (1 + Math.floor(rnd() * 8)) + '-' + (10 + Math.floor(rnd() * 18)),
      appeal_time: rnd() > 0.8 ? '2025-06-15' : '',
      publish_status: rnd() > 0.3 ? '已发布' : '未发布',
      allow_comment: rnd() > 0.3 ? '允许' : '不允许',
      hide_profanity: rnd() > 0.5 ? '隐藏' : '不隐藏',
      page_verify: rnd() > 0.7 ? '是' : '否',
      push_status: ['未推送', '已推送', '待确认'][Math.floor(rnd() * 3)],
    });
  }
  return out;
}

function genPixels(uid, n = 9) {
  const rnd = seededRand(uid * 19 + 4004);
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      id: pad(100000000000000 + Math.floor(rnd() * 8e13)),
      name: 'Pixel ' + (i + 1),
      business_id: pad(100000000000 + Math.floor(rnd() * 8e11), 12),
      business_name: 'Business ' + (1 + Math.floor(rnd() * 20)),
      owner: 'Business ' + (1 + Math.floor(rnd() * 20)),
      role: ROLES[Math.floor(rnd() * ROLES.length)],
      is_active: rnd() > 0.3 ? 1 : 0,
      active_label: rnd() > 0.3 ? '活跃' : '不活跃',
      last_active: '2025-08-' + (10 + Math.floor(rnd() * 18)),
      share_status: rnd() > 0.5 ? '已分享' : '未分享',
      type: rnd() > 0.5 ? '事件数据集' : '传统 Pixel',
    });
  }
  return out;
}

function genComments(uid, n = 14) {
  const rnd = seededRand(uid * 23 + 5005);
  const out = [];
  const states = ['监控中', '未监控', '监控暂停'];
  for (let i = 0; i < n; i++) {
    out.push({
      id: pad(100000000000000 + Math.floor(rnd() * 8e13)),
      post_id: pad(100000000000000 + Math.floor(rnd() * 8e13)),
      title: '广告贴标题 ' + (i + 1),
      switch: rnd() > 0.3 ? 1 : 0,
      status: states[Math.floor(rnd() * states.length)],
      manage_account: 'FB User ' + (1 + Math.floor(rnd() * 5)),
      page_name: 'Page ' + (1 + Math.floor(rnd() * 10)),
      page_type: rnd() > 0.5 ? '公共主页' : '个人主页',
      created_time: '2025-08-' + (10 + Math.floor(rnd() * 18)),
      auto_block: rnd() > 0.5 ? '开' : '关',
    });
  }
  return out;
}

function genFriendRequests(uid, n = 8) {
  const rnd = seededRand(uid * 29 + 6006);
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      id: pad(100000000000000 + Math.floor(rnd() * 8e13)),
      name: 'User ' + (i + 1),
      apply_time: '2025-08-' + (10 + Math.floor(rnd() * 18)),
      mutual_friends: Math.floor(rnd() * 30),
      status: ['待处理', '已同意', '已拒绝'][Math.floor(rnd() * 3)],
    });
  }
  return out;
}

function genDataManager(uid, kind = 'acc', n = 10) {
  if (kind === 'bm') return genBMs(uid, n);
  if (kind === 'page') return genPages(uid, n);
  return genAdAccounts(uid, n);
}

function genLibraryVideos(uid, keyword = '', n = 12) {
  const rnd = seededRand((uid + (keyword.length * 31)) * 3 + 7007);
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      id: pad(100000000000000 + Math.floor(rnd() * 8e13)),
      page_name: (keyword || 'Advertiser') + ' ' + (i + 1),
      ad_text: '这是一条广告文案示例 ' + (i + 1),
      cta: ['了解详情', '立即购买', '注册', '下载'][Math.floor(rnd() * 4)],
      start_date: '2025-08-' + (1 + Math.floor(rnd() * 27)),
      platforms: ['Facebook', 'Instagram', 'Audience Network'].slice(0, 1 + Math.floor(rnd() * 3)),
      thumbnail: 'https://picsum.photos/seed/fb' + i + '/320/180',
      video_url: 'https://example.com/mock-video-' + i + '.mp4',
    });
  }
  return out;
}

module.exports = {
  genAdAccounts, genBMs, genPages, genPixels, genComments,
  genFriendRequests, genDataManager, genLibraryVideos,
};
