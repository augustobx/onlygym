import "server-only";

import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const MAX_PROGRESS_PHOTO_BYTES = 8 * 1024 * 1024;

const formats = {
  "image/jpeg": { extension: "jpg", matches: (data: Buffer) => data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff },
  "image/png": { extension: "png", matches: (data: Buffer) => data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  "image/webp": { extension: "webp", matches: (data: Buffer) => data.length >= 12 && data.subarray(0, 4).toString("ascii") === "RIFF" && data.subarray(8, 12).toString("ascii") === "WEBP" },
} as const;

function storageRoot() {
  return path.resolve(/*turbopackIgnore: true*/ process.env.PROGRESS_PHOTO_DIR || path.join(process.cwd(), "data", "progress-photos"));
}

function resolveObjectPath(objectKey: string) {
  const root = storageRoot();
  const target = path.resolve(root, objectKey);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) throw new Error("Ruta de archivo inválida");
  return target;
}

export function validateProgressPhoto(data: Buffer, mimeType: string) {
  if (!data.length) throw new Error("Seleccioná una imagen");
  if (data.length > MAX_PROGRESS_PHOTO_BYTES) throw new Error("La imagen no puede superar 8 MB");
  const format = formats[mimeType as keyof typeof formats];
  if (!format || !format.matches(data)) throw new Error("Formato no permitido. Usá JPG, PNG o WEBP");
  return format.extension;
}

export async function saveProgressPhoto(tenantId: number, clienteId: number, data: Buffer, mimeType: string) {
  const extension = validateProgressPhoto(data, mimeType);
  const objectKey = path.posix.join(`tenant-${tenantId}`, `socio-${clienteId}`, `${randomUUID()}.${extension}`);
  const target = resolveObjectPath(objectKey);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, data, { flag: "wx" });
  return objectKey;
}

export async function readProgressPhoto(objectKey: string) {
  return readFile(/*turbopackIgnore: true*/ resolveObjectPath(objectKey));
}

export async function removeProgressPhoto(objectKey: string) {
  await unlink(resolveObjectPath(objectKey)).catch(() => undefined);
}
