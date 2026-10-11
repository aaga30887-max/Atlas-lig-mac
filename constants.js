// ════════════════════════════════════════════════════════════════════════
//  VOLDER MAC BOT — Sabitler & Veri Tanımları
// ════════════════════════════════════════════════════════════════════════

const FORMATIONS = {
  "3-5-2":   { positions: { KL:1, STP:3, OS:2, OOS:3, SNT:2 } },
  "3-4-3":   { positions: { KL:1, STP:3, OS:2, OOS:2, SĞKNT:1, SLKNT:1, SNT:1 } },
  "3-4-2-1": { positions: { KL:1, STP:3, OS:2, OOS:4, SNT:1 } },
  "3-2-1-4": { positions: { KL:1, STP:3, OS:2, OOS:1, SĞKNT:1, SLKNT:1, SNT:2 } },
  "3-2-4-1": { positions: { KL:1, STP:3, OS:2, OOS:2, SĞKNT:1, SLKNT:1, SNT:1 } },
  "3-3-4":   { positions: { KL:1, STP:3, OOS:3, SĞKNT:1, SLKNT:1, SNT:2 } },
  "3-3-1-3": { positions: { KL:1, STP:3, OS:2, OOS:2, SĞKNT:1, SLKNT:1, SNT:1 } },
  "4-4-2":   { positions: { KL:1, STP:2, SĞB:1, SLB:1, OOS:2, SĞKNT:1, SLKNT:1, SNT:2 } },
  "4-2-4":   { positions: { KL:1, STP:2, SĞB:1, SLB:1, OOS:2, SĞKNT:1, SLKNT:1, SNT:2 } },
  "4-5-1":   { positions: { KL:1, STP:2, SĞB:1, SLB:1, OOS:3, SĞKNT:1, SLKNT:1, SNT:1 } },
  "4-3-3":   { positions: { KL:1, STP:2, SĞB:1, SLB:1, OOS:3, SĞKNT:1, SLKNT:1, SNT:1 } },
  "4-3-2-1": { positions: { KL:1, STP:2, SĞB:1, SLB:1, OOS:5, SNT:1 } },
  "4-1-3-2": { positions: { KL:1, STP:2, SĞB:1, SLB:1, OS:1, OOS:3, SNT:2 } },
  "4-1-2-1-2": { positions: { KL:1, STP:2, SĞB:1, SLB:1, OS:3, OOS:1, SNT:2 } },
  "4-2-3-1": { positions: { KL:1, STP:2, SĞB:1, SLB:1, OS:2, OOS:1, SĞKNT:1, SLKNT:1, SNT:1 } },
  "4-1-2-3": { positions: { KL:1, STP:2, SĞB:1, SLB:1, OS:1, OOS:2, SĞKNT:1, SLKNT:1, SNT:1 } },
  "4-1-4-1": { positions: { KL:1, STP:2, SĞB:1, SLB:1, OS:1, OOS:2, SĞKNT:1, SLKNT:1, SNT:1 } },
  "4-2-2-2": { positions: { KL:1, STP:2, SĞB:1, SLB:1, OS:2, OOS:2, SNT:2 } },
  "4-3-1-2": { positions: { KL:1, STP:2, SĞB:1, SLB:1, OOS:4, SNT:2 } },
  "4-4-1-1": { positions: { KL:1, STP:2, SĞB:1, SLB:1, OOS:3, SĞKNT:1, SLKNT:1, SNT:1 } },
  "4-2-1-3": { positions: { KL:1, STP:2, SĞB:1, SLB:1, OS:2, OOS:1, SĞKNT:1, SLKNT:1, SNT:1 } },
  "4-1-5":   { positions: { KL:1, STP:2, SĞB:1, SLB:1, OS:1, OOS:3, SĞKNT:1, SLKNT:1 } },
  "5-4-1":   { positions: { KL:1, STP:3, SĞB:1, SLB:1, OOS:2, SĞKNT:1, SLKNT:1, SNT:1 } },
  "5-1-4":   { positions: { KL:1, STP:3, SĞB:1, SLB:1, OOS:1, SĞKNT:1, SLKNT:1, SNT:2 } },
  "5-2-3":   { positions: { KL:1, STP:3, SĞB:1, SLB:1, OOS:2, SĞKNT:1, SLKNT:1, SNT:1 } }
};

const PLAY_STYLES = {
  'gegenpress':   { name: 'Gegenpress', desc: 'Yüksek pres, hızlı top kazanma', icon: '⚡', color: '#e74c3c', attrs: { attack: 85, defense: 70, tempo: 95, pressing: 95 } },
  'counter':      { name: 'Kontra Atak', desc: 'Hızlı geçiş, savunma ağırlıklı', icon: '🏃', color: '#3498db', attrs: { attack: 75, defense: 80, tempo: 90, pressing: 60 } },
  'possession':   { name: 'Top Hakimiyeti', desc: 'Pas oyunu, topu elde tutma', icon: '🎯', color: '#2ecc71', attrs: { attack: 70, defense: 65, tempo: 60, pressing: 55 } },
  'tiki-taka':    { name: 'Tiki-Taka', desc: 'Kısa paslar, sürekli hareket', icon: '🔄', color: '#f1c40f', attrs: { attack: 80, defense: 60, tempo: 70, pressing: 50 } },
  'direct':       { name: 'Doğrudan Oyun', desc: 'Uzun toplar, hızlı hücum', icon: '🎯', color: '#e67e22', attrs: { attack: 80, defense: 55, tempo: 85, pressing: 50 } },
  'wing-play':    { name: 'Kanat Oyunu', desc: 'Kanatlardan bindirmeler', icon: '🦅', color: '#9b59b6', attrs: { attack: 82, defense: 60, tempo: 75, pressing: 55 } },
  'park-the-bus': { name: 'Park the Bus', desc: 'Derin savunma, fırsat kollama', icon: '🚌', color: '#7f8c8d', attrs: { attack: 40, defense: 95, tempo: 30, pressing: 30 } },
  'catenaccio':   { name: 'Catenaccio', desc: 'İtalyan savunma stili', icon: '🛡️', color: '#34495e', attrs: { attack: 45, defense: 90, tempo: 40, pressing: 40 } }
};

