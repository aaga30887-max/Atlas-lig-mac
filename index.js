// ════════════════════════════════════════════════════════════════════════
//  VOLDER MAC BOT v3 — Ana Giriş Noktası
//  Node.js + discord.js v14 + puppeteer + JSON Database
// ════════════════════════════════════════════════════════════════════════

const {
  Client, GatewayIntentBits, Events,
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
  AttachmentBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle
} = require('discord.js');

const config = require('./config');
const db = require('./database');
const constants = require('./constants');
const utils = require('./utils');
const renderer = require('./renderer');
const cupSystem = require('./systems/cup');
const leagueSystem = require('./systems/league');
const awardsSystem = require('./systems/awards');
const setupNewLeague = require('./systems/new_league');

// ════════════════════════════════════════════════════════════════════════
//  Client
// ════════════════════════════════════════════════════════════════════════
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

const CV2 = config.cv2Flag;
const PREFIX = config.prefix;
const SPECIAL_GK_ID = config.specialGkId;
const { FORMATIONS, PLAY_STYLES, EMOJIS, CUP_TEAMS, MANU_ROLE_ID, FENER_ROLE_ID, PENALTY_RESULTS, TEAM_EMOJI_MAP } = constants;
const E = EMOJIS;

// ════════════════════════════════════════════════════════════════════════
//  New League Setup
// ════════════════════════════════════════════════════════════════════════
const newLeague = setupNewLeague();
const { cmdNewLig } = newLeague;

// ════════════════════════════════════════════════════════════════════════
//  Match Engine — Helper Functions
// ════════════════════════════════════════════════════════════════════════

function calcMinute(match) {
  if (!match.halfStartedAt) return match.minute || 0;
  const elapsedSeconds = (Date.now() - match.halfStartedAt) / 1000;
  const elapsedGameMinutes = Math.floor(elapsedSeconds / config.secondsPerGameMinute);
  const isCupMatch = match.cupMatch;
  const halfTime = isCupMatch ? 60 : 45;
  const maxMinutes = isCupMatch ? 120 : 90;
  const base = match.status === 'second_half' ? halfTime : 0;
  const cap = match.status === 'second_half' ? maxMinutes : halfTime;
  return Math.min(base + elapsedGameMinutes, cap);
}

function getMinuteStr(match) {
  const isCupMatch = match.cupMatch;
  const halfTime = isCupMatch ? 60 : 45;
  const maxMinutes = isCupMatch ? 120 : 90;
  if (match.minute > halfTime && match.status === 'first_half') return `${halfTime}+${match.minute - halfTime}`;
  if (match.minute > maxMinutes && match.status === 'second_half') return `${maxMinutes}+${match.minute - maxMinutes}`;
  return `${match.minute}`;
}

function calculateRatings(match) {
  const ratings = { home: {}, away: {} };
  for (const goal of match.goals) {
    const side = goal.team;
    if (!ratings[side][goal.scorer]) ratings[side][goal.scorer] = 6.0;
    ratings[side][goal.scorer] += 1.5;
    if (goal.assist) {
      if (!ratings[side][goal.assist]) ratings[side][goal.assist] = 6.0;
      ratings[side][goal.assist] += 0.7;
    }
  }
  for (const card of match.cards) {
    for (const s of ['home', 'away']) {
      if (ratings[s][card.player]) {
        ratings[s][card.player] -= card.type === 'kırmızı' ? 2.5 : 0.8;
      }
    }
  }
  const homePlayers = Object.values(match.teams.home.lineup).filter(p => p && !p.isNpc);
  const awayPlayers = Object.values(match.teams.away.lineup).filter(p => p && !p.isNpc);
  for (const p of homePlayers) {
    if (!ratings.home[p.name]) ratings.home[p.name] = 6.0 + (Math.random() * 1.0 - 0.5);
    ratings.home[p.name] = Math.min(10, Math.max(1, Math.round(ratings.home[p.name] * 10) / 10));
  }
  for (const p of awayPlayers) {
    if (!ratings.away[p.name]) ratings.away[p.name] = 6.0 + (Math.random() * 1.0 - 0.5);
    ratings.away[p.name] = Math.min(10, Math.max(1, Math.round(ratings.away[p.name] * 10) / 10));
  }
  const gkHome = match.teams.home.lineup['KL'];
  const gkAway = match.teams.away.lineup['KL'];
  if (gkHome && !gkHome.isNpc) {
    ratings.home[gkHome.name] = (match.stats.home.saves || 0) >= 5 ? 8.5 : (match.stats.home.saves || 0) >= 3 ? 7.5 : 6.5;
    if (gkHome.id === SPECIAL_GK_ID) ratings.home[gkHome.name] += 0.5;
  }
  if (gkAway && !gkAway.isNpc) {
    ratings.away[gkAway.name] = (match.stats.away.saves || 0) >= 5 ? 8.5 : (match.stats.away.saves || 0) >= 3 ? 7.5 : 6.5;
    if (gkAway.id === SPECIAL_GK_ID) ratings.away[gkAway.name] += 0.5;
  }
  return ratings;
}

function getMatchMVP(ratings) {
  let best = null, bestRating = 0;
  for (const side of ['home', 'away']) {
    for (const [name, rating] of Object.entries(ratings[side])) {
      if (rating > bestRating) { bestRating = rating; best = { name, rating, side }; }
    }
  }
  return best;
}

function findScorerId(team, scorerName) {
  if (!scorerName || scorerName.startsWith('🤖')) return null;
  for (const [pos, player] of Object.entries(team.lineup)) {
    if (player && !player.isNpc && player.name === scorerName) return player.id;
  }
  return null;
}

function findPlayerIdByName(team, name) {
  if (!name || name.startsWith('🤖')) return null;
  for (const [, player] of Object.entries(team.lineup)) {
    if (player && !player.isNpc && player.name === name) return player.id;
  }
  return null;
}

function replacePlayerWithNpc(team, playerName) {
  if (!playerName || typeof playerName !== 'string') return;
  if (playerName.startsWith('🤖')) return;
  for (const [pos, player] of Object.entries(team.lineup)) {
    if (player && !player.isNpc && player.name === playerName) {
      team.lineup[pos] = { isNpc: true, value: 1, id: null, name: 'NPC', mainPos: pos };
      break;
    }
  }
}

// ════════════════════════════════════════════════════════════════════════
//  Match Engine — Event Generation
// ════════════════════════════════════════════════════════════════════════

