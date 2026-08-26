<template>
  <a-tooltip :content="tip">
    <a-tag :color="isLive ? 'green' : 'gray'" size="small" style="margin-left:4px">
      {{ isLive ? '真实数据' : '演示数据' }}
    </a-tag>
  </a-tooltip>
</template>

<script setup>
import { computed } from 'vue';

// Shows whether the rows on screen came from the user's real Facebook session
// (via the extension) or from the local demo generator. Without this a failed
// live call silently falls back to mock data that looks real.
const props = defineProps({ source: { type: String, default: 'mock' } });
const isLive = computed(() => props.source === 'live');
const tip = computed(() => (isLive.value
  ? '这些数据来自你真实的 Facebook 会话（浏览器插件）'
  : '这些是本地生成的演示数据，未连接 Facebook。切换右上角「实时」并确认插件已加载。'));
</script>
