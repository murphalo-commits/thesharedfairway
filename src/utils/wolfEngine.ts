import { HoleCalculationResult, HoleState, SettlementTransfer } from '../types';

/**
 * Returns the 0-based hole array indices (0..17) in chronological play order
 * given a starting hole number (1..18) for Shotgun Starts.
 */
export function getPlayOrderHoleIndices(startingHole = 1): number[] {
  const startIdx = Math.max(0, Math.min(17, (startingHole || 1) - 1));
  const order: number[] = [];
  for (let step = 0; step < 18; step++) {
    order.push((startIdx + step) % 18);
  }
  return order;
}

/**
 * Calculates hole-by-hole Wolf payouts, carry-overs, individual trash (Greenies & Sandies),
 * running totals in chronological play order (supporting Shotgun Starts), and zero-sum verification.
 *
 * Rules:
 * - 4 or 5 players total (`playerCount`).
 * - Shotgun Start support (`startingHole` 1..18):
 *   - Holes are played in wrap-around order starting at `startingHole`.
 *   - Carry-overs flow in play order (including wrapping from Hole 18 -> Hole 1).
 *   - Low-Money Auto-Wolf triggers on the closing holes of the day's play order:
 *     - 5-Player: 16th, 17th, and 18th holes played (`playOrderNumber >= 16`).
 *     - 4-Player: 17th and 18th holes played (`playOrderNumber >= 17`).
 * - Main Hole Bet + Birdies (+$2 per Birdie on the winning team):
 *   - Only paid out if a team wins the hole (`status === 'wolf_win' || status === 'non_wolf_win'`).
 *   - If tied (`status === 'push'`), main hole bet pushes and adds +$1 carry-over to the next hole played (birdies do not carry over).
 * - Individual Trash — Greenies ($1 on Par 3/5) & Sandies ($1 on any hole):
 *   - Paid out individually to the player who earned the Greenie/Sandie by the players on the opposing team,
 *     EVEN IF the overall hole is tied or lost!
 *   - Trash payout math per $1 trash item earned by player `earnerIdx`:
 *     - In 5P (2 vs 3, packCount = 3, Trash Pot = $3):
 *       - If earner is on Wolf team (2): Each of the 3 Pack players pays -$1, and earner gets +$3.
 *       - If earner is on Pack team (3): Wolf pays -$2 (ceil(3/2)), Partner pays -$1 (floor(3/2)), and earner gets +$3.
 *     - In 5P Lone Wolf (1 vs 4, packCount = 4, Trash Pot = $4):
 *       - If Lone Wolf earns it: Each of 4 Pack players pays -$1, Lone Wolf gets +$4.
 *       - If a Pack player earns it: Lone Wolf pays -$4, that Pack player gets +$4.
 *     - In 4P (2 vs 2, packCount = 2, Trash Pot = $2):
 *       - Opposing 2 players each pay -$1, earner gets +$2.
 *     - In 4P Lone Wolf (1 vs 3, packCount = 3, Trash Pot = $3):
 *       - If Lone Wolf earns it: Each of 3 Pack players pays -$1, Lone Wolf gets +$3.
 *       - If a Pack player earns it: Lone Wolf pays -$3, that Pack player gets +$3.
 */
