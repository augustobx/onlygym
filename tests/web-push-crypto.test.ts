import { createECDH, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createVapidAuthorization, encryptWebPushPayload, validateWebPushKeys } from "../src/lib/web-push-crypto";

function vapidKeys() {
  const key = createECDH("prime256v1");
  key.generateKeys();
  return {
    publicKey: key.getPublicKey().toString("base64url"),
    privateKey: key.getPrivateKey().toString("base64url"),
    subject: "mailto:push@example.com",
  };
}

function subscription() {
  const key = createECDH("prime256v1");
  key.generateKeys();
  return {
    p256dh: key.getPublicKey().toString("base64url"),
    auth: randomBytes(16).toString("base64url"),
  };
}

describe("native Web Push crypto", () => {
  it("accepts a valid P-256 VAPID key pair", () => {
    const validated = validateWebPushKeys(vapidKeys());
    expect(validated.publicKey).toHaveLength(65);
    expect(validated.privateKey).toHaveLength(32);
  });

  it("rejects invalid VAPID subjects", () => {
    expect(() => validateWebPushKeys({ ...vapidKeys(), subject: "push@example.com" })).toThrow(/VAPID_SUBJECT/);
  });

  it("builds a same-audience VAPID JWT authorization", () => {
    const keys = vapidKeys();
    const authorization = createVapidAuthorization("https://push.example.com/send/abc", keys, 1_700_000_000);
    expect(authorization.startsWith("vapid t=")).toBe(true);
    expect(authorization.endsWith(`, k=${keys.publicKey}`)).toBe(true);

    const jwt = authorization.slice("vapid t=".length).split(", k=")[0];
    const [, payload, signature] = jwt.split(".");
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    expect(claims.aud).toBe("https://push.example.com");
    expect(claims.sub).toBe(keys.subject);
    expect(claims.exp).toBe(1_700_043_200);
    expect(Buffer.from(signature, "base64url")).toHaveLength(64);
  });

  it("creates an aes128gcm Web Push record with RFC header", () => {
    const salt = Buffer.alloc(16, 7);
    const ephemeral = createECDH("prime256v1");
    ephemeral.generateKeys();
    const body = encryptWebPushPayload(subscription(), JSON.stringify({ title: "OnlyGym" }), {
      salt,
      ephemeralPrivateKey: ephemeral.getPrivateKey(),
    });

    expect(body.subarray(0, 16).equals(salt)).toBe(true);
    expect(body.readUInt32BE(16)).toBe(4096);
    expect(body.readUInt8(20)).toBe(65);
    expect(body.length).toBeGreaterThan(86 + 16);
  });

  it("rejects malformed subscriptions and oversized payloads", () => {
    expect(() => encryptWebPushPayload({ p256dh: "bad", auth: "bad" }, "hola")).toThrow();
    expect(() => encryptWebPushPayload(subscription(), "x".repeat(5000))).toThrow(/demasiado grande/);
  });
});
