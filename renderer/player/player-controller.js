import { mediaUrl } from '../modules/format.js';
import { chipDef } from './chips.js';
import { paintChips, paintRail } from './rail.js';
import { paintMeta, paintTime, syncTransport } from './transport.js';
import { DialogueController, buildDialogueSchedule } from './dialogue-controller.js';

function setStatus(text) {
  const node = document.getElementById('status');
  if (node) node.textContent = text;
}

const el = (id) => document.getElementById(id);

export class ScenePlayerController {
  constructor() {
    this.state = {
      scene: null,
      meta: { index: 0, total: 1 },
      chip: 'all',
      queue: [],
      cursor: 0,
      quality: 'hi',
      active: false,
      subtitlesEnabled: true,
      dialogueIndex: 0,
      partElapsed: 0,
      lastVideoTime: 0,
      loopCount: 0,
      dialogueSchedule: null,
    };

    this.video = null;
    this.ui = null;
    this.bound = false;
    this.loadToken = 0;
    this.errorToken = -1;
    this.railKeyHolder = { key: '' };
    this.idleTimer = 0;
    this.dialogue = new DialogueController(this);
  }

  refs() {
    if (this.ui && this.ui.video === this.video) return this.ui;
    this.ui = {
      video: this.video,
      playPause: el('btnPlayPause'),
      back10: el('btnBack10'),
      fwd10: el('btnFwd10'),
      seek: el('seekBar'),
      time: el('timeLabel'),
      chips: el('variantChips'),
      rail: el('partRail'),
      title: el('modalTitle'),
      sub: el('modalSub'),
      pos: el('modalPos'),
      quality: el('btnQuality'),
      subtitles: el('btnSubtitles'),
      reveal: el('btnReveal'),
      prev: el('btnPrev'),
      next: el('btnNext'),
      dialogueOverlay: el('dialogueOverlay'),
      dialogueCard: el('dialogueCard'),
      dialogueSpeaker: el('dialogueSpeaker'),
      dialogueCounter: el('dialogueCounter'),
      dialogueText: el('dialogueText'),
      btnDialoguePrev: el('btnDialoguePrev'),
      btnDialogueNext: el('btnDialogueNext'),
    };
    return this.ui;
  }

  visibleParts() {
    if (!this.state.scene) return [];
    const chip = chipDef(this.state.chip);
    const hasVariants = this.state.scene.parts.some((p) => p.variant === 'O2' || p.variant === 'O1');
    return this.state.scene.parts.filter((part) => {
      if (this.state.chip === 'O1' && !hasVariants) return false;
      return chip.match(part);
    });
  }

  wasActive() {
    return Boolean(this.video) && (!this.video.paused || this.video.ended);
  }

  updateUI() {
    const u = this.refs();
    paintChips(u, this.state.scene, this.state.chip);
    paintRail(u, this.state, this.railKeyHolder, (idx) => this.loadPart(idx, { autoplay: this.wasActive() }));
    paintMeta(u, this.state, this.video);
    paintTime(u, this.video);
    syncTransport(u, this.video);
    this.dialogue.updateUI();
  }

  buildDialogueSchedule(dialogue) {
    return buildDialogueSchedule(dialogue);
  }

  stepDialogue(delta, opts) {
    return this.dialogue.step(delta, opts);
  }

  loadPart(index, { autoplay = false, preserveTime = false } = {}) {
    const part = this.state.queue[index];
    if (!part || !this.video) return;

    this.state.cursor = index;
    this.state.dialogueIndex = 0;
    this.state.partElapsed = 0;
    this.state.lastVideoTime = 0;
    this.state.loopCount = 0;
    this.state.dialogueSchedule = buildDialogueSchedule(part.dialogue);
    const resumeAt = preserveTime && Number.isFinite(this.video.currentTime) ? this.video.currentTime : 0;
    const wasPlaying = autoplay || (!this.video.paused && !this.video.ended);

    let quality = this.state.quality === 'hi' ? 'hi' : 'lo';
    if (quality === 'hi' && !part.hi) quality = 'lo';
    if (quality === 'lo' && !part.lo) quality = 'hi';
    const path = quality === 'hi' ? part.hi : part.lo;

    if (!path) {
      setStatus(`Part file missing — skipped ${part.name}`);
      if (index < this.state.queue.length - 1) return this.loadPart(index + 1, { autoplay: true });
      this.updateUI();
      return;
    }

    this.loadToken += 1;
    this.video.src = mediaUrl(path);
    this.video.dataset.quality = quality;
    this.video.dataset.path = path;
    this.video.load();

    if (resumeAt > 0) {
      const seek = () => {
        try {
          this.video.currentTime = resumeAt;
          this.state.lastVideoTime = resumeAt;
        } catch {
          /* not seekable yet */
        }
        this.video.removeEventListener('loadedmetadata', seek);
      };
      this.video.addEventListener('loadedmetadata', seek);
    }

    if (wasPlaying) this.video.play().catch(() => {});

    this.updateUI();
  }