function generateAutoEventLogic(match) {
  const home = match.teams.home;
  const away = match.teams.away;
  const possSide = match.possession.teamId === home.id ? 'home' : 'away';
  const possTeam = possSide === 'home' ? home : away;
  const oppTeam = possSide === 'home' ? away : home;

  const bonuses = utils.getTeamBonuses(possTeam, MANU_ROLE_ID, FENER_ROLE_ID);
  const oppBonuses = utils.getTeamBonuses(oppTeam, MANU_ROLE_ID, FENER_ROLE_ID);

  const roll = Math.random();

  // Shot attempt
  if (roll < 0.12 + bonuses.shot) {
    const shooter = utils.getSNTPlayerName(possTeam);
    const isOnTarget = Math.random() < (0.40 + bonuses.shot);
    const meter = possSide === 'home' ? Math.floor(Math.random() * 20) + 5 : Math.floor(Math.random() * 20) + 65;

    if (isOnTarget) {
      const gkBonus = utils.getGKBonuses(oppTeam) + (oppTeam.lineup['KL']?.id === SPECIAL_GK_ID ? config.specialGkBonus : 0);
      const saveChance = Math.min(0.85, 0.35 + gkBonus);
      if (Math.random() < saveChance) {
        return { type: 'save', side: possSide, shooter, meter };
      }
      return { type: 'goal', side: possSide, shooter, meter };
    }
    return { type: 'miss', side: possSide, shooter, meter };
  }

  // Dribble
  if (roll < 0.25 + bonuses.dribble) {
    const player = utils.getRandomFieldPlayer(possTeam);
    const success = Math.random() < (0.48 + bonuses.dribble);
    return { type: 'dribble', side: possSide, player, success };
  }

  // Pass
  if (roll < 0.55 + bonuses.pass) {
    const player = utils.getRandomFieldPlayer(possTeam);
    const success = Math.random() < (0.70 + bonuses.pass);
    return { type: 'pass', side: possSide, player, success };
  }

  // Tackle
  if (roll < 0.70 + oppBonuses.tackle) {
    const player = utils.getRandomFieldPlayer(oppTeam);
    return { type: 'tackle', side: possSide === 'home' ? 'away' : 'home', player };
  }

  // Card
  if (roll < 0.73) {
    const player = utils.getRandomFieldPlayer(possTeam);
    const cardType = Math.random() < 0.025 ? 'kırmızı' : 'sarı';
    return { type: 'card', side: possSide, player, cardType };
  }

  // Corner
  if (roll < 0.76) {
    return { type: 'corner', side: possSide };
  }

  // Injury
  if (roll < 0.775) {
    const player = utils.getRandomFieldPlayer(possTeam);
    return { type: 'injury', side: possSide, player };
  }

  // Normal possession change
  return { type: 'possession', side: possSide };
}

// ════════════════════════════════════════════════════════════════════════
//  Match Engine — Auto Event Handler
// ════════════════════════════════════════════════════════════════════════

async function generateAutoEvent(channel, match) {
  const minute = calcMinute(match);
  match.minute = minute;

  const event = generateAutoEventLogic(match);
  const possTeam = match.possession.teamId === match.teams.home.id ? match.teams.home : match.teams.away;
  const oppTeam = possTeam === match.teams.home ? match.teams.away : match.teams.home;

  let desc = '';

  switch (event.type) {
    case 'goal': {
      const scorerId = findScorerId(possTeam, event.shooter);
      const assistPlayer = utils.getRandomFieldPlayer(possTeam, event.shooter);
      const assistId = findPlayerIdByName(possTeam, assistPlayer);

      match.score[event.side]++;
      match.goals.push({ team: event.side, scorer: event.shooter, scorerId, assist: assistPlayer, assistId, minute, meter: event.meter });
      match.stats[event.side].shots++;
      match.stats[event.side].shotsOnTarget++;
      match.stats._events = match.stats._events || { home: 0, away: 0 };
      match.stats._events[event.side] = (match.stats._events[event.side] || 0) + 1;

      desc = `${E.gol} **${event.minute}' GOL!** ${event.shooter} | **${possTeam.name}**\n⚽ ${event.shooter}${assistPlayer ? ` (asist: ${assistPlayer})` : ''}\n📍 ${event.meter}m | **${match.teams.home.name} ${match.score.home} - ${match.score.away} ${match.teams.away.name}**`;

      // Reset possession
      match.possession = { teamId: oppTeam.id, teamName: oppTeam.name, meter: 50, playerId: null, playerName: null, lastAssist: assistPlayer, consecutiveShots: 0 };
      break;
    }

    case 'save': {
      match.stats[event.side === 'home' ? 'away' : 'home'].saves++;
      match.stats[event.side].shots++;
      match.stats[event.side].shotsOnTarget++;
      match.stats._events = match.stats._events || { home: 0, away: 0 };
      match.stats._events[event.side] = (match.stats._events[event.side] || 0) + 1;

      const gkName = utils.getKLPlayerName(oppTeam);
      desc = `${E.kurtaris} **${event.minute}' KURTARIŞ!** ${gkName} | **${oppTeam.name}**\n🎯 ${event.shooter} şutu kurtardı!\n📍 ${event.meter}m | **${match.teams.home.name} ${match.score.home} - ${match.score.away} ${match.teams.away.name}**`;
      break;
    }

    case 'miss': {
      match.stats[event.side].shots++;
      match.stats._events = match.stats._events || { home: 0, away: 0 };
      match.stats._events[event.side] = (match.stats._events[event.side] || 0) + 1;

      desc = `${E.sut} **${event.minute}' ŞUT!** ${event.shooter} | **${possTeam.name}**\n❌ Aut!\n📍 ${event.meter}m`;
      break;
    }

    case 'dribble': {
      if (event.success) {
        match.stats[event.side].dribbles++;
        desc = `${E.calim} **${event.minute}' ÇALIM!** ${event.player} | **${possTeam.name}**\n✅ Başarılı çalım!`;
        match.possession.meter = Math.max(5, match.possession.meter - 8);
      } else {
        desc = `${E.mudahale} **${event.minute}' MÜDAHALE!** ${oppTeam.name} savunması | **${oppTeam.name}**\n❌ Çalım engellendi!`;
        match.possession = { teamId: oppTeam.id, teamName: oppTeam.name, meter: 50, playerId: null, playerName: null, lastAssist: null, consecutiveShots: 0 };
      }
      break;
    }

    case 'pass': {
      match.stats[event.side].totalPass++;
      if (event.success) {
        match.stats[event.side].successPass++;
        desc = `${E.pas} **${event.minute}' PAS** ${event.player} | **${possTeam.name}**\n✅ Başarılı pas!`;
        match.possession.meter = Math.max(5, match.possession.meter - 5);
      } else {
        desc = `${E.mudahale} **${event.minute}' PAS HATASI** ${event.player} | **${possTeam.name}**\n❌ Top rakibe gitti!`;
        match.possession = { teamId: oppTeam.id, teamName: oppTeam.name, meter: 50, playerId: null, playerName: null, lastAssist: null, consecutiveShots: 0 };
      }
      break;
    }

    case 'tackle': {
      match.stats[event.side].tackles.push(event.player);
      desc = `${E.mudahale} **${event.minute}' MÜDAHALE!** ${event.player} | **${oppTeam.name}**\n🛡️ Topu kazandı!`;
      match.possession = { teamId: oppTeam.id, teamName: oppTeam.name, meter: 50, playerId: null, playerName: null, lastAssist: null, consecutiveShots: 0 };
      break;
    }

    case 'card': {
      match.cards.push({ type: event.cardType, player: event.player, minute });
      const cardEmoji = event.cardType === 'kırmızı' ? '🟥' : '🟨';
      desc = `${E.duduk} **${event.minute}' ${event.cardType.toUpperCase()} KART!** ${event.player} | **${possTeam.name}**\n${cardEmoji} ${event.cardType === 'kırmızı' ? 'Oyundan atıldı!' : 'Uyarı!'}`;
      if (event.cardType === 'kırmızı') {
        replacePlayerWithNpc(possTeam, event.player);
      }
      break;
    }

    case 'corner': {
      desc = `${E.pas} **${event.minute}' KÖŞE VURUŞU** | **${possTeam.name}**\n🏳️ Köşe atışı kullanılıyor...`;
      break;
    }

    case 'injury': {
      match.injuries.push({ player: event.player, minute });
      desc = `${E.duduk} **${event.minute}' SAKATLIK!** ${event.player} | **${possTeam.name}**\n🤕 Oyuncu yerde kaldı...`;
      break;
    }

    default: {
      desc = `${E.saat} **${event.minute}'** | **${possTeam.name}** topu kontrol ediyor...`;
      break;
    }
  }

  db.saveMatch(match.channelId, match);

  const container = new ContainerBuilder()
    .setAccentColor(event.type === 'goal' ? 0x2ecc71 : event.type === 'save' ? 0x3498db : event.type === 'card' ? 0xe74c3c : 0x5865F2)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(desc));

  await channel.send({ components: [container], flags: CV2 }).catch(() => {});
}

