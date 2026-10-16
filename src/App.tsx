import React, { useEffect, useMemo, useState } from 'react';
import {
  Flag,
  Smartphone,
  Table2,
  Trophy,
  RotateCcw,
  PlusCircle,
  CheckCircle2,
  Scale,
  HelpCircle,
  X,
} from 'lucide-react';
import { PRESET_COURSES } from './data/courses';
import { CoursePreset, HoleConfig, HoleState, SavedRound } from './types';
import { calculateRoundResults } from './utils/wolfEngine';
import {
  ActiveRoundState,
  createInitialHolesForCourse,
  deleteSavedRound,
  getAllSavedRounds,
  getCustomCourses,
  loadActiveRound,
  saveActiveRound,
  saveCompletedRound,
  saveCustomCourse,
} from './utils/storage';
import { HoleCaddieCard } from './components/HoleCaddieCard';
import { FullLedgerTable } from './components/FullLedgerTable';
import { SeasonHistoryView } from './components/SeasonHistoryView';

type ViewMode = 'caddie' | 'ledger' | 'season';

export function App() {
  const [customCourses, setCustomCourses] = useState<CoursePreset[]>([]);
  const [roundState, setRoundState] = useState<ActiveRoundState>(() =>
    loadActiveRound()
  );
  const [viewMode, setViewMode] = useState<ViewMode>('caddie');
  const [savedRounds, setSavedRounds] = useState<SavedRound[]>([]);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showNewCourseModal, setShowNewCourseModal] = useState(false);
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseLocation, setNewCourseLocation] = useState('');

  const allCourses = useMemo(
    () => [...PRESET_COURSES, ...customCourses],
    [customCourses]
  );

  const selectedCourse = useMemo(
    () =>
      allCourses.find((c) => c.id === roundState.courseId) || PRESET_COURSES[0],
    [allCourses, roundState.courseId]
  );

  // Load saved historical rounds & custom courses from local database on mount
  useEffect(() => {
    getAllSavedRounds().then(setSavedRounds);
    getCustomCourses().then(setCustomCourses);
  }, []);

  // Automatically persist active round on every edit
  useEffect(() => {
    saveActiveRound(roundState);
  }, [roundState]);

  const results = useMemo(
    () => calculateRoundResults(roundState.holes),
    [roundState.holes]
  );

  const finalTotals =
    results.length === 18 ? results[17].playerRunningTotals : [0, 0, 0, 0, 0];

  const isEntireRoundBalanced = useMemo(
    () => results.every((r) => r.isBalanced),
    [results]
  );

  const handleCourseChange = (newCourseId: string) => {
    const course = allCourses.find((c) => c.id === newCourseId);
    if (!course) return;

    setRoundState((prev) => ({
      ...prev,
      courseId: course.id,
      holes: prev.holes.map((h, idx) => {
        const ch = course.holes[idx];
        return {
          ...h,
          par: ch ? ch.par : h.par,
          handicap: ch ? ch.handicap : h.handicap,
        };
      }),
    }));
  };

  const handlePlayerNameChange = (index: number, name: string) => {
    setRoundState((prev) => {
      const nextNames = [...prev.playerNames];
      nextNames[index] = name;
      return { ...prev, playerNames: nextNames };
    });
  };

  const handleUpdateHole = (
    holeNumber: number,
    updater: (prev: HoleState) => HoleState
  ) => {
    setRoundState((prev) => ({
      ...prev,
      holes: prev.holes.map((h) =>
        h.holeNumber === holeNumber ? updater(h) : h
      ),
    }));
  };

  const handleResetBoard = () => {
    setRoundState((prev) => ({
      ...prev,
      holes: createInitialHolesForCourse(selectedCourse, prev.defaultBaseBet),
      activeHoleNumber: 1,
      startedAtISO: new Date().toISOString(),
    }));
    setShowResetConfirm(false);
  };

  const handleSaveCurrentRoundToHistory = async (notes?: string) => {
    const completedCount = results.filter(
      (r) => r.status !== 'incomplete'
    ).length;

    const grossScores = [0, 1, 2, 3, 4].map((pIdx) => {
      const sum = roundState.holes.reduce(
        (acc, h) => acc + (h.players[pIdx].score ?? 0),
        0
      );
      return sum > 0 ? sum : null;
    });

    const newSaved: SavedRound = {
      id: `round_${Date.now()}`,
      dateISO: new Date().toISOString(),
      courseId: selectedCourse.id,
      courseName: selectedCourse.name,
      playerNames: [...roundState.playerNames],
      holes: roundState.holes,
      finalTotals: [...finalTotals],
      finalGrossScores: grossScores,
      holesCompleted: completedCount,
      notes: notes?.trim() || undefined,
    };

    await saveCompletedRound(newSaved);
    const updated = await getAllSavedRounds();
    setSavedRounds(updated);
  };

  const handleDeleteSavedRound = async (roundId: string) => {
    await deleteSavedRound(roundId);
    const updated = await getAllSavedRounds();
    setSavedRounds(updated);
  };

  const handleImportRounds = async (imported: SavedRound[]) => {
    for (const r of imported) {
      if (r && r.id && Array.isArray(r.holes)) {
        await saveCompletedRound(r);
      }
    }
    const updated = await getAllSavedRounds();
    setSavedRounds(updated);
  };

  const handleSaveCurrentParsAsCustomCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseName.trim()) return;
    const id = `custom_${Date.now()}`;
    const holesConfig: HoleConfig[] = roundState.holes.map((h) => ({
      hole: h.holeNumber,
      par: h.par,
      handicap: h.handicap,
    }));
    const custom: CoursePreset = {
      id,
      name: newCourseName.trim(),
      location: newCourseLocation.trim() || 'Custom Course',
      holes: holesConfig,
      isCustom: true,
    };
    await saveCustomCourse(custom);
    const updatedCourses = await getCustomCourses();
    setCustomCourses(updatedCourses);
    setRoundState((prev) => ({ ...prev, courseId: id }));
    setNewCourseName('');
    setNewCourseLocation('');
    setShowNewCourseModal(false);
  };

  const activeHoleIdx = Math.max(
    0,
    Math.min(17, roundState.activeHoleNumber - 1)
  );
  const activeHole = roundState.holes[activeHoleIdx];
  const activeResult = results[activeHoleIdx];

  const isEmbeddedInIframe = useMemo(() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#F5FAF6] text-slate-900">
      {/* Top Branding Header */}
      <header className="bg-[#143F27] text-white border-b-4 border-[#F4E4C1] sticky top-0 z-30 shadow-md">
        {/* The Shared Fairway Site Navigation Strip (shown when standalone, hidden when embedded inside GoDaddy page) */}
        {!isEmbeddedInIframe && (
          <div className="bg-black/30 border-b border-white/10">
            <div className="max-w-6xl mx-auto px-3 sm:px-6 py-1.5 flex items-center justify-between text-[11px]">
              <a
                href="https://thesharedfairway.com/"
                className="flex items-center gap-2 text-[#F4E4C1] hover:text-white font-semibold transition"
              >
                <img
                  src="https://img1.wsimg.com/isteam/ip/9243acca-08e8-4256-b7d5-f2ef70b2d944/TSF-7b0dc9d.jpg/:/rs=w:64,h:64,m"
                  alt="The Shared Fairway"
                  className="w-5 h-5 rounded-full object-cover border border-[#F4E4C1]/50"
                />
                <span>← Back to TheSharedFairway.com</span>
              </a>
              <nav className="hidden sm:flex items-center gap-4 text-[#E9F5EC]/80 font-medium">
                <a href="https://thesharedfairway.com/" className="hover:text-white transition">
                  Home
                </a>
                <a href="https://thesharedfairway.com/kellen" className="hover:text-white transition">
                  Kellen
                </a>
                <a href="https://thesharedfairway.com/ainsley" className="hover:text-white transition">
                  Ainsley
                </a>
                <a href="https://thesharedfairway.com/brian" className="hover:text-white transition">
                  Brian
                </a>
                <a href="https://thesharedfairway.com/about" className="hover:text-white transition">
                  About
                </a>
                <span className="text-[#F4E4C1] font-bold border-b border-[#F4E4C1]">
                  Wolf Scorecard
                </span>
              </nav>
            </div>
          </div>
        )}

        <div className="max-w-6xl mx-auto px-3 sm:px-6 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Brand Title */}
            <div className="flex items-center gap-2.5">
              <a
                href="https://thesharedfairway.com/"
                className="w-10 h-10 rounded-xl bg-[#2E8B57] border border-[#F4E4C1]/40 flex items-center justify-center shadow-inner overflow-hidden shrink-0"
                title="The Shared Fairway"
              >
                <img
                  src="https://img1.wsimg.com/isteam/ip/9243acca-08e8-4256-b7d5-f2ef70b2d944/TSF-7b0dc9d.jpg/:/rs=w:100,h:100,cg:true,m/cr=w:100,h:100/qt=q:95"
                  alt="The Shared Fairway Logo"
                  className="w-full h-full object-cover"
                />
              </a>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-serif font-bold text-lg sm:text-xl tracking-tight text-white">
                    The Shared Wolf
                  </h1>
                  <span className="hidden sm:inline-block text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full bg-[#F4E4C1] text-[#143F27] font-bold">
                    The Shared Fairway
                  </span>
                </div>
                <p className="text-[11px] text-[#E9F5EC]/80">
                  5-Player Wolf Scorecard, Live Zero-Sum Ledger & Season Tracker
                </p>
              </div>
            </div>

            {/* Course Selector & Quick Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center bg-white/10 rounded-xl p-1 border border-white/15">
                <select
                  value={roundState.courseId}
                  onChange={(e) => handleCourseChange(e.target.value)}
                  className="bg-transparent text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg focus:outline-none cursor-pointer"
                  title="Select Pre-loaded Course"
                >
                  {allCourses.map((c) => (
                    <option key={c.id} value={c.id} className="text-slate-900">
                      ⛳ {c.name} ({c.location})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowNewCourseModal(true)}
                  className="p-1.5 text-[#F4E4C1] hover:bg-white/10 rounded-lg transition"
                  title="Save Current Hole Pars as a Custom Course Preset"
                >
                  <PlusCircle className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowRulesModal(true)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-[#F4E4C1] transition"
                title="Wolf Payout Rules & Math Breakdown"
              >
                <HelpCircle className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="flex items-center gap-1 px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-300/30 text-rose-100 text-xs font-bold transition"
                title="Clear Board / Start Fresh Round"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Clear Board</span>
              </button>
            </div>
          </div>

          {/* Live 5-Player Sticky Scoreboard Ribbon */}
          <div className="mt-3 pt-2.5 border-t border-white/15 grid grid-cols-5 gap-1.5 sm:gap-2">
            {[0, 1, 2, 3, 4].map((idx) => {
              const net = finalTotals[idx];
              const name = roundState.playerNames[idx]?.trim() || `P${idx + 1}`;
              const isWolfNow = activeResult?.effectiveWolfIndex === idx;
              return (
                <div
                  key={idx}
                  className={`rounded-xl px-2 py-1.5 text-center transition border ${
                    isWolfNow
                      ? 'bg-[#2E8B57] border-[#F4E4C1]'
                      : 'bg-black/20 border-white/10'
                  }`}
                >
                  <div className="text-[11px] font-bold truncate text-[#E9F5EC] flex items-center justify-center gap-1">
                    {isWolfNow && <span title="Current Hole Wolf">🐺</span>}
                    <span className="truncate">{name}</span>
                  </div>
                  <div
                    className={`font-mono font-extrabold text-xs sm:text-sm ${
                      net > 0
                        ? 'text-emerald-300'
                        : net < 0
                        ? 'text-rose-300'
                        : 'text-[#F4E4C1]'
                    }`}
                  >
                    {net > 0 ? `+$${net}` : net < 0 ? `-$${Math.abs(net)}` : '$0'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-6 py-4 space-y-4">
        {/* View Switcher Bar */}
        <div className="flex items-center justify-between gap-2 bg-white p-1.5 rounded-2xl shadow-sm border border-[#2E8B57]/20">
          <div className="grid grid-cols-3 gap-1 flex-1">
            <button
              type="button"
              onClick={() => setViewMode('caddie')}
              className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition ${
                viewMode === 'caddie'
                  ? 'bg-[#2E8B57] text-white shadow-sm'
                  : 'text-slate-600 hover:bg-[#E9F5EC]/60'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              <span>Hole Caddie</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('ledger')}
              className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition ${
                viewMode === 'ledger'
                  ? 'bg-[#2E8B57] text-white shadow-sm'
                  : 'text-slate-600 hover:bg-[#E9F5EC]/60'
              }`}
            >
              <Table2 className="w-4 h-4" />
              <span>18-Hole Ledger</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('season')}
              className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition ${
                viewMode === 'season'
                  ? 'bg-[#2E8B57] text-white shadow-sm'
                  : 'text-slate-600 hover:bg-[#E9F5EC]/60'
              }`}
            >
              <Trophy className="w-4 h-4" />
              <span>Payouts & Season ({savedRounds.length})</span>
            </button>
          </div>

          <div
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#E9F5EC] text-[#143F27] text-xs font-bold shrink-0"
            title="Zero-Sum Ledger Verification"
          >
            <Scale className="w-4 h-4 text-[#2E8B57]" />
            {isEntireRoundBalanced ? 'All Holes Balanced ($0)' : 'Check Balance'}
          </div>
        </div>

        {/* Active View Content */}
        {viewMode === 'caddie' && (
          <HoleCaddieCard
            hole={activeHole}
            result={activeResult}
            playerNames={roundState.playerNames}
            onPlayerNameChange={handlePlayerNameChange}
            onSelectHole={(hNum) =>
              setRoundState((prev) => ({ ...prev, activeHoleNumber: hNum }))
            }
            onUpdateHole={(updater) =>
              handleUpdateHole(activeHole.holeNumber, updater)
            }
            allResults={results}
          />
        )}

        {viewMode === 'ledger' && (
          <FullLedgerTable
            holes={roundState.holes}
            results={results}
            playerNames={roundState.playerNames}
            activeHoleNumber={roundState.activeHoleNumber}
            onPlayerNameChange={handlePlayerNameChange}
            onSelectHole={(hNum) => {
              setRoundState((prev) => ({ ...prev, activeHoleNumber: hNum }));
            }}
            onUpdateHole={handleUpdateHole}
          />
        )}

        {viewMode === 'season' && (
          <SeasonHistoryView
            currentCourseName={selectedCourse.name}
            currentPlayerNames={roundState.playerNames}
            currentHoles={roundState.holes}
            currentResults={results}
            savedRounds={savedRounds}
            onSaveCurrentRound={handleSaveCurrentRoundToHistory}
            onDeleteRound={handleDeleteSavedRound}
            onImportRounds={handleImportRounds}
          />
        )}
      </main>

      {/* Reset Board Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <h3 className="font-serif font-bold text-lg text-[#143F27]">
              Reset Active Scorecard?
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              This will clear all hole scores and bets for the current round on{' '}
              <strong>{selectedCourse.name}</strong> (your player names and saved
              season history will be kept). Want to save this round to your Season
              History first?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await handleSaveCurrentRoundToHistory();
                  handleResetBoard();
                }}
                className="px-4 py-2 rounded-xl bg-[#2E8B57] text-white text-xs font-bold hover:bg-[#1E5E3A]"
              >
                Save Round & Reset
              </button>
              <button
                type="button"
                onClick={handleResetBoard}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700"
              >
                Clear Without Saving
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Custom Course Modal */}
      {showNewCourseModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveCurrentParsAsCustomCourse}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-serif font-bold text-lg text-[#143F27]">
                Save Custom Course Preset
              </h3>
              <button
                type="button"
                onClick={() => setShowNewCourseModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Saves the current 18-hole Par & Handicap configuration to your course
              dropdown menu for future rounds.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Course Name
                </label>
                <input
                  type="text"
                  required
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  placeholder="e.g., Congressional Country Club"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:border-[#2E8B57] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Location (City, State)
                </label>
                <input
                  type="text"
                  value={newCourseLocation}
                  onChange={(e) => setNewCourseLocation(e.target.value)}
                  placeholder="e.g., Bethesda, MD"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:border-[#2E8B57] focus:outline-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewCourseModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#2E8B57] text-white text-xs font-bold hover:bg-[#1E5E3A]"
              >
                Save Course Preset
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rules & Payout Math Modal */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-serif font-bold text-lg text-[#143F27]">
                The Shared Wolf — Rules & Zero-Sum Math
              </h3>
              <button
                type="button"
                onClick={() => setShowRulesModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
              <div className="p-3 rounded-xl bg-[#E9F5EC] border border-[#2E8B57]/20">
                <strong className="text-[#143F27] block mb-1">
                  1. Low Ball Determines Winner
                </strong>
                The lowest single gross stroke score on the Wolf's side vs. the lowest
                single gross score on the Pack's (non-Wolf) side wins the hole.
              </div>
              <div className="p-3 rounded-xl bg-[#E9F5EC] border border-[#2E8B57]/20">
                <strong className="text-[#143F27] block mb-1">
                  2. Effective Hole Value ($V)
                </strong>
                Starts at <strong>$2 Base Bet</strong> (editable or doublable via{' '}
                <code>2× Press</code>) + <strong>+$1 per consecutive tied hole</strong>{' '}
                (Carry-over) + <strong>+$2 Birdie Bonus</strong> (auto-detected when the
                winning side scores under Par) + <strong>+$1 Greenie Bonus</strong> (on
                Par 3s & Par 5s when checked for the winning side).
              </div>
              <div className="p-3 rounded-xl bg-[#F4E4C1]/60 border border-[#DFC690]">
                <strong className="text-[#143F27] block mb-1">
                  3. 2 vs 3 Payouts (Wolf Takes Overage)
                </strong>
                When Wolf picks a Partner (2 vs 3), the 3 Pack players always win or
                lose <strong>$V each</strong> (Total Pot = <strong>$3V</strong>). The 2
                Wolf-team players split $3V, and any odd dollar overage on wins{' '}
                <em>or</em> losses goes to the Wolf:
                <ul className="list-disc list-inside mt-1 space-y-0.5 font-mono text-[11px]">
                  <li>$2 Hole ($6 Pot): Wolf ±$3, Partner ±$3, Pack ∓$2 each</li>
                  <li>$3 Hole ($9 Pot): Wolf ±$5, Partner ±$4, Pack ∓$3 each</li>
                </ul>
              </div>
              <div className="p-3 rounded-xl bg-[#E9F5EC] border border-[#2E8B57]/20">
                <strong className="text-[#143F27] block mb-1">
                  4. 1 vs 4 Payouts (Lone Wolf)
                </strong>
                When the Wolf goes solo (1 vs 4), the Pot is <strong>$4V</strong>. If
                Lone Wolf wins, they collect +$4V (-$V from each of the 4 others). If
                Lone Wolf loses, they pay -$4V (+$V to each of the 4 winners).
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default App;
