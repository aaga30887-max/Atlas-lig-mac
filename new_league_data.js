// ════════════════════════════════════════════════════════════════════════
//  VOLDER LİG — Takım Verileri (48 Takım)
// ════════════════════════════════════════════════════════════════════════

const NEW_LEAGUE_DATA = {
  ustLig: {
    name: 'VolderLeague Süper Lig',
    channelId: null,
    standingsChannelId: null,
    statsChannelId: null,
    currentWeek: 0,
    status: 'idle',
    teams: [
      { name: 'Arsenal', roleId: '1523325626314915860', emoji: '<:AROX_Arsenal:1523325626314915860>', strength: 88 },
      { name: 'Lyon', roleId: '1512116714735669480', emoji: '<:AROX_Lyon:1512116714735669480>', strength: 72 },
      { name: 'Marsilya', roleId: '1523328174040023162', emoji: '<:AROX_Marsilya:1523328174040023162>', strength: 74 },
      { name: 'Monaco', roleId: '1523311371750604902', emoji: '<:AROX_Monaco:1523311371750604902>', strength: 78 },
      { name: 'Fenerbahçe', roleId: '1523311573744222300', emoji: '<:AROX_Fenerbahce:1523311573744222300>', strength: 82 },
      { name: 'PSG', roleId: '1458182827974590464', emoji: '<:AROX_PSG:1458182827974590464>', strength: 90 },
      { name: 'Galatasaray', roleId: '1523311548045590659', emoji: '<:AROX_Galatasaray:1523311548045590659>', strength: 83 },
      { name: 'AC Milan', roleId: '1523325864761364601', emoji: '<:AROX_ACMilan:1523325864761364601>', strength: 81 },
      { name: 'Göztepe', roleId: '1532870245658792076', emoji: '<:AROX_Goztepe:1532870245658792076>', strength: 68 },
      { name: 'Como', roleId: '1522343370708615268', emoji: '<:AROX_Como:1522343370708615268>', strength: 65 },
      { name: 'Manchester City', roleId: '1532870314068021298', emoji: '<:AROX_ManchesterCity:1532870314068021298>', strength: 92 },
      { name: 'Frankfurt', roleId: '1522343306988748821', emoji: '<:AROX_Frankfurt:1522343306988748821>', strength: 76 },
      { name: 'Juventus', roleId: '1533014074256785428', emoji: '<:AROX_Juventus:1533014074256785428>', strength: 85 },
      { name: 'Dortmund', roleId: '1523310918795137185', emoji: '<:AROX_Dortmund:1523310918795137185>', strength: 84 },
      { name: 'Newcastle', roleId: '1532870366647816243', emoji: '<:AROX_NewcastleUnited:1532870366647816243>', strength: 80 },
      { name: 'Leverkusen', roleId: '1523310977003683880', emoji: '<:AROX_Leverkusen:1523310977003683880>', strength: 82 },
      { name: 'Hoffenheim', roleId: '1533012978251858060', emoji: '<:AROX_Hoffenheim:1533012978251858060>', strength: 67 },
      { name: 'Bayern Münih', roleId: '1505286160144928819', emoji: '<:AROX_BayernMunih:1505286160144928819>', strength: 93 },
      { name: 'Başakşehir', roleId: '1533013116860895302', emoji: '<:AROX_Basaksehir:1533013116860895302>', strength: 70 },
      { name: 'Barcelona', roleId: '1458185121793446010', emoji: '<:AROX_Barcelona:1458185121793446010>', strength: 91 },
      { name: 'RB Leipzig', roleId: '1533012085347319848', emoji: '<:AROX_Leipzig:1533012085347319848>', strength: 79 },
      { name: 'Real Madrid', roleId: '1458182964985991356', emoji: '<:AROX_RealMadrid:1458182964985991356>', strength: 94 },
      { name: 'Chelsea', roleId: '1523325701921706034', emoji: '<:AROX_Chelsea:1523325701921706034>', strength: 83 },
      { name: 'Tottenham', roleId: '1478488522515021837', emoji: '<:AROX_Tottenham:1478488522515021837>', strength: 79 }
    ]
  },
  altLig: {
    name: 'VolderLeague 1. Lig',
    channelId: null,
    standingsChannelId: null,
    statsChannelId: null,
    currentWeek: 0,
    status: 'idle',
    teams: [
      { name: 'Trabzonspor', roleId: '1523311494513823906', emoji: '<:AROX_Trabzonspor:1523311494513823906>', strength: 73 },
      { name: 'SC Freiburg', roleId: '1533011861791047710', emoji: '<:AROX_Freiburg:1533011861791047710>', strength: 71 },
      { name: 'VfB Stuttgart', roleId: '1533011945630732328', emoji: '<:AROX_Stuttgart:1533011945630732328>', strength: 75 },
      { name: 'Samsunspor', roleId: '1533013276831514664', emoji: '<:AROX_Samsunspor:1533013276831514664>', strength: 60 },
      { name: 'Atletico Madrid', roleId: '1523310900323553412', emoji: '<:AROX_AtleticoMadrid:1523310900323553412>', strength: 86 },
      { name: 'Konyaspor', roleId: '1532870292463161436', emoji: '<:AROX_Konyaspor:1532870292463161436>', strength: 62 },
      { name: 'Beşiktaş', roleId: '1523311522678313040', emoji: '<:AROX_Besiktas:1523311522678313040>', strength: 77 },
      { name: 'Manchester United', roleId: '1532870331277119548', emoji: '<:AROX_ManchesterUnited:1532870331277119548>', strength: 82 },
      { name: 'İnter', roleId: '1523310841842368583', emoji: '<:AROX_Inter:1523310841842368583>', strength: 86 },
      { name: 'Brighton', roleId: '1532870349090324580', emoji: '<:AROX_Brighton:1532870349090324580>', strength: 73 },
      { name: 'Liverpool', roleId: '1388144673771622564', emoji: '<:AROX_Liverpool:1388144673771622564>', strength: 89 },
      { name: 'Real Sociedad', roleId: '1532870393348624504', emoji: '<:AROX_RealSociedad:1532870393348624504>', strength: 76 },
      { name: 'Villareal', roleId: '1523310880392220779', emoji: '<:AROX_Villareal:1523310880392220779>', strength: 75 },
      { name: 'Athletic Bilbao', roleId: '1532870414198509719', emoji: '<:AROX_AthleticBilbao:1532870414198509719>', strength: 74 },
      { name: 'Roma', roleId: '1522343327003967538', emoji: '<:AROX_Roma:1522343327003967538>', strength: 80 },
      { name: 'Real Betis', roleId: '1532870441239052338', emoji: '<:AROX_RealBetis:1532870441239052338>', strength: 75 },
      { name: 'Fiorentina', roleId: '1532870604661985371', emoji: '<:AROX_Fiorentina:1532870604661985371>', strength: 77 },
      { name: 'Sevilla', roleId: '1533013499939258438', emoji: '<:AROX_Sevilla:1533013499939258438>', strength: 78 },
      { name: 'Atalanta', roleId: '1532870584722260129', emoji: '<:AROX_Atalanta:1532870584722260129>', strength: 81 },
      { name: 'Strasbourg', roleId: '1532870481948967063', emoji: '<:AROX_Strasbourg:1532870481948967063>', strength: 68 },
      { name: 'Napoli', roleId: '1532870564648321215', emoji: '<:AROX_Napoli:1532870564648321215>', strength: 84 },
      { name: 'Lille', roleId: '1532870502824284341', emoji: '<:AROX_Lille:1532870502824284341>', strength: 74 },
      { name: 'RC Lens', roleId: '1533013942173958184', emoji: '<:AROX_Lens:1533013942173958184>', strength: 72 },
      { name: 'Rennais', roleId: '1533013666759315607', emoji: '<:AROX_Rennais:1533013666759315607>', strength: 70 }
    ]
  }
};
