// Runs on *.facebook.com. Scrapes the current session tokens from the live page
// and hands them to the background worker. Content scripts run in an isolated
// world but can still read the page's HTML source (which embeds the bootstrap
// JSON) and non-httponly cookies (c_user).

(function () {
  function first(html, patterns) {
    for (const re of patterns) { const m = html.match(re); if (m && m[1]) return m[1]; }
    return '';
  }
  function jazoest(fbDtsg) {
    if (!fbDtsg) return '';
    let s = 0; for (let i = 0; i < fbDtsg.length; i++) s += fbDtsg.charCodeAt(i);
    return '2' + s;
  }
  function scrape() {
    const html = document.documentElement ? document.documentElement.outerHTML : '';
    const cookie = document.cookie || '';
    const cUser = (cookie.match(/c_user=(\d+)/) || [])[1] || '';
    const out = { user: cUser };
    out.fb_dtsg = first(html, [
      /\["DTSGInitialData",\[\],\{"token":"([^"]+)"/,
      /\["DTSGInitData",\[\],\{"token":"([^"]+)"/,
      /name="fb_dtsg" value="([^"]+)"/,
      /"dtsg":\{"token":"([^"]+)"/,
    ]);
    out.lsd = first(html, [/\["LSD",\[\],\{"token":"([^"]+)"/, /name="lsd" value="([^"]+)"/]);
    if (!out.user) out.user = first(html, [/"USER_ID":"(\d+)"/, /"actorID":"(\d+)"/]);
    // EAA tokens are base64url — the charset MUST include _ and - or the token
    // is truncated at the first one (fails later with code 190).
    const tokens = (html.match(/EAA[0-9A-Za-z_-]{20,}/g) || []).sort((a, b) => b.length - a.length);
    if (tokens.length) out.accessToken = tokens[0];
    out.spin_r = first(html, [/"__spin_r":(\d+)/]);
    out.spin_t = first(html, [/"__spin_t":(\d+)/]);
    out.spin_b = first(html, [/"__spin_b":"([^"]+)"/]);
    out.dyn = first(html, [/"__dyn":"([^"]+)"/]);
    if (out.fb_dtsg) out.jazoest = jazoest(out.fb_dtsg);
    // drop empties so we never overwrite a good value with ''
    Object.keys(out).forEach((k) => { if (!out[k]) delete out[k]; });
    return out;
  }

  function report() {
    const tokens = scrape();
    if (tokens.user || tokens.fb_dtsg || tokens.accessToken) {
      chrome.runtime.sendMessage({ type: 'CAPTURE_TOKENS', tokens }).catch(() => {});
    }
  }

  // capture now and shortly after (SPA hydration can inject the token late)
  report();
  setTimeout(report, 2500);
  setTimeout(report, 6000);

  // ---- private-GraphQL recorder ----
  // Inject the main-world interceptor, relay its captures to the background, and
  // mirror the recording on/off flag down to it.
  const REC_TAG = '__FBSPIDER_REC__';
  try {
    const el = document.createElement('script');
    el.src = chrome.runtime.getURL('inject-recorder.js');
    el.onload = () => el.remove();
    (document.head || document.documentElement).appendChild(el);
  } catch (_) {}

  // captures from the page -> background storage
  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data[REC_TAG] !== true) return;
    chrome.runtime.sendMessage({ type: 'CAPTURE_RECIPE', recipe: e.data.recipe }).catch(() => {});
  });

  // push the current recording state to the page, and keep it in sync
  function pushRecordingState() {
    chrome.storage.local.get('fbspider_recording').then((o) => {
      window.postMessage({ __fbspiderRecCtl: !!o.fbspider_recording }, location.origin);
    }).catch(() => {});
  }
  pushRecordingState();
  setTimeout(pushRecordingState, 800);        // after the injected script is ready
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.fbspider_recording) {
      window.postMessage({ __fbspiderRecCtl: !!changes.fbspider_recording.newValue }, location.origin);
    }
  });
})();
