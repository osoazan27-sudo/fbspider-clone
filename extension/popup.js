function send(msg) {
  return new Promise((resolve) => chrome.runtime.sendMessage(msg, (r) => resolve(r || {})));
}

function render(sess) {
  const set = (id, val, ok) => {
    const el = document.getElementById(id);
    el.textContent = val;
    el.className = ok ? 'ok' : 'bad';
  };
  set('user', sess.user || '未检测', !!sess.user);
  set('dtsg', sess.fb_dtsg || '—', !!sess.fb_dtsg);
  set('token', sess.accessToken || sess.eaab || '—', !!(sess.accessToken || sess.eaab));
  document.getElementById('updated').textContent = sess.updatedAt ? new Date(sess.updatedAt).toLocaleString() : '—';
}

async function load() {
  const r = await send({ type: 'GET_SESSION' });
  if (r && r.data) render(r.data);
}

document.getElementById('refresh').addEventListener('click', async () => {
  const btn = document.getElementById('refresh');
  btn.textContent = '正在刷新…'; btn.disabled = true;
  const status = await send({ type: 'REFRESH_SESSION' });
  if (status && status.session) render(status.session);
  const srcEl = document.getElementById('sources');
  if (status && status.sources) {
    srcEl.innerHTML = status.sources.map((s) =>
      `${s.ok ? '✓' : '✗'} ${new URL(s.url).host}${s.got ? ' → ' + s.got.join(',') : (s.error ? ' (' + s.error + ')' : '')}`
    ).join('<br>');
  }
  btn.textContent = '刷新 Facebook 会话'; btn.disabled = false;
});

document.getElementById('openfb').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://www.facebook.com/' });
});

load();
