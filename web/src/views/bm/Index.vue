<template>
  <div class="module-card">
    <a-space wrap style="margin-bottom:12px">
      <a-button type="primary" @click="act('隐藏管理员')">隐藏管理员</a-button>
      <a-button @click="inviteVisible = true">邀请人员</a-button>
      <a-button @click="act('BM推送')">BM推送</a-button>
      <a-button status="danger" @click="act('移出BM')">移出BM</a-button>
    </a-space>

    <div class="page-toolbar">
      <a-input-search v-model="keyword" placeholder="输入关键词..." style="width:220px" allow-clear />
      <a-select v-model="filterMode" style="width:170px">
        <a-option value="all">所有BM</a-option>
        <a-option value="bm">根据BM ID过滤</a-option>
      </a-select>
      <a-checkbox v-model="slow">慢速加载（推荐）</a-checkbox>
      <div class="spacer" />
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

    <a-modal v-model:visible="inviteVisible" title="邀请人员" @ok="doInvite">
      <a-form :model="inviteForm" layout="vertical">
        <a-form-item label="邮箱"><a-input v-model="inviteForm.email" placeholder="请输入邮箱" /></a-form-item>
        <a-form-item label="角色">
          <a-select v-model="inviteForm.role" placeholder="请选择角色">
            <a-option value="admin">完全控制</a-option>
            <a-option value="employee">职员</a-option>
            <a-option value="partial">部分访问权限</a-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { Message } from '@arco-design/web-vue';
import { useModule } from '../../composables/useModule';
import { getBusinesses } from '../../api/fbBridge';
import UsageBar from '../../components/UsageBar.vue';
import ActionProgress from '../../components/ActionProgress.vue';

const { loading, keyword, selectedKeys, selectedRows, filtered, running, progress, load, saveNote, toggleFav, runAction } = useModule('bm', 7, {
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
    return { ok: false, info: (r && (r.info || r.error)) || '未知错误' };
  },
});
const usage = ref(); const slow = ref(true); const filterMode = ref('all'); const curAction = ref('');
const inviteVisible = ref(false); const inviteForm = ref({ email: '', role: 'admin' });

async function refresh() { await load(); usage.value?.reload(); }
async function act(label) { curAction.value = label; await runAction(label, selectedRows.value); }
function doInvite() { if (!inviteForm.value.email) return Message.warning('请输入邮箱'); if (!inviteForm.value.role) return Message.warning('请选择角色'); inviteVisible.value = false; act('邀请人员'); }
onMounted(refresh);
</script>
