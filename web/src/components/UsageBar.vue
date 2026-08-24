<template>
  <div class="usage-bar">
    <span>已用 {{ used }} / 总数 {{ total }}</span>
    <a-progress :percent="pct" :style="{ width: '160px' }" :show-text="false" :status="pct >= 1 ? 'danger' : 'normal'" />
    <span style="color: var(--color-text-3)">（列表上限 {{ listLimit }}）</span>
    <a-button size="mini" type="primary" @click="$router.push({ name: 'payment', query: { module: moduleId } })">购买</a-button>
    <a-button size="mini" @click="$router.push({ name: 'payment', query: { module: moduleId } })">升级</a-button>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useUserStore } from '../store/user';
import { getRecords } from '../api';

const props = defineProps({ moduleId: { type: Number, required: true } });
const userStore = useUserStore();
const used = ref(0);
const total = ref(50);
const listLimit = ref(10);
const pct = computed(() => (total.value ? Math.min(1, used.value / total.value) : 0));

async function load() {
  try {
    const r = await getRecords(userStore.id, props.moduleId);
    if (r.status === 1 && r.data) {
      used.value = r.data.used || 0;
      total.value = r.data.total_num || 50;
      listLimit.value = r.data.num || 10;
    }
  } catch {}
}
watch(() => props.moduleId, load);
onMounted(load);
defineExpose({ reload: load });
</script>
