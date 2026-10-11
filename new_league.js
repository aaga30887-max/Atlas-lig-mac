// ════════════════════════════════════════════════════════════════════════
//  VOLDER LEAGUE OTOMATİK LİG SİSTEMİ — MODÜL
//  2 Lig (Üst/Alt) · 24 Takım · 46 Hafta · Otomatik Maç
// ════════════════════════════════════════════════════════════════════════

const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize } = require('discord.js');
const db = require('../database');
const config = require('../config');
const NEW_LEAGUE_DATA = require('../data/new_league_data');

function setupNewLeague() {
  const CV2 = config.cv2Flag;

  function initNewLeague() {
    const existing = db.getNewLeague();
    if (!existing) {
      db.saveNewLeague({
        ustLig: { standings: {}, topScorers: {}, playerNames: {}, yellowCards: {}, redCards: {}, suspensions: {} },
        altLig: { standings: {}, topScorers: {}, playerNames: {}, yellowCards: {}, redCards: {}, suspensions: {} }
      });
    }
    if (!db.getNewFixture()) db.saveNewFixture({ ustLig: null, altLig: null });
    if (!db.getNewWeek()) db.saveNewWeek({ ustLig: { week: 0, status: 'idle', currentMatch: 0 }, altLig: { week: 0, status: 'idle', currentMatch: 0 } });
  }

  function generateRoundRobin(teams) {
    const n = teams.length;
    const half = n / 2;
    const list = teams.map(t => ({ ...t }));
    const rounds = [];

    for (let round = 0; round < n - 1; round++) {
      const matches = [];
      for (let i = 0; i < half; i++) {
        matches.push({ home: list[i], away: list[n - 1 - i], played: false, homeScore: null, awayScore: null, events: [] });
      }
      rounds.push({ week: round + 1, matches });
      const last = list.pop();
      list.splice(1, 0, last);
    }

    const rounds2 = rounds.map(r => ({
      week: r.week + n - 1,
      matches: r.matches.map(m => ({ home: m.away, away: m.home, played: false, homeScore: null, awayScore: null, events: [] }))
    }));

    return [...rounds, ...rounds2];
  }

  function generateTeamPlayers(team, leagueKey) {
    const posNames = {
      STP: ['R.Silva', 'Bonucci', 'Gvardiol', 'Marquinhos', 'Koundé', 'Rudiger', 'Dias', 'Varane', 'Umtiti', 'Lenglet'],
      SĞB: ['A.Hakimi', 'Alexander-Arnold', 'Cancelo', 'Cuadrada', 'Kimmich', 'Wan-Bissaka', 'TAA'],
      SLB: ['Marcelo', 'Theo Hernández', 'Alba', 'A.Masuaku', 'Robertson', 'Chilwell', 'Davies'],
      DOS: ['Casemiro', 'Kanté', 'Rodri', 'Fred', 'Koke', 'Bentancur', 'Fabinho'],
      OS: ['Modric', 'De Bruyne', 'Bellingham', 'Gerrard', 'Trossard', 'Özil', 'İlkay', 'Wijnaldum'],
      OOS: ['Barella', 'Pedri', 'Gavi', 'Palmer', 'O.Dembele', 'Bruno', 'Ziyech', 'Mount'],
      SĞK: ['Salah', 'Mahrez', 'Estevao', 'S.Gerrard', 'E.Poku', 'Bernardo', 'Foden', 'Sane'],
      SLK: ['Mané', 'Vinicius', 'D.Doue', 'Raphinha', 'Ndombele', 'Coman', 'Grealish', 'Leao'],
      SNT: ['Haaland', 'Mbappé', 'Icardi', 'Lewandowski', 'Osimhen', 'R.Hojlund', 'Gyökeres', 'Kane', 'Benzema'],
      KL: ['Neuer', 'Courtois', 'Donnarumma', 'M.Endouno', 'D.Alemdar', 'Ter Stegen', 'Oblak', 'Maignan']
    };
    const positions = ['KL', 'STP', 'STP', 'SĞB', 'SLB', 'DOS', 'OS', 'OOS', 'SĞK', 'SLK', 'SNT'];
    const usedNames = new Set();
    const players = {};

    for (const pos of positions) {
      const pool = posNames[pos] || ['NPC'];
      const available = pool.filter(n => !usedNames.has(n));
      const name = available.length > 0 ? available[Math.floor(Math.random() * available.length)] : `${team.name}_${pos}`;
      usedNames.add(name);
      const playerValue = Math.floor(team.strength * (0.8 + Math.random() * 0.4));
      const playerId = `${leagueKey}_${team.name}_${pos}`;
      players[pos] = {
        id: playerId,
        name: `${name} | ${pos} | ${team.name}`,
        value: Math.min(500, Math.max(10, playerValue))
      };
    }

    return players;
  }

  function simulateMatch(homeTeam, awayTeam, homePlayers, awayPlayers) {
    const homeFieldPlayers = Object.values(homePlayers).filter(p => !p.name.includes('| KL |'));
    const awayFieldPlayers = Object.values(awayPlayers).filter(p => !p.name.includes('| KL |'));

    const homeAttack = homeFieldPlayers.filter(p => /SNT|SĞK|SLK|OOS/.test(p.name)).reduce((s, p) => s + p.value, 0) / 4;
    const awayAttack = awayFieldPlayers.filter(p => /SNT|SĞK|SLK|OOS/.test(p.name)).reduce((s, p) => s + p.value, 0) / 4;
    const homeDef = homeFieldPlayers.filter(p => /STP|SĞB|SLB|DOS/.test(p.name)).reduce((s, p) => s + p.value, 0) / 4;
    const awayDef = awayFieldPlayers.filter(p => /STP|SĞB|SLB|DOS/.test(p.name)).reduce((s, p) => s + p.value, 0) / 4;

    function calcGoals(attack, def, oppAttack, adv) {
      const base = 1.2;
      const attackBonus = (attack - 200) / 500;
      const defPenalty = (oppAttack - 200) / 800;
      const expected = base + attackBonus - defPenalty + adv;
      const lambda = Math.max(0.3, Math.min(4.0, expected));
      let goals = 0;
      let L = Math.exp(-lambda);
      let k = 0;
      let p = 1;
      do { k++; p *= Math.random(); } while (p > L);
      return k - 1;
    }

    let homeGoals = Math.max(0, Math.min(8, calcGoals(homeAttack, homeDef, awayAttack, 0.12)));
    let awayGoals = Math.max(0, Math.min(8, calcGoals(awayAttack, awayDef, homeAttack, 0)));

    const events = [];
    const usedMinutes = new Set();
    function randMinute() {
      let m;
      do { m = Math.floor(Math.random() * 90) + 1; } while (usedMinutes.has(m));
      usedMinutes.add(m);
      return m;
    }

    function pickScorer(players) {
      const atk = players.filter(p => /SNT|SĞK|SLK|OOS/.test(p.name));
      const pool = atk.length > 0 ? atk : players;
      return pool[Math.floor(Math.random() * pool.length)];
    }

    function pickAssist(players, scorerId) {
      const others = players.filter(p => p.id !== scorerId);
      if (Math.random() < 0.65 && others.length > 0) return others[Math.floor(Math.random() * others.length)];
      return null;
    }

    for (let i = 0; i < homeGoals; i++) {
      const scorer = pickScorer(homeFieldPlayers);
      const assist = pickAssist(homeFieldPlayers, scorer.id);
      events.push({ type: 'goal', team: 'home', scorer: scorer.name, scorerId: scorer.id, assist: assist ? assist.name : null, assistId: assist ? assist.id : null, minute: randMinute() });
    }

    for (let i = 0; i < awayGoals; i++) {
      const scorer = pickScorer(awayFieldPlayers);
      const assist = pickAssist(awayFieldPlayers, scorer.id);
      events.push({ type: 'goal', team: 'away', scorer: scorer.name, scorerId: scorer.id, assist: assist ? assist.name : null, assistId: assist ? assist.id : null, minute: randMinute() });
    }

    const allPlayers = [...homeFieldPlayers, ...awayFieldPlayers];
    for (const p of allPlayers) {
      if (Math.random() < 0.18) {
        events.push({ type: 'yellow', team: p.id.includes(homeTeam.name) ? 'home' : 'away', player: p.name, playerId: p.id, minute: randMinute() });
      }
      if (Math.random() < 0.025) {
        events.push({ type: 'red', team: p.id.includes(homeTeam.name) ? 'home' : 'away', player: p.name, playerId: p.id, minute: randMinute() });
      }
    }

    events.sort((a, b) => a.minute - b.minute);
    return { homeGoals, awayGoals, events };
  }

  function updateNewStandings(leagueKey, simResult, homeTeam, awayTeam) {
    const data = db.getNewLeague();
    if (!data[leagueKey]) data[leagueKey] = { standings: {}, topScorers: {}, playerNames: {}, yellowCards: {}, redCards: {}, suspensions: {} };
    const standings = data[leagueKey].standings;

    if (!standings[homeTeam.name]) standings[homeTeam.name] = { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0, form: [] };
    if (!standings[awayTeam.name]) standings[awayTeam.name] = { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0, form: [] };

    const h = standings[homeTeam.name];
    const a = standings[awayTeam.name];

    h.played++; a.played++;
    h.gf += simResult.homeGoals; h.ga += simResult.awayGoals;
    a.gf += simResult.awayGoals; a.ga += simResult.homeGoals;

    if (simResult.homeGoals > simResult.awayGoals) { h.won++; h.points += 3; h.form.push('G'); a.lost++; a.form.push('M'); }
    else if (simResult.homeGoals < simResult.awayGoals) { a.won++; a.points += 3; a.form.push('G'); h.lost++; h.form.push('M'); }
    else { h.drawn++; h.points++; h.form.push('B'); a.drawn++; a.points++; a.form.push('B'); }

    if (h.form.length > 5) h.form = h.form.slice(-5);
    if (a.form.length > 5) a.form = a.form.slice(-5);

    for (const ev of simResult.events) {
      if (ev.type === 'goal') {
        if (!data[leagueKey].topScorers[ev.scorerId]) data[leagueKey].topScorers[ev.scorerId] = { goals: 0, assists: 0 };
        data[leagueKey].topScorers[ev.scorerId].goals++;
        data[leagueKey].playerNames[ev.scorerId] = ev.scorer;
        if (ev.assistId) {
          if (!data[leagueKey].topScorers[ev.assistId]) data[leagueKey].topScorers[ev.assistId] = { goals: 0, assists: 0 };
          data[leagueKey].topScorers[ev.assistId].assists++;
          data[leagueKey].playerNames[ev.assistId] = ev.assist;
        }
      }
      if (ev.type === 'yellow') {
        if (!data[leagueKey].yellowCards[ev.playerId]) data[leagueKey].yellowCards[ev.playerId] = 0;
        data[leagueKey].yellowCards[ev.playerId]++;
        data[leagueKey].playerNames[ev.playerId] = ev.player;
      }
      if (ev.type === 'red') {
        if (!data[leagueKey].redCards[ev.playerId]) data[leagueKey].redCards[ev.playerId] = 0;
        data[leagueKey].redCards[ev.playerId]++;
        data[leagueKey].playerNames[ev.playerId] = ev.player;
      }
    }

    db.saveNewLeague(data);
  }

  function checkSuspensions(leagueKey) {
    const data = db.getNewLeague();
    const league = data[leagueKey];
    const suspensions = league.suspensions || {};

    for (const [pid, yellows] of Object.entries(league.yellowCards || {})) {
      if (yellows >= 3 && !suspensions[pid]) {
        suspensions[pid] = { matches: 1, reason: '3 sarı kart', from: league.playerNames[pid] };
        league.yellowCards[pid] = 0;
      }
    }
    for (const [pid, reds] of Object.entries(league.redCards || {})) {
      if (reds > 0 && !suspensions[pid]) {
        suspensions[pid] = { matches: 2, reason: 'Kırmızı kart', from: league.playerNames[pid] };
        league.redCards[pid] = 0;
      }
    }
    for (const [pid, susp] of Object.entries(suspensions)) {
      susp.matches--;
      if (susp.matches <= 0) delete suspensions[pid];
    }

    league.suspensions = suspensions;
    db.saveNewLeague(data);
  }

  function buildWeekResultText(leagueKey, weekNum, results) {
    const leagueName = leagueKey === 'ustLig' ? '🏆 SÜPER LİG' : '⚔️ 1. LİG';
    let text = `# ${leagueName} — HAFTA ${weekNum}\n\n`;

    for (const r of results) {
      text += `**${r.home.emoji} ${r.home.name} ${r.match.homeGoals} - ${r.match.awayGoals} ${r.away.name}** ${r.away.emoji}\n`;
      for (const e of r.match.events.filter(e => e.type === 'goal')) {
        text += `> ⚽ ${e.minute}' ${e.scorer.split('|')[0].trim()}${e.assist ? ` (asist: ${e.assist.split('|')[0].trim()})` : ''}\n`;
      }
      for (const e of r.match.events.filter(e => e.type === 'yellow')) {
        text += `> 🟨 ${e.minute}' ${e.player.split('|')[0].trim()}\n`;
      }
      for (const e of r.match.events.filter(e => e.type === 'red')) {
        text += `> 🟥 ${e.minute}' ${e.player.split('|')[0].trim()}\n`;
      }
      text += '\n';
    }
    return text;
  }

  function buildStandingsText(leagueKey, leagueData) {
    const leagueName = leagueKey === 'ustLig' ? '🏆 SÜPER LİG' : '⚔️ 1. LİG';
    const sorted = Object.entries(leagueData.standings)
      .map(([name, s]) => ({ name, ...s, gd: s.gf - s.ga }))
      .sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);

    let text = `# ${leagueName} — PUAN DURUMU\n\n`;
    sorted.forEach((t, i) => {
      const form = t.form ? t.form.map(f => f === 'G' ? '🟢' : f === 'M' ? '🔴' : '🟡').join('') : '';
      const rank = i + 1;
      const zone = rank <= 3 ? '🟢' : rank >= 22 ? '🔴' : '  ';
      text += `**${rank}.** ${zone} **${t.name}** — O:${t.played} G:${t.won} B:${t.drawn} M:${t.lost} AG:${t.gf} YG:${t.ga} AV:${t.gd > 0 ? '+' : ''}${t.gd} **P:${t.points}** ${form}\n`;
    });

    text += `\n🟢 İlk 3: Şampiyonluk | 🔴 Son 3: Düşme tehlikesi`;
    return text;
  }

  function buildStatsText(leagueKey, leagueData) {
    const leagueName = leagueKey === 'ustLig' ? '🏆 SÜPER LİG' : '⚔️ 1. LİG';
    const scorers = Object.entries(leagueData.topScorers || {})
      .map(([id, d]) => ({ id, name: leagueData.playerNames[id] || id, goals: d.goals || 0, assists: d.assists || 0 }))
      .sort((a, b) => b.goals - a.goals || b.assists - a.assists).slice(0, 10);

    const assisters = Object.entries(leagueData.topScorers || {})
      .map(([id, d]) => ({ id, name: leagueData.playerNames[id] || id, goals: d.goals || 0, assists: d.assists || 0 }))
      .sort((a, b) => b.assists - a.assists || b.goals - a.goals).slice(0, 10);

    let text = `# ${leagueName} — İSTATİSTİKLER\n\n### ⚽ Gol Krallığı\n`;
    scorers.forEach((p, i) => { text += `**${i + 1}.** ${p.name.split('|')[0].trim()} — **${p.goals}** gol ${p.assists > 0 ? `(${p.assists} asist)` : ''}\n`; });
    text += `\n### 🅰️ Asist Krallığı\n`;
    assisters.forEach((p, i) => { text += `**${i + 1}.** ${p.name.split('|')[0].trim()} — **${p.assists}** asist ${p.goals > 0 ? `(${p.goals} gol)` : ''}\n`; });
    return text;
  }

  async function playWeek(client, leagueKey) {
    const fixture = db.getNewFixture();
    const weekData = db.getNewWeek();
    const leagueConfig = NEW_LEAGUE_DATA[leagueKey === 'ustLig' ? 'ustLig' : 'altLig'];
    const weekInfo = weekData[leagueKey];

    const currentWeek = weekInfo.week;
    if (currentWeek < 1 || currentWeek > 46) return;

    const round = fixture[leagueKey].find(r => r.week === currentWeek);
    if (!round) return;

    const channelId = leagueConfig.channelId;
    if (!channelId) { console.log(`[HATA] ${leagueKey} kanal ID ayarlanmamış!`); return; }
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) { console.log(`[HATA] ${leagueKey} kanalı bulunamadı!`); return; }

    const results = [];

    for (const match of round.matches) {
      if (match.played) continue;

      const homePlayers = generateTeamPlayers(match.home, leagueKey);
      const awayPlayers = generateTeamPlayers(match.away, leagueKey);
      const simResult = simulateMatch(match.home, match.away, homePlayers, awayPlayers);

      match.played = true;
      match.homeScore = simResult.homeGoals;
      match.awayScore = simResult.awayGoals;
      match.events = simResult.events;

      updateNewStandings(leagueKey, simResult, match.home, match.away);
      results.push({ home: match.home, away: match.away, match: simResult });
    }

    weekInfo.status = 'finished';
    db.saveNewFixture(fixture);
    db.saveNewWeek(weekData);

    const resultText = buildWeekResultText(leagueKey, currentWeek, results);
    const chunks = resultText.match(/[\s\S]{1,1900}/g) || [resultText];
    for (const chunk of chunks) {
      const c = new ContainerBuilder().setAccentColor(leagueKey === 'ustLig' ? 0x1a5276 : 0x7d3c98)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(chunk));
      await channel.send({ components: [c], flags: CV2 }).catch(() => {});
      await new Promise(r => setTimeout(r, 1500));
    }

    checkSuspensions(leagueKey);

    if (leagueConfig.standingsChannelId) {
      const sCh = await client.channels.fetch(leagueConfig.standingsChannelId).catch(() => null);
      if (sCh) {
        const sText = buildStandingsText(leagueKey, db.getNewLeague()[leagueKey]);
        const sChunks = sText.match(/[\s\S]{1,1900}/g) || [sText];
        for (const chunk of sChunks) {
          const c = new ContainerBuilder().setAccentColor(0x2c3e50)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(chunk));
          await sCh.send({ components: [c], flags: CV2 }).catch(() => {});
        }
      }
    }

    if (leagueConfig.statsChannelId) {
      const stCh = await client.channels.fetch(leagueConfig.statsChannelId).catch(() => null);
      if (stCh) {
        const stText = buildStatsText(leagueKey, db.getNewLeague()[leagueKey]);
        const c = new ContainerBuilder().setAccentColor(0x1a1a2e)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(stText));
        await stCh.send({ components: [c], flags: CV2 }).catch(() => {});
      }
    }

    if (currentWeek < 46) {
      weekInfo.week = currentWeek + 1;
      weekInfo.status = 'idle';
      db.saveNewWeek(weekData);
      await new Promise(r => setTimeout(r, 3000));
      await playWeek(client, leagueKey);
    } else {
      weekInfo.status = 'completed';
      db.saveNewWeek(weekData);
      const c = new ContainerBuilder().setAccentColor(0xFFD700)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
          `# 🏆 ${leagueKey === 'ustLig' ? 'SÜPER LİG' : '1. LİG'} SEZONU TAMAMLANDI!\n\n` +
          `> 🎉 Tebrikler!\n` +
          (leagueKey === 'altLig' ? `\n> 📈 İlk 3 takım Süper Lig'e yükseliyor!` : `\n> 📉 Son 3 takım 1. Lig'e düşüyor!`)
        ));
      await channel.send({ components: [c], flags: CV2 }).catch(() => {});
    }
  }

  async function cmdNewLig(message, args) {
    const sub = (args[0] || '').toLowerCase();

    if (sub === 'kur') {
      if (!message.member.permissions.has('Administrator')) return message.reply('Yalnizca yoneticiler.');
      initNewLeague();

      const fixture = {
        ustLig: generateRoundRobin(NEW_LEAGUE_DATA.ustLig.teams),
        altLig: generateRoundRobin(NEW_LEAGUE_DATA.altLig.teams)
      };
      db.saveNewFixture(fixture);
      db.saveNewWeek({ ustLig: { week: 1, status: 'idle', currentMatch: 0 }, altLig: { week: 1, status: 'idle', currentMatch: 0 } });

      for (const lk of ['ustLig', 'altLig']) {
        const d = db.getNewLeague();
        const st = {};
        for (const t of NEW_LEAGUE_DATA[lk].teams) {
          st[t.name] = { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0, form: [] };
        }
        d[lk].standings = st;
        db.saveNewLeague(d);
      }

      const c = new ContainerBuilder().setAccentColor(0xFFD700)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
          `# ✅ VOLDER LIG KURULDU!\n\n` +
          `**Süper Lig:** ${NEW_LEAGUE_DATA.ustLig.teams.length} takim, 46 hafta\n` +
          `**1. Lig:** ${NEW_LEAGUE_DATA.altLig.teams.length} takim, 46 hafta\n\n` +
          `> \`!yenilig kanal ust mac <ID>\` ile kanal ayarla\n` +
          `> \`!yenilig baslat\` ile sezonu baslat`
        ));
      return message.channel.send({ components: [c], flags: CV2 });
    }

    if (sub === 'kanal') {
      if (!message.member.permissions.has('Administrator')) return message.reply('Yalnizca yoneticiler.');
      const lig = (args[1] || '').toLowerCase();
      const tur = (args[2] || '').toLowerCase();
      const kid = args[3];

      if (!lig || !['ust', 'alt'].includes(lig) || !kid) {
        return message.reply('Kullanim: `!yenilig kanal <ust/alt> <mac/puan/istatistik> <ID>`');
      }

      const cfg = NEW_LEAGUE_DATA[lig === 'ust' ? 'ustLig' : 'altLig'];
      if (tur === 'mac') cfg.channelId = kid;
      else if (tur === 'puan') cfg.standingsChannelId = kid;
      else if (tur === 'istatistik') cfg.statsChannelId = kid;
      else return message.reply('Kanal turu: `mac`, `puan`, `istatistik`');

      return message.reply(`✅ ${lig.toUpperCase()} lig ${tur} kanali ayarlandi: <#${kid}>`);
    }

    if (sub === 'baslat') {
      if (!message.member.permissions.has('Administrator')) return message.reply('Yalnizca yoneticiler.');
      if (!NEW_LEAGUE_DATA.ustLig.channelId || !NEW_LEAGUE_DATA.altLig.channelId) {
        return message.reply('Once kanalari ayarlayin: `!yenilig kanal ust mac ID`');
      }

      await message.reply('Sezon basliyor! Maclar otomatik oynanacak...');
      playWeek(message.client, 'ustLig').catch(e => console.error('[UST LIG HATA]', e));
      playWeek(message.client, 'altLig').catch(e => console.error('[ALT LIG HATA]', e));
      return;
    }

    if (sub === 'puan') {
      const lig = (args[1] || '').toLowerCase();
      const lk = lig === 'ust' ? 'ustLig' : 'altLig';
      const d = db.getNewLeague();
      const text = buildStandingsText(lk, d[lk]);
      const c = new ContainerBuilder().setAccentColor(0x2c3e50)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
      return message.channel.send({ components: [c], flags: CV2 });
    }

    if (sub === 'istatistik' || sub === 'stats') {
      const lig = (args[1] || '').toLowerCase();
      const lk = lig === 'ust' ? 'ustLig' : 'altLig';
      const d = db.getNewLeague();
      const text = buildStatsText(lk, d[lk]);
      const c = new ContainerBuilder().setAccentColor(0x1a1a2e)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
      return message.channel.send({ components: [c], flags: CV2 });
    }

    return message.reply(
      '**VOLDER LIG Komutlari:**\n' +
      '`!yenilig kur` — Ligi kur (48 takim)\n' +
      '`!yenilig kanal <ust/alt> <mac/puan/istatistik> <ID>` — Kanal ayarla\n' +
      '`!yenilig baslat` — Sezonu baslat (otomatik)\n' +
      '`!yenilig puan <ust/alt>` — Puan durumu\n' +
      '`!yenilig istatistik <ust/alt>` — Gol/Asist kralligi'
    );
  }

  return { cmdNewLig, initNewLeague, generateRoundRobin, simulateMatch, playWeek };
}

module.exports = setupNewLeague;
