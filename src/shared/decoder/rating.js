import { isHeroineCode } from './characters.js';

export const ADULT_CATEGORIES = new Set([
  'booty call',
  'porn shop',
  'moan zone',
  'date',
  'doctor / clinic',
  'doctor',
  'massage',
]);

export const ADULT_PREFIXES = new Set(['bc', 'ps', 'mz', 'date']);

export const ADULT_ACTS_REGEX =
  /(?:blowjob|first fuck|anal|pussy|cowgirl|cowg|clit|cock|cplay|cock ?play|cunt|dicks?|tits?|boobs?|breast|foolin|penetrat|creampie|cum|squirt|orgy|threesome|foursome|fivesome|finger|fngr|fingering|eat ?out|masturbat|titjob|footjob|oral|sex|fuck|(?:fk|fck)\d+|nude|naked|facesit|striptease|strip|bottle|sunbathe|pool|piledriver|pd\d*|oil|tease|workout|empusa|medusa|demoteaser|succubus|sensual|titplay|domination|shower|horny|orgasm|climax)/i;

export const STEM_ACT_CODES =
  /(?:[A-Za-z0-9](?:bj|ff|anl?|pf|dp|tp|cp|ts|3s|4s|eo|tj|fj|fk|fck|pd)\d+)/i;

export const SFW_SYSTEM_STEMS =
  /^(?:logo|nltlogo|pkd_logo|title|opening|intro|ending\d*|playername|hospitalintro|fnl\d*b?|placeholder)\b/i;

export const GAME_SFW_REGISTRY = {
  nadia: {
    exact: new Set([
      'canoe', 'funeral', 'lunchparty', 'seeship', 'soulcrystal', 'bookthrow',
      'bully', 'tennis', 'herojoeykick', 'tashapunch', 'tashakick',
      'dinner1', 'dinner2', 'dinner3', 'dinner3_1', 'dinner3-l_1',
      'bufight', 'kahefght', 'crhecojofight',
    ]),
    patterns: [
      /^bgfght\d*$/i,
      /^joheft\d*$/i,
      /^dicrfight\d*$/i,
      /^divl\d*$/i,
      /^sodihemeet\d*$/i,
      /^meet(?:emily|pricia|sofia)\d*$/i,
    ],
  },
  genesis: {
    exact: new Set([
      'amuleth', 'dinner', 'mcerhrread', 'nemctied0', 'nomcint',
      'oracle', 'zephwrite', 'jochmc', 'kimcinterview',
    ]),
    patterns: [
      /^bomcbox\d*$/i,
      /^brread\d*$/i,
      /^didufght\d*$/i,
      /^dihrfight\d*$/i,
      /^dmlsfght\d*$/i,
      /^elhnarmw\d*$/i,
      /^li-meet\d*$/i,
      /^stdofght\d*$/i,
      /^toma-/i,
      /^research\d*$/i,
    ],
  },
  symphony: {
    exact: new Set([
      'amnews', 'breakfast', 'cleotomb', 'crmcfight', 'shootout',
      'tennis', 'tomcmsfight', 'midin',
    ]),
    patterns: [
      /^margaretmeet\d*$/i,
      /^meetgod\d*$/i,
      /^tnyetnlnch\d*$/i,
    ],
  },
};

// In NLT cutscenes (Genesis Order, Symphony, Nadia), 2 character codes signify adult encounters.
export function hasMultiCharacterCode(stem, characters = [], game = '') {
  if (Array.isArray(characters) && characters.length >= 2) return true;
  const raw = String(stem || '');
  const clean = raw.replace(/^BC-|^PS-|^Fig-|^MZ-|^MoanZone-?/i, '');

  const m = /^([A-Z][a-z])([A-Z][a-z])(?=[A-Z0-9_-]|$)/.exec(clean);
  if (m) {
    const c1 = m[1].toLowerCase();
    const c2 = m[2].toLowerCase();
    if (isHeroineCode(c1, game) && isHeroineCode(c2, game)) return true;
  }

  const mc1 = /^([A-Za-z]{2})Mc([A-Za-z]{2})(?=[A-Z0-9_-]|$)/i.exec(clean);
  if (mc1) {
    const c1 = mc1[1].toLowerCase();
    const c2 = mc1[2].toLowerCase();
    if (isHeroineCode(c1, game) && isHeroineCode(c2, game)) return true;
  }

  const mc2 = /^([A-Za-z]{2})([A-Za-z]{2})Mc(?=[A-Z0-9_-]|$)/i.exec(clean);
  if (mc2) {
    const c1 = mc2[1].toLowerCase();
    const c2 = mc2[2].toLowerCase();
    if (isHeroineCode(c1, game) && isHeroineCode(c2, game)) return true;
  }

  if (/(?:[3-7]s|7sm|orgy|threesome|foursome|fivesome|bigorgy|blnd4sm)/i.test(clean)) return true;

  return false;
}

export function isSFWStoryStem(stem, game = '') {
  if (!stem) return false;
  const s = String(stem).toLowerCase().trim();

  if (game && GAME_SFW_REGISTRY[game]) {
    const reg = GAME_SFW_REGISTRY[game];
    if (reg.exact.has(s)) return true;
    return reg.patterns.some((p) => p.test(stem));
  }

  for (const reg of Object.values(GAME_SFW_REGISTRY)) {
    if (reg.exact.has(s)) return true;
    if (reg.patterns.some((p) => p.test(stem))) return true;
  }
  return false;
}

export function isNSFWEntry(entryOrScene, game = '') {
  if (!entryOrScene) return true;

  const rawName = String(
    (typeof entryOrScene === 'string'
      ? entryOrScene
      : entryOrScene.name || entryOrScene.sceneId || entryOrScene.base) || ''
  ).trim();
  const name = rawName.toLowerCase();
  const title = String(entryOrScene.title || '').toLowerCase();
  const cat = String(entryOrScene.category || '').toLowerCase();
  const prefix = String(entryOrScene.prefix || '').toLowerCase();
  const scene = String(entryOrScene.scene || '').toLowerCase();
  const act = String(entryOrScene.act || '').toLowerCase();
  const characters = Array.isArray(entryOrScene.characters) ? entryOrScene.characters : [];
  const targetGame = game || (typeof entryOrScene === 'object' ? entryOrScene.game : '') || '';

  // Figurine showcase: base turnarounds and outfits are SFW; nude is NSFW
  if (cat === 'figurine / showcase' || prefix === 'fig' || name.startsWith('fig-')) {
    return name.includes('nude') || title.includes('nude');
  }

  // Inanimate 3D stone artifacts (Genesis Order: Toma stone body parts)
  if (name.startsWith('toma-')) {
    return false;
  }

  if (SFW_SYSTEM_STEMS.test(name) || SFW_SYSTEM_STEMS.test(title)) {
    return false;
  }

  if (ADULT_CATEGORIES.has(cat) || ADULT_PREFIXES.has(prefix) || /^(?:bc|ps|mz|date)[-_]/i.test(rawName)) {
    return true;
  }

  const combined = `${title} ${scene} ${act}`.toLowerCase();
  if (ADULT_ACTS_REGEX.test(combined) || ADULT_ACTS_REGEX.test(name) || STEM_ACT_CODES.test(rawName)) {
    return true;
  }

  if (hasMultiCharacterCode(rawName, characters, targetGame)) {
    return true;
  }

  if (isSFWStoryStem(rawName, targetGame)) {
    return false;
  }

  if (typeof entryOrScene.nsfw === 'boolean') {
    return entryOrScene.nsfw;
  }

  return true;
}
