<template>
  <div class="module-card">
    <a-space wrap style="margin-bottom:12px">
      <a-button type="primary" @click="ask('BM间分享')">BM间分享</a-button>
      <a-button @click="ask('分配给账号')">分配给账号</a-button>
      <a-button @click="ask('分配给人员')">分配给人员</a-button>
      <a-button @click="ask('分享查询')">分享查询</a-button>
      <a-button @click="ask('批量创建')">批量创建</a-button>
      <a-button status="danger" @click="ask('删除广告账号')">删除广告账号</a-button>
      <a-button status="danger" @click="ask('删除合作伙伴')">删除合作伙伴</a-button>
      <a-button status="danger" @click="ask('删除管理员')">删除管理员</a-button>
    </a-space>

    <div class="page-toolbar">
      <a-input-search v-model="keyword" placeholder="像素ID或BM ID" style="width:220px" allow-clear />
      <a-select v-model="filterMode" style="width:170px">
        <a-option value="all">所有像素</a-option>
        <a-option value="bm">根据BM ID搜索</a-option>
      </a-select>
      <a-checkbox v-model="slow">慢速加载（推荐）</a-checkbox>
      <div class="spacer" />
      <SourceTag :source="source" />
      <UsageBar :module-id="4" ref="usage" />
      <a-button type="primary" :loading="loading" @click="refresh"><template #icon><icon-refresh /></template>更新</a-button>
    </div>

    <div v-if="source==='live' && liveMeta" style="margin:-4px 0 10px; font-size:12px; color:var(--color-text-3)">
      实时扫描：{{ liveMeta.businesses }} 个 BM
      <template v-if="liveMeta.accountsTotal">
        · 广告账号 {{ liveMeta.accountsScanned }}/{{ liveMeta.accountsTotal }}
        <a-tag v-if="liveMeta.accountsScanned < liveMeta.accountsTotal" color="orange" size="small">
          已达上限，剩余 {{ liveMeta.accountsTotal - liveMeta.accountsScanned }} 个未扫描
        </a-tag>
      </template>
      <a-tooltip v-if="liveMeta.errors && liveMeta.errors.length" :content="liveMeta.errors.join('\n')">
        <a-tag color="red" size="small">{{ liveMeta.errors.length }} 个来源报错</a-tag>
      </a-tooltip>
    </div>

    <a-table row-key="id" :data="filtered" :loading="loading"
      :row-selection="{ type:'checkbox', showCheckedAll:true }" v-model:selected-keys="selectedKeys"
      :pagination="{ pageSize:10, showTotal:true }" :scroll="{ x: 1400 }" size="small">
      <template #columns>
        <a-table-column title="收藏" :width="56"><template #cell="{ record }">
          <a-button type="text" size="mini" @click="toggleFav(record)"><icon-star-fill v-if="record.favourite" style="color:#ffb400" /><icon-star v-else /></a-button></template></a-table-column>
        <a-table-column title="像素" :width="220"><template #cell="{ record }">
          <div><b>{{ record.name }}</b></div><div style="color:var(--color-text-3);font-size:12px">{{ record.id }}</div></template></a-table-column>
        <a-table-column title="所属BM" :width="180"><template #cell="{ record }">{{ record.business_name }}</template></a-table-column>
        <a-table-column title="所有者" :width="150" data-index="owner" />
        <a-table-column title="角色" :width="90" data-index="role" />
        <a-table-column title="类型" :width="120" data-index="type" />
        <a-table-column title="活跃" :width="90"><template #cell="{ record }">
          <a-badge :status="record.is_active?'success':'default'" :text="record.active_label" /></template></a-table-column>
        <a-table-column title="活跃时间" :width="110" data-index="last_active" />
        <a-table-column title="分享状态" :width="90"><template #cell="{ record }">
          <a-tag :color="record.share_status==='已分享'?'green':'gray'">{{ record.share_status }}</a-tag></template></a-table-column>
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
import { getAllPixels } from '../../api/fbBridge';
import UsageBar from '../../components/UsageBar.vue';
import SourceTag from '../../components/SourceTag.vue';
import ActionProgress from '../../components/ActionProgress.vue';
import ActionDialog from '../../components/ActionDialog.vue';

const { loading, keyword, selectedKeys, selectedRows, filtered, running, progress, load, saveNote, toggleFav, runAction, source, dialog, promptAction, submitDialog, closeDialog } = useModule('pixel', 4, {
  // live: sweep every business (and ad account) for real pixels
  liveLoad: async () => {
    const r = await getAllPixels();
    if (r && r.success && Array.isArray(r.rows)) {
      liveMeta.value = r.meta || null;
      return { ok: true, rows: r.rows };
    }
    return { ok: false, info: (r && (r.info || r.error)) || '未知错误' };
  },
});
const liveMeta = ref(null);
const usage = ref(); const slow = ref(true); const filterMode = ref('all'); const curAction = ref('');
async function refresh() { await load(); usage.value?.reload(); }
async function act(label, ctx) { curAction.value = label; await runAction(label, selectedRows.value, ctx); }
function ask(label) { curAction.value = label; return promptAction(label, selectedRows.value); }

onMounted(refresh);
</script>
