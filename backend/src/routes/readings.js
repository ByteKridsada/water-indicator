import { Router } from 'express';
import { z } from 'zod';
import { many, one } from '../db.js';
import { notFound } from '../lib/errors.js';
import { assertCanEditLocation } from '../lib/authz.js';
import { requireAdmin } from '../middleware/auth.js';

// mounted at /api/v1/locations/:locationId/readings
export const locationReadings = Router({ mergeParams: true });

const rangeQuery = z.object({
  indicator_type_id: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(2000).default(500)
});

locationReadings.get('/', async (req, res, next) => {
  try {
    const { indicator_type_id, from, to, limit } = rangeQuery.parse(req.query);
    const location = await one(`SELECT id FROM locations WHERE id = $1`, [req.params.locationId]);
    if (!location) throw notFound('ไม่พบจุดตรวจวัดนี้');

    const params = [location.id];
    const where = ['r.location_id = $1'];

    if (indicator_type_id) {
      params.push(indicator_type_id);
      where.push(`r.indicator_type_id = $${params.length}`);
    }
    if (from) {
      params.push(from.toISOString());
      where.push(`r.measured_at >= $${params.length}`);
    }
    if (to) {
      params.push(to.toISOString());
      where.push(`r.measured_at <= $${params.length}`);
    }

    params.push(limit);
    const rows = await many(
      `SELECT r.id, r.value, r.measured_at, r.source,
              it.id AS type_id, it.code, it.name, it.unit
         FROM indicator_readings r
         JOIN indicator_types it ON it.id = r.indicator_type_id
        WHERE ${where.join(' AND ')}
     ORDER BY r.measured_at ASC
        LIMIT $${params.length}`,
      params
    );

    // grouped by indicator type because the popup draws small multiples — one chart per indicator, each on its own scale
    const byType = new Map();
    for (const row of rows) {
      if (!byType.has(row.type_id)) {
        byType.set(row.type_id, {
          indicator_type: { id: row.type_id, code: row.code, name: row.name, unit: row.unit },
          series: []
        });
      }
      byType.get(row.type_id).series.push({
        measured_at: row.measured_at,
        value: Number(row.value),
        source: row.source
      });
    }

    res.json({ data: [...byType.values()] });
  } catch (err) {
    next(err);
  }
});

const createBody = z.object({
  indicator_type_id: z.string().uuid(),
  value: z.coerce.number(),
  measured_at: z.coerce.date().optional()
});

locationReadings.post('/', async (req, res, next) => {
  try {
    const body = createBody.parse(req.body);
    const location = await one(`SELECT * FROM locations WHERE id = $1`, [req.params.locationId]);
    if (!location) throw notFound('ไม่พบจุดตรวจวัดนี้');
    assertCanEditLocation(req.user, location);

    // source is hardcoded to 'manual' — a 'ai' value can only come from the image-interpretation pipeline
    // accepting source from the client would let anyone forge a reading's provenance as "AI-interpreted"
    const created = await one(
      `INSERT INTO indicator_readings
            (location_id, indicator_type_id, value, measured_at, source)
            VALUES ($1, $2, $3, COALESCE($4, now()), 'manual')
         RETURNING id, value, measured_at, source, indicator_type_id`,
      [
        location.id,
        body.indicator_type_id,
        body.value,
        body.measured_at ? body.measured_at.toISOString() : null
      ]
    );

    res.status(201).json({
      data: {
        id: created.id,
        indicator_type_id: created.indicator_type_id,
        value: Number(created.value),
        measured_at: created.measured_at,
        source: created.source
      }
    });
  } catch (err) {
    next(err);
  }
});

// mounted at /api/v1/readings
export const readings = Router();

readings.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const deleted = await one(`DELETE FROM indicator_readings WHERE id = $1 RETURNING id`, [
      req.params.id
    ]);
    if (!deleted) throw notFound('ไม่พบค่าตัวชี้วัดนี้');
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
