/**
 * Uygulama içi satın alma (güç paketleri) — sağlayıcı soyutlaması.
 *
 * ÖNEMLİ: gerçek ödeme için mağaza hesapları, mağazada tanımlı ürünler ve (önerilen) sunucu tarafı makbuz doğrulaması gerekir;
 * ayrıntı docs/IAP.md. Bu dosya ürün listesini ve sağlayıcı arayüzünü tanımlar:
 *  - NativeBilling: Capacitor uygulamasında `cordova-plugin-purchase` (global CdvPurchase) varsa onu kullanır (cihazda DENENMEMİŞTİR).
 *  - DevBilling: yalnızca localhost'ta (geliştirme) sahte satın alma; yayınlanmış web/uygulamada KAPALI.
 */

export interface Pack {
  id: string; // mağaza ürün kimliği (App Store Connect / Play Console'da aynı olmalı)
  name: string;
  /** satın alınca gücü kaç kat artırır (kalıcı, çarpımsal; güç = √(can × hasar), can ve hasar ×mul) */
  mul: number;
  /** mağazadan fiyat gelmezse gösterilecek yer tutucu */
  fallbackPrice: string;
}

export const PACKS: Pack[] = [
  { id: 'hexling.power.s', name: 'Küçük Güç Paketi', mul: 1.5, fallbackPrice: '—' },
  { id: 'hexling.power.m', name: 'Orta Güç Paketi', mul: 2, fallbackPrice: '—' },
  { id: 'hexling.power.l', name: 'Büyük Güç Paketi', mul: 3, fallbackPrice: '—' },
  { id: 'hexling.power.xl', name: 'Efsane Güç Paketi', mul: 5, fallbackPrice: '—' },
];

/** 40. adadan sonrası için devam paketleri: bir kez alınır, kalıcıdır, mağazadan geri yüklenebilir (NON_CONSUMABLE) */
export interface LevelPack { id: string; name: string; levels: number; fallbackPrice: string }
export const LEVEL_PACKS: LevelPack[] = [
  { id: 'hexling.levels.5', name: 'Devam Paketi +5 Seviye', levels: 5, fallbackPrice: '—' },
  { id: 'hexling.levels.10', name: 'Devam Paketi +10 Seviye', levels: 10, fallbackPrice: '—' },
  { id: 'hexling.levels.20', name: 'Devam Paketi +20 Seviye', levels: 20, fallbackPrice: '—' },
  { id: 'hexling.levels.30', name: 'Devam Paketi +30 Seviye', levels: 30, fallbackPrice: '—' },
  { id: 'hexling.levels.50', name: 'Devam Paketi +50 Seviye', levels: 50, fallbackPrice: '—' },
  { id: 'hexling.levels.100', name: 'Devam Paketi +100 Seviye', levels: 100, fallbackPrice: '—' },
];
/** okçu: tek seferlik (non-consumable) özel ürün; oyuncu elle nişan alıp atar, ayarlardan açılıp kapatılır */
export const ARCHER = { id: 'hexling.archer', name: 'Okçu', fallbackPrice: '—' };
/** yeniden doğuş: her seferinde satın alınır (consumable); seviye 1'e döner, güç korunur */
export const REBIRTH = { id: 'hexling.rebirth', name: 'Yeniden Doğuş', fallbackPrice: '—' };
const ALL_IDS = [...PACKS.map((p) => p.id), ...LEVEL_PACKS.map((p) => p.id), ARCHER.id, REBIRTH.id];

export interface PurchaseResult { ok: boolean; error?: string; receipt?: string }

export interface Billing {
  readonly kind: 'native' | 'dev' | 'none';
  /** mağazadan gerçek fiyatlar (varsa) */
  prices(): Promise<Record<string, string>>;
  purchase(id: string): Promise<PurchaseResult>;
  /** önceden alınan paketleri geri yükler (Apple zorunlu kılar) */
  restore(): Promise<string[]>;
}

const none: Billing = {
  kind: 'none',
  prices: async () => ({}),
  purchase: async () => ({ ok: false, error: 'Mağaza yalnızca mobil uygulamada kullanılabilir.' }),
  restore: async () => [],
};

