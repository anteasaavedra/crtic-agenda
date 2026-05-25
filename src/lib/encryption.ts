/**
 * Módulo de cifrado AES-256-GCM para credenciales de licencias.
 *
 * Formato del envelope cifrado: [iv (12 B)] [tag (16 B)] [ciphertext (variable)]
 *
 * La clave maestra se carga desde la variable de entorno ENCRYPTION_KEY,
 * que debe ser exactamente 32 bytes codificados en base64.
 * Generar con: openssl rand -base64 32
 *
 * SEGURIDAD:
 * - Nunca loguear el resultado de encrypt/decrypt.
 * - Nunca exponer el valor descifrado en URLs, respuestas no autorizadas ni logs.
 * - Solo descifrar dentro de contextos de servidor con sesión de admin verificada.
 */

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;  // 96 bits — recomendado para GCM
const TAG_BYTES = 16; // 128 bits — tag de autenticación GCM

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY no está configurada. Genera una con: openssl rand -base64 32"
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY debe decodificarse a exactamente 32 bytes. Actual: ${key.length} bytes`
    );
  }
  return key;
}

/**
 * Cifra un texto plano y devuelve un Buffer con el envelope completo.
 * El Buffer puede guardarse directamente en un campo Bytes de Prisma.
 */
export function encrypt(plaintext: string): Uint8Array<ArrayBuffer> {
  const key = getKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv) as crypto.CipherGCM;

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  // Envelope: iv | tag | ciphertext
  // Copiamos a un Uint8Array con backing ArrayBuffer puro (requerido por Prisma 6 Bytes)
  const raw = Buffer.concat([iv, tag, ciphertext]);
  const out = new Uint8Array(raw.length) as Uint8Array<ArrayBuffer>;
  out.set(raw);
  return out;
}

/**
 * Descifra un Buffer (proveniente de un campo Bytes de Prisma) y devuelve el texto plano.
 * Lanza un error si el tag GCM no coincide (datos corruptos o clave incorrecta).
 */
export function decrypt(data: Buffer | Uint8Array): string {
  const key = getKey();
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);

  if (buf.length < IV_BYTES + TAG_BYTES + 1) {
    throw new Error("Datos cifrados con formato inválido");
  }

  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = buf.subarray(IV_BYTES + TAG_BYTES);

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    iv
  ) as crypto.DecipherGCM;
  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

/**
 * Intenta descifrar silenciosamente. Devuelve un marcador de error si falla.
 * Usar solo para mostrar en UI (nunca para lógica de negocio).
 */
export function safeDecrypt(data: Buffer | Uint8Array): string {
  try {
    return decrypt(data);
  } catch {
    return "[error al descifrar]";
  }
}
