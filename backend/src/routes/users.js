import { Router } from 'express';
import { z } from 'zod';
import { many, one } from '../db.js';
import { notFound } from '../lib/errors.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

router.use(requireAdmin);

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
      where.push(`u.email ILIKE $${params.length}`);
    }

    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = await one(`SELECT count(*)::int AS n FROM users u ${clause}`, params);

    params.push(limit, (page - 1) * limit);
    const rows = await many(
      `SELECT u.id, u.email, u.role, u.is_active, u.created_at,
              u.team_id, t.team_name
         FROM users u
         LEFT JOIN teams t ON t.id = u.team_id
         ${clause}
     ORDER BY u.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      data: rows.map((r) => ({
        id: r.id,
        email: r.email,
        role: r.role,
        is_active: r.is_active,
        team: r.team_id ? { id: r.team_id, team_name: r.team_name } : null,
        created_at: r.created_at
      })),
      meta: { page, limit, total: total.n }
    });
  } catch (err) {
    next(err);
  }
});

const patchBody = z
  .object({
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

    for (const field of ['team_id', 'role', 'is_active']) {
      if (field in body) {
        params.push(body[field]);
        sets.push(`${field} = $${params.length}`);
      }
    }

    params.push(req.params.id);
    const updated = await one(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $${params.length}
         RETURNING id, email, role, is_active, team_id`,
      params
    );
    if (!updated) throw notFound('ไม่พบผู้ใช้นี้');

    const team = updated.team_id
      ? await one(`SELECT id, team_name FROM teams WHERE id = $1`, [updated.team_id])
      : null;

    res.json({
      data: {
        id: updated.id,
        email: updated.email,
        role: updated.role,
        is_active: updated.is_active,
        team
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
