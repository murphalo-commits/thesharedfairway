export interface HoleConfig {
  hole: number;
  par: 3 | 4 | 5;
  handicap: number;
}

export interface CoursePreset {
  id: string;
  name: string;
  location: string;
  holes: HoleConfig[];
  isCustom?: boolean;
}

export interface HolePlayerState {
  score: number | null;
  greenie: boolean; // Relevant on Par 3 and Par 5
  sandie?: boolean; // Available on any hole ($1 trash paid to individual by opposing team)
  manualBirdieOverride?: boolean; // Optional override if needed
}

export interface HoleState {
  holeNumber: number;
  par: 3 | 4 | 5;
  handicap: number;
  baseBet: number; // Default $2, editable / doublable per hole
  wolfPlayerIndex: number | null; // 0..4, who is the Wolf on this hole
  partnerPlayerIndex: number | null; // 0..4 (must not equal wolfPlayerIndex), or null if Lone Wolf
  isLoneWolf: boolean; // Explicit toggle or auto-derived when wolf is set & no partner
  players: HolePlayerState[]; // length 5
}

export interface HoleCalculationResult {
  holeNumber: number;
  playOrderNumber: number; // 1..18 in chronological play order (accounts for Shotgun Start)
  carryInDollars: number; // Added from consecutive prior ties ($1 per tied hole)
  effectiveHoleValue: number; // BaseBet + CarryIn + WinningTeamBirdieBonus
  birdieBonusDollars: number;
  greenieBonusDollars: number; // Total trash pot paid for greenies on this hole
  sandieBonusDollars: number; // Total trash pot paid for sandies on this hole
  status: 'incomplete' | 'wolf_win' | 'non_wolf_win' | 'push';
  wolfTeamBestScore: number | null;
  nonWolfTeamBestScore: number | null;
  playerNetDollars: number[]; // length 5, always sums to 0 (main hole bet + individual trash)
  playerTrashNetDollars: number[]; // length 5, net trash (greenies + sandies) on this hole
  playerRunningTotals: number[]; // length 5 cumulative through this hole in play order
  totalPot: number; // Main hole pot + any trash pot on this hole
  isBalanced: boolean; // Ledger verification: sum(playerNetDollars) === 0
  birdiePlayerIndices: number[]; // Players who scored <= Par - 1
  eaglePlayerIndices: number[]; // Players who scored <= Par - 2
  greeniePlayerIndices: number[]; // Players with greenie checked on Par 3/5
  sandiePlayerIndices: number[]; // Players with sandie checked
  effectiveWolfIndex: number | null; // Resolved Wolf index (auto-assigned on closing holes if not manually overridden)
  isAutoAssignedWolf: boolean; // True if Wolf was auto-determined from lowest running total
  isAutoWolfHole: boolean; // True if this hole is in the closing Low-Money Auto-Wolf window (playOrder >= 16 in 5P, >= 17 in 4P)
  tiedForLowMoneyIndices: number[]; // Players tied for lowest running money entering this hole
}

export interface SavedRound {
  id: string;
  dateISO: string;
  courseId: string;
  courseName: string;
  playerCount?: 4 | 5;
  startingHole?: number;
  playerNames: string[]; // length 5 (or 4 active)
  holes: HoleState[];
  finalTotals: number[]; // length 5 net dollars
  finalGrossScores: (number | null)[]; // length 5 total strokes
  holesCompleted: number;
  notes?: string;
}

export interface SettlementTransfer {
  fromPlayer: string;
  toPlayer: string;
  amount: number;
}
