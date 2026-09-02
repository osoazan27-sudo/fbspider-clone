<template>
  <span>
    <a-button size="small" @click="open">私有接口录制</a-button>

    <a-modal v-model:visible="visible" title="录制私有接口（doc_id）" :footer="false" width="720px">
      <a-alert v-if="stale" type="error" style="margin-bottom:12px">
        检测到<b>旧版插件</b>（{{ version || '未知版本' }}，需要 ≥ 3.1.0）。录制功能在最新插件里。
        请在 chrome://extensions 重新加载最新的 <code>fbspider-extension.zip</code>，重载后重新打开本窗口。
      </a-alert>
      <a-alert v-else style="margin-bottom:12px">
        有些操作（如邀请 BM 成员）公开 Graph API 做不了，原站走的是私有 GraphQL。
        录一次你在 Facebook 上真实做的这个操作，插件在<b>本地</b>抓下它的 doc_id 和参数结构
        （不含 cookie，token 也会打码），之后就能用你的会话重放。
        <span v-if="version" style="color:var(--color-text-3)">（插件版本 {{ version }}）</span>
      </a-alert>

      <a-space style="margin-bottom:12px">
        <a-button :type="recording ? 'outline' : 'primary'" :status="recording ? 'danger' : 'normal'"
          :loading="busy" @click="toggle">
          {{ recording ? '■ 停止录制' : '● 开始录制' }}
        </a-button>
        <a-tag :color="recording ? 'red' : 'gray'">{{ recording ? '录制中' : '未录制' }}</a-tag>
        <a-button size="small" @click="refresh" :loading="loading">刷新列表</a-button>
        <a-button size="small" status="danger" @click="clear" v-if="recipes.length">清空</a-button>
      </a-space>

      <ol v-if="recording" style="font-size:13px; color:var(--color-text-2); line-height:1.9; margin:0 0 12px; padding-left:20px">
        <li>保持这个开关是「录制中」。</li>
        <li>切到<b>已登录 Facebook 的标签页</b>，打开商务设置 → 成员 → 添加人员，真实走一遍（可以填一个测试邮箱）。</li>
        <li>回到这里点「刷新列表」，应该能看到刚才那条请求。</li>
        <li>把它的内容复制发给我（已自动打码），我来接到「邀请人员」按钮上。</li>
      </ol>

      <a-empty v-if="!recipes.length" description="还没有录到请求。开始录制后在 Facebook 上做一次操作。" />
      <a-list v-else :data="recipes" size="small" :max-height="360">
        <template #item="{ item }">
          <a-list-item>
            <a-list-item-meta>
              <template #title>
                {{ item.friendly_name }}
                <a-tag size="small" color="arcoblue" style="margin-left:6px">doc_id {{ item.doc_id }}</a-tag>
              </template>
              <template #description>
                <div style="font-size:12px; color:var(--color-text-3)">路径 {{ item.path }}</div>
                <pre style="max-height:120px; overflow:auto; background:var(--color-fill-2); padding:6px 8px; border-radius:4px; font-size:12px; margin:6px 0 0">{{ pretty(item.variables) }}</pre>
              </template>
            </a-list-item-meta>
            <template #actions>
              <a-button size="mini" @click="copy(item)">复制</a-button>
            </template>
          </a-list-item>
        </template>
      </a-list>
      <div v-if="copied" style="margin-top:8px; color:#00b42a; font-size:13px">已复制到剪贴板，可直接粘贴发我。</div>
    </a-modal>
  </span>
</template>

<script setup>
import { ref } from 'vue';
import { Message } from '@arco-design/web-vue';
import { setRecording, getRecording, listRecipes, clearRecipes, isExtensionInstalled, pingSession } from '../api/fbBridge';

const visible = ref(false);
const recording = ref(false);
const busy = ref(false);
const loading = ref(false);
const recipes = ref([]);
const copied = ref(false);
const version = ref('');
const stale = ref(false);

function pretty(v) { try { return JSON.stringify(v, null, 2); } catch { return String(v); } }

async function open() {
  if (!(await isExtensionInstalled())) return Message.error('没有检测到插件，请先加载/刷新扩展');
  visible.value = true;
  // feature-detect the recorder so we can tell an old build apart up front
  const ping = await pingSession();
  version.value = (ping && ping.version) || '';
  stale.value = !(ping && Array.isArray(ping.features) && ping.features.includes('recorder'));
  if (stale.value) return;
  const r = await getRecording();
  recording.value = !!(r && r.recording);
  refresh();
}
async function toggle() {
  busy.value = true;
  try {
    const r = await setRecording(!recording.value);
    // an old extension has no SET_RECORDING handler -> the bridge times out
    if (!r || r.success === false || r.error === 'TIMEOUT') {
      Message.error('插件没有响应「录制」——你加载的可能是旧版插件。请在 chrome://extensions 重新加载最新的 fbspider-extension.zip（含 inject-recorder.js），加载后这个按钮会立即切换而不是一直转圈。');
      return;
    }
    recording.value = !!r.recording;
    if (recording.value) Message.info('已开始录制，切到 Facebook 做一次操作');
    else Message.info('已停止录制');
  } finally { busy.value = false; }
}
async function refresh() {
  loading.value = true;
  try {
    const r = await listRecipes();
    recipes.value = (r && r.recipes) || [];
  } finally { loading.value = false; }
}
async function clear() { await clearRecipes(); recipes.value = []; }
async function copy(item) {
  try {
    await navigator.clipboard.writeText(JSON.stringify(item, null, 2));
    copied.value = true; setTimeout(() => (copied.value = false), 4000);
  } catch { Message.error('复制失败，请手动选中'); }
}
</script>
