<template>
  <div class="module-card">
    <a-space wrap style="margin-bottom:12px">
      <a-button type="primary" @click="addVisible = true">添加广告贴</a-button>
      <a-button @click="globalVisible = true">全局监控配置</a-button>
      <a-button @click="blackVisible = true">设置黑名单</a-button>
    </a-space>

    <div class="page-toolbar">
      <a-input-search v-model="keyword" placeholder="请输入url搜索..." style="width:240px" allow-clear />
      <div class="spacer" />
      <SourceTag :source="source" />
      <UsageBar :module-id="5" ref="usage" />
      <a-button type="primary" :loading="loading" @click="refresh"><template #icon><icon-refresh /></template>刷新</a-button>
    </div>

    <div v-if="source==='live' && liveMeta" style="margin:-4px 0 10px; font-size:12px; color:var(--color-text-3)">
      实时扫描：广告账号 {{ liveMeta.accountsScanned }}/{{ liveMeta.accountsTotal }} · 广告 {{ liveMeta.ads }} 条
      <a-tag v-if="liveMeta.accountsScanned < liveMeta.accountsTotal" color="orange" size="small">
        已达上限，剩余 {{ liveMeta.accountsTotal - liveMeta.accountsScanned }} 个未扫描
      </a-tag>
      <a-tooltip v-if="liveMeta.errors && liveMeta.errors.length" :content="liveMeta.errors.join('\n')">
        <a-tag color="red" size="small">{{ liveMeta.errors.length }} 个账号报错</a-tag>
      </a-tooltip>
    </div>

    <a-table row-key="id" :data="filtered" :loading="loading" :pagination="{ pageSize:10, showTotal:true }" :scroll="{ x: 1300 }" size="small">
      <template #columns>
        <a-table-column title="开关" :width="70"><template #cell="{ record }">
          <a-switch :model-value="record.switch===1" size="small" @change="(v) => record.switch = v?1:0" /></template></a-table-column>
        <a-table-column title="状态" :width="100"><template #cell="{ record }">
          <a-tag :color="record.status==='监控中'?'green':record.status==='监控暂停'?'orange':'gray'">{{ record.status }}</a-tag></template></a-table-column>
        <a-table-column title="广告贴" :width="220"><template #cell="{ record }">
          <div><b>{{ record.title }}</b></div><div style="color:var(--color-text-3);font-size:12px">帖子ID: {{ record.post_id }}</div></template></a-table-column>
        <a-table-column title="管理账号" :width="130" data-index="manage_account" />
        <a-table-column title="主页信息" :width="180"><template #cell="{ record }">
          <div>{{ record.page_name }}</div><div style="color:var(--color-text-3);font-size:12px">{{ record.page_type }}</div></template></a-table-column>
        <a-table-column title="创建时间" :width="110" data-index="created_time" />
        <a-table-column title="自动拉黑" :width="90"><template #cell="{ record }">
          <a-tag :color="record.auto_block==='开'?'arcoblue':'gray'">{{ record.auto_block }}</a-tag></template></a-table-column>
        <a-table-column title="操作" :width="160" fixed="right"><template #cell="{ record }">
          <a-button type="text" size="mini" @click="singleVisible = true">单独配置</a-button>
          <a-popconfirm content="确认删除吗?" @ok="remove(record)"><a-button type="text" status="danger" size="mini">删除</a-button></a-popconfirm>
        </template></a-table-column>
      </template>
    </a-table>

    <a-modal v-model:visible="addVisible" title="添加广告贴" @ok="doAdd" width="560px">
      <a-form :model="addForm" layout="vertical">
        <a-form-item label="广告贴地址/帖子ID"><a-input v-model="addForm.url" placeholder="粘贴广告贴地址或帖子ID" />
          <a-button style="margin-top:8px" size="small" @click="detected = true">检测</a-button></a-form-item>
        <template v-if="detected">
          <a-form-item label="广告标题"><a-input v-model="addForm.title" placeholder="广告标题" /></a-form-item>
          <a-form-item label="选择主页"><a-select v-model="addForm.page" placeholder="请选择主页"><a-option>Page 1</a-option><a-option>Page 2</a-option></a-select></a-form-item>
        </template>
      </a-form>
    </a-modal>

    <a-modal v-model:visible="globalVisible" title="全局控评配置" @ok="() => { globalVisible=false; Message.success('配置成功~'); }" width="620px">
      <a-form layout="vertical">
        <a-divider orientation="left">过滤条件</a-divider>
        <a-form-item label="选择屏蔽词库"><a-select placeholder="请选择"><a-option>敏感词库A</a-option></a-select></a-form-item>
        <a-form-item label="自定义屏蔽词"><a-textarea placeholder="一行一个" :auto-size="{ minRows:2 }" /></a-form-item>
        <a-form-item label="过滤操作">
          <a-radio-group><a-radio value="hide">隐藏</a-radio><a-radio value="delete">删除</a-radio><a-radio value="black">设置黑名单</a-radio></a-radio-group>
        </a-form-item>
        <a-form-item label="拉黑操作"><a-radio-group><a-radio value="auto">自动确认</a-radio><a-radio value="manual">手动确认</a-radio></a-radio-group></a-form-item>
        <a-form-item label="自动同步到主页"><a-switch /></a-form-item>
      </a-form>
    </a-modal>

    <a-modal v-model:visible="blackVisible" title="设置黑名单" @ok="() => blackVisible=false">
      <a-select placeholder="选择黑名单模板"><a-option>默认黑名单</a-option></a-select>
    </a-modal>
    <a-modal v-model:visible="singleVisible" title="单条监控配置" @ok="() => { singleVisible=false; Message.success('配置成功~'); }">
      <a-form layout="vertical">
        <a-form-item label="过滤操作"><a-radio-group><a-radio value="hide">隐藏</a-radio><a-radio value="delete">删除</a-radio></a-radio-group></a-form-item>
        <a-form-item label="拉黑操作"><a-radio-group><a-radio value="auto">自动确认</a-radio><a-radio value="manual">手动确认</a-radio></a-radio-group></a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { Message } from '@arco-design/web-vue';
import { useModule } from '../../composables/useModule';
import { getAdPosts, bridgeError } from '../../api/fbBridge';
import UsageBar from '../../components/UsageBar.vue';
import SourceTag from '../../components/SourceTag.vue';

const { loading, keyword, filtered, rows, load, source } = useModule('adcomment', 5, {
  // live: real ad posts (object stories) across the user's ad accounts
  liveLoad: async () => {
    const r = await getAdPosts();
    if (r && r.success && Array.isArray(r.rows)) {
      liveMeta.value = r.meta || null;
      return { ok: true, rows: r.rows };
    }
    return { ok: false, info: bridgeError(r) };
  },
});
const liveMeta = ref(null);
const usage = ref();
const addVisible = ref(false); const globalVisible = ref(false); const blackVisible = ref(false); const singleVisible = ref(false);
const detected = ref(false);
const addForm = ref({ url: '', title: '', page: '' });

async function refresh() { await load(); usage.value?.reload(); }
function doAdd() { if (!addForm.value.url) return Message.warning('请输入广告贴地址'); addVisible.value = false; detected.value = false; Message.success('添加成功了~'); refresh(); }
function remove(record) { rows.value = rows.value.filter((r) => r.id !== record.id); Message.success('删除成功'); }
onMounted(refresh);
</script>
