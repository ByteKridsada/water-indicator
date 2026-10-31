import { AppError } from '../lib/errors.js';

// in-memory rate limiter — fine for a prototype running a single instance
// move the counter to Redis if this ever scales to multiple instances
export function rateLimit({ windowMs = 15 * 60 * 1000, max = 10 } = {}) {
  const hits = new Map();

  return function limiter(req, _res, next) {
    const key = `${req.ip}:${(req.body && req.body.email) || ''}`;
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || now > entry.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
    } else {
      entry.count += 1;
      if (entry.count > max) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
        return next(
          new AppError(429, 'TOO_MANY_REQUESTS', `ลองใหม่อีกครั้งในอีก ${retryAfter} วินาที`)
        );
      }
    }

    if (hits.size > 10000) {
      for (const [k, v] of hits) {
        if (now > v.resetAt) hits.delete(k);
      }
    }
    next();
  };
}
