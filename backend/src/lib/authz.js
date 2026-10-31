import { forbidden } from './errors.js';

// the single rule used across the whole system — see docs/api-spec.md §1 and docs/architecture.md §4
// edit rights come from team membership, never from created_by_user_id (which is audit-only)
export function canEditLocation(user, location) {
  if (!user || !location) return false;
  if (user.role === 'admin') return true;
  if (!user.team_id) return false;
  return user.team_id === location.team_id;
}

export function assertCanEditLocation(user, location) {
  if (!canEditLocation(user, location)) {
    throw forbidden(
      user && !user.team_id
        ? 'บัญชีของคุณยังไม่ถูกกำหนดทีม จึงยังแก้ไขข้อมูลจุดตรวจวัดไม่ได้'
        : 'ไม่มีสิทธิ์แก้ไขจุดตรวจวัดนี้'
    );
  }
}
