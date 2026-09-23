import { CHIPS, chipDef } from './chips.js';

const prefersReducedMotion = () => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

export function paintChips(u, scene, currentChip) {
  if (!u.chips || !scene) return;
  const parts = scene.parts;
  const hasOutfits = parts.some((part) => part.variant === 'O2' || part.variant === 'O1');
  const hasNP = parts.some((part) => part.variant === 'NP');
  for (const button of u.chips.querySelectorAll('[data-chip]')) {
    const chip = chipDef(button.dataset.chip);
    const count = parts.filter((part) => {
      if (chip.id === 'O1' && !hasOutfits && !hasNP) return false;
      return chip.match(part);
    }).length;
    const on = chip.id === currentChip;
    if (chip.id === 'NP') {
      button.style.display = hasNP ? '' : 'none';
    }
    button.disabled = chip.id !== 'all' && count === 0;
    button.classList.toggle('is-on', on);
    button.setAttribute('aria-pressed', String(on));
    button.title = count === 1 ? '1 part' : `${count} parts`;
  }
}

export function createRailItem(part, index, onLoadPart) {
  const li = document.createElement('li');
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = String(index + 1);
  if (part.variant) button.dataset.variant = part.variant;
  const variantWord = part.variant === 'O1'
    ? 'Outfit 1'
    : part.variant === 'O2'
      ? 'Outfit 2'
      : part.variant === 'NP'
        ? 'No Panties'
        : part.variant;
  const tags = [variantWord || 'base', part.alternate ? 'ALT' : ''].filter(Boolean).join(' · ');
  button.title = `${part.name} · part ${part.part ?? '–'} · ${tags}`;
  button.setAttribute('aria-label', button.title);
  button.addEventListener('click', () => onLoadPart(index));
  li.append(button);
  return li;
}

export function paintRail(u, state, railKeyHolder, onLoadPart) {
  if (!u.rail || !state.scene) return;

  const key = `${state.scene.sceneId}:${state.chip}:${state.queue.map((part) => part.id).join('|')}`;
  if (key !== railKeyHolder.key) {
    railKeyHolder.key = key;
    u.rail.replaceChildren(...state.queue.map((part, idx) => createRailItem(part, idx, onLoadPart)));
  }

  const buttons = u.rail.querySelectorAll('button');
  buttons.forEach((button, index) => {
    const current = index === state.cursor;
    button.classList.toggle('is-current', current);
    if (current) button.setAttribute('aria-current', 'true');
    else button.removeAttribute('aria-current');
  });

  const current = buttons[state.cursor];
  if (!current) return;
  const railRect = u.rail.getBoundingClientRect();
  const buttonRect = current.getBoundingClientRect();
  const target = u.rail.scrollLeft + (buttonRect.left - railRect.left) - (railRect.width - buttonRect.width) / 2;
  u.rail.scrollTo({ left: Math.max(0, target), behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}
