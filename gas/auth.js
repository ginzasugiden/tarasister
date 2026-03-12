/**
 * gas-auth 認証
 */
const SHEET_AUTH = '認証';

function verifyAuth_(token) {
  try {
    var ss = SpreadsheetApp.openById('12jG6r6WrUFbTdJfk86i9zdCxbc0ZP8tlBOojTDjQnBU');
    var sheet = ss.getSheetByName(SHEET_AUTH);
    if (!sheet) { Logger.log('認証シートなし'); return false; }
    var data = sheet.getDataRange().getValues();
    var input = String(token).trim().replace(/=+$/, '');
    for (var i = 1; i < data.length; i++) {
      var stored = String(data[i][1]).trim().replace(/=+$/, '');
      if (stored && stored === input) return true;
    }
    Logger.log('トークン不一致: input=[' + input + ']');
    return false;
  } catch(e) { Logger.log('認証エラー: ' + e.message); return false; }
}

function setupAuthSheet_() {
  var ss = SpreadsheetApp.openById('12jG6r6WrUFbTdJfk86i9zdCxbc0ZP8tlBOojTDjQnBU');
  var sheet = ss.getSheetByName(SHEET_AUTH);
  if (!sheet) sheet = ss.insertSheet(SHEET_AUTH);
  sheet.clear();
  sheet.getRange('A1:D1').setValues([['ユーザーID','認証トークン','権限','メモ']]);
  var user = 'tara-admin', pass = 'tarasister2026';
  var token = Utilities.base64Encode(user + ':' + pass);
  sheet.getRange('A2:D2').setValues([[user, token, 'admin', 'クライアント用']]);
  Logger.log('認証シート作成: user=' + user + ' token=' + token);
  return { user: user, pass: pass, token: token };
}