const EMOJIS = {
  gol: '<:gol:1543269396972310571>',
  asist: '<:asist:1543268350203797644>',
  duduk: '<:duduk:1543269389657178133>',
  kurtaris: '<:eldiven:1543268678001365132>',
  mudahale: '<:takimsiz:1543265306628202508>',
  saat: '<:saat:1543268920838979604>',
  sut: '<:Futbolcu:1539707800173678763>',
  pas: '<:pas:1543268314128580699>',
  calim: '<:neymar:1543269155799564351>'
};

const POS_FULL_NAMES = {
  KL: 'Kaleci', STP: 'Stoper', SĞB: 'Sağ Bek', SLB: 'Sol Bek',
  OS: 'Önlibero', OOS: 'Ortasaha', SĞKNT: 'Sağ Kanat', SLKNT: 'Sol Kanat', SNT: 'Santrafor'
};

const POS_GROUP_ICONS = {
  KL: '🧤', STP: '🛡️', SĞB: '📐', SLB: '📐',
  OS: '⚙️', OOS: '🎯', SĞKNT: '🦅', SLKNT: '🦅', SNT: '⚡'
};

const POS_GROUP_NAMES = {
  KL: 'KL', STP: 'SVH', SĞB: 'SVH', SLB: 'SVH',
  OS: 'OSM', OOS: 'OSM', SĞKNT: 'HÜC', SLKNT: 'HÜC', SNT: 'HÜC'
};

const PITCH_POSITIONS = {
  KL:    { x: 50, y: 90, col: '#ff4757' },
  STP:   { x: 50, y: 74, col: '#3742fa' },
  SĞB:   { x: 82, y: 76, col: '#2ed573' },
  SLB:   { x: 18, y: 76, col: '#2ed573' },
  OS:    { x: 50, y: 58, col: '#ffa502' },
  OOS:   { x: 50, y: 44, col: '#ffa502' },
  SĞKNT: { x: 82, y: 42, col: '#a855f7' },
  SLKNT: { x: 18, y: 42, col: '#a855f7' },
  SNT:   { x: 50, y: 26, col: '#ff6348' }
};

const CUP_TEAMS = [
  { roleId: '1537546696442122338', name: 'Arsenal', emoji: '<:Arsenal:1541437736009859082>' },
  { roleId: '1537546696442122339', name: 'FC Barcelona', emoji: '<:Barcelona:1541438057838809209>' },
  { roleId: '1537546696479997972', name: 'Manchester United', emoji: '<:manchester:1541437963055931523>' },
  { roleId: '1537546696479997974', name: 'Inter', emoji: '<:Inter:1541438449465303051>' },
  { roleId: '1537546696479997975', name: 'Bayern Münih', emoji: '<:Bayern:1541437809112653964>' },
  { roleId: '1537546696479997977', name: 'Galatasaray', emoji: '<:Galatasaray:1541438274151645246>' },
  { roleId: '1537546696479997978', name: 'Fenerbahçe', emoji: '<:Fenerbahce:1541438348172857396>' },
  { roleId: '1537546696479997979', name: 'Beşiktaş', emoji: '<:besiktas:1541438207852417075>' }
];

const TEAM_EMOJI_MAP = {
  'Arsenal': '<:Arsenal:1541437736009859082>',
  'FC Barcelona': '<:Barcelona:1541438057838809209>',
  'Manchester United': '<:manchester:1541437963055931523>',
  'Manchester City': '🟡',
  'Inter': '<:Inter:1541438449465303051>',
  'Bayern Münih': '<:Bayern:1541437809112653964>',
  'Bursaspor': '<:Bursaspor:1541438138382024774>',
  'Galatasaray': '<:Galatasaray:1541438274151645246>',
  'Fenerbahçe': '<:Fenerbahce:1541438348172857396>',
  'Beşiktaş': '<:besiktas:1541438207852417075>'
};

const MANU_ROLE_ID = '1537546696479997972';
const FENER_ROLE_ID = '1537546696479997978';

const PENALTY_RESULTS = ['GOL', 'GOL', 'GOL', 'KALECİ', 'KALECİ', 'DİREK', 'AUT'];

module.exports = {
  FORMATIONS, PLAY_STYLES, EMOJIS, POS_FULL_NAMES, POS_GROUP_ICONS, POS_GROUP_NAMES,
  PITCH_POSITIONS, CUP_TEAMS, TEAM_EMOJI_MAP, MANU_ROLE_ID, FENER_ROLE_ID, PENALTY_RESULTS
};