// ════════════════════════════════════════════════════════════════════════
//  Match Engine — Half End & Match End
// ════════════════════════════════════════════════════════════════════════

async function checkHalfEnd(channel, match) {
  const isCupMatch = match.cupMatch;
  const halfTime = isCupMatch ? 60 : 45;
  const maxMinutes = isCupMatch ? 120 : 90;

  if (match.status === 'first_half' && match.minute >= halfTime) {
    match.status = 'half_time';
    match.halfStartedAt = null;
    db.saveMatch(match.channelId, match);

    const container = new ContainerBuilder()
      .setAccentColor(0xFEE75C)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `# ⏸ İLK YARI SONU\n\n` +
        `**${match.teams.home.name} ${match.score.home} - ${match.score.away} ${match.teams.away.name}**\n\n` +
        `> Devre arası başlıyor...`
      ));
    await channel.send({ components: [container], flags: CV2 });
    return;
  }

  if (match.status === 'second_half' && match.minute >= maxMinutes) {
    match.status = 'finished';
    match.halfStartedAt = null;
    db.saveMatch(match.channelId, match);

    // Check for penalties in cup matches
    if (isCupMatch && match.score.home === match.score.away) {
      const container = new ContainerBuilder()
        .setAccentColor(0xFFD700)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
          `# ⏱ UZATMALAR SONA ERDİ\n\n` +
          `**${match.teams.home.name} ${match.score.home} - ${match.score.away} ${match.teams.away.name}**\n\n` +
          `> ⚽ Penaltı serisi başlıyor!`
        ));
      await channel.send({ components: [container], flags: CV2 });
      return 'penalties';
    }

    return 'finished';
  }

  return null;
}

// ════════════════════════════════════════════════════════════════════════
//  Match Engine — Match Result
// ════════════════════════════════════════════════════════════════════════

async function sendMatchResult(channel, match) {
  // Update league stats
  leagueSystem.updateLeagueStats(match);
  leagueSystem.saveMatchHistoryEntry(match, config.maxMatchHistory);

  // Render result image
  let attachment = null;
  try {
    const imgBuf = await renderer.renderMatchResult(match);
    attachment = new AttachmentBuilder(imgBuf, { name: 'mac_sonucu.png' });
  } catch (e) {
    console.error('[RENDER] Maç sonucu render hatası:', e.message);
  }

  const ratings = calculateRatings(match);
  const mvp = getMatchMVP(ratings);

  const container = new ContainerBuilder()
    .setAccentColor(0xFFD700)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `# 🏆 MAÇ SONUCU\n\n` +
      `**${match.teams.home.name} ${match.score.home} - ${match.score.away} ${match.teams.away.name}**\n\n` +
      (match.penaltyWinner ? `> ⚽ Penaltılar: **${match.teams[match.penaltyWinner].name}** kazandı!\n` : '') +
      (mvp ? `> 🌟 MVP: **${mvp.name}** (${mvp.rating})\n` : '') +
      `\n> 📊 İstatistikler güncellendi!`
    ));

  if (attachment) {
    container.addMediaGalleryComponents(
      new (require('discord.js').MediaGalleryBuilder).addItems([
        new (require('discord.js').MediaGalleryItemBuilder()).setURL('attachment://mac_sonucu.png')
      ])
    );
  }

  await channel.send({ components: [container], flags: CV2, files: attachment ? [attachment] : [] }).catch(() => {});

  // Send ratings
  const ratingsText = Object.entries(ratings.home).map(([name, r]) => `${match.teams.home.name}: ${name} — ${r}`).join('\n') +
    '\n' + Object.entries(ratings.away).map(([name, r]) => `${match.teams.away.name}: ${name} — ${r}`).join('\n');

  const ratingsContainer = new ContainerBuilder()
    .setAccentColor(0x5865F2)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `### ⭐ OYUNCU PUANLARI\n\n` +
      `**${match.teams.home.name}:**\n` +
      Object.entries(ratings.home).map(([name, r]) => `> ${name}: **${r}**`).join('\n') +
      `\n\n**${match.teams.away.name}:**\n` +
      Object.entries(ratings.away).map(([name, r]) => `> ${name}: **${r}**`).join('\n')
    ));

  await channel.send({ components: [ratingsContainer], flags: CV2 }).catch(() => {});

  // Cleanup
  db.deleteMatch(match.channelId);
}

// ════════════════════════════════════════════════════════════════════════
//  Match Watcher
// ════════════════════════════════════════════════════════════════════════

const watchers = new Map();

function startMatchWatcher(clientRef, channelId) {
  if (watchers.has(channelId)) return;

  const interval = setInterval(async () => {
    try {
      const match = db.getMatch(channelId);
      if (!match || !['first_half', 'second_half'].includes(match.status) || match.paused) {
        stopMatchWatcher(channelId);
        return;
      }

      const channel = await clientRef.channels.fetch(channelId).catch(() => null);
      if (!channel) { stopMatchWatcher(channelId); return; }

      match.minute = calcMinute(match);
      db.saveMatch(channelId, match);

      // Generate event
      await generateAutoEvent(channel, match);

      // Check half end
      const halfResult = await checkHalfEnd(channel, match);
      if (halfResult === 'penalties') {
        stopMatchWatcher(channelId);
        return;
      }
      if (halfResult === 'finished') {
        stopMatchWatcher(channelId);
        await sendMatchResult(channel, match);
        return;
      }

      // Auto start second half
      if (match.status === 'half_time') {
        // Wait a bit then start second half
        setTimeout(async () => {
          const m = db.getMatch(channelId);
          if (m && m.status === 'half_time') {
            m.status = 'second_half';
            m.halfStartedAt = Date.now();
            db.saveMatch(channelId, m);

            const container = new ContainerBuilder()
              .setAccentColor(0x2ecc71)
              .addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `# ▶ İKİNCİ YARI BAŞLADI!\n\n` +
                `**${m.teams.home.name} ${m.score.home} - ${m.score.away} ${m.teams.away.name}**`
              ));
            await channel.send({ components: [container], flags: CV2 }).catch(() => {});
          }
        }, 10000);
      }
    } catch (err) {
      console.error('[WATCHER] Hata:', err);
    }
  }, 15000);

  watchers.set(channelId, interval);
}

