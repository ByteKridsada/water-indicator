import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import { AppError } from './errors.js';
import { detectImageType } from '../middleware/upload.js';

// Every stored path must stay inside UPLOAD_DIR, whatever ends up in the database.
export function resolveUpload(relative) {
  const abs = path.resolve(config.uploadDir, relative);
  if (abs !== config.uploadDir && !abs.startsWith(config.uploadDir + path.sep)) {
    throw new AppError(400, 'BAD_PATH', 'เส้นทางไฟล์ไม่ถูกต้อง');
  }
  return abs;
}

// Validates the upload by magic bytes and writes it under <folder>/<ownerId>/<uuid>.<ext>.
// The client-supplied filename is never used (prevents path traversal).
export async function storeImage(file, folder, ownerId) {
  if (!file) throw new AppError(400, 'NO_FILE', 'ต้องแนบไฟล์ในฟิลด์ image');
  const kind = detectImageType(file.buffer);
  const relative = path.join(folder, ownerId, `${randomUUID()}.${kind.ext}`);
  const absolute = resolveUpload(relative);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, file.buffer);
  return { relative, kind, bytes: file.buffer.length };
}

export async function removeUpload(relative) {
  if (relative) await fs.rm(resolveUpload(relative), { force: true });
}
