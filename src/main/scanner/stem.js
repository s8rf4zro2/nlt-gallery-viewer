/**
 * Stem parsing, facet tokens, grouping, and title helpers.
 */

import {
  CHARACTER_ALIASES,
  SCENE_ALIASES,
  NO_CHARACTER,
  NO_SCENE,
  FIG_SCENES,
  FIG_SHOWCASE,
} from './constants.js';

export function stripLiteSuffix(stem) {
  return stem.endsWith('-l') ? stem.slice(0, -2) : stem;
}

export function titleFromStem(stem) {
  const base = stripLiteSuffix(stem);
  if (!base) return base;
  const words = base
    .replace(/[-_]+/g, ' ')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([0-9])([A-Za-z])/g, '$1 $2');
  return words.replace(/\s+/g, ' ').trim() || base;
}

export function prefixFromStem(stem) {
  const base = stripLiteSuffix(stem);
  const dash = base.indexOf('-');
  if (dash > 0) return base.slice(0, dash);
  const underscore = base.indexOf('_');
  if (underscore > 0) return base.slice(0, underscore);
  return 'misc';
}

export function facetTokens(text) {
  const tokens = [];
  for (const part of text.split(/[-_]+/)) {
    if (!part) continue;
    tokens.push(...(part.match(/[A-Z]+(?![a-z])|[A-Z][a-z0-9]*|[a-z0-9]+/g) ?? [part]));
  }
  return tokens;
}

export function sceneFromText(text) {
  const segment = (text.split('-')[0] ?? '').replace(/^O\d+/, '');
  const run = /^[A-Za-z]+/.exec(segment)?.[0] ?? '';
  const scene =
    run.length > 2 && run.endsWith('O') && /^\d/.test(segment.slice(run.length))
      ? run.slice(0, -1)
      : run;
  if (!scene) return NO_SCENE;
  return SCENE_ALIASES[scene.toLowerCase()] ?? scene;
}

export function figFacets(stem) {
  const parts = stem.split('-');
  const character = parts[1] ?? '';
  const pose = (parts[2] ?? '').toLowerCase();
  return { character: character || NO_CHARACTER, scene: FIG_SCENES[pose] ?? FIG_SHOWCASE };
}

export function bcFacets(stem) {
  const body = stem.slice(3);
  const dash = body.indexOf('-');
  const head = dash === -1 ? body : body.slice(0, dash);
  const tail = dash === -1 ? '' : body.slice(dash + 1);

  const mapped = CHARACTER_ALIASES[head.toLowerCase()];
  if (mapped) return { character: mapped, scene: sceneFromText(tail) };

  const tag = /^\d+[A-Za-z]+/.exec(head)?.[0];
  if (tag) return { character: tag, scene: sceneFromText(head.slice(tag.length) + tail) };

  const glued = /^[A-Za-z]{2}(?=[A-Z])/.exec(head)?.[0];
  if (glued) {
    return {
      character: CHARACTER_ALIASES[glued.toLowerCase()] ?? glued,
      scene: sceneFromText(head.slice(glued.length) + tail),
    };
  }

  return { character: head || NO_CHARACTER, scene: sceneFromText(tail) };
}

export function miscFacets(stem) {
  const tokens = facetTokens(stem);
  let run = 0;
  while (run < tokens.length) {
    const code = tokens[run].replace(/\d+$/, '').toLowerCase();
    if (!(code in CHARACTER_ALIASES)) break;
    run++;
  }
  const first = run > 0 ? tokens[0].replace(/\d+$/, '').toLowerCase() : '';
  const sceneToken = tokens[run] ? /^[A-Za-z]+/.exec(tokens[run])?.[0] : undefined;
  return {
    character: CHARACTER_ALIASES[first] ?? NO_CHARACTER,
    scene: sceneToken ? (SCENE_ALIASES[sceneToken.toLowerCase()] ?? sceneToken) : NO_SCENE,
  };
}

