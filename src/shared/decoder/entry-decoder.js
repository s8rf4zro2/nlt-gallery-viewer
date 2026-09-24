import {
  PLACEHOLDERS,
  CHARACTERS_BY_GAME,
  GAME_VALID_CHARACTERS,
  GAME_CHARACTER_ALIASES,
  CHARACTER_ALIASES,
  GAME_SPECIFIC_CHARACTERS,
} from './characters.js';
import {
  ACT_ABBREVS,
  ACT_DICTIONARY,
  PS_SCENES,
  CATEGORY_MAP,
} from './dictionaries.js';
import {
  isBogusSceneTitle,
  formatCamelWords,
  cleanSceneName,
} from './text-utils.js';
import { isNSFWEntry } from './rating.js';

export function decodeEntry(entry, game, gameIndex = null, terms = null) {
  const name = String(entry.name || entry.base || '').trim();
  const lowerName = name.toLowerCase();
  const overrides = GAME_SPECIFIC_CHARACTERS[game] || {};
  
  // Check game-index facts first (highest authority from game's CommonEvents)
  const facts = gameIndex?.get ? gameIndex.get(lowerName) : gameIndex?.[game]?.videos?.[name];
  
  let category = 'Story Cutscene';
  const prefixMatch = /^([A-Za-z]+)[-_]/.exec(name);
  const rawPrefix = prefixMatch ? prefixMatch[1] : (entry.prefix || 'misc');
  const lowerPrefix = rawPrefix.toLowerCase();

  if (game === 'symphony') {
    if (/^moanzone|^mz/i.test(name)) {
      category = 'Moan Zone';
    } else if (/^bc/i.test(name)) {
      category = 'Booty Call';
    } else if (
      /^(?:Autumn|Divya|Kelli|Lucy|Madison|Nora)(?:[A-Z]{2}|\d)/i.test(name) ||
      /^(?:Au|Di|Ke|Lu|Ma|No|Ju)[-_]?(?:MS|FJ|TF|SS|BP|EO|AP|HJ|69|BJ|DT|AS|CG|RC|PS|PF)\d*/i.test(name) ||
      /^date/i.test(name)
    ) {
      category = 'Date';
    } else if (CATEGORY_MAP[lowerPrefix]) {
      category = CATEGORY_MAP[lowerPrefix];
    }
  } else {
    if (CATEGORY_MAP[lowerPrefix]) {
      category = CATEGORY_MAP[lowerPrefix];
    } else if (/^fig/i.test(name)) {
      category = 'Figurine / Showcase';
    } else if (/^date/i.test(name)) {
      category = 'Date';
    } else if (/^bc/i.test(name)) {
      category = 'Booty Call';
    } else if (/^ps/i.test(name)) {
      category = 'Porn Shop';
    } else if (/^mz|^moanzone/i.test(name)) {
      category = 'Moan Zone';
    } else if (/^doctor/i.test(name)) {
      category = 'Doctor / Clinic';
    } else if (/^massage/i.test(name)) {
      category = 'Massage';
    }
  }

  const gameAliases = GAME_CHARACTER_ALIASES[game] || {};
  const validChars = GAME_VALID_CHARACTERS[game] || null;
  function isValidChar(c) {
    if (!c) return false;
    return !validChars || validChars.has(c);
  }

  const NON_CHAR_STEMS = new Set([
    'logo', 'nltlogo', 'amuleth', 'canoe', 'lunchparty', 'meeting', 'dagadg',
    'nuke', 'fasthealth', 'fasthealthbar', 'fasthealthcontainer', 'containers',
    'anachorismos',
  ]);
  const isNonCharStem = NON_CHAR_STEMS.has(lowerName) ||
    lowerName.startsWith('logo') ||
    lowerName.startsWith('hetroom') ||
    lowerName.startsWith('herocu') ||
    lowerName.startsWith('herojoeykick') ||
    lowerName.startsWith('agvl') ||
    lowerName.startsWith('toma-');

  const characters = [];
  
  // Check Threesome code e.g. "BC-3sJeJa1", "BC-3sAlTa", "3sKaEm", "BC-3NaPr12"
  const threeSomeMatch = /(?:^|[-_])3s?([A-Za-z]{2})([A-Za-z]{2})/i.exec(name);
  if (threeSomeMatch) {
    const c1Code = threeSomeMatch[1].toLowerCase();
    const c2Code = threeSomeMatch[2].toLowerCase();
    const c1 = overrides[c1Code] || gameAliases[c1Code] || CHARACTER_ALIASES[c1Code];
    const c2 = overrides[c2Code] || gameAliases[c2Code] || CHARACTER_ALIASES[c2Code];
    if (c1 && isValidChar(c1) && !characters.includes(c1)) characters.push(c1);
    if (c2 && isValidChar(c2) && !characters.includes(c2)) characters.push(c2);
  }

  // Check 7-some e.g. "ArLiJuNeErEl7sm"
  if (/7sm/i.test(name)) {
    const orgyChars = ['Arianna', 'Lillian', 'Judy', 'Nellie', 'Erica', 'Ella'];
    for (const oc of orgyChars) {
      if (isValidChar(oc) && !characters.includes(oc)) characters.push(oc);
    }
  }

  // Check Blonde Foursome in Nadia
  if (/blnd4sm/i.test(name)) {
    const blondeChars = ['Jessica', 'Kaley', 'Emily'];
    for (const bc of blondeChars) {
      if (isValidChar(bc) && !characters.includes(bc)) characters.push(bc);
    }
  }

  // Check Big Orgy in Genesis
  if (/bigorgy/i.test(name)) {
    const orgyChars = [
      'Arianna', 'Lillian', 'Hannah', 'Erica', 'Chloe', 'Carol', 'Nellie',
      'Heather', 'Melissa', 'Ella', 'Judy', 'Kimberly', 'Andrea',
    ];
    for (const oc of orgyChars) {
      if (isValidChar(oc) && !characters.includes(oc)) characters.push(oc);
    }
  }

  // Check Genesis Porn Shop stems
  if (/^ps-/i.test(name)) {
    const psKey = name.replace(/^ps-/i, '').replace(/\d+.*$/i, '').toLowerCase();
    const psDef = PS_SCENES[psKey];
    if (psDef) {
      for (const c of psDef.characters) {
        if (isValidChar(c) && !characters.includes(c)) characters.push(c);
      }
    }
  }

  // Check Symphony Moan Zone stems
  if (/^moanzone|^mz/i.test(name)) {
    if (/moanzone-cn|carolnaomi/i.test(name)) {
      if (isValidChar('Carol') && !characters.includes('Carol')) characters.push('Carol');
      if (isValidChar('Naomi') && !characters.includes('Naomi')) characters.push('Naomi');
    } else if (/hannahalia/i.test(name)) {
      if (isValidChar('Hannah') && !characters.includes('Hannah')) characters.push('Hannah');
      if (isValidChar('Alia') && !characters.includes('Alia')) characters.push('Alia');
    } else if (/moanzone-he|evie/i.test(name)) {
      if (isValidChar('Evie') && !characters.includes('Evie')) characters.push('Evie');
    } else if (/melbt|mel/i.test(name)) {
      if (isValidChar('Melissa') && !characters.includes('Melissa')) characters.push('Melissa');
    }
  }

  // Check [Char1]Mc[Char2] pattern e.g. "AdMcArPf", "ErMcDi", "HeMcBa"
  const mcMatch = /^([A-Za-z]{2})Mc([A-Za-z]{2})/i.exec(name);
  if (mcMatch) {
    const c1Code = mcMatch[1].toLowerCase();
    const c2Code = mcMatch[2].toLowerCase();
    const c1 = overrides[c1Code] || gameAliases[c1Code] || CHARACTER_ALIASES[c1Code];
    const c2 = overrides[c2Code] || gameAliases[c2Code] || CHARACTER_ALIASES[c2Code];
    if (c1 && isValidChar(c1) && !characters.includes(c1)) characters.push(c1);
    if (c2 && isValidChar(c2) && !characters.includes(c2)) characters.push(c2);
  }

  // Check multi-character pair e.g. "AlEmTS", "SoHeCs", "AgLeHdLb"
  const pairMatch = /^([A-Z][a-z])([A-Z][a-z])(?:[A-Z]{2}|\d)/.exec(name);
  if (pairMatch && !name.startsWith('BC-') && !name.startsWith('PS-') && !name.startsWith('Fig-') && !isNonCharStem) {
    const c1Code = pairMatch[1].toLowerCase();
    const c2Code = pairMatch[2].toLowerCase();
    const c1 = overrides[c1Code] || gameAliases[c1Code];
    if (c1 && isValidChar(c1)) {
      if (!characters.includes(c1)) characters.push(c1);
      // Only treat c2 as a second character if it's NOT an act abbreviation AND is a valid character for this game
      if (!ACT_ABBREVS.has(c2Code)) {
        const c2 = overrides[c2Code] || gameAliases[c2Code];
        if (c2 && isValidChar(c2) && !characters.includes(c2)) {
          characters.push(c2);
        }
      }
    }
  }

  // Check Meet[Character] stems e.g. "MeetEmily", "MeetSofia"
  let meetMatch = null;
  if (!characters.length && !isNonCharStem) {
    meetMatch = /^meet([A-Za-z]+)/i.exec(name);
    if (meetMatch) {
      const target = meetMatch[1].replace(/\d+.*$/, '');
      const canonicalChars = CHARACTERS_BY_GAME[game] || [];
      const matchedChar = canonicalChars.find((c) => c.toLowerCase() === target.toLowerCase());
      if (matchedChar && isValidChar(matchedChar) && !characters.includes(matchedChar)) {
        characters.push(matchedChar);
      }
    }
  }

  if (!characters.length && facts?.characters?.length && !isNonCharStem) {
    for (const c of facts.characters) {
      const cleanC = String(c).trim();
      if (cleanC && !PLACEHOLDERS.has(cleanC.toLowerCase()) && isValidChar(cleanC) && !characters.includes(cleanC)) {
        characters.push(cleanC);
      }
    }
  }

  if (!characters.length && !isNonCharStem) {
    const spelledNames = [
      'Autumn', 'Divya', 'Kelli', 'Lucy', 'Madison', 'Nora', 'Julia', 'Grace',
      'Amira', 'Leila', 'Anya', 'Olivia', 'Nia', 'Agrat', 'Margaret', 'Cleopatra',
      'Medusa', 'Empusa', 'Lola', 'Athena', 'Hannah', 'Erica', 'Chloe', 'Ella',
      'Carol', 'Nellie', 'Lillian', 'Melissa', 'Heather', 'Judy', 'Kimberly',
      'Andrea', 'Arianna', 'Alia', 'Diana', 'Emily', 'Jessica', 'Clare', 'Janet',
      'Naomi', 'Pricia', 'Tasha', 'Kaley', 'Madalyn', 'Sofia', 'Evie', 'Amber', 'Valerie',
    ];
    for (const sn of spelledNames) {
      if (!isValidChar(sn)) continue;
      if (lowerName.startsWith(sn.toLowerCase()) || lowerName.includes(`-${sn.toLowerCase()}`)) {
        characters.push(sn);
        break;
      }
    }
  }

  if (!characters.length && !isNonCharStem) {
    const tokens = name.split(/[-_]+|(?=[A-Z])/).map(t => t.toLowerCase()).filter(Boolean);
    for (const t of tokens) {
      if (overrides[t] && isValidChar(overrides[t])) {
        characters.push(overrides[t]);
        break;
      }
    }
  }

  if (!characters.length && !isNonCharStem) {
    let lead = '';
    const bcMatch = /^BC-([A-Za-z]+)/i.exec(name);
    const figMatch = /^Fig-([A-Za-z]+)/i.exec(name);
    const psMatch = /^PS-([A-Za-z]+)/i.exec(name);
    if (bcMatch) lead = bcMatch[1];
    else if (figMatch) lead = figMatch[1];
    else if (psMatch) lead = psMatch[1];
    else lead = name;

    const lowerLead = lead.toLowerCase();
    for (const [alias, charName] of Object.entries(gameAliases)) {
      if (!isValidChar(charName)) continue;
      if (lowerLead === alias || new RegExp(`^${alias}(?:[A-Z0-9_-]|$)`).test(lead)) {
        if (!characters.includes(charName)) {
          characters.push(charName);
          break;
        }
      }
    }
  }

  if (!characters.length && entry.character && !PLACEHOLDERS.has(entry.character.toLowerCase()) && !isNonCharStem) {
    const split = entry.character.split(/,\s*/);
    for (const s of split) {
      const trimmed = s.trim();
      if (trimmed && !PLACEHOLDERS.has(trimmed.toLowerCase()) && isValidChar(trimmed) && !characters.includes(trimmed)) {
        characters.push(trimmed);
      }
    }
  }

  let scene = '';
  let act = '';
  let gameScene = '';

  if (category === 'Figurine / Showcase' || /^fig/i.test(name)) {
    category = 'Figurine / Showcase';
    if (lowerName.includes('nude')) {
      scene = 'Showcase Nude';
    } else if (lowerName.includes('outfit')) {
      scene = 'Showcase Outfit';
    } else {
      scene = 'Showcase';
    }
    act = scene;
  }

  if (lowerName === 'logo' || lowerName.startsWith('logo.') || lowerName === 'nltlogo') {
    scene = 'Logo';
    act = 'Logo';
    gameScene = 'Logo';
  } else if (lowerName === 'amuleth') {
    scene = 'Amulet';
    act = 'Amulet';
    gameScene = 'Amulet';
  } else if (lowerName === 'canoe') {
    scene = 'Canoe';
    act = 'Canoe';
    gameScene = 'Canoe';
  } else if (lowerName === 'lunchparty') {
    scene = 'Lunch Party';
    act = 'Lunch Party';
    gameScene = 'Lunch Party';
  } else if (lowerName.startsWith('hetroom')) {
    scene = 'Treasure Room';
    act = 'Treasure Room';
    gameScene = 'Treasure Room';
  } else if (lowerName.startsWith('herocu')) {
    scene = 'Hero Close-up';
    act = 'Hero Close-up';
    gameScene = 'Hero Close-up';
  } else if (lowerName.startsWith('herojoeykick')) {
    scene = 'Hero Joey Kick';
    act = 'Hero Joey Kick';
    gameScene = 'Hero Joey Kick';
  } else if (lowerName.startsWith('agvl')) {
    scene = "Sam's Sacrifice";
    act = "Sam's Sacrifice";
    gameScene = "Sam's Sacrifice";
  } else if (lowerName.startsWith('lolastrip')) {
    scene = 'Striptease';
    act = 'Striptease';
    gameScene = 'Striptease';
  } else if (lowerName.startsWith('nomcint')) {
    scene = 'Nellie Interrogation';
    act = 'Interrogation';
    gameScene = 'Nellie Interrogation';
    if (!characters.includes('Nellie')) characters.push('Nellie');
  } else if (lowerName.startsWith('toma-')) {
    if (lowerName === 'toma-rightarmb') scene = 'Toma Stone Arm (Leolo)';
    else if (lowerName === 'toma-rightarmc') scene = 'Toma Stone Arm (Erica)';
    else if (lowerName === 'toma-rightlegb') scene = 'Toma Stone Leg (Lillian)';
    else if (lowerName.includes('arm')) scene = 'Toma Stone Arm';
    else if (lowerName.includes('head')) scene = 'Toma Stone Head';
    else if (lowerName.includes('leg')) scene = 'Toma Stone Leg';
    else scene = 'Toma Stone Artifact';
    act = 'Stone Idol';
    gameScene = scene;
  } else if (meetMatch) {
    const target = meetMatch[1].replace(/\d+.*$/, '');
    scene = `Meet ${target}`;
    gameScene = scene;
  }

  if (/^ps-/i.test(name)) {
    const psKey = name.replace(/^ps-/i, '').replace(/\d+.*$/i, '').toLowerCase();
    const psDef = PS_SCENES[psKey];
    if (psDef) {
      scene = psDef.scene;
      act = psDef.act;
      gameScene = psDef.scene;
    }
  }

  if (/blnd4sm/i.test(name)) {
    scene = 'Blonde Foursome';
    act = 'Foursome';
    gameScene = 'Blonde Foursome';
  }

  if (/bigorgy/i.test(name)) {
    scene = 'Grand Orgy';
    act = 'Orgy';
    gameScene = 'Grand Orgy';
  }

  if (/^ju[-_]?ap/i.test(name)) {
    scene = 'Anal Play';
    act = 'Anal Play';
    gameScene = 'Anal Play';
  }

  // Check facts.titles (skipping bogus choice titles like 'Normal', 'Angle 1')
  if (!scene) {
    if (facts?.titles?.length) {
      for (const tit of facts.titles) {
        if (tit && !isBogusSceneTitle(tit)) {
          scene = cleanSceneName(tit);
          gameScene = scene;
          break;
        }
      }
    }
    if (!scene && facts?.scene && !isBogusSceneTitle(facts.scene) && !PLACEHOLDERS.has(facts.scene.toLowerCase())) {
      scene = cleanSceneName(facts.scene);
      gameScene = scene;
    }
  }

  if (!act) {
    if (/3s/i.test(name) || threeSomeMatch) {
      act = 'Threesome';
    } else if (/7sm/i.test(name)) {
      act = 'Orgy';
    }
  }

  // Check 3rd group of BC-XX-YY
  if (!act) {
    const actCodeMatch = /^BC-[A-Za-z]+-([A-Za-z]+?)\d*(?:O\d*)?$/i.exec(name);
    if (actCodeMatch) {
      const code = actCodeMatch[1].toLowerCase();
      act = ACT_DICTIONARY[code] || terms?.[game]?.acts?.[actCodeMatch[1]] || '';
    }
  }

  if (!act) {
    const rem = name.replace(/^(?:Autumn|Divya|Kelli|Lucy|Madison|Nora|Grace|Julia|Amira|Leila|Anya|Olivia|Nia|Cleopatra|Cleo|Empusa|Medusa|Lola|Athena|Hannah|Erica|Chloe|Ella|Carol|Nellie|Lillian|Melissa|Heather|Judy|Kimberly|Andrea|Arianna|Alia|Diana|Emily|Jessica|Clare|Janet|Naomi|Pricia|Tasha|Kaley|Madalyn|Sofia|Evie|Amber|Valerie|Au|Ke|No|Lu|Di|Ma|Gr|Ju|Am|Le|Ay|Ol|Ni|Cp|Al|Cl|Cr|Em|Ev|Ja|Je|Ka|Md|Ml|Na|Pr|So|Ta|Ad|Ar|Ca|Ba|Ch|Deb|El|Er|Ha|Hn|He|Ki|Li|Me|Ne)[-_]?/i, '');
    const token = rem.split(/[-_0-9]+/)[0]?.toLowerCase() || rem.toLowerCase().replace(/[-_].*$/, '').replace(/\d+.*$/, '');
    const numToken = rem.match(/^\d+/)?.[0];
    if (numToken && ACT_DICTIONARY[numToken]) {
      act = ACT_DICTIONARY[numToken];
    } else if (token && ACT_DICTIONARY[token]) {
      act = ACT_DICTIONARY[token];
    }
  }

  if (!act) {
    const cleanStem = name.replace(/^BC-|^PS-|^Fig-|^MZ-|^MoanZone-?/, '');
    const tokens = cleanStem.split(/[-_]+|(?=[A-Z])/).map(t => t.toLowerCase().replace(/\d+$/, '')).filter(Boolean);
    for (const t of tokens) {
      if (ACT_DICTIONARY[t]) {
        act = ACT_DICTIONARY[t];
        break;
      }
    }
  }

  if (!scene || PLACEHOLDERS.has(scene.toLowerCase()) || isBogusSceneTitle(scene) || scene.length <= 2) {
    if (act) {
      scene = act;
    } else {
      const lowerRawScene = (entry.scene || '').toLowerCase();
      if (ACT_DICTIONARY[lowerRawScene]) {
        scene = ACT_DICTIONARY[lowerRawScene];
      } else if (category === 'Figurine / Showcase') {
        scene = lowerName.includes('nude') ? 'Showcase Nude' : lowerName.includes('outfit') ? 'Showcase Outfit' : 'Showcase';
      } else {
        scene = formatCamelWords(name.replace(/^BC-|^PS-|^Fig-/, '').replace(/\d+.*$/, '')) || 'Story Scene';
      }
    }
  }

  let title = '';
  if (scene === 'Logo') {
    title = 'Studio Logo';
  } else if (scene === "Sam's Sacrifice") {
    title = "Sam's Sacrifice";
  } else if (category === 'Figurine / Showcase') {
    title = `${characters[0] || 'Character'} · ${scene}`;
  } else if (scene === 'Blonde Foursome') {
    title = 'Jessica, Kaley & Emily · Blonde Foursome';
  } else if (scene === 'Grand Orgy') {
    title = 'Grand Orgy';
  } else if (act === 'Threesome' && characters.length >= 2) {
    title = `${characters[0]} & ${characters[1]} · Threesome`;
  } else if (gameScene && !isBogusSceneTitle(gameScene) && gameScene.length > 2 && !/^\d+$/.test(gameScene)) {
    title = gameScene;
  } else if (characters.length && (act || scene)) {
    const actName = act || scene;
    if (scene.toLowerCase().includes(characters[0].toLowerCase())) {
      title = scene;
    } else {
      title = `${characters[0]} · ${actName}`;
    }
  } else if (characters.length) {
    title = characters.join(' & ');
  } else if (scene && scene !== 'Story Scene') {
    title = scene;
  } else {
    title = formatCamelWords(name) || 'Untitled';
  }

  const filteredChars = characters.filter((c) => isValidChar(c));
  const characterDisplay = filteredChars.length ? filteredChars.join(', ') : 'Various';

  const nsfw = isNSFWEntry({
    name,
    title,
    scene,
    act,
    category,
    prefix: rawPrefix,
    characters: filteredChars,
    game,
  }, game);

  const tags = [];
  if (category) tags.push(`series:${category}`);
  for (const c of filteredChars) tags.push(`character:${c}`);
  if (scene) tags.push(`scene:${scene}`);
  if (act && act !== scene) tags.push(`act:${act}`);
  tags.push(nsfw ? 'rating:nsfw' : 'rating:sfw');

  return {
    characters: filteredChars,
    character: characterDisplay,
    scene,
    act: act || scene,
    category,
    gameScene: gameScene || scene,
    title,
    tags,
    nsfw,
  };
}
