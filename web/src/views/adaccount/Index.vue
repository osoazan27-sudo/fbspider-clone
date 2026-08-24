<template>
  <div class="module-card">
    <!-- action buttons -->
    <a-space wrap style="margin-bottom:12px">
      <a-button type="primary" @click="act('增加授权')">增加授权</a-button>
      <a-button status="danger" @click="act('删除授权')">删除授权</a-button>
      <a-button @click="act('添加到BM')">添加到BM</a-button>
      <a-button @click="limitVisible = true">设置限额</a-button>
      <a-button @click="act('重置限额')">重置限额</a-button>
      <a-button @click="act('隐藏管理员')">隐藏管理员</a-button>
      <a-button @click="pushVisible = true">账号推送</a-button>
      <a-button @click="act('BM合作伙伴')">BM合作伙伴</a-button>
      <a-button @click="renameVisible = true">账号重命名</a-button>
      <a-button @click="companyVisible = true">更新公司信息</a-button>
      <a-button @click="act('支付记录')">支付记录</a-button>
      <a-button @click="exportCsv">导出csv</a-button>
    </a-space>

    <!-- toolbar -->
    <div class="page-toolbar">
      <a-input-search v-model="keyword" placeholder="请输入广告账号..." style="width:240px" allow-clear />
      <a-select v-model="filterMode" style="width:180px">
        <a-option value="all">所有广告账号</a-option>
        <a-option value="acc">根据账号ID过滤</a-option>
        <a-option value="bm">根据BM ID过滤</a-option>
      </a-select>
      <a-input v-if="filterMode!=='all'" v-model="filterValue" :placeholder="filterMode==='acc' ? '输入账号ID' : '输入BM ID'" style="width:180px" />
      <a-checkbox v-model="slow">慢速加载（推荐）</a-checkbox>
      <div class="spacer" />
      <UsageBar :module-id="1" ref="usage" />
      <a-button type="primary" :loading="loading" @click="refresh"><template #icon><icon-refresh /></template>更新</a-button>
    </div>

    <div v-if="lastUpdate" style="color:var(--color-text-3); font-size:12px; margin-bottom:8px">上次更新：{{ lastUpdate }}</div>

    <a-table
      row-key="id"
      :data="filtered"
      :loading="loading"
      :row-selection="{ type: 'checkbox', showCheckedAll: true }"
      v-model:selected-keys="selectedKeys"
      :pagination="{ pageSize: 10, showTotal: true, showPageSize: true }"
      :scroll="{ x: 2600 }"
      size="small"
    >
      <template #columns>
        <a-table-column title="序号" :width="60"><template #cell="{ rowIndex }">{{ rowIndex + 1 }}</template></a-table-column>
        <a-table-column title="收藏" :width="56" fixed="left">
          <template #cell="{ record }">
            <a-button type="text" size="mini" @click="toggleFav(record)">
              <icon-star-fill v-if="record.favourite" style="color:#ffb400" /><icon-star v-else />
            </a-button>
          </template>
        </a-table-column>
        <a-table-column title="状态" :width="80" fixed="left">
          <template #cell="{ record }">
            <a-badge :status="record.status===1 ? 'success' : 'danger'" :text="record.account_status_label" />
          </template>
        </a-table-column>
        <a-table-column title="账号" :width="220" fixed="left">
          <template #cell="{ record }">
            <div><b>{{ record.name }}</b></div>
            <div style="color:var(--color-text-3); font-size:12px">{{ record.account_id }}</div>
          </template>
        </a-table-column>
        <a-table-column title="推送状态" :width="90" data-index="push_status" />
        <a-table-column title="管理员" :width="80" data-index="admins" />
        <a-table-column title="隐藏管理员" :width="90" data-index="hidden_admins" />
        <a-table-column title="账号类型" :width="90" data-index="account_type" />
        <a-table-column title="账单金额" :width="100" data-index="bill_amount" />
        <a-table-column title="门槛" :width="80" data-index="threshold" />
        <a-table-column title="日限额" :width="90" data-index="daily_limit" />
        <a-table-column title="总花费" :width="100" data-index="amount_spent" />
        <a-table-column title="花费限额" :width="100" data-index="spend_cap" />
        <a-table-column title="已花费" :width="100" data-index="spend_used" />
        <a-table-column title="余额" :width="90" data-index="balance" />
        <a-table-column title="备注" :width="160">
          <template #cell="{ record }">
            <a-typography-paragraph
              :editable="{ tooltip: '编辑备注' }"
              v-model:edit-text="record.note"
              @edit-end="saveNote(record, record.note)"
              style="margin:0"
            >{{ record.note || '填写备注…' }}</a-typography-paragraph>
          </template>
        </a-table-column>
        <a-table-column title="币种" :width="70" data-index="currency" />
        <a-table-column title="所有者角色" :width="100" data-index="owner_role" />
        <a-table-column title="支付方法" :width="90" data-index="pay_method" />
        <a-table-column title="账单期" :width="80" data-index="bill_period" />
        <a-table-column title="锁定原因" :width="120"><template #cell="{ record }">{{ record.disable_reason || '无' }}</template></a-table-column>
        <a-table-column title="创建日期" :width="110" data-index="created_time" />
        <a-table-column title="时区" :width="150" data-index="timezone" />
        <a-table-column title="原始ID" :width="160" data-index="origin_id" />
        <a-table-column title="所属BM" :width="140"><template #cell="{ record }">{{ record.business_name }}</template></a-table-column>
        <a-table-column title="国家编码" :width="90" data-index="country" />
      </template>
    </a-table>

    <ActionProgress :visible="running || progress.results.length>0" :running="running" :progress="progress"
      :title="`${curAction} 进度`" @close="progress.results = []" />

    <!-- 设置限额 -->
    <a-modal v-model:visible="limitVisible" title="设置账号额度" @ok="doLimit">
      <a-alert style="margin-bottom:12px">将对选中的 {{ selectedRows.length }} 个账号设置花费限额</a-alert>
      <a-form :model="limitForm" layout="vertical">
        <a-form-item label="操作类型">
          <a-radio-group v-model="limitForm.type">
            <a-radio value="set">设置限额</a-radio>
            <a-radio value="add">增加额度</a-radio>
            <a-radio value="reduce">减少额度</a-radio>
            <a-radio value="zero">账户清零</a-radio>
            <a-radio value="remove">删除限制</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item v-if="['set','add','reduce'].includes(limitForm.type)" label="金额 (USD)">
          <a-input-number v-model="limitForm.value" :min="0" placeholder="输入金额" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 账号重命名 -->
    <a-modal v-model:visible="renameVisible" title="修改账号名称" @ok="doRename">
      <a-form :model="renameForm" layout="vertical">
        <a-form-item label="账号名称"><a-input v-model="renameForm.name" placeholder="请输入账号名称" /></a-form-item>
        <a-checkbox v-model="renameForm.auto">自动重命名账号（追加序号）</a-checkbox>
      </a-form>
    </a-modal>

    <!-- 账号推送 -->
    <a-modal v-model:visible="pushVisible" title="账号推送" @ok="doPush">
      <a-form :model="pushForm" layout="vertical">
        <a-form-item label="接收人邮箱"><a-input v-model="pushForm.email" placeholder="搜索用户邮箱" /></a-form-item>
        <a-form-item label="授权角色">
          <a-select v-model="pushForm.role">
            <a-option value="admin">授权管理员</a-option>
            <a-option value="advertiser">授权广告管理员</a-option>
            <a-option value="analyst">授权广告分析员</a-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 更新公司信息 -->
    <a-modal v-model:visible="companyVisible" title="修改BM公司信息" @ok="() => { companyVisible=false; act('更新公司信息'); }">
      <a-form :model="companyForm" layout="vertical">
        <a-form-item label="选择国家"><a-input v-model="companyForm.country" placeholder="国家" /></a-form-item>
        <a-form-item label="州、省或地区"><a-input v-model="companyForm.state" /></a-form-item>
        <a-form-item label="市/镇"><a-input v-model="companyForm.city" /></a-form-item>
        <a-form-item label="街道地址第 1 行"><a-input v-model="companyForm.street" /></a-form-item>
        <a-form-item label="邮编"><a-input v-model="companyForm.zip" /></a-form-item>
        <a-form-item label="税号(选填)"><a-input v-model="companyForm.tax" /></a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { Message } from '@arco-design/web-vue';
