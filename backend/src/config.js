import 'dotenv/config';
import path from 'node:path';

function required(key) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`missing required environment variable: ${key}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: required('JWT_SECRET'),
  jwtTtl: process.env.JWT_TTL || '12h',
  uploadDir: path.resolve(process.env.UPLOAD_DIR || './uploads'),
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES || 5 * 1024 * 1024),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS || 10),
  seedAdmin: {
    email: process.env.ADMIN_EMAIL || '',
    password: process.env.ADMIN_PASSWORD || ''
  }
};
