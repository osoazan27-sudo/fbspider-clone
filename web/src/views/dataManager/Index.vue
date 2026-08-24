<template>
  <div class="module-card">
    <a-tabs v-model:active-key="kind" type="rounded" @change="refresh">
      <a-tab-pane key="acc" title="广告账号接收" />
      <a-tab-pane key="bm" title="BM接收" />
      <a-tab-pane key="page" title="主页接收" />
    </a-tabs>

    <div class="page-toolbar">
      <a-button type="primary" @click="settingVisible = true">接收设置</a-button>
      <a-button @click="act('确认')">批量确认</a-button>
      <a-button status="danger" @click="act('删除')">删除</a-button>
      <div class="spacer" />
      <a-range-picker style="width:260px" />
      <a-button :loading="loading" @click="refresh"><template #icon><icon-refresh /></template>刷新列表</a-button>
    </div>

    <!-- ad account receiving -->
    <a-table v-if="kind==='acc'" row-key="id" :data="filtered" :loading="loading"
      :row-selection="{ type:'checkbox', showCheckedAll:true }" v-model:selected-keys="selectedKeys"
      :pagination="{ pageSize:10, showTotal:true }" :scroll="{ x: 1600 }" size="small">
      <template #columns>
        <a-table-column title="序号" :width="60"><template #cell="{ rowIndex }">{{ rowIndex+1 }}</template></a-table-column>
        <a-table-column title="状态" :width="80"><template #cell="{ record }"><a-badge :status="record.status===1?'success':'danger'" :text="record.account_status_label" /></template></a-table-column>
        <a-table-column title="账号" :width="200"><template #cell="{ record }"><b>{{ record.name }}</b><div style="color:var(--color-text-3);font-size:12px">{{ record.account_id }}</div></template></a-table-column>
        <a-table-column title="推送账号" :width="120" data-index="business_name" />
        <a-table-column title="推送日期" :width="110" data-index="created_time" />
        <a-table-column title="账号类型" :width="90" data-index="account_type" />
        <a-table-column title="账单金额" :width="100" data-index="bill_amount" />
        <a-table-column title="日限额" :width="90" data-index="daily_limit" />
        <a-table-column title="总花费" :width="100" data-index="amount_spent" />
        <a-table-column title="余额" :width="90" data-index="balance" />
        <a-table-column title="币种" :width="70" data-index="currency" />
        <a-table-column title="时区" :width="150" data-index="timezone" />
        <a-table-column title="所属BM" :width="140" data-index="business_name" />
      </template>
    </a-table>

    <!-- bm receiving -->
    <a-table v-else-if="kind==='bm'" row-key="id" :data="filtered" :loading="loading"
      :row-selection="{ type:'checkbox' }" v-model:selected-keys="selectedKeys" :pagination="{ pageSize:10 }" :scroll="{ x: 1200 }" size="small">
      <template #columns>
        <a-table-column title="序号" :width="60"><template #cell="{ rowIndex }">{{ rowIndex+1 }}</template></a-table-column>
        <a-table-column title="BM名称" :width="200"><template #cell="{ record }"><b>{{ record.name }}</b><div style="color:var(--color-text-3);font-size:12px">{{ record.id }}</div></template></a-table-column>
        <a-table-column title="BM类型" :width="90" data-index="bm_type" />
        <a-table-column title="认证状态" :width="90" data-index="verify_status" />
        <a-table-column title="管理员" :width="80" data-index="admins" />
        <a-table-column title="合作伙伴" :width="90" data-index="partners" />
        <a-table-column title="广告账户" :width="90" data-index="ad_accounts" />
        <a-table-column title="BM质量" :width="90" data-index="quality" />
        <a-table-column title="创建时间" :width="110" data-index="created_time" />
      </template>
    </a-table>

    <!-- page receiving -->
    <a-table v-else row-key="id" :data="filtered" :loading="loading"
      :row-selection="{ type:'checkbox' }" v-model:selected-keys="selectedKeys" :pagination="{ pageSize:10 }" :scroll="{ x: 1200 }" size="small">
      <template #columns>
        <a-table-column title="序号" :width="60"><template #cell="{ rowIndex }">{{ rowIndex+1 }}</template></a-table-column>
        <a-table-column title="主页名称" :width="200"><template #cell="{ record }"><b>{{ record.name }}</b><div style="color:var(--color-text-3);font-size:12px">{{ record.id }}</div></template></a-table-column>
        <a-table-column title="主页状态" :width="90"><template #cell="{ record }"><a-badge :status="record.status===1?'success':'danger'" :text="record.page_status_label" /></template></a-table-column>
        <a-table-column title="申诉时间" :width="110"><template #cell="{ record }">{{ record.appeal_time || '无' }}</template></a-table-column>
        <a-table-column title="发布状态" :width="90" data-index="publish_status" />
        <a-table-column title="允许评论" :width="90" data-index="allow_comment" />
        <a-table-column title="隐藏不文明用语" :width="120" data-index="hide_profanity" />
        <a-table-column title="主页认证" :width="90" data-index="page_verify" />
      </template>
    </a-table>

    <a-modal v-model:visible="settingVisible" :title="settingTitle" @ok="() => { settingVisible=false; Message.success('保存成功'); }">
      <a-form layout="vertical">
        <a-form-item label="接收开关"><a-radio-group v-model="setting.open"><a-radio :value="true">开启接收</a-radio><a-radio :value="false">拒绝接收</a-radio></a-radio-group></a-form-item>
        <a-form-item label="当前状态"><a-tag :color="setting.open?'green':'red'">{{ setting.open ? '开启接收' : '拒绝接收' }}</a-tag></a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { Message } from '@arco-design/web-vue';
import { moduleList, moduleAction } from '../../api';

const kind = ref('acc');
const loading = ref(false);
const rows = ref([]);
const selectedKeys = ref([]);
const settingVisible = ref(false);
const setting = ref({ open: true });
const filtered = computed(() => rows.value);
const settingTitle = computed(() => ({ acc: 'ACC 接收设置', bm: 'BM 接收设置', page: 'Page 接收设置' }[kind.value]));

async function refresh() {
  loading.value = true; selectedKeys.value = [];
  try {
    const r = await moduleList('dataManager', `?kind=${kind.value}`);
    if (r.status === 1) rows.value = r.data;
  } finally { loading.value = false; }
}
async function act(label) {
  const targets = rows.value.filter((r) => selectedKeys.value.includes(r.id));
  if (!targets.length) return Message.warning('请先选择对象');
  await moduleAction({ action: label, targets: targets.map((t) => ({ id: t.id, name: t.name })) });
  if (label === '删除') rows.value = rows.value.filter((r) => !selectedKeys.value.includes(r.id));
  Message.success(label === '删除' ? '已删除' : '已批量确认');
  selectedKeys.value = [];
}
onMounted(refresh);
</script>
