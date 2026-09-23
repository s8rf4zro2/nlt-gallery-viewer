import { formatBytes, formatTime } from '../modules/format.js';

export function paintTime(u, video) {
  if (!u.seek || !video) return;
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  const current = Number.isFinite(video.currentTime) ? video.currentTime : 0;
  u.seek.max = String(duration);
  if (!u.seek.matches(':active')) u.seek.value = String(current);
  u.seek.style.setProperty('--seek', `${duration > 0 ? (current / duration) * 100 : 0}%`);
  u.time.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
}

export function syncTransport(u, video) {
  if (!u.playPause || !video) return;
  const playing = !video.paused && !video.ended;
  u.playPause.textContent = playing ? 'Pause' : 'Play';
  u.playPause.setAttribute('aria-label', playing ? 'Pause' : 'Play');
  u.playPause.classList.toggle('is-on', playing);
}

export function paintMeta(u, state, video) {
  const scene = state.scene;
  const part = state.queue[state.cursor];
  if (!scene || !part || !video) return;

  const quality = video.dataset.quality ?? 'hi';
  const active = quality === 'hi' ? part.hi : part.lo;
  const size = quality === 'hi' ? part.sizeHi : part.sizeLo;
  u.title.textContent = scene.title;
  u.title.title = `${scene.title} — ${part.name}`;
  u.sub.textContent = [
    state.queue.length > 1 ? `part ${state.cursor + 1} / ${state.queue.length}` : '',
    `${quality.toUpperCase()} ${formatBytes(size) || '?'}`,
  ]
    .filter(Boolean)
    .join('  ·  ');
  u.sub.title = active ?? '';

  u.quality.textContent = quality.toUpperCase();
  u.reveal.disabled = !window.nlt?.shell?.showItem;
  u.pos.textContent = `${state.meta.index + 1} / ${state.meta.total}`;

  u.prev.disabled = state.cursor <= 0 && state.meta.index <= 0;
  u.next.disabled = state.cursor >= state.queue.length - 1 && state.meta.index >= state.meta.total - 1;
}
