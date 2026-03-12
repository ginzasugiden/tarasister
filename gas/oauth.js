/**
 * OAuth 1.0a 署名（X API用）
 */
function buildOAuthParams_(ck, at) {
  return {
    oauth_consumer_key:ck, oauth_nonce:nonce_(),
    oauth_signature_method:'HMAC-SHA1',
    oauth_timestamp:Math.floor(Date.now()/1000).toString(),
    oauth_token:at, oauth_version:'1.0'
  };
}

function genSig_(method, url, params, cs, ats) {
  const sorted = Object.keys(params).sort().map(k=>pctEnc_(k)+'='+pctEnc_(params[k])).join('&');
  const base = method.toUpperCase()+'&'+pctEnc_(url)+'&'+pctEnc_(sorted);
  const key = pctEnc_(cs)+'&'+pctEnc_(ats);
  return Utilities.base64Encode(Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_1, base, key));
}

function buildAuthHeader_(p) {
  return 'OAuth '+Object.keys(p).sort().map(k=>pctEnc_(k)+'="'+pctEnc_(p[k])+'"').join(', ');
}

function pctEnc_(s) {
  return encodeURIComponent(String(s)).replace(/!/g,'%21').replace(/\*/g,'%2A').replace(/'/g,'%27').replace(/\(/g,'%28').replace(/\)/g,'%29');
}

function nonce_() {
  const c='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let n=''; for(let i=0;i<32;i++) n+=c[Math.floor(Math.random()*c.length)]; return n;
}
