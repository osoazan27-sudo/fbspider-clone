<template>
  <div>
    <!-- account + FB detection -->
    <a-row :gutter="16">
      <a-col :span="14">
        <a-card title="账号信息" :bordered="false">
          <a-descriptions :column="2" bordered size="medium">
            <a-descriptions-item label="账号ID">{{ userStore.id }}</a-descriptions-item>
            <a-descriptions-item label="会员等级"><a-tag color="arcoblue">普通用户</a-tag></a-descriptions-item>
            <a-descriptions-item label="邮箱">{{ userStore.email }}</a-descriptions-item>
            <a-descriptions-item label="注册时间">{{ userStore.registration_time }}</a-descriptions-item>
          </a-descriptions>
        </a-card>
      </a-col>
      <a-col :span="10">
        <a-card :bordered="false">
          <template #title>Facebook 账号<a-tag style="margin-left:8px" :color="fb.fbid ? 'green' : 'gray'">{{ fb.fbid ? '已绑定' : '未绑定' }}</a-tag></template>
          <template #extra><a-button type="text" size="small" :loading="checking" @click="recheck">重新检测</a-button></template>
          <div v-if="fb.fbid">
            <p>Facebook账号：<b>{{ fb.name }}</b></p>
            <p>Facebook账号ID：{{ fb.fbid }}
              <a-button type="text" size="mini" @click="copy(fb.fbid)"><template #icon><icon-copy /></template>复制</a-button>
            </p>
            <p>Facebook账号链接：
              <a-link :href="`https://www.facebook.com/${fb.fbid}`" target="_blank">https://www.facebook.com/{{ fb.fbid }}</a-link>
            </p>
          </div>
          <a-empty v-else description="未检测到 Facebook 账号，请在右上角绑定">
            <a-button type="primary" @click="$router.push({ name: 'user' })">前往绑定</a-button>
          </a-empty>
        </a-card>
      </a-col>
    </a-row>

    <!-- all functions -->
    <h3 style="margin:22px 0 12px">所有功能</h3>
    <div class="func-grid">
      <div v-for="f in funcs" :key="f.name" class="func-tile" @click="$router.push({ name: f.name })">
        <component :is="f.icon" class="ic" />
        <div>
          <h3>{{ f.title }}</h3>
          <p>{{ f.tip }}</p>
        </div>
      </div>
    </div>

    <!-- more business -->
    <h3 style="margin:22px 0 12px">更多业务</h3>
    <div class="func-grid">
      <div v-for="b in business" :key="b.title" class="func-tile" @click="open(b.url)">
        <component :is="b.icon" class="ic" />
        <div><h3>{{ b.title }}</h3><p>{{ b.tip }}</p></div>
      </div>
    </div>

    <!-- common navigation -->
    <h3 style="margin:22px 0 12px">常用导航</h3>
    <a-space wrap>
      <a-button @click="open('https://www.facebook.com')"><template #icon><icon-facebook /></template>Facebook官网</a-button>
      <a-button @click="open('https://fbspider.com')"><template #icon><icon-message /></template>fbspider讨论区</a-button>
      <a-button @click="open('https://business.facebook.com')"><template #icon><icon-nav /></template>Business Manager</a-button>
      <a-button @click="open('https://www.facebook.com/adsmanager')"><template #icon><icon-apps /></template>Ads Manager</a-button>
    </a-space>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { Message } from '@arco-design/web-vue';
import { useUserStore } from '../../store/user';
import { useAppStore } from '../../store/app';
import { getUserConfig } from '../../api';

const userStore = useUserStore();
const appStore = useAppStore();
const checking = ref(false);
const fb = ref({ fbid: appStore.currentFb?.fbid || '', name: appStore.currentFb?.name || '' });

const funcs = [
  { name: 'adaccount', title: '广告账号管理', icon: 'icon-apps', tip: '检测所有广告个号数据和权限管理' },
  { name: 'bm', title: 'BM账号管理', icon: 'icon-nav', tip: '检测所有BM账号数据和权限管理' },
  { name: 'page', title: '主页管理', icon: 'icon-subscribed', tip: '检测所有主页数据和权限管理' },
  { name: 'pixel', title: '像素分享', icon: 'icon-share-alt', tip: '检测所有像素和权限管理' },
  { name: 'target', title: '兴趣定位', icon: 'icon-user-group', tip: '突破限制，通过API展示所有兴趣词' },
  { name: 'adcomment', title: '广告贴差评管理', icon: 'icon-message-banned', tip: '管理广告贴下的差评，图片，网址' },
  { name: 'friend', title: '添加好友', icon: 'icon-user-add', tip: '管理facebook的好友请求，添加好友' },
  { name: 'library', title: '广告资料库视频下载', icon: 'icon-file-video', tip: '下载广告资料库中的视频素材' },
];

const business = [
  { title: 'Veryfb论坛', icon: 'icon-message', tip: '每天必上的Facebook论坛', url: 'https://fbspider.com' },
  { title: 'fbspider工具', icon: 'icon-tool', tip: '人人必备的Facebook工具', url: 'https://fbspider.com' },
  { title: 'Facebook账号开户', icon: 'icon-user-add', tip: 'Facebook，Google，TikTok账号开户', url: 'https://fbspider.com' },
  { title: '2FA', icon: 'icon-safe', tip: '验证码转换工具', url: 'https://fbspider.com' },
  { title: 'Facebook快捷导航', icon: 'icon-compass', tip: 'Facebook各种功能网址导航', url: 'https://fbspider.com' },
];

function copy(t) { navigator.clipboard?.writeText(String(t)); Message.success('已复制'); }
function open(u) { window.open(u, '_blank'); }
async function recheck() {
  checking.value = true;
  try {
    const r = await getUserConfig();
    if (r.status === 1 && r.data?.fbid) fb.value = { fbid: r.data.fbid, name: r.data.fb_name };
    else Message.info('未检测到已绑定的 Facebook 账号');
  } finally { checking.value = false; }
}
onMounted(() => { if (fb.value.fbid) return; recheck(); });
</script>
