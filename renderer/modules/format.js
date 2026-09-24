export function toPath(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  return value.replace(/\\/g, '/');
}

export function num(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function formatBytes(bytes) {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 100 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '–';
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const mediaUrl = (absPath) => (absPath ? window.nlt?.media?.url(absPath) : null);

export function revealPath(absPath) {
  if (!absPath) return false;
  window.nlt?.shell?.showItem(absPath)?.catch(() => {});
  return true;
}
