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