import { useModule } from '../../composables/useModule';
import { getAdAccounts, renameAdAccount } from '../../api/fbBridge';
import UsageBar from '../../components/UsageBar.vue';
import ActionProgress from '../../components/ActionProgress.vue';

const {
  loading, keyword, selectedKeys, selectedRows, filtered, source,
  running, progress, load, saveNote, toggleFav, runAction,
} = useModule('adaccount', 1, {
  // live mode: pull the user's real ad accounts via the extension bridge
  liveLoad: async () => {
    const r = await getAdAccounts();
    if (r && r.success && r.rows) return { ok: true, rows: r.rows };
    return { ok: false, info: (r && (r.info || r.error)) || '未知错误' };
  },
});

const usage = ref();
const slow = ref(true);
const filterMode = ref('all');
const filterValue = ref('');
const lastUpdate = ref('');
const curAction = ref('');

const limitVisible = ref(false);
const renameVisible = ref(false);
const pushVisible = ref(false);
const companyVisible = ref(false);
const limitForm = ref({ type: 'set', value: 0 });
const renameForm = ref({ name: '', auto: false });
const pushForm = ref({ email: '', role: 'admin' });
const companyForm = ref({ country: '', state: '', city: '', street: '', zip: '', tax: '' });

async function refresh() {
  await load();
  lastUpdate.value = new Date().toLocaleString();
  usage.value?.reload();
}
async function act(label) {
  curAction.value = label;
  await runAction(label, selectedRows.value);
}
function doLimit() { limitVisible.value = false; act('设置限额'); }
async function doRename() {
  if (!renameForm.value.name && !renameForm.value.auto) return Message.warning('账号名称不能为空');
  renameVisible.value = false;
  // in live mode, actually rename the selected accounts via the Graph API
  if (source.value === 'live') {
    curAction.value = '账号重命名';
    running.value = true;
    progress.value = { done: 0, total: selectedRows.value.length, results: [] };
    for (let i = 0; i < selectedRows.value.length; i++) {
      const row = selectedRows.value[i];
      const name = renameForm.value.auto ? `${renameForm.value.name || row.name} ${i + 1}` : renameForm.value.name;
      const r = await renameAdAccount(row.account_id, name);
      progress.value.done = i + 1;
      progress.value.results.push({ obj_id: row.account_id, name, status: r && r.success ? 1 : 0, message: r && r.success ? '成功' : (r.info || r.error || '失败') });
    }
    running.value = false;
    return;
  }
  act('账号重命名');
}
function doPush() { if (!pushForm.value.email) return Message.warning('请先搜索用户'); pushVisible.value = false; act('账号推送'); }

function exportCsv() {
  const rowsToExport = selectedRows.value.length ? selectedRows.value : filtered.value;
  if (!rowsToExport.length) return Message.warning('没有可导出的数据');
  const cols = ['account_id', 'name', 'account_status_label', 'account_type', 'amount_spent', 'balance', 'currency', 'business_name', 'country'];
  const header = ['账号ID', '名称', '状态', '账号类型', '总花费', '余额', '币种', '所属BM', '国家'];
  const csv = [header.join(','), ...rowsToExport.map((r) => cols.map((c) => `"${r[c] ?? ''}"`).join(','))].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'adaccounts.csv'; a.click();
  Message.success('已导出 CSV');
}

onMounted(refresh);
</script>
