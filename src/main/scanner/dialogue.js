import fsp from 'node:fs/promises';
import path from 'node:path';
import { parseMapFilesBatch } from './map-parser.js';

export const CHARACTERS_BY_GAME = {
  nadia: [
    'Alia', 'Clare', 'Diana', 'Emily', 'Evie', 'Janet', 'Jessica',
    'Kaley', 'Madalyn', 'Naomi', 'Pricia', 'Sofia', 'Tasha', 'Amber', 'Valerie', 'Katherine',
  ],
  genesis: [
    'Andrea', 'Arianna', 'Carol', 'Casandra', 'Chloe', 'Debra', 'Diana',
    'Ella', 'Erica', 'Hannah', 'Heather', 'Judy', 'Kimberly', 'Lillian',
    'Lisa', 'Madalyn', 'Melissa', 'Nellie', 'Oracle', 'Tara', 'Toma',
    'Alia', 'Amber', 'Bancroft', 'Clare', 'Evie', 'Janet', 'Jessica',
    'Kaley', 'Katherine', 'Naomi', 'Sofia', 'Valerie', 'William',
  ],
  symphony: [
    'Agrat', 'Amira', 'Anya', 'Athena', 'Autumn', 'Cleopatra', 'Divya',
    'Empusa', 'Grace', 'Julia', 'Kelli', 'Leila', 'Lola', 'Lucy',
    'Madison', 'Margaret', 'Medusa', 'Nia', 'Nora', 'Olivia', 'Sofia',
    'Carol', 'Naomi', 'Melissa', 'Evie', 'Lillian', 'Ella', 'Clare',
  ],
};

export const BOGUS_TITLES = new Set([
  'normal', 'angle 1', 'angle 2', 'angle', 'end', 'cancel', 'back', 'exit', 'leave',
  'yes', 'no', 'other',
]);

export const SPECIAL_SCENE_CASTS = {
  blnd4sm: ['Jessica', 'Kaley', 'Emily'],
  'blonde foursome': ['Jessica', 'Kaley', 'Emily'],
  bigorgy: [
    'Arianna', 'Lillian', 'Hannah', 'Erica', 'Chloe', 'Carol', 'Nellie',
    'Heather', 'Melissa', 'Ella', 'Judy', 'Kimberly', 'Andrea',
  ],
  orgy: [
    'Arianna', 'Lillian', 'Hannah', 'Erica', 'Chloe', 'Carol', 'Nellie',
    'Heather', 'Melissa', 'Ella', 'Judy', 'Kimberly', 'Andrea',
  ],
  '7sm': ['Arianna', 'Lillian', 'Judy', 'Nellie', 'Erica', 'Ella'],
  arlijupeerel7sm: ['Arianna', 'Lillian', 'Judy', 'Nellie', 'Erica', 'Ella'],
};

export const SPEAKER_MAP = {
  nadia: {
    he: 'Hero', mc: 'Hero', al: 'Alia', cl: 'Clare', cr: 'Clare', di: 'Diana',
    em: 'Emily', ev: 'Evie', ja: 'Janet', je: 'Jessica', jes: 'Jessica',
    ka: 'Kaley', ma: 'Madalyn', ml: 'Madalyn', na: 'Naomi', pr: 'Pricia',
    so: 'Sofia', ta: 'Tasha', am: 'Amber', va: 'Valerie', kt: 'Katherine',
    ch: 'Charles',
  },
  genesis: {
    mc: 'Michael', he: 'Heather', ad: 'Andrea', ar: 'Arianna', ca: 'Carol',
    ch: 'Chloe', de: 'Debra', di: 'Diana', el: 'Ella', er: 'Erica',
    ha: 'Hannah', hn: 'Hannah', ju: 'Judy', ki: 'Kimberly', li: 'Lillian',
    ls: 'Lisa', ma: 'Madalyn', ml: 'Madalyn', me: 'Melissa', ne: 'Nellie',
    or: 'Oracle', ta: 'Tara', to: 'Toma', wi: 'William', al: 'Alia',
    am: 'Amber', cl: 'Clare', ev: 'Evie', ja: 'Janet', je: 'Jessica',
    ka: 'Kaley', so: 'Sofia', va: 'Valerie',
  },
  symphony: {
    mc: 'Cole', he: 'Cole', ar: 'Agrat', ag: 'Agrat', to: 'Tony',
    am: 'Amira', ay: 'Anya', at: 'Athena', au: 'Autumn', bk: 'Baako',
    ad: 'Amanda', da: 'Daniel', di: 'Divya', ed: 'Edmund', el: 'Elijah',
    em: 'Empusa', gr: 'Grace', ja: 'Jaxon', ju: 'Julia', ke: 'Kelli',
    lw: 'Lillian', le: 'Leila', ln: 'Leon', li: 'Lillian', lo: 'Lola',
    lu: 'Lucy', md: 'Madison', mg: 'Margaret', ni: 'Nia', nr: 'Nora',
    no: 'Nora', ol: 'Olivia', al: 'Alexander', cp: 'Cleopatra', cl: 'Cleopatra',
    ms: 'Medusa', me: 'Medusa', so: 'Sofia', et: 'Ethan',
  },
};

