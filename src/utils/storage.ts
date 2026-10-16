import { CoursePreset, HoleState, SavedRound } from '../types';
import { PRESET_COURSES } from '../data/courses';
import { calculateRoundResults } from './wolfEngine';

const DB_NAME = 'SharedFairwayWolfDB';
const DB_VERSION = 1;
const ROUNDS_STORE = 'rounds';
const COURSES_STORE = 'custom_courses';

const ACTIVE_ROUND_STORAGE_KEY = 'shared_wolf_active_round_v2';
const FALLBACK_ROUNDS_KEY = 'shared_wolf_saved_rounds_v2';
const FALLBACK_COURSES_KEY = 'shared_wolf_custom_courses_v2';

export interface ActiveRoundState {
  courseId: string;
  playerNames: string[]; // 5 names, defaults to ['', '', '', '', '']
  defaultBaseBet: number;
  holes: HoleState[];
  activeHoleNumber: number;
  startedAtISO: string;
}

export function createInitialHolesForCourse(
  course: CoursePreset,
  defaultBaseBet = 2
): HoleState[] {
  return course.holes.map((h, idx) => ({
    holeNumber: h.hole,
    par: h.par,
    handicap: h.handicap,
    baseBet: defaultBaseBet,
    // Default Wolf rotation 1->5 for holes 1->15, and leave 16-18 open (often lowest money or continued rotation)
    wolfPlayerIndex: idx < 15 ? idx % 5 : null,
    partnerPlayerIndex: null,
    isLoneWolf: false,
    players: Array.from({ length: 5 }, () => ({
      score: null,
      greenie: false,
    })),
  }));
}

