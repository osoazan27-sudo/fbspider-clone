<template>
  <div class="module-card">
    <a-row :gutter="16">
      <a-col :span="17">
        <div class="page-toolbar">
          <a-input-search v-model="kw" placeholder="请输入兴趣关键字" style="width:260px" @search="search" />
          <a-select v-model="lang" style="width:130px"><a-option value="zh">中文</a-option><a-option value="en">English</a-option></a-select>
          <SourceTag :source="source" />
      <a-button type="primary" :loading="loading" @click="search"><template #icon><icon-search /></template>搜索</a-button>
          <div class="spacer" />
          <a-button :disabled="!selectedKeys.length" @click="copySelected">复制选中的 {{ selectedKeys.length }} 个</a-button>
          <a-button type="primary" :disabled="!selectedKeys.length" @click="saveVisible = true">保存选中的</a-button>
        </div>

        <a-tabs v-model:active-key="typeTab">
          <a-tab-pane key="all" :title="`全部 ${results.length}`" />
          <a-tab-pane key="人口统计" :title="`人口统计 ${count('人口统计')}`" />
          <a-tab-pane key="兴趣" :title="`兴趣 ${count('兴趣')}`" />
          <a-tab-pane key="行为" :title="`行为 ${count('行为')}`" />
        </a-tabs>

        <a-table row-key="id" :data="typeFiltered" :loading="loading"
          :row-selection="{ type:'checkbox', showCheckedAll:true }" v-model:selected-keys="selectedKeys"
          :pagination="{ pageSize:12, showTotal:true }" size="small">
          <template #columns>
            <a-table-column title="序号" :width="60"><template #cell="{ rowIndex }">{{ rowIndex+1 }}</template></a-table-column>
            <a-table-column title="关键词" data-index="keyword" />
            <a-table-column title="分类" data-index="category" />
            <a-table-column title="预估范围" :width="160"><template #cell="{ record }">{{ record.audience }}</template></a-table-column>
            <a-table-column title="链接" :width="80"><template #cell="{ record }"><a-link :href="record.link" target="_blank">打开</a-link></template></a-table-column>
          </template>
        </a-table>
      </a-col>

      <a-col :span="7">
        <a-card title="“关键字”文件列表" :bordered="false">
          <template #extra><a-button size="mini" @click="loadFiles">刷新列表</a-button></template>
          <a-list :data="files" size="small">
            <template #item="{ item }">
              <a-list-item>
                <a-list-item-meta :title="item.name" :description="item.create_time" />
                <template #actions>
                  <a-button type="text" size="mini" @click="openFile(item)">查看</a-button>
                  <a-popconfirm content="确认删除吗?" @ok="delFile(item)"><a-button type="text" status="danger" size="mini">删除</a-button></a-popconfirm>
                </template>
              </a-list-item>
            </template>
            <template #empty><a-empty description="暂无保存的关键字文件" /></template>
          </a-list>
        </a-card>
      </a-col>
    </a-row>

    <a-modal v-model:visible="saveVisible" title="保存关键字文件" @ok="doSave">
      <a-input v-model="fileName" placeholder="请输入文件名" />
    </a-modal>

    <a-modal v-model:visible="fileVisible" :title="curFile?.name" width="720px" :footer="false">
      <a-table :data="fileItems" :pagination="{ pageSize:10 }" size="small">
        <template #columns>
          <a-table-column title="关键词" data-index="keyword" />
          <a-table-column title="分类" data-index="category" />
          <a-table-column title="预估范围" data-index="audience" />
        </template>
      </a-table>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { Message } from '@arco-design/web-vue';
import { useUserStore } from '../../store/user';
import { interestSearch, keywordFiles, saveKeywordFile, deleteKeywordFile, keywordItems } from '../../api';
import { searchInterests } from '../../api/fbBridge';
import { useAppStore } from '../../store/app';
import SourceTag from '../../components/SourceTag.vue';

const userStore = useUserStore();
const kw = ref(''); const lang = ref('zh'); const loading = ref(false);
const results = ref([]); const selectedKeys = ref([]); const typeTab = ref('all');
const files = ref([]); const saveVisible = ref(false); const fileName = ref('');
const fileVisible = ref(false); const curFile = ref(null); const fileItems = ref([]);

const appStore = useAppStore();
const source = ref('mock');

const typeFiltered = computed(() => typeTab.value === 'all' ? results.value : results.value.filter((r) => r.type === typeTab.value));
function count(t) { return results.value.filter((r) => r.type === t).length; }

async function search() {
  if (!kw.value.trim()) return Message.warning('请先选择关键字！');
  loading.value = true; selectedKeys.value = [];
  try {
    // live: Facebook's real ad-interest search (/search?type=adinterest)
    if (appStore.dataMode === 'live') {
      if (!appStore.extInstalled) {
        Message.error('当前是「实时」但没有检测到插件，已改用演示数据');
      } else {
        const r = await searchInterests(kw.value.trim(), 100);
        if (r && r.success && Array.isArray(r.rows)) { results.value = r.rows; source.value = 'live'; return; }
        Message.warning('实时搜索失败：' + ((r && (r.info || r.error)) || '未知错误') + '（已回退演示数据）');
      }
    }
    const r = await interestSearch(kw.value.trim());
    if (r.status === 1) results.value = r.data;
    source.value = 'mock';
  } finally { loading.value = false; }
}
function copySelected() {
  const rows = results.value.filter((r) => selectedKeys.value.includes(r.id));
  navigator.clipboard?.writeText(rows.map((r) => r.keyword).join('\n'));
  Message.success(`已复制 ${rows.length} 个关键字`);
}
async function loadFiles() { const r = await keywordFiles(userStore.id); if (r.status === 1) files.value = r.data; }
async function doSave() {
  if (!fileName.value) return Message.warning('请输入文件名');
  const items = results.value.filter((r) => selectedKeys.value.includes(r.id));
  const r = await saveKeywordFile(userStore.id, { name: fileName.value, items });
  if (r.status === 1) { Message.success('保存成功'); saveVisible.value = false; fileName.value = ''; loadFiles(); }
}
async function delFile(item) { await deleteKeywordFile(userStore.id, item.id); Message.success('已删除'); loadFiles(); }
async function openFile(item) { curFile.value = item; const r = await keywordItems(userStore.id, item.id); if (r.status === 1) { fileItems.value = r.data; fileVisible.value = true; } }
onMounted(loadFiles);
</script>
