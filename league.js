// ════════════════════════════════════════════════════════════════════════
//  VOLDER LİG — Puan Durumu & İstatistik Güncelleme
// ════════════════════════════════════════════════════════════════════════

const db = require('../database');

function saveMatchHistoryEntry(match, maxLen = 50) {
  const entry = {
    id: Date.now(),
    date: new Date().toLocaleDateString('tr-TR'),
    home: match.teams.home.name,
    away: match.teams.away.name,
    scoreHome: match.score.home,
    scoreAway: match.score.away,
    goals: match.goals.map(g => ({ team: g.team, scorer: g.scorer, scorerId: g.scorerId || null, minute: g.minute, assist: g.assist, assistId: g.assistId || null })),
    cards: match.cards,
    penalties: match.penaltyWinner || null,
    stats: { home: match.stats.home, away: match.stats.away }
  };
  db.saveMatchHistory(entry, maxLen);
}

function updateLeagueStats(match) {
  const data = db.getLeague();
  if (!data.teams) data.teams = {};
  if (!data.topScorers) data.topScorers = {};
  if (!data.bestGK) data.bestGK = {};
  if (!data.playerNames) data.playerNames = {};

  for (const side of ['home', 'away']) {
    const team = match.teams[side];
    const teamName = team.name;
    if (!data.teams[teamName]) data.teams[teamName] = { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0, form: [] };
    data.teams[teamName].played++;
    data.teams[teamName].gf += match.score[side];
    data.teams[teamName].ga += match.score[side === 'home' ? 'away' : 'home'];
  }

  if (match.score.home > match.score.away) {
    data.teams[match.teams.home.name].won++;
    data.teams[match.teams.home.name].points += 3;
    data.teams[match.teams.home.name].form.push('G');
    data.teams[match.teams.away.name].lost++;
    data.teams[match.teams.away.name].form.push('M');
  } else if (match.score.away > match.score.home) {
    data.teams[match.teams.away.name].won++;
    data.teams[match.teams.away.name].points += 3;
    data.teams[match.teams.away.name].form.push('G');
    data.teams[match.teams.home.name].lost++;
    data.teams[match.teams.home.name].form.push('M');
  } else {
    data.teams[match.teams.home.name].drawn++;
    data.teams[match.teams.home.name].points += 1;
    data.teams[match.teams.home.name].form.push('B');
    data.teams[match.teams.away.name].drawn++;
    data.teams[match.teams.away.name].points += 1;
    data.teams[match.teams.away.name].form.push('B');
  }

  for (const side of ['home', 'away']) {
    if (data.teams[match.teams[side].name].form.length > 5) {
      data.teams[match.teams[side].name].form = data.teams[match.teams[side].name].form.slice(-5);
    }
  }

  for (const goal of match.goals) {
    const scorer = goal.scorer;
    const scorerId = goal.scorerId;
    if (!scorer || scorer.startsWith('🤖') || !scorerId) continue;
    if (!data.topScorers[scorerId]) data.topScorers[scorerId] = { goals: 0, assists: 0 };
    data.topScorers[scorerId].goals++;
    data.playerNames[scorerId] = scorer;
    if (goal.assist && goal.assistId && !goal.assist.startsWith('🤖')) {
      if (!data.topScorers[goal.assistId]) data.topScorers[goal.assistId] = { goals: 0, assists: 0 };
      data.topScorers[goal.assistId].assists++;
      data.playerNames[goal.assistId] = goal.assist;
    }
  }

  for (const side of ['home', 'away']) {
    const kl = match.teams[side].lineup['KL'];
    if (kl && !kl.isNpc && kl.id) {
      if (!data.bestGK[kl.id]) data.bestGK[kl.id] = { saves: 0, cleanSheets: 0 };
      data.bestGK[kl.id].saves += (match.stats[side].saves || 0);
      data.playerNames[kl.id] = kl.name;
      if (match.score[side === 'home' ? 'away' : 'home'] === 0) data.bestGK[kl.id].cleanSheets++;
    }
  }

  db.saveLeague(data);
}

module.exports = { saveMatchHistoryEntry, updateLeagueStats };
