import { formatBytes, formatTime } from './format.js';

export class TilePool {
  constructor({ onVideoError }) {
    this.onVideoError = onVideoError;
    this.tiles = new Map(); // index -> DOM node
    this.pool = [];
  }

  createTile() {
    const node = document.createElement('article');
    node.className = 'card';
    node.tabIndex = -1;
    node.innerHTML = `
      <div class="card-media">
        <video preload="metadata" muted playsinline disablepictureinpicture></video>
        <div class="card-fallback" hidden>···</div>
        <div class="card-play" aria-hidden="true"></div>
        <div class="card-badges">
          <span class="badge badge-parts"></span>
          <span class="badge badge-quality"></span>
        </div>
      </div>
      <div class="card-meta">
        <h3 class="card-title"></h3>
        <p class="card-sub"></p>
      </div>`;

    node.__video = node.querySelector('video');
    node.__fallback = node.querySelector('.card-fallback');
    node.__quality = node.querySelector('.badge-quality');
    node.__parts = node.querySelector('.badge-parts');
    node.__title = node.querySelector('.card-title');
    node.__sub = node.querySelector('.card-sub');
    node.__src = null;
    node.__want = false;
    node.__dead = false;

    const updateMediaReady = () => {
      const { videoWidth: w, videoHeight: h, duration } = node.__video;
      if (w && h && !node.__res) {
        node.__res = `${w}×${h}`;
        this.paintSub(node);
      }
      if (Number.isFinite(duration) && duration > 0 && !node.__dur) {
        node.__dur = formatTime(duration);
        this.paintSub(node);
      }
      node.__fallback.hidden = true;
    };

    node.__video.addEventListener('loadedmetadata', updateMediaReady);
    node.__video.addEventListener('loadeddata', updateMediaReady);
    node.__video.addEventListener('canplay', updateMediaReady);
    node.__video.addEventListener('error', () => this.onVideoError(node));

    return node;
  }

  paintSub(node) {
    const scene = node.__scene;
    if (!scene) return;
    const active = this.activePath(node);
    const bits = [];
    if (node.__res) bits.push(node.__res);
    if (node.__dur) bits.push(node.__dur);
    bits.push(formatBytes(active?.size ?? 0) || '—');
    if (active?.isLo) bits.push('-l');
    node.__sub.textContent = bits.join(' · ');
  }

  activePath(node) {
    const scene = node.__scene;
    if (!scene) return null;
    if (node.__hiOnly && scene.hi) return { path: scene.hi, size: scene.sizeHi, isLo: false };
    if (scene.lo) return { path: scene.lo, size: scene.sizeLo, isLo: true };
    if (scene.hi) return { path: scene.hi, size: scene.sizeHi, isLo: false };
    return null;
  }

  acquire(index, scene) {
    const node = this.pool.pop() ?? this.createTile();
    node.__index = index;
    node.__scene = scene;
    node.__src = null;
    node.__dead = false;
    node.__res = null;
    node.__dur = null;
    node.__video.pause();
    node.__video.removeAttribute('src');
    node.__video.load();
    node.classList.remove('is-cursor', 'is-dead');
    node.setAttribute('aria-label', `${scene.title} (${scene.name})`);
    node.__title.textContent = scene.title;
    node.__parts.textContent = scene.parts.length > 1 ? `${scene.parts.length} parts` : '';
    node.__parts.hidden = scene.parts.length <= 1;
    node.__quality.textContent = '';
    node.__quality.hidden = true;
    node.__quality.classList.remove('badge-hi', 'badge-lq');
    node.__fallback.hidden = false;
    node.__fallback.textContent = '···';
    this.paintSub(node);
    return node;
  }

  release(node, detachSourceFn) {
    if (detachSourceFn) detachSourceFn(node);
    node.__scene = null;
    node.__index = -1;
    node.remove();
  }

  clear(detachSourceFn, container) {
    for (const node of this.tiles.values()) {
      this.release(node, detachSourceFn);
      this.pool.push(node);
    }
    this.tiles.clear();
    if (container) container.textContent = '';
  }
}
