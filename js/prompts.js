/**
 * プロンプト設定画面
 */
const Prompts = (() => {
  async function load() {
    try {
      const data = await API.request('getPrompts');
      document.getElementById('prompt-system').value = data.system || '';
      document.getElementById('prompt-user').value = data.user || '';
    } catch (e) {
      App.toast('プロンプト読み込みエラー: ' + e.message);
    }
  }

  async function save() {
    const system = document.getElementById('prompt-system').value;
    const user = document.getElementById('prompt-user').value;
    try {
      await API.request('savePrompts', { system, user });
      App.toast('プロンプトを保存しました');
    } catch (e) {
      App.toast('保存エラー: ' + e.message);
    }
  }

  function init() {
    document.getElementById('btn-save-prompts').addEventListener('click', save);
  }

  return { init, load };
})();
