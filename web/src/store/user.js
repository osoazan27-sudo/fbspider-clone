import { defineStore } from 'pinia';
import * as api from '../api';
import { setToken, clearToken } from '../api/request';

export const useUserStore = defineStore('user', {
  state: () => ({
    id: null,
    email: '',
    username: '',
    is_active: 0,
    registration_time: '',
    fbid: '',
    fb_name: '',
    role: 'user',
  }),
  getters: {
    userInfo: (s) => ({ ...s }),
  },
  actions: {
    setInfo(info) { Object.assign(this, info); if (info.id) localStorage.setItem('uid', String(info.id)); },
    async login(payload) {
      const r = await api.login(payload);
      if (r.status === 1 && r.data && r.data.token) {
        setToken(r.data.token);
        this.setInfo(r.data);
        return r;
      }
      throw r;
    },
    async register(payload) {
      const r = await api.register(payload);
      if (r.status === 1 && r.data && r.data.token) {
        setToken(r.data.token);
        this.setInfo(r.data);
        return r;
      }
      throw r;
    },
    async fetchInfo() {
      const r = await api.getInfo();
      if (r.status === 1) this.setInfo(r.data);
      return r;
    },
    async logout() {
      try { await api.logout(); } catch {}
      clearToken();
      this.$reset();
    },
  },
});
