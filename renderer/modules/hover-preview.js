import { HOVER_DELAY } from './constants.js';

export class HoverPreview {
  constructor({ isModalOpen }) {
    this.isModalOpen = isModalOpen;
    this.timer = null;
    this.hoveredNode = null;
  }

  start(node) {
    if (this.isModalOpen()) return;
    this.hoveredNode = node;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      const video = node.__video;
      if (!node.__src || video.readyState < 2) return;
      video.muted = true;
      video.playbackRate = 1;
      video.play().catch(() => {});
    }, HOVER_DELAY);
  }

  stop(node) {
    clearTimeout(this.timer);
    if (this.hoveredNode === node) this.hoveredNode = null;
    const video = node?.__video;
    if (video) {
      video.pause();
      try {
        video.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
  }

  stopCurrent() {
    if (this.hoveredNode) this.stop(this.hoveredNode);
  }
}
