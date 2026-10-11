// ════════════════════════════════════════════════════════════════════════
//  VOLDER MAC BOT — Puppeteer HTML → PNG Renderer
// ════════════════════════════════════════════════════════════════════════

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const http = require('http');
const config = require('./config');

let _browser = null;

async function getBrowser() {
  if (!_browser || !_browser.connected) {
    _browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });
  }
  return _browser;
}

async function renderHtmlToImage(html, width, height) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  const tmpFile = path.join(os.tmpdir(), 'render_' + Date.now() + '_' + Math.random().toString(36).slice(2) + '.html');
  fs.writeFileSync(tmpFile, html, 'utf8');
  try {
    await page.setViewport({ width, height: 800, deviceScaleFactor: 2 });
    await page.goto('file:///' + tmpFile.replace(/\\/g, '/'), { waitUntil: 'networkidle0', timeout: 15000 });
    await new Promise(r => setTimeout(r, 800));
    const buf = await page.screenshot({ type: 'png', fullPage: true });
    return buf;
  } finally {
    await page.close().catch(() => {});
    try { fs.unlinkSync(tmpFile); } catch (e) {}
  }
}

async function closeBrowser() {
  if (_browser) {
    try { await _browser.close(); } catch (e) {}
    _browser = null;
  }
}

