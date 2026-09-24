import { isBogusSceneTitle, CANONICAL_ACT_NAMES } from '../../src/shared/decoder/index.js';

export function renderFacetOptions(select, counts, current, { allLabel, noun = 'scenes' }) {
  if (!select) return '';

  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  select.textContent = '';
  const allOption = document.createElement('option');
  allOption.value = '';
  allOption.textContent = `${allLabel} (${counts.size})`;
  select.append(allOption);

  for (const [value, count] of entries) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = noun ? `${value} · ${count} ${noun}` : `${value} · ${count}`;
    select.append(option);
  }

  select.value = current && counts.has(current) ? current : '';
  return select.value;
}

export function renderPrefixOptions(select, items, currentPrefix) {
  const counts = new Map();
  for (const item of items) {
    const cat = item.category || item.prefix;
    if (cat) counts.set(cat, (counts.get(cat) ?? 0) + 1);
  }
  return renderFacetOptions(select, counts, currentPrefix, {
    allLabel: 'All categories',
    noun: 'scenes',
  });
}

export function renderCharacterOptions(select, items, currentCharacter, { activePrefix = '' } = {}) {
  const counts = new Map();
  for (const item of items) {
    if (activePrefix && item.prefix !== activePrefix && item.category !== activePrefix) continue;

    const chars = item.characters
      ? (item.characters instanceof Set ? [...item.characters] : item.characters)
      : item.charactersList || (item.character && item.character !== 'Various' ? item.character.split(/,\s*/) : []);

    for (const c of chars) {
      const name = String(c).trim();
      if (!name || name === 'Various') continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }

  return renderFacetOptions(select, counts, currentCharacter, {
    allLabel: 'All characters',
    noun: 'scenes',
  });
}

export function renderSceneOptions(select, items, currentScene, { activeCharacter = '', activePrefix = '' } = {}) {
  const counts = new Map();
  for (const item of items) {
    if (activePrefix && item.prefix !== activePrefix && item.category !== activePrefix) continue;
    if (activeCharacter) {
      const chars = item.characters
        ? (item.characters instanceof Set ? [...item.characters] : item.characters)
        : item.charactersList || (item.character && item.character !== 'Various' ? item.character.split(/,\s*/) : []);
      if (!chars.some((c) => c.toLowerCase() === activeCharacter.toLowerCase())) continue;
    }

    const sc = item.scene;
    if (sc && sc !== 'Misc' && sc !== 'Story Scene' && !isBogusSceneTitle(sc)) {
      counts.set(sc, (counts.get(sc) ?? 0) + 1);
    }
  }

  return renderFacetOptions(select, counts, currentScene, {
    allLabel: 'All scenes',
    noun: 'scenes',
  });
}

export function renderCharacterRibbon(container, items, currentCharacter, onSelect, { activePrefix = '' } = {}) {
  if (!container) return;

  const counts = new Map();
  let totalScenes = 0;

  for (const item of items) {
    if (activePrefix && item.prefix !== activePrefix && item.category !== activePrefix) continue;

    totalScenes++;
    const chars = item.characters
      ? (item.characters instanceof Set ? [...item.characters] : item.characters)
      : item.charactersList || (item.character && item.character !== 'Various' ? item.character.split(/,\s*/) : []);

    for (const c of chars) {
      const name = String(c).trim();
      if (!name || name === 'Various') continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }

  container.textContent = '';

  const allBtn = document.createElement('button');
  allBtn.type = 'button';
  allBtn.className = `char-pill ${!currentCharacter ? 'is-active' : ''}`;
  allBtn.setAttribute('data-character', '');
  const allLabel = document.createElement('span');
  allLabel.className = 'char-pill-label';
  allLabel.textContent = 'All';
  allBtn.append(allLabel);
  const allBadge = document.createElement('span');
  allBadge.className = 'char-pill-count';
  allBadge.textContent = String(totalScenes);
  allBtn.append(allBadge);
  allBtn.onclick = () => onSelect('');
  container.append(allBtn);

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  for (const [charName, count] of sorted) {
    const btn = document.createElement('button');
    btn.type = 'button';
    const isActive = Boolean(currentCharacter && currentCharacter.toLowerCase() === charName.toLowerCase());
    btn.className = `char-pill ${isActive ? 'is-active' : ''}`;
    btn.setAttribute('data-character', charName);
    const label = document.createElement('span');
    label.className = 'char-pill-label';
    label.textContent = charName;
    btn.append(label);
    const badge = document.createElement('span');
    badge.className = 'char-pill-count';
    badge.textContent = String(count);
    btn.append(badge);

    btn.onclick = () => {
      const next = isActive ? '' : charName;
      onSelect(next);
    };

    container.append(btn);
  }
}
