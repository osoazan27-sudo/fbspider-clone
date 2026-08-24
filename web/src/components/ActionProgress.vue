<template>
  <a-modal :visible="visible" :title="title" :footer="false" width="640px" @cancel="$emit('close')">
    <div style="margin-bottom:10px">
      <a-progress :percent="pct" :status="running ? 'normal' : 'success'" />
      <span style="margin-left:8px">{{ progress.done }} / {{ progress.total }}</span>
    </div>
    <a-table :data="progress.results" :pagination="false" size="small" :scroll="{ y: 320 }">
      <template #columns>
        <a-table-column title="对象名称" data-index="name" />
        <a-table-column title="对象 ID" data-index="obj_id" />
        <a-table-column title="结果" :width="90">
          <template #cell="{ record }">
            <a-tag :color="record.status === 1 ? 'green' : 'red'">{{ record.status === 1 ? '成功' : '失败' }}</a-tag>
          </template>
        </a-table-column>
        <a-table-column title="信息" data-index="message" />
      </template>
    </a-table>
  </a-modal>
</template>

<script setup>
import { computed } from 'vue';
const props = defineProps({
  visible: Boolean,
  title: { type: String, default: '执行进度' },
  running: Boolean,
  progress: { type: Object, default: () => ({ done: 0, total: 0, results: [] }) },
});
defineEmits(['close']);
const pct = computed(() => (props.progress.total ? props.progress.done / props.progress.total : 0));
</script>
