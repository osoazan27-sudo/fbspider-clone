<template>
  <div class="login-wrapper">
    <div class="login-banner">
      <div class="brand">
        <img :src="logo" alt="logo" />
        <span style="font-size:22px; font-weight:700">fbspider</span>
      </div>
      <h1>{{ $t('login.banner.slogan1') }}</h1>
      <p>{{ $t('login.banner.subSlogan1') }}</p>
      <p style="margin-top:28px; font-size:14px; opacity:.85">
        · 广告账号 / BM / 主页 / 像素 一站式管理<br />
        · 兴趣定位词突破限制，API 全量展示<br />
        · 广告贴差评自动控评、批量拉黑<br />
        · 广告资料库视频下载、批量创建主页
      </p>
    </div>

    <div class="login-form-area">
      <div class="login-card">
        <h2>{{ mode === 'login' ? $t('login.form.title') : '注册 fbspider' }}</h2>
        <div class="sub">加入 fbspider，发现全新的数字世界</div>

        <!-- Arco's a-form emits submit with a {values,errors} object, not a DOM
             event, so the .prevent modifier throws "preventDefault is not a
             function" and the handler never runs. Bind submit plainly. -->
        <a-form ref="formRef" :model="form" layout="vertical" @submit="submit">
          <a-form-item field="email" hide-label
            :rules="[{ required: true, message: '邮箱不能为空' }, { type: 'email', message: '请填写正确的邮箱格式' }]">
            <a-input v-model="form.email" size="large" :placeholder="$t('login.form.userName.placeholder')">
              <template #prefix><icon-email /></template>
            </a-input>
          </a-form-item>

          <a-form-item field="password" hide-label
            :rules="[{ required: true, message: '密码不能为空' }]">
            <a-input-password v-model="form.password" size="large" :placeholder="$t('login.form.password.placeholder')">
              <template #prefix><icon-lock /></template>
            </a-input-password>
          </a-form-item>

          <a-form-item v-if="mode === 'register'" field="confirm" hide-label
            :rules="[{ required: true, message: '确认密码不能为空' }]">
            <a-input-password v-model="form.confirm" size="large" placeholder="确认密码">
              <template #prefix><icon-lock /></template>
            </a-input-password>
          </a-form-item>

          <div v-if="mode === 'login'" style="display:flex; justify-content:space-between; margin-bottom:16px">
            <a-checkbox v-model="remember">{{ $t('login.form.rememberPassword') }}</a-checkbox>
            <a-link>{{ $t('login.form.forgetPassword') }}</a-link>
          </div>

          <a-button type="primary" long size="large" :loading="loading" html-type="submit">
            {{ mode === 'login' ? $t('login.form.login') : '注册账号' }}
          </a-button>

          <div style="text-align:center; margin-top:16px">
            <a-link @click="toggleMode">
              {{ mode === 'login' ? $t('login.form.register') : '已有账户？返回登录' }}
            </a-link>
          </div>
        </a-form>

        <a-alert type="normal" style="margin-top:22px">
          演示模式：输入任意邮箱和密码即可登录（数据保存在本地浏览器）
        </a-alert>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { Message } from '@arco-design/web-vue';
import { useUserStore } from '../../store/user';

const router = useRouter();
const userStore = useUserStore();

// base-aware so the logo resolves under a GitHub Pages sub-path (/<repo>/)
const logo = import.meta.env.BASE_URL + 'fbLogo.png';

const mode = ref('login');
const loading = ref(false);
const remember = ref(true);
const formRef = ref();
const form = ref({
  email: localStorage.getItem('remember_email') || '',
  password: '',
  confirm: '',
});

function toggleMode() { mode.value = mode.value === 'login' ? 'register' : 'login'; }

// Read the real <input> values as a fallback. Autofill and some input methods
// can set the DOM value without firing the event Arco's v-model listens to, so
// never trust the reactive model alone — otherwise submit silently no-ops.
function readFields() {
  const inputs = [...document.querySelectorAll('.login-card input')];
  const emailEl = inputs.find((i) => i.type !== 'password');
  const passEls = inputs.filter((i) => i.type === 'password');
  const email = (form.value.email || emailEl?.value || '').trim();
  const password = form.value.password || passEls[0]?.value || '';
  const confirm = form.value.confirm || passEls[1]?.value || '';
  // keep the reactive model in sync so downstream code + UI agree
  form.value.email = email;
  form.value.password = password;
  if (mode.value === 'register') form.value.confirm = confirm;
  return { email, password, confirm };
}

async function submit() {
  const { email, password, confirm } = readFields();
  // lightweight validation that doesn't depend on Arco reading the model in time
  if (!email) return Message.error('邮箱不能为空');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Message.error('请填写正确的邮箱格式');
  if (!password) return Message.error('密码不能为空');
  if (mode.value === 'register' && password !== confirm) {
    return Message.error('两次输入的密码不一致');
  }
  loading.value = true;
  try {
    if (mode.value === 'login') {
      await userStore.login({ email, password });
      if (remember.value) localStorage.setItem('remember_email', email);
      Message.success('欢迎使用');
    } else {
      await userStore.register({ email, password });
      Message.success('注册成功，欢迎使用');
    }
    router.replace('/dashboard');
  } catch (e) {
    Message.error(e?.info || '登录出错，请重试');
  } finally {
    loading.value = false;
  }
}
</script>
