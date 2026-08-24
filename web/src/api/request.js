import axios from 'axios';
import { Message } from '@arco-design/web-vue';
import router from '../router';

// mirrors fbspider's axios wrapper: attaches Bearer token + uid headers,
// unwraps the { status, data, info } envelope, and bounces to /login on auth failure.
const request = axios.create({ baseURL: '', timeout: 20000 });

export function getToken() { return localStorage.getItem('token') || ''; }
export function setToken(t) { localStorage.setItem('token', t || ''); }
export function clearToken() { localStorage.removeItem('token'); localStorage.removeItem('uid'); }

request.interceptors.request.use((config) => {
  config.headers.authorization = getToken();
  config.headers.uid = localStorage.getItem('uid') || '';
  return config;
});

request.interceptors.response.use(
  (resp) => {
    const data = resp.data;
    // auth failures use status === -1 like the original
    if (data && data.status === -1) {
      clearToken();
      Message.error(data.info || '登录状态失效，请重新登录');
      router.replace('/login');
      return Promise.reject(data);
    }
    return data;
  },
  (err) => {
    const resp = err.response;
    if (resp && resp.status === 401) {
      clearToken();
      router.replace('/login');
    }
    Message.error((resp && resp.data && resp.data.info) || err.message || '请求失败');
    return Promise.reject(err);
  }
);

export default request;
