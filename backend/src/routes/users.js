import { randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { many, one } from '../db.js';
import { AppError, notFound } from '../lib/errors.js';
import { resolveUpload } from '../lib/uploads.js';
import { requireAdmin } from '../middleware/auth.js';
import { avatarVersion, firstName, lastName } from './auth.js';

const router = Router();

router.use(requireAdmin);

const adminView = (r) => ({
  id: r.id,
  email: r.email,
  first_name: r.first_name ?? null,
  last_name: r.last_name ?? null,
  role: r.role,
  is_active: r.is_active,
  team: r.team_id ? { id: r.team_id, team_name: r.team_name } : null,
  avatar_url: r.avatar_image_path ? `/api/v1/users/${r.id}/avatar?v=${avatarVersion(r)}` : null,
  created_at: r.created_at
});

const ADMIN_SELECT = `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.is_active,
              u.created_at, u.updated_at, u.avatar_image_path, u.team_id, t.team_name
         FROM users u
         LEFT JOIN teams t ON t.id = u.team_id`;

const listQuery = z.object({
  team_id: z.string().uuid().optional(),
  unassigned: z.enum(['true', 'false']).optional(),
  q: z.string().trim().max(255).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

router.get('/', async (req, res, next) => {
  try {
    const { team_id, unassigned, q, page, limit } = listQuery.parse(req.query);
    const where = [];
    const params = [];

    if (team_id) {
      params.push(team_id);
      where.push(`u.team_id = $${params.length}`);
    }
    if (unassigned === 'true') where.push('u.team_id IS NULL');
    if (unassigned === 'false') where.push('u.team_id IS NOT NULL');
    if (q) {
      params.push(`%${q}%`);
      const n = params.length;
      where.push(
        `(u.email ILIKE $${n} OR u.first_name ILIKE $${n} OR u.last_name ILIKE $${n}
          OR (u.first_name || ' ' || u.last_name) ILIKE $${n})`
      );
    }

    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = await one(`SELECT count(*)::int AS n FROM users u ${clause}`, params);

    params.push(limit, (page - 1) * limit);
    const rows = await many(
      `${ADMIN_SELECT}
         ${clause}
     ORDER BY u.created_at DESC, u.id
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      data: rows.map(adminView),
      meta: { page, limit, total: total.n }
    });
  } catch (err) {
    next(err);
  }
});

const patchBody = z
  .object({
    first_name: firstName.optional(),
    last_name: lastName.optional(),
    team_id: z.string().uuid().nullable().optional(),
    role: z.enum(['admin', 'member']).optional(),
    is_active: z.boolean().optional()
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'ต้องระบุฟิลด์ที่จะแก้ไขอย่างน้อยหนึ่งฟิลด์' });

router.patch('/:id', async (req, res, next) => {
  try {
    const body = patchBody.parse(req.body);
    const sets = [];
    const params = [];

    for (const field of ['first_name', 'last_name', 'team_id', 'role', 'is_active']) {
      if (field in body) {
        params.push(body[field]);
        sets.push(`${field} = $${params.length}`);
      }
    }

    params.push(req.params.id);
    // The system must always keep at least one active admin. When this update could take an
    // admin away (demote, or deactivate), the guard lives in the UPDATE's own WHERE clause so the
    // check and the write are one statement: it only matches if the target isn't an active admin
    // right now, or some other active admin exists.
    const losesAdmin = body.role === 'member' || body.is_active === false;
    const guard = losesAdmin
      ? `AND (u.role <> 'admin' OR NOT u.is_active
              OR EXISTS (SELECT 1 FROM users o WHERE o.role = 'admin' AND o.is_active AND o.id <> u.id))`
      : '';
    const updated = await one(
      `UPDATE users u SET ${sets.join(', ')} WHERE u.id = $${params.length} ${guard} RETURNING u.id`,
      params
    );
    if (!updated) {
      // either no such user, or the guard blocked the change
      const exists = await one(`SELECT 1 AS ok FROM users WHERE id = $1`, [req.params.id]);
      if (!exists) throw notFound('ไม่พบผู้ใช้นี้');
      throw new AppError(409, 'LAST_ADMIN', 'ต้องมีผู้ดูแลระบบที่ใช้งานได้อย่างน้อย 1 คน จึงลดบทบาทหรือระงับคนนี้ไม่ได้');
    }

    const row = await one(`${ADMIN_SELECT} WHERE u.id = $1`, [updated.id]);
    res.json({ data: adminView(row) });
  } catch (err) {
    next(err);
  }
});

// No 0/O/o, 1/l/I: the admin reads this out loud or types it into a chat.
const TEMP_PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
const TEMP_PASSWORD_LENGTH = 12;

function generateTemporaryPassword() {
  let out = '';
  for (let i = 0; i < TEMP_PASSWORD_LENGTH; i++) {
    out += TEMP_PASSWORD_ALPHABET[randomInt(TEMP_PASSWORD_ALPHABET.length)];
  }
  return out;
}

// Forgot-password flow without email: the admin issues a temporary password and hands it over.
// The plaintext is returned once here and never stored or logged. Existing tokens stay valid
// and a deactivated account stays deactivated.
router.post('/:id/reset-password', async (req, res, next) => {
  try {
    const temporaryPassword = generateTemporaryPassword();
    const hash = await bcrypt.hash(temporaryPassword, config.bcryptRounds);
    const updated = await one(`UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id`, [
      hash,
      req.params.id
    ]);
    if (!updated) throw notFound('ไม่พบผู้ใช้นี้');

    res.set('Cache-Control', 'no-store');
    res.json({ data: { temporary_password: temporaryPassword } });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/avatar', async (req, res, next) => {
  try {
    const row = await one(`SELECT avatar_image_path FROM users WHERE id = $1`, [req.params.id]);
    if (!row) throw notFound('ไม่พบผู้ใช้นี้');
    if (!row.avatar_image_path) throw notFound('ผู้ใช้นี้ยังไม่มีรูปโปรไฟล์');
    res.sendFile(resolveUpload(row.avatar_image_path));
  } catch (err) {
    next(err);
  }
});

export default router;
