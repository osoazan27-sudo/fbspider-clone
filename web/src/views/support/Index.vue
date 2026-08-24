<template>
  <div class="module-card">
    <div class="page-toolbar">
      <h3 style="margin:0">我的工单</h3>
      <div class="spacer" />
      <a-button type="primary" @click="newVisible = true"><template #icon><icon-plus /></template>新建工单</a-button>
      <a-button :loading="loading" @click="load"><template #icon><icon-refresh /></template>刷新</a-button>
    </div>

    <a-table :data="tickets" :loading="loading" :pagination="{ pageSize:10 }" size="small">
      <template #columns>
        <a-table-column title="工单" :width="90"><template #cell="{ record }">#{{ record.id }}</template></a-table-column>
        <a-table-column title="问题类型" data-index="type" />
        <a-table-column title="标题" data-index="title" />
        <a-table-column title="状态"><template #cell="{ record }">
          <a-tag :color="record.status===2?'gray':record.status===1?'arcoblue':'orange'">{{ record.status_label }}</a-tag></template></a-table-column>
        <a-table-column title="处理人" data-index="handler" />
        <a-table-column title="最后回复" data-index="last_reply" ellipsis tooltip />
        <a-table-column title="操作" :width="120"><template #cell="{ record }">
          <a-button type="text" size="mini" @click="open(record)">查看沟通</a-button></template></a-table-column>
      </template>
      <template #empty><a-empty description="暂无工单" /></template>
    </a-table>

    <!-- new ticket -->
    <a-modal v-model:visible="newVisible" title="新建工单" @ok="create">
      <a-form :model="form" layout="vertical">
        <a-form-item label="问题类型">
          <a-select v-model="form.type"><a-option>账号问题</a-option><a-option>支付问题</a-option><a-option>功能建议</a-option><a-option>其他</a-option></a-select>
        </a-form-item>
        <a-form-item label="标题"><a-input v-model="form.title" placeholder="简要描述问题" /></a-form-item>
        <a-form-item label="详细描述"><a-textarea v-model="form.content" :auto-size="{ minRows:4 }" /></a-form-item>
      </a-form>
    </a-modal>

    <!-- ticket detail -->
    <a-drawer v-model:visible="detailVisible" :width="480" :title="`工单 #${cur?.id} · ${cur?.title}`" :footer="false">
      <div v-if="cur">
        <a-space style="margin-bottom:12px"><a-tag>{{ cur.type }}</a-tag><a-tag :color="cur.status===2?'gray':'arcoblue'">{{ cur.status_label }}</a-tag></a-space>
        <div class="chat">
          <div v-for="(r, i) in cur.replies" :key="i" :class="['bubble', r.from_admin ? 'admin' : 'me']">
            <div class="who">{{ r.from_admin ? '客服' : '我' }} · {{ r.create_time_str }}</div>
            <div>{{ r.content }}</div>
          </div>
        </div>
        <a-textarea v-model="reply" placeholder="输入回复..." :auto-size="{ minRows:2 }" style="margin-top:12px" />
        <a-button type="primary" long style="margin-top:8px" @click="sendReply">发送回复</a-button>
      </div>
    </a-drawer>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { Message } from '@arco-design/web-vue';
import { ticketList, ticketCreate, ticketDetail, ticketReply } from '../../api';

const loading = ref(false);
const tickets = ref([]);
const newVisible = ref(false);
const detailVisible = ref(false);
const cur = ref(null);
const reply = ref('');
const form = ref({ type: '账号问题', title: '', content: '' });

async function load() { loading.value = true; try { const r = await ticketList(); if (r.status === 1) tickets.value = r.data; } finally { loading.value = false; } }
async function create() {
  if (!form.value.title) return Message.warning('请填写标题');
  const r = await ticketCreate(form.value);
  if (r.status === 1) { Message.success('工单已创建'); newVisible.value = false; form.value = { type: '账号问题', title: '', content: '' }; load(); }
}
async function open(record) { const r = await ticketDetail(record.id); if (r.status === 1) { cur.value = r.data; detailVisible.value = true; } }
async function sendReply() {
  if (!reply.value.trim()) return;
  const r = await ticketReply({ id: cur.value.id, content: reply.value });
  if (r.status === 1) { reply.value = ''; await open(cur.value); load(); }
}
onMounted(load);
</script>

<style scoped>
.chat { display:flex; flex-direction:column; gap:10px; max-height:60vh; overflow:auto; }
.bubble { padding:8px 12px; border-radius:8px; max-width:80%; }
.bubble .who { font-size:11px; color:var(--color-text-3); margin-bottom:4px; }
.bubble.me { align-self:flex-end; background:rgb(var(--primary-1)); }
.bubble.admin { align-self:flex-start; background:var(--color-fill-2); }
</style>
