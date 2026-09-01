<template>
  <div class="module-card">
    <a-space wrap style="margin-bottom:12px">
      <a-button type="primary" @click="ask('隐藏管理员')">隐藏管理员</a-button>
      <a-button @click="ask('邀请人员')">邀请人员</a-button>
      <a-button @click="ask('BM推送')">BM推送</a-button>
      <a-button status="danger" @click="doRemove">移出BM</a-button>
    </a-space>

    <div class="page-toolbar">
      <a-input-search v-model="keyword" placeholder="输入关键词..." style="width:220px" allow-clear />
      <a-select v-model="filterMode" style="width:170px">
        <a-option value="all">所有BM</a-option>
        <a-option value="bm">根据BM ID过滤</a-option>
      </a-select>
      <a-checkbox v-model="slow">慢速加载（推荐）</a-checkbox>
      <div class="spacer" />
      <SourceTag :source="source" />
      <UsageBar :module-id="7" ref="usage" />
      <a-button type="primary" :loading="loading" @click="refresh"><template #icon><icon-refresh /></template>更新</a-button>
    </div>

    <a-table row-key="id" :data="filtered" :loading="loading"
      :row-selection="{ type:'checkbox', showCheckedAll:true }" v-model:selected-keys="selectedKeys"
      :pagination="{ pageSize:10, showTotal:true }" :scroll="{ x: 1600 }" size="small">
      <template #columns>
        <a-table-column title="序号" :width="60"><template #cell="{ rowIndex }">{{ rowIndex+1 }}</template></a-table-column>
        <a-table-column title="收藏" :width="56">
          <template #cell="{ record }"><a-button type="text" size="mini" @click="toggleFav(record)">
            <icon-star-fill v-if="record.favourite" style="color:#ffb400" /><icon-star v-else /></a-button></template>
        </a-table-column>
        <a-table-column title="状态" :width="80"><template #cell="{ record }">
          <a-badge :status="record.status===1?'success':'danger'" :text="record.status===1?'正常':'停用'" /></template></a-table-column>
        <a-table-column title="BM名称" :width="200"><template #cell="{ record }">
          <div><b>{{ record.name }}</b></div><div style="color:var(--color-text-3);font-size:12px">{{ record.id }}</div></template></a-table-column>
        <a-table-column title="推送状态" :width="90" data-index="push_status" />
        <a-table-column title="BM类型" :width="80" data-index="bm_type" />
        <a-table-column title="所有者角色" :width="100" data-index="owner_role" />
        <a-table-column title="日限额" :width="90" data-index="daily_limit" />
        <a-table-column title="认证状态" :width="90" data-index="verify_status" />
        <a-table-column title="管理员" :width="80" data-index="admins" />
        <a-table-column title="隐藏管理员" :width="90" data-index="hidden_admins" />
        <a-table-column title="合作伙伴" :width="90" data-index="partners" />
        <a-table-column title="广告账户" :width="90" data-index="ad_accounts" />
        <a-table-column title="BM质量" :width="90"><template #cell="{ record }">
          <a-tag :color="record.quality==='优质'?'green':record.quality==='受限'?'red':'gray'">{{ record.quality }}</a-tag></template></a-table-column>
        <a-table-column title="创建时间" :width="110" data-index="created_time" />
        <a-table-column title="备注" :width="160"><template #cell="{ record }">
          <a-typography-paragraph :editable="{ tooltip:'编辑备注' }" v-model:edit-text="record.note"
            @edit-end="saveNote(record, record.note)" style="margin:0">{{ record.note || '填写备注…' }}</a-typography-paragraph></template></a-table-column>
      </template>
    </a-table>

    <ActionProgress :visible="running || progress.results.length>0" :running="running" :progress="progress" :title="curAction+' 进度'" @close="progress.results=[]" />
    <ActionDialog :visible="dialog.visible" :label="dialog.label" :action="dialog.action"
      :count="dialog.count" @submit="(c) => submitDialog(c, selectedRows)" @close="closeDialog" />

  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { Message, Modal } from '@arco-design/web-vue';
import { useModule } from '../../composables/useModule';
import { useAppStore } from '../../store/app';
import { getBusinesses, bridgeError } from '../../api/fbBridge';
import UsageBar from '../../components/UsageBar.vue';
import SourceTag from '../../components/SourceTag.vue';
import ActionProgress from '../../components/ActionProgress.vue';
import ActionDialog from '../../components/ActionDialog.vue';

const { loading, keyword, selectedKeys, selectedRows, filtered, running, progress, load, saveNote, toggleFav, runAction, source, dialog, promptAction, submitDialog, closeDialog } = useModule('bm', 7, {
  liveLoad: async () => {
    const r = await getBusinesses();
    if (r && r.success && r.data && Array.isArray(r.data.data)) {
      return { ok: true, rows: r.data.data.map((b) => ({
        id: b.id, name: b.name, status: b.is_disabled_for_integrity_reasons ? 2 : 1,
        bm_type: '企业', owner_role: '管理员', daily_limit: '—',
        verify_status: b.verification_status === 'verified' ? '已认证' : '未认证',
        created_time: (b.created_time || '').slice(0, 10), admins: '—', hidden_admins: 0,
        partners: '—', ad_accounts: '—', quality: '正常', push_status: '—',
      })) };
    }
    return { ok: false, info: bridgeError(r) };
  },
});
const usage = ref(); const slow = ref(true); const filterMode = ref('all'); const curAction = ref('');
const appStore = useAppStore();

async function refresh() { await load(); usage.value?.reload(); }
async function act(label, ctx) { curAction.value = label; await runAction(label, selectedRows.value, ctx); }
function ask(label) { curAction.value = label; return promptAction(label, selectedRows.value); }

// Leaving a BM is not reversible from here — you'd need to be re-invited.
function doRemove() {
  if (!selectedRows.value.length) return Message.warning('请先选择对象');
  const names = selectedRows.value.map((r) => r.name).join('、');
  Modal.confirm({
    title: '确认移出这些 BM？',
    content: appStore.isLive
      ? `将把你自己从 ${selectedRows.value.length} 个 BM 中移除：${names}。这会真实生效，移除后需要对方重新邀请才能加回。`
      : `演示模式：不会真的操作 Facebook。将模拟移出 ${selectedRows.value.length} 个 BM。`,
    okText: '确认移出',
    cancelText: '取消',
    okButtonProps: { status: 'danger' },
    onOk: () => act('移出BM'),
  });
}
onMounted(refresh);
</script>
