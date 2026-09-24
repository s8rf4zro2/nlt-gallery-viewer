export const CHIPS = [
  { id: 'all', match: () => true },
  { id: 'O1', match: (part) => part.variant === 'O1' || part.variant === '' },
  { id: 'O2', match: (part) => part.variant === 'O2' },
  { id: 'NP', match: (part) => part.variant === 'NP' },
  { id: 'alt', match: (part) => part.alternate === true },
];

export const chipDef = (id) => CHIPS.find((chip) => chip.id === id) ?? CHIPS[0];
