# Gelir modeli: güç paketleri (IAP) + reklamlar (AdMob)

Kodda hazır olanlar ve para kazanmak için senin yapman gerekenler.

## Kodda hazır

- **Güç paketleri** (`src/billing.ts`, Güç Paketleri paneli — sol üstteki ⚡ düğmesi): 4 ürün (`hexling.power.s/m/l/xl`, gücü ×1.5 / ×2 / ×3 / ×5 yapar). Kalıcı, çarpımsal ve toplanır. Ücretsiz ilerleme kazancı (kamp/ağaç/boss) satın alınan güçten etkilenmez: kazanç hedefi paketsiz güce göre hesaplanır.
- **Reklamlar** (`src/ads.ts`): alt barın altında sürekli banner; Güç Paketleri panelinde "Ücretsiz ödüller (reklam)": ödüllü videoyla Destansı miğfer/kalkan, 2 jeod, ruh paketi. Ödül başına 3 dk bekleme, günde 10 reklam.
- **Sağlayıcılar:** mobil uygulamada gerçek (`NativeBilling` = `cordova-plugin-purchase`, `NativeAds` = `@capacitor-community/admob`); `localhost`'ta sahte (geliştirme); yayındaki web sürümünde mağaza ve reklam KAPALI.
- **CI:** `scripts/inject-ads.py` AdMob uygulama kimliğini Android/iOS projesine ekler. Kimlik verilmezse Google'ın TEST kimlikleri kullanılır (test reklamı gösterir, **para kazandırmaz**).

> **Cihazda denenmedi.** Native satın alma ve reklam akışları yalnızca derlendi. Gerçek cihazda ve test hesaplarıyla denenmeden yayınlama.

## Para kazanmak için yapılması gerekenler (sen)

1. **Mağaza hesapları:** Google Play Console (tek sefer ücret) ve Apple Developer Program (yıllık ücret). Şirket/vergi/banka bilgileri.
2. **Ürünleri tanımla:** her iki mağazada da `hexling.power.s`, `.m`, `.l`, `.xl` kimlikleriyle **tüketilebilir** (consumable) ürünler oluştur ve fiyatlandır. Kimlikler `src/billing.ts` içindeki `PACKS` ile aynı olmalı.
3. **AdMob:** hesap aç, Android ve iOS için birer uygulama ekle, **uygulama kimliği** ve banner + ödüllü reklam birimi kimliklerini al.
   - Uygulama kimliklerini GitHub deposunda *Settings → Secrets and variables → Actions → Variables* altına `ADMOB_ANDROID_APP_ID` ve `ADMOB_IOS_APP_ID` olarak ekle.
   - Reklam birimi kimliklerini `src/ads.ts` içindeki `IDS`'e yaz ve `TESTING = false` yap. (Geliştirirken test kimliklerinde kal; kendi reklamına kendin tıklamak hesabın kapanmasına yol açar.)
4. **İmzalı sürümler:** Android için imzalı release (AAB) ve iOS için Apple sertifikası/provisioning gerekir. CI şu an debug APK ve **imzasız** IPA üretir; bunlarla mağazaya yüklenemez ve satın alma çalışmaz.
5. **Gizlilik politikası** (URL) ve mağaza formları: reklam kimliği kullanımı, veri toplama beyanı, yaş derecelendirmesi, iOS App Tracking Transparency metni (`scripts/inject-ads.py` içinde örnek var).
6. **AB/Birleşik Krallık onayı (GDPR/UMP):** AdMob'da onay mesajını yapılandır; uygulama açılışta onay formunu çağırır (`src/ads.ts`).

## Bilinmesi gerekenler

- **Sunucu yok:** satın alımlar cihazdaki kayıtta tutulur. Uygulama silinince ya da cihaz değişince paketler kaybolur; tüketilebilir ürünler mağazadan "geri yüklenemez". Gerçek gelir ve kullanıcı güveni için hesap + sunucu tarafı makbuz doğrulaması (ör. RevenueCat) önerilir. Kayıt tarayıcı/yerel depoda olduğu için kurcalanabilir; güvenlik gerekiyorsa sunucuya taşınmalı.
- **Banner yerleşimi:** AdMob politikası, reklamın düğmelere yanlışlıkla tıklanacak kadar yakın durmasını yasaklar. Alt çubuk banner'ın hemen üstünde; gerçek cihazda boşluğu kontrol et, gerekirse çubukla banner arasına boşluk bırak.
- **Satış etiği/uyumluluk:** fiyat ve etkiyi (×çarpan) açık göstermek, iade/geri yükleme akışını sunmak ve çocuklara yönelik değilse bunu beyan etmek mağaza onayı için gerekir. Rastgele ödüllü (loot box) satış eklenirse ek kurallar (olasılık açıklama, bazı ülkelerde yasak) devreye girer.
- **Dengeleme:** güç paketi ×çarpan olduğu için ada adımları (1.2–1.8×), bosslar (×2) ve canavarlarla birlikte "duvar" oluşur; botla ölçülen duvar noktasını ve paket çarpanlarını birlikte ayarla.
