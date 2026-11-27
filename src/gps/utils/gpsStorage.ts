import { ActiveGpsRound, HoleScoreEntry, SavedGpsRound, TeeName } from '../types';
import { createEmptyHoleEntry, createEmptyRound } from './scorecard';

const ACTIVE_ROUND_KEY = 'tsf_norbeck_gps_active_round_v1';
const ROUND_HISTORY_KEY = 'tsf_norbeck_gps_round_history_v1';
const HANDICAP_INDEX_KEY = 'tsf_norbeck_gps_hcp_index_v1';

const VALID_TEES: TeeName[] = ['black', 'blue', 'white', 'gold', 'forward'];

function normalizeHoles(
  rawHoles: Record<string, Partial<HoleScoreEntry>> | undefined
): Record<number, HoleScoreEntry> {
  const holes: Record<number, HoleScoreEntry> = {};
  for (let h = 1; h <= 18; h++) {
    const empty = createEmptyHoleEntry(h);
    const saved = rawHoles?.[String(h)] || rawHoles?.[h as unknown as string];
    if (saved) {
      holes[h] = {
        holeNumber: h,
        gross: typeof saved.gross === 'number' ? saved.gross : null,
        putts: typeof saved.putts === 'number' ? saved.putts : null,
        fairway:
          saved.fairway === 'left' ||
          saved.fairway === 'hit' ||
          saved.fairway === 'right'
            ? saved.fairway
            : null,
        gir: typeof saved.gir === 'boolean' ? saved.gir : null,
        girManual: Boolean(saved.girManual),
        sand: Boolean(saved.sand),
        penalties: typeof saved.penalties === 'number' ? saved.penalties : 0,
      };
    } else {
      holes[h] = empty;
    }
  }
  return holes;
}

export function loadActiveRound(defaultTee: TeeName): ActiveGpsRound {
  try {
    const raw = localStorage.getItem(ACTIVE_ROUND_KEY);
    if (!raw) return createEmptyRound('norbeck-cc', defaultTee);
    const parsed = JSON.parse(raw) as Partial<ActiveGpsRound>;
    const tee =
      parsed.tee && VALID_TEES.includes(parsed.tee) ? parsed.tee : defaultTee;
    return {
      id:
        typeof parsed.id === 'string' && parsed.id
          ? parsed.id
          : createEmptyRound('norbeck-cc', tee).id,
      courseId: parsed.courseId || 'norbeck-cc',
      startedAt: parsed.startedAt || new Date().toISOString(),
      tee,
      holes: normalizeHoles(
        parsed.holes as unknown as Record<string, Partial<HoleScoreEntry>>
      ),
    };
  } catch {
    return createEmptyRound('norbeck-cc', defaultTee);
  }
}

export function saveActiveRound(round: ActiveGpsRound): void {
  try {
    localStorage.setItem(ACTIVE_ROUND_KEY, JSON.stringify(round));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadRoundHistory(): SavedGpsRound[] {
  try {
    const raw = localStorage.getItem(ROUND_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as SavedGpsRound[];
  } catch {
    return [];
  }
}

export function saveRoundToHistory(round: SavedGpsRound): SavedGpsRound[] {
  const existing = loadRoundHistory();
  const idx = existing.findIndex((r) => r.id === round.id);
  const next =
    idx >= 0
      ? existing.map((r, i) => (i === idx ? round : r))
      : [round, ...existing];
  try {
    localStorage.setItem(ROUND_HISTORY_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors
  }
  return next;
}

export function deleteRoundFromHistory(id: string): SavedGpsRound[] {
  const next = loadRoundHistory().filter((r) => r.id !== id);
  try {
    localStorage.setItem(ROUND_HISTORY_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors
  }
  return next;
}

export function loadHandicapIndex(): number | null {
  try {
    const raw = localStorage.getItem(HANDICAP_INDEX_KEY);
    if (!raw) return null;
    const val = Number(raw);
    if (Number.isNaN(val) || val < -10 || val > 54) return null;
    return Math.round(val * 10) / 10;
  } catch {
    return null;
  }
}

export function saveHandicapIndex(idx: number | null): void {
  try {
    if (idx === null || Number.isNaN(idx)) {
      localStorage.removeItem(HANDICAP_INDEX_KEY);
    } else {
      localStorage.setItem(HANDICAP_INDEX_KEY, String(Math.round(idx * 10) / 10));
    }
  } catch {
    // Ignore storage errors
  }
}
