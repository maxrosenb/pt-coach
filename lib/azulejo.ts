// "Azulejo Heritage" design tokens — deep cobalt + warm cream + gold,
// inspired by Portuguese tilework. Each token is a Chakra conditional
// value pair (light / dark "evening azulejo").

export const az = {
  pageBg: { base: '#F6F0E1', _dark: '#0D1830' },
  cardBg: { base: '#FFFDF6', _dark: '#152442' },
  cardLine: { base: '#E5DBC2', _dark: '#2B3B5F' },
  washBg: { base: '#F1E9D3', _dark: '#1A2A4C' },

  ink: { base: '#1E3157', _dark: '#EFE7D2' },
  inkSoft: { base: '#5A6A8E', _dark: '#A9B5CE' },
  inkFaint: { base: '#929DB5', _dark: '#76829E' },

  cobalt: { base: '#1D4E9B', _dark: '#92B5E9' },
  cobaltWash: { base: '#EAF1FA', _dark: '#1B2D52' },
  cobaltLine: { base: '#C6D6EE', _dark: '#35508B' },

  gold: { base: '#A87C1C', _dark: '#D9B45F' },
  goldWash: { base: '#F8EFD9', _dark: '#2E2713' },
  goldLine: { base: '#E2CD96', _dark: '#5C4D22' },

  sage: { base: '#54744A', _dark: '#A9C58F' },
  sageWash: { base: '#EEF3E6', _dark: '#1B2A1C' },
  sageLine: { base: '#C9D8B6', _dark: '#3A5237' },

  ochre: { base: '#A1731A', _dark: '#D9B45F' },
  ochreWash: { base: '#F7EED4', _dark: '#2E2713' },
  ochreLine: { base: '#E3CF97', _dark: '#5C4D22' },

  terra: { base: '#A8472A', _dark: '#E09A78' },
  terraWash: { base: '#F8E9E0', _dark: '#33201B' },
  terraLine: { base: '#E4BBA5', _dark: '#5E3526' },
} as const;

// Solid values for filled controls (same in both modes)
export const SOLID = {
  gold: '#CD9A2B',
  goldHover: '#B98A24',
  inkOnGold: '#2A2009',
  terra: '#B14E2C',
  terraHover: '#9A4226',
  cobalt: '#1D4E9B',
  cobaltHover: '#163C79',
} as const;

export const SERIF = 'var(--font-fraunces), Georgia, "Times New Roman", serif';
export const SANS = 'var(--font-karla), -apple-system, "Segoe UI", sans-serif';

// Repeating azulejo tile motif (diamond-in-diamond with corner arcs)
const tileSvg = (stroke: string) => {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='56' height='56' viewBox='0 0 56 56'><g fill='none' stroke='${stroke}' stroke-width='1.2'><path d='M28 4 L52 28 L28 52 L4 28 Z'/><path d='M28 15 L41 28 L28 41 L15 28 Z'/><circle cx='28' cy='28' r='2.5'/><path d='M0 14 A14 14 0 0 0 14 0'/><path d='M42 0 A14 14 0 0 0 56 14'/><path d='M56 42 A14 14 0 0 0 42 56'/><path d='M14 56 A14 14 0 0 0 0 42'/></g></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
};

export const TILE_BG = { base: tileSvg('#1D4E9B'), _dark: tileSvg('#92B5E9') } as const;
