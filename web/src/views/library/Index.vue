<template>
  <div class="module-card">
    <div class="page-toolbar">
      <a-input-search v-model="kw" placeholder="搜索广告主 / 关键词" style="width:320px" @search="search" />
      <a-select v-model="country" style="width:130px"><a-option value="US">美国</a-option><a-option value="HK">香港</a-option><a-option value="VN">越南</a-option></a-select>
      <a-button type="primary" :loading="loading" @click="search"><template #icon><icon-search /></template>搜索</a-button>
      <div class="spacer" />
      <span style="color:var(--color-text-3); font-size:13px">数据来源：Facebook 广告资料库</span>
    </div>

    <a-spin :loading="loading" style="width:100%">
      <a-row :gutter="16">
        <a-col v-for="v in videos" :key="v.id" :span="6" style="margin-bottom:16px">
          <a-card :bordered="true" hoverable>
            <template #cover>
              <div style="position:relative">
                <img :src="v.thumbnail" style="width:100%; height:150px; object-fit:cover" />
                <icon-play-circle style="position:absolute; inset:0; margin:auto; font-size:40px; color:#fff; opacity:.85" />
              </div>
            </template>
            <a-card-meta :title="v.page_name">
              <template #description>
                <div style="min-height:38px; font-size:12px; color:var(--color-text-3)">{{ v.ad_text }}</div>
                <div style="margin:6px 0"><a-tag size="small">{{ v.cta }}</a-tag><a-tag size="small" color="arcoblue">{{ v.start_date }}</a-tag></div>
                <a-space wrap size="mini"><a-tag v-for="p in v.platforms" :key="p" size="small" color="gray">{{ p }}</a-tag></a-space>
              </template>
            </a-card-meta>
            <template #actions>
              <a-tooltip content="下载视频"><span @click="download(v)"><icon-download /> 下载</span></a-tooltip>
            </template>
          </a-card>
        </a-col>
      </a-row>
      <a-empty v-if="!videos.length && !loading" description="输入关键词搜索广告资料库视频" />
    </a-spin>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { Message } from '@arco-design/web-vue';
import { moduleList } from '../../api';
import { sortModuleRows } from '../../utils/sortRows';

const kw = ref(''); const country = ref('US'); const loading = ref(false); const videos = ref([]);

async function search() {
  loading.value = true;
  try { const r = await moduleList('library', `?keyword=${encodeURIComponent(kw.value)}`); if (r.status === 1) videos.value = sortModuleRows(r.data); }
  finally { loading.value = false; }
}
function download(v) {
  Message.loading({ content: '正在解析下载地址...', duration: 800 });
  setTimeout(() => { window.open(v.video_url, '_blank'); Message.success('已开始下载（演示链接）'); }, 800);
}
onMounted(search);
</script>
