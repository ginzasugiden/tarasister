const API = (() => {
  const BASE_URL = 'https://script.google.com/macros/s/AKfycbzb6z8DYb1a79SBwF_oVAP3Tsngmp3xe2TGG6Ooj8Y2p-HoPedx9-Zx296GsGTf-mEWjg/exec';
  let authToken = '';

  function setAuth(token) { authToken = token; }
  function getAuth() { return authToken; }

  async function request(action, data, extraParams) {
    const params = new URLSearchParams({ action: action, tk: authToken });
    if (extraParams) {
      Object.keys(extraParams).forEach(k => params.set(k, extraParams[k]));
    }
    if (data) {
      params.set('data', btoa(unescape(encodeURIComponent(JSON.stringify(data)))));
    }
    const url = BASE_URL + '?' + params.toString();
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) throw new Error('通信エラー: ' + res.status);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'APIエラー');
    return json.data;
  }

  return { setAuth, getAuth, request };
})();
