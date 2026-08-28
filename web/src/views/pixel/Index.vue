<template>
  <div class="module-card">
    <a-space wrap style="margin-bottom:12px">
      <a-button type="primary" @click="shareVisible = true">BM间分享</a-button>
      <a-button @click="assignVisible = true">分配给账号</a-button>
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

    <a-modal v-model:visible="shareVisible" title="BM之间分享像素" @ok="doShare">
      <a-alert style="margin-bottom:12px">将选中的 {{ selectedRows.length }} 个像素分享给目标 BM</a-alert>
      <a-input v-model="shareBm" placeholder="输入你要分享的BM ID" />
      <div style="margin-top:10px">
        <a-checkbox v-model="unshareMode">改为「取消分享」（把像素从该 BM 收回）</a-checkbox>
      </div>
      <a-alert v-if="isLive" type="warning" style="margin-top:12px">
        实时模式：这会真实修改你 Facebook 上的像素共享关系。
      </a-alert>
    </a-modal>

    <a-modal v-model:visible="assignVisible" title="分配像素给广告账号" @ok="doAssign">
      <a-alert style="margin-bottom:12px">将选中的 {{ selectedRows.length }} 个像素分配给该广告账号</a-alert>
      <a-input v-model="assignAccount" placeholder="输入广告账号 ID（可带或不带 act_ 前缀）" />
      <div style="margin-top:10px">
        <a-checkbox v-model="unassignMode">改为「取消分配」</a-checkbox>
      </div>
      <a-alert v-if="isLive" type="warning" style="margin-top:12px">
        实时模式：这会真实修改你 Facebook 上的像素分配。
      </a-alert>
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
import { ref, computed, onMounted } from 'vue';
import { Message } from '@arco-design/web-vue';
import { useModule } from '../../composables/useModule';
import { useAppStore } from '../../store/app';
import { getAllPixels } from '../../api/fbBridge';
import UsageBar from '../../components/UsageBar.vue';
import SourceTag from '../../components/SourceTag.vue';
import ActionProgress from '../../components/ActionProgress.vue';

const { loading, keyword, selectedKeys, selectedRows, filtered, running, progress, load, saveNote, toggleFav, runAction, source } = useModule('pixel', 4, {
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
const shareVisible = ref(false); const createVisible = ref(false); const assignVisible = ref(false);
const shareBm = ref(''); const createForm = ref({ bm: '', name: '', count: 10 });
const assignAccount = ref(''); const unshareMode = ref(false); const unassignMode = ref(false);
const appStore = useAppStore();
const isLive = computed(() => appStore.isLive);

async function refresh() { await load(); usage.value?.reload(); }
async function act(label, ctx) { curAction.value = label; await runAction(label, selectedRows.value, ctx); }

function doShare() {
  if (!shareBm.value) return Message.warning('请输入BM ID');
  if (!selectedRows.value.length) return Message.warning('请先选择像素');
  shareVisible.value = false;
  act(unshareMode.value ? '取消BM分享' : 'BM间分享', { targetBm: shareBm.value.trim() });
}
function doAssign() {
  if (!assignAccount.value) return Message.warning('请输入广告账号 ID');
  if (!selectedRows.value.length) return Message.warning('请先选择像素');
  assignVisible.value = false;
  act(unassignMode.value ? '取消账号分配' : '分配给账号', { accountId: assignAccount.value.trim() });
}
function doCreate() { if (!createForm.value.bm) return Message.warning('请输入BM ID'); if (createForm.value.count > 100) return Message.warning('不能超过100'); createVisible.value = false; act('批量创建'); }
onMounted(refresh);
</script>
