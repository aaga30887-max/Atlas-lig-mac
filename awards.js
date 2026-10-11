// ════════════════════════════════════════════════════════════════════════
//  VOLDER ÖDÜL SİSTEMİ — Tören & Ballon d'Or
// ════════════════════════════════════════════════════════════════════════

const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize } = require('discord.js');
const db = require('../database');
const { sleep } = require('../utils');
const config = require('../config');

const DEFAULT_AWARDS = [
  { id: 'gol_krali', name: '⚽ Gol Kralı', description: 'En çok gol atan oyuncu', icon: '⚽', winner: null, team: null, value: 0 },
  { id: 'asist_krali', name: '🅰️ Asist Kralı', description: 'En çok asist yapan oyuncu', icon: '🅰️', winner: null, team: null, value: 0 },
  { id: 'en_iyi_gk', name: '🧤 En İyi Kaleci', description: 'En çok kurtarış yapan kaleci', icon: '🧤', winner: null, team: null, value: 0 },
  { id: 'en_cok_sari', name: '🟨 Kart Canavarı', description: 'En çok kart gören oyuncu', icon: '🟨', winner: null, team: null, value: 0 },
  { id: 'en_cok_mudahale', name: '🛡️ Savunma Duvarı', description: 'En çok müdahale yapan oyuncu', icon: '🛡️', winner: null, team: null, value: 0 },
  { id: 'lig_sampiyonu', name: '🏆 Lig Şampiyonu', description: 'Sezon şampiyonu', icon: '🏆', winner: null, team: null, value: 0, isTeam: true },
  { id: 'kupa_sampiyonu', name: '🏅 Volder Kupası', description: 'Volder Cup şampiyonu', icon: '🏅', winner: null, team: null, value: 0, isTeam: true }
];

function getAwards() {
  let data = db.getAwards();
  if (!data || !data.awards) {
    data = { awards: JSON.parse(JSON.stringify(DEFAULT_AWARDS)), ceremonyDone: false };
    db.saveAwards(data);
  }
  return data;
}

function saveAwards(data) { db.saveAwards(data); }

function autoFillAwards() {
  const data = getAwards();
  const league = db.getLeague();
  const squads = db.getSquads();
  const fixture = db.getFixture();
  if (!league || !league.topScorers) return data;

  function getNameById(id) {
    if (league.playerNames && league.playerNames[id]) return league.playerNames[id];
    for (const [, squad] of Object.entries(squads)) {
      if (!squad) continue;
      if (squad.roster) for (const [, p] of Object.entries(squad.roster)) { if (p && p.id === id) return p.name; }
      if (squad.members) for (const m of squad.members) { if (m.id === id) return m.name; }
    }
    return 'Bilinmiyor';
  }

  function getTeamById(id) {
    for (const [tid, squad] of Object.entries(squads)) {
      if (!squad) continue;
      if (squad.roster) for (const [, p] of Object.entries(squad.roster)) {
        if (p && p.id === id) { const t = fixture && fixture.teams ? fixture.teams.find(x => x.roleId === tid) : null; return t ? t.name : 'Bilinmiyor'; }
      }
    }
    return 'Bilinmiyor';
  }

  const scorers = Object.entries(league.topScorers).map(([id, d]) => ({ id, name: getNameById(id), team: getTeamById(id), goals: d.goals || 0, assists: d.assists || 0 }));
  const sortedGoals = [...scorers].sort((a, b) => b.goals - a.goals);
  const sortedAssists = [...scorers].sort((a, b) => b.assists - a.assists);

  let gkList = [];
  if (league.bestGK) {
    gkList = Object.entries(league.bestGK).map(([id, d]) => ({ id, name: getNameById(id), team: getTeamById(id), saves: d.saves || 0 }));
  }
  const sortedGK = [...gkList].sort((a, b) => b.saves - a.saves);

  let mostYellows = { name: 'Bilinmiyor', team: 'Bilinmiyor', count: 0 };
  let mostTackles = { name: 'Bilinmiyor', team: 'Bilinmiyor', count: 0 };

  for (const award of data.awards) {
    if (award.isTeam) continue;
    if (award.id === 'gol_krali' && sortedGoals[0]) { award.winner = sortedGoals[0].name; award.team = sortedGoals[0].team; award.value = sortedGoals[0].goals; }
    if (award.id === 'asist_krali' && sortedAssists[0]) { award.winner = sortedAssists[0].name; award.team = sortedAssists[0].team; award.value = sortedAssists[0].assists; }
    if (award.id === 'en_iyi_gk' && sortedGK[0]) { award.winner = sortedGK[0].name; award.team = sortedGK[0].team; award.value = sortedGK[0].saves; }
    if (award.id === 'en_cok_sari' && mostYellows.count > 0) { award.winner = mostYellows.name; award.team = mostYellows.team; award.value = mostYellows.count; }
    if (award.id === 'en_cok_mudahale' && mostTackles.count > 0) { award.winner = mostTackles.name; award.team = mostTackles.team; award.value = mostTackles.count; }
  }

  saveAwards(data);
  return data;
}

