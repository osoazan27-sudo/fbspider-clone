<template>
  <div class="module-card">
    <a-tabs v-model:active-key="tab" type="rounded">
      <a-tab-pane key="my" title="我的数据" />
      <a-tab-pane key="report" title="汇报数据" />
    </a-tabs>

    <div class="page-toolbar">
      <a-select v-model="dateRange" style="width:150px">
        <a-option value="all">所有日期</a-option>
        <a-option value="today">今天</a-option>
        <a-option value="yesterday">昨天</a-option>
        <a-option value="3d">最近3天</a-option>
        <a-option value="7d">最近7天</a-option>
        <a-option value="30d">最近30天</a-option>
        <a-option value="week">本周</a-option>
        <a-option value="month">本月</a-option>
      </a-select>
      <a-checkbox v-model="byDay">按天明细</a-checkbox>
      <a-checkbox v-model="realtime">实时更新</a-checkbox>
      <div class="spacer" />
      <SourceTag :source="source" />
      <a-button v-if="tab==='report'" @click="reportVisible = true">管理汇报人员</a-button>
      <a-button @click="exportCsv">导出 CSV</a-button>
      <a-button type="primary" :loading="loading" @click="refresh"><template #icon><icon-refresh /></template>查询数据</a-button>
    </div>

    <a-table row-key="id" :data="rows" :loading="loading" :pagination="{ pageSize:10, showTotal:true }" :scroll="{ x: 1300 }" size="small">
      <template #columns>
        <a-table-column title="序号" :width="60"><template #cell="{ rowIndex }">{{ rowIndex+1 }}</template></a-table-column>
        <a-table-column title="账号" :width="200"><template #cell="{ record }">
          <div><b>{{ record.name }}</b></div><div style="color:var(--color-text-3);font-size:12px">{{ record.id }}</div></template></a-table-column>
        <a-table-column title="状态" :width="80"><template #cell="{ record }">
          <a-badge :status="record.status===1?'success':'danger'" :text="record.status===1?'活跃':'停用'" /></template></a-table-column>
        <a-table-column title="总花费" :width="110"><template #cell="{ record }">{{ record.currency }} {{ record.spend }}</template></a-table-column>
        <a-table-column title="展示量" :width="100" data-index="impressions" />
        <a-table-column title="点击" :width="90" data-index="clicks" />
        <a-table-column title="CPC" :width="90" data-index="cpc" />
        <a-table-column title="CTR" :width="90" data-index="ctr" />
        <a-table-column title="币种" :width="80" data-index="currency" />
        <a-table-column title="账号时区" :width="150" data-index="timezone" />
        <a-table-column title="账号类型" :width="90" data-index="account_type" />
        <a-table-column title="所有者角色" :width="100" data-index="owner_role" />
        <a-table-column title="所属BM" :width="150" data-index="business_name" />
        <a-table-column title="备注" :width="140"><template #cell>暂无备注</template></a-table-column>
      </template>
      <template #footer>
        <div style="text-align:right; padding-right:12px">
          合计花费：<b>{{ totalSpend }}</b>（本列表共 {{ rows.length }} 条）
        </div>
      </template>
    </a-table>

    <a-modal v-model:visible="reportVisible" title="管理汇报人员" @ok="reportVisible=false">
      <a-input-search placeholder="输入邮箱添加汇报人员" style="margin-bottom:12px" search-button>
        <template #button-default>我要汇报</template>
      </a-input-search>
      <a-empty description="暂无汇报人员" />
    </a-modal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { Message } from '@arco-design/web-vue';
import { moduleList } from '../../api';
import { getAdAccountsWithInsights, bridgeError } from '../../api/fbBridge';
import { useAppStore } from '../../store/app';
import SourceTag from '../../components/SourceTag.vue';
import { sortModuleRows } from '../../utils/sortRows';

const appStore = useAppStore();
const tab = ref('my');
const dateRange = ref('all');
const byDay = ref(false);
const realtime = ref(false);
const loading = ref(false);
const rows = ref([]);
const reportVisible = ref(false);
const source = ref('mock');

// this page's ranges -> Facebook's date_preset values
const PRESETS = {
  all: 'maximum', today: 'today', yesterday: 'yesterday',
  '3d': 'last_3d', '7d': 'last_7d', '30d': 'last_30d',
  week: 'this_week_mon_today', month: 'this_month',
};

const totalSpend = computed(() => rows.value.reduce((s, r) => s + parseFloat(r.spend || 0), 0).toFixed(2));

async function refresh() {
  loading.value = true;
  try {
    if (appStore.isLive) {
      const r = await getAdAccountsWithInsights(PRESETS[dateRange.value] || 'maximum');
      if (r && r.success && Array.isArray(r.rows)) { rows.value = sortModuleRows(r.rows); source.value = 'live'; return; }
      Message.warning('实时获取失败：' + bridgeError(r) + '（已回退演示数据）');
    }
    const r = await moduleList('adsManager');
    if (r.status === 1) rows.value = sortModuleRows(r.data);
    source.value = 'mock';
  } finally { loading.value = false; }
}
function exportCsv() {
  if (!rows.value.length) return Message.warning('没有可导出的数据');
  const csv = ['账号,ID,币种,总花费,BM', ...rows.value.map((r) => `${r.name},${r.id},${r.currency},${r.spend},${r.business_name}`)].join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })); a.download = 'ads-data.csv'; a.click();
  Message.success('已导出');
}
onMounted(refresh);
</script>
