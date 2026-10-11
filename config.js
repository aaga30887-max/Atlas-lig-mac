// ════════════════════════════════════════════════════════════════════════
//  VOLDER MAC BOT — Config Loader
//  config.json veya .env'den ayarları yükler
// ════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');
const ENV_PATH = path.join(__dirname, '..', '.env');

function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) return {};
  const env = {};
  const lines = fs.readFileSync(ENV_PATH, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function loadConfig() {
  let fileConfig = {};
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      fileConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    }
  } catch (e) {
    console.error('[CONFIG] config.json okunamadı:', e.message);
  }

  const env = loadEnv();

  const config = {
    token: env.TOKEN || env.DISCORD_TOKEN || fileConfig.token || '',
    prefix: env.PREFIX || fileConfig.prefix || '!',
    specialGkId: fileConfig.specialGkId || '1520176727911956650',
    specialGkBonus: fileConfig.specialGkBonus ?? 0.14,
    specialGkPenBonus: fileConfig.specialGkPenBonus ?? 0.18,
    realSecondsPerHalf: fileConfig.matchDuration?.realSecondsPerHalf ?? 600,
    gameMinutesPerHalf: fileConfig.matchDuration?.gameMinutesPerHalf ?? 45,
    cv2Flag: fileConfig.cv2Flag ?? 32768,
    maxMatchHistory: fileConfig.maxMatchHistory ?? 50,
    dataDir: path.join(__dirname, '..', 'data')
  };

  config.secondsPerGameMinute = config.realSecondsPerHalf / config.gameMinutesPerHalf;

  config.tokenMissing = !config.token || config.token === 'BOT_TOKENINI_BURAYA_YAPISTIR' || config.token === 'MyToken';

  return config;
}

module.exports = loadConfig();
