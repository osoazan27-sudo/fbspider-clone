<template>
  <div class="module-card">
    <a-space wrap style="margin-bottom:12px">
      <a-button type="primary" @click="ask('授权')">授权</a-button>
      <a-button @click="ask('主页推送')">主页推送</a-button>
      <a-button @click="ask('黑名单设置')">黑名单设置</a-button>
      <a-button @click="ask('屏蔽词设置')">屏蔽词设置</a-button>
      <a-button status="danger" @click="ask('停用主页')">停用主页</a-button>
      <a-button @click="ask('重新启用主页')">重新启用主页</a-button>
      <a-button @click="ask('修改主页名称')">修改主页名称</a-button>
    </a-space>

    <div class="page-toolbar">
      <a-input-search v-model="keyword" placeholder="请输入主页名称..." style="width:220px" allow-clear />
      <a-radio-group v-model="statusTab" type="button" size="small">
        <a-radio value="all">全部</a-radio>
        <a-radio value="normal">状态1 正常</a-radio>
        <a-radio value="disabled">状态2 停用</a-radio>
      </a-radio-group>
      <a-checkbox v-model="slow">慢速加载（推荐）</a-checkbox>
      <div class="spacer" />
      <SourceTag :source="source" />
      <UsageBar :module-id="3" ref="usage" />
      <a-button type="primary" :loading="loading" @click="refresh"><template #icon><icon-refresh /></template>刷新</a-button>
    </div>

    <a-table row-key="id" :data="tabFiltered" :loading="loading"
      :row-selection="{ type:'checkbox', showCheckedAll:true }" v-model:selected-keys="selectedKeys"
      :pagination="{ pageSize:10, showTotal:true }" :scroll="{ x: 1700 }" size="small">
      <template #columns>
        <a-table-column title="序号" :width="60"><template #cell="{ rowIndex }">{{ rowIndex+1 }}</template></a-table-column>
        <a-table-column title="收藏" :width="56"><template #cell="{ record }">
          <a-button type="text" size="mini" @click="toggleFav(record)"><icon-star-fill v-if="record.favourite" style="color:#ffb400" /><icon-star v-else /></a-button></template></a-table-column>
        <a-table-column title="主页名称" :width="200"><template #cell="{ record }">
          <div><b>{{ record.name }}</b></div><div style="color:var(--color-text-3);font-size:12px">{{ record.id }}</div></template></a-table-column>
        <a-table-column title="推送状态" :width="90" data-index="push_status" />
        <a-table-column title="主页状态" :width="90"><template #cell="{ record }">
          <a-badge :status="record.status===1?'success':'danger'" :text="record.page_status_label" /></template></a-table-column>
        <a-table-column title="创建渠道" :width="130" data-index="create_channel" />
        <a-table-column title="创建时间" :width="110" data-index="created_time" />
        <a-table-column title="申诉时间" :width="110"><template #cell="{ record }">{{ record.appeal_time || '无' }}</template></a-table-column>
        <a-table-column title="发布状态" :width="90" data-index="publish_status" />
        <a-table-column title="允许评论" :width="90" data-index="allow_comment" />
        <a-table-column title="隐藏不文明用语" :width="120" data-index="hide_profanity" />
        <a-table-column title="主页认证" :width="90" data-index="page_verify" />
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
import { ref, computed, onMounted } from 'vue';
import { Message } from '@arco-design/web-vue';
import { useModule } from '../../composables/useModule';
import { getPages, bridgeError } from '../../api/fbBridge';
import UsageBar from '../../components/UsageBar.vue';
import SourceTag from '../../components/SourceTag.vue';
import ActionProgress from '../../components/ActionProgress.vue';
import ActionDialog from '../../components/ActionDialog.vue';

const { loading, keyword, selectedKeys, selectedRows, filtered, running, progress, load, saveNote, toggleFav, runAction, source, dialog, promptAction, submitDialog, closeDialog } = useModule('page', 3, {
  liveLoad: async () => {
    const r = await getPages();
    if (r && r.success && r.data && Array.isArray(r.data.data)) {
      return { ok: true, rows: r.data.data.map((p) => ({
        id: p.id, name: p.name, status: p.is_published ? 1 : 2,
        page_status_label: p.is_published ? '正常' : '未发布',
        create_channel: p.category || '公共主页', created_time: '',
        appeal_time: '', publish_status: p.is_published ? '已发布' : '未发布',
        allow_comment: '允许', hide_profanity: '不隐藏',
        page_verify: p.verification_status === 'blue_verified' ? '是' : '否',
        push_status: '—', fan_count: p.fan_count, link: p.link,
      })) };
    }
    return { ok: false, info: bridgeError(r) };
  },
});
const usage = ref(); const slow = ref(true); const statusTab = ref('all'); const curAction = ref('');

const tabFiltered = computed(() => {
  if (statusTab.value === 'normal') return filtered.value.filter((r) => r.status === 1);
  if (statusTab.value === 'disabled') return filtered.value.filter((r) => r.status !== 1);
  return filtered.value;
});

async function refresh() { await load(); usage.value?.reload(); }
async function act(label, ctx) { curAction.value = label; await runAction(label, selectedRows.value, ctx); }
function ask(label) { curAction.value = label; return promptAction(label, selectedRows.value); }
onMounted(refresh);
</script>
