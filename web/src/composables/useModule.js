import { ref, computed } from 'vue';
import { Message, Modal } from '@arco-design/web-vue';
import * as api from '../api';
import { useAppStore } from '../store/app';
import { sortModuleRows } from '../utils/sortRows';

// shared plumbing for a module list page: load rows, row selection,
// note/favourite overlay, and a simulated batch-action runner with a progress feel.
// opts.liveLoad — async fn returning real rows via the extension (live mode).
export function useModule(moduleName, moduleId, opts = {}) {
  const appStore = useAppStore();
  const loading = ref(false);
  const rows = ref([]);
  const keyword = ref('');
  const selectedKeys = ref([]);
  const running = ref(false);
  const progress = ref({ done: 0, total: 0, results: [] });
  const source = ref('mock'); // where the current rows came from

  async function load(params = '') {
    loading.value = true;
    try {
      if (appStore.isLive && opts.liveLoad) {
        const live = await opts.liveLoad();
        // same ordering everywhere: 主体/广告账户 -> 投放中优先 -> 时间倒序
        if (live && live.ok) { rows.value = sortModuleRows(live.rows); source.value = 'live'; return; }
        // live failed -> surface why, then fall back to mock so the page still works
        if (live && live.info) Message.warning('实时获取失败：' + live.info + '（已回退演示数据）');
      }
      const r = await api.moduleList(moduleName, params);
      if (r.status === 1) rows.value = sortModuleRows(Array.isArray(r.data) ? r.data : (r.data.received || r.data || []));
      source.value = 'mock';
    } finally { loading.value = false; }
  }

  const filtered = computed(() => {
    const k = keyword.value.trim().toLowerCase();
    if (!k) return rows.value;
    return rows.value.filter((r) =>
      JSON.stringify(r).toLowerCase().includes(k)
    );
  });

  const selectedRows = computed(() => rows.value.filter((r) => selectedKeys.value.includes(r.id)));

  async function saveNote(row, note) {
    await api.setNote({ module_id: moduleId, obj_id: row.id, note });
    row.note = note;
    Message.success('备注已保存');
  }

  async function toggleFav(row) {
    const fav = row.favourite ? 0 : 1;
    await api.toggleFav({ module_id: moduleId, obj_id: row.id, favourite: fav });
    row.favourite = fav;
    Message.success(fav ? '已收藏' : '已取消收藏');
  }

  // simulate a batch action across selected rows with per-row success/failure
  async function runAction(label, targets) {
    if (!targets.length) { Message.warning('请先选择对象'); return; }
    running.value = true;
    progress.value = { done: 0, total: targets.length, results: [] };
    try {
      const r = await api.moduleAction({ action: label, targets: targets.map((t) => ({ id: t.id, name: t.name || t.account || t.fbid })) });
      const results = r.data || [];
      // reveal progressively for a realistic feel
      for (let i = 0; i < results.length; i++) {
        progress.value.done = i + 1;
        progress.value.results.push(results[i]);
        await new Promise((res) => setTimeout(res, 120));
      }
      const okc = results.filter((x) => x.status === 1).length;
      Message.success(`${label}：成功 ${okc} / ${results.length}`);
      return results;
    } finally { running.value = false; }
  }

  function confirmAction(label, targets, onConfirm) {
    if (!targets.length) return Message.warning('请先选择对象');
    Modal.confirm({
      title: `确认执行「${label}」？`,
      content: `将对选中的 ${targets.length} 个对象执行操作。`,
      onOk: onConfirm,
    });
  }

  return {
    loading, rows, keyword, selectedKeys, selectedRows, filtered, source,
    running, progress, load, saveNote, toggleFav, runAction, confirmAction,
  };
}
