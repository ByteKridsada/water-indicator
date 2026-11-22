const relative = new Intl.RelativeTimeFormat('th', { numeric: 'auto' });

const STEPS = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

export function timeAgo(value) {
  const seconds = (new Date(value).getTime() - Date.now()) / 1000;
  for (const [unit, size] of STEPS) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return 'เมื่อสักครู่';
}

export function formatDateTime(value) {
  return new Date(value).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatDate(value) {
  return new Date(value).toLocaleDateString('th-TH', { dateStyle: 'medium' });
}

export function initials(text) {
  return (text || '?').replace(/@.*/, '').slice(0, 2).toUpperCase();
}

// "First Last", falling back to the email for accounts created before names were required
export function displayName(user) {
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ');
  return name || user?.email || '';
}

// Thai leading vowels (เ แ โ ใ ไ) are written before the consonant they belong to,
// so skip them: "เกียรติ ใจดี" -> "กจ", not "เใ".
const firstLetter = (word) => (word || '').trim().replace(/^[เแโใไ]/, '').charAt(0);

export function userInitials(user) {
  if (user?.first_name) {
    return (firstLetter(user.first_name) + firstLetter(user.last_name)).toUpperCase();
  }
  return initials(user?.email);
}
