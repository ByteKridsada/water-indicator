import { Router } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { config } from '../config.js';
import { many, one } from '../db.js';
import { AppError, forbidden, notFound } from '../lib/errors.js';
import { assertCanEditLocation, canEditLocation } from '../lib/authz.js';
import { requireAdmin } from '../middleware/auth.js';
import { detectImageType, uploadImage } from '../middleware/upload.js';

const router = Router();

// meta_data_1 is still free text — see open question #1 in docs/api-spec.md §11
// once confirmed to be a fixed option set, switch this to z.enum([...])
const metaData1 = z.string().trim().max(255).nullable().optional();

const createBody = z.object({
  team_id: z.string().uuid().nullable().optional(),
  member_name: z.string().trim().min(1).max(255),
  location_name: z.string().trim().min(1).max(255),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  meta_data_1: metaData1,
  line_user_id: z.string().trim().max(255).nullable().optional()
});

const patchBody = createBody.partial().refine((v) => Object.keys(v).length > 0, {
  message: 'ต้องระบุฟิลด์ที่จะแก้ไขอย่างน้อยหนึ่งฟิลด์'
});

const listQuery = z.object({
  team_id: z.string().uuid().optional(),
  meta_data_1: z.string().trim().max(255).optional(),
  q: z.string().trim().max(255).optional(),
  bbox: z.string().max(100).optional(),
  include: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

function parseBbox(raw) {
  const parts = raw.split(',').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    throw new AppError(400, 'BAD_BBOX', 'bbox ต้องเป็น minLng,minLat,maxLng,maxLat');
  }
  const [minLng, minLat, maxLng, maxLat] = parts;
  if (minLng > maxLng || minLat > maxLat) {
    throw new AppError(400, 'BAD_BBOX', 'ค่าต่ำสุดของ bbox ต้องไม่มากกว่าค่าสูงสุด');
  }
  if (minLat < -90 || maxLat > 90 || minLng < -180 || maxLng > 180) {
    throw new AppError(422, 'BAD_BBOX', 'bbox อยู่นอกช่วงพิกัดที่ยอมรับ');
  }
  return { minLng, minLat, maxLng, maxLat };
}

const resolveUpload = (relative) => {
  const abs = path.resolve(config.uploadDir, relative);
  if (abs !== config.uploadDir && !abs.startsWith(config.uploadDir + path.sep)) {
    throw new AppError(400, 'BAD_PATH', 'เส้นทางไฟล์ไม่ถูกต้อง');
  }
  return abs;
};

// line_user_id is personally identifying — expose it as a boolean in list responses, see docs/api-spec.md §5
function serialize(row, { includeLineUserId = false } = {}) {
  const out = {
    id: row.id,
    location_name: row.location_name,
    member_name: row.member_name,
    team: row.team_id ? { id: row.team_id, team_name: row.team_name ?? null } : null,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    meta_data_1: row.meta_data_1,
    avatar_image_url: row.avatar_image_path ? `/api/v1/locations/${row.id}/image` : null,
    line_linked: Boolean(row.line_user_id),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
  if (includeLineUserId) out.line_user_id = row.line_user_id;
  return out;
}

async function latestReadingsFor(locationIds) {
  if (locationIds.length === 0) return new Map();
  const rows = await many(
    `SELECT DISTINCT ON (r.location_id, r.indicator_type_id)
            r.location_id, r.value, r.measured_at, r.source,
            it.id AS type_id, it.code, it.name, it.unit
       FROM indicator_readings r
       JOIN indicator_types it ON it.id = r.indicator_type_id
      WHERE r.location_id = ANY($1)
   ORDER BY r.location_id, r.indicator_type_id, r.measured_at DESC`,
    [locationIds]
  );

  const grouped = new Map();
  for (const row of rows) {
    if (!grouped.has(row.location_id)) grouped.set(row.location_id, []);
    grouped.get(row.location_id).push({
      indicator_type: { id: row.type_id, code: row.code, name: row.name, unit: row.unit },
      value: Number(row.value),
      measured_at: row.measured_at,
      source: row.source
    });
  }
  return grouped;
}

router.get('/', async (req, res, next) => {
  try {
    const { team_id, meta_data_1, q, bbox, include, page, limit } = listQuery.parse(req.query);
    const where = [];
    const params = [];

    if (team_id) {
      params.push(team_id);
      where.push(`l.team_id = $${params.length}`);
    }
    if (meta_data_1) {
      params.push(meta_data_1);
      where.push(`l.meta_data_1 = $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      where.push(`(l.location_name ILIKE $${params.length} OR l.member_name ILIKE $${params.length})`);
    }
    if (bbox) {
      const { minLng, minLat, maxLng, maxLat } = parseBbox(bbox);
      params.push(minLng, maxLng, minLat, maxLat);
      const i = params.length;
      where.push(`l.longitude BETWEEN $${i - 3} AND $${i - 2}`);
      where.push(`l.latitude BETWEEN $${i - 1} AND $${i}`);
    }

    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = await one(`SELECT count(*)::int AS n FROM locations l ${clause}`, params);

    params.push(limit, (page - 1) * limit);
    const rows = await many(
      `SELECT l.*, t.team_name
         FROM locations l
         LEFT JOIN teams t ON t.id = l.team_id
         ${clause}
     ORDER BY l.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const data = rows.map((r) => serialize(r));

    if ((include || '').split(',').includes('latest_readings')) {
      const grouped = await latestReadingsFor(rows.map((r) => r.id));
      for (const item of data) {
        item.latest_readings = grouped.get(item.id) || [];
      }
    }

    res.json({ data, meta: { page, limit, total: total.n } });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const row = await one(
      `SELECT l.*, t.team_name FROM locations l
         LEFT JOIN teams t ON t.id = l.team_id
        WHERE l.id = $1`,
      [req.params.id]
    );
    if (!row) throw notFound('ไม่พบจุดตรวจวัดนี้');

    const editable = canEditLocation(req.user, row);
    const data = serialize(row, { includeLineUserId: editable });
    data.can_edit = editable;

    const grouped = await latestReadingsFor([row.id]);
    data.latest_readings = grouped.get(row.id) || [];

    res.json({ data });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const body = createBody.parse(req.body);
    let teamId = body.team_id ?? null;

    if (req.user.role !== 'admin') {
      if (!req.user.team_id) {
        throw forbidden('บัญชีของคุณยังไม่ถูกกำหนดทีม จึงยังสร้างจุดตรวจวัดไม่ได้');
      }
      if (teamId && teamId !== req.user.team_id) {
        throw forbidden('สร้างจุดตรวจวัดได้เฉพาะในทีมของตนเอง');
      }
      teamId = req.user.team_id;
    }

    // created_by_user_id comes from the token only — never accepted from the client
    const created = await one(
      `INSERT INTO locations
            (team_id, created_by_user_id, member_name, location_name,
             latitude, longitude, meta_data_1, line_user_id)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING *`,
      [
        teamId,
        req.user.id,
        body.member_name,
        body.location_name,
        body.latitude,
        body.longitude,
        body.meta_data_1 ?? null,
        body.line_user_id ?? null
      ]
    );

    const team = teamId ? await one(`SELECT team_name FROM teams WHERE id = $1`, [teamId]) : null;
    res.status(201).json({
      data: serialize({ ...created, team_name: team?.team_name }, { includeLineUserId: true })
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const body = patchBody.parse(req.body);
    const existing = await one(`SELECT * FROM locations WHERE id = $1`, [req.params.id]);
    if (!existing) throw notFound('ไม่พบจุดตรวจวัดนี้');
    assertCanEditLocation(req.user, existing);

    if ('team_id' in body && req.user.role !== 'admin') {
      throw forbidden('เฉพาะผู้ดูแลระบบเท่านั้นที่ย้ายจุดตรวจวัดไปทีมอื่นได้');
    }

    const fields = [
      'team_id',
      'member_name',
      'location_name',
      'latitude',
      'longitude',
      'meta_data_1',
      'line_user_id'
    ];
    const sets = [];
    const params = [];
    for (const field of fields) {
      if (field in body) {
        params.push(body[field] ?? null);
        sets.push(`${field} = $${params.length}`);
      }
    }

    params.push(req.params.id);
    const updated = await one(
      `UPDATE locations SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );

    const team = updated.team_id
      ? await one(`SELECT team_name FROM teams WHERE id = $1`, [updated.team_id])
      : null;
    res.json({
      data: serialize({ ...updated, team_name: team?.team_name }, { includeLineUserId: true })
    });
  } catch (err) {
    next(err);
  }
});

// admin only — ON DELETE CASCADE wipes out every image and indicator_reading for this location
router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const deleted = await one(
      `DELETE FROM locations WHERE id = $1 RETURNING id, avatar_image_path`,
      [req.params.id]
    );
    if (!deleted) throw notFound('ไม่พบจุดตรวจวัดนี้');

    if (deleted.avatar_image_path) {
      await fs.rm(resolveUpload(deleted.avatar_image_path), { force: true });
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.post('/:id/image', uploadImage, async (req, res, next) => {
  try {
    const existing = await one(`SELECT * FROM locations WHERE id = $1`, [req.params.id]);
    if (!existing) throw notFound('ไม่พบจุดตรวจวัดนี้');
    assertCanEditLocation(req.user, existing);

    if (!req.file) throw new AppError(400, 'NO_FILE', 'ต้องแนบไฟล์ในฟิลด์ image');
    const kind = detectImageType(req.file.buffer);

    // generate the filename ourselves with a UUID — never use the client-supplied name (prevents path traversal)
    const relative = path.join('avatars', existing.id, `${randomUUID()}.${kind.ext}`);
    const absolute = resolveUpload(relative);
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, req.file.buffer);

    const updated = await one(
      `UPDATE locations SET avatar_image_path = $1 WHERE id = $2 RETURNING *`,
      [relative, existing.id]
    );

    if (existing.avatar_image_path && existing.avatar_image_path !== relative) {
      await fs.rm(resolveUpload(existing.avatar_image_path), { force: true });
    }

    res.json({
      data: {
        avatar_image_url: `/api/v1/locations/${updated.id}/image`,
        content_type: kind.mime,
        bytes: req.file.buffer.length
      }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/image', async (req, res, next) => {
  try {
    const row = await one(`SELECT id, avatar_image_path FROM locations WHERE id = $1`, [
      req.params.id
    ]);
    if (!row) throw notFound('ไม่พบจุดตรวจวัดนี้');
    if (!row.avatar_image_path) throw notFound('จุดตรวจวัดนี้ยังไม่มีรูปภาพ');
    res.sendFile(resolveUpload(row.avatar_image_path));
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/image', async (req, res, next) => {
  try {
    const existing = await one(`SELECT * FROM locations WHERE id = $1`, [req.params.id]);
    if (!existing) throw notFound('ไม่พบจุดตรวจวัดนี้');
    assertCanEditLocation(req.user, existing);

    if (existing.avatar_image_path) {
      await fs.rm(resolveUpload(existing.avatar_image_path), { force: true });
      await one(`UPDATE locations SET avatar_image_path = NULL WHERE id = $1 RETURNING id`, [
        existing.id
      ]);
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
