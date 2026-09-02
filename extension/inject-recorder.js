// Injected into facebook.com's MAIN world (content scripts run isolated and
// can't see the page's own fetch/XHR). While recording is on, it observes POSTs
// to /api/graphql/ and reports each as a "recipe": the friendly name, doc_id,
// and the variables SHAPE. It deliberately does NOT capture cookies, and it
// masks token-like param values — those never need to leave the machine and the
// background worker already has the live session tokens.
(function () {
  if (window.__fbspiderRecorder) return;
  window.__fbspiderRecorder = true;
  const TAG = '__FBSPIDER_REC__';
  let recording = false;

  // control channel from the content script (isolated world)
  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data.__fbspiderRecCtl == null) return;
    recording = !!e.data.__fbspiderRecCtl;
  });

  const SECRET = /^(fb_dtsg|jazoest|lsd|__user|access_token|fb_api_caller_class|__spin_.*|__csr|__hsi|__s|__comet_req|dpr|__ccg|__rev|__aaid|av)$/i;

  function bodyToParams(body) {
    if (typeof body === 'string') return new URLSearchParams(body);
    if (body instanceof URLSearchParams) return body;
    // FormData: copy the string entries
    if (body && typeof body.forEach === 'function') {
      const p = new URLSearchParams();
      body.forEach((v, k) => { if (typeof v === 'string') p.append(k, v); });
      return p;
    }
    return null;
  }

  function report(body) {
    try {
      const params = bodyToParams(body);
      if (!params) return;
      const friendly = params.get('fb_api_req_friendly_name');
      const doc_id = params.get('doc_id');
      if (!doc_id && !friendly) return;
      let variables = null;
      try { variables = JSON.parse(params.get('variables') || 'null'); } catch { variables = params.get('variables'); }
      // record which params were present (names only) + non-secret scalar values
      const extras = {};
      for (const [k, v] of params.entries()) {
        if (k === 'variables' || k === 'doc_id' || k === 'fb_api_req_friendly_name') continue;
        extras[k] = SECRET.test(k) ? '«session»' : v;
      }
      window.postMessage({ [TAG]: true, recipe: {
        friendly_name: friendly || '(unnamed)',
        doc_id: doc_id || '',
        variables,
        extra_params: extras,
        method_name: params.get('fb_api_caller_class') || '',
        path: location.pathname,
      } }, location.origin);
    } catch (_) { /* never break the page */ }
  }

  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    try {
      const url = (typeof input === 'string' ? input : (input && input.url)) || '';
      if (recording && /\/api\/graphql\/?/.test(url)) {
        const body = (init && init.body) || (typeof input === 'object' && input.body);
        if (body) report(body);
      }
    } catch (_) {}
    return origFetch.apply(this, arguments);
  };

  const XO = XMLHttpRequest.prototype.open;
  const XS = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, u) { this.__fbsUrl = u; return XO.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function (body) {
    try {
      if (recording && /\/api\/graphql\/?/.test(this.__fbsUrl || '') && body) report(body);
    } catch (_) {}
    return XS.apply(this, arguments);
  };
})();
