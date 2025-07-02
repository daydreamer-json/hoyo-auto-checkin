const gameEntryArray = ['hk4e', 'hkrpg', 'bh3', 'nap'] as const;
type GameEntry = (typeof gameEntryArray)[number];

export type { GameEntry };
export { gameEntryArray };
