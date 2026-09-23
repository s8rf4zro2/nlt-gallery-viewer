/**
 * Text formatting, title validation, and scene name cleaners.
 */

/** Bogus choice options from in-game prompts that should never be scene titles */
export function isBogusSceneTitle(title) {
  if (!title) return true;
  const t = String(title).trim().toLowerCase();
  return (
    t === 'normal' ||
    t === 'angle 1' ||
    t === 'angle 2' ||
    t === 'angle' ||
    t === 'end' ||
    t === 'cancel' ||
    t === 'back' ||
    t === 'exit' ||
    t === 'leave' ||
    t === 'yes' ||
    t === 'no' ||
    t === 'other' ||
    t.startsWith('\\') ||
    /^\d+$/.test(t) ||
    /^\\[a-z]/.test(t)
  );
}

/**
 * Split CamelCase / PascalCase and clean up text into title words.
 */
export function formatCamelWords(text) {
  if (!text) return '';
  return String(text)
    .replace(/[-_]+/g, ' ')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([0-9])([A-Za-z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Clean up a scene name from CommonEvent or game index.
 */
export function cleanSceneName(rawScene) {
  if (!rawScene) return '';
  let cleaned = String(rawScene).trim();
  cleaned = cleaned.replace(/^(?:SCN|DATE|BC|MZ|PS|SCENE|MASSAGE|DOCTOR|Doctor)\s*[-–:]\s*/i, '').trim();
  if (!cleaned.includes(' ') && /[a-z][A-Z]/.test(cleaned)) {
    cleaned = formatCamelWords(cleaned);
  }
  return cleaned;
}
