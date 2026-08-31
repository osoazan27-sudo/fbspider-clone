<template>
  <a-layout style="height: 100vh">
    <a-layout-sider :width="230" :collapsed="collapsed" collapsible breakpoint="lg" @collapse="(v) => (collapsed = v)">
      <div class="app-logo">
        <img :src="logo" alt="logo" />
        <span v-show="!collapsed">fbspider</span>
      </div>
      <a-menu
        :selected-keys="[route.name]"
        :auto-open-selected="true"
        show-collapse-button
        @menu-item-click="onMenu"
      >
        <a-menu-item v-for="m in menus" :key="m.name">
          <template #icon><component :is="m.icon" /></template>
          {{ m.title }}
        </a-menu-item>
      </a-menu>
    </a-layout-sider>

    <a-layout>
      <a-layout-header style="height: 60px">
        <div style="display:flex; align-items:center; height:60px; justify-content:space-between; background: var(--color-bg-2); border-bottom:1px solid var(--color-border-2);">
          <div style="display:flex; align-items:center; gap:14px; padding-left:18px;">
            <a-breadcrumb>
              <a-breadcrumb-item>fbspider</a-breadcrumb-item>
              <a-breadcrumb-item>{{ route.meta.title }}</a-breadcrumb-item>
            </a-breadcrumb>
          </div>

          <div class="nav-right">
            <!-- data source: live (extension) vs demo (mock) -->
            <a-tooltip :content="extInstalled ? (appStore.dataMode==='live' ? '实时：正在驱动你的 Facebook 会话' : '演示：使用内置示例数据') : '未检测到浏览器插件，仅演示数据'">
              <a-radio-group v-model="dataMode" type="button" size="small" @change="onModeChange">
                <a-radio value="live" :disabled="!extInstalled">
                  <a-badge :status="extInstalled ? (fbUser ? 'success' : 'warning') : 'danger'" /> 实时
                </a-radio>
                <a-radio value="mock">演示</a-radio>
              </a-radio-group>
            </a-tooltip>

            <!-- when 实时 is on, let the user see exactly where the chain breaks -->
            <DiagnoseButton v-if="appStore.dataMode==='live'" />

            <!-- current FB operating identity -->
            <a-select
              v-if="appStore.dataMode==='mock'"
              v-model="currentFbId"
              size="small"
              style="width: 190px"
              placeholder="选择 Facebook 账号"
              @change="onFbChange"
            >
              <a-option v-for="a in fbAccounts" :key="a.fbid" :value="a.fbid">
                {{ a.name }} ({{ a.fbid }})
              </a-option>
              <template #empty>
                <div style="padding:6px 10px; color: var(--color-text-3)">未绑定 Facebook 账号</div>
              </template>
            </a-select>
            <a-tag v-else-if="fbUser" color="green" size="small">FB: {{ fbUser }}</a-tag>
            <a-tag v-else color="orange" size="small">插件已装 · 未登录FB</a-tag>

            <a-tooltip :content="extInstalled ? '刷新 Facebook 会话' : '绑定/切换 Facebook 账号（演示）'">
              <a-button size="small" type="outline" :loading="refreshing" @click="extInstalled ? refreshFb() : (bindVisible = true)">
                <template #icon><icon-refresh v-if="extInstalled" /><icon-plus v-else /></template>
              </a-button>
            </a-tooltip>

            <a-button size="small" shape="circle" @click="toggleTheme">
              <template #icon><icon-moon v-if="appStore.theme==='light'" /><icon-sun v-else /></template>
            </a-button>

            <a-button size="small" shape="circle" @click="toggleLocale"><template #icon><icon-language /></template></a-button>

            <a-dropdown @select="onUserMenu">
              <a-space style="cursor:pointer">
                <a-avatar :size="30" style="background: rgb(var(--primary-6))">
                  {{ (userStore.username || 'U').slice(0,1).toUpperCase() }}
                </a-avatar>
                <span>{{ userStore.username }}</span>
              </a-space>
              <template #content>
                <a-doption value="user"><template #icon><icon-user /></template>{{ $t('messageBox.userCenter') }}</a-doption>
                <a-doption value="membership"><template #icon><icon-gift /></template>购买会员</a-doption>
                <a-doption value="support"><template #icon><icon-customer-service /></template>我的工单</a-doption>
                <a-doption value="logout"><template #icon><icon-export /></template>{{ $t('messageBox.logout') }}</a-doption>
              </template>
            </a-dropdown>
          </div>
        </div>
      </a-layout-header>

      <a-layout-content style="padding: 16px; overflow: auto;">
        <router-view v-slot="{ Component }">
          <keep-alive><component :is="Component" /></keep-alive>
        </router-view>
      </a-layout-content>
    </a-layout>

    <!-- bind FB account modal -->
    <a-modal v-model:visible="bindVisible" title="绑定 Facebook 账号" @ok="doBind">
      <a-alert style="margin-bottom:12px">
        真实的 fbspider 通过浏览器插件读取你已登录的 Facebook 会话。此复刻版用手动录入模拟该绑定。
      </a-alert>
      <a-form :model="bindForm" layout="vertical">
        <a-form-item label="Facebook UID"><a-input v-model="bindForm.fbid" placeholder="如 100021414202671" /></a-form-item>
        <a-form-item label="名称"><a-input v-model="bindForm.name" placeholder="如 John Doe" /></a-form-item>
      </a-form>
    </a-modal>
  </a-layout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Message } from '@arco-design/web-vue';
