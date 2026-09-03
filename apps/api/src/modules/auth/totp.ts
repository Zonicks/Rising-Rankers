import crypto from "crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function randomTotpSecret() {
  return toBase32(crypto.randomBytes(20)).replace(/=+$/, "");
}

function toBase32(buf: Buffer) {
  let bits = "";
  for (const b of buf) bits += b.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    out += ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  }
  return out;
}

function fromBase32(secret: string) {
  const clean = secret.replace(/=+$/, "").toUpperCase();
  let bits = "";
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) continue;
    bits += idx.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

export function totpAt(secret: string, atMs = Date.now()) {
  const counter = Math.floor(atMs / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = crypto.createHmac("sha1", fromBase32(secret)).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(bin % 1_000_000).padStart(6, "0");
}

export function verifyTotp(secret: string, code: string) {
  const trimmed = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(trimmed)) return false;
  const now = Date.now();
  return [-1, 0, 1].some((w) => totpAt(secret, now + w * 30_000) === trimmed);
}

export function otpauthUrl(email: string, secret: string) {
  const label = encodeURIComponent(`Rising Rankers:${email}`);
  const issuer = encodeURIComponent("Rising Rankers");
  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}

export function encryptSecret(plain: string, keySource: string) {
  const key = crypto.createHash("sha256").update(keySource).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `${iv.toString("hex")}.${cipher.getAuthTag().toString("hex")}.${enc.toString("hex")}`;
}

export function decryptSecret(packed: string, keySource: string) {
  const [ivH, tagH, dataH] = packed.split(".");
  if (!ivH || !tagH || !dataH) throw new Error("bad secret");
  const key = crypto.createHash("sha256").update(keySource).digest();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivH, "hex"));
  decipher.setAuthTag(Buffer.from(tagH, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(dataH, "hex")), decipher.final()]).toString("utf8");
}