async function cmdOdul(message, args) {
  const CV2 = config.cv2Flag;
  const sub = (args[0] || '').toLowerCase();

  if (sub === 'baslat') {
    if (!message.member.permissions.has('Administrator')) return message.reply('❌ Bu komutu sadece yöneticiler kullanabilir.');

    const data = autoFillAwards();
    if (data.ceremonyDone) return message.reply('🏆 Ödül töreni zaten yapılmış! Tekrar yapmak için `!odul sifirla` yazın.');

    const channel = message.channel;

    const banner = new ContainerBuilder().setAccentColor(0xFFD700)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `# 🏆 ATLASLEAGUE ÖDÜL TÖRENİ\n\n` +
        `> Bu gece şampiyonlar ödüllerini alıyor!\n` +
        `> **${data.awards.length}** ödül saplerini bulacak...\n\n` +
        `> ⏳ Tören başlamak üzere...`
      ));
    await channel.send({ components: [banner], flags: CV2 });
    await sleep(3000);

    const goldEffect = new ContainerBuilder().setAccentColor(0xFFD700)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `## ✨ TÖREN BAŞLADI! ✨\n\n` +
        `> 🎵 *Heyecan dorukta...*\n` +
        `> 🥁 *Davul sesleri...*\n\n` +
        `> 🏆 **Ödül kazananlar açıklanıyor!**`
      ));
    await channel.send({ components: [goldEffect], flags: CV2 });
    await sleep(2000);

    for (let i = 0; i < data.awards.length; i++) {
      const award = data.awards[i];
      if (!award.winner) continue;

      const countdown = new ContainerBuilder().setAccentColor(0x2f3136)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
          `> 🔔 **${i + 1}. ÖDÜL**\n\n` +
          `> ⏳ *Açıklanıyor...*`
        ));
      await channel.send({ components: [countdown], flags: CV2 });
      await sleep(2000);

      const announce = new ContainerBuilder().setAccentColor(0xFFD700)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
          `# ${award.icon} ${award.name}\n\n` +
          `> ${award.description}\n\n` +
          `> 🏆 **Kazanan:** **${award.winner}**\n` +
          `> 🏷️ Takım: **${award.team || 'Bilinmiyor'}**\n` +
          (award.value ? `> 📊 Değer: **${award.value}**\n` : '') +
          `\n> 🎉 Tebrikler!`
        ));
      await channel.send({ components: [announce], flags: CV2 });
      await sleep(1500);
    }

    const leagueChamp = data.awards.find(a => a.id === 'lig_sampiyonu');
    const cupChamp = data.awards.find(a => a.id === 'kupa_sampiyonu');

    const finale = new ContainerBuilder().setAccentColor(0xFFD700)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `# 🎊 TÖREN SONA ERDİ! 🎊\n\n` +
        (leagueChamp?.winner ? `> 🏆 **Lig Şampiyonu:** ${leagueChamp.winner}\n` : '') +
        (cupChamp?.winner ? `> 🏅 **Kupa Şampiyonu:** ${cupChamp.winner}\n` : '') +
        `\n> 🎉 Tüm kazananları tebrik ediyoruz!\n` +
        `> 📅 Bir sonraki sezon görüşmek üzere!`
      ));
    await channel.send({ components: [finale], flags: CV2 });

    data.ceremonyDone = true;
    saveAwards(data);
    return;
  }

  if (sub === 'sifirla') {
    if (!message.member.permissions.has('Administrator')) return message.reply('❌ Bu komutu sadece yöneticiler kullanabilir.');
    const data = getAwards();
    data.ceremonyDone = false;
    saveAwards(data);
    return message.reply('✅ Ödül töreni sıfırlandı. Tekrar yapılabilir.');
  }

  if (sub === 'duzenle') {
    if (!message.member.permissions.has('Administrator')) return message.reply('❌ Bu komutu sadece yöneticiler kullanabilir.');
    return message.reply(
      '📝 **Ödül Düzenleme:**\n' +
      '`!odul ekle <takim_adi>` — Takım ödülü ekle\n' +
      '`!odul sil <id>` — Ödül sil\n' +
      '`!odul set <id> <kazanan> <takim>` — Kazanan ata'
    );
  }

  if (sub === 'ekle') {
    if (!message.member.permissions.has('Administrator')) return message.reply('❌ Bu komutu sadece yöneticiler kullanabilir.');
    const teamName = args.slice(1).join(' ');
    if (!teamName) return message.reply('Kullanım: `!odul ekle <takim_adi>`');
    const data = getAwards();
    const id = 'ozel_' + Date.now();
    data.awards.push({ id, name: `🏆 ${teamName} Özel Ödülü`, description: `${teamName} özel ödülü`, icon: '🏆', winner: teamName, team: teamName, value: 0, isTeam: true });
    saveAwards(data);
    return message.reply(`✅ **${teamName}** özel ödülü eklendi.`);
  }

  if (sub === 'sil') {
    if (!message.member.permissions.has('Administrator')) return message.reply('❌ Bu komutu sadece yöneticiler kullanabilir.');
    const id = args[1];
    if (!id) return message.reply('Kullanım: `!odul sil <id>`');
    const data = getAwards();
    const idx = data.awards.findIndex(a => a.id === id);
    if (idx === -1) return message.reply('❌ Ödül bulunamadı.');
    const removed = data.awards.splice(idx, 1)[0];
    saveAwards(data);
    return message.reply(`✅ **${removed.name}** ödülü silindi.`);
  }

  if (sub === 'set') {
    if (!message.member.permissions.has('Administrator')) return message.reply('❌ Bu komutu sadece yöneticiler kullanabilir.');
    const id = args[1];
    const winner = args[2];
    const team = args[3] || null;
    if (!id || !winner) return message.reply('Kullanım: `!odul set <id> <kazanan> [takim]`');
    const data = getAwards();
    const award = data.awards.find(a => a.id === id);
    if (!award) return message.reply('❌ Ödül bulunamadı.');
    award.winner = winner;
    if (team) award.team = team;
    saveAwards(data);
    return message.reply(`✅ **${award.name}** → **${winner}** olarak ayarlandı.`);
  }

  const data = autoFillAwards();

  const c = new ContainerBuilder().setAccentColor(0xFFD700)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `# 🏆 VOLDERLEAGUE ÖDÜLLERİ\n\n` +
      `> 💡 \`!odul baslat\` ile töreni başlat\n` +
      `> 📝 \`!odul duzenle\` ile ödülleri değiştir`
    ))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  for (const award of data.awards) {
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `**${award.icon} ${award.name}**\n` +
      `> ${award.description}\n` +
      `> 🏆 Kazanan: **${award.winner || 'Henüz belli değil'}** — ${award.team || ''}` +
      (award.value ? ` (${award.value})` : '')
    ));
    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
  }

  return message.channel.send({ components: [c], flags: CV2 });
}

