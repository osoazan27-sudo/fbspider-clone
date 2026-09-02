// Runs on the fbspider-clone web app pages (localhost / your deployed domain).
// Relays window.postMessage <-> the extension background worker, implementing the
// same protocol the original site uses: the page posts
//   { type:'EXECUTE_SCRIPT'|'EXECUTE_COOKIE'|'FB_OP'|'PING'|..., data, uniqueRequestId }
// and receives the response tagged with the same uniqueRequestId.

(function () {
  const TAG = '__FBSPIDER_BRIDGE__';

  // DOM marker so the app (and tests) can confirm the content script injected,
  // even after the BRIDGE_READY message has already fired.
  try { document.documentElement.setAttribute('data-fbspider-bridge', '3.0.0'); } catch (e) {}

  // announce presence so the app can detect the extension synchronously-ish
  window.postMessage({ [TAG]: true, type: 'BRIDGE_READY', version: '3.0.0' }, window.location.origin);

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const msg = event.data;
    if (!msg || msg[TAG] !== true || !msg.type || msg.__fromExt) return;
    // only handle request types (ignore our own responses)
    const REQ = ['PING', 'REFRESH_SESSION', 'GET_SESSION', 'EXECUTE_SCRIPT', 'EXECUTE_COOKIE', 'FB_OP', 'SET_TOKEN',
      'SET_RECORDING', 'GET_RECORDING', 'LIST_RECIPES', 'CLEAR_RECIPES', 'RUN_RECIPE'];
    if (!REQ.includes(msg.type)) return;

    const forward = {
      type: msg.type,
      data: msg.data,
      op: msg.op,
      params: msg.params,
      token: msg.token,          // SET_TOKEN carries the pasted token here
      on: msg.on,                // SET_RECORDING toggle
      uniqueRequestId: msg.uniqueRequestId,
    };
    chrome.runtime.sendMessage(forward, (resp) => {
      const err = chrome.runtime.lastError;
      window.postMessage({
        [TAG]: true,
        __fromExt: true,
        type: msg.type + '_RESULT',
        uniqueRequestId: msg.uniqueRequestId,
        response: err ? { success: false, error: err.message } : resp,
      }, window.location.origin);
    });
  });
})();
