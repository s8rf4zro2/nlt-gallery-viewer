import { MAX_ATTACHED } from './constants.js';
import { mediaUrl } from './format.js';

export class MediaLoader {
  constructor(tilePool) {
    this.tilePool = tilePool;
    this.attached = 0;
    this.queue = [];
    this.maxAttached = MAX_ATTACHED;
  }

  detachSource(node) {
    node.__want = false;
    this.queue = this.queue.filter((queued) => queued !== node);
    if (!node.__src) return;
    node.__video.pause();
    node.__video.removeAttribute('src');
    node.__video.load();
    node.__src = null;
    this.attached = Math.max(0, this.attached - 1);
  }

  setTileSource(node, url) {
    if (node.__src === url) return;
    this.detachSource(node);
    node.__want = true;
    node.__src = url;
    node.__video.preload = 'metadata';
    node.__video.src = url;
    node.__video.load();
    this.attached += 1;
    if (node.__video.readyState >= 1) {
      node.__fallback.hidden = true;
    }
  }

  pump() {
    while (this.attached < this.maxAttached && this.queue.length) {
      const node = this.queue.shift();
      if (!node.__want || !node.__scene) continue;
      const active = this.tilePool.activePath(node);
      const url = active ? mediaUrl(active.path) : null;
      if (!url) {
        node.__dead = true;
        node.classList.add('is-dead');
        node.__fallback.hidden = false;
        node.__fallback.textContent = 'no file';
        continue;
      }
      this.setTileSource(node, url);
      if (node.__video.readyState >= 1) {
        node.__fallback.hidden = true;
      } else {
        node.__fallback.hidden = false;
        node.__fallback.textContent = '···';
      }
    }
  }

  requestMedia(node) {
    if (!node.__scene || node.__src || node.__dead) return;
    node.__want = true;
    if (!this.queue.includes(node)) this.queue.push(node);
    this.pump();
  }

  dropMedia(node) {
    const hadSource = Boolean(node.__src);
    this.detachSource(node);
    if (hadSource) {
      node.__fallback.hidden = false;
      node.__fallback.textContent = '···';
      this.pump();
    }
  }

  handleVideoError(node) {
    const scene = node.__scene;
    if (!scene) return;

    // The -l proxy is missing/corrupt for this entry — fall back to the full file.
    const active = this.tilePool.activePath(node);
    if (active?.isLo && scene.hi) {
      node.__hiOnly = true;
      this.detachSource(node);
      this.setTileSource(node, mediaUrl(scene.hi));
      node.__quality.textContent = 'hi';
      node.__quality.classList.add('badge-hi');
      node.__quality.hidden = false;
      this.tilePool.paintSub(node);
      return;
    }

    node.__dead = true;
    node.classList.add('is-dead');
    node.__fallback.hidden = false;
    node.__fallback.textContent = 'unreadable';
    this.detachSource(node);
    this.pump();
  }
}
