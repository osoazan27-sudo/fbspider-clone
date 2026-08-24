<template>
  <div class="module-card">
    <a-row :gutter="16">
      <a-col :span="10">
        <a-card title="创建主页" :bordered="false">
          <template #extra><UsageBar :module-id="6" ref="usage" /></template>
          <a-form :model="form" layout="vertical">
            <a-form-item label="创建类型">
              <a-radio-group v-model="form.type">
                <a-radio value="个人公共主页">个人公共主页</a-radio>
                <a-radio value="个人主页专业模式">个人主页专业模式</a-radio>
                <a-radio value="BM公共主页">BM公共主页</a-radio>
              </a-radio-group>
            </a-form-item>
            <a-form-item v-if="form.type==='BM公共主页'" label="选择 BM">
              <a-select v-model="form.bm" placeholder="请选择 BM"><a-option value="bm1">Business Manager 1</a-option><a-option value="bm2">Business Manager 2</a-option></a-select>
            </a-form-item>
            <a-form-item label="主页名称（一行一个）">
              <a-textarea v-model="form.namesText" placeholder="每行一个主页名称" :auto-size="{ minRows:6 }" />
            </a-form-item>
            <a-row :gutter="12">
              <a-col :span="12"><a-form-item label="单个间隔(分钟)"><a-input-number v-model="form.interval" :min="0" /></a-form-item></a-col>
              <a-col :span="12"><a-form-item label="分组间隔(分钟)"><a-input-number v-model="form.groupInterval" :min="0" /></a-form-item></a-col>
            </a-row>
            <a-space>
              <a-button type="primary" :loading="creating" @click="create"><template #icon><icon-plus /></template>创建</a-button>
              <a-button @click="form.namesText=''">清空名称</a-button>
            </a-space>
          </a-form>
        </a-card>
      </a-col>

      <a-col :span="14">
        <a-card title="主页创建记录" :bordered="false">
          <template #extra><a-button size="mini" @click="records=[]">清除计划缓存</a-button></template>
          <a-table :data="records" :pagination="{ pageSize:10 }" size="small">
            <template #columns>
              <a-table-column title="序号" :width="60"><template #cell="{ rowIndex }">{{ rowIndex+1 }}</template></a-table-column>
              <a-table-column title="主页名称" data-index="name" />
              <a-table-column title="主页ID" data-index="id" />
              <a-table-column title="创建渠道" data-index="create_channel" />
              <a-table-column title="创建时间" data-index="created_time" />
              <a-table-column title="状态" :width="90"><template #cell="{ record }">
                <a-tag :color="record.result==='成功'?'green':'red'">{{ record.result }}</a-tag></template></a-table-column>
            </template>
            <template #empty><a-empty description="暂无创建记录" /></template>
          </a-table>
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { Message } from '@arco-design/web-vue';
import { createPages } from '../../api';
import UsageBar from '../../components/UsageBar.vue';

const usage = ref();
const creating = ref(false);
const records = ref([]);
const form = ref({ type: '个人公共主页', bm: '', namesText: '', interval: 3, groupInterval: 10 });

async function create() {
  const names = form.value.namesText.split('\n').map((s) => s.trim()).filter(Boolean);
  if (!names.length) return Message.warning('请输入至少一个主页名称');
  creating.value = true;
  try {
    const r = await createPages({ names, type: form.value.type });
    if (r.status === 1) { records.value = [...r.data, ...records.value]; Message.success('创建成功~'); usage.value?.reload(); }
  } finally { creating.value = false; }
}
</script>
