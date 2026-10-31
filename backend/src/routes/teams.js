import { Router } from 'express';
import { z } from 'zod';
import { many, one } from '../db.js';
import { notFound } from '../lib/errors.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

const teamBody = z.object({ team_name: z.string().trim().min(1).max(255) });

router.get('/', async (_req, res, next) => {
  try {
    const rows = await many(
      `SELECT t.id, t.team_name, t.created_at,
              (SELECT count(*) FROM locations l WHERE l.team_id = t.id)::int AS location_count,
              (SELECT count(*) FROM users u WHERE u.team_id = t.id)::int AS member_count
         FROM teams t
     ORDER BY t.team_name`
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { team_name } = teamBody.parse(req.body);
    const team = await one(
      `INSERT INTO teams (team_name) VALUES ($1) RETURNING id, team_name, created_at`,
      [team_name]
    );
    res.status(201).json({ data: team });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { team_name } = teamBody.parse(req.body);
    const team = await one(
      `UPDATE teams SET team_name = $1 WHERE id = $2 RETURNING id, team_name, created_at`,
      [team_name, req.params.id]
    );
    if (!team) throw notFound('ไม่พบทีมนี้');
    res.json({ data: team });
  } catch (err) {
    next(err);
  }
});

// the locations/users FK is ON DELETE SET NULL — locations aren't deleted, they just become teamless
router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const deleted = await one(`DELETE FROM teams WHERE id = $1 RETURNING id`, [req.params.id]);
    if (!deleted) throw notFound('ไม่พบทีมนี้');
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