export function calculateRoundResults(
  holes: HoleState[],
  playerCount: 4 | 5 = 5,
  startingHole = 1
): HoleCalculationResult[] {
  const resultsByHoleIdx: HoleCalculationResult[] = new Array(holes.length);
  let carryOverDollars = 0;
  const runningTotals = [0, 0, 0, 0, 0];

  // In 5-Player, 3 full rotations = 15 holes played, so Low-Money Auto-Wolf starts on the 16th hole played.
  // In 4-Player, 4 full rotations = 16 holes played, so Low-Money Auto-Wolf starts on the 17th hole played.
  const autoWolfStartOrder = playerCount === 4 ? 17 : 16;
  const playOrderIndices = getPlayOrderHoleIndices(startingHole);

  for (let step = 0; step < playOrderIndices.length; step++) {
    const holeIdx = playOrderIndices[step];
    const hole = holes[holeIdx];
    const playOrderNumber = step + 1; // 1..18 (nth hole played today)
    const isAutoWolfHole = playOrderNumber >= autoWolfStartOrder;
    const carryInDollars = carryOverDollars;

    // On the closing holes of the day's rotation (16th-18th in 5P, 17th-18th in 4P),
    // whoever is losing the most money entering this hole automatically becomes the Wolf unless manually overridden.
    let tiedForLowMoneyIndices: number[] = [];
    let autoWolfCandidate: number | null = null;

    if (isAutoWolfHole) {
      const hasAnyCompletedPriorHole = playOrderIndices
        .slice(0, step)
        .some((priorIdx) => {
          const priorRes = resultsByHoleIdx[priorIdx];
          return (
            priorRes &&
            (priorRes.status !== 'incomplete' ||
              priorRes.greeniePlayerIndices.length > 0 ||
              priorRes.sandiePlayerIndices.length > 0)
          );
        });
      if (hasAnyCompletedPriorHole) {
        const activeRunningTotals = runningTotals.slice(0, playerCount);
        const minTotal = Math.min(...activeRunningTotals);
        tiedForLowMoneyIndices = activeRunningTotals
          .map((tot, idx) => (tot === minTotal ? idx : -1))
          .filter((idx) => idx !== -1);
        autoWolfCandidate = tiedForLowMoneyIndices[0] ?? null;
      }
    }

    const manualWolfValid =
      hole.wolfPlayerIndex !== null &&
      hole.wolfPlayerIndex >= 0 &&
      hole.wolfPlayerIndex < playerCount
        ? hole.wolfPlayerIndex
        : null;

    const isAutoAssignedWolf =
      manualWolfValid === null && isAutoWolfHole && autoWolfCandidate !== null;

    const wolfIdx =
      manualWolfValid !== null ? manualWolfValid : autoWolfCandidate;

    const rawPartnerIdx =
      hole.partnerPlayerIndex !== null &&
      hole.partnerPlayerIndex >= 0 &&
      hole.partnerPlayerIndex < playerCount
        ? hole.partnerPlayerIndex
        : null;

    const partnerIdx =
      hole.isLoneWolf || rawPartnerIdx === wolfIdx ? null : rawPartnerIdx;

    const wolfTeamIndices: number[] = [];
    const nonWolfTeamIndices: number[] = [];

    if (wolfIdx !== null && wolfIdx >= 0 && wolfIdx < playerCount) {
      wolfTeamIndices.push(wolfIdx);
      if (
        partnerIdx !== null &&
        partnerIdx >= 0 &&
        partnerIdx < playerCount &&
        partnerIdx !== wolfIdx
      ) {
        wolfTeamIndices.push(partnerIdx);
      }
      for (let p = 0; p < playerCount; p++) {
        if (!wolfTeamIndices.includes(p)) {
          nonWolfTeamIndices.push(p);
        }
      }
    }

    // Identify birdies (score <= par - 1), eagles, greenies (on par 3 or par 5), and sandies (any hole)
    const birdiePlayerIndices: number[] = [];
    const eaglePlayerIndices: number[] = [];
    const greeniePlayerIndices: number[] = [];
    const sandiePlayerIndices: number[] = [];

    for (let p = 0; p < playerCount; p++) {
      const pState = hole.players[p];
      if (!pState) continue;
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
      if (pState.sandie) {
        sandiePlayerIndices.push(p);
      }
    }

    // Calculate best (lowest) score on each team from available entered scores
    const wolfScores = wolfTeamIndices
      .map((idx) => hole.players[idx]?.score ?? null)
      .filter((s): s is number => s !== null && s > 0);

    const nonWolfScores = nonWolfTeamIndices
      .map((idx) => hole.players[idx]?.score ?? null)
      .filter((s): s is number => s !== null && s > 0);

    const wolfTeamBestScore =
      wolfScores.length > 0 ? Math.min(...wolfScores) : null;
    const nonWolfTeamBestScore =
      nonWolfScores.length > 0 ? Math.min(...nonWolfScores) : null;

    let status: HoleCalculationResult['status'] = 'incomplete';
    if (
      wolfIdx !== null &&
      wolfTeamBestScore !== null &&
      nonWolfTeamBestScore !== null
    ) {
      if (wolfTeamBestScore < nonWolfTeamBestScore) {
        status = 'wolf_win';
      } else if (nonWolfTeamBestScore < wolfTeamBestScore) {
        status = 'non_wolf_win';
      } else {
        status = 'push';
      }
    }

    // Birdie bonus: Each birdie made on the winning team adds $2 to the hole bet.
    // You only get paid for a birdie if your team wins the hole.
    let birdieBonusDollars = 0;

    if (status === 'wolf_win') {
      const wolfTeamBirdieCount = wolfTeamIndices.filter((idx) =>
        birdiePlayerIndices.includes(idx)
      ).length;
      birdieBonusDollars = wolfTeamBirdieCount * 2;
    } else if (status === 'non_wolf_win') {
      const nonWolfTeamBirdieCount = nonWolfTeamIndices.filter((idx) =>
        birdiePlayerIndices.includes(idx)
      ).length;
      birdieBonusDollars = nonWolfTeamBirdieCount * 2;
    }

    const baseBet = Math.max(1, Math.round(hole.baseBet || 2));
    const effectiveHoleValue = baseBet + carryInDollars + birdieBonusDollars;

    const playerNetDollars = [0, 0, 0, 0, 0];
    const playerTrashNetDollars = [0, 0, 0, 0, 0];
    let mainHolePot = 0;
    const packCount = nonWolfTeamIndices.length; // 4 or 3 in 5P; 3 or 2 in 4P

    // 1. Main Hole Payout (only on wolf_win or non_wolf_win)
    if (status === 'wolf_win' && wolfIdx !== null) {
      if (partnerIdx === null) {
        mainHolePot = packCount * effectiveHoleValue;
        playerNetDollars[wolfIdx] += mainHolePot;
        for (const loserIdx of nonWolfTeamIndices) {
          playerNetDollars[loserIdx] -= effectiveHoleValue;
        }
      } else {
        mainHolePot = packCount * effectiveHoleValue;
        const wolfShare = Math.ceil(mainHolePot / 2);
        const partnerShare = Math.floor(mainHolePot / 2);
        playerNetDollars[wolfIdx] += wolfShare;
        playerNetDollars[partnerIdx] += partnerShare;
        for (const loserIdx of nonWolfTeamIndices) {
          playerNetDollars[loserIdx] -= effectiveHoleValue;
        }
      }
      carryOverDollars = 0;
    } else if (status === 'non_wolf_win' && wolfIdx !== null) {
      if (partnerIdx === null) {
        mainHolePot = packCount * effectiveHoleValue;
        playerNetDollars[wolfIdx] -= mainHolePot;
        for (const winnerIdx of nonWolfTeamIndices) {
          playerNetDollars[winnerIdx] += effectiveHoleValue;
        }
      } else {
        mainHolePot = packCount * effectiveHoleValue;
        const wolfLoss = Math.ceil(mainHolePot / 2);
        const partnerLoss = Math.floor(mainHolePot / 2);
        playerNetDollars[wolfIdx] -= wolfLoss;
        playerNetDollars[partnerIdx] -= partnerLoss;
        for (const winnerIdx of nonWolfTeamIndices) {
          playerNetDollars[winnerIdx] += effectiveHoleValue;
        }
      }
      carryOverDollars = 0;
    } else if (status === 'push') {
      // Tie: carry-over adds $1 to the next hole in play order
      carryOverDollars = carryInDollars + 1;
    }

    // 2. Individual Trash Payouts (Greenies & Sandies)
    // Paid out to the individual earner by the opposing team even if the overall hole is tied or lost!
    // We award trash as long as teams are designated (wolfIdx !== null).
    let greenieBonusDollars = 0;
    let sandieBonusDollars = 0;

    const awardIndividualTrash = (earnerIdx: number, trashUnitValue = 1): number => {
      if (wolfIdx === null || packCount <= 0) return 0;
      const singleTrashPot = packCount * trashUnitValue; // $3 in 5P 2v3, $4 in 5P 1v4, $2 in 4P 2v2, $3 in 4P 1v3
      const earnerOnWolfTeam = wolfTeamIndices.includes(earnerIdx);

      if (earnerOnWolfTeam) {
        // Earner is Wolf or Partner: gets the entire trash pot individually; each Pack player pays -$1
        playerTrashNetDollars[earnerIdx] += singleTrashPot;
        playerNetDollars[earnerIdx] += singleTrashPot;
        for (const packIdx of nonWolfTeamIndices) {
          playerTrashNetDollars[packIdx] -= trashUnitValue;
          playerNetDollars[packIdx] -= trashUnitValue;
        }
      } else {
        // Earner is on the Pack team: gets the entire trash pot individually; Wolf team pays it out
        playerTrashNetDollars[earnerIdx] += singleTrashPot;
        playerNetDollars[earnerIdx] += singleTrashPot;
        if (partnerIdx === null) {
          // Lone Wolf pays full trash pot
          playerTrashNetDollars[wolfIdx] -= singleTrashPot;
          playerNetDollars[wolfIdx] -= singleTrashPot;
        } else {
          // Wolf + Partner split paying singleTrashPot, with Wolf paying the odd dollar overage ($2 vs $1 in 5P 2v3)
          const wolfTrashLoss = Math.ceil(singleTrashPot / 2);
          const partnerTrashLoss = Math.floor(singleTrashPot / 2);
          playerTrashNetDollars[wolfIdx] -= wolfTrashLoss;
          playerNetDollars[wolfIdx] -= wolfTrashLoss;
          playerTrashNetDollars[partnerIdx] -= partnerTrashLoss;
          playerNetDollars[partnerIdx] -= partnerTrashLoss;
        }
      }
      return singleTrashPot;
    };

    if (wolfIdx !== null) {
      for (const gIdx of greeniePlayerIndices) {
        greenieBonusDollars += awardIndividualTrash(gIdx, 1);
      }
      for (const sIdx of sandiePlayerIndices) {
        sandieBonusDollars += awardIndividualTrash(sIdx, 1);
      }
    }

    for (let p = 0; p < playerCount; p++) {
      runningTotals[p] += playerNetDollars[p];
    }

    const netSum = playerNetDollars
      .slice(0, playerCount)
      .reduce((acc, val) => acc + val, 0);

    resultsByHoleIdx[holeIdx] = {
      holeNumber: hole.holeNumber,
      playOrderNumber,
      carryInDollars,
      effectiveHoleValue,
      birdieBonusDollars,
      greenieBonusDollars,
      sandieBonusDollars,
      status,
      wolfTeamBestScore,
      nonWolfTeamBestScore,
      playerNetDollars,
      playerTrashNetDollars,
      playerRunningTotals: [...runningTotals],
      totalPot: mainHolePot + greenieBonusDollars + sandieBonusDollars,
      isBalanced: netSum === 0,
      birdiePlayerIndices,
      eaglePlayerIndices,
      greeniePlayerIndices,
      sandiePlayerIndices,
      effectiveWolfIndex: wolfIdx,
      isAutoAssignedWolf,
      isAutoWolfHole,
      tiedForLowMoneyIndices,
    };
  }

  return resultsByHoleIdx;
}

/**
 * Calculates the minimum number of Venmo/cash transfers to settle the ledger at the end of a round.
 */
export function calculateMinimumSettlements(
  playerNames: string[],
  netTotals: number[],
  playerCount: 4 | 5 = 5
): SettlementTransfer[] {
  const debtors: { name: string; amount: number }[] = [];
  const creditors: { name: string; amount: number }[] = [];

  netTotals.slice(0, playerCount).forEach((net, idx) => {
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
