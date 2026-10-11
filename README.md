# ⚽ Volder Mac Bot v3

Discord futbol maç botu — maç motoru, lig, kupa, ödüller ve görsel istatistikler.

## ✨ Özellikler

- ⚽ **Maç Motoru**: Canlı skor, olay akışı (gol, kurtarış, kart, sakatlık...), devre arası, penaltılar
- 🧩 **Diziliş Paneli**: Buton + menü ile kadro kurulumu, NPC desteği
- 🏆 **Lig Sistemi**: Puan durumu, gol/asist krallığı, en iyi kaleci, fikstür
- 🏅 **Kupa**: Kura çekimi, eleme tablosu, penaltı serisi
- 🎉 **Ödül Töreni**: Sezon ödülleri, Ballon d'Or
- 🤖 **Otomatik Lig**: 48 takım (üst/alt lig), simülasyon, hafta hafta ilerleme
- 🖼️ **Görsel Çıktılar**: Puppeteer ile puan durumu, krallık tabloları, maç sonuçları

## 🚀 Kurulum

```bash
# 1. Bağımlılıkları yükle
npm install

# 2. Token ayarla
# config.json dosyasındaki "token" alanına bot tokenınızı yazın
# veya .env dosyasına ekleyin:
# TOKEN=discord_bot_tokeniniz

# 3. Botu başlat
npm start
```

## 📋 Komutlar

| Komut | Açıklama |
|-------|----------|
| `!mac` | Yeni maç oluştur |
| `!baslat` / `!durdur` / `!bitir` / `!iptal` | Maç kontrolü |
| `!lig` | Puan durumu |
| `!golkraligi` / `!asistkralligi` / `!eniyigk` | Krallık tabloları |
| `!fikstur [hafta]` | Haftalık fikstür |
| `!stat [oyuncu]` | Oyuncu istatistiği |
| `!kuracekimi` / `!cfikstur` | Kupa (admin) |
| `!odul` / `!ballondor` | Ödül töreni |
| `!yenilig kur/baslat/puan` | Otomatik lig (admin) |
| `!yardim` | Komut listesi |

## 🗂️ Proje Yapısı

```
volder mac/
├── mac.js                 # Bootstrap (ince giriş noktası)
├── config.json            # Ayarlar (token dahil — commit etmeyin!)
├── package.json
├── data/                  # JSON veritabanı
└── src/
    ├── index.js           # Ana bot: client, komutlar, maç motoru
    ├── config.js          # Config/.env yükleyici
    ├── database.js        # JSON DB yardımcıları
    ├── constants.js       # Dizilişler, emojiler, takımlar
    ├── utils.js           # Yardımcı fonksiyonlar
    ├── renderer.js        # Puppeteer görsel üretim
    ├── data/              # Takım verileri
    └── systems/
        ├── cup.js         # Kupa sistemi
        ├── league.js      # Lig istatistikleri
        ├── awards.js      # Ödül töreni
        └── new_league.js  # Otomatik lig
```

## ⚙️ Ayarlar (`config.json`)

| Alan | Açıklama | Varsayılan |
|------|----------|------------|
| `token` | Discord bot tokenı | — |
| `prefix` | Komut öneki | `!` |
| `specialGkId` | Özel kaleci kullanıcı ID | — |
| `specialGkBonus` | Özel kaleci kurtarış bonusu | `0.14` |
| `matchDuration.realSecondsPerHalf` | Yarıda geçen gerçek süre (sn) | `600` |
| `maxMatchHistory` | Saklanan maç geçmişi sayısı | `50` |

## 🛣️ Yol Haritası (Planlanan)

- 🎯 Maç motoruna ek özellikler: asist bonusları, canlı skor mesajı düzenleme
- ⏳ Komutlara cooldown (spam koruması)
- 💬 Slash komut desteği (`/mac`, `/lig`...)
- 📊 Canlı skor paneli (sürekli güncellenen mesaj)
- 🏅 Sezon sonu otomatik ödül töreni

## ⚠️ Güvenlik

- `config.json` ve `.env` dosyaları **.gitignore** içindedir — tokenınızı asla commit etmeyin.
- GitHub'a yüklerken token içermediğinden emin olun.

## 📄 Lisans

MIT
