// lib/crypto/data-gov-in-keys.ts
//
// AES-256-GCM envelope for data.gov.in api keys.
// Master key derived from BETTER_AUTH_SECRET via HKDF-SHA256 with the
// "helix-data-gov-in-key-v1" label so this domain is separated from any
// other use of BETTER_AUTH_SECRET (better-auth's OAuth client-secret
// encryption + the LLM-provider key encryption).
//
// Rotation: bump the label to "helix-data-gov-in-key-v2" and migrate
// rows lazily (re-encrypt on next user save).

import { createCipheriv, createDecipheriv, randomBytes, hkdfSync } from "node:crypto";

const MASTER_SECRET: string = (() => {
  const s = process.env.BETTER_AUTH_SECRET;
  if (!s) {
    throw new Error("BETTER_AUTH_SECRET must be set for data.gov.in key encryption");
  }
  return s;
})();

const HKDF_LABEL = Buffer.from("helix-data-gov-in-key-v1");
const HKDF_SALT = Buffer.alloc(0);
const KEY_LENGTH = 32;

function deriveKey(): Buffer {
  return Buffer.from(hkdfSync("sha256", MASTER_SECRET, HKDF_SALT, HKDF_LABEL, KEY_LENGTH));
}

export interface KeyEnvelope {
  iv: string;
  authTag: string;
  ciphertext: string;
}

export function encryptDataGovInKey(plaintext: string): KeyEnvelope {
  if (!plaintext || typeof plaintext !== "string") {
    throw new Error("encryptDataGovInKey: plaintext must be a non-empty string");
  }
  const key = deriveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    ciphertext: ct.toString("base64"),
  };
}

export function decryptDataGovInKey(envelope: KeyEnvelope): string {
  const key = deriveKey();
  const iv = Buffer.from(envelope.iv, "base64");
  const authTag = Buffer.from(envelope.authTag, "base64");
  const ct = Buffer.from(envelope.ciphertext, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}

export function maskKey(plaintext: string): string {
  const trimmed = plaintext.trim();
  if (trimmed.length < 8) return "•••• ••••";
  return `•••• ${trimmed.slice(-4)}`;
}
