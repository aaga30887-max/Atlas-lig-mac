// ════════════════════════════════════════════════════════════════════════
//  VOLDER MAC BOT — JSON Database
// ════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const config = require('./config');

const DATA_DIR = config.dataDir;

const FILES = {
  MATCHES: path.join(DATA_DIR, 'matches.json'),
  SAVED_LINEUPS: path.join(DATA_DIR, 'saved_lineups.json'),
  CELEBRATIONS: path.join(DATA_DIR, 'celebrations.json'),
  LEAGUE: path.join(DATA_DIR, 'league.json'),
  MATCH_HISTORY: path.join(DATA_DIR, 'match_history.json'),
  FIXTURE: path.join(DATA_DIR, 'fixture.json'),
  SQUADS: path.join(DATA_DIR, 'squads.json'),
  CUP: path.join(DATA_DIR, 'cup.json'),
  AWARDS: path.join(DATA_DIR, 'awards.json'),
  NEW_LEAGUE: path.join(DATA_DIR, 'new_league.json'),
  NEW_FIXTURE: path.join(DATA_DIR, 'new_fixture.json'),
  NEW_WEEK: path.join(DATA_DIR, 'new_week.json'),
  NEW_CARDS: path.join(DATA_DIR, 'new_cards.json')
};

function initDB() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  const defaults = {
    MATCHES: {},
    SAVED_LINEUPS: {},
    CELEBRATIONS: {},
    LEAGUE: { teams: {}, topScorers: {}, bestGK: {}, playerNames: {} },
    MATCH_HISTORY: [],
    FIXTURE: null,
    SQUADS: {},
    CUP: null,
    AWARDS: null,
    NEW_LEAGUE: null,
    NEW_FIXTURE: null,
    NEW_WEEK: null,
    NEW_CARDS: null
  };

  for (const [key, file] of Object.entries(FILES)) {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify(defaults[key], null, 2), 'utf-8');
    }
  }
}

function readJSON(file, fallback = {}) {
  try {
    const raw = fs.readFileSync(file, 'utf-8');
    if (!raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJSON(file, data) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

// ── Generic helpers ──
function get(key, fallback) { return readJSON(FILES[key], fallback); }
function set(key, data) { writeJSON(FILES[key], data); }

// ── Matches ──
function getMatch(channelId) {
  const matches = readJSON(FILES.MATCHES, {});
  return matches[channelId] || null;
}
function saveMatch(channelId, matchData) {
  const matches = readJSON(FILES.MATCHES, {});
  matches[channelId] = matchData;
  writeJSON(FILES.MATCHES, matches);
}
function deleteMatch(channelId) {
  const matches = readJSON(FILES.MATCHES, {});
  delete matches[channelId];
  writeJSON(FILES.MATCHES, matches);
}
function getAllMatches() { return readJSON(FILES.MATCHES, {}); }

// ── Squads ──
function getSquads() { return readJSON(FILES.SQUADS, {}); }
function saveSquads(data) { writeJSON(FILES.SQUADS, data); }
function getSquad(roleId) { return getSquads()[roleId] || null; }
function saveSquad(roleId, data) {
  const s = getSquads();
  s[roleId] = data;
  saveSquads(s);
}

// ── Lineups ──
function saveLineup(roleId, teamData) {
  const saved = readJSON(FILES.SAVED_LINEUPS, {});
  saved[roleId] = { formation: teamData.formation, lineup: teamData.lineup, roles: teamData.roles, savedAt: Date.now() };
  writeJSON(FILES.SAVED_LINEUPS, saved);
}
function getSavedLineup(roleId) { return readJSON(FILES.SAVED_LINEUPS, {})[roleId] || null; }

// ── Celebrations ──
function saveCelebration(userId, gifUrl) {
  const data = readJSON(FILES.CELEBRATIONS, {});
  data[userId] = { gif: gifUrl, savedAt: Date.now() };
  writeJSON(FILES.CELEBRATIONS, data);
}
function getCelebration(userId) { return readJSON(FILES.CELEBRATIONS, {})[userId] || null; }
function removeCelebration(userId) {
  const data = readJSON(FILES.CELEBRATIONS, {});
  delete data[userId];
  writeJSON(FILES.CELEBRATIONS, data);
}

// ── Fixture ──
function getFixture() { return readJSON(FILES.FIXTURE, null); }
function saveFixture(data) { writeJSON(FILES.FIXTURE, data); }

// ── Cup ──
function getCup() { return readJSON(FILES.CUP, null); }
function saveCup(data) { writeJSON(FILES.CUP, data); }

// ── League ──
function getLeague() { return readJSON(FILES.LEAGUE, { teams: {}, topScorers: {}, bestGK: {}, playerNames: {} }); }
function saveLeague(data) { writeJSON(FILES.LEAGUE, data); }

// ── Match History ──
function getMatchHistory() { return readJSON(FILES.MATCH_HISTORY, []); }
function saveMatchHistory(entry, maxLen = 50) {
  const history = getMatchHistory();
  history.unshift(entry);
  if (history.length > maxLen) history.length = maxLen;
  writeJSON(FILES.MATCH_HISTORY, history);
}

// ── Awards ──
function getAwards() { return readJSON(FILES.AWARDS, null); }
function saveAwards(data) { writeJSON(FILES.AWARDS, data); }

// ── New League ──
function getNewLeague() { return readJSON(FILES.NEW_LEAGUE, null); }
function saveNewLeague(data) { writeJSON(FILES.NEW_LEAGUE, data); }
function getNewFixture() { return readJSON(FILES.NEW_FIXTURE, null); }
function saveNewFixture(data) { writeJSON(FILES.NEW_FIXTURE, data); }
function getNewWeek() { return readJSON(FILES.NEW_WEEK, null); }
function saveNewWeek(data) { writeJSON(FILES.NEW_WEEK, data); }

module.exports = {
  DATA_DIR, FILES, initDB, readJSON, writeJSON,
  get, set,
  getMatch, saveMatch, deleteMatch, getAllMatches,
  getSquads, saveSquads, getSquad, saveSquad,
  saveLineup, getSavedLineup,
  saveCelebration, getCelebration, removeCelebration,
  getFixture, saveFixture,
  getCup, saveCup,
  getLeague, saveLeague,
  getMatchHistory, saveMatchHistory,
  getAwards, saveAwards,
  getNewLeague, saveNewLeague, getNewFixture, saveNewFixture, getNewWeek, saveNewWeek
};
