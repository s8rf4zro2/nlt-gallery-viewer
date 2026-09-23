/**
 * Pair low and high quality video candidates into consolidated entries.
 */

import { decodeEntry } from '../../shared/decoder/index.js';
import {
  characterFromStem,
  prefixFromStem,
  sceneFromStem,
  sceneGroupFromStem,
  titleFromStem,
} from './stem.js';

export function pairCandidates(game, candidates, gameIndex = null, terms = null) {
  const pairs = new Map();
  for (const candidate of candidates) {
    let slot = pairs.get(candidate.base);
    if (!slot) {
      slot = {};
      pairs.set(candidate.base, slot);
    }
    const key = candidate.lite ? 'lo' : 'hi';
    const existing = slot[key];
    if (!existing || candidate.rank < existing.rank) slot[key] = candidate;
  }

  const entries = [];
  for (const [name, slot] of pairs) {
    const group = sceneGroupFromStem(name);
    const prefix = prefixFromStem(name);
    const decoded = decodeEntry(
      {
        name,
        prefix,
        character: characterFromStem(name),
        scene: sceneFromStem(name),
      },
      game,
      gameIndex,
      terms,
    );

    const fact = gameIndex?.[game]?.videos?.[name] || gameIndex?.[game]?.videos?.[group.sceneId];
    const dialogue = Array.isArray(fact?.dialogue) && fact.dialogue.length > 0 ? fact.dialogue : undefined;

    entries.push({
      id: `${game}:${name}`,
      game,
      name,
      title: decoded.title || titleFromStem(name),
      prefix,
      category: decoded.category,
      character: decoded.character || characterFromStem(name),
      characters: decoded.characters,
      scene: decoded.scene || sceneFromStem(name),
      act: decoded.act,
      gameScene: decoded.gameScene,
      tags: decoded.tags,
      sceneId: group.sceneId,
      part: group.part,
      variant: group.variant,
      alternate: group.alternate,
      hi: slot.hi?.path ?? null,
      lo: slot.lo?.path ?? null,
      sizeHi: slot.hi?.size ?? 0,
      sizeLo: slot.lo?.size ?? 0,
      nsfw: Boolean(decoded.nsfw),
      dialogue,
    });
  }
  return entries;
}
