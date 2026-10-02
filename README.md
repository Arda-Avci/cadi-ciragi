# Hexling: Kırk Ada

Tarayıcıda, Android'de ve iOS'ta çalışan, özgün cadı temalı bir keşif/aksiyon RPG'si. Hiçbir görsel, ses veya kod başka bir oyundan alınmadı: görseller Antigravity (`agy`) ile üretildi, ses ve müzik oyun içinde WebAudio ile sentezlenir.

Oyna: <https://arda-avci.github.io/cadi-ciragi/>

## Oyun mantığı

- **40 ada, tek dünya:** 8 biyom (Mantar Ormanı, Bataklık, Buz Mağarası, Kızıl Çöl, Kristal Vadisi, Volkan, Bulut Sarayı, Gölge Diyarı) × 5 çeşit. Adalar altıgen bir ızgarada farklı açılardan köprülerle bağlanır. Her adanın kapısı o adanın boss'u yenilince açılır; boss bir kez yenilir, bir daha çıkmaz.
- **Her yeni ada öncekinden 1.2–1.8 kat daha güçlüdür, 4. adadan itibaren hepsi ayrıca 2 kat daha zordur** (güç = √(can × hasar)). Değerler `src/data.ts` içinde sabit tohumla üretilir.
- **Güç tek başına belirleyici değil:** hasar türü eşleşmesi (kesme/delme/ezme, zayıf olduğu türden ×4), kalkanın türü, miğfer ve kristal yetenekleri (kritik, can çalma, kaçınma) önemlidir. Can azaldıkça güç de düşer.
- **Köprü bossları:** her köprüde, bitirilen adanın boss'u gibi 2–3 bekçi durur (bir kez yenilir, ganimet verir, kapıyı etkilemez).
- **Kaya ve binalar** üzerinden geçilemez, etrafından dolaşılır; köprü ağızları ve kamplar açık bırakılır.
- **Bellek:** yalnızca önceki, şimdiki ve sonraki ada (veri ve görselleri) yüklüdür; köprüde yeni ada yüklenirken "Yükleniyor…" rozeti çıkar.
- **Boss evi mühürlüdür:** o adadaki diğer bütün kamplar (ilk kez) temizlenince açılır. Kalıcı harita kazancı yalnızca kampın ilk temizlenişinde ve oyuncu o adanın boss gücüne (×1.3) ulaşana kadar verilir; tekrar temizleme çiftliği yoktur.
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
- **Kamera:** nişan mesafesi arttıkça kadraj uzaklaşır (en fazla ×0.5); atış yalnızca ekrandaki hedeflere yapılır, hedef kadrajda kalır.
- **Yuvalar:** her 10 aşılan adada (10, 20, 30, 40) bir kristal yuvası ve bir ekipman ek yuvası (herhangi bir miğfer/kalkan) açılır; ek yuvalardaki eşyaların etkileri toplanır.
- **Kale/binalar** boss kadar canlıdır, zarar vermez; vurulup yıkılınca azami canın %2'sini iyileştirir ve 10 dk sonra yeniden kurulur. Aynı türden (tür + nadirlik + hasar türü) ekipman toplanınca otomatik birleşir, seviyesi artar.
- Yapıların %20'si boss canında, kalanı boss canının 1/2–1/5'i kadardır; ilk yıkışta kalıcı +%2 can verir (tekrarlarda yalnızca %2 iyileştirir). Eve dönerken engele takılan düşman iyileşmez; 1.2 sn takılırsa eve ışınlanır, ikinci takılmada iyileşmesi durur.
- **Yönlendirme oku:** boss evi açılınca boss evini, boss yenilince kapıyı, aksi halde gücüne göre rahatça yenebileceğin en yakın düşmanı (yoksa en zayıfını) gösterir (ekran dışındaysa kenarda ok + mesafe). Ayarlardan kapatılabilir.
- **Sandıklar:** her adada 2 açıkta, 2 gizli (yalnızca yaklaşınca görünür, haritada yok), 2 tanesi güçlü bir kamp ilk kez temizlenince belirir. Kapıya yaklaşırken eğitim hakkın varsa ok usta cadıyı gösterir.
- Karakter oyun alanının dışına çıkamaz: denizde, kilitli kapının ötesinde ya da engelin içinde bulunursa (eski kayıt, yeniden kurulan yapı vb.) en yakın yürünebilir noktaya alınır.
