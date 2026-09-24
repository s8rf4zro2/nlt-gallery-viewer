export function buildDialogueSchedule(dialogue) {
  if (!Array.isArray(dialogue) || dialogue.length === 0) {
    return { items: [], totalDuration: 0, hasTimestamps: false };
  }

  const timedLines = dialogue.filter((d) => typeof d.time === 'number' && d.time > 0);
  const distinctTimes = new Set(timedLines.map((d) => d.time));
  const maxTime = timedLines.length > 0 ? Math.max(...timedLines.map((d) => d.time)) : 0;
  const minTime = timedLines.length > 0 ? Math.min(...timedLines.map((d) => d.time)) : 0;
  const hasTimestamps = distinctTimes.size >= 2 && (maxTime - minTime >= 2.0);
  const items = [];
  let curTime = 0;

  for (let i = 0; i < dialogue.length; i++) {
    const line = dialogue[i];
    const textLen = (line.text || '').trim().length;
    const readingDuration = Math.max(2.8, Math.min(8.0, 1.2 + textLen * 0.065));

    let start = curTime;
    let duration = readingDuration;

    if (hasTimestamps && typeof line.time === 'number') {
      start = Math.max(curTime, line.time);
      const next = dialogue[i + 1];
      if (next && typeof next.time === 'number' && next.time > start) {
        duration = Math.min(readingDuration, next.time - start);
      }
    }

    const end = start + duration;
    items.push({ index: i, line, start, end });
    curTime = end;
  }

  const totalDuration = items.length > 0 ? items[items.length - 1].end : 0;
  return { items, totalDuration, hasTimestamps };
}

export class DialogueController {
  constructor(player) {
    this.player = player;
  }

  get state() {
    return this.player.state;
  }

  get video() {
    return this.player.video;
  }

  refs() {
    return this.player.refs();
  }

  step(delta, { wrap = false } = {}) {
    const part = this.state.queue[this.state.cursor];
    const dialogue = part?.dialogue;
    if (!dialogue || dialogue.length === 0) return;
    const schedule = this.state.dialogueSchedule;

    let next = this.state.dialogueIndex + delta;
    if (wrap) {
      next = (next + dialogue.length) % dialogue.length;
    } else {
      if (delta > 0 && next >= dialogue.length) {
        return this.player.stepPart(1, { autoplay: this.player.wasActive() });
      }
      next = Math.max(0, Math.min(dialogue.length - 1, next));
    }

    this.state.dialogueIndex = next;
    if (schedule?.items?.[next]) {
      this.state.partElapsed = schedule.items[next].start;
      if (schedule.hasTimestamps && Number.isFinite(this.video?.duration)) {
        this.video.currentTime = Math.min(Math.max(0, this.video.duration - 0.05), schedule.items[next].start);
        this.state.lastVideoTime = this.video.currentTime;
      }
    }
    this.updateUI();
  }

  syncWithPlayback() {
    if (!this.state.subtitlesEnabled || !this.video) return;
    const schedule = this.state.dialogueSchedule;
    if (!schedule || schedule.items.length === 0) return;

    const cur = this.video.currentTime || 0;
    const duration = this.video.duration;

    let delta = cur - this.state.lastVideoTime;
    if (delta < 0 && Number.isFinite(duration) && duration > 0) {
      delta = (duration - this.state.lastVideoTime) + cur;
    }
    if (delta > 0 && delta < 5) {
      this.state.partElapsed += delta;
    }
    this.state.lastVideoTime = cur;

    const checkTime = schedule.hasTimestamps ? cur : this.state.partElapsed;
    const activeItem = schedule.items.find((item) => checkTime >= item.start && checkTime < item.end);
    const u = this.refs();

    if (activeItem) {
      if (activeItem.index !== this.state.dialogueIndex || u.dialogueOverlay?.hidden) {
        this.state.dialogueIndex = activeItem.index;
        this.updateUI();
      }
    } else if (schedule.hasTimestamps) {
      if (u.dialogueOverlay && !u.dialogueOverlay.hidden) {
        u.dialogueOverlay.hidden = true;
      }
    } else if (checkTime >= schedule.totalDuration) {
      if (this.state.dialogueIndex !== schedule.items.length - 1) {
        this.state.dialogueIndex = schedule.items.length - 1;
        this.updateUI();
      }
    }
  }

  updateUI() {
    const u = this.refs();
    const part = this.state.queue[this.state.cursor];
    const dialogue = Array.isArray(part?.dialogue) ? part.dialogue : [];
    const hasDialogue = dialogue.length > 0;
    const schedule = this.state.dialogueSchedule;
    const cur = this.video?.currentTime || 0;
    const checkTime = schedule?.hasTimestamps ? cur : this.state.partElapsed;
    const isSilenced = Boolean(schedule?.hasTimestamps && !schedule.items.some((item) => checkTime >= item.start && checkTime < item.end));

    if (u.subtitles) {
      u.subtitles.classList.toggle('is-active', this.state.subtitlesEnabled);
      u.subtitles.style.opacity = hasDialogue ? '1' : '0.4';
      u.subtitles.title = hasDialogue
        ? (this.state.subtitlesEnabled ? 'Hide Dialogue / Subtitles (C)' : 'Show Dialogue / Subtitles (C)')
        : 'No dialogue for this cutscene';
    }

    if (!u.dialogueOverlay) return;

    if (!this.state.subtitlesEnabled || !hasDialogue || isSilenced) {
      u.dialogueOverlay.hidden = true;
      return;
    }

    u.dialogueOverlay.hidden = false;
    this.state.dialogueIndex = Math.max(0, Math.min(this.state.dialogueIndex, dialogue.length - 1));
    const line = dialogue[this.state.dialogueIndex];

    if (u.dialogueSpeaker) {
      u.dialogueSpeaker.textContent = line?.speaker || 'Dialogue';
    }
    if (u.dialogueText) {
      u.dialogueText.textContent = line?.text || '';
    }
    if (u.dialogueCounter) {
      u.dialogueCounter.textContent = `${this.state.dialogueIndex + 1} / ${dialogue.length}`;
    }
    if (u.btnDialoguePrev) {
      u.btnDialoguePrev.disabled = this.state.dialogueIndex <= 0;
      u.btnDialoguePrev.style.opacity = this.state.dialogueIndex <= 0 ? '0.3' : '1';
    }
    if (u.btnDialogueNext) {
      u.btnDialogueNext.disabled = this.state.dialogueIndex >= dialogue.length - 1;
      u.btnDialogueNext.style.opacity = this.state.dialogueIndex >= dialogue.length - 1 ? '0.3' : '1';
    }
  }

  bindEvents(u) {
    u.btnDialoguePrev?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.step(-1);
    });
    u.btnDialogueNext?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.step(1);
    });
    u.dialogueCard?.addEventListener('click', (e) => {
      if (e.target.closest('.dialogue-nav')) return;
      this.step(1, { wrap: true });
    });
  }

  reset() {
    this.state.dialogueIndex = 0;
    this.state.partElapsed = 0;
    this.state.lastVideoTime = 0;
    this.state.loopCount = 0;
    this.state.dialogueSchedule = null;
    const u = this.refs();
    if (u.dialogueOverlay) u.dialogueOverlay.hidden = true;
  }
}
