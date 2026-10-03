# Bağlılık sistemleri (v0.13.0)

Amaç: oyuncuyu "bir kez bitir, bırak" yerine geri getirmek. Hepsi sunucusuz, cihazda çalışır.

| Sistem | Dosya | Ne yapar |
|---|---|---|
| Cadı Evi | `src/house.ts`, `Game.doHouse` | Gerçek zamanlı işler: **kediyi sev** (+%1 can, 4 sa), **iksir demle** (30 dk, +%2 hasar), **bahçeyi sula** (+%1 can +1 jeod, 8 sa), **kazan çorbası** (sen yokken 8 saate kadar ruh), **günlük giriş** (seri; 7. gün büyük ödül, bir gün kaçırmak seriyi bozmaz yalnız durdurur). |
| Kalıcı kazanç sınırı | `HOUSE_HP_CAP=100`, `HOUSE_DMG_CAP=200` | Ev, ada ilerlemesini aşan güç kaynağı olamaz. Kazanç `maxHp`/`dmgMul` içine yüzde olarak eklenir (`save.house.hp/dmg`). |
| Günlük (hikâye) | `src/story.ts` | Her ada bossu bir sayfa açar (69 sayfa). Aynanın kırıkları → rakip cadı "yarım kalmış kendin". Dönüm noktaları elle yazıldı (ada 1,5,10,20,30,40,50,60,69), arası biyom notları. |
| Büyü kombosu | `Game.hitEnemy` | 1,2 sn içinde iki farklı hasar türü aynı düşmana vurursa +%30 ve "KOMBO" yazısı. |
| Gölge Arenası | `src/meta.ts`, `src/fight.ts` | 12 gömülü efsane cadı (yapay zekâ ustalığı 0.15 → 1.0, sırayla açılır), bu cihazdaki diğer kahramanlar, **gölge kodu**: `HEX-…` kodunu arkadaşa gönder, o yapıştırıp senin gölgenle dövüşür (sunucusuz). |
| Haftalık meydan okuma | `weekly()` | Her hafta farklı kural (blok yasak, yalnız büyü, cam top, hızlı hafta) ve rakip; kazanınca +5 jeod ve kıyafet. |
| Gardırop | `OUTFITS` | Yalnız kozmetik cadı renkleri; ada ilerlemesi, seri, arena ve haftalık meydan okumayla açılır. Rakip cadının yeşili (150°) verilmez. |

## Bilinen sınırlar
- Süreler cihaz saatine bağlı: saati ileri alan oyuncu ev işlerini hızlandırabilir (sunucu doğrulaması yok). Kazanç sınırları bunu sınırlar.
- Gölge kodu yalnızca ad, ustalık ve renk taşır; gerçek oyuncunun can/hasarı gönderilmez (hile ve sunucu gerektirmemek için).
- Hikâye sayfaları şimdilik yalnız Türkçe (arayüz çevirisi var).
- İnsan oynanışıyla denenmedi; tarayıcıda duman testi yapıldı.
