# Mağaza formları için hazır cevaplar

Kodun gerçekte yaptığına göre hazırlandı (reklam: AdMob; satın alma: mağaza; sunucumuz yok). Formda kendi durumunu doğrula.

## Google Play — Veri güvenliği
- Veri topluyor musun? **Evet** (yalnızca AdMob aracılığıyla).
- Toplanan türler: **Cihaz veya diğer kimlikler** (reklam kimliği), **Uygulama etkileşimi/tanılama** (AdMob). Konum, kişi, mesaj, fotoğraf: **toplanmıyor**.
- Amaç: **Reklamcılık ya da pazarlama**, **Analiz**. Satın almalar: Google Play Faturalandırma (veri senin tarafına kişisel olarak gelmez).
- Üçüncü taraflarla paylaşım: **Evet** (Google AdMob).
- Aktarım sırasında şifreli: **Evet**. Kullanıcı veriyi silme talebi: uygulama hesap tutmaz; yerel veri uygulamayı silince kalkar.
- Hedef kitle: **13+ / genel**; çocuklara yönelik DEĞİL (aksi halde reklam kısıtları artar).
- Reklam içeriyor: **Evet**. Uygulama içi satın alma: **Evet**.

## IARC / yaş derecelendirmesi (Play) ve App Store yaş sorusu
- Şiddet: hayali, çizgi film tarzı büyü savaşı; kan/gore yok → **hafif fantezi şiddeti**.
- Kumar: yok. Rastgele ücretli ödül kutusu (loot box): **yok** (paketlerin etkisi açıkça yazılı).
- Kullanıcı etkileşimi/sohbet: yok. Konum paylaşımı: yok.
- Beklenen sonuç: PEGI 7 / ESRB Everyone 10+ / App Store 9+ civarı.

## Apple — App Privacy
- Takip (tracking): **Evet** (reklam kimliği, AdMob) → `NSUserTrackingUsageDescription` metni `scripts/inject-ads.py` içinde var.
- Veri türleri: Tanımlayıcılar (Cihaz kimliği/IDFA), Kullanım verisi (reklam etkileşimi). Kullanıcıya bağlı: hayır/evet seçimini AdMob kurulumuna göre işaretle.
- Restore Purchases: devam paketleri tüketilemez ürün → Apple "geri yükle" düğmesi ister. Mağaza panelinde "Satın alımları geri yükle" düğmesi var (yalnızca mobil uygulamada etkin); cihazda denenmedi.
