import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router';
import { getToken } from '../api/request';

// On static hosts (GitHub Pages) use hash history so deep links / refreshes don't 404.
const STANDALONE = import.meta.env.VITE_STANDALONE === '1' || /github\.io$/.test(location.hostname) || location.protocol === 'file:';

// Mirrors fbspider's route tree (names, order, icons live in the layout menu).
const routes = [
  { path: '/', redirect: '/dashboard' },
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/login/Login.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/',
    component: () => import('../layout/DefaultLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: 'dashboard', name: 'dashboard', component: () => import('../views/dashboard/Index.vue'), meta: { title: '仪表盘', icon: 'icon-dashboard', order: 0 } },
      { path: 'adaccount', name: 'adaccount', component: () => import('../views/adaccount/Index.vue'), meta: { title: '广告账号管理', icon: 'icon-apps', order: 1, moduleId: 1 } },
      { path: 'adsManager', name: 'adsManager', component: () => import('../views/adsManager/Index.vue'), meta: { title: '广告及数据', icon: 'icon-list', order: 2, moduleId: 2 } },
      { path: 'bm', name: 'bm', component: () => import('../views/bm/Index.vue'), meta: { title: 'BM管理', icon: 'icon-nav', order: 3, moduleId: 7 } },
      { path: 'page', name: 'page', component: () => import('../views/page/Index.vue'), meta: { title: '主页管理', icon: 'icon-subscribed', order: 4, moduleId: 3 } },
      { path: 'pixel', name: 'pixel', component: () => import('../views/pixel/Index.vue'), meta: { title: '像素分享', icon: 'icon-share-alt', order: 5, moduleId: 4 } },
      { path: 'target', name: 'target', component: () => import('../views/target/Index.vue'), meta: { title: '兴趣定位', icon: 'icon-user-group', order: 6, moduleId: 8 } },
      { path: 'adcomment', name: 'adcomment', component: () => import('../views/adcomment/Index.vue'), meta: { title: '广告贴差评管理', icon: 'icon-message-banned', order: 7, moduleId: 5 } },
      { path: 'friend', name: 'friend', component: () => import('../views/friend/Index.vue'), meta: { title: '添加好友', icon: 'icon-user-add', order: 8, moduleId: 9 } },
      { path: 'library', name: 'library', component: () => import('../views/library/Index.vue'), meta: { title: '广告资料库视频下载', icon: 'icon-file-video', order: 9, moduleId: 10 } },
      { path: 'dataManager', name: 'dataManager', component: () => import('../views/dataManager/Index.vue'), meta: { title: '资产接收', icon: 'icon-cloud', order: 10, moduleId: 11 } },
      { path: 'pagecreate', name: 'pagecreate', component: () => import('../views/pagecreate/Index.vue'), meta: { title: '创建主页', icon: 'icon-plus-circle', order: 11, moduleId: 6 } },
      // hidden-from-menu utility routes
      { path: 'payment', name: 'payment', component: () => import('../views/payment/Index.vue'), meta: { title: '会员购买', hideInMenu: true } },
      { path: 'user', name: 'user', component: () => import('../views/user/Index.vue'), meta: { title: '用户中心', hideInMenu: true } },
      { path: 'support', name: 'support', component: () => import('../views/support/Index.vue'), meta: { title: '我的工单', hideInMenu: true } },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
];

const router = createRouter({
  history: STANDALONE ? createWebHashHistory() : createWebHistory(),
  routes,
});

router.beforeEach((to, _from, next) => {
  const authed = !!getToken();
  if (to.meta.requiresAuth !== false && !authed && to.name !== 'login') return next('/login');
  if (to.name === 'login' && authed) return next('/dashboard');
  next();
});

export default router;
