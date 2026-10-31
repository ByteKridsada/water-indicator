import { Router } from 'express';
import { z } from 'zod';
import { many, one } from '../db.js';
import { notFound } from '../lib/errors.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

const body = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9_]+$/, 'code ใช้ได้เฉพาะ a-z, 0-9 และ _'),
  name: z.string().trim().min(1).max(255),
  unit: z.string().trim().max(50).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional()
});

router.get('/', async (_req, res, next) => {
  try {
    const rows = await many(
      `SELECT id, code, name, unit, description FROM indicator_types ORDER BY name`
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const input = body.parse(req.body);
    const created = await one(
      `INSERT INTO indicator_types (code, name, unit, description)
            VALUES ($1,$2,$3,$4)
         RETURNING id, code, name, unit, description`,
      [input.code, input.name, input.unit ?? null, input.description ?? null]
    );
    res.status(201).json({ data: created });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', requireAdmin, async (req, res, next) => {
  try {
    const input = body.partial().parse(req.body);
    const sets = [];
    const params = [];
    for (const field of ['code', 'name', 'unit', 'description']) {
      if (field in input) {
        params.push(input[field] ?? null);
        sets.push(`${field} = $${params.length}`);
      }
    }
    if (sets.length === 0) throw notFound('ไม่มีฟิลด์ที่จะแก้ไข');

    params.push(req.params.id);
    const updated = await one(
      `UPDATE indicator_types SET ${sets.join(', ')} WHERE id = $${params.length}
         RETURNING id, code, name, unit, description`,
      params
    );
    if (!updated) throw notFound('ไม่พบตัวชี้วัดนี้');
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

// the indicator_readings FK is ON DELETE RESTRICT — Postgres rejects the delete if any reading references it
// error 23503 is translated to HTTP 409 in errorHandler
router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const deleted = await one(`DELETE FROM indicator_types WHERE id = $1 RETURNING id`, [
      req.params.id
    ]);
    if (!deleted) throw notFound('ไม่พบตัวชี้วัดนี้');
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
