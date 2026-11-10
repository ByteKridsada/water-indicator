import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const forbidden = (message = 'ไม่มีสิทธิ์ดำเนินการนี้') =>
  new AppError(403, 'FORBIDDEN', message);

export const notFound = (message = 'ไม่พบข้อมูลที่ร้องขอ') =>
  new AppError(404, 'NOT_FOUND', message);

// Postgres error code -> HTTP status, per docs/api-spec.md §1
const PG_STATUS = {
  '23505': [409, 'CONFLICT', 'ข้อมูลนี้มีอยู่ในระบบแล้ว'],
  '23503': [409, 'CONFLICT', 'ข้อมูลนี้ถูกอ้างอิงอยู่ จึงดำเนินการไม่ได้'],
  // PostgreSQL 18+ reports ON DELETE RESTRICT violations as 23001 instead of 23503
  '23001': [409, 'CONFLICT', 'ข้อมูลนี้ถูกอ้างอิงอยู่ จึงดำเนินการไม่ได้'],
  '23514': [422, 'UNPROCESSABLE', 'ค่าที่ส่งมาอยู่นอกช่วงที่ยอมรับ'],
  '22P02': [400, 'BAD_REQUEST', 'รูปแบบข้อมูลไม่ถูกต้อง']
};

export function errorHandler(err, req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'ข้อมูลที่ส่งมาไม่ผ่านการตรวจสอบ',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))
      }
    });
  }

  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }

  if (err && PG_STATUS[err.code]) {
    const [status, code, message] = PG_STATUS[err.code];
    return res.status(status).json({ error: { code, message } });
  }

  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: { code: 'FILE_TOO_LARGE', message: 'ไฟล์ใหญ่เกินกำหนด' } });
  }

  console.error('unhandled error:', err);
  return res.status(500).json({ error: { code: 'INTERNAL', message: 'เกิดข้อผิดพลาดภายในระบบ' } });
}
