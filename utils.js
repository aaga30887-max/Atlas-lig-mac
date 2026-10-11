// ════════════════════════════════════════════════════════════════════════
//  VOLDER MAC BOT — Yardımcı Fonksiyonlar
// ════════════════════════════════════════════════════════════════════════

const { FORMATIONS, TEAM_EMOJI_MAP } = require('./constants');

function roll(options) { return options[Math.floor(Math.random() * options.length)]; }

function extractValueFromNickname(displayName) {
  if (!displayName) return 50;
  const m = displayName.match(/(\d+)/);
  if (!m) return 50;
  return Math.max(1, Math.min(500, parseInt(m[1], 10)));
}

function getPlayerBonuses(playerValue) {
  if (playerValue >= 300) return { pass: 0.12, shot: 0.10, tackle: 0.10, gk: 0.15, dribble: 0.08, pressRes: 0.10 };
  if (playerValue >= 200) return { pass: 0.08, shot: 0.07, tackle: 0.07, gk: 0.10, dribble: 0.05, pressRes: 0.07 };
  if (playerValue >= 50)  return { pass: 0.03, shot: 0.02, tackle: 0.03, gk: 0.04, dribble: 0.02, pressRes: 0.03 };
  return { pass: 0, shot: 0, tackle: 0, gk: 0, dribble: 0, pressRes: 0 };
}

function getTeamAvgValue(team) {
  const all = Object.values(team.lineup).filter(p => p && !p.isNpc);
  if (all.length === 0) return 100;
  let sum = 0;
  for (const p of all) sum += (p.value || extractValueFromNickname(p.name));
  return sum / all.length;
}

function getTeamLevelBonus(avgVal) {
  if (avgVal >= 300) return { pass: 0.08, shot: 0.08, tackle: 0.08, gk: 0.08, dribble: 0.06, pressRes: 0.06 };
  if (avgVal >= 200) return { pass: 0.04, shot: 0.04, tackle: 0.04, gk: 0.04, dribble: 0.03, pressRes: 0.03 };
  if (avgVal >= 100) return { pass: 0.01, shot: 0.01, tackle: 0.01, gk: 0.01, dribble: 0.01, pressRes: 0.01 };
  return { pass: 0.005, shot: 0.005, tackle: 0.005, gk: 0.005, dribble: 0.005, pressRes: 0.005 };
}

function getTeamBonuses(team, manuRoleId, fenerRoleId) {
  const allPlayers = Object.values(team.lineup).filter(p => p);
  const fp = Object.values(team.lineup).filter(p => p && !p.isNpc && p.mainPos !== 'KL');
  const npcCount = allPlayers.filter(p => p.isNpc).length;
  if (fp.length === 0) return { pass: -0.10, shot: -0.10, tackle: -0.10, gk: -0.10, dribble: -0.10, pressRes: -0.10 };
  let tP = 0, tS = 0, tT = 0, tD = 0, tR = 0;
  for (const p of fp) {
    const b = getPlayerBonuses(p.value || extractValueFromNickname(p.name));
    tP += b.pass; tS += b.shot; tT += b.tackle; tD += b.dribble; tR += b.pressRes;
  }
  const n = fp.length;
  const avg = getTeamAvgValue(team);
  const tlb = getTeamLevelBonus(avg);
  const fenerBonus = team.id === fenerRoleId ? 0.06 : 0;
  const manuPenalty = team.id === manuRoleId ? -0.15 : 0;
  const npcPenalty = npcCount >= 9 ? -0.12 : npcCount >= 7 ? -0.08 : npcCount >= 5 ? -0.04 : 0;
  return {
    pass: tP/n + tlb.pass + fenerBonus + manuPenalty + npcPenalty,
    shot: tS/n + tlb.shot + fenerBonus + manuPenalty + npcPenalty,
    tackle: tT/n + tlb.tackle + fenerBonus + manuPenalty + npcPenalty,
    gk: 0,
    dribble: tD/n + tlb.dribble + fenerBonus + manuPenalty + npcPenalty,
    pressRes: tR/n + tlb.pressRes + fenerBonus + manuPenalty + npcPenalty
  };
}

function getGKBonuses(team) {
  const kl = team.lineup['KL'];
  if (!kl) return 0;
  const avg = getTeamAvgValue(team);
  const tlb = getTeamLevelBonus(avg);
  return getPlayerBonuses(kl.value || extractValueFromNickname(kl.name)).gk + tlb.gk;
}

function posTackleBonus(mainPos) {
  const map = { STP: 0.14, SĞB: 0.12, SLB: 0.12, OS: 0.10, OOS: 0.02, SNT: -0.10, SĞKNT: -0.06, SLKNT: -0.06, KL: 0.05 };
  return map[mainPos] || 0;
}

function posDribbleBonus(mainPos) {
  const map = { STP: -0.08, SĞB: 0.02, SLB: 0.02, OS: 0.10, OOS: 0.15, SNT: 0.12, SĞKNT: 0.14, SLKNT: 0.14, KL: -0.20 };
  return map[mainPos] || 0;
}