function stopMatchWatcher(channelId) {
  if (watchers.has(channelId)) {
    clearInterval(watchers.get(channelId));
    watchers.delete(channelId);
  }
}

// ════════════════════════════════════════════════════════════════════════
//  Panel Components
// ════════════════════════════════════════════════════════════════════════

function buildTeamLineupText(team, formation) {
  const f = FORMATIONS[formation];
  let lines = [];
  lines.push(`**Diziliş:** ${formation}`);
  lines.push(`**KL:** ${utils.formatPlayer(team.lineup['KL'])}`);
  if (f) {
    for (const [pos, count] of Object.entries(f.positions)) {
      if (pos === 'KL') continue;
      if (count === 1) {
        lines.push(`**${pos}:** ${utils.formatPlayer(team.lineup[pos])}`);
      } else {
        for (let i = 1; i <= count; i++) {
          const key = `${pos}${i}`;
          lines.push(`**${pos}${i}:** ${utils.formatPlayer(team.lineup[key])}`);
        }
      }
    }
  }
  return lines.join('\n');
}

function buildMatchPanelContainer(match) {
  const home = match.teams.home;
  const away = match.teams.away;
  const activeTeamId = match.setupState.currentTeam;
  const isPaused = match.paused && !['setup', 'ready'].includes(match.status);

  const selectedPlayerId = match.setupState.selectedPlayer;
  let selectedText = '*Henüz oyuncu seçilmedi.*';
  if (selectedPlayerId === 'NPC') selectedText = '🤖 **NPC** seçili — bir pozisyon seçin.';
  else if (selectedPlayerId) selectedText = `<@${selectedPlayerId}> seçili — bir pozisyon seçin.`;

  const container = new ContainerBuilder()
    .setAccentColor(isPaused ? 0xFEE75C : 0x5865F2)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        isPaused
          ? '# ⏸ MAÇ PANELİ — Durduruldu'
          : '# 🔄 OYUNCU DEĞİŞİKLİK PANELİ'
      )
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `Aşağıdaki menü ve butonları kullanarak kadroları yönetebilirsiniz.\n` +
        `💡 *Önce diziliş seçin → oyuncu seçin → pozisyona yerleştirin.*\n\n` +
        `📍 **Şu an düzenlenen takım:** ${activeTeamId === 'home' ? '🏠 ' + home.name : '✈️ ' + away.name}\n` +
        `👤 **Seçili oyuncu:** ${selectedText}` +
        (isPaused ? `\n\n⏱ **Skor:** ${home.name} **${match.score.home} - ${match.score.away}** ${away.name} | Dakika: **${match.minute}'**` : '')
      )
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`### 🏠 ${home.name} ${activeTeamId === 'home' ? '*(DÜZENLENİYOR)*' : ''}\n${buildTeamLineupText(home, home.formation)}`)
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`### ✈️ ${away.name} ${activeTeamId === 'away' ? '*(DÜZENLENİYOR)*' : ''}\n${buildTeamLineupText(away, away.formation)}`)
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large));

  return container;
}

function buildPlayerSelectMenu(members) {
  const options = members.slice(0, 24).map(m => {
    const label = (m.displayName || m.name || m.id || 'Oyuncu').slice(0, 25);
    const tag = m.user ? `${m.user.tag}`.slice(0, 50) : (m.name || m.id || '').slice(0, 50);
    return { label, value: m.id, description: tag };
  });
  options.unshift({ label: '🤖 NPC', value: 'NPC', description: 'Bu pozisyona NPC yerleştir' });

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('select_player')
      .setPlaceholder('🎯 Bir oyuncu veya NPC seçin...')
      .addOptions(options.slice(0, 25))
  );
}

function buildPositionSelectMenu(formation) {
  const keys = utils.getPositionKeys(formation);
  const options = keys.slice(0, 25).map(k => ({ label: k, value: k }));

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('select_position')
      .setPlaceholder('📍 Bir pozisyon seçin...')
      .addOptions(options)
  );
}

function buildFormationMenu(teamId) {
  const options = Object.keys(FORMATIONS).map(f => ({ label: f, value: f }));
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`select_formation_${teamId}`)
      .setPlaceholder('📋 Diziliş seçin...')
      .addOptions(options.slice(0, 25))
  );
}

function buildControlButtons(match) {
  const rows = [];

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('match_start').setLabel('🟢 Maçı Başlat').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('match_pause').setLabel('⏸ Durdur').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('match_resume').setLabel('▶ Devam Et').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('match_finish').setLabel('⏹ Bitir').setStyle(ButtonStyle.Danger)
  );
  rows.push(row1);

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('team_home').setLabel('🏠 Ev Sahibi').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('team_away').setLabel('✈️ Deplasman').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('match_save_lineup').setLabel('💾 Kaydet').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('match_cancel').setLabel('❌ İptal').setStyle(ButtonStyle.Danger)
  );
  rows.push(row2);

  return rows;
}

function buildPanelComponents(match, teamMembersArray) {
  return [
    buildFormationMenu(match.setupState.currentTeam),
    buildPlayerSelectMenu(teamMembersArray),
    buildPositionSelectMenu(match.teams[match.setupState.currentTeam].formation),
    ...buildControlButtons(match)
  ];
}

// ════════════════════════════════════════════════════════════════════════
//  Commands
// ════════════════════════════════════════════════════════════════════════

