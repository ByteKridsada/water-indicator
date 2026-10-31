import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../config.js';
import { one } from '../db.js';
import { AppError } from '../lib/errors.js';
import { authenticate } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';

const router = Router();

const credentials = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(8, 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร').max(200)
});

// dummy hash for the "email not found" case so response timing stays similar (prevents timing-based user enumeration)
const DUMMY_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

const signToken = (user) =>
  jwt.sign({ sub: user.id }, config.jwtSecret, { expiresIn: config.jwtTtl });

export const publicUser = (row) => ({
  id: row.id,
  email: row.email,
  role: row.role,
  team: row.team_id ? { id: row.team_id, team_name: row.team_name ?? null } : null
});

router.post('/register', async (req, res, next) => {
  try {
    const { email, password } = credentials.parse(req.body);
    const hash = await bcrypt.hash(password, config.bcryptRounds);

    // role and team_id are server-assigned only — accepting them from the client would let anyone self-promote to admin
    const user = await one(
      `INSERT INTO users (email, password_hash, role, team_id)
            VALUES ($1, $2, 'member', NULL)
         RETURNING id, email, role, team_id`,
      [email, hash]
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
      `SELECT u.id, u.email, u.role, u.team_id, u.password_hash, u.is_active, t.team_name
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

router.patch('/me', authenticate, async (req, res, next) => {
  try {
    const { email } = z
      .object({ email: z.string().trim().toLowerCase().email().max(255) })
      .parse(req.body);

    const updated = await one(
      `UPDATE users SET email = $1 WHERE id = $2
         RETURNING id, email, role, team_id`,
      [email, req.user.id]
    );
    res.json({ data: publicUser({ ...updated, team_name: req.user.team_name }) });
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