function createEmptyLineup(formation) {
  const lineup = {};
  const f = FORMATIONS[formation];
  if (!f) return lineup;
  for (const [pos, count] of Object.entries(f.positions)) {
    if (count === 1) {
      lineup[pos] = { isNpc: true, value: 1, id: null, name: 'NPC', mainPos: pos };
    } else {
      for (let i = 1; i <= count; i++) {
        lineup[`${pos}${i}`] = { isNpc: true, value: 1, id: null, name: 'NPC', mainPos: pos };
      }
    }
  }
  return lineup;
}

function getPositionKeys(formation) {
  const f = FORMATIONS[formation];
  if (!f) return ['KL'];
  const keys = ['KL'];
  for (const [pos, count] of Object.entries(f.positions)) {
    if (pos === 'KL') continue;
    if (count === 1) keys.push(pos);
    else for (let i = 1; i <= count; i++) keys.push(`${pos}${i}`);
  }
  return keys;
}

function getRandomPlayerName(team) {
  const entries = Object.entries(team.lineup);
  const real = entries.filter(([, p]) => p && !p.isNpc && p.name && p.name !== 'NPC');
  if (real.length > 0) return roll(real)[1].name;
  const npcs = entries.filter(([, p]) => p && p.isNpc);
  if (npcs.length > 0) { const [key] = roll(npcs); return `🤖 NPC(${key})`; }
  return '🤖 NPC';
}

function getRandomFieldPlayer(team, excludeName) {
  const entries = Object.entries(team.lineup);
  let pool = entries.filter(([, p]) =>
    p && !p.isNpc && p.name && p.name !== 'NPC' && p.mainPos !== 'KL' && (!excludeName || p.name !== excludeName)
  );
  if (pool.length === 0) {
    const npcField = entries.filter(([, p]) => p && p.isNpc && p.mainPos !== 'KL');
    if (npcField.length > 0) { const [key] = roll(npcField); return `🤖 NPC(${key})`; }
    return '🤖 NPC';
  }
  const weights = pool.map(([, p]) => {
    const pos = p.mainPos;
    if (pos === 'SNT') return 4;
    if (pos === 'OOS' || pos === 'OS') return 3;
    if (pos === 'SĞKNT' || pos === 'SLKNT') return 3;
    return 2;
  });
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let rand = Math.random() * totalWeight;
  for (let i = 0; i < pool.length; i++) {
    rand -= weights[i];
    if (rand <= 0) return pool[i][1].name;
  }
  return pool[0][1].name;
}

function getKLPlayerName(team) {
  const kl = team.lineup['KL'];
  if (kl && !kl.isNpc && kl.name && kl.name !== 'NPC') return kl.name;
  return '🤖 NPC(KL)';
}

function getSNTPlayerName(team) {
  const entries = Object.entries(team.lineup);
  const sntEntries = entries.filter(([key]) => key.startsWith('SNT'));
  if (sntEntries.length > 0) {
    const [key, p] = roll(sntEntries);
    if (p && !p.isNpc && p.name && p.name !== 'NPC') return p.name;
    return `🤖 NPC(${key})`;
  }
  return getRandomFieldPlayer(team, null);
}

function formatPlayer(playerOrId) {
  if (!playerOrId) return '`Boş`';
  if (playerOrId.isNpc) return '🤖 NPC';
  return `<@${playerOrId.id}>`;
}

function formatTackles(tackles) {
  if (!Array.isArray(tackles) || tackles.length === 0) return '0';
  const counts = {};
  for (const name of tackles) counts[name] = (counts[name] || 0) + 1;
  return Object.entries(counts).map(([n, c]) => `**${n}** (${c})`).join(', ');
}

function fieldPos(meter, currentTeamName, oppTeamName) {
  if (meter <= 45) return `📍 **${oppTeamName} Sahasında** ${meter}m`;
  return `📍 **${currentTeamName} Sahasında** ${90 - meter}m`;
}

function getTeamEmojiByName(teamName) {
  return TEAM_EMOJI_MAP[teamName] || '';
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function applySavedLineup(teamData, saved) {
  if (!saved) return;
  teamData.formation = saved.formation || teamData.formation;
  if (saved.lineup) {
    for (const [pos, player] of Object.entries(saved.lineup)) {
      if (player && teamData.lineup[pos] !== undefined) {
        const memberExists = teamData.members.some(m => m.id === player.id);
        if (memberExists || player.isNpc) {
          teamData.lineup[pos] = player;
        }
      }
    }
  }
  if (saved.roles) {
    teamData.roles = { ...teamData.roles, ...saved.roles };
  }
}

module.exports = {
  roll, extractValueFromNickname, getPlayerBonuses, getTeamAvgValue, getTeamLevelBonus,
  getTeamBonuses, getGKBonuses, posTackleBonus, posDribbleBonus,
  createEmptyLineup, getPositionKeys,
  getRandomPlayerName, getRandomFieldPlayer, getKLPlayerName, getSNTPlayerName,
  formatPlayer, formatTackles, fieldPos, getTeamEmojiByName, sleep, applySavedLineup
};