// ── Emoji helpers ──
const emojiTmpDir = path.join(os.tmpdir(), 'bot_emojis');
if (!fs.existsSync(emojiTmpDir)) fs.mkdirSync(emojiTmpDir, { recursive: true });

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { headers: { 'Authorization': 'Bot ' + config.token } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchBuffer(res.headers.location).then(resolve, reject);
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function escEmoji(emoji, size) {
  if (!emoji) return '';
  const s = size || 32;
  const dm = emoji.match(/^<(a?):([^:]+):(\d+)>$/);
  if (dm) {
    try {
      const ext = dm[1] === 'a' ? 'gif' : 'png';
      const filePath = path.join(emojiTmpDir, dm[3] + '.' + ext);
      if (!fs.existsSync(filePath) || fs.statSync(filePath).size < 200) {
        const buf = await fetchBuffer('https://cdn.discordapp.com/emojis/' + dm[3] + '.' + ext + '?size=' + s);
        fs.writeFileSync(filePath, buf);
      }
      const raw = fs.readFileSync(filePath);
      const b64 = raw.toString('base64');
      const mime = ext === 'gif' ? 'image/gif' : 'image/png';
      return '<img class="cemoji" src="data:' + mime + ';base64,' + b64 + '" width="' + s + '" height="' + s + '">';
    } catch (e) {
      return '<span style="font-size:' + s + 'px;line-height:1;">' + emoji + '</span>';
    }
  }
  return '<span style="font-size:' + s + 'px;line-height:1;">' + emoji + '</span>';
}

// ── Shared CSS ──
const BASE_CSS = `* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: 'Segoe UI','Helvetica Neue',Arial,sans-serif; -webkit-font-smoothing:antialiased; overflow:hidden; background:transparent; display:flex; justify-content:center; align-items:flex-start; }
img.emoji { height:1em; width:1em; margin:0 .05em 0 .1em; vertical-align:-0.15em; display:inline; }
`;

const TWEMOJI = '<script src="https://cdn.jsdelivr.net/npm/twemoji@14.0.2/dist/twemoji.min.js" crossorigin="anonymous"></script><script>document.addEventListener("DOMContentLoaded",function(){twemoji.parse(document.body,{folder:"svg",ext:".svg"})});</script>';
const EMOJICSS = '<style>img.emoji{height:1em;width:1em;margin:0 .05em 0 .1em;vertical-align:-0.15em;display:inline;}img.cemoji{object-fit:contain;vertical-align:middle;}</style>';

// ════════════════════════════════════════════════════════════════════════
//  MAC SONUCU
// ════════════════════════════════════════════════════════════════════════
async function renderMatchResult(match) {
  const W = 1000, H = 720;
  const hg = match.goals.filter(g => g.team === 'home');
  const ag = match.goals.filter(g => g.team === 'away');
  const te = (match.stats._events?.home || 0) + (match.stats._events?.away || 0) || 1;
  const hp = Math.round(((match.stats._events?.home || 0) / te) * 100);
  const ap = 100 - hp;

  const gHtml = (goals) => {
    if (!goals.length) return '<div style="color:#555;font-style:italic;font-size:13px;padding:6px 0;">Gol yok</div>';
    return goals.map(g => '<div style="padding:5px 0;font-size:13px;color:#ddd;border-bottom:1px solid rgba(255,255,255,0.04);">⚽ <strong style="color:#fff;">' + g.scorer + '</strong> <span style="color:#f1c40f;font-weight:700;">' + g.minute + '</span>' + (g.meter ? ' <span style="color:#777;">[' + g.meter + 'm]</span>' : '') + ' — 🅰️ ' + (g.assist || '-') + '</div>').join('');
  };
  const cHtml = match.cards.length ? match.cards.map(c => '<div style="padding:3px 0;font-size:12px;color:#ccc;">' + (c.type === 'kırmızı' ? '🟥' : '🟨') + ' <strong>' + c.player + '</strong> — ' + c.minute + ' dk</div>').join('') : '<div style="font-size:12px;color:#555;">Olay yok</div>';
  const iHtml = match.injuries.length ? match.injuries.map(i => '<div style="padding:3px 0;font-size:12px;color:#ccc;">🤕 <strong>' + i.player + '</strong> — ' + i.minute + ' dk</div>').join('') : '';

  const html = '<!DOCTYPE html><html><head><meta charset="utf-8">' + TWEMOJI + EMOJICSS + '<style>' + BASE_CSS + `
body { display:flex; justify-content:center; align-items:flex-start; }
.wrap { width:${W}px; height:${H}px; background:linear-gradient(145deg,#0b0f1a,#151d35 40%,#0b0f1a); border-radius:16px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 8px 32px rgba(0,0,0,0.5); }
.hdr { background:linear-gradient(90deg,#c0392b,#1a1a2e 35%,#1a1a2e 65%,#2980b9); padding:20px 30px 16px; text-align:center; position:relative; }
.hdr::after { content:''; position:absolute; bottom:0; left:10%; right:10%; height:1px; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.15),transparent); }
.hdr .label { font-size:11px; color:rgba(255,255,255,0.4); letter-spacing:5px; text-transform:uppercase; }
.srow { display:flex; justify-content:center; align-items:center; gap:20px; margin-top:10px; }
.tname { font-size:20px; font-weight:800; color:#fff; max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.scr { font-size:54px; font-weight:900; color:#f1c40f; text-shadow:0 0 24px rgba(241,196,15,0.3); letter-spacing:4px; }
.sub { font-size:12px; color:#888; margin-top:8px; letter-spacing:1px; }
.body { display:flex; flex:1; overflow:hidden; }
.col { flex:1; padding:16px 22px; }
.col-t { font-size:13px; font-weight:700; margin-bottom:10px; padding-bottom:7px; border-bottom:2px solid; display:flex; align-items:center; gap:5px; }
.tlbl { font-size:12px; font-weight:700; margin:7px 0 3px; }
.srow2 { display:flex; justify-content:space-between; padding:4px 0; font-size:11.5px; border-bottom:1px solid rgba(255,255,255,0.03); }
.slbl { color:#666; width:90px; }
.sh { color:#e74c3c; font-weight:600; flex:1; text-align:center; }
.sa { color:#3498db; font-weight:600; flex:1; text-align:center; }
.barw { display:flex; height:4px; background:rgba(255,255,255,0.04); border-radius:2px; margin:2px 0 5px; overflow:hidden; }
.barh { background:linear-gradient(90deg,#e74c3c,#c0392b); }
.bara { background:linear-gradient(90deg,#2980b9,#3498db); }
.evt { padding:10px 22px; border-top:1px solid rgba(255,255,255,0.05); }
.ftr { padding:7px; text-align:center; color:#333; font-size:10px; background:rgba(0,0,0,0.4); }
` + '</style></head><body><div class="wrap">' +
  '<div class="hdr"><div class="label">MAÇ SONUCU</div><div class="srow"><div class="tname" style="text-align:right;">' + match.teams.home.name + '</div><div class="scr">' + match.score.home + ' - ' + match.score.away + '</div><div class="tname" style="text-align:left;">' + match.teams.away.name + '</div></div><div class="sub">' + (match.penaltyWinner ? '⚽ PENALTI — ' + match.teams[match.penaltyWinner].name + ' KAZANDI!' : '⚽ VOLDER MAC BOT') + '</div></div>' +
  '<div class="body"><div class="col"><div class="col-t" style="color:#e74c3c;border-color:#e74c3c;">⚽ GOLLER</div><div class="tlbl" style="color:#e74c3c;">▸ ' + match.teams.home.name + '</div>' + gHtml(hg) + '<div class="tlbl" style="color:#3498db;margin-top:8px;">▸ ' + match.teams.away.name + '</div>' + gHtml(ag) + '</div>' +
  '<div class="col"><div class="col-t" style="color:#2ecc71;border-color:#2ecc71;">📊 İSTATİSTİKLER</div>' +
  '<div class="srow2"><span class="slbl">Topa Oynama</span><span class="sh">' + hp + '%</span><span class="sa">' + ap + '%</span></div><div class="barw"><div class="barh" style="width:' + hp + '%"></div><div class="bara" style="width:' + ap + '%"></div></div>' +
  '<div class="srow2"><span class="slbl">Şut (İsabetli)</span><span class="sh">' + (match.stats.home.shots||0) + ' (' + (match.stats.home.shotsOnTarget||0) + ')</span><span class="sa">' + (match.stats.away.shots||0) + ' (' + (match.stats.away.shotsOnTarget||0) + ')</span></div>' +
  '<div class="srow2"><span class="slbl">Pas (Başarılı)</span><span class="sh">' + (match.stats.home.totalPass||0) + ' (' + (match.stats.home.successPass||0) + ')</span><span class="sa">' + (match.stats.away.totalPass||0) + ' (' + (match.stats.away.successPass||0) + ')</span></div>' +
  '<div class="srow2"><span class="slbl">Çalım</span><span class="sh">' + (match.stats.home.dribbles||0) + '</span><span class="sa">' + (match.stats.away.dribbles||0) + '</span></div>' +
  '<div class="srow2"><span class="slbl">Kurtarış</span><span class="sh">' + (match.stats.home.saves||0) + '</span><span class="sa">' + (match.stats.away.saves||0) + '</span></div></div></div>' +
  '<div class="evt"><div class="col-t" style="color:#e67e22;border-color:#e67e22;font-size:12px;">📋 MAÇ İÇİ OLAYLAR</div>' + cHtml + iHtml + '</div>' +
  '<div class="ftr">VOLDER MAC BOT</div></div></body></html>';
  return renderHtmlToImage(html, W, H);
}

// ════════════════════════════════════════════════════════════════════════
//  PUAN DURUMU
// ════════════════════════════════════════════════════════════════════════
async function renderLeagueTable(data, leagueName, teamEmojiMap = {}) {
  const sorted = Object.entries(data.teams).sort((a, b) => b[1].points - a[1].points || (b[1].gf - b[1].ga) - (a[1].gf - a[1].ga));
  const W = 1000;
  const HDR_H = 150, ROW_H = 58, FTR_H = 40, PAD = 16;
  const H = HDR_H + (sorted.length > 0 ? sorted.length * ROW_H : 80) + FTR_H + PAD;

  const rowsHtml = (await Promise.all(sorted.map(async ([n, t], i) => {
    const emoji = teamEmojiMap[n] || '⚽';
    const gd = t.gf - t.ga;
    const gdStr = gd > 0 ? '+' + gd : String(gd);
    const gdColor = gd > 0 ? '#16db65' : gd < 0 ? '#e74c3c' : '#666';
    const rank = i + 1;
    let rankBg, rankColor, rankBorder;
    if (i === 0) { rankBg = 'linear-gradient(135deg,#FFD700,#B8860B)'; rankColor = '#fff'; rankBorder = '2px solid #FFD700'; }
    else if (i === 1) { rankBg = 'linear-gradient(135deg,#C0C0C0,#808080)'; rankColor = '#fff'; rankBorder = '2px solid #C0C0C0'; }
    else if (i === 2) { rankBg = 'linear-gradient(135deg,#CD7F32,#8B4513)'; rankColor = '#fff'; rankBorder = '2px solid #CD7F32'; }
    else { rankBg = 'rgba(255,255,255,0.04)'; rankColor = 'rgba(245,249,252,0.5)'; rankBorder = '1px solid rgba(255,255,255,0.06)'; }

    const rowBg = i < 3
      ? 'background:linear-gradient(90deg,' + ['#FFD700','#C0C0C0','#CD7F32'][i] + '08,transparent);'
      : (i % 2 === 0 ? 'background:rgba(255,255,255,0.015);' : '');

    const barWidth = t.played > 0 ? Math.round((t.points / (t.played * 3)) * 100) : 0;
    const barColor = i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : 'rgba(22,219,101,0.5)';
    const emojiImg = await escEmoji(emoji, 36);

    return '<div class="row" style="' + rowBg + '">' +
      '<div class="rank" style="background:' + rankBg + ';color:' + rankColor + ';border:' + rankBorder + ';">' + rank + '</div>' +
      '<div class="team-info"><div class="team-emoji">' + emojiImg + '</div><div class="team-name">' + n + '</div></div>' +
      '<div class="stat"><div class="stat-val">' + t.played + '</div><div class="stat-lbl">OYN</div></div>' +
      '<div class="stat"><div class="stat-val" style="color:#16db65;">' + t.won + '</div><div class="stat-lbl">GAL</div></div>' +
      '<div class="stat"><div class="stat-val" style="color:#f5a623;">' + t.drawn + '</div><div class="stat-lbl">BER</div></div>' +
      '<div class="stat"><div class="stat-val" style="color:#e74c3c;">' + t.lost + '</div><div class="stat-lbl">MAĞ</div></div>' +
      '<div class="stat"><div class="stat-val" style="color:' + gdColor + ';">' + gdStr + '</div><div class="stat-lbl">AV</div></div>' +
      '<div class="stat"><div class="stat-val" style="color:#666;">' + t.gf + ':' + t.ga + '</div><div class="stat-lbl">AT/YE</div></div>' +
      '<div class="points-col"><div class="points-val">' + t.points + '</div><div class="points-lbl">PUAN</div></div>' +
      '<div class="bar-wrap"><div class="bar" style="width:' + barWidth + '%;background:' + barColor + ';"></div></div>' +
      '</div>';
  }))).join('');

  const html = '<!DOCTYPE html><html><head><meta charset="utf-8">' + TWEMOJI + EMOJICSS + '<style>' + BASE_CSS + `
html,body{margin:0;padding:0;background:transparent;}
.card{width:${W}px;background:linear-gradient(160deg,#030712,#0a1330 40%,#101d42 70%,#030712);border-radius:20px;overflow:hidden;border:1px solid rgba(22,219,101,0.2);box-shadow:0 0 0 1px rgba(255,255,255,0.03) inset,0 24px 60px rgba(0,0,0,0.5);position:relative;}
.card::before{content:"";position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,#FFD700,#f5f9fc,#FFD700,transparent);opacity:0.8;}
.hdr{padding:28px 24px 22px;text-align:center;border-bottom:1px solid rgba(22,219,101,0.15);position:relative;}
.hdr-icon{font-size:32px;margin-bottom:4px;}
.hdr-sub{font-size:10px;color:#16db65;letter-spacing:6px;font-weight:800;opacity:0.7;}
.hdr-title{font-size:30px;font-weight:900;color:#f5f9fc;margin:6px 0 10px;text-shadow:0 0 24px rgba(22,219,101,0.3);}
.hdr-badge{display:inline-block;background:linear-gradient(135deg,rgba(255,215,0,0.2),rgba(22,219,101,0.1));border:1px solid rgba(255,215,0,0.4);padding:5px 24px;border-radius:18px;font-size:12px;font-weight:800;color:#FFD700;letter-spacing:1.5px;}
.cols{display:flex;align-items:center;padding:12px 20px 8px;border-bottom:1px solid rgba(22,219,101,0.1);}
.col{font-size:9px;color:rgba(245,249,252,0.35);font-weight:700;letter-spacing:2px;text-transform:uppercase;text-align:center;}
.col-rank{width:50px;}.col-team{flex:1;text-align:left;padding-left:8px;}.col-stat{width:56px;}.col-pts{width:80px;}.col-bar{width:100px;}
.row{position:relative;display:flex;align-items:center;padding:10px 20px;margin:2px 12px;border-radius:12px;}
.rank{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px;flex-shrink:0;}
.team-info{flex:1;display:flex;align-items:center;gap:10px;min-width:0;padding-left:8px;}
.team-emoji{width:36px;height:36px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.team-name{font-size:15px;font-weight:700;color:#f5f9fc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:240px;}
.stat{width:56px;text-align:center;flex-shrink:0;}
.stat-val{font-size:15px;font-weight:700;color:#f5f9fc;}
.stat-lbl{font-size:8px;color:rgba(245,249,252,0.25);letter-spacing:1px;margin-top:1px;}
.points-col{width:80px;text-align:center;flex-shrink:0;}
.points-val{font-size:22px;font-weight:900;color:#FFD700;text-shadow:0 0 12px rgba(255,215,0,0.3);}
.points-lbl{font-size:8px;color:rgba(255,215,0,0.3);letter-spacing:1px;margin-top:1px;}
.bar-wrap{width:100px;height:6px;background:rgba(255,255,255,0.05);border-radius:3px;overflow:hidden;flex-shrink:0;}
.bar{height:100%;border-radius:3px;}
.ftr{text-align:center;padding:12px;color:rgba(245,249,252,0.2);font-size:9px;letter-spacing:1.5px;border-top:1px solid rgba(22,219,101,0.1);}
` + '</style></head><body><div class="card"><div class="hdr"><div class="hdr-icon">🏆</div><div class="hdr-sub">PUAN DURUMU</div><div class="hdr-title">' + (leagueName || 'LİG') + '</div><div class="hdr-badge">' + sorted.length + ' TAKIM • ' + Math.floor(sorted.reduce((s, [, t]) => s + t.played, 0) / 2) + ' MAÇ</div></div><div class="cols"><div class="col col-rank">#</div><div class="col col-team">TAKIM</div><div class="col col-stat">OYN</div><div class="col col-stat">GAL</div><div class="col col-stat">BER</div><div class="col col-stat">MAĞ</div><div class="col col-stat">AV</div><div class="col col-stat">AT/YE</div><div class="col col-pts">PUAN</div><div class="col col-bar">FORM</div></div>' + rowsHtml + '<div class="ftr">Galibiyet: 3 Puan • Beraberlik: 1 Puan • Mağlubiyet: 0 Puan</div></div></body></html>';
  return renderHtmlToImage(html, W, H);
}

// ════════════════════════════════════════════════════════════════════════
//  KRALLIKLAR
// ════════════════════════════════════════════════════════════════════════
async function renderKingBoard(title, entries, color, icon, playerNames = {}) {
  const W = 800;
  const HDR_H = 140, ROW_H = 60, FTR_H = 36;
  const H = HDR_H + (entries.length > 0 ? entries.length * ROW_H : 60) + FTR_H + 12;
  const M = ['#FFD700','#C0C0C0','#CD7F32'];
  const maxVal = entries.length > 0 ? (entries[0][2] || 0) : 1;

  const rowsHtml = entries.map(([id, val1, val2, rawVal], i) => {
    const rank = i + 1;
    let rankBg, rankColor, rankBorder;
    if (i === 0) { rankBg = 'linear-gradient(135deg,#FFD700,#B8860B)'; rankColor = '#fff'; rankBorder = '2px solid #FFD700'; }
    else if (i === 1) { rankBg = 'linear-gradient(135deg,#C0C0C0,#808080)'; rankColor = '#fff'; rankBorder = '2px solid #C0C0C0'; }
    else if (i === 2) { rankBg = 'linear-gradient(135deg,#CD7F32,#8B4513)'; rankColor = '#fff'; rankBorder = '2px solid #CD7F32'; }
    else { rankBg = 'rgba(255,255,255,0.04)'; rankColor = 'rgba(245,249,252,0.5)'; rankBorder = '1px solid rgba(255,255,255,0.06)'; }

    const rowBg = i < 3
      ? 'background:linear-gradient(90deg,' + M[i] + '08,transparent);'
      : (i % 2 === 0 ? 'background:rgba(255,255,255,0.015);' : '');

    const barPct = maxVal > 0 ? Math.round(((rawVal || 0) / maxVal) * 100) : 0;
    const barColor = i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : color;
    const pName = playerNames[id] || 'Oyuncu';

    return '<div class="row" style="' + rowBg + '">' +
      '<div class="rank" style="background:' + rankBg + ';color:' + rankColor + ';border:' + rankBorder + ';">' + rank + '</div>' +
      '<div class="player-info"><div class="player-name">' + pName + '</div></div>' +
      '<div class="stat-col"><div class="stat-main" style="color:' + color + ';">' + val1 + '</div>' + (val2 ? '<div class="stat-sub">' + val2 + '</div>' : '') + '</div>' +
      '<div class="bar-wrap"><div class="bar" style="width:' + barPct + '%;background:' + barColor + ';"></div></div>' +
      '</div>';
  }).join('');

  const html = '<!DOCTYPE html><html><head><meta charset="utf-8">' + TWEMOJI + EMOJICSS + '<style>' + BASE_CSS + `
html,body{margin:0;padding:0;background:transparent;}
.card{width:${W}px;background:linear-gradient(160deg,#030712,#0a1330 40%,#101d42 70%,#030712);border-radius:20px;overflow:hidden;border:1px solid rgba(22,219,101,0.2);box-shadow:0 0 0 1px rgba(255,255,255,0.03) inset,0 24px 60px rgba(0,0,0,0.5);position:relative;}
.card::before{content:"";position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,${color},#f5f9fc,${color},transparent);opacity:0.8;}
.hdr{padding:28px 24px 22px;text-align:center;border-bottom:1px solid ${color}22;position:relative;}
.hdr-icon{font-size:34px;margin-bottom:4px;}
.hdr-sub{font-size:10px;color:${color};letter-spacing:6px;font-weight:800;opacity:0.7;}
.hdr-title{font-size:28px;font-weight:900;color:#f5f9fc;margin:6px 0 10px;text-shadow:0 0 24px ${color}33;}
.hdr-badge{display:inline-block;background:linear-gradient(135deg,${color}22,${color}11);border:1px solid ${color}44;padding:5px 24px;border-radius:18px;font-size:12px;font-weight:800;color:${color};letter-spacing:1.5px;}
.row{position:relative;display:flex;align-items:center;padding:10px 20px;margin:2px 12px;border-radius:12px;}
.rank{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px;flex-shrink:0;}
.player-info{flex:1;display:flex;flex-direction:column;gap:2px;min-width:0;padding-left:14px;}
.player-name{font-size:15px;font-weight:700;color:#f5f9fc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:260px;}
.stat-col{width:200px;text-align:right;flex-shrink:0;padding-right:16px;}
.stat-main{font-size:16px;font-weight:800;}
.stat-sub{font-size:11px;color:rgba(245,249,252,0.35);margin-top:1px;}
.bar-wrap{width:120px;height:6px;background:rgba(255,255,255,0.05);border-radius:3px;overflow:hidden;flex-shrink:0;}
.bar{height:100%;border-radius:3px;}
.ftr{text-align:center;padding:10px;color:rgba(245,249,252,0.2);font-size:9px;letter-spacing:1.5px;border-top:1px solid ${color}15;}
` + '</style></head><body><div class="card"><div class="hdr"><div class="hdr-icon">' + (icon || '🏆') + '</div><div class="hdr-sub">KRALLIKLAR</div><div class="hdr-title">' + title + '</div><div class="hdr-badge">' + entries.length + ' OYUNCU</div></div>' + rowsHtml + '<div class="ftr">İstatistikler maçlar sonucunda güncellenir</div></div></body></html>';
  return renderHtmlToImage(html, W, H);
}

// ════════════════════════════════════════════════════════════════════════
//  KADRO CANVAS
// ════════════════════════════════════════════════════════════════════════
async function renderSquad(teamName, teamEmoji, formation, playStyle, roster, tasks, FORMATIONS, PLAY_STYLES, PITCH_POSITIONS, POS_FULL_NAMES) {
  const style = PLAY_STYLES[playStyle] || PLAY_STYLES['possession'];
  const f = FORMATIONS[formation] || FORMATIONS['4-3-3'];
  const W = 900, H = 1050;
  if (!tasks) tasks = {};

  const emojiImg = await escEmoji(teamEmoji || '⚽', 56);
  const posOrder = ['KL', 'STP', 'SĞB', 'SLB', 'OS', 'OOS', 'SĞKNT', 'SLKNT', 'SNT'];
  const playersHtml = [];

  for (const pos of posOrder) {
    const count = f.positions[pos] || 0;
    if (count === 0) continue;
    const base = PITCH_POSITIONS[pos];

    for (let i = 1; i <= count; i++) {
      const key = count === 1 ? pos : pos + i;
      const p = roster && roster[key];
      const pName = p && !p.isNpc ? (p.name || '—') : '—';
      const isNpc = p && p.isNpc;
      const hasTask = tasks[key] && tasks[key] !== 'NONE';
      const taskIcons = { kaptan: '©️', penalti: '⚽', uzakFrikik: '🔄', yakinFrikik: '📍', korner: '🏳️', santra: '⭐' };
      const taskIcon = hasTask ? (taskIcons[tasks[key]] || '⭐') : '';

      let px = base.x;
      if (count > 1) px += (i - (count + 1) / 2) * 14;

      playersHtml.push(
        '<div style="position:absolute;left:' + px + '%;top:' + base.y + '%;transform:translate(-50%,-50%);text-align:center;z-index:3;">' +
          '<div style="position:relative;width:54px;height:54px;margin:0 auto;">' +
            '<div style="position:absolute;inset:-3px;border-radius:50%;background:radial-gradient(circle,' + base.col + '55,transparent 70%);filter:blur(4px);"></div>' +
            '<div style="position:relative;width:54px;height:54px;border-radius:50%;background:linear-gradient(145deg,' + base.col + ',' + base.col + 'bb);border:3px solid rgba(255,255,255,0.9);box-shadow:0 4px 20px ' + base.col + '66,0 0 40px ' + base.col + '22;display:flex;align-items:center;justify-content:center;">' +
              '<span style="color:#fff;font-size:11px;font-weight:900;text-shadow:0 1px 2px rgba(0,0,0,0.3);">' + pos + (count > 1 ? i : '') + '</span>' +
            '</div>' +
            (taskIcon ? '<div style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:#030712;border:2px solid ' + base.col + ';display:flex;align-items:center;justify-content:center;font-size:10px;z-index:4;">' + taskIcon + '</div>' : '') +
          '</div>' +
          '<div style="margin-top:5px;font-size:11px;font-weight:800;color:#fff;text-shadow:0 1px 6px rgba(0,0,0,0.9),0 0 12px rgba(0,0,0,0.5);white-space:nowrap;max-width:100px;overflow:hidden;text-overflow:ellipsis;letter-spacing:0.5px;">' + (isNpc ? '🤖 NPC' : pName) + '</div>' +
          '<div style="font-size:8px;color:' + base.col + ';font-weight:700;letter-spacing:1px;margin-top:1px;text-transform:uppercase;">' + (POS_FULL_NAMES[pos] || pos) + '</div>' +
        '</div>'
      );
    }
  }

  const attrBarHtml = [
    { label: 'HÜC', val: style.attrs.attack, icon: '⚔️', col: '#ff4757' },
    { label: 'SVN', val: style.attrs.defense, icon: '🛡️', col: '#3742fa' },
    { label: 'TMP', val: style.attrs.tempo, icon: '⚡', col: '#ffa502' },
    { label: 'PRS', val: style.attrs.pressing, icon: '🔥', col: '#2ed573' }
  ].map(a =>
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">' +
      '<span style="font-size:12px;">' + a.icon + '</span>' +
      '<span style="font-size:10px;font-weight:700;color:rgba(255,255,255,0.5);width:28px;">' + a.label + '</span>' +
      '<div style="flex:1;height:8px;background:rgba(255,255,255,0.06);border-radius:4px;overflow:hidden;position:relative;">' +
        '<div style="width:' + a.val + '%;height:100%;background:linear-gradient(90deg,' + a.col + 'cc,' + a.col + ');border-radius:4px;box-shadow:0 0 8px ' + a.col + '44;"></div>' +
      '</div>' +
      '<span style="font-size:13px;font-weight:900;color:' + a.col + ';width:28px;text-align:right;text-shadow:0 0 8px ' + a.col + '44;">' + a.val + '</span>' +
    '</div>'
  ).join('');

  const html = '<!DOCTYPE html><html><head><meta charset="utf-8">' + TWEMOJI + EMOJICSS + '<style>' + BASE_CSS + `
html,body{margin:0;padding:0;background:transparent;}
*{box-sizing:border-box;}
.card{width:${W}px;background:linear-gradient(170deg,#020810 0%,#0a1628 20%,#0d1f3c 45%,#0a1628 75%,#020810 100%);border-radius:24px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);box-shadow:0 0 80px rgba(0,0,0,0.6),0 0 0 1px rgba(255,255,255,0.03) inset;position:relative;}
.card::before{content:"";position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent 5%,${style.color}88,${style.color},${style.color}88,transparent 95%);z-index:10;}
.hdr{position:relative;padding:28px 32px 20px;display:flex;align-items:center;gap:20px;overflow:hidden;}
.hdr::before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at 30% 50%,${style.color}11,transparent 70%);z-index:0;}
.team-badge{position:relative;z-index:1;width:68px;height:68px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:linear-gradient(145deg,${style.color}22,${style.color}08);border:2px solid ${style.color}55;box-shadow:0 0 30px ${style.color}22,0 4px 16px rgba(0,0,0,0.3);flex-shrink:0;}
.hdr-info{position:relative;z-index:1;flex:1;}
.hdr-league{font-size:9px;color:${style.color};letter-spacing:6px;font-weight:800;opacity:0.6;text-transform:uppercase;}
.hdr-name{font-size:30px;font-weight:900;color:#fff;margin:4px 0 8px;letter-spacing:-0.5px;text-shadow:0 2px 12px rgba(0,0,0,0.4);}
.hdr-tags{display:flex;gap:8px;flex-wrap:wrap;}
.hdr-tag{background:linear-gradient(135deg,${style.color}22,${style.color}0a);border:1px solid ${style.color}33;padding:4px 14px;border-radius:16px;font-size:11px;font-weight:700;color:${style.color};letter-spacing:0.5px;}
.hdr-tag.style-tag{background:linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02));border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.7);}
.pitch-wrap{position:relative;margin:0 24px;border-radius:16px;overflow:hidden;border:2px solid rgba(255,255,255,0.1);box-shadow:0 0 40px rgba(0,0,0,0.4),inset 0 0 60px rgba(0,0,0,0.2);}
.pitch{position:relative;width:100%;height:580px;background:repeating-linear-gradient(180deg,rgba(30,120,30,0.3) 0px,rgba(30,120,30,0.3) 20px,rgba(35,130,35,0.3) 20px,rgba(35,130,35,0.3) 40px),linear-gradient(180deg,#1a5e1a 0%,#1f6b1f 25%,#1a5e1a 50%,#1f6b1f 75%,#1a5e1a 100%);}
.pitch-line{position:absolute;background:rgba(255,255,255,0.25);}
.pitch-h{left:8%;right:8%;height:2px;top:50%;}
.pitch-center-circle{position:absolute;top:50%;left:50%;width:90px;height:90px;border:2px solid rgba(255,255,255,0.25);border-radius:50%;transform:translate(-50%,-50%);}
.pitch-center-dot{position:absolute;top:50%;left:50%;width:8px;height:8px;background:rgba(255,255,255,0.35);border-radius:50%;transform:translate(-50%,-50%);}
.pen-top{position:absolute;top:0;left:22%;right:22%;height:15%;border:2px solid rgba(255,255,255,0.25);border-top:none;}
.pen-bot{position:absolute;bottom:0;left:22%;right:22%;height:15%;border:2px solid rgba(255,255,255,0.25);border-bottom:none;}
.gol-top{position:absolute;top:0;left:36%;right:36%;height:5%;border:2px solid rgba(255,255,255,0.25);border-top:none;}
.gol-bot{position:absolute;bottom:0;left:36%;right:36%;height:5%;border:2px solid rgba(255,255,255,0.25);border-bottom:none;}
.grp-label{position:absolute;left:4%;z-index:2;font-size:9px;font-weight:800;letter-spacing:3px;color:rgba(255,255,255,0.15);text-transform:uppercase;writing-mode:vertical-rl;text-orientation:mixed;transform:rotate(180deg);}
.bottom{padding:20px 28px 16px;display:grid;grid-template-columns:1fr 1fr;gap:20px;}
.sec{background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.04);border-radius:14px;padding:16px 18px;}
.sec-title{font-size:9px;color:${style.color};letter-spacing:4px;font-weight:800;margin-bottom:12px;opacity:0.6;text-transform:uppercase;}
.ftr{text-align:center;padding:12px;color:rgba(255,255,255,0.15);font-size:9px;letter-spacing:2px;border-top:1px solid rgba(255,255,255,0.04);}
` + '</style></head><body><div class="card">' +
'<div class="hdr"><div class="team-badge">' + emojiImg + '</div><div class="hdr-info"><div class="hdr-league">KADRO ANALİZ</div><div class="hdr-name">' + teamName + '</div><div class="hdr-tags"><div class="hdr-tag">' + formation + '</div><div class="hdr-tag style-tag">' + style.icon + ' ' + style.name + '</div><div class="hdr-tag style-tag">' + Object.values(f.positions).reduce((a,b)=>a+b,0) + ' Oyuncu</div></div></div></div>' +
'<div class="pitch-wrap"><div class="pitch">' +
  '<div class="pitch-line pitch-h"></div><div class="pitch-center-circle"></div><div class="pitch-center-dot"></div>' +
  '<div class="pen-top"></div><div class="pen-bot"></div><div class="gol-top"></div><div class="gol-bot"></div>' +
  '<div class="grp-label" style="top:70%;">KL</div><div class="grp-label" style="top:52%;">SAVUNMA</div><div class="grp-label" style="top:30%;">ORTASaha</div><div class="grp-label" style="top:14%;">HÜCUM</div>' +
  playersHtml.join('') +
'</div></div>' +
'<div class="bottom"><div class="sec"><div class="sec-title">📊 TAKTİKLER</div>' + attrBarHtml + '</div>' +
'<div class="sec"><div class="sec-title">📋 GÖREVLER</div>' +
(function(){
  const taskIcons = { kaptan: '©️ Kaptan', penalti: '⚽ Penaltı', uzakFrikik: '🔄 Uzak Frikik', yakinFrikik: '📍 Yakın Frikik', korner: '🏳️ Köşe', santra: '⭐ Santra' };
  const entries = Object.entries(tasks).filter(([k,v]) => v && v !== 'NONE');
  if (entries.length === 0) return '<div style="font-size:11px;color:rgba(255,255,255,0.25);font-style:italic;">Henüz görev atanmamış</div>';
  return entries.map(([k,v]) => '<div style="font-size:12px;color:rgba(255,255,255,0.7);margin-bottom:5px;font-weight:600;"><span style="color:' + style.color + ';">' + (taskIcons[k] || k) + '</span> → ' + v + '</div>').join('');
})() +
'</div></div>' +
'<div class="ftr">' + teamName + ' — ' + formation + ' • ' + style.icon + ' ' + style.name + '</div>' +
'</div></body></html>';

  return renderHtmlToImage(html, W, H);
}

// ════════════════════════════════════════════════════════════════════════
//  FIXTUR
// ════════════════════════════════════════════════════════════════════════
async function renderFixture(fixture, weekNum) {
  const wd = fixture.fixtures.find(r => r.week === weekNum);
  if (!wd) return null;
  const W = 1200, mc = wd.matches.length;
  const ROW_H = 130, HDR_H = 170, FTR_H = 48, PAD = 18;
  const H = HDR_H + (mc > 0 ? mc * ROW_H : 60) + FTR_H + PAD;

  const mHtmlArr = await Promise.all(wd.matches.map(async (m, i) => {
    const played = !!m.played;
    const badge = played ? '<div class="pbadge">OYNANDI</div>' : '';
    const sv = played && m.result ? '<div class="sc">' + m.result + '</div>' : '<div class="vs">VS</div>';
    const eH = await escEmoji(m.home.emoji || '⚽', 48);
    const eA = await escEmoji(m.away.emoji || '⚽', 48);

    return '<div class="row' + (played ? ' rp' : '') + '">' +
      '<div class="idx">' + (i+1) + '</div>' +
      '<div class="side sh"><div class="tn">' + m.home.name + '</div><div class="av avh">' + eH + '</div></div>' +
      '<div class="sbx">' + sv + '</div>' +
      '<div class="side sa"><div class="av ava">' + eA + '</div><div class="tn">' + m.away.name + '</div></div>' +
      badge + '</div>';
  }));

  const html = '<!DOCTYPE html><html><head><meta charset="utf-8">' + TWEMOJI + EMOJICSS + '<style>' + BASE_CSS + `
html,body{margin:0;padding:0;background:transparent;}
.c{width:${W}px;background:linear-gradient(160deg,#030712,#0a1330 45%,#101d42 75%,#030712);border-radius:20px;overflow:hidden;border:1px solid rgba(22,219,101,0.2);box-shadow:0 0 0 1px rgba(255,255,255,0.03) inset,0 20px 60px rgba(0,0,0,0.5);position:relative;}
.c::before{content:"";position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,#16db65,#f5f9fc,#16db65,transparent);opacity:0.8;}
.h{padding:30px 20px 22px;text-align:center;border-bottom:1px solid rgba(22,219,101,0.18);position:relative;}
.ht{font-size:12px;color:#16db65;letter-spacing:7px;font-weight:800;opacity:0.8;}
.hh{font-size:36px;font-weight:900;color:#f5f9fc;margin:8px 0 14px;text-shadow:0 0 28px rgba(22,219,101,0.3);}
.hb{display:inline-block;background:linear-gradient(135deg,rgba(22,219,101,0.2),rgba(14,160,82,0.1));border:1px solid rgba(22,219,101,0.45);padding:7px 32px;border-radius:20px;font-size:14px;font-weight:800;color:#f5f9fc;letter-spacing:2px;}
.lst{padding:14px 0 8px;}
.row{position:relative;display:flex;align-items:center;background:linear-gradient(90deg,rgba(255,255,255,0.025),rgba(255,255,255,0.012));border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:12px 22px;margin:6px 22px;height:${ROW_H - 16}px;}
.rp{background:linear-gradient(90deg,rgba(22,219,101,0.06),rgba(22,219,101,0.015));border-color:rgba(22,219,101,0.25);}
.idx{width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);display:flex;align-items:center;justify-content:center;font-weight:800;color:rgba(245,249,252,0.5);font-size:13px;margin-right:18px;flex-shrink:0;}
.side{flex:1;display:flex;align-items:center;gap:16px;min-width:0;}
.sh{justify-content:flex-end;}.sa{justify-content:flex-start;}
.tn{font-size:17px;font-weight:700;color:#f5f9fc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:300px;}
.av{width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.avh,.ava{background:linear-gradient(135deg,rgba(245,249,252,0.18),rgba(245,249,252,0.05));border:2px solid rgba(245,249,252,0.35);box-shadow:0 0 14px rgba(245,249,252,0.1);}
.sbx{width:120px;flex-shrink:0;text-align:center;}
.sc{font-size:26px;font-weight:900;color:#f5f9fc;letter-spacing:2px;text-shadow:0 0 18px rgba(22,219,101,0.45);}
.vs{font-size:19px;font-weight:800;color:rgba(245,249,252,0.22);letter-spacing:4px;}
.pbadge{position:absolute;top:-10px;right:14px;background:linear-gradient(135deg,#16db65,#0ea052);color:#030712;padding:3px 14px;border-radius:9px;font-size:10px;font-weight:900;letter-spacing:0.5px;box-shadow:0 2px 10px rgba(22,219,101,0.4);}
.ftr{text-align:center;padding:14px;color:rgba(245,249,252,0.2);font-size:10px;letter-spacing:2px;border-top:1px solid rgba(22,219,101,0.1);}
` + '</style></head><body><div class="c"><div class="h"><div class="ht">FİXTÜR</div><div class="hh">' + (fixture.leagueName || 'LİG') + '</div><div class="hb">HAFTA ' + weekNum + '</div></div><div class="lst">' + mHtmlArr.join('') + '</div><div class="ftr">' + (fixture.leagueName || 'LİG') + ' • ' + weekNum + '/' + fixture.fixtures.length + '</div></div></body></html>';
  return renderHtmlToImage(html, W, H);
}

module.exports = { renderHtmlToImage, closeBrowser, escEmoji, renderMatchResult, renderLeagueTable, renderKingBoard, renderSquad, renderFixture };
