import { num, toPath } from './format.js';
import { isNSFWEntry } from '../../src/shared/decoder/index.js';

/**
 * Trust the scanner's fields verbatim: reshapes paths/sizes and normalizes entry.
 */
export function normalizeEntry(raw, gameId) {
  const name = String(raw?.name ?? '').trim();
  const rawChars = Array.isArray(raw?.characters)
    ? raw.characters
    : raw?.character && raw.character !== 'Various'
      ? raw.character.split(/,\s*/)
      : [];
  return {
    id: String(raw?.id ?? `${gameId}:${name}`),
    game: String(raw?.game ?? gameId),
    name,
    title: String(raw?.title ?? name),
    prefix: String(raw?.prefix ?? ''),
    category: String(raw?.category ?? ''),
    character: String(raw?.character ?? ''),
    characters: rawChars.filter(Boolean),
    scene: String(raw?.scene ?? ''),
    act: String(raw?.act ?? raw?.scene ?? ''),
    gameScene: String(raw?.gameScene ?? ''),
    tags: Array.isArray(raw?.tags) ? raw.tags : [],
    sceneId: String(raw?.sceneId ?? name),
    part: typeof raw?.part === 'number' ? raw.part : null,
    variant: String(raw?.variant ?? ''),
    alternate: raw?.alternate === true,
    hi: toPath(raw?.hi),
    lo: toPath(raw?.lo),
    sizeHi: num(raw?.sizeHi),
    sizeLo: num(raw?.sizeLo),
    nsfw: isNSFWEntry(raw, gameId),
    dialogue: Array.isArray(raw?.dialogue) ? raw.dialogue : [],
  };
}

/**
 * Relative order for variant/outfit sequences: Outfit 1 -> Outfit 2 -> NP -> fast -> other.
 */
export function variantRank(variant) {
  if (!variant || variant === 'O1') return 1;
  if (variant === 'O2') return 2;
  const m = /^O(\d+)$/i.exec(variant);
  if (m) return Number(m[1]);
  if (variant === 'NP') return 10;
  if (variant === 'fast') return 20;
  return 50;
}

/**
 * Fold entries into scenes: one card per scene, parts ordered cleanly
 * per variant/outfit sequence without interlacing (Variant -> Part -> Alternate).
 * The scene's display fields come from its first part.
 */
export function groupEntries(entries) {
  const map = new Map(); // game + sceneId -> scene
  for (const m of entries) {
    const rawSceneId = m.sceneId || m.name;
    const normSceneId = rawSceneId.replace(/^bc-/i, 'BC-');
    const key = m.game + '\u0000' + normSceneId.toLowerCase();
    let s = map.get(key);
    if (!s) {
      s = {
        sceneId: normSceneId,
        game: m.game,
        title: m.title,
        prefix: m.prefix,
        category: m.category || '',
        character: m.character,
        characters: new Set(m.characters || (m.character && m.character !== 'Various' ? [m.character] : [])),
        scene: m.scene,
        act: m.act || m.scene,
        gameScene: m.gameScene || '',
        tags: new Set(m.tags || []),
        parts: [],
      };
      map.set(key, s);
    } else {
      if (Array.isArray(m.characters)) {
        for (const c of m.characters) s.characters.add(c);
      }
      if (Array.isArray(m.tags)) {
        for (const t of m.tags) s.tags.add(t);
      }
    }
    s.parts.push(m);
  }
  for (const s of map.values()) {
    // If scene has outfit variants (e.g. O2), label base parts as O1 so they stay grouped as Outfit 1
    const hasOutfits = s.parts.some((p) => p.variant === 'O2' || p.variant === 'O1');
    if (hasOutfits) {
      for (const p of s.parts) {
        if (!p.variant) {
          p.variant = 'O1';
        }
      }
    }

    // Sort parts: Variant/Outfit first, then Part number, then Alternate, then Name
    s.parts.sort((a, b) => {
      const vDiff = variantRank(a.variant) - variantRank(b.variant);
      if (vDiff !== 0) return vDiff;

      const pA = a.part ?? 0;
      const pB = b.part ?? 0;
      if (pA !== pB) return pA - pB;

      if (Boolean(a.alternate) !== Boolean(b.alternate)) {
        return a.alternate ? 1 : -1;
      }

      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });

    const first = s.parts[0];
    s.name = first.name;
    s.title = first.title;
    s.prefix = first.prefix;
    s.category = first.category || s.category || first.prefix;
    s.character = s.characters.size > 0 ? [...s.characters].join(', ') : (first.character || 'Various');
    s.charactersList = s.characters.size > 0 ? [...s.characters] : (first.characters || []);
    s.scene = first.scene;
    s.act = first.act || first.scene;
    s.gameScene = first.gameScene || '';
    s.nsfw = s.parts.some((p) => p.nsfw ?? isNSFWEntry(p));
    s.hi = first.hi;
    s.lo = first.lo;
    s.sizeHi = first.sizeHi;
    s.sizeLo = first.sizeLo;
  }
  return [...map.values()];
}

/** Distinct scene count of an entry list. */
export function countScenes(entries) {
  const keys = new Set();
  for (const m of entries) {
    const rawSceneId = m.sceneId || m.name;
    const normSceneId = rawSceneId.replace(/^bc-/i, 'BC-');
    keys.add(m.game + '\u0000' + normSceneId.toLowerCase());
  }
  return keys.size;
}