async function cmdMac(message, args) {
  const existing = db.getMatch(message.channel.id);
  if (existing) return message.reply('⚠️ Bu kanalda zaten aktif bir maç var!');

  // Create a new match
  const teams = cupSystem.CUP_TEAMS;
  const home = teams[Math.floor(Math.random() * teams.length)];
  let away = teams[Math.floor(Math.random() * teams.length)];
  while (away.roleId === home.roleId) away = teams[Math.floor(Math.random() * teams.length)];

  const defaultFormation = '4-3-3';
  const homeMembers = message.guild.members.cache.filter(m => !m.user.bot).first(24) || [];
  const awayMembers = message.guild.members.cache.filter(m => !m.user.bot).first(24) || [];

  const matchData = {
    channelId: message.channel.id,
    guildId: message.guild.id,
    status: 'setup',
    minute: 0,
    half: 1,
    maxMinutes: 90,
    paused: false,
    score: { home: 0, away: 0 },
    possession: { teamId: home.roleId, teamName: home.name, meter: 50, playerId: null, playerName: null, lastAssist: null, consecutiveShots: 0 },
    teams: {
      home: {
        id: home.roleId, name: home.name, emoji: home.emoji,
        formation: defaultFormation,
        lineup: utils.createEmptyLineup(defaultFormation),
        members: homeMembers.map(m => ({ id: m.id, name: m.displayName, value: utils.extractValueFromNickname(m.displayName), mainPos: null })),
        roles: { santra: null, uzakFrikik: null, yakinFrikik: null, korner: null, penalti: null, kaptan: null }
      },
      away: {
        id: away.roleId, name: away.name, emoji: away.emoji,
        formation: defaultFormation,
        lineup: utils.createEmptyLineup(defaultFormation),
        members: awayMembers.map(m => ({ id: m.id, name: m.displayName, value: utils.extractValueFromNickname(m.displayName), mainPos: null })),
        roles: { santra: null, uzakFrikik: null, yakinFrikik: null, korner: null, penalti: null, kaptan: null }
      }
    },
    stats: {
      home: { totalPass: 0, successPass: 0, shots: 0, shotsOnTarget: 0, dribbles: 0, assists: [], saves: 0, tackles: [] },
      away: { totalPass: 0, successPass: 0, shots: 0, shotsOnTarget: 0, dribbles: 0, assists: [], saves: 0, tackles: [] },
      _events: { home: 0, away: 0 }
    },
    goals: [],
    cards: [],
    injuries: [],
    halfStartedAt: null,
    setupState: { currentTeam: 'home', selectedPlayer: null, panelMessageId: null, authorId: message.author.id }
  };

  // Apply saved lineups
  const savedHome = db.getSavedLineup(home.roleId);
  const savedAway = db.getSavedLineup(away.roleId);
  utils.applySavedLineup(matchData.teams.home, savedHome);
  utils.applySavedLineup(matchData.teams.away, savedAway);

  db.saveMatch(message.channel.id, matchData);

  const header = new ContainerBuilder().setAccentColor(0x5865F2)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `# 🆕 YENİ MAÇ\n\n` +
      `${home.emoji} **${home.name}** vs **${away.name}** ${away.emoji}\n\n` +
      `⏱ Süre: **90 dakika** (2 x 45 dk)\n\n` +
      `Kadroları ayarlayıp **✅ Değişiklikleri Tamamla** butonuna tıklayın, ardından **🟢 Maçı Başlat** ile başlayın.`
    ));
  await message.channel.send({ components: [header], flags: CV2 });

  const container = buildMatchPanelContainer(matchData);
  const components = buildPanelComponents(matchData, homeMembers);
  for (const c of components) {
    if (c.data && c.data.components) container.addActionRowComponents(c);
  }
  const sent = await message.channel.send({ components: [container], flags: CV2 });
  matchData.setupState.panelMessageId = sent.id;
  db.saveMatch(message.channel.id, matchData);
}

async function cmdBaslat(message) {
  const match = db.getMatch(message.channel.id);
  if (!match) return message.reply('⚠️ Bu kanalda aktif maç yok!');
  if (match.status !== 'setup' && match.status !== 'ready') return message.reply('⚠️ Maç zaten başlamış!');

  match.status = 'first_half';
  match.halfStartedAt = Date.now();
  match.paused = false;
  db.saveMatch(message.channel.id, match);

  const container = new ContainerBuilder().setAccentColor(0x2ecc71)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `# ▶ MAÇ BAŞLADI!\n\n` +
      `**${match.teams.home.name}** vs **${match.teams.away.name}**\n\n` +
      `> ⏱ İlk yarı başlıyor...`
    ));
  await message.channel.send({ components: [container], flags: CV2 });

  startMatchWatcher(message.client, message.channel.id);
}

async function cmdDurdur(message) {
  const match = db.getMatch(message.channel.id);
  if (!match) return message.reply('⚠️ Bu kanalda aktif maç yok!');
  if (!['first_half', 'second_half'].includes(match.status)) return message.reply('⚠️ Maç henüz başlamadı!');

  match.paused = true;
  db.saveMatch(message.channel.id, match);

  const container = new ContainerBuilder().setAccentColor(0xFEE75C)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `# ⏸ MAÇ DURDURULDU\n\n` +
      `**${match.teams.home.name} ${match.score.home} - ${match.score.away} ${match.teams.away.name}**\n` +
      `⏱ Dakika: **${match.minute}'**`
    ));
  await message.channel.send({ components: [container], flags: CV2 });
}

async function cmdIptal(message) {
  const match = db.getMatch(message.channel.id);
  if (!match) return message.reply('⚠️ Bu kanalda aktif maç yok!');

  stopMatchWatcher(message.channel.id);
  db.deleteMatch(message.channel.id);

  const container = new ContainerBuilder().setAccentColor(0xe74c3c)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `# ❌ MAÇ İPTAL EDİLDİ\n\n` +
      `> Maç iptal edildi ve temizlendi.`
    ));
  await message.channel.send({ components: [container], flags: CV2 });
}

async function cmdBitir(message) {
  const match = db.getMatch(message.channel.id);
  if (!match) return message.reply('⚠️ Bu kanalda aktif maç yok!');

  stopMatchWatcher(message.channel.id);
  match.status = 'finished';
  db.saveMatch(message.channel.id, match);

  await sendMatchResult(message.channel, match);
}

async function cmdLig(message, args) {
  const league = db.getLeague();
  if (!league.teams || Object.keys(league.teams).length === 0) {
    return message.reply('📊 Henüz lig verisi yok.');
  }

  const fixture = db.getFixture();
  const teamEmojiMap = {};
  if (fixture && fixture.teams) {
    for (const t of fixture.teams) teamEmojiMap[t.name] = t.emoji || '⚽';
  }

  try {
    const imgBuf = await renderer.renderLeagueTable(league, 'VolderLeague', teamEmojiMap);
    const attachment = new AttachmentBuilder(imgBuf, { name: 'puan_durumu.png' });

    const container = new ContainerBuilder().setAccentColor(0x2ecc71)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `# 🏆 PUAN DURUMU\n\n` +
        `> 📊 ${Object.keys(league.teams).length} takım`
      ))
      .addMediaGalleryComponents(
        new (require('discord.js').MediaGalleryBuilder).addItems([
          new (require('discord.js').MediaGalleryItemBuilder()).setURL('attachment://puan_durumu.png')
        ])
      );

    await message.channel.send({ components: [container], flags: CV2, files: [attachment] });
  } catch (e) {
    console.error('[LIG] Render hatası:', e);
    // Fallback to text
    const sorted = Object.entries(league.teams).sort((a, b) => b[1].points - a[1].points || (b[1].gf - b[1].ga) - (a[1].gf - a[1].ga));
    let text = `# 🏆 PUAN DURUMU\n\n`;
    sorted.forEach(([name, t], i) => {
      const gd = t.gf - t.ga;
      text += `**${i + 1}.** ${name} — O:${t.played} G:${t.won} B:${t.drawn} M:${t.lost} AV:${gd > 0 ? '+' : ''}${gd} **P:${t.points}**\n`;
    });

    const container = new ContainerBuilder().setAccentColor(0x2ecc71)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
    await message.channel.send({ components: [container], flags: CV2 });
  }
}

