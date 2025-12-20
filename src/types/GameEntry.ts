const gameEntryArray = ['hk4e', 'hkrpg', 'bh3', 'nap'] as const;
const redeemGameEntryArray = ['hk4e', 'nap'] as const;
type GameEntry = (typeof gameEntryArray)[number];
type RedeemGameEntry = (typeof redeemGameEntryArray)[number];

export type { GameEntry, RedeemGameEntry };
export { gameEntryArray, redeemGameEntryArray };
