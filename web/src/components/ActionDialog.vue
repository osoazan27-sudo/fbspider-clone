<template>
  <a-modal :visible="visible" :title="action?.title || label" @ok="submit" @cancel="close" :ok-text="okText">
    <a-alert v-if="action?.confirm" :type="action.danger ? 'warning' : 'normal'" style="margin-bottom:12px">
      {{ action.confirm }}
    </a-alert>
    <div style="margin-bottom:12px; color:var(--color-text-3); font-size:13px">
      将对选中的 <b>{{ count }}</b> 个对象执行「{{ label }}」
    </div>

    <a-form :model="form" layout="vertical">
      <a-form-item v-for="f in fields" :key="f.key" :label="f.label">
        <a-select v-if="f.type === 'select'" v-model="form[f.key]" :placeholder="f.placeholder">
          <a-option v-for="o in f.options" :key="o.value" :value="o.value">{{ o.label }}</a-option>
        </a-select>
        <a-input-number v-else-if="f.type === 'number'" v-model="form[f.key]" :min="f.min ?? 0" :placeholder="f.placeholder" style="width:100%" />
        <a-textarea v-else-if="f.type === 'textarea'" v-model="form[f.key]" :placeholder="f.placeholder" :auto-size="{ minRows: 3 }" />
        <a-input v-else v-model="form[f.key]" :placeholder="f.placeholder" />
        <div v-if="f.hint" style="margin-top:4px; font-size:12px; color:var(--color-text-3)">{{ f.hint }}</div>
      </a-form-item>
    </a-form>

    <a-alert v-if="isLive" type="warning">
      实时模式：这会真实修改你 Facebook 上的数据。
    </a-alert>
    <a-alert v-else type="normal">
      演示模式：不会真的操作 Facebook。
    </a-alert>
  </a-modal>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { Message } from '@arco-design/web-vue';
import { useAppStore } from '../store/app';

// Renders whatever inputs an action declares in the registry, so a new
// operation only needs a `fields` entry rather than its own dialog.
const props = defineProps({
  visible: Boolean,
  label: String,
  action: Object,
  count: { type: Number, default: 0 },
});
const emit = defineEmits(['submit', 'close']);

const appStore = useAppStore();
const isLive = computed(() => appStore.dataMode === 'live');
const fields = computed(() => (props.action && props.action.fields) || []);
const okText = computed(() => (props.action && props.action.danger ? '确认执行' : '确定'));
const form = ref({});

watch(() => props.visible, (v) => {
  if (!v) return;
  const next = {};
  for (const f of fields.value) next[f.key] = f.default ?? '';
  form.value = next;
});

function submit() {
  for (const f of fields.value) {
    const v = form.value[f.key];
    if (f.required !== false && (v === '' || v == null)) {
      return Message.warning(f.placeholder || ('请填写' + f.label));
    }
  }
  emit('submit', { ...form.value });
}
function close() { emit('close'); }
</script>