async function cmdGolKralligi(message) {
  const league = db.getLeague();
  if (!league.topScorers || Object.keys(league.topScorers).length === 0) {
    return message.reply('📊 Henüz gol krallığı verisi yok.');
  }

  const s = Object.entries(league.topScorers)
    .filter(([id]) => id && !id.startsWith('🤖'))
    .sort((a, b) => b[1].goals - a[1].goals || b[1].assists - a[1].assists)
    .slice(0, 10);

  if (s.length === 0) return message.reply('📊 Henüz gol krallığı verisi yok.');

  try {
    const imgBuf = await renderer.renderKingBoard('GOL KRALLIGI', s.map(([id, v]) => [id, v.goals + ' gol', v.assists + ' asist', v.goals]), '#f1c40f', '⚽', league.playerNames || {});
    const attachment = new AttachmentBuilder(imgBuf, { name: 'gol_kralligi.png' });

    const container = new ContainerBuilder().setAccentColor(0xf1c40f)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ⚽ GOL KRALLIĞI`))
      .addMediaGalleryComponents(
        new (require('discord.js').MediaGalleryBuilder).addItems([
          new (require('discord.js').MediaGalleryItemBuilder()).setURL('attachment://gol_kralligi.png')
        ])
      );

    await message.channel.send({ components: [container], flags: CV2, files: [attachment] });
  } catch (e) {
    console.error('[GOLKRALLIGI] Render hatası:', e);
    let text = `# ⚽ GOL KRALLIĞI\n\n`;
    s.forEach(([id, v], i) => {
      const name = league.playerNames?.[id] || id;
      text += `**${i + 1}.** ${name} — **${v.goals}** gol ${v.assists > 0 ? `(${v.assists} asist)` : ''}\n`;
    });
    const container = new ContainerBuilder().setAccentColor(0xf1c40f)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
    await message.channel.send({ components: [container], flags: CV2 });
  }
}

async function cmdAsistKralligi(message) {
  const league = db.getLeague();
  if (!league.topScorers || Object.keys(league.topScorers).length === 0) {
    return message.reply('📊 Henüz asist krallığı verisi yok.');
  }

  const s = Object.entries(league.topScorers)
    .filter(([id]) => id && !id.startsWith('🤖'))
    .sort((a, b) => b[1].assists - a[1].assists || b[1].goals - a[1].goals)
    .slice(0, 10);

  if (s.length === 0) return message.reply('📊 Henüz asist krallığı verisi yok.');

  try {
    const imgBuf = await renderer.renderKingBoard('ASIST KRALLIGI', s.map(([id, v]) => [id, v.assists + ' asist', v.goals + ' gol', v.assists]), '#3498db', '🅰️', league.playerNames || {});
    const attachment = new AttachmentBuilder(imgBuf, { name: 'asist_kralligi.png' });

    const container = new ContainerBuilder().setAccentColor(0x3498db)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# 🅰️ ASİST KRALLIĞI`))
      .addMediaGalleryComponents(
        new (require('discord.js').MediaGalleryBuilder).addItems([
          new (require('discord.js').MediaGalleryItemBuilder()).setURL('attachment://asist_kralligi.png')
        ])
      );

    await message.channel.send({ components: [container], flags: CV2, files: [attachment] });
  } catch (e) {
    console.error('[ASISTKRALLIGI] Render hatası:', e);
    let text = `# 🅰️ ASİST KRALLIĞI\n\n`;
    s.forEach(([id, v], i) => {
      const name = league.playerNames?.[id] || id;
      text += `**${i + 1}.** ${name} — **${v.assists}** asist ${v.goals > 0 ? `(${v.goals} gol)` : ''}\n`;
    });
    const container = new ContainerBuilder().setAccentColor(0x3498db)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
    await message.channel.send({ components: [container], flags: CV2 });
  }
}

async function cmdEnIyiGK(message) {
  const league = db.getLeague();
  if (!league.bestGK || Object.keys(league.bestGK).length === 0) {
    return message.reply('📊 Henüz kaleci verisi yok.');
  }

  const s = Object.entries(league.bestGK)
    .filter(([id]) => id && !id.startsWith('🤖'))
    .sort((a, b) => b[1].saves - a[1].saves || b[1].cleanSheets - a[1].cleanSheets)
    .slice(0, 5);

  if (s.length === 0) return message.reply('📊 Henüz kaleci verisi yok.');

  try {
    const imgBuf = await renderer.renderKingBoard('KURTARIŞ KRALLIĞI', s.map(([id, v]) => [id, v.saves + ' kurtarış', v.cleanSheets + ' GS', v.saves]), '#3498db', '🧤', league.playerNames || {});
    const attachment = new AttachmentBuilder(imgBuf, { name: 'kurtaris_kralligi.png' });

    const container = new ContainerBuilder().setAccentColor(0x3498db)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# 🧤 KURTARIŞ KRALLIĞI`))
      .addMediaGalleryComponents(
        new (require('discord.js').MediaGalleryBuilder).addItems([
          new (require('discord.js').MediaGalleryItemBuilder()).setURL('attachment://kurtaris_kralligi.png')
        ])
      );

    await message.channel.send({ components: [container], flags: CV2, files: [attachment] });
  } catch (e) {
    console.error('[ENIYIGK] Render hatası:', e);
    let text = `# 🧤 KURTARIŞ KRALLIĞI\n\n`;
    s.forEach(([id, v], i) => {
      const name = league.playerNames?.[id] || id;
      text += `**${i + 1}.** ${name} — **${v.saves}** kurtarış ${v.cleanSheets > 0 ? `(${v.cleanSheets} GS)` : ''}\n`;
    });
    const container = new ContainerBuilder().setAccentColor(0x3498db)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
    await message.channel.send({ components: [container], flags: CV2 });
  }
}

async function cmdFikstur(message, args) {
  const fixture = db.getFixture();
  if (!fixture || !fixture.fixtures || fixture.fixtures.length === 0) {
    return message.reply('📊 Henüz fikstür yok.');
  }

  const weekNum = parseInt(args[0]) || 1;
  try {
    const imgBuf = await renderer.renderFixture(fixture, weekNum);
    if (!imgBuf) return message.reply(`❌ Hafta ${weekNum} bulunamadı.`);
    const attachment = new AttachmentBuilder(imgBuf, { name: 'fikstur.png' });

    const container = new ContainerBuilder().setAccentColor(0x16db65)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# 📅 FİXTÜR — HAFTA ${weekNum}`))
      .addMediaGalleryComponents(
        new (require('discord.js').MediaGalleryBuilder).addItems([
          new (require('discord.js').MediaGalleryItemBuilder()).setURL('attachment://fikstur.png')
        ])
      );

    await message.channel.send({ components: [container], flags: CV2, files: [attachment] });
  } catch (e) {
    console.error('[FIKSTUR] Render hatası:', e);
    return message.reply('❌ Fikstür render edilemedi.');
  }
}

