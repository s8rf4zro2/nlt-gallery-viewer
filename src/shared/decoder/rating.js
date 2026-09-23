/**
 * Content Rating Classifier
 *
 * Strict classification: In adult visual archives, all cutscenes default to NSFW (true)
 * unless they are verified non-erotic SFW content (false):
 * 1. Clothed Figurine showcase (Fig-* turnarounds and outfits; 'nude' is NSFW).
 * 2. System and title media: Logo, Opening, Title, Intro, Ending, PlayerName, etc.
 * 3. Verified non-erotic story events: Canoe, Funeral, BookThrow, LunchParty, Amulet, SeeShip, Bully, Tennis, Shootout.
 */

const SFW_SYSTEM_STEMS =
  /^(?:logo|nltlogo|pkd_logo|title|opening|intro|ending\d*|playername|hospitalintro|fnl\d*b?|placeholder)\b/i;

const SFW_STORY_STEMS =
  /^(?:canoe|funeral|bookthrow|lunchparty|amuleth?|soulcrystal|seeship|bully|tennis|shootout)\b/i;

export function isNSFWEntry(entryOrScene) {
  if (!entryOrScene) return true;

  const rawName = String(entryOrScene.name || entryOrScene.sceneId || '').trim();
  const name = rawName.toLowerCase();
  const title = String(entryOrScene.title || '').toLowerCase();
  const cat = String(entryOrScene.category || '').toLowerCase();
  const prefix = String(entryOrScene.prefix || '').toLowerCase();

  // 1. Figurine showcase: base turnarounds and outfits are SFW; nude is NSFW
  if (cat === 'figurine / showcase' || prefix === 'fig' || name.startsWith('fig-')) {
    return name.includes('nude') || title.includes('nude');
  }

  // 2. Verified system cutscenes (Logos, Title screens, Intros, Endings)
  if (SFW_SYSTEM_STEMS.test(name) || SFW_SYSTEM_STEMS.test(title)) {
    return false;
  }

  // 3. Verified non-erotic story events
  if (SFW_STORY_STEMS.test(name) || SFW_STORY_STEMS.test(title)) {
    return false;
  }

  // Everything else in NLT adult archives defaults to NSFW
  return true;
}