async function cmdBallonDor(message, args) {
  const CV2 = config.cv2Flag;
  const league = db.getLeague();
  if (!league || !league.topScorers) return message.reply('📊 Henüz yeterli veri yok.');
  const squads = db.getSquads();
  const fixture = db.getFixture();

  function getNameById(id) {
    if (league.playerNames && league.playerNames[id]) return league.playerNames[id];
    for (const [tid, squad] of Object.entries(squads)) {
      if (!squad) continue;
      if (squad.roster) for (const [, p] of Object.entries(squad.roster)) { if (p && p.id === id) return p.name; }
      if (squad.members) for (const m of squad.members) { if (m.id === id) return m.name; }
    }
    return null;
  }

  function getTeamById(id) {
    for (const [tid, squad] of Object.entries(squads)) {
      if (!squad) continue;
      if (squad.roster) for (const [, p] of Object.entries(squad.roster)) {
        if (p && p.id === id) { const t = fixture && fixture.teams ? fixture.teams.find(x => x.roleId === tid) : null; return t ? t.name : 'Bilinmiyor'; }
      }
    }
    return 'Bilinmiyor';
  }

  let gkList = [];
  if (league.bestGK) {
    gkList = Object.entries(league.bestGK).map(([id, d]) => ({
      id, name: getNameById(id) || 'Bilinmiyor', team: getTeamById(id),
      saves: d.saves || 0, cleanSheets: d.cleanSheets || 0,
      score: (d.saves || 0) * 1.5 + (d.cleanSheets || 0) * 5
    }));
  }

  const fieldPlayers = Object.entries(league.topScorers).map(([id, d]) => ({
    id, name: getNameById(id) || 'Bilinmiyor', team: getTeamById(id),
    goals: d.goals || 0, assists: d.assists || 0,
    score: (d.goals || 0) * 5 + (d.assists || 0) * 0.5
  }));

  const allPlayers = [...fieldPlayers, ...gkList].sort((a, b) => b.score - a.score).slice(0, 10);
  if (allPlayers.length === 0) return message.reply('📊 Yeterli veri yok.');

  const channel = message.channel;

  const intro = new ContainerBuilder().setAccentColor(0x1a1a2e)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `# 🏆 BALLON D'OR\n\n` +
      `> ✨ Dünyanın en prestijli bireysel ödülü\n` +
      `> 🌍 VolderLeague'in en iyi 10 oyuncusu belirleniyor...\n\n` +
      `> 🥁 Heyecan dorukta...`
    ));
  await channel.send({ components: [intro], flags: CV2 });
  await sleep(3000);

  const sparkle = new ContainerBuilder().setAccentColor(0x2f3136)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `### ✨ TÖREN BAŞLADI ✨\n\n` +
      `> 🎵 *Fransızca şarkılar...*\n` +
      `> 🥁 *Davul sesleri...*\n` +
      `> 🏟️ *Stadyum dolu...*\n\n` +
      `> 🏆 **En iyi 10 oyuncu açıklanıyor!**`
    ));
  await channel.send({ components: [sparkle], flags: CV2 });
  await sleep(2500);

  const medals = ['🥉', '🥈', '🥇'];
  const medalColors = [0xCD7F32, 0xC0C0C0, 0xFFD700];

  for (let i = allPlayers.length - 1; i >= 0; i--) {
    const p = allPlayers[i];
    const rank = i + 1;
    const medal = rank <= 3 ? medals[rank - 1] : `**#${rank}**`;
    const color = rank <= 3 ? medalColors[rank - 1] : 0x2f3136;
    const isTop3 = rank <= 3;
    const title = isTop3 ? `\n# ${medal} ${rank}. SIRA\n` : `\n### ${medal} ${rank}. SIRA\n`;

    const statsText = p.goals !== undefined
      ? `⚽ ${p.goals} gol · 🅰️ ${p.assists} asist · 📊 ${p.score} puan`
      : `🧤 ${p.saves} kurtarış · 🥅 ${p.cleanSheets} GS · 📊 ${p.score} puan`;

    const countdown = new ContainerBuilder().setAccentColor(color)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `${title}` +
        `> 🏆 **${p.name}**\n` +
        `> 🏷️ ${p.team}\n` +
        `> ${statsText}`
      ));

    await channel.send({ components: [countdown], flags: CV2 });
    if (i === 0) await sleep(3000);
    else if (isTop3) await sleep(2000);
    else await sleep(1500);
  }

  await sleep(1500);

  const winner = allPlayers[0];
  const winnerAnnounce = new ContainerBuilder().setAccentColor(0xFFD700)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `# 🏆 BALLON D'OR KAZANANI\n\n` +
      `> 🥁🥁🥁\n\n` +
      `# 🌟 ${winner.name} 🌟\n\n` +
      `> 🏷️ **${winner.team}**\n` +
      `> ${winner.goals !== undefined ? `⚽ ${winner.goals} gol · 🅰️ ${winner.assists} asist` : `🧤 ${winner.saves} kurtarış · 🥅 ${winner.cleanSheets} GS`}\n` +
      `> 📊 **${winner.score} puan**\n\n` +
      `> 🎉 TEBRİKLER!\n` +
      `> 🏆 **BALLON D'OR SAHİBİNİ BULDU!**`
    ));
  await channel.send({ components: [winnerAnnounce], flags: CV2 });

  await sleep(1000);

  const allRanks = new ContainerBuilder().setAccentColor(0x1a1a2e)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `### 📊 BALLON D'OR SIRALAMASI\n\n` +
      allPlayers.map((p, i) => `**${i + 1}.** ${p.name} (${p.team}) — **${p.score}** puan`).join('\n')
    ));
  return channel.send({ components: [allRanks], flags: CV2 });
}

module.exports = { getAwards, saveAwards, autoFillAwards, cmdOdul, cmdBallonDor, DEFAULT_AWARDS };
