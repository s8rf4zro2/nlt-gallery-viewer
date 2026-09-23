import { CARD_GAP, CARD_MIN_W, META_H, OVERSCAN_ROWS } from './constants.js';

export class VirtualGrid {
  constructor({ dom, tilePool, mediaLoader, getScenes, getCursor }) {
    this.dom = dom;
    this.tilePool = tilePool;
    this.mediaLoader = mediaLoader;
    this.getScenes = getScenes;
    this.getCursor = getCursor;

    this.layoutState = { cols: 1, cardW: CARD_MIN_W, rowH: 140, rows: 0 };
    this.renderState = { first: 0, last: -1 };
    this.renderPending = false;
    this.renderRaf = 0;
    this.renderTimer = 0;
  }

  layout() {
    const fallbackWidth = typeof globalThis.window !== 'undefined' ? globalThis.window.innerWidth : CARD_MIN_W;
    const width = Math.max(CARD_MIN_W, this.dom.viewport.clientWidth || fallbackWidth || CARD_MIN_W);
    const cols = Math.max(1, Math.floor((width + CARD_GAP) / (CARD_MIN_W + CARD_GAP)));
    const cardW = (width - CARD_GAP * (cols - 1)) / cols;
    const cardH = cardW * (10 / 16) + META_H;
    const rowH = cardH + CARD_GAP;
    const scenes = this.getScenes();
    const rows = Math.ceil(scenes.length / cols);

    this.layoutState = { cols, cardW, cardH, rowH, rows, width };
    this.dom.sizer.style.height = `${rows * rowH}px`;
    this.dom.window.style.height = `${rows * rowH}px`;

    this.renderState = { first: -1, last: -1 };

    for (const [index, node] of this.tilePool.tiles) {
      this.placeTile(node, index);
    }
  }

  placeTile(node, index) {
    const { cols, cardW, cardH, rowH, width } = this.layoutState;
    const col = index % cols;
    const row = Math.floor(index / cols);
    const totalW = width || (cols * cardW + (cols - 1) * CARD_GAP);
    const left = Math.round(col * (cardW + CARD_GAP));
    const right = col === cols - 1 ? totalW : Math.round((col + 1) * (cardW + CARD_GAP) - CARD_GAP);
    const w = Math.max(0, Math.round(right - left));
    node.style.left = `${left}px`;
    node.style.top = `${row * rowH}px`;
    node.style.width = `${w}px`;
    if (cardH) node.style.height = `${cardH}px`;
  }

  rowCenter(index) {
    const { cols, rowH } = this.layoutState;
    return Math.floor(index / cols) * rowH + rowH / 2;
  }

  paintCursor() {
    const cursor = this.getCursor();
    for (const [index, node] of this.tilePool.tiles) {
      node.classList.toggle('is-cursor', index === cursor);
    }
  }

  clear() {
    this.tilePool.clear((node) => this.mediaLoader.detachSource(node), this.dom.window);
    this.renderState = { first: 0, last: -1 };
    this.mediaLoader.pump();
  }

  renderNow() {
    this.renderPending = false;
    cancelAnimationFrame(this.renderRaf);
    clearTimeout(this.renderTimer);
    this.renderWindow();
  }

  scheduleRender() {
    if (this.renderPending) return;
    this.renderPending = true;

    const run = () => {
      if (!this.renderPending) return;
      this.renderPending = false;
      cancelAnimationFrame(this.renderRaf);
      clearTimeout(this.renderTimer);
      this.renderWindow();
    };

    this.renderRaf = requestAnimationFrame(run);
    this.renderTimer = setTimeout(run, 60);
  }

  renderWindow() {
    const { cols, rowH, rows } = this.layoutState;
    const scenes = this.getScenes();
    const total = scenes.length;

    if (!total) {
      this.clear();
      return;
    }

    const viewTop = this.dom.viewport.scrollTop;
    const viewH = this.dom.viewport.clientHeight;
    const firstRow = Math.max(0, Math.floor(viewTop / rowH) - OVERSCAN_ROWS);
    const lastRow = Math.min(rows - 1, Math.ceil((viewTop + viewH) / rowH) + OVERSCAN_ROWS);
    const first = firstRow * cols;
    const last = Math.min(total - 1, (lastRow + 1) * cols - 1);

    const center = viewTop + viewH / 2;
    const wanted = [];
    for (let index = first; index <= last; index += 1) wanted.push(index);
    wanted.sort((a, b) => Math.abs(this.rowCenter(a) - center) - Math.abs(this.rowCenter(b) - center));

    // Priority budget: tiles closest to viewport center get media first
    const maxAttached = this.mediaLoader?.maxAttached ?? 72;
    const wantedAttach = new Set(wanted.slice(0, maxAttached));

    const isSameRange = first === this.renderState.first && last === this.renderState.last;
    if (isSameRange && !this.hasPendingMedia(wantedAttach)) {
      this.paintCursor();
      return;
    }
    this.renderState = { first, last };

    // Recycle tiles that scrolled out of the window
    for (const [index, node] of [...this.tilePool.tiles]) {
      if (index < first || index > last) {
        this.tilePool.tiles.delete(index);
        this.tilePool.release(node, (n) => this.mediaLoader?.detachSource?.(n));
        this.tilePool.pool.push(node);
      }
    }

    // Detach media or cancel pending requests from mounted tiles outside priority budget to free slots
    for (const [index, node] of this.tilePool.tiles) {
      if (!wantedAttach.has(index)) {
        if (node.__src && typeof this.mediaLoader?.dropMedia === 'function') {
          this.mediaLoader.dropMedia(node);
        } else if (typeof this.mediaLoader?.detachSource === 'function') {
          this.mediaLoader.detachSource(node);
        }
      }
    }

    for (const index of wanted) {
      let node = this.tilePool.tiles.get(index);
      if (!node) {
        node = this.tilePool.acquire(index, scenes[index]);
        this.tilePool.tiles.set(index, node);
        this.dom.window.append(node);
      }
      this.placeTile(node, index);
      if (wantedAttach.has(index) && !node.__src && !node.__dead) {
        this.mediaLoader?.requestMedia?.(node);
      }
    }

    this.mediaLoader?.pump?.();
    this.paintCursor();
  }

  hasPendingMedia(wantedAttach) {
    for (const index of wantedAttach) {
      const node = this.tilePool.tiles.get(index);
      if (!node || (!node.__src && !node.__dead)) return true;
    }
    return false;
  }

  scrollCursorIntoView(behavior = 'auto') {
    const { cols, rowH } = this.layoutState;
    const cursor = this.getCursor();
    const row = Math.floor(cursor / cols);
    const top = row * rowH;
    const bottom = top + rowH;
    const viewTop = this.dom.viewport.scrollTop;
    const viewBottom = viewTop + this.dom.viewport.clientHeight;
    if (top < viewTop) {
      this.dom.viewport.scrollTo({ top: Math.max(0, top - 8), behavior });
    } else if (bottom > viewBottom) {
      this.dom.viewport.scrollTo({ top: bottom - this.dom.viewport.clientHeight + 8, behavior });
    }
  }
}
