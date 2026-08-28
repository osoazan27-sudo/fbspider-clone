// One ordering for every module list, so the same rows always land in the same
// place no matter which page you're on:
//   1. group rows of the same 主体 (business / BM) or ad account together
//   2. inside a group, currently-delivering rows first, stopped ones after
//   3. then newest first
//
// Module rows come from different sources (Graph API, demo generator) and don't
// share field names, so each key is resolved from a list of candidates.

// The owning entity: business/BM first, else the ad account, else the page.
export function groupKeyOf(r) {
  if (!r || typeof r !== 'object') return '';
  const v = r.business_name || r.business_id
    || r.account_name || r.manage_account || r.account_id
    || r.owner || r.page_name || r.page_id || '';
  return String(v).trim().toLowerCase();
}

// Is this row actively delivering / live right now?
export function isRunning(r) {
  if (!r || typeof r !== 'object') return false;
  // explicit boolean-ish flags win
  if (r.is_active != null && r.is_active !== '') return !!Number(r.is_active) || r.is_active === true;
  if (r.delivery_status) return String(r.delivery_status).toUpperCase() === 'ACTIVE';
  if (typeof r.status === 'number') return r.status === 1;
  const text = [r.status, r.account_status_label, r.page_status_label, r.active_label, r.publish_status]
    .filter((x) => typeof x === 'string').join(' ');
  if (!text) return false;
  // "未投放"/"未运行"/"不活跃" must not match the positive words inside them
  if (/未投放|未运行|不活跃|已停用|已关闭|停用|暂停|未发布|未监控|已拒绝/.test(text)) return false;
  return /投放中|投放|运行|活跃|监控中|已发布|正常|生效|ACTIVE/i.test(text);
}

// Newest first. Unparseable/missing timestamps sort last.
export function timeOf(r) {
  if (!r || typeof r !== 'object') return -Infinity;
  const raw = r.created_time || r.create_time || r.last_active || r.last_fired_time
    || r.apply_time || r.start_date || r.start_time || '';
  if (!raw) return -Infinity;
  if (typeof raw === 'number') return raw > 1e12 ? raw : raw * 1000;   // sec or ms epoch
  const t = Date.parse(raw);
  return Number.isNaN(t) ? -Infinity : t;
}

// Natural ordering so "Business 2" comes before "Business 12" rather than after.
const collator = new Intl.Collator('zh-Hans-CN', { numeric: true, sensitivity: 'base' });

// Stable sort (Array#sort is stable in modern JS) on a copy.
export function sortModuleRows(rows) {
  if (!Array.isArray(rows)) return rows;
  return [...rows].sort((a, b) => {
    const ga = groupKeyOf(a), gb = groupKeyOf(b);
    if (ga !== gb) {
      // rows with no owning entity go last rather than sorting as ""
      if (!ga) return 1;
      if (!gb) return -1;
      return collator.compare(ga, gb);
    }
    const ra = isRunning(a) ? 0 : 1, rb = isRunning(b) ? 0 : 1;
    if (ra !== rb) return ra - rb;
    return timeOf(b) - timeOf(a);
  });
}
