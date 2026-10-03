# Bağlılık sistemleri (v0.13.0)

Amaç: oyuncuyu "bir kez bitir, bırak" yerine geri getirmek. Hepsi sunucusuz, cihazda çalışır.

| Sistem | Dosya | Ne yapar |
|---|---|---|
| Cadı Evi | `src/house.ts`, `Game.doHouse` | Gerçek zamanlı işler: **kediyi sev** (+%1 can, 4 sa), **iksir demle** (30 dk, +%2 hasar), **bahçeyi sula** (+%1 can +1 jeod, 8 sa), **kazan çorbası** (sen yokken 8 saate kadar ruh), **günlük giriş** (seri; 7. gün büyük ödül, bir gün kaçırmak seriyi bozmaz yalnız durdurur). |
| Kalıcı kazanç sınırı | `HOUSE_HP_CAP=100`, `HOUSE_DMG_CAP=200` | Ev, ada ilerlemesini aşan güç kaynağı olamaz. Kazanç `maxHp`/`dmgMul` içine yüzde olarak eklenir (`save.house.hp/dmg`). |
| Günlük (hikâye) | `src/story.ts` | Her ada bossu bir sayfa açar (250 sayfa). Aynanın kırıkları → rakip cadı "yarım kalmış kendin". Dönüm noktaları elle yazıldı (ada 1,5,10,20,30,40,50,60,69,100,150,200,250), arası biyom notları. |
| Büyü kombosu | `Game.hitEnemy` | 1,2 sn içinde iki farklı hasar türü aynı düşmana vurursa +%30 ve "KOMBO" yazısı. |
| Gölge Arenası | `src/meta.ts`, `src/fight.ts` | 12 gömülü efsane cadı (yapay zekâ ustalığı 0.15 → 1.0, sırayla açılır), bu cihazdaki diğer kahramanlar, **gölge kodu**: `HEX-…` kodunu arkadaşa gönder, o yapıştırıp senin gölgenle dövüşür (sunucusuz). |
| Haftalık meydan okuma | `weekly()` | Her hafta farklı kural (blok yasak, yalnız büyü, cam top, hızlı hafta) ve rakip; kazanınca +5 jeod ve kıyafet. |
| Gardırop | `OUTFITS` | Yalnız kozmetik cadı renkleri; ada ilerlemesi, seri, arena ve haftalık meydan okumayla açılır. Rakip cadının yeşili (150°) verilmez. |

## Bilinen sınırlar
- Süreler cihaz saatine bağlı: saati ileri alan oyuncu ev işlerini hızlandırabilir (sunucu doğrulaması yok). Kazanç sınırları bunu sınırlar.
- Gölge kodu yalnızca ad, ustalık ve renk taşır; gerçek oyuncunun can/hasarı gönderilmez (hile ve sunucu gerektirmemek için).
- Hikâye sayfaları şimdilik yalnız Türkçe (arayüz çevirisi var).
- İnsan oynanışıyla denenmedi; tarayıcıda duman testi yapıldı.

## v0.14.0 eklemeleri
- **Kedi maması:** toplanan ruhla alınır (bir buçuk saatlik kazan getirisi, en az 40 ruh); kediyi besle = kalıcı +%0,5 can (12 saatte bir), düzenli beslenme serisi (36 saati aşan ara seriyi sıfırlar), her 5'te +2 jeod. Kediye isim verilir.
- **Kıyafet bonusları:** Altın +%6 ruh, Orman +%4 hız, Okyanus +%5 menzil, Gece mavisi +%3 kritik, Gül +%1 can çalma, Kızıl +%3 kaçınma (yalnız giyiliyken).
- **Başlangıç görevleri (8 adım)** ve **günlük 3 görev:** ekranda görev takipçisi; ödül jeod/ruh.
- **Düşman koleksiyonu:** her 5 yeni tür +2 jeod, her 10'da kalıcı +%1 can.
- **Zor boss:** ada bossu yenilince adada günde bir kez ×3 güçte yeniden çıkar; büyük ganimet.
- **Bekleme geliri:** kahraman duruyorsa kazan getirisinin dörtte biri kadar ruh akar.
- **Yerel bildirimler** (`src/notify.ts`): iksir hazır, kedi acıktı, bahçe, kazan doldu, günlük ödül. Yalnız mobil uygulamada; cihazda denenmedi. `@capacitor/local-notifications` eklendi.
- **Ekran sarsıntısı** (vuruş, kombo, boss).
- **Görseller:** panel başlık görselleri, hikâye ara sahneleri ve ev ikonları için kod hazır (yavaş yakınlaşma animasyonu); görseller `tools/gen_ui.py` ile Gemini'den üretilir. Görsel yoksa emoji/gradyan yedek kullanılır. **Gemini kredisi bittiği için (HTTP 402) görseller henüz üretilmedi.**
- **Geri bildirim özeti:** Ayarlar → "Oyun özetini kopyala"; testçi bunu sana yapıştırır (`docs/PLAYTEST.md`).
