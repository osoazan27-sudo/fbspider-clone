<template>
  <span>
    <a-button size="small" :loading="running" @click="run">插件诊断</a-button>

    <a-modal v-model:visible="visible" title="实时模式诊断" :footer="false" width="640px">
      <a-alert v-if="summary" :type="allOk ? 'success' : 'error'" style="margin-bottom:12px">
        {{ summary }}
      </a-alert>

      <a-list :data="steps" size="small">
        <template #item="{ item }">
          <a-list-item>
            <a-list-item-meta :title="item.step">
              <template #description>
                <span :style="{ color: item.ok ? 'var(--color-text-3)' : '#f53f3f' }">{{ item.info }}</span>
              </template>
            </a-list-item-meta>
            <template #actions>
              <a-tag :color="item.ok ? 'green' : 'red'">{{ item.ok ? 'OK' : '失败' }}</a-tag>
            </template>
          </a-list-item>
        </template>
      </a-list>

      <a-alert v-if="!allOk" type="normal" style="margin-top:12px">
        常见原因：① 插件没刷新（chrome://extensions 点 🔄）；② 没在这个浏览器登录 facebook.com；
        ③ 会话里没抓到 access_token —— 打开一次 facebook.com 再点插件里的「刷新会话」。
      </a-alert>
    </a-modal>
  </span>
</template>

<script setup>
import { ref, computed } from 'vue';
import { Message } from '@arco-design/web-vue';
import { fbOp, isExtensionInstalled } from '../api/fbBridge';

const running = ref(false);
const visible = ref(false);
const steps = ref([]);

const allOk = computed(() => steps.value.length > 0 && steps.value.every((s) => s.ok));
const summary = computed(() => {
  if (!steps.value.length) return '';
  const bad = steps.value.filter((s) => !s.ok);
  return bad.length ? `${bad.length} 项失败，第一个问题：${bad[0].step} —— ${bad[0].info}` : '全部通过，实时模式可用';
});

async function run() {
  running.value = true;
  try {
    if (!(await isExtensionInstalled())) {
      steps.value = [{ step: '插件连接', ok: false, info: '页面连不上插件。请在 chrome://extensions 加载/刷新扩展，并确认当前网址在插件的匹配列表里。' }];
      visible.value = true;
      return;
    }
    const r = await fbOp('diagnose');
    if (!r || !r.success || !Array.isArray(r.steps)) {
      steps.value = [{ step: '诊断调用', ok: false, info: (r && (r.info || r.error)) || '插件无响应' }];
    } else {
      steps.value = r.steps;
    }
    visible.value = true;
  } catch (e) {
    Message.error('诊断失败：' + String(e && e.message || e));
  } finally { running.value = false; }
}
</script>