  stepPart(delta, { autoplay = null } = {}) {
    const next = this.state.cursor + delta;
    if (next < 0 || next >= this.state.queue.length) return;
    this.loadPart(next, { autoplay: autoplay === null ? this.wasActive() : autoplay });
  }

  togglePlay() {
    if (!this.video) return;
    if (this.video.paused || this.video.ended) this.video.play().catch(() => {});
    else this.video.pause();
  }

  seekBy(seconds) {
    if (!this.video || !Number.isFinite(this.video.duration) || this.video.duration <= 0) return;
    this.video.currentTime = Math.min(
      Math.max(0, this.video.currentTime + seconds),
      Math.max(0, this.video.duration - 0.05),
    );
    this.state.lastVideoTime = this.video.currentTime;
    paintTime(this.refs(), this.video);
    this.dialogue.syncWithPlayback();
  }

  toggleQuality() {
    const part = this.state.queue[this.state.cursor];
    if (!part?.hi || !part?.lo) return;
    this.state.quality = (this.video.dataset.quality ?? 'hi') === 'hi' ? 'lo' : 'hi';
    this.loadPart(this.state.cursor, { autoplay: !this.video.paused && !this.video.ended, preserveTime: true });
  }

  toggleSubtitles(force) {
    this.state.subtitlesEnabled = typeof force === 'boolean' ? force : !this.state.subtitlesEnabled;
    this.dialogue.updateUI();
  }

  selectChip(id) {
    if (!this.state.scene || this.state.chip === id) return;
    const current = this.state.queue[this.state.cursor];
    const previous = this.state.chip;
    this.state.chip = id;

    const next = this.visibleParts();
    if (next.length === 0) {
      this.state.chip = previous;
      paintChips(this.refs(), this.state.scene, this.state.chip);
      return;
    }

    this.state.queue = next;
    paintChips(this.refs(), this.state.scene, this.state.chip);
    const keep = current ? next.indexOf(current) : -1;
    if (keep >= 0) {
      this.state.cursor = keep;
      paintRail(this.refs(), this.state, this.railKeyHolder, (idx) => this.loadPart(idx, { autoplay: this.wasActive() }));
      paintMeta(this.refs(), this.state, this.video);
    } else {
      const counterpart = current && current.part != null ? next.findIndex((p) => p.part === current.part) : -1;
      const targetIdx = counterpart >= 0 ? counterpart : 0;
      this.loadPart(targetIdx, { autoplay: this.wasActive(), preserveTime: true });
    }
  }

  stepScene(delta) {
    document.dispatchEvent(new CustomEvent('sceneplayer:stepscene', { detail: { delta } }));
  }

  onEnded() {
    const part = this.state.queue[this.state.cursor];
    const dialogue = part?.dialogue;
    const schedule = this.state.dialogueSchedule;

    if (this.state.subtitlesEnabled && schedule && schedule.items.length > 0) {
      const remainingLines = this.state.dialogueIndex < schedule.items.length - 1;
      const notFinished = this.state.partElapsed < (schedule.totalDuration - 0.25);

      if (remainingLines || notFinished) {
        this.state.loopCount += 1;
        this.video.currentTime = 0;
        this.state.lastVideoTime = 0;
        this.video.play().catch(() => {});
        return;
      }
    }

    this.stepPart(1, { autoplay: true });
  }

  onError() {
    if (!this.state.active || !this.state.scene || !this.video) return;
    const part = this.state.queue[this.state.cursor];
    const noSource = this.video.networkState === 3 || this.video.error?.code === 4;
    if (!noSource || !part) return;
    if (this.errorToken === this.loadToken) return;
    this.errorToken = this.loadToken;
    setStatus(`Part file missing — skipped ${part.name}`);
    if (this.state.cursor < this.state.queue.length - 1) {
      this.loadPart(this.state.cursor + 1, { autoplay: true });
    } else {
      paintMeta(this.refs(), this.state, this.video);
    }
  }

