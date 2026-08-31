import { ref, computed } from 'vue';
import { Message, Modal } from '@arco-design/web-vue';
import * as api from '../api';
import { useAppStore } from '../store/app';
import { sortModuleRows } from '../utils/sortRows';
import { hasRealAction, runRealAction, getAction, needsInput, whyUnsupported } from '../api/fbActions';

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

  // Run a batch action across the selected rows.
  // 实时 mode drives the user's real Facebook session; 演示 mode simulates.
  // In 实时 mode an action with no real implementation is refused, never faked.
  async function runAction(label, targets, ctx = {}) {
    if (!targets.length) { Message.warning('请先选择对象'); return; }

    // Reads may quietly fall back to demo data, but a WRITE must never silently
    // simulate while the UI says 实时 — that reads as "it worked" when nothing
    // touched Facebook.
    if (appStore.dataMode === 'live') {
      if (!appStore.extInstalled) {
        Message.error('当前是「实时」但没有检测到插件，操作未执行。请在 chrome://extensions 加载/刷新插件后重试。');
        return;
      }
      if (!hasRealAction(moduleName, label)) {
        const why = whyUnsupported(moduleName, label);
        Message.error(why
          ? `「${label}」无法接入真实接口：${why}`
          : `「${label}」还没有接入真实接口，实时模式下不会执行（切到「演示」可以看流程）`);
        return;
      }
      running.value = true;
      progress.value = { done: 0, total: targets.length, results: [] };
      try {
        const { error, results } = await runRealAction(moduleName, label, targets, ctx, (row, done) => {
          progress.value.done = done;
          progress.value.results.push(row);
        });
        if (error) { Message.warning(error); return; }
        const okc = results.filter((x) => x.status === 1).length;
        const msg = `${label}：成功 ${okc} / ${results.length}`;
        if (okc === results.length) Message.success(msg);
        else Message.error(msg + '（展开进度查看失败原因）');
        return results;
      } finally { running.value = false; }
    }

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
      Message.success(`${label}（演示）：成功 ${okc} / ${results.length}`);
      return results;
    } finally { running.value = false; }
  }

  // ---- generic parameter dialog ----
  // A view calls promptAction(label); if the operation declares inputs (or a
  // confirmation) we collect them first, then run. Keeps every button's wiring
  // in the registry instead of a bespoke modal per button.
  const dialog = ref({ visible: false, label: '', action: null, count: 0 });

  function promptAction(label, targets) {
    if (!targets.length) { Message.warning('请先选择对象'); return; }
    if (needsInput(moduleName, label)) {
      dialog.value = { visible: true, label, action: getAction(moduleName, label), count: targets.length };
      return;
    }
    return runAction(label, targets);
  }
  function submitDialog(ctx, targets) {
    const label = dialog.value.label;
    dialog.value.visible = false;
    return runAction(label, targets, ctx);
  }
  function closeDialog() { dialog.value.visible = false; }

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
    dialog, promptAction, submitDialog, closeDialog,
  };
}
