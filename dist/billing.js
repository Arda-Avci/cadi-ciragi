/**
 * Uygulama içi satın alma (güç paketleri) — sağlayıcı soyutlaması.
 *
 * ÖNEMLİ: gerçek ödeme için mağaza hesapları, mağazada tanımlı ürünler ve (önerilen) sunucu tarafı makbuz doğrulaması gerekir;
 * ayrıntı docs/IAP.md. Bu dosya ürün listesini ve sağlayıcı arayüzünü tanımlar:
 *  - NativeBilling: Capacitor uygulamasında `cordova-plugin-purchase` (global CdvPurchase) varsa onu kullanır (cihazda DENENMEMİŞTİR).
 *  - DevBilling: yalnızca localhost'ta (geliştirme) sahte satın alma; yayınlanmış web/uygulamada KAPALI.
 */
export const PACKS = [
    { id: 'hexling.power.s', name: 'Küçük Güç Paketi', mul: 1.5, fallbackPrice: '—' },
    { id: 'hexling.power.m', name: 'Orta Güç Paketi', mul: 2, fallbackPrice: '—' },
    { id: 'hexling.power.l', name: 'Büyük Güç Paketi', mul: 3, fallbackPrice: '—' },
    { id: 'hexling.power.xl', name: 'Efsane Güç Paketi', mul: 5, fallbackPrice: '—' },
];
const none = {
    kind: 'none',
    prices: async () => ({}),
    purchase: async () => ({ ok: false, error: 'Mağaza yalnızca mobil uygulamada kullanılabilir.' }),
    restore: async () => [],
};
/** localhost'ta sahte satın alma (yayında asla etkin değil) */
const dev = {
    kind: 'dev',
    prices: async () => Object.fromEntries(PACKS.map((p) => [p.id, 'TEST'])),
    purchase: async (id) => (confirm('GELİŞTİRME: ' + id + ' sahte olarak satın alınsın mı?') ? { ok: true, receipt: 'dev-' + Date.now() } : { ok: false, error: 'İptal edildi.' }),
    restore: async () => [],
};
/** cordova-plugin-purchase (v13) üzerinden gerçek mağaza. Cihazda denenmemiştir; ürün kimlikleri mağazada tanımlı olmalıdır. */
function native(cdv, onGrant) {
    const { store, ProductType, Platform } = cdv;
    let ready = null;
    const init = () => {
        if (ready)
            return ready;
        const platform = window.Capacitor?.getPlatform?.() === 'ios' ? Platform.APPLE_APPSTORE : Platform.GOOGLE_PLAY;
        store.register(PACKS.map((p) => ({ id: p.id, type: ProductType.CONSUMABLE, platform })));
        store.when().approved((t) => {
            for (const pr of t.products ?? [])
                onGrant(pr.id, 'native');
            t.finish();
        });
        ready = store.initialize([platform]);
        return ready;
    };
    return {
        kind: 'native',
        prices: async () => {
            await init();
            const out = {};
            for (const p of PACKS) {
                const pr = store.get(p.id)?.pricing?.price;
                if (pr)
                    out[p.id] = pr;
            }
            return out;
        },
        purchase: async (id) => {
            try {
                await init();
                const offer = store.get(id)?.getOffer?.();
                if (!offer)
                    return { ok: false, error: 'Ürün mağazada bulunamadı.' };
                await offer.order();
                return { ok: true, receipt: 'native' }; // onaylanınca onGrant ayrıca çağrılır
            }
            catch (e) {
                return { ok: false, error: String(e) };
            }
        },
        restore: async () => { await init(); await store.restorePurchases(); return []; },
    };
}
/** çalışma ortamına göre sağlayıcı seçer */
export function createBilling(onGrant) {
    const w = window;
    if (w.Capacitor && w.CdvPurchase)
        return native(w.CdvPurchase, onGrant);
    if (['localhost', '127.0.0.1'].includes(location.hostname))
        return dev;
    return none;
}
