# Cadı Çırağı

Tarayıcıda ve telefonda çalışan, özgün cadı temalı bir keşif/aksiyon RPG'si. Hiçbir görsel/ses/kod başka bir oyundan alınmadı. Görseller Antigravity (`agy`) ile üretildi, hepsi `assets/` altında.

## Oyun mantığı

- **Tek büyük dünya:** üç bölge (Mantar Ormanı, Karanlık Bataklık, Buz Mağarası) köprülerle bağlı. Karakter serbestçe gezer. Bölgeler arası **kapı** önceki bölgenin boss'u yenilince açılır. Sağ üstteki minimap bütün dünyayı gösterir.
- **Büyüler (çevrede dönen bir şey yok):** cadı en yakın hedefe kendiliğinden büyü fırlatır.
  - Yıldız Değneği: delip geçen yıldız oku (Delme)
  - Uçan Süpürge: gidip dönen bumerang (Kesme)
  - Kaynar İksir: fırlatılıp patlayan iksir, alan hasarı (Ezme)
  - Büyülü Kepçe: yakın menzil darbesi (Ezme)
- **Güç:** oyuncunun ve her düşmanın üstünde güç sayısı yazar (yeşil: senden zayıf, sarı: denk, kırmızı: güçlü). Güç sonucu tek başına belirlemez: hasar türü eşleşmesi (zayıf olduğu türden ×4, dirençli ×0.15), kalkanın türü, miğfer, kristal yetenekleri (kritik, can çalma, kaçınma) ve hareket önemlidir.
- **Sabit kamplar, dalga yok:** bir kamp temizlenince gerçek zamanlı geri sayımla yeniden dolar (oyun kapalıyken de akar). Kamp gücü çok geniş aralıkta değişir.
- **Hızlı gelişim:** kopya eşikleri, yetenek/ekipman fiyatları ve kalıcı kazançlar cömert. Optimal bir oyuncu ilk boss'u ~8, dünyayı ~18 dakikada bitirir.
- **Kalıcı harita statları (`map.*`)**, kaynak ağaçları, **Muhafız** kampları (miğfer/kalkan düşürür), kopyayla silah seviyesi, kristaller (jeod, enchant), gizli sandıklar, yetenek ağacı.

## Son eklenenler

- **Ev:** doğduğun yer; içinde durunca hızlı iyileşirsin.
- **Usta Cadı:** her kapının yanında; üç mini oyunla (zamanlama, hafıza, yıldız) çırağı eğitir, kalıcı güç verir.
- **Ganimet otomatik:** düşman ölünce kazanç ekranda yazar ("+30 Can kazanıldı").
- **Harita:** sağ üstte bulunduğun alan, dokununca büyük harita; ok bakış yönünü gösterir.
- **Tüm ağaçlar kesilir**, oyuncunun üstünde can ve güç görünür, düşmanlarda halka yok, karakterler animasyonlu.
- **Boss gücü %45 azaltıldı.**

## Telefonda oynama

1. **Aynı Wi-Fi:** bilgisayarda sunucuyu `0.0.0.0` ile başlat (aşağıda), telefonun Chrome'unda `http://<bilgisayar-IP>:8766/index.html` aç.
2. **USB ile (çevrimdışı da çalışır):** telefonu USB hata ayıklamayla bağla, `adb reverse tcp:8765 tcp:8765`, telefonda `http://localhost:8765/index.html` aç, menüden **Ana ekrana ekle** de. İlk açılıştan sonra uygulama çevrimdışı çalışır.

Hareket: ekrana basılı tutup sürükle. Alt çubuktan Yetenek, Büyüler, Ekipman, Kristal, Stat, Harita.

## Çalıştırma (bilgisayar)

```powershell
& "C:\Users\Damla\Proje\AI-Publisher\node_modules\.bin\tsc.cmd" -p tsconfig.json
python -m http.server 8765 --bind 127.0.0.1     # yalnız bu bilgisayar
python -m http.server 8766 --bind 0.0.0.0       # ağdaki telefon için
```

## Görsel üretimi

`python tools/agy_assets.py [ad ...] [--force]` — `agy`nin `generate_image` aracıyla üretir, magenta arka planı şeffaflaştırır, `assets/manifest.json`'u günceller. İstemler `tools/gen_assets.py` içinde.

## Dosyalar

- `src/data.ts` büyü, yetenek, düşman, kamp seviyesi ve bölge tanımları (dengeyi buradan ayarla)
- `src/game.ts` oyun mantığı ve çizim
- `src/main.ts` paneller ve girdi
- `sw.js`, `manifest.webmanifest` telefona kurulabilir/çevrimdışı çalışma
- **Boss bir kez yenilir**, bir daha çıkmaz; kapı açılınca ekranda animasyon oynar.
- **Süpürge uçuşu:** boss ya da zor düşmana verilen her %10 zararda 5 sn uçarsın; havadayken zarar görmezsin.
- Can azaldıkça güç düşer; düşman sağlık çubuğu %50 altında sarı, %20 altında kırmızı. Kamplar halkayla işaretli, yürürken toz izi bırakılır. Yeni miğfer/kalkan daha iyiyse anında kuşanılır.
- **Usta Cadı** yalnızca o seviyenin boss'u yenilince ortaya çıkar; her seviye için günde 2 eğitim hakkı vardır (gece yarısı yenilenir).
- **Boss evi:** içindeyken hızlı iyileşirsin; eve vurarak boss'a zarar verirsin.
- **Yeni animasyon kareleri** (yürüme 4, büyü 2, uçuş 2) `tools/agy_sheet.py` ile Gemini/agy kare şeridinden üretilir.
- Yapılabilecek geliştirme varsa ilgili düğme parlar ve "Buraya tıkla!" balonu çıkar; oyun kesilmez.
