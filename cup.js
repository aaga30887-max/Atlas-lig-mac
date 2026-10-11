// ════════════════════════════════════════════════════════════════════════
//  VOLDER CUP — Kupa Sistemi
// ════════════════════════════════════════════════════════════════════════

const { CUP_TEAMS, MANU_ROLE_ID } = require('../constants');
const { roll, extractValueFromNickname, getGKBonuses } = require('../utils');
const db = require('../database');

function generateCupBracket(teams) {
  const shuffled = [...teams].sort(() => Math.random() - 0.5);
  const rounds = [];

  const quarterFinals = [];
  for (let i = 0; i < 4; i++) {
    quarterFinals.push({
      id: `QF${i + 1}`,
      home: shuffled[i * 2],
      away: shuffled[i * 2 + 1],
      homeScore: null, awayScore: null,
      homePen: null, awayPen: null,
      played: false, winner: null
    });
  }
  rounds.push({ name: 'Çeyrek Final', matches: quarterFinals });

  rounds.push({
    name: 'Yarı Final',
    matches: [
      { id: 'SF1', home: null, away: null, homeScore: null, awayScore: null, homePen: null, awayPen: null, played: false, winner: null },
      { id: 'SF2', home: null, away: null, homeScore: null, awayScore: null, homePen: null, awayPen: null, played: false, winner: null }
    ]
  });

  rounds.push({
    name: 'Final',
    matches: [{
      id: 'FINAL', home: null, away: null,
      homeScore: null, awayScore: null,
      homePen: null, awayPen: null,
      played: false, winner: null
    }]
  });

  return { status: 'drawn', rounds, currentRound: 0, currentMatch: 0 };
}

function advanceCupWinner(cup, matchId) {
  let winner = null, matchRound = -1, matchIndex = -1;

  for (let r = 0; r < cup.rounds.length; r++) {
    for (let m = 0; m < cup.rounds[r].matches.length; m++) {
      const match = cup.rounds[r].matches[m];
      if (match.id === matchId && match.winner) {
        winner = match.winner;
        matchRound = r;
        matchIndex = m;
        break;
      }
    }
    if (winner) break;
  }

  if (!winner || matchRound >= cup.rounds.length - 1) return;

  if (matchRound === 0) {
    const sfIndex = Math.floor(matchIndex / 2);
    const isHome = matchIndex % 2 === 0;
    if (cup.rounds[1] && cup.rounds[1].matches[sfIndex]) {
      if (isHome) cup.rounds[1].matches[sfIndex].home = winner;
      else cup.rounds[1].matches[sfIndex].away = winner;
    }
  }

  if (matchRound === 1) {
    const final_ = cup.rounds[2].matches[0];
    if (matchIndex === 0) final_.home = winner;
    else final_.away = winner;
  }
}

