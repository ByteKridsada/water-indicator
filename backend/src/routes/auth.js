import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../config.js';
import { one } from '../db.js';
import { AppError } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { uploadImage } from '../middleware/upload.js';
import { removeUpload, resolveUpload, storeImage } from '../lib/uploads.js';

const router = Router();

const email = z.string().trim().toLowerCase().email().max(255);

const credentials = z.object({
  email,
  password: z.string().min(8, 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร').max(200)
});

const firstName = z.string().trim().min(1, 'กรุณากรอกชื่อ').max(100, 'ชื่อยาวเกิน 100 ตัวอักษร');
const lastName = z.string().trim().min(1, 'กรุณากรอกนามสกุล').max(100, 'นามสกุลยาวเกิน 100 ตัวอักษร');

const registerBody = credentials.extend({ first_name: firstName, last_name: lastName });

// columns publicUser needs; every query that returns the current user selects these
const USER_COLUMNS = 'id, email, first_name, last_name, role, team_id, avatar_image_path, updated_at';

// dummy hash for the "email not found" case so response timing stays similar (prevents timing-based user enumeration)
const DUMMY_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

const signToken = (user) =>
  jwt.sign({ sub: user.id }, config.jwtSecret, { expiresIn: config.jwtTtl });

// The version query string changes whenever the row changes, so the browser's cached
// copy of an old profile image is never reused after an upload.
export const avatarVersion = (row) => new Date(row.updated_at).getTime();

export const publicUser = (row) => ({
  id: row.id,
  email: row.email,
  first_name: row.first_name ?? null,
  last_name: row.last_name ?? null,
  role: row.role,
  team: row.team_id ? { id: row.team_id, team_name: row.team_name ?? null } : null,
  avatar_url: row.avatar_image_path ? `/api/v1/auth/me/avatar?v=${avatarVersion(row)}` : null
});

async function loadUser(id) {
  return one(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.team_id,
            u.avatar_image_path, u.updated_at, t.team_name
       FROM users u
       LEFT JOIN teams t ON t.id = u.team_id
      WHERE u.id = $1`,
    [id]
  );
}

router.post('/register', async (req, res, next) => {
  try {
    const body = registerBody.parse(req.body);
    const hash = await bcrypt.hash(body.password, config.bcryptRounds);

    // role and team_id are server-assigned only — accepting them from the client would let anyone self-promote to admin
    const user = await one(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, team_id)
            VALUES ($1, $2, $3, $4, 'member', NULL)
         RETURNING ${USER_COLUMNS}`,
      [body.email, hash, body.first_name, body.last_name]
    );

    res.status(201).json({ data: { token: signToken(user), user: publicUser(user) } });
  } catch (err) {
    next(err);
  }
});

router.post('/login', rateLimit({ max: 10 }), async (req, res, next) => {
  try {
    const { email, password } = credentials.parse(req.body);
    const row = await one(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.team_id,
              u.avatar_image_path, u.updated_at, u.password_hash, u.is_active, t.team_name
         FROM users u
         LEFT JOIN teams t ON t.id = u.team_id
        WHERE u.email = $1`,
      [email]
    );

    const passwordOk = await bcrypt.compare(password, row ? row.password_hash : DUMMY_HASH);

    // same message in every case — never reveal whether the email actually exists
    if (!row || !passwordOk) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    }
    if (!row.is_active) {
      throw new AppError(403, 'ACCOUNT_DISABLED', 'บัญชีนี้ถูกระงับการใช้งาน');
    }

    res.json({ data: { token: signToken(row), user: publicUser(row) } });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authenticate, (req, res) => {
  res.json({ data: publicUser(req.user) });
});

// Users edit only their own email and names here. Team and role are not accepted:
// team decides which locations a member may edit, so only an admin changes it (PATCH /users/:id).
const patchMeBody = z
  .object({ email: email.optional(), first_name: firstName.optional(), last_name: lastName.optional() })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'ต้องระบุฟิลด์ที่จะแก้ไขอย่างน้อยหนึ่งฟิลด์' });

router.patch('/me', authenticate, async (req, res, next) => {
  try {
    const body = patchMeBody.parse(req.body);
    const sets = [];
    const params = [];
    for (const field of ['email', 'first_name', 'last_name']) {
      if (field in body) {
        params.push(body[field]);
        sets.push(`${field} = $${params.length}`);
      }
    }
    params.push(req.user.id);
    await one(`UPDATE users SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING id`, params);
    res.json({ data: publicUser(await loadUser(req.user.id)) });
  } catch (err) {
    next(err);
  }
});

router.post('/me/avatar', authenticate, uploadImage, async (req, res, next) => {
  try {
    const { relative } = await storeImage(req.file, 'users', req.user.id);
    await one(`UPDATE users SET avatar_image_path = $1 WHERE id = $2 RETURNING id`, [
      relative,
      req.user.id
    ]);
    if (req.user.avatar_image_path !== relative) await removeUpload(req.user.avatar_image_path);
    res.json({ data: publicUser(await loadUser(req.user.id)) });
  } catch (err) {
    next(err);
  }
});

router.get('/me/avatar', authenticate, (req, res, next) => {
  try {
    if (!req.user.avatar_image_path) throw new AppError(404, 'NOT_FOUND', 'ยังไม่มีรูปโปรไฟล์');
    res.sendFile(resolveUpload(req.user.avatar_image_path));
  } catch (err) {
    next(err);
  }
});

router.delete('/me/avatar', authenticate, async (req, res, next) => {
  try {
    if (req.user.avatar_image_path) {
      await removeUpload(req.user.avatar_image_path);
      await one(`UPDATE users SET avatar_image_path = NULL WHERE id = $1 RETURNING id`, [req.user.id]);
    }
    res.json({ data: publicUser(await loadUser(req.user.id)) });
  } catch (err) {
    next(err);
  }
});

router.post('/me/password', authenticate, async (req, res, next) => {
  try {
    const { current_password, new_password } = z
      .object({
        current_password: z.string().min(1),
        new_password: z.string().min(8, 'รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร').max(200)
      })
      .parse(req.body);

    const row = await one(`SELECT password_hash FROM users WHERE id = $1`, [req.user.id]);
    const ok = await bcrypt.compare(current_password, row.password_hash);
    if (!ok) {
      throw new AppError(400, 'WRONG_PASSWORD', 'รหัสผ่านปัจจุบันไม่ถูกต้อง');
    }

    const hash = await bcrypt.hash(new_password, config.bcryptRounds);
    await one(`UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id`, [hash, req.user.id]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