export function psFacets(stem) {
  const tag = stem.slice(3).replace(/\d+$/, '');
  const tokens = facetTokens(tag);
  let run = 0;
  while (run < tokens.length) {
    const code = tokens[run].replace(/\d+$/, '').toLowerCase();
    if (!(code in CHARACTER_ALIASES)) break;
    run++;
  }
  if (run === 0) return { character: NO_CHARACTER, scene: tag || NO_SCENE };

  const lead = tokens[0];
  const rest = tag.slice(lead.length).replace(/^[-_]+/, '');
  return {
    character: CHARACTER_ALIASES[lead.replace(/\d+$/, '').toLowerCase()],
    scene: rest ? sceneFromText(rest) : NO_SCENE,
  };
}

export function facetsFromStem(stem) {
  const base = stripLiteSuffix(stem);
  if (/^fig-/i.test(base)) return figFacets(base);
  if (/^bc-/i.test(base)) return bcFacets(base);
  if (/^ps-/i.test(base)) return psFacets(base);
  return miscFacets(base);
}

export function characterFromStem(stem) {
  return facetsFromStem(stem).character;
}

export function sceneFromStem(stem) {
  return facetsFromStem(stem).scene;
}

export function sceneGroupFromStem(stem) {
  let base = stripLiteSuffix(stem);
  let alternate = false;
  if (/ALT$/i.test(base)) {
    alternate = true;
    base = base.replace(/ALT$/i, '');
  }
  let variant = '';
  if (/NP$/i.test(base)) {
    variant = 'NP';
    base = base.slice(0, -2);
  } else if (/fast$/i.test(base)) {
    variant = 'fast';
    base = base.slice(0, -4);
  } else {
    const om = /(?<=\d|[-_])O([12])$/.exec(base);
    if (om) {
      variant = `O${om[1]}`;
      base = base.slice(0, -2).replace(/[-_]+$/, '');
    } else if (/(?<=\d)O$/.test(base)) {
      // In Symphony of the Serpent, 2nd outfits use a single trailing uppercase 'O' after part digits
      // (e.g. BC-Grace-EO1O, BC-CpEO1O, BC-Am-DT1O, GrHandies1O).
      variant = 'O2';
      base = base.slice(0, -1);
    }
  }

  // Outfit in middle with tail text: e.g. BC-Emily-O1PF1 -> BC-Emily-PF, variant O1, part 1
  const em = /^([A-Za-z0-9_-]+?)[-_]O([12])([A-Za-z]+)(\d+)$/.exec(base);
  if (em) {
    let key = `${em[1]}-${em[3]}`;
    if (/^bc-/i.test(key)) key = 'BC-' + key.slice(3);
    return { sceneId: key, part: Number(em[4]), variant: `O${em[2]}`, alternate };
  }

  // Glued/hyphenated BC outfit shape: BC-TaBjO1-1, BC-Alia-Foolin-O1-1, BC-Naomi-TitFO2-1
  const dm = /^([A-Za-z0-9_-]+?)[-_]?O([12])[-_](\d+)$/.exec(base);
  if (dm) {
    let key = dm[1].replace(/[-_]+$/, '');
    if (/^BC-3(?=[^sS][A-Za-z]{3})/i.test(key)) {
      key = key.replace(/^(BC-)3(?=[^sS][A-Za-z]{3})/i, '$13s');
    }
    if (/^bc-/i.test(key)) key = 'BC-' + key.slice(3);
    return { sceneId: key, part: Number(dm[3]), variant: `O${dm[2]}`, alternate };
  }

  const pm = /(\d+)$/.exec(base);
  if (!pm) {
    let key = base || stem;
    if (/^bc-/i.test(key)) key = 'BC-' + key.slice(3);
    return { sceneId: key, part: null, variant, alternate };
  }
  const digits = pm[1];
  let key = base.slice(0, -digits.length).replace(/[-_]+$/, '');
  if (!key) return { sceneId: base, part: null, variant, alternate };
  if (/^BC-3(?=[^sS][A-Za-z]{3})/i.test(key)) {
    key = key.replace(/^(BC-)3(?=[^sS][A-Za-z]{3})/i, '$13s');
  }
  if (/^bc-/i.test(key)) key = 'BC-' + key.slice(3);
  return { sceneId: key, part: Number(digits), variant, alternate };
}
