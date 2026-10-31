import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { one } from '../db.js';
import { AppError, forbidden } from '../lib/errors.js';

const unauthorized = (message = 'กรุณาเข้าสู่ระบบ') => new AppError(401, 'UNAUTHORIZED', message);

export async function authenticate(req, _res, next) {
  try {
    const header = req.get('authorization') || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw unauthorized();

    let payload;
    try {
      payload = jwt.verify(token, config.jwtSecret);
    } catch {
      throw unauthorized('token ไม่ถูกต้องหรือหมดอายุ');
    }

    // reload the user on every request so role/team/is_active changes take effect immediately
    const user = await one(
      `SELECT u.id, u.email, u.role, u.team_id, u.is_active, t.team_name
         FROM users u
         LEFT JOIN teams t ON t.id = u.team_id
        WHERE u.id = $1`,
      [payload.sub]
    );

    if (!user) throw unauthorized('ไม่พบบัญชีผู้ใช้');
    if (!user.is_active) throw forbidden('บัญชีนี้ถูกระงับการใช้งาน');

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAdmin(req, _res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return next(forbidden('ต้องเป็นผู้ดูแลระบบเท่านั้น'));
  }
  next();
}
