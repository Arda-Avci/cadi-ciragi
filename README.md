# Hexling: Kırk Ada

Tarayıcıda, Android'de ve iOS'ta çalışan, özgün cadı temalı bir keşif/aksiyon RPG'si. Hiçbir görsel, ses veya kod başka bir oyundan alınmadı: görseller Antigravity (`agy`) ile üretildi, ses ve müzik oyun içinde WebAudio ile sentezlenir.

Oyna: <https://arda-avci.github.io/cadi-ciragi/>

## Oyun mantığı

- **40 ada, tek dünya:** 8 biyom (Mantar Ormanı, Bataklık, Buz Mağarası, Kızıl Çöl, Kristal Vadisi, Volkan, Bulut Sarayı, Gölge Diyarı) × 5 çeşit. Adalar altıgen bir ızgarada farklı açılardan köprülerle bağlanır. Her adanın kapısı o adanın boss'u yenilince açılır; boss bir kez yenilir, bir daha çıkmaz.
- **Her yeni ada öncekinden 1.2–1.8 kat daha güçlüdür** (güç = √(can × hasar)). Değerler `src/data.ts` içinde sabit tohumla üretilir.
- **Güç tek başına belirleyici değil:** hasar türü eşleşmesi (kesme/delme/ezme, zayıf olduğu türden ×4), kalkanın türü, miğfer ve kristal yetenekleri (kritik, can çalma, kaçınma) önemlidir. Can azaldıkça güç de düşer.
- **Sabit kamplar, dalga yok:** kamp temizlenince gerçek zamanlı geri sayımla yeniden dolar. Kamplar halkayla işaretlidir. Boss evi içinde iyileşirsin, eve vurarak boss'a zarar verirsin.
- **Süpürge uçuşu:** boss ya da zor düşmana verilen her %10 zararda 5 sn uçarsın; havadayken zarar görmezsin.
- **Ev ve kamplar:** ilk adada ev, diğer adalarda giriş kampı hızlı iyileştirir; bayılınca bulunduğun adanın kampında uyanırsın.
- **Usta Cadı:** o seviyenin boss'u yenilince kapıda belirir; her seviye için günde 2 mini oyun eğitimi (kalıcı güç). Hakkın yoksa usta ve düğmesi görünmez.
- Kalıcı harita statları, kaynak ağaçları (bütün ağaçlar kesilir), Muhafız kampları (miğfer/kalkan; daha iyisi anında kuşanılır), kopyayla silah seviyesi, kristaller, gizli sandıklar, yetenek ağacı.
- **Şeref Salonu:** bu cihazdaki kahramanlar aşılan ada > güç > öldürme sırasıyla listelenir (Stat sayfası ve açılış ekranı). Küresel sıralama için sunucu gerekir, yoktur.
- Kuşanılan büyüler, ekipman ve kristaller kendi listelerinin en üstünde durur.
- **Ayarlar** (dişli simgesi): müzik ve efekt sesi, titreşim (destekleyen cihazlarda), dil (Türkçe / English).

Hareket: ekrana basılı tutup sürükle. Büyüler en yakın hedefe kendiliğinden atılır. M tuşu haritayı açar.

## Mobil derleme (GitHub Actions)

`.github/workflows/mobile.yml` Capacitor ile hem Android hem iOS paketini derler. Elle çalıştırmak için GitHub'da **Actions → Mobil derleme → Run workflow**, ya da `v*` etiketi at:

```bash
git tag v0.9.0 && git push origin v0.9.0
```

- **Android:** `Hexling-android.apk` (debug imzalı). Telefonda "bilinmeyen kaynaklardan kur" iznini verip doğrudan kurulur. Mağaza için kendi anahtarınla imzalanmış release gerekir.
- **iOS:** `Hexling-ios-unsigned.ipa` **imzasızdır**. iPhone'a kurmak için Apple kimliğinle imzalaman gerekir: Sideloadly / AltStore (ücretsiz Apple kimliğiyle 7 gün geçerli) ya da ücretli Apple Developer hesabıyla TestFlight. iOS'ta imzasız IPA'yı doğrudan kurmanın yolu yoktur.
- Etiket atılırsa ikisi de GitHub Release'e eklenir.

Alternatif: iPhone'da Safari ile oyun adresini açıp **Paylaş → Ana Ekrana Ekle** (PWA, imza gerekmez, çevrimdışı çalışır).

## Geliştirme

```powershell
& "C:\Users\Damla\Proje\AI-Publisher\node_modules\.bin\tsc.cmd" -p tsconfig.json
python -m http.server 8765 --bind ::
```

- `src/data.ts` büyü, düşman, 40 ada üretimi ve denge değerleri; `src/game.ts` oyun mantığı ve çizim; `src/scenery.ts` köprü/kapı/kıyı/parçacık çizimleri; `src/audio.ts` müzik ve efektler; `src/i18n.ts` çeviri; `src/settings.ts` ayarlar; `src/version.ts` sürüm bilgisi.
- `tools/bot.js` hızlandırılmış denge botu (sayfada `eval` ile yüklenir, `BOT.runAsync(saniye)`).
- Görseller: `python tools/agy_assets.py [ad ...]`, animasyon şeritleri `python tools/agy_sheet.py walk|cast|fly`, simgeler `python tools/make_icons.py`. İstemler `tools/gen_assets.py` içinde.
- Yayın klasörüne eşitleme: `python tools/yayinla.py`.

## Sürüm

`src/version.ts` içindeki `VERSION` / `BUILD`, açılış ekranında ve Stat/Ayarlar sayfalarında görünür.
