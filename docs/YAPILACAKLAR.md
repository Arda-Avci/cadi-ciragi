# Yayın için SENİN yapman gerekenler

Kodda hazır olan her şey `docs/MONETIZATION.md`'de. Burada yalnızca insan adımları var; hesap, ödeme, kimlik ve imza gerektirdikleri için ben yapamam. Sıra önemli.

## Hazır dosyalar (`store/`)
| Dosya | Ne için |
|---|---|
| `store/screenshots/01…08_*.png` | 1080x1920 telefon ekran görüntüleri (Play ≥2, App Store 6,5" için yeniden boyutlandır) |
| `store/screenshots/feature_graphic_1024x500.png` | Play "öne çıkan görsel" |
| `icons/icon-512.png` | Play 512x512 uygulama simgesi |
| `store/listing_tr.md`, `store/listing_en.md` | başlık, kısa/tam açıklama, anahtar kelimeler |
| `store/privacy-policy.html` | gizlilik politikası TASLAĞI (alanları doldur, bir URL'de yayınla) |
| `store/data_safety_ve_derecelendirme.md` | Play veri güvenliği / yaş derecelendirmesi / Apple gizlilik cevapları |
| `store/iap_urunleri.csv` | mağazada oluşturulacak 8 ürün (kimlik, tür, önerilen fiyat) |

Ekran görüntülerini yenilemek: `python -m http.server 8765` çalışırken `node tools/store_shots.mjs`.

## 1. Hesaplar
1. Google Play Console (tek sefer ücret) + Apple Developer Program (yıllık). Şirket/vergi/banka bilgileri, Play'de ödeme profili.
2. AdMob hesabı; Android ve iOS için birer uygulama ekle. **Uygulama kimliği** (`ca-app-pub-…~…`) ve **banner + ödüllü** birim kimliklerini (`ca-app-pub-…/…`) not al. Ben AdMob'u Play Console'a bağlayamadım (oturum açma bilgisi girmem yasak): bunu sen yap.

## 2. Gizlilik politikası
`store/privacy-policy.html` içindeki `[GELİŞTİRİCİ ADI]` ve `[İLETİŞİM E-POSTASI]` alanlarını doldur, herkese açık bir adreste yayınla (ör. GitHub Pages) ve URL'yi iki mağazaya gir.

## 3. Uygulama içi ürünler (iki mağazada da AYNI kimliklerle)
`store/iap_urunleri.csv`'deki 8 ürünü oluştur:
- 4 güç paketi: **tüketilebilir** (consumable).
- 4 devam paketi (`hexling.levels.5/10/20/30`): **tüketilemez** (non-consumable). Aynı hesapta tek sefer alınır, mağazadan geri yüklenir.
- Fiyatları kendin belirle (csv'deki öneri yalnızca başlangıç). Ürünler "Aktif" olmadan satın alma çalışmaz.

## 3b. Devam paketi mantığı (bilmen gerekenler)
- 1–40. adalar ücretsiz. 40. bossu yenince oyun mağazayı açar; kapı kilitli kalır.
- Açık ada sayısı = 40 + satın alınan paketlerin toplamı (en çok 69). 29 ada kaldığı için +5 ve +10 ve +20 birlikte yeter; +30 tek başına hepsini açar.
- 69. adanın bossu yenilince rakip cadıyla düello (ayrı dövüş oyunu) başlar; kazanınca oyun biter.
- Her ada öncekinden 3 kat zor: ücretsiz ilerleme kazancı bunu karşılamaz; oyuncu güç paketi almazsa duvara çarpar. Bunu bilerek tasarladık ama etik/iade sorunu için Play'in "yanıltıcı değil" kuralına uy: fiyat ve etki açık yazılı.

## 4. İmzalı sürümler
- Android: imzalı **AAB** (upload key oluştur, Play App Signing aç). CI şu an yalnızca debug APK üretir; mağazaya yüklenemez.
- iOS: Apple sertifikası + provisioning profili; CI imzasız IPA üretir.
- İstersen anahtarları GitHub Secrets'a eklersen ben imzalı derleme adımını yazarım (anahtarları sohbete yazma).

## 5. AdMob kimliklerini koda gir
1. Depo → Settings → Secrets and variables → Actions → **Variables**: `ADMOB_ANDROID_APP_ID`, `ADMOB_IOS_APP_ID`.
2. `src/ads.ts` içindeki `IDS` değerlerine banner/ödüllü birim kimliklerini yaz, `TESTING = false` yap (derle, yayınla).
3. Geliştirirken test kimliklerinde kal; kendi reklamına tıklama.

## 6. Mağaza formları
Play: uygulama içeriği (reklam var, IAP var, hedef kitle 13+), veri güvenliği, yaş derecelendirme anketi → `store/data_safety_ve_derecelendirme.md`. Apple: App Privacy, yaş derecelendirmesi, ekran görüntüleri (6,5" ve 5,5" boyutlarına yeniden boyutlandır), "Restore Purchases" davranışı için inceleme notu.
AB/UK için AdMob'da onay mesajını (UMP) yapılandır.

## 7. Cihazda test (yayından önce şart)
Satın alma, geri yükleme, banner ve ödüllü reklam akışları yalnızca derlendi, hiç gerçek cihazda çalıştırılmadı. Play iç test kanalında lisans test hesabıyla ve TestFlight'ta sandbox hesabıyla dene.

## 8. Bilinen eksikler
- Sunucu tarafı makbuz doğrulaması yok (yerel kayıt kurcalanabilir; gelir riski). RevenueCat gibi bir hizmet önerilir.
- Banner ile alt düğmeler arasında boşluk gerçek cihazda kontrol edilmeli (AdMob yanlış tıklama politikası).
- Düello oyunu (dövüş) ve 41–69 ada dengesi insan oynanışıyla denenmedi; yalnızca derleme + tarayıcı duman testi yapıldı.

## 9. Test parametresi
`?level=N` (1-69) oyunu N. adadan başlatır: önceki bosslar yenik, güç/can adaya göre ayarlı, tüm yuvalar 1. seviye eşyayla dolu. Gerçek kayda dokunmaz (ayrı anahtar: cadi-ciragi-test).