export function resolveSpeaker(code, game) {
  const norm = code.replace(/[^a-zA-Z]/g, '').toLowerCase();
  const map = SPEAKER_MAP[game] || {};
  return map[norm.slice(0, 3)] || map[norm.slice(0, 2)] || (game === 'genesis' ? 'Michael' : game === 'symphony' ? 'Cole' : 'Hero');
}

export function cleanDialogueText(raw, game) {
  let text = raw.replace(/^[\s#>^!+c]+/, '').trim();
  const hero = game === 'genesis' ? 'Michael' : game === 'symphony' ? 'Cole' : 'Hero';
  text = text.replace(/\b1Hero\b/g, hero);
  text = text.replace(/<[^>]+>/g, '');
  text = text.replace(/\\(?:[vVcCgGiInN]|px|py|w)\b.*?\]/g, '');
  text = text.replace(/\\\^/g, '');
  return text.trim();
}

export async function findGameDataDir(gameDir, moviesDir) {
  const candidates = [];
  if (gameDir) {
    candidates.push(path.join(gameDir, 'data'));
    candidates.push(path.join(gameDir, 'www', 'data'));
  }
  if (moviesDir) {
    candidates.push(path.resolve(moviesDir, '..', 'data'));
    candidates.push(path.resolve(moviesDir, '..', 'www', 'data'));
    candidates.push(path.resolve(moviesDir, '..', '..', 'data'));
    candidates.push(path.resolve(moviesDir, '..', '..', 'www', 'data'));
  }

  for (const dir of candidates) {
    try {
      const ce = path.join(dir, 'CommonEvents.json');
      const st = await fsp.stat(ce);
      if (st.isFile()) return dir.replace(/\\/g, '/');
    } catch {}
  }
  return null;
}

export async function extractGameDialogue(game, gameDir, moviesDir, { onProgress } = {}) {
  const dataDir = await findGameDataDir(gameDir, moviesDir);
  if (!dataDir) return null;

  const cePath = path.join(dataDir, 'CommonEvents.json');
  const sysPath = path.join(dataDir, 'System.json');

  let commonEvents;
  try {
    commonEvents = JSON.parse(await fsp.readFile(cePath, 'utf8'));
  } catch {
    return null;
  }

  let system = {};
  try {
    system = JSON.parse(await fsp.readFile(sysPath, 'utf8'));
  } catch {}

  const switches = system.switches || [];
  const canonicalChars = CHARACTERS_BY_GAME[game] || [];
  const videos = {};

  function note(video) {
    if (!videos[video]) {
      videos[video] = { video, scene: '', titles: [], characters: [], sources: [] };
    }
    return videos[video];
  }

  for (const ev of commonEvents) {
    if (!ev || !ev.list) continue;
    const rawName = (ev.name || '').trim();

    const sm = /^(?:SCN|PS|DATE|MZ|MASSAGE|DOCTOR|Doctor)\s*[-–:]?\s*(.+)$/i.exec(rawName);
    if (!sm) continue;
    const sceneTitle = sm[1].trim();

    const evChars = [];
    const lowerName = rawName.toLowerCase();

    for (const [pattern, cast] of Object.entries(SPECIAL_SCENE_CASTS)) {
      if (lowerName.includes(pattern)) {
        for (const c of cast) {
          if (!evChars.includes(c)) evChars.push(c);
        }
      }
    }

    for (const c of canonicalChars) {
      if (new RegExp(`\\b${c}\\b`, 'i').test(rawName)) {
        if (!evChars.includes(c)) evChars.push(c);
      }
    }

    for (const cmd of ev.list) {
      if (cmd.code === 121) {
        const start = cmd.parameters[0];
        const end = cmd.parameters[1];
        for (let s = start; s <= end; s++) {
          const sw = switches[s] || '';
          const m = /([A-Za-z]+)\s*[-–]?\s*Nude/i.exec(sw);
          if (m) {
            const lead = m[1].toUpperCase();
            if (lead !== 'HERO' && lead !== 'MC' && lead !== 'ANGEL') {
              const norm = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
              const matched = canonicalChars.find((c) => c.toLowerCase() === norm.toLowerCase());
              if (matched && !evChars.includes(matched)) evChars.push(matched);
            }
          }
        }
      }
    }

    let activeVid = null;
    let activeDialogue = [];
    let vidFrames = 0;
    let activeVidIsLoop = false;

    for (const cmd of ev.list) {
      let vid = null;
      let isLooping = false;

      if (cmd.code === 355 || cmd.code === 655) {
        const text = cmd.parameters[0] || '';
        const vm = /(?:loadVideo|newVideo|playVideo)\('([^']+)'\)/.exec(text);
        if (vm) vid = vm[1];
        if (text.includes('setLoopById')) activeVidIsLoop = true;
      } else if (cmd.code === 357 && cmd.parameters[1] === 'ShowVAnim') {
        const param = cmd.parameters[3];
        if (param && param.id) {
          vid = String(param.id);
          isLooping = param.isLoop === 'true';
        }
      }

      if (vid) {
        if (activeVid && activeDialogue.length > 0) {
          const prevRec = note(activeVid);
          if (!prevRec.dialogue) prevRec.dialogue = [];
          prevRec.dialogue.push(...activeDialogue);
          activeDialogue = [];
        }
        activeVid = vid;
        activeVidIsLoop = isLooping;
        vidFrames = 0;
        const rec = note(vid);
        if (!rec.scene) rec.scene = sceneTitle;
        rec.sources.push(`CE:${ev.id}`);
        for (const c of evChars) {
          if (!rec.characters.includes(c)) rec.characters.push(c);
        }
      }

      if (activeVid) {
        if (cmd.code === 230) {
          vidFrames += Number(cmd.parameters[0]) || 0;
        }

        if (cmd.code === 355 || cmd.code === 655) {
          const text = cmd.parameters[0] || '';
          if (text.includes('setLoopById')) activeVidIsLoop = true;
          const dm = /\$gameVariables\.setValue\(\s*(?:21|301)\s*,\s*"([^"]+)"\s*\)/.exec(text);
          if (dm) {
            const raw = dm[1];
            const dotIdx = raw.indexOf('.');
            if (dotIdx > 0 && dotIdx < 15) {
              const rawSpeaker = raw.slice(0, dotIdx);
              const rawText = raw.slice(dotIdx + 1);
              const speaker = resolveSpeaker(rawSpeaker, game);
              const cleanText = cleanDialogueText(rawText, game);
              const last = activeDialogue[activeDialogue.length - 1];
              if (cleanText && (!last || last.speaker !== speaker || last.text !== cleanText)) {
                activeDialogue.push({
                  speaker,
                  text: cleanText,
                  ...(!activeVidIsLoop && vidFrames >= 60 ? { time: Math.round((vidFrames / 60) * 100) / 100 } : {}),
                });
              }
            }
          }
        } else if (cmd.code === 401) {
          const rawText = String(cmd.parameters[0] || '');
          const cleanText = cleanDialogueText(rawText, game);
          if (cleanText && cleanText.length > 2 && !cleanText.startsWith('http')) {
            const speaker = evChars.length > 0 ? evChars[0] : (game === 'genesis' ? 'Michael' : game === 'symphony' ? 'Cole' : 'Hero');
            const last = activeDialogue[activeDialogue.length - 1];
            if (!last || last.speaker !== speaker || last.text !== cleanText) {
              activeDialogue.push({
                speaker,
                text: cleanText,
                ...(!activeVidIsLoop && vidFrames >= 60 ? { time: Math.round((vidFrames / 60) * 100) / 100 } : {}),
              });
            }
          }
        }
      }
    }

    if (activeVid && activeDialogue.length > 0) {
      const prevRec = note(activeVid);
      if (!prevRec.dialogue) prevRec.dialogue = [];
      prevRec.dialogue.push(...activeDialogue);
    }
  }

  try {
    const dirEntries = await fsp.readdir(dataDir);
    const mapFiles = dirEntries.filter((f) => /^Map\d+\.json$/i.test(f));
    const titlesByVid = await parseMapFilesBatch(dataDir, mapFiles, { onProgress });
    for (const [vid, titles] of Object.entries(titlesByVid)) {
      const rec = note(vid);
      for (const title of titles) {
        if (!rec.titles.includes(title)) {
          rec.titles.push(title);
        }
      }
    }
  } catch {}

  return {
    root: gameDir || path.resolve(dataDir, '..').replace(/\\/g, '/'),
    videos,
  };
}