export function loadActiveRound(): ActiveRoundState {
  try {
    const raw = localStorage.getItem(ACTIVE_ROUND_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ActiveRoundState;
      if (parsed && Array.isArray(parsed.holes) && parsed.holes.length === 18) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Could not load active round from localStorage', e);
  }

  const defaultCourse = PRESET_COURSES[0]; // Norbeck Country Club
  return {
    courseId: defaultCourse.id,
    playerNames: ['', '', '', '', ''],
    defaultBaseBet: 2,
    holes: createInitialHolesForCourse(defaultCourse, 2),
    activeHoleNumber: 1,
    startedAtISO: new Date().toISOString(),
  };
}

export function saveActiveRound(state: ActiveRoundState): void {
  try {
    localStorage.setItem(ACTIVE_ROUND_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Could not save active round to localStorage', e);
  }
}

// IndexedDB wrapper with automatic LocalStorage sync/fallback
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(ROUNDS_STORE)) {
        db.createObjectStore(ROUNDS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(COURSES_STORE)) {
        db.createObjectStore(COURSES_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllSavedRounds(): Promise<SavedRound[]> {
  try {
    const db = await openDatabase();
    const rounds = await new Promise<SavedRound[]>((resolve, reject) => {
      const tx = db.transaction(ROUNDS_STORE, 'readonly');
      const store = tx.objectStore(ROUNDS_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    if (rounds.length > 0) {
      return rounds.sort(
        (a, b) => new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime()
      );
    }
  } catch {
    // Fallback to localStorage
  }

  try {
    const raw = localStorage.getItem(FALLBACK_ROUNDS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SavedRound[];
      return parsed.sort(
        (a, b) => new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime()
      );
    }
  } catch {
    // ignore
  }
  return [];
}

export async function saveCompletedRound(round: SavedRound): Promise<void> {
  // Always update fallback localStorage as well so exports/backups are seamless
  const existing = await getAllSavedRounds();
  const updated = [round, ...existing.filter((r) => r.id !== round.id)];
  try {
    localStorage.setItem(FALLBACK_ROUNDS_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(ROUNDS_STORE, 'readwrite');
      const store = tx.objectStore(ROUNDS_STORE);
      store.put(round);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Fallback already saved
  }
}

export async function deleteSavedRound(roundId: string): Promise<void> {
  const existing = await getAllSavedRounds();
  const updated = existing.filter((r) => r.id !== roundId);
  try {
    localStorage.setItem(FALLBACK_ROUNDS_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(ROUNDS_STORE, 'readwrite');
      const store = tx.objectStore(ROUNDS_STORE);
      store.delete(roundId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Fallback already updated
  }
}

export async function getCustomCourses(): Promise<CoursePreset[]> {
  try {
    const raw = localStorage.getItem(FALLBACK_COURSES_KEY);
    if (raw) {
      return JSON.parse(raw) as CoursePreset[];
    }
  } catch {
    // ignore
  }
  return [];
}

export async function saveCustomCourse(course: CoursePreset): Promise<void> {
  const existing = await getCustomCourses();
  const updated = [...existing.filter((c) => c.id !== course.id), { ...course, isCustom: true }];
  try {
    localStorage.setItem(FALLBACK_COURSES_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

export interface PlayerSeasonStats {
  name: string;
  roundsPlayed: number;
  holesPlayed: number;
  totalNetDollars: number;
  bestRoundDollars: number;
  worstRoundDollars: number;
  timesAsWolf: number;
  wolfWins: number;
  timesAsLoneWolf: number;
  loneWolfWins: number;
  birdies: number;
  greenies: number;
}

export interface HeadToHeadRecord {
  playerA: string;
  playerB: string;
  togetherHoles: number;
  togetherWins: number;
  togetherNetForA: number;
  againstHoles: number;
  aBeatB: number;
  bBeatA: number;
  tiesAgainst: number;
}

export function computeSeasonAnalytics(rounds: SavedRound[]): {
  playerStats: PlayerSeasonStats[];
  headToHead: HeadToHeadRecord[];
} {
  const statsMap = new Map<string, PlayerSeasonStats>();
  const h2hMap = new Map<string, HeadToHeadRecord>();

  const normalizeName = (rawName: string, idx: number) =>
    rawName.trim() || `Player ${idx + 1}`;

  const getOrCreatePlayer = (name: string): PlayerSeasonStats => {
    const key = name.toLowerCase();
    const existing = statsMap.get(key);
    if (existing) return existing;
    const created: PlayerSeasonStats = {
      name,
      roundsPlayed: 0,
      holesPlayed: 0,
      totalNetDollars: 0,
      bestRoundDollars: -Infinity,
      worstRoundDollars: Infinity,
      timesAsWolf: 0,
      wolfWins: 0,
      timesAsLoneWolf: 0,
      loneWolfWins: 0,
      birdies: 0,
      greenies: 0,
    };
    statsMap.set(key, created);
    return created;
  };

  for (const round of rounds) {
    const names = round.playerNames.map((n, i) => normalizeName(n, i));
    const holeResults = calculateRoundResults(round.holes);

    names.forEach((name, idx) => {
      const pStat = getOrCreatePlayer(name);
      pStat.roundsPlayed += 1;
      const roundNet = round.finalTotals[idx] ?? 0;
      pStat.totalNetDollars += roundNet;
      if (roundNet > pStat.bestRoundDollars) pStat.bestRoundDollars = roundNet;
      if (roundNet < pStat.worstRoundDollars) pStat.worstRoundDollars = roundNet;
    });

    round.holes.forEach((hole, hIdx) => {
      const res = holeResults[hIdx];
      if (!res || res.status === 'incomplete') return;

      const wolfIdx = res.effectiveWolfIndex;
      if (wolfIdx === null) return;
      const partnerIdx =
        hole.isLoneWolf || hole.partnerPlayerIndex === wolfIdx
          ? null
          : hole.partnerPlayerIndex;

      const wolfTeam = partnerIdx !== null ? [wolfIdx, partnerIdx] : [wolfIdx];

      for (let p = 0; p < 5; p++) {
        const pStat = getOrCreatePlayer(names[p]);
        if (hole.players[p]?.score !== null) {
          pStat.holesPlayed += 1;
        }
        if (res.birdiePlayerIndices.includes(p)) {
          pStat.birdies += 1;
        }
        if (res.greeniePlayerIndices.includes(p)) {
          pStat.greenies += 1;
        }
      }

      const wolfStat = getOrCreatePlayer(names[wolfIdx]);
      wolfStat.timesAsWolf += 1;
      if (res.status === 'wolf_win') {
        wolfStat.wolfWins += 1;
      }
      if (partnerIdx === null) {
        wolfStat.timesAsLoneWolf += 1;
        if (res.status === 'wolf_win') {
          wolfStat.loneWolfWins += 1;
        }
      }

      // Pairwise Head-to-Head across the 5 players
      for (let i = 0; i < 5; i++) {
        for (let j = i + 1; j < 5; j++) {
          const nameI = names[i];
          const nameJ = names[j];
          const [first, second, iIsFirst] =
            nameI.toLowerCase() < nameJ.toLowerCase()
              ? [nameI, nameJ, true]
              : [nameJ, nameI, false];

          const pairKey = `${first.toLowerCase()}__${second.toLowerCase()}`;
          let rec = h2hMap.get(pairKey);
          if (!rec) {
            rec = {
              playerA: first,
              playerB: second,
              togetherHoles: 0,
              togetherWins: 0,
              togetherNetForA: 0,
              againstHoles: 0,
              aBeatB: 0,
              bBeatA: 0,
              tiesAgainst: 0,
            };
            h2hMap.set(pairKey, rec);
          }

          const iOnWolf = wolfTeam.includes(i);
          const jOnWolf = wolfTeam.includes(j);

          if (iOnWolf && jOnWolf) {
            // Partners on the Wolf team (2v3)
            rec.togetherHoles += 1;
            if (res.status === 'wolf_win') rec.togetherWins += 1;
            rec.togetherNetForA += iIsFirst
              ? res.playerNetDollars[i]
              : res.playerNetDollars[j];
          } else if (iOnWolf !== jOnWolf) {
            // Opponents on this hole
            rec.againstHoles += 1;
            if (res.status === 'push') {
              rec.tiesAgainst += 1;
            } else {
              const iWon =
                (iOnWolf && res.status === 'wolf_win') ||
                (!iOnWolf && res.status === 'non_wolf_win');
              if (iWon) {
                if (iIsFirst) rec.aBeatB += 1;
                else rec.bBeatA += 1;
              } else {
                if (iIsFirst) rec.bBeatA += 1;
                else rec.aBeatB += 1;
              }
            }
          }
        }
      }
    });
  }

  const playerStats = Array.from(statsMap.values())
    .map((s) => ({
      ...s,
      bestRoundDollars: s.bestRoundDollars === -Infinity ? 0 : s.bestRoundDollars,
      worstRoundDollars: s.worstRoundDollars === Infinity ? 0 : s.worstRoundDollars,
    }))
    .sort((a, b) => b.totalNetDollars - a.totalNetDollars);

  const headToHead = Array.from(h2hMap.values()).sort(
    (a, b) => b.togetherHoles + b.againstHoles - (a.togetherHoles + a.againstHoles)
  );

  return { playerStats, headToHead };
}
