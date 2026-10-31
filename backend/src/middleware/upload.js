import multer from 'multer';
import { config } from '../config.js';
import { AppError } from '../lib/errors.js';

// buffer in memory first; we write the file ourselves after the magic-bytes check passes
export const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadBytes, files: 1 }
}).single('image');

const SIGNATURES = [
  { ext: 'jpg', mime: 'image/jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    ext: 'png',
    mime: 'image/png',
    test: (b) =>
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  },
  {
    ext: 'webp',
    mime: 'image/webp',
    test: (b) =>
      b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP'
  }
];

// check magic bytes — never trust the Content-Type or filename extension the client sends
export function detectImageType(buffer) {
  if (!buffer || buffer.length < 12) {
    throw new AppError(400, 'INVALID_IMAGE', 'ไฟล์เสียหายหรือไม่ใช่รูปภาพ');
  }
  const match = SIGNATURES.find((s) => s.test(buffer));
  if (!match) {
    throw new AppError(400, 'UNSUPPORTED_IMAGE', 'รองรับเฉพาะไฟล์ JPG, PNG และ WebP');
  }
  return match;
}
