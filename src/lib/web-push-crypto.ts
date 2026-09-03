import { createCipheriv, createECDH, createHmac, createPrivateKey, randomBytes, sign } from "node:crypto";

export type WebPushKeys = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

export type PushSubscriptionKeys = {
  p256dh: string;
  auth: string;
};

function b64url(value: Buffer | Uint8Array | string) {
  return Buffer.from(value).toString("base64url");
}

function decodeKey(value: string, expectedLength?: number) {
  if (!value || value.length > 2048) throw new Error("Clave Web Push inválida");
  const decoded = Buffer.from(value, "base64url");
  if (expectedLength && decoded.length !== expectedLength) throw new Error("Longitud de clave Web Push inválida");
  return decoded;
}

function hmac(key: Buffer, value: Buffer) {
  return createHmac("sha256", key).update(value).digest();
}

function hkdfExpand(prk: Buffer, info: Buffer, length: number) {
  if (length < 1 || length > 32) throw new Error("Longitud HKDF no soportada");
  return hmac(prk, Buffer.concat([info, Buffer.from([1])])).subarray(0, length);
}

export function validateWebPushKeys(keys: WebPushKeys) {
  const publicKey = decodeKey(keys.publicKey, 65);
  const privateKey = decodeKey(keys.privateKey, 32);
  if (publicKey[0] !== 4) throw new Error("La clave pública VAPID debe ser P-256 sin comprimir");
  if (!keys.subject.startsWith("mailto:") && !keys.subject.startsWith("https://")) {
    throw new Error("VAPID_SUBJECT debe usar mailto: o https://");
  }
  return { publicKey, privateKey };
}

export function createVapidAuthorization(endpoint: string, keys: WebPushKeys, nowSeconds = Math.floor(Date.now() / 1000)) {
  const target = new URL(endpoint);
  if (target.protocol !== "https:") throw new Error("El endpoint push debe usar HTTPS");
  const { publicKey, privateKey } = validateWebPushKeys(keys);

  const jwk = {
    kty: "EC",
    crv: "P-256",
    x: b64url(publicKey.subarray(1, 33)),
    y: b64url(publicKey.subarray(33, 65)),
    d: b64url(privateKey),
  };
  const key = createPrivateKey({ key: jwk, format: "jwk" });
  const encodedHeader = b64url(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const encodedPayload = b64url(JSON.stringify({
    aud: target.origin,
    exp: nowSeconds + 12 * 60 * 60,
    sub: keys.subject,
  }));
  const unsigned = `${encodedHeader}.${encodedPayload}`;
  const signature = sign("sha256", Buffer.from(unsigned), { key, dsaEncoding: "ieee-p1363" });
  const jwt = `${unsigned}.${b64url(signature)}`;
  return `vapid t=${jwt}, k=${keys.publicKey}`;
}

export function encryptWebPushPayload(
  subscription: PushSubscriptionKeys,
  payload: string | Buffer,
  options: { salt?: Buffer; ephemeralPrivateKey?: Buffer } = {},
) {
  const userPublicKey = decodeKey(subscription.p256dh, 65);
  const authSecret = decodeKey(subscription.auth);
  if (userPublicKey[0] !== 4 || authSecret.length < 16) throw new Error("Suscripción Web Push inválida");

  const applicationServer = createECDH("prime256v1");
  if (options.ephemeralPrivateKey) applicationServer.setPrivateKey(options.ephemeralPrivateKey);
  else applicationServer.generateKeys();
  const applicationPublicKey = applicationServer.getPublicKey();
  const sharedSecret = applicationServer.computeSecret(userPublicKey);

  const authPrk = hmac(authSecret, sharedSecret);
  const keyInfo = Buffer.concat([
    Buffer.from("WebPush: info\0", "utf8"),
    userPublicKey,
    applicationPublicKey,
  ]);
  const ikm = hkdfExpand(authPrk, keyInfo, 32);

  const salt = options.salt || randomBytes(16);
  if (salt.length !== 16) throw new Error("Salt Web Push inválido");
  const prk = hmac(salt, ikm);
  const cek = hkdfExpand(prk, Buffer.from("Content-Encoding: aes128gcm\0", "utf8"), 16);
  const nonce = hkdfExpand(prk, Buffer.from("Content-Encoding: nonce\0", "utf8"), 12);

  const clear = Buffer.concat([Buffer.isBuffer(payload) ? payload : Buffer.from(payload, "utf8"), Buffer.from([2])]);
  const recordSize = 4096;
  if (clear.length + 16 > recordSize) throw new Error("La notificación push es demasiado grande");

  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const encrypted = Buffer.concat([cipher.update(clear), cipher.final(), cipher.getAuthTag()]);

  const header = Buffer.alloc(21);
  salt.copy(header, 0);
  header.writeUInt32BE(recordSize, 16);
  header.writeUInt8(applicationPublicKey.length, 20);

  return Buffer.concat([header, applicationPublicKey, encrypted]);
}
