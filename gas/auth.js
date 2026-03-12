/**
 * gas-auth 認証
 */
const SHEET_AUTH = '認証';

function verifyAuth_(token) {
  try {
    const sheet = ss_().getSheetByName(SHEET_AUTH);
    if (!sheet) return false;
    const data = sheet.getDataRange().getValues();
    for (let i=1; i<data.length; i++) {
      if (String(data[i][1]).trim() === token) return true;
    }
    return false;
  } catch(e) { return false; }
}

function setupAuthSheet_() {
  let sheet = ss_().getSheetByName(SHEET_AUTH);
  if (!sheet) sheet = ss_().insertSheet(SHEET_AUTH);
  sheet.clear();
  sheet.getRange('A1:D1').setValues([['ユーザーID','認証トークン','権限','メモ']])
    .setFontWeight('bold').setBackground('#1a1a2e').setFontColor('white');
  const user = 'tara-admin', pass = 'tarasister2026';
  const token = Utilities.base64Encode(user+':'+pass);
  sheet.getRange('A2:D2').setValues([[user, token, 'admin', 'クライアント用']]);
  return { user, pass, token };
}
