<template>
  <div class="module-card">
    <a-space wrap style="margin-bottom:12px">
      <a-button type="primary" @click="shareVisible = true">BM间分享</a-button>
      <a-button @click="act('分配给账号')">分配给账号</a-button>
      <a-button @click="act('分配给人员')">分配给人员</a-button>
      <a-button @click="act('分享查询')">分享查询</a-button>
      <a-button @click="createVisible = true">批量创建</a-button>
      <a-button status="danger" @click="act('删除广告账号')">删除广告账号</a-button>
      <a-button status="danger" @click="act('删除合作伙伴')">删除合作伙伴</a-button>
      <a-button status="danger" @click="act('删除管理员')">删除管理员</a-button>
    </a-space>

    <div class="page-toolbar">
      <a-input-search v-model="keyword" placeholder="像素ID或BM ID" style="width:220px" allow-clear />
      <a-select v-model="filterMode" style="width:170px">
        <a-option value="all">所有像素</a-option>
        <a-option value="bm">根据BM ID搜索</a-option>
      </a-select>
      <a-checkbox v-model="slow">慢速加载（推荐）</a-checkbox>
      <div class="spacer" />
      <UsageBar :module-id="4" ref="usage" />
      <a-button type="primary" :loading="loading" @click="refresh"><template #icon><icon-refresh /></template>更新</a-button>
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

    <a-modal v-model:visible="shareVisible" title="BM之间分享像素" @ok="() => { shareVisible=false; act('BM间分享'); }">
      <a-alert style="margin-bottom:12px">将选中的 {{ selectedRows.length }} 个像素分享给目标 BM</a-alert>
      <a-input v-model="shareBm" placeholder="输入你要分享的BM ID" />
    </a-modal>

    <a-modal v-model:visible="createVisible" title="批量创建像素" @ok="doCreate">
      <a-form :model="createForm" layout="vertical">
        <a-form-item label="当前操作的BM"><a-input v-model="createForm.bm" placeholder="BM ID" /></a-form-item>
        <a-form-item label="像素名称"><a-input v-model="createForm.name" placeholder="输入像素名称" /></a-form-item>
        <a-form-item label="像素数量"><a-input-number v-model="createForm.count" :min="1" :max="100" placeholder="不能超过100" /></a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { Message } from '@arco-design/web-vue';
import { useModule } from '../../composables/useModule';
import UsageBar from '../../components/UsageBar.vue';
import ActionProgress from '../../components/ActionProgress.vue';

const { loading, keyword, selectedKeys, selectedRows, filtered, running, progress, load, saveNote, toggleFav, runAction } = useModule('pixel', 4);
const usage = ref(); const slow = ref(true); const filterMode = ref('all'); const curAction = ref('');
const shareVisible = ref(false); const createVisible = ref(false);
const shareBm = ref(''); const createForm = ref({ bm: '', name: '', count: 10 });

async function refresh() { await load(); usage.value?.reload(); }
async function act(label) { curAction.value = label; await runAction(label, selectedRows.value); }
function doCreate() { if (!createForm.value.bm) return Message.warning('请输入BM ID'); if (createForm.value.count > 100) return Message.warning('不能超过100'); createVisible.value = false; act('批量创建'); }
onMounted(refresh);
</script>
