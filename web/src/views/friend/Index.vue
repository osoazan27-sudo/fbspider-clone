<template>
  <div class="module-card">
    <a-tabs v-model:active-key="tab" type="rounded">
      <a-tab-pane key="received" :title="`收到的请求 ${received.length} 人`" />
      <a-tab-pane key="sent" title="添加好友" />
    </a-tabs>

    <div class="page-toolbar">
      <a-button v-if="tab==='sent'" type="primary" @click="addVisible = true"><template #icon><icon-user-add /></template>添加好友</a-button>
      <div class="spacer" />
      <a-button :loading="loading" @click="refresh"><template #icon><icon-refresh /></template>刷新列表</a-button>
    </div>

    <a-table v-if="tab==='received'" row-key="id" :data="received" :loading="loading" :pagination="{ pageSize:10 }" size="small">
      <template #columns>
        <a-table-column title="申请人" :width="200"><template #cell="{ record }">
          <a-space><a-avatar :size="28">{{ record.name.slice(0,1) }}</a-avatar>{{ record.name }}</a-space></template></a-table-column>
        <a-table-column title="申请时间" data-index="apply_time" />
        <a-table-column title="共同好友人数"><template #cell="{ record }">
          {{ record.mutual_friends }} <a-link v-if="record.mutual_friends">查看共同好友</a-link></template></a-table-column>
        <a-table-column title="状态"><template #cell="{ record }">
          <a-tag :color="record.status==='已同意'?'green':record.status==='已拒绝'?'red':'orange'">{{ record.status }}</a-tag></template></a-table-column>
        <a-table-column title="操作" :width="180"><template #cell="{ record }">
          <a-button type="primary" size="mini" @click="approve(record, true)">同意</a-button>
          <a-button size="mini" status="danger" style="margin-left:8px" @click="approve(record, false)">拒绝</a-button>
        </template></a-table-column>
      </template>
    </a-table>

    <a-table v-else row-key="id" :data="sent" :loading="loading" :pagination="{ pageSize:10 }" size="small">
      <template #columns>
        <a-table-column title="添加好友名称" :width="220"><template #cell="{ record }">
          <a-space><a-avatar :size="28">{{ record.name.slice(0,1) }}</a-avatar>{{ record.name }}</a-space></template></a-table-column>
        <a-table-column title="发出时间" data-index="apply_time" />
        <a-table-column title="状态"><template #cell="{ record }"><a-tag color="arcoblue">{{ record.status }}</a-tag></template></a-table-column>
        <a-table-column title="操作" :width="140"><template #cell="{ record }">
          <a-popconfirm content="取消请求?" @ok="withdraw(record)"><a-button size="mini">取消请求</a-button></a-popconfirm></template></a-table-column>
      </template>
    </a-table>

    <a-modal v-model:visible="addVisible" title="添加好友" @ok="doAdd">
      <a-form :model="addForm" layout="vertical">
        <a-form-item label="Facebook UID 或主页链接"><a-input v-model="addForm.target" placeholder="输入对方 UID 或链接" /></a-form-item>
        <a-form-item label="附言（选填）"><a-textarea v-model="addForm.note" :auto-size="{ minRows:2 }" /></a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { Message } from '@arco-design/web-vue';
import { moduleList } from '../../api';
import { sortModuleRows } from '../../utils/sortRows';

const tab = ref('received');
const loading = ref(false);
const received = ref([]);
const sent = ref([]);
const addVisible = ref(false);
const addForm = ref({ target: '', note: '' });

async function refresh() {
  loading.value = true;
  try {
    const r = await moduleList('friend');
    if (r.status === 1) { received.value = sortModuleRows(r.data.received || []); sent.value = sortModuleRows(r.data.sent || []); }
  } finally { loading.value = false; }
}
function approve(record, ok) { record.status = ok ? '已同意' : '已拒绝'; Message.success(ok ? '好友添加成功' : '已拒绝申请'); }
function withdraw(record) { sent.value = sent.value.filter((r) => r.id !== record.id); Message.success('已取消请求'); }
function doAdd() { if (!addForm.value.target) return Message.warning('请输入对方 UID 或链接'); addVisible.value = false; Message.success('好友请求已发送'); addForm.value = { target: '', note: '' }; }
onMounted(refresh);
</script>
