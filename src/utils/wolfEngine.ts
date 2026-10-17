import { HoleCalculationResult, HoleState, SettlementTransfer } from '../types';

/**
 * Calculates hole-by-hole Wolf payouts, carry-overs, running totals, and zero-sum verification.
 *
 * Rules:
 * - 5 players total.
 * - Wolf is designated on each hole (`wolfPlayerIndex`).
 * - Wolf can either play Lone Wolf (1 vs 4) or pick 1 Partner (`partnerPlayerIndex`, 2 vs 3).
 * - Low ball (best single gross score on the Wolf's team vs. best single gross score on the Non-Wolf team) determines the winning side.
 * - Continuous calculation: calculates as soon as Wolf is selected and at least one player on Wolf's side and one player on Non-Wolf's side have entered scores.
 * - Carry-overs: If a hole is tied (push), the next hole gets +$1 added to its value (accumulates across consecutive ties). Carry-overs ONLY occur on ties.
 * - Birdies: Any player scoring <= Par - 1 auto-triggers a Birdie (or manual override). If the winning team has a Birdie, +$1 is added to the hole value ($V).
 * - Greenies: Available on Par 3 and Par 5 holes. If the winning team has a Greenie checked, +$1 is added to the hole value ($V).
 * - Payout Math (Zero-Sum Ledger):
 *   - 1 vs 4 (Lone Wolf):
 *     - Pot is 4 * V.
 *     - If Wolf wins: Wolf gets +4V, each of the 4 others gets -V.
 *     - If Wolf loses: Wolf gets -4V, each of the 4 others gets +V.
 *   - 2 vs 3 (Wolf + Partner vs 3 Others):
 *     - Each of the 3 non-Wolf players always wins +V or loses -V (Total pot = 3 * V).
 *     - The 2-player Wolf team splits 3 * V, with any odd dollar overage (wins OR losses) going to the Wolf:
 *       - Partner gets ±Math.floor((3 * V) / 2)
 *       - Wolf gets ±Math.ceil((3 * V) / 2)
 */