async function cmdKuraCekimi(message) {
  if (!message.member.permissions.has('Administrator')) return message.reply('❌ Bu komutu sadece yöneticiler kullanabilir.');

  const teams = CUP_TEAMS;
  const shuffled = [...teams].sort(() => Math.random() - 0.5);

  const cup = cupSystem.generateCupBracket(shuffled);
  db.saveCup(cup);

  let text = `# 🏆 VOLDER CUP — KURA ÇEKİMİ\n\n`;
  text += `### Çeyrek Final\n`;
  for (const m of cup.rounds[0].matches) {
    text += `> **${m.home.name}** vs **${m.away.name}**\n`;
  }
  text += `\n### Yarı Final\n`;
  text += `> **${cup.rounds[1].matches[0].home?.name || 'Belli değil'}** vs **${cup.rounds[1].matches[0].away?.name || 'Belli değil'}**\n`;
  text += `> **${cup.rounds[1].matches[1].home?.name || 'Belli değil'}** vs **${cup.rounds[1].matches[1].away?.name || 'Belli değil'}**\n`;
  text += `\n### Final\n`;
  text += `> **${cup.rounds[2].matches[0].home?.name || 'Belli değil'}** vs **${cup.rounds[2].matches[0].away?.name || 'Belli değil'}**\n`;

  const container = new ContainerBuilder().setAccentColor(0xFFD700)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
  await message.channel.send({ components: [container], flags: CV2 });
}

async function cmdCupFikstur(message) {
  const cup = db.getCup();
  if (!cup) return message.reply('🏆 Kupa henüz oluşturulmamış! `!kuracekimi` yazın.');

  let text = `# 🏆 VOLDER CUP — FİXTÜR\n\n`;
  for (const round of cup.rounds) {
    text += `### ${round.name}\n`;
    for (const m of round.matches) {
      const hName = m.home?.name || 'Belli değil';
      const aName = m.away?.name || 'Belli değil';
      const score = m.played ? `**${m.homeScore} - ${m.awayScore}**` : 'VS';
      const winner = m.winner ? ` → ${m.winner.name}` : '';
      text += `> ${hName} ${score} ${aName}${winner}\n`;
    }
    text += '\n';
  }

  const container = new ContainerBuilder().setAccentColor(0xFFD700)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
  await message.channel.send({ components: [container], flags: CV2 });
}

async function cmdStat(message, args) {
  const history = db.getMatchHistory();
  if (!history || history.length === 0) return message.reply('📊 Henüz oynanmış maç yok.');

  const league = db.getLeague();
  const searchName = args.join(' ').toLowerCase();

  if (searchName) {
    // Search for player
    const found = Object.entries(league.playerNames || {}).find(([, name]) => name.toLowerCase().includes(searchName));
    if (!found) return message.reply(`❌ "${args.join(' ')}" oyuncusu bulunamadı.`);

    const [id, name] = found;
    const stats = league.topScorers?.[id] || { goals: 0, assists: 0 };
    const gkStats = league.bestGK?.[id] || { saves: 0, cleanSheets: 0 };

    const container = new ContainerBuilder().setAccentColor(0x1a1a2e)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `> **${name}**\n` +
        `⚽ Goller: **${stats.goals}** · 🅰️ Asistler: **${stats.assists}**\n` +
        `🧤 Kurtarışlar: **${gkStats.saves}** · 🥅 GS: **${gkStats.cleanSheets}**`
      ));

    return message.channel.send({ components: [container], flags: CV2 });
  }

  // Show own stats
  const myId = message.member.id;
  const myStats = league.topScorers?.[myId];
  const myGK = league.bestGK?.[myId];
  const myName = league.playerNames?.[myId];

  if (!myStats && !myGK && !myName) {
    return message.reply(`❌ Senin adına ait istatistik bulunamadı. \`!stat <oyuncu_adi>\` ile arayabilirsin.`);
  }

  const container = new ContainerBuilder().setAccentColor(0x1a1a2e)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `> **${myName || message.member.displayName}**\n` +
      `⚽ Goller: **${myStats?.goals || 0}** · 🅰️ Asistler: **${myStats?.assists || 0}**\n` +
      `🧤 Kurtarışlar: **${myGK?.saves || 0}** · 🥅 GS: **${myGK?.cleanSheets || 0}**`
    ));

  return message.channel.send({ components: [container], flags: CV2 });
}

async function cmdHelp(message) {
  const container = new ContainerBuilder().setAccentColor(0x5865F2)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `# 📋 VOLDER MAC BOT — KOMUTLAR\n\n` +
      `### ⚽ Maç Komutları\n` +
      `\`!mac\` — Yeni maç oluştur\n` +
      `\`!baslat\` — Maçı başlat\n` +
      `\`!durdur\` — Maçı durdur\n` +
      `\`!bitir\` — Maçı bitir ve sonucu göster\n` +
      `\`!iptal\` — Maçı iptal et\n\n` +
      `### 🏆 Lig Komutları\n` +
      `\`!lig\` — Puan durumu\n` +
      `\`!golkraligi\` — Gol krallığı\n` +
      `\`!asistkralligi\` — Asist krallığı\n` +
      `\`!eniyigk\` — En iyi kaleci\n` +
      `\`!fikstur [hafta]\` — Fikstür\n` +
      `\`!stat [oyuncu]\` — İstatistik\n\n` +
      `### 🏅 Kupa Komutları\n` +
      `\`!kuracekimi\` — Kura çekimi (Admin)\n` +
      `\`!cfikstur\` — Kupa fikstürü\n\n` +
      `### 🎉 Ödül Komutları\n` +
      `\`!odul\` — Ödülleri listele\n` +
      `\`!odul baslat\` — Tören başlat (Admin)\n` +
      `\`!ballondor\` — Ballon d'Or töreni\n\n` +
      `### 🤖 Otomatik Lig\n` +
      `\`!yenilig kur\` — Ligi kur (Admin)\n` +
      `\`!yenilig baslat\` — Sezonu başlat (Admin)\n` +
      `\`!yenilig puan <ust/alt>\` — Puan durumu`
    ));

  return message.channel.send({ components: [container], flags: CV2 });
}

// ════════════════════════════════════════════════════════════════════════
//  Interaction Handler
// ════════════════════════════════════════════════════════════════════════

