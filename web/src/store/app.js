import { defineStore } from 'pinia';

export const useAppStore = defineStore('app', {
  state: () => ({
    theme: localStorage.getItem('theme') || 'light',
    navbar: true,
    menuCollapse: false,
    // the FB identity the "plugin" is currently operating as
    currentFb: JSON.parse(localStorage.getItem('currentFb') || 'null'),
    // data source: 'live' drives the real Facebook session via the extension,
    // 'mock' uses the demo backend. Auto-set to 'live' when the extension is found.
    dataMode: localStorage.getItem('dataMode') || 'mock',
    extInstalled: false,
    fbUser: null,
  }),
  getters: {
    isLive: (s) => s.dataMode === 'live' && s.extInstalled,
  },
  actions: {
    toggleTheme(dark) {
      this.theme = dark ? 'dark' : 'light';
      localStorage.setItem('theme', this.theme);
      if (dark) document.body.setAttribute('arco-theme', 'dark');
      else document.body.removeAttribute('arco-theme');
    },
    initTheme() { this.toggleTheme(this.theme === 'dark'); },
    setCurrentFb(fb) { this.currentFb = fb; localStorage.setItem('currentFb', JSON.stringify(fb)); },
    setDataMode(mode) { this.dataMode = mode; localStorage.setItem('dataMode', mode); },
    setExt(installed, user) { this.extInstalled = installed; this.fbUser = user || null; },
  },
});
