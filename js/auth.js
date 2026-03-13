/**
 * 認証モジュール（gas-auth方式）
 */
const Auth = (() => {
  const STORAGE_KEY = 'tara_x_auth';

  function init() {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      API.setAuth(saved.replace(/=+$/, ''));
      return true;
    }
    return false;
  }

  async function login(user, pass) {
    const token = btoa(user + ':' + pass).replace(/=+$/, '');
    // 認証テスト
    API.setAuth(token);
    try {
      await API.request('getStatus');
      sessionStorage.setItem(STORAGE_KEY, token);
      return true;
    } catch (e) {
      API.setAuth('');
      throw e;
    }
  }

  function logout() {
    sessionStorage.removeItem(STORAGE_KEY);
    API.setAuth('');
  }

  return { init, login, logout };
})();