async function handleInteraction(interaction) {
  if (!interaction.isStringSelectMenu() && !interaction.isButton()) return;

  const match = db.getMatch(interaction.channelId);
  if (!match) {
    if (interaction.isButton()) {
      return interaction.reply({ content: '⚠️ Aktif maç bulunamadı.', ephemeral: true });
    }
    return;
  }

  const customId = interaction.customId;

  // Formation select
  if (customId.startsWith('select_formation_')) {
    const teamId = customId.replace('select_formation_', '');
    const formation = interaction.values[0];
    if (!FORMATIONS[formation]) return interaction.reply({ content: '❌ Geçersiz diziliş.', ephemeral: true });

    match.teams[teamId].formation = formation;
    match.teams[teamId].lineup = utils.createEmptyLineup(formation);
    db.saveMatch(interaction.channelId, match);

    await interaction.update({ content: `✅ ${match.teams[teamId].name} dizilişi **${formation}** olarak ayarlandı.`, components: [], flags: CV2 });
    return;
  }

  // Player select
  if (customId === 'select_player') {
    const playerId = interaction.values[0];
    match.setupState.selectedPlayer = playerId;
    db.saveMatch(interaction.channelId, match);
    await interaction.update({ content: `✅ Oyuncu seçildi: ${playerId === 'NPC' ? '🤖 NPC' : `<@${playerId}>`}`, components: [], flags: CV2 });
    return;
  }

  // Position select
  if (customId === 'select_position') {
    const position = interaction.values[0];
    const selectedPlayer = match.setupState.selectedPlayer;
    if (!selectedPlayer) return interaction.update({ content: '⚠️ Önce bir oyuncu seçin!', components: [], flags: CV2 });

    const teamId = match.setupState.currentTeam;
    const team = match.teams[teamId];

    if (selectedPlayer === 'NPC') {
      team.lineup[position] = { isNpc: true, value: 1, id: null, name: 'NPC', mainPos: position.replace(/[0-9]/g, '') };
    } else {
      const member = team.members.find(m => m.id === selectedPlayer);
      if (!member) return interaction.update({ content: '❌ Bu oyuncu bu takımda değil!', components: [], flags: CV2 });
      team.lineup[position] = { isNpc: false, id: selectedPlayer, name: member.name, value: member.value, mainPos: position.replace(/[0-9]/g, '') };
    }

    match.setupState.selectedPlayer = null;
    db.saveMatch(interaction.channelId, match);
    await interaction.update({ content: `✅ ${selectedPlayer === 'NPC' ? '🤖 NPC' : `<@${selectedPlayer}>`} → **${position}** pozisyonuna yerleştirildi.`, components: [], flags: CV2 });
    return;
  }

  // Buttons
  if (interaction.isButton()) {
    switch (customId) {
      case 'match_start':
        match.status = 'first_half';
        match.halfStartedAt = Date.now();
        match.paused = false;
        db.saveMatch(interaction.channelId, match);
        await interaction.update({ content: '🟢 Maç başlatılıyor...', components: [], flags: CV2 });
        startMatchWatcher(interaction.client, interaction.channelId);
        return;

      case 'match_pause':
        if (!['first_half', 'second_half'].includes(match.status)) {
          return interaction.update({ content: '⚠️ Maç henüz başlamadı!', components: [], flags: CV2 });
        }
        match.paused = true;
        db.saveMatch(interaction.channelId, match);
        await interaction.update({ content: '⏸ Maç durduruldu.', components: [], flags: CV2 });
        return;

      case 'match_resume':
        if (!match.paused) {
          return interaction.update({ content: '⚠️ Maç zaten devam ediyor!', components: [], flags: CV2 });
        }
        match.paused = false;
        match.halfStartedAt = Date.now();
        db.saveMatch(interaction.channelId, match);
        await interaction.update({ content: '▶ Maç devam ediyor.', components: [], flags: CV2 });
        return;

      case 'match_finish':
        match.status = 'finished';
        db.saveMatch(interaction.channelId, match);
        stopMatchWatcher(interaction.channelId);
        await interaction.update({ content: '⏹ Maç bitiriliyor...', components: [], flags: CV2 });
        await sendMatchResult(interaction.channel, match);
        return;

      case 'team_home':
        match.setupState.currentTeam = 'home';
        db.saveMatch(interaction.channelId, match);
        await interaction.update({ content: `🏠 ${match.teams.home.name} düzenleniyor.`, components: [], flags: CV2 });
        return;

      case 'team_away':
        match.setupState.currentTeam = 'away';
        db.saveMatch(interaction.channelId, match);
        await interaction.update({ content: `✈️ ${match.teams.away.name} düzenleniyor.`, components: [], flags: CV2 });
        return;

      case 'match_save_lineup':
        const teamId = match.setupState.currentTeam;
        db.saveLineup(match.teams[teamId].id, match.teams[teamId]);
        await interaction.update({ content: `💾 ${match.teams[teamId].name} kadrosu kaydedildi!`, components: [], flags: CV2 });
        return;

      case 'match_cancel':
        stopMatchWatcher(interaction.channelId);
        db.deleteMatch(interaction.channelId);
        await interaction.update({ content: '❌ Maç iptal edildi.', components: [], flags: CV2 });
        return;
    }
  }
}

// ════════════════════════════════════════════════════════════════════════
//  Command Map
// ════════════════════════════════════════════════════════════════════════

const commands = {
  mac: cmdMac,
  durdur: cmdDurdur,
  baslat: cmdBaslat,
  iptal: cmdIptal,
  bitir: cmdBitir,
  lig: cmdLig,
  golkraligi: cmdGolKralligi,
  asistkralligi: cmdAsistKralligi,
  eniyigk: cmdEnIyiGK,
  fikstur: cmdFikstur,
  kuracekimi: cmdKuraCekimi,
  cfikstur: cmdCupFikstur,
  stat: cmdStat,
  odul: awardsSystem.cmdOdul,
  ballondor: awardsSystem.cmdBallonDor,
  yeniLig: cmdNewLig,
  yenilig: cmdNewLig,
  yardim: cmdHelp,
  help: cmdHelp
};

// ════════════════════════════════════════════════════════════════════════
//  Events
// ════════════════════════════════════════════════════════════════════════

client.once(Events.ClientReady, () => {
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  ✅ Bot aktif: ${client.user.tag}`);
  console.log(`  📋 Prefix: ${PREFIX}`);
  console.log(`  🎮 Komutlar: ${Object.keys(commands).map(c => `${PREFIX}${c}`).join(', ')}`);
  console.log('═══════════════════════════════════════════════════════════');

  // Restore active match watchers
  try {
    const matches = db.getAllMatches();
    for (const [channelId, match] of Object.entries(matches)) {
      if (['first_half', 'second_half'].includes(match.status) && !match.paused) {
        startMatchWatcher(client, channelId);
      }
    }
  } catch (err) {
    console.error('[HATA] Watcher geri yükleme:', err);
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  const content = message.content.trim();

  if (!content.startsWith(PREFIX)) return;
  const args = content.slice(PREFIX.length).trim().split(/\s+/);
  const commandName = args.shift().toLowerCase();
  const command = commands[commandName];
  if (!command) return;

  try {
    await command(message, args);
  } catch (error) {
    console.error(`[HATA] ${PREFIX}${commandName}:`, error);
    await message.reply('❌ Komut çalışırken bir hata oluştu.').catch(() => {});
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    await handleInteraction(interaction);
  } catch (error) {
    console.error('[HATA] Interaction:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ Bir hata oluştu!', ephemeral: true }).catch(() => {});
    }
  }
});

// ════════════════════════════════════════════════════════════════════════
//  Startup
// ════════════════════════════════════════════════════════════════════════

process.on('SIGINT', async () => {
  console.log('\n🛑 Bot kapatılıyor...');
  for (const [channelId] of watchers) stopMatchWatcher(channelId);
  await renderer.closeBrowser();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  for (const [channelId] of watchers) stopMatchWatcher(channelId);
  await renderer.closeBrowser();
  process.exit(0);
});

process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
});

db.initDB();

if (config.tokenMissing) {
  console.error('═══════════════════════════════════════════════════════════');
  console.error('  ❌ DISCORD BOT TOKEN EKSİK!');
  console.error('  📝 config.json dosyasındaki "token" alanına tokenınızı yazın');
  console.error('  veya .env dosyasına TOKEN=... ekleyin');
  console.error('═══════════════════════════════════════════════════════════');
  process.exit(1);
}

client.login(config.token).then(() => {
  console.log('🔗 Discord\'a bağlanılıyor...');
}).catch(err => {
  console.error('❌ Discord bağlantı hatası:', err.message);
  process.exit(1);
});

module.exports = { client, commands };