/** sayfa içi onay kutusu: tarayıcı confirm() penceresi birkaç denemeden sonra engellenebiliyor (satın alma sessizce iptal sayılıyordu) */
function askDev(id: string): Promise<boolean> {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:300;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center';
    const box = document.createElement('div');
    box.style.cssText = 'background:#241a40;color:#fff;border:1px solid #fff4;border-radius:12px;padding:18px;max-width:300px;text-align:center;font:15px sans-serif';
    box.textContent = 'GELİŞTİRME: ' + id + ' sahte olarak satın alınsın mı?';
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:10px;margin-top:14px;justify-content:center';
    const done = (v: boolean): void => { wrap.remove(); resolve(v); };
    for (const [label, v] of [['Evet', true], ['Hayır', false]] as [string, boolean][]) {
      const b = document.createElement('button');
      b.textContent = label;
      b.style.cssText = 'flex:1;padding:10px;border-radius:8px;border:0;font:bold 15px sans-serif;background:' + (v ? '#d9822b' : '#3a3350') + ';color:#fff';
      b.addEventListener('click', () => done(v));
      row.append(b);
    }
    box.append(row);
    wrap.append(box);
    document.body.append(wrap);
  });
}

/** localhost'ta sahte satın alma (yayında asla etkin değil) */
const dev: Billing = {
  kind: 'dev',
  prices: async () => Object.fromEntries(ALL_IDS.map((id) => [id, 'TEST'])),
  purchase: async (id) => ((await askDev(id)) ? { ok: true, receipt: 'dev-' + Date.now() } : { ok: false, error: 'İptal edildi.' }),
  restore: async () => [],
};

interface CdvStore {
  register(p: unknown): void;
  initialize(platforms?: unknown[]): Promise<unknown>;
  get(id: string): { pricing?: { price?: string }; getOffer?: () => { order: () => Promise<unknown> } } | undefined;
  restorePurchases(): Promise<unknown>;
  when(): { approved(cb: (t: { finish: () => void; products?: { id: string }[] }) => void): unknown };
  products: { id: string }[];
}
interface CdvGlobal { store: CdvStore; ProductType: { CONSUMABLE: string; NON_CONSUMABLE: string }; Platform: { APPLE_APPSTORE: string; GOOGLE_PLAY: string } }

/** cordova-plugin-purchase (v13) üzerinden gerçek mağaza. Cihazda denenmemiştir; ürün kimlikleri mağazada tanımlı olmalıdır. */
function native(cdv: CdvGlobal, onGrant: (id: string, receipt: string) => void): Billing {
  const { store, ProductType, Platform } = cdv;
  let ready: Promise<unknown> | null = null;
  const init = (): Promise<unknown> => {
    if (ready) return ready;
    const platform = (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor?.getPlatform?.() === 'ios' ? Platform.APPLE_APPSTORE : Platform.GOOGLE_PLAY;
    store.register([
      ...PACKS.map((p) => ({ id: p.id, type: ProductType.CONSUMABLE, platform })),
      ...LEVEL_PACKS.map((p) => ({ id: p.id, type: ProductType.NON_CONSUMABLE, platform })),
      { id: ARCHER.id, type: ProductType.NON_CONSUMABLE, platform },
      { id: REBIRTH.id, type: ProductType.CONSUMABLE, platform },
    ]);
    store.when().approved((t) => {
      for (const pr of t.products ?? []) onGrant(pr.id, 'native');
      t.finish();
    });
    ready = store.initialize([platform]);
    return ready;
  };
  return {
    kind: 'native',
    prices: async () => {
      await init();
      const out: Record<string, string> = {};
      for (const id of ALL_IDS) { const pr = store.get(id)?.pricing?.price; if (pr) out[id] = pr; }
      return out;
    },
    purchase: async (id) => {
      try {
        await init();
        const offer = store.get(id)?.getOffer?.();
        if (!offer) return { ok: false, error: 'Ürün mağazada bulunamadı.' };
        await offer.order();
        return { ok: true, receipt: 'native' }; // onaylanınca onGrant ayrıca çağrılır
      } catch (e) { return { ok: false, error: String(e) }; }
    },
    restore: async () => { await init(); await store.restorePurchases(); return []; },
  };
}

/** çalışma ortamına göre sağlayıcı seçer */
export function createBilling(onGrant: (id: string, receipt: string) => void): Billing {
  const w = window as unknown as { CdvPurchase?: CdvGlobal; Capacitor?: unknown };
  if (w.Capacitor && w.CdvPurchase) return native(w.CdvPurchase, onGrant);
  if (['localhost', '127.0.0.1'].includes(location.hostname)) return dev;
  return none;
}
