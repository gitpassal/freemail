/**
 * Web Push（RFC 8291 aes128gcm + RFC 8030 VAPID）纯 Web Crypto 实现，适配 Cloudflare Workers。
 * VAPID 密钥自动生成并存入 system_settings（无需用户手配 secret）。
 * @module utils/webpush
 */

import { getSystemSetting, setSystemSetting } from '../db/settings.js';

// ---- base64url ----
function b64urlEncode(bytes) {
  if (bytes instanceof ArrayBuffer) bytes = new Uint8Array(bytes);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(str) {
  str = String(str || '').replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function concatBytes() {
  let len = 0;
  for (let i = 0; i < arguments.length; i++) len += arguments[i].length;
  const out = new Uint8Array(len);
  let o = 0;
  for (let i = 0; i < arguments.length; i++) { out.set(arguments[i], o); o += arguments[i].length; }
  return out;
}

/**
 * 获取或生成 VAPID 密钥对（存 system_settings）。
 * @returns {Promise<{publicKeyB64url:string, privateJwk:object, subject:string}|null>}
 */
export async function getOrCreateVapidKeys(db) {
  try {
    let pub = await getSystemSetting(db, 'vapid_public', '');
    let priv = await getSystemSetting(db, 'vapid_private', '');
    let subject = await getSystemSetting(db, 'vapid_subject', '');
    if (!subject) { subject = 'mailto:webpush@protonpass.org'; try { await setSystemSetting(db, 'vapid_subject', subject); } catch (_) {} }
    if (!pub || !priv) {
      const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
      const pubRaw = await crypto.subtle.exportKey('raw', kp.publicKey); // 65 字节 0x04||X||Y
      const privJwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
      pub = b64urlEncode(pubRaw);
      priv = JSON.stringify(privJwk);
      await setSystemSetting(db, 'vapid_public', pub);
      await setSystemSetting(db, 'vapid_private', priv);
    }
    return { publicKeyB64url: pub, privateJwk: JSON.parse(priv), subject };
  } catch (e) {
    console.error('VAPID 密钥获取/生成失败:', e);
    return null;
  }
}

// 仅取公钥（下发前端 applicationServerKey）
export async function getVapidPublicKey(db) {
  const v = await getOrCreateVapidKeys(db);
  return v ? v.publicKeyB64url : '';
}

// ---- VAPID JWT (ES256) ----
async function buildVapidJWT(endpoint, vapid) {
  const aud = new URL(endpoint).origin;
  const header = { typ: 'JWT', alg: 'ES256' };
  const claims = { aud: aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: vapid.subject || 'mailto:webpush@example.com' };
  const enc = (obj) => b64urlEncode(new TextEncoder().encode(JSON.stringify(obj)));
  const signingInput = enc(header) + '.' + enc(claims);
  const key = await crypto.subtle.importKey('jwk', vapid.privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  // Workers/WebCrypto 返回 raw r||s (64B)，直接用，无需 DER 转换
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(signingInput));
  return signingInput + '.' + b64urlEncode(new Uint8Array(sig));
}

// ---- HKDF-SHA256 ----
async function hkdf(salt, ikm, info, length) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: salt, info: info }, key, length * 8);
  return new Uint8Array(bits);
}

// ---- RFC 8291 aes128gcm 载荷加密 ----
async function encryptPayload(sub, payloadBytes) {
  const te = new TextEncoder();
  const uaPublic = b64urlDecode(sub.p256dh); // 65B
  const authSecret = b64urlDecode(sub.auth); // 16B

  const asKeyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', asKeyPair.publicKey)); // 65B
  const uaPublicKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaPublicKey }, asKeyPair.privateKey, 256)); // 32B

  const salt = crypto.getRandomValues(new Uint8Array(16));

  // 第一步：IKM = HKDF(salt=auth, ikm=ecdh, info="WebPush: info\0"||uaPublic||asPublic, 32)
  const keyInfo = concatBytes(te.encode('WebPush: info\0'), uaPublic, asPublicRaw);
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32);
  // CEK / NONCE
  const cek = await hkdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);

  // 单条记录：明文 + 0x02 分隔符
  const plaintext = concatBytes(payloadBytes, new Uint8Array([2]));
  const cekKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, cekKey, plaintext));

  // RFC8188 头：salt(16) || rs(4 BE) || idlen(1)=65 || keyid(asPublic 65) || ciphertext
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096, false);
  const idlen = new Uint8Array([asPublicRaw.length]);
  return concatBytes(salt, rs, idlen, asPublicRaw, ct);
}

/**
 * 发送一条 Web Push。
 * @returns {Promise<{status:number}>}
 */
export async function sendWebPush(sub, payloadObj, vapid) {
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payloadObj || {}));
  const body = await encryptPayload(sub, payloadBytes);
  const jwt = await buildVapidJWT(sub.endpoint, vapid);
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'TTL': '2419200',
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      'Urgency': 'normal',
      'Authorization': 'vapid t=' + jwt + ', k=' + vapid.publicKeyB64url
    },
    body: body
  });
  return { status: res.status };
}
