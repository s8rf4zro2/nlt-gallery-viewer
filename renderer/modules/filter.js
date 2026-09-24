import { countScenes } from './grouping.js';
import { isNSFWEntry } from '../../src/shared/decoder/index.js';

export function filterEntries({
  all,
  query = '',
  prefix = '',
  character = '',
  scene = '',
  rating = '',
}) {
  const q = query.trim().toLowerCase();
  const r = (rating || '').trim().toLowerCase();
  const hasRating = r === 'nsfw' || r === 'sfw';
  const hasPrefix = Boolean(prefix);
  const hasChar = Boolean(character);
  const hasScene = Boolean(scene);
  const hasQuery = Boolean(q);

  if (!hasQuery && !hasPrefix && !hasChar && !hasScene && !hasRating) {
    return all.slice();
  }

  const queryTerms = hasQuery ? q.split(/\s+/).filter(Boolean) : [];

  return all.filter((m) => {
    if (hasRating) {
      const isNsfw = typeof m.nsfw === 'boolean' ? m.nsfw : isNSFWEntry(m, m.game);
      if (r === 'nsfw' && !isNsfw) return false;
      if (r === 'sfw' && isNsfw) return false;
    }

    if (hasPrefix) {
      const matchPrefix =
        m.prefix === prefix ||
        m.category === prefix ||
        (m.category && m.category.toLowerCase() === prefix.toLowerCase()) ||
        (m.prefix && m.prefix.toLowerCase() === prefix.toLowerCase());
      if (!matchPrefix) return false;
    }

    if (hasChar) {
      const chars = Array.isArray(m.characters) && m.characters.length > 0
        ? m.characters
        : (m.character && m.character !== 'Various' ? m.character.split(/,\s*/) : []);
      const matchChar = chars.some((c) => c.toLowerCase() === character.toLowerCase());
      if (!matchChar) return false;
    }

    if (hasScene) {
      const matchScene =
        m.scene === scene ||
        m.act === scene ||
        (m.scene && m.scene.toLowerCase() === scene.toLowerCase()) ||
        (m.act && m.act.toLowerCase() === scene.toLowerCase());
      if (!matchScene) return false;
    }

    if (hasQuery) {
      const charTokens = Array.isArray(m.characters)
        ? m.characters.join(' ')
        : (m.character || '');
      const tagTokens = Array.isArray(m.tags) ? m.tags.join(' ') : '';
      const textToSearch = `${m.title || ''} ${m.name || ''} ${m.scene || ''} ${m.act || ''} ${m.category || ''} ${m.prefix || ''} ${charTokens} ${m.gameScene || ''} ${tagTokens}`.toLowerCase();

      const allTermsFound = queryTerms.every((term) => textToSearch.includes(term));
      if (!allTermsFound) return false;
    }

    return true;
  });
}

export function formatStatusText({
  gameLabel,
  allEntries,
  filteredEntries,
  prefix,
  character,
  scene,
  query,
  rating,
}) {
  const totalClips = allEntries.length;
  const totalScenes = countScenes(allEntries);
  const activeList = filteredEntries || allEntries;
  const activeClips = activeList.length;
  const activeScenes = countScenes(activeList);

  let summary = `${gameLabel}: `;
  if (activeClips === totalClips && activeScenes === totalScenes) {
    summary += `${totalScenes.toLocaleString()} scenes (${totalClips.toLocaleString()} clips)`;
  } else {
    summary += `${activeScenes.toLocaleString()} scenes (${activeClips.toLocaleString()} clips) of ${totalScenes.toLocaleString()}`;
  }

  const parts = [summary];
  if (rating && rating.toLowerCase() === 'sfw') parts.push('SFW only');
  else if (rating && rating.toLowerCase() === 'all') parts.push('NSFW + SFW');
  if (prefix) parts.push(`category "${prefix}"`);
  if (character) parts.push(`character "${character}"`);
  if (scene) parts.push(`scene "${scene}"`);
  if (query && query.trim()) parts.push(`search "${query.trim()}"`);
  return parts.join(' · ');
}