  onKeyDown(event) {
    if (!this.state.active || !this.state.scene) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Escape') return;
    const tag = event.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || event.target?.isContentEditable) return;

    const handle = (run) => {
      event.preventDefault();
      event.stopPropagation();
      run();
    };

    switch (event.key) {
      case ' ':
      case 'k':
      case 'K':
        return handle(() => this.togglePlay());
      case 'j':
      case 'J':
      case 'ArrowLeft':
      case 'ArrowDown':
        return handle(() => this.seekBy(-10));
      case 'l':
      case 'L':
      case 'ArrowRight':
      case 'ArrowUp':
        return handle(() => this.seekBy(10));
      case 'h':
      case 'H':
        return handle(() => this.toggleQuality());
      case 'c':
      case 'C':
        return handle(() => this.toggleSubtitles());
      case 'n':
      case 'N':
        return handle(() => (event.shiftKey ? this.stepScene(1) : this.stepPart(1)));
      case 'p':
      case 'P':
        return handle(() => (event.shiftKey ? this.stepScene(-1) : this.stepPart(-1)));
      default:
        return;
    }
  }

  pokeIdle() {
    const wrap = el('videoWrap');
    if (!wrap || !this.state.active) return;
    wrap.classList.remove('is-idle');
    clearTimeout(this.idleTimer);
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    this.idleTimer = setTimeout(() => wrap.classList.add('is-idle'), 2500);
  }

  bind() {
    if (this.bound) return;
    this.bound = true;
    const u = this.refs();

    u.playPause?.addEventListener('click', () => this.togglePlay());
    u.back10?.addEventListener('click', () => this.seekBy(-10));
    u.fwd10?.addEventListener('click', () => this.seekBy(10));
    u.subtitles?.addEventListener('click', () => this.toggleSubtitles());
    this.dialogue.bindEvents(u);

    u.seek?.addEventListener('input', () => {
      if (Number.isFinite(this.video.duration)) {
        this.video.currentTime = Number(u.seek.value) || 0;
        this.state.lastVideoTime = this.video.currentTime;
        this.dialogue.syncWithPlayback();
      }
    });
    u.chips?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-chip]');
      if (button && !button.disabled) this.selectChip(button.dataset.chip);
    });

    this.video.addEventListener('ended', () => this.onEnded());
    this.video.addEventListener('error', () => this.onError());
    this.video.addEventListener('timeupdate', () => {
      paintTime(this.refs(), this.video);
      this.dialogue.syncWithPlayback();
    });
    this.video.addEventListener('durationchange', () => paintTime(this.refs(), this.video));
    this.video.addEventListener('loadedmetadata', () => {
      paintTime(this.refs(), this.video);
      this.dialogue.syncWithPlayback();
    });
    this.video.addEventListener('play', () => syncTransport(this.refs(), this.video));
    this.video.addEventListener('pause', () => syncTransport(this.refs(), this.video));

    document.addEventListener('keydown', (e) => this.onKeyDown(e), true);
    document.addEventListener('pointermove', () => this.pokeIdle(), { passive: true });
    document.addEventListener('keydown', () => this.pokeIdle(), true);
  }

  open(scene, meta = {}) {
    if (!scene || !Array.isArray(scene.parts) || scene.parts.length === 0) return;
    this.video = this.video ?? el('modalVideo');
    if (!this.video) return;

    this.bind();

    this.state.scene = scene;
    this.state.meta = {
      index: Number.isFinite(meta.index) ? meta.index : 0,
      total: Number.isFinite(meta.total) && meta.total > 0 ? meta.total : 1,
    };
    this.state.chip = 'all';
    this.state.quality = 'hi';
    this.state.active = true;
    this.state.queue = this.visibleParts();
    this.state.cursor = 0;
    this.state.dialogueIndex = 0;
    this.railKeyHolder.key = '';

    paintChips(this.refs(), this.state.scene, this.state.chip);
    this.pokeIdle();
    this.loadPart(0, { autoplay: true });
  }

  destroy() {
    if (!this.video) return;
    this.state.active = false;
    this.video.pause();
    this.video.removeAttribute('src');
    delete this.video.dataset.quality;
    delete this.video.dataset.path;
    this.video.load();

    const u = this.refs();
    if (u.rail) u.rail.replaceChildren();
    this.dialogue.reset();
    this.state.scene = null;
    this.state.queue = [];
    this.state.cursor = 0;
    this.railKeyHolder.key = '';
  }
}

export const scenePlayer = new ScenePlayerController();
export { scenePlayer as ScenePlayer };
