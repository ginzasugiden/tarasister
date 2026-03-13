const API = (() => {
  const BASE_URL = 'https://script.google.com/macros/s/AKfycbw4OOQEzl7HTLjGfOo76VhFdVfu3JLHErEerZCYpYcyvxyv8kVTMEcIRDhEdQvLKz64og/exec';
  let authToken = '';

  function setAuth(token) { authToken = token; }
  function getAuth() { return authToken; }

  function request(action, data, extraParams) {
    const params = new URLSearchParams({ action: action, auth: authToken.replace(/=+$/, '') });
    if (extraParams) {
      Object.keys(extraParams).forEach(k => params.set(k, extraParams[k]));
    }
    if (data) {
      params.set('data', btoa(unescape(encodeURIComponent(JSON.stringify(data)))));
    }

    const url = BASE_URL + '?' + params.toString();

    return new Promise(function(resolve, reject) {
      var cbName = '_cb_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      var timer = setTimeout(function() {
        cleanup();
        reject(new Error('タイムアウト'));
      }, 30000);

      function cleanup() {
        clearTimeout(timer);
        delete window[cbName];
        var el = document.getElementById(cbName);
        if (el) el.remove();
      }

      window[cbName] = function(json) {
        cleanup();
        if (!json || !json.ok) {
          reject(new Error((json && json.error) || 'APIエラー'));
          return;
        }
        resolve(json.data);
      };

      var script = document.createElement('script');
      script.id = cbName;
      script.src = url + '&callback=' + cbName;
      script.onerror = function() {
        cleanup();
        reject(new Error('通信エラー'));
      };
      document.body.appendChild(script);
    });
  }

  return { setAuth: setAuth, getAuth: getAuth, request: request };
})();