import { useUserStore } from '../store/user';
import { useAppStore } from '../store/app';
import * as api from '../api';
import { isExtensionInstalled, pingSession, refreshSession } from '../api/fbBridge';
import DiagnoseButton from '../components/DiagnoseButton.vue';

const route = useRoute();
const router = useRouter();
const { locale } = useI18n();
const userStore = useUserStore();

// base-aware so the logo resolves under a GitHub Pages sub-path (/<repo>/)
const logo = import.meta.env.BASE_URL + 'fbLogo.png';
const appStore = useAppStore();

const collapsed = ref(false);
const bindVisible = ref(false);
const bindForm = ref({ fbid: '', name: '' });
const fbAccounts = ref([]);
const currentFbId = ref(appStore.currentFb?.fbid || '');
const refreshing = ref(false);
const dataMode = ref(appStore.dataMode);
const extInstalled = computed(() => appStore.extInstalled);
const fbUser = computed(() => appStore.fbUser);

async function detectExtension() {
  const installed = await isExtensionInstalled();
  if (!installed) { appStore.setExt(false); return; }
  const ping = await pingSession();
  appStore.setExt(true, ping && ping.user);
  // if the extension is present with a session, default to live
  if (ping && ping.hasSession && appStore.dataMode !== 'mock') { appStore.setDataMode('live'); dataMode.value = 'live'; }
}
async function refreshFb() {
  refreshing.value = true;
  try {
    const r = await refreshSession();
    const user = r && r.session && r.session.user;
    appStore.setExt(true, user);
    if (user) Message.success('已刷新 Facebook 会话：' + user);
    else Message.warning('未检测到 Facebook 登录，请先在浏览器登录 Facebook');
  } finally { refreshing.value = false; }
}
function onModeChange(v) {
  appStore.setDataMode(v);
  if (v === 'live' && !appStore.fbUser) refreshFb();
}

const menus = computed(() =>
  router.getRoutes()
    .filter((r) => r.meta && r.meta.order !== undefined && !r.meta.hideInMenu)
    .sort((a, b) => a.meta.order - b.meta.order)
    .map((r) => ({ name: r.name, title: r.meta.title, icon: r.meta.icon }))
);

function onMenu(name) { if (route.name !== name) router.push({ name }); }

async function loadFb() {
  try {
    const r = await api.accountList(userStore.id);
    if (r.status === 1) {
      fbAccounts.value = r.data || [];
      if (!currentFbId.value && fbAccounts.value[0]) {
        currentFbId.value = fbAccounts.value[0].fbid;
        appStore.setCurrentFb(fbAccounts.value[0]);
      }
    }
  } catch {}
}

function onFbChange(fbid) {
  const a = fbAccounts.value.find((x) => x.fbid === fbid);
  if (a) appStore.setCurrentFb(a);
}

async function doBind() {
  if (!bindForm.value.fbid) return Message.warning('请输入 Facebook UID');
  const r = await api.addAccount(bindForm.value);
  if (r.status === 1) {
    Message.success('绑定成功');
    await api.updateUserFb({ fbid: bindForm.value.fbid, fb_name: bindForm.value.name });
    bindVisible.value = false;
    bindForm.value = { fbid: '', name: '' };
    await loadFb();
  } else Message.error(r.info || '绑定失败');
}

function toggleTheme() { appStore.toggleTheme(appStore.theme === 'light'); }
function toggleLocale() {
  const next = locale.value === 'zh-CN' ? 'en-US' : 'zh-CN';
  locale.value = next; localStorage.setItem('arco-locale', next);
}

function onUserMenu(v) {
  if (v === 'logout') { userStore.logout(); router.replace('/login'); return; }
  if (v === 'membership') return router.push({ name: 'payment' });
  router.push({ name: v });
}

onMounted(async () => {
  appStore.initTheme();
  if (!userStore.id) { try { await userStore.fetchInfo(); } catch {} }
  await loadFb();
  detectExtension();
});
</script>
