/**
 * Global gallery constants and sizing geometry.
 */

export const GAMES = [
  { id: 'nadia', label: 'Nadia', index: 'index-nadia.json' },
  { id: 'genesis', label: 'Genesis', index: 'index-genesis.json' },
  { id: 'symphony', label: 'Symphony', index: 'index-symphony.json' },
];

export const CARD_MIN_W = 232;
export const CARD_GAP = 14;
export const META_H = 56;
export const OVERSCAN_ROWS = 3;

/** Simultaneously attached `<video>` sources; the rest wait in a queue. */
export const MAX_ATTACHED = 72;

/** Autoplay preview after the pointer rests on a tile this long (ms). */
export const HOVER_DELAY = 320;