function runCupPenalties(homeTeam, awayTeam, homePlayers, awayPlayers) {
  let hScore = 0, aScore = 0;
  const log = [];

  const isNpcHeavy = (players) => players.filter(p => p.isNpc).length >= players.length * 0.6;
  const hNpcPenalty = isNpcHeavy(homePlayers) ? -0.15 : 0;
  const aNpcPenalty = isNpcHeavy(awayPlayers) ? -0.15 : 0;
  const hManuPenalty = homeTeam.id === MANU_ROLE_ID ? -0.25 : 0;
  const aManuPenalty = awayTeam.id === MANU_ROLE_ID ? -0.25 : 0;

  function getPenaltyChance(taker) {
    const val = taker.value || extractValueFromNickname(taker.name) || 50;
    let base = 0.45;
    if (val >= 300) base = 0.78;
    else if (val >= 200) base = 0.70;
    else if (val >= 100) base = 0.63;
    else if (val >= 50) base = 0.55;
    const npcP = taker.isNpc ? -0.10 : 0;
    return Math.min(0.90, Math.max(0.15, base + npcP));
  }

  const shuffledH = [...homePlayers].sort(() => Math.random() - 0.5);
  const shuffledA = [...awayPlayers].sort(() => Math.random() - 0.5);
  const hTakers = shuffledH.slice(0, 5);
  const aTakers = shuffledA.slice(0, 5);

  for (let i = 0; i < 5; i++) {
    const hChance = getPenaltyChance(hTakers[i]) + hManuPenalty + hNpcPenalty;
    if (Math.random() < hChance) { hScore++; log.push({ team: 'home', taker: hTakers[i], scored: true, round: i + 1 }); }
    else log.push({ team: 'home', taker: hTakers[i], scored: false, round: i + 1 });

    const remaining = 5 - i;
    if (aScore > hScore + remaining) break;

    const aChance = getPenaltyChance(aTakers[i]) + aManuPenalty + aNpcPenalty;
    if (Math.random() < aChance) { aScore++; log.push({ team: 'away', taker: aTakers[i], scored: true, round: i + 1 }); }
    else log.push({ team: 'away', taker: aTakers[i], scored: false, round: i + 1 });
  }

  let round = 5;
  while (hScore === aScore && round < 10) {
    const extraH = hTakers[round] || { name: 'Oyuncu ' + (round + 1), isNpc: true, value: 30 };
    const extraA = aTakers[round] || { name: 'Oyuncu ' + (round + 1), isNpc: true, value: 30 };

    if (Math.random() < getPenaltyChance(extraH) - 0.05 + hManuPenalty) { hScore++; log.push({ team: 'home', taker: extraH, scored: true, round: round + 1 }); }
    else log.push({ team: 'home', taker: extraH, scored: false, round: round + 1 });

    if (hScore > aScore) { log.push({ team: 'away', taker: extraA, scored: false, round: round + 1, auto: true }); break; }

    if (Math.random() < getPenaltyChance(extraA) - 0.05 + aManuPenalty) { aScore++; log.push({ team: 'away', taker: extraA, scored: true, round: round + 1 }); }
    else log.push({ team: 'away', taker: extraA, scored: false, round: round + 1 });

    round++;
  }

  return { homeScore: hScore, awayScore: aScore, log, winner: hScore > aScore ? 'home' : 'away' };
}

function generateRoundRobin(teams) {
  const n = teams.length;
  if (n < 2 || n % 2 !== 0) return [];
  const list = [...teams];
  const rounds = [];
  const half = list.length / 2;
  for (let round = 0; round < list.length - 1; round++) {
    const matches = [];
    for (let i = 0; i < half; i++) {
      const home = list[i];
      const away = list[list.length - 1 - i];
      if (home && away) {
        matches.push({ home: { roleId: home.roleId, name: home.name, emoji: home.emoji }, away: { roleId: away.roleId, name: away.name, emoji: away.emoji }, played: false, result: null });
      }
    }
    rounds.push({ week: round + 1, matches });
    const last = list.pop();
    list.splice(1, 0, last);
  }
  return rounds;
}

function generate24WeekFixture(teams) {
  const n = teams.length;
  if (n < 2) return [];
  const allRounds = generateRoundRobin(teams);
  const allRoundsReversed = allRounds.map(r => ({
    week: 0,
    matches: r.matches.map(m => ({ home: { ...m.away }, away: { ...m.home }, played: false, result: null }))
  }));
  const combined = [...allRounds, ...allRoundsReversed];
  while (combined.length < 24) {
    const shuffled = [...teams].sort(() => Math.random() - 0.5);
    const matches = [];
    for (let i = 0; i < Math.floor(n / 2); i++) {
      matches.push({ home: { roleId: shuffled[i * 2].roleId, name: shuffled[i * 2].name, emoji: shuffled[i * 2].emoji }, away: { roleId: shuffled[i * 2 + 1].roleId, name: shuffled[i * 2 + 1].name, emoji: shuffled[i * 2 + 1].emoji }, played: false, result: null });
    }
    combined.push({ week: combined.length + 1, matches });
  }
  for (let i = combined.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }
  combined.forEach((r, idx) => r.week = idx + 1);
  return combined.slice(0, 24);
}

module.exports = { CUP_TEAMS, generateCupBracket, advanceCupWinner, runCupPenalties, generateRoundRobin, generate24WeekFixture };