export function calculateRoundResults(holes: HoleState[]): HoleCalculationResult[] {
  const results: HoleCalculationResult[] = [];
  let carryOverDollars = 0;
  const runningTotals = [0, 0, 0, 0, 0];

  for (let i = 0; i < holes.length; i++) {
    const hole = holes[i];
    const carryInDollars = carryOverDollars;

    // On holes 16, 17, 18, whoever is losing the most money (lowest running total)
    // automatically becomes the Wolf unless manually overridden on that hole.
    let tiedForLowMoneyIndices: number[] = [];
    let autoWolfCandidate: number | null = null;

    if (hole.holeNumber >= 16) {
      const hasAnyCompletedPriorHole = results.some((r) => r.status !== 'incomplete');
      if (hasAnyCompletedPriorHole) {
        const minTotal = Math.min(...runningTotals);
        tiedForLowMoneyIndices = runningTotals
          .map((tot, idx) => (tot === minTotal ? idx : -1))
          .filter((idx) => idx !== -1);
        autoWolfCandidate = tiedForLowMoneyIndices[0] ?? null;
      }
    }

    const isAutoAssignedWolf =
      hole.wolfPlayerIndex === null && hole.holeNumber >= 16 && autoWolfCandidate !== null;

    const wolfIdx =
      hole.wolfPlayerIndex !== null ? hole.wolfPlayerIndex : autoWolfCandidate;

    const partnerIdx =
      hole.isLoneWolf || hole.partnerPlayerIndex === wolfIdx
        ? null
        : hole.partnerPlayerIndex;

    const wolfTeamIndices: number[] = [];
    const nonWolfTeamIndices: number[] = [];

    if (wolfIdx !== null && wolfIdx >= 0 && wolfIdx < 5) {
      wolfTeamIndices.push(wolfIdx);
      if (partnerIdx !== null && partnerIdx >= 0 && partnerIdx < 5 && partnerIdx !== wolfIdx) {
        wolfTeamIndices.push(partnerIdx);
      }
      for (let p = 0; p < 5; p++) {
        if (!wolfTeamIndices.includes(p)) {
          nonWolfTeamIndices.push(p);
        }
      }
    }

    // Identify birdies (score <= par - 1) and greenies (on par 3 or par 5)
    const birdiePlayerIndices: number[] = [];
    const eaglePlayerIndices: number[] = [];
    const greeniePlayerIndices: number[] = [];

    for (let p = 0; p < 5; p++) {
      const pState = hole.players[p];
      if (pState.score !== null && pState.score > 0) {
        if (pState.score <= hole.par - 1 || pState.manualBirdieOverride) {
          birdiePlayerIndices.push(p);
        }
        if (pState.score <= hole.par - 2) {
          eaglePlayerIndices.push(p);
        }
      } else if (pState.manualBirdieOverride) {
        birdiePlayerIndices.push(p);
      }

      if ((hole.par === 3 || hole.par === 5) && pState.greenie) {
        greeniePlayerIndices.push(p);
      }
    }

    // Calculate best (lowest) score on each team from available entered scores
    const wolfScores = wolfTeamIndices
      .map((idx) => hole.players[idx].score)
      .filter((s): s is number => s !== null && s > 0);

    const nonWolfScores = nonWolfTeamIndices
      .map((idx) => hole.players[idx].score)
      .filter((s): s is number => s !== null && s > 0);

    const wolfTeamBestScore = wolfScores.length > 0 ? Math.min(...wolfScores) : null;
    const nonWolfTeamBestScore = nonWolfScores.length > 0 ? Math.min(...nonWolfScores) : null;

    let status: HoleCalculationResult['status'] = 'incomplete';
    if (wolfIdx !== null && wolfTeamBestScore !== null && nonWolfTeamBestScore !== null) {
      if (wolfTeamBestScore < nonWolfTeamBestScore) {
        status = 'wolf_win';
      } else if (nonWolfTeamBestScore < wolfTeamBestScore) {
        status = 'non_wolf_win';
      } else {
        status = 'push';
      }
    }

    // Determine bonuses for the winning team
    // Each birdie made on the winning team adds $2 to the hole bet (e.g., 2 birdies = +$4).
    // (If both teams make birdies with the same low score, status is 'push' so no payout occurs).
    let birdieBonusDollars = 0;
    let greenieBonusDollars = 0;

    if (status === 'wolf_win') {
      const wolfTeamBirdieCount = wolfTeamIndices.filter((idx) =>
        birdiePlayerIndices.includes(idx)
      ).length;
      const wolfTeamGreenieCount = wolfTeamIndices.filter((idx) =>
        greeniePlayerIndices.includes(idx)
      ).length;
      birdieBonusDollars = wolfTeamBirdieCount * 2;
      if (wolfTeamGreenieCount > 0) greenieBonusDollars = 1;
    } else if (status === 'non_wolf_win') {
      const nonWolfTeamBirdieCount = nonWolfTeamIndices.filter((idx) =>
        birdiePlayerIndices.includes(idx)
      ).length;
      const nonWolfTeamGreenieCount = nonWolfTeamIndices.filter((idx) =>
        greeniePlayerIndices.includes(idx)
      ).length;
      birdieBonusDollars = nonWolfTeamBirdieCount * 2;
      if (nonWolfTeamGreenieCount > 0) greenieBonusDollars = 1;
    }

    const baseBet = Math.max(1, Math.round(hole.baseBet || 2));
    const effectiveHoleValue =
      baseBet + carryInDollars + birdieBonusDollars + greenieBonusDollars;

    const playerNetDollars = [0, 0, 0, 0, 0];
    let totalPot = 0;

    if (status === 'wolf_win' && wolfIdx !== null) {
      if (partnerIdx === null) {
        // Lone Wolf (1 vs 4): Pot = 4 * V
        totalPot = 4 * effectiveHoleValue;
        playerNetDollars[wolfIdx] = totalPot;
        for (const loserIdx of nonWolfTeamIndices) {
          playerNetDollars[loserIdx] = -effectiveHoleValue;
        }
      } else {
        // Wolf + Partner (2 vs 3): Pot = 3 * V, Wolf gets ceil(3V/2), Partner gets floor(3V/2)
        totalPot = 3 * effectiveHoleValue;
        const wolfShare = Math.ceil(totalPot / 2);
        const partnerShare = Math.floor(totalPot / 2);
        playerNetDollars[wolfIdx] = wolfShare;
        playerNetDollars[partnerIdx] = partnerShare;
        for (const loserIdx of nonWolfTeamIndices) {
          playerNetDollars[loserIdx] = -effectiveHoleValue;
        }
      }
      // Reset carry-over after a won hole
      carryOverDollars = 0;
    } else if (status === 'non_wolf_win' && wolfIdx !== null) {
      if (partnerIdx === null) {
        // Lone Wolf (1 vs 4) loses: Wolf owes 4 * V, each of the 4 winners gets +V
        totalPot = 4 * effectiveHoleValue;
        playerNetDollars[wolfIdx] = -totalPot;
        for (const winnerIdx of nonWolfTeamIndices) {
          playerNetDollars[winnerIdx] = effectiveHoleValue;
        }
      } else {
        // Wolf + Partner (2 vs 3) loses: 3 winners each get +V (Pot = 3V), Wolf owes ceil(3V/2), Partner owes floor(3V/2)
        totalPot = 3 * effectiveHoleValue;
        const wolfLoss = Math.ceil(totalPot / 2);
        const partnerLoss = Math.floor(totalPot / 2);
        playerNetDollars[wolfIdx] = -wolfLoss;
        playerNetDollars[partnerIdx] = -partnerLoss;
        for (const winnerIdx of nonWolfTeamIndices) {
          playerNetDollars[winnerIdx] = effectiveHoleValue;
        }
      }
      // Reset carry-over after a lost hole
      carryOverDollars = 0;
    } else if (status === 'push') {
      // Tie: carry-over adds $1 to the next hole
      carryOverDollars = carryInDollars + 1;
    }

    for (let p = 0; p < 5; p++) {
      runningTotals[p] += playerNetDollars[p];
    }

    const netSum = playerNetDollars.reduce((acc, val) => acc + val, 0);

    results.push({
      holeNumber: hole.holeNumber,
      carryInDollars,
      effectiveHoleValue,
      birdieBonusDollars,
      greenieBonusDollars,
      status,
      wolfTeamBestScore,
      nonWolfTeamBestScore,
      playerNetDollars,
      playerRunningTotals: [...runningTotals],
      totalPot,
      isBalanced: netSum === 0,
      birdiePlayerIndices,
      eaglePlayerIndices,
      greeniePlayerIndices,
      effectiveWolfIndex: wolfIdx,
      isAutoAssignedWolf,
      tiedForLowMoneyIndices,
    });
  }

  return results;
}

/**
 * Calculates the minimum number of Venmo/cash transfers to settle the ledger at the end of a round.
 */
export function calculateMinimumSettlements(
  playerNames: string[],
  netTotals: number[]
): SettlementTransfer[] {
  const debtors: { name: string; amount: number }[] = [];
  const creditors: { name: string; amount: number }[] = [];

  netTotals.forEach((net, idx) => {
    const displayName = playerNames[idx]?.trim() || `Player ${idx + 1}`;
    if (net < 0) {
      debtors.push({ name: displayName, amount: Math.abs(net) });
    } else if (net > 0) {
      creditors.push({ name: displayName, amount: net });
    }
  });

  // Sort largest first for cleanest settlement
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const transfers: SettlementTransfer[] = [];
  let d = 0;
  let c = 0;

  while (d < debtors.length && c < creditors.length) {
    const payment = Math.min(debtors[d].amount, creditors[c].amount);
    if (payment > 0) {
      transfers.push({
        fromPlayer: debtors[d].name,
        toPlayer: creditors[c].name,
        amount: payment,
      });
    }
    debtors[d].amount -= payment;
    creditors[c].amount -= payment;

    if (debtors[d].amount === 0) d++;
    if (creditors[c].amount === 0) c++;
  }

  return transfers;
}
