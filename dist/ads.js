/**
 * Reklamlar (Google AdMob): alt barın altında sürekli banner + isteğe bağlı ödüllü video.
 *
 * ÖNEMLİ: gerçek reklam için AdMob hesabı, uygulama kimliği ve reklam birimi kimlikleri gerekir (docs/ADS.md).
 * Aşağıdaki kimlikler Google'ın herkese açık TEST kimlikleridir; test reklamı gösterir, para kazandırmaz.
 * Yayına çıkmadan önce kendi kimliklerinle değiştir ve TESTING = false yap.
 *  - NativeAds: Capacitor uygulamasında @capacitor-community/admob eklentisini kullanır (cihazda DENENMEMİŞTİR).
 *  - DevAds: yalnızca localhost'ta sahte banner ve 3 sn'lik sahte ödüllü reklam.
 *  - Web (yayında): reklam yok (AdSense/AdMob web desteği yoktur).
 */
export const TESTING = true;
const IDS = {
    android: { banner: 'ca-app-pub-3940256099942544/6300978111', rewarded: 'ca-app-pub-3940256099942544/5224354917' },
    ios: { banner: 'ca-app-pub-3940256099942544/2934735716', rewarded: 'ca-app-pub-3940256099942544/1712485313' },
};
const none = { kind: 'none', showBanner: async () => undefined, showRewarded: async () => false };
const dev = {
    kind: 'dev',
    showBanner: async (onHeight) => {
        const el = document.getElementById('ad-slot');
        if (el) {
            el.style.display = 'flex';
            el.textContent = 'REKLAM (test banner)';
        }
        onHeight(56);
    },
    showRewarded: () => new Promise((resolve) => {
        const ov = document.createElement('div');
        ov.style.cssText = 'position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.92);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font:700 20px system-ui';
        ov.textContent = 'TEST REKLAMI 3';
        document.body.append(ov);
        let n = 3;
        const t = setInterval(() => {
            n--;
            ov.textContent = n > 0 ? 'TEST REKLAMI ' + n : 'Ödül hazır';
            if (n <= 0) {
                clearInterval(t);
                setTimeout(() => { ov.remove(); resolve(true); }, 500);
            }
        }, 1000);
    }),
};
function native(p, platform) {
    const ids = IDS[platform];
    let ready = null;
    const init = () => {
        if (ready)
            return ready;
        ready = (async () => {
            try {
                if (platform === 'ios')
                    await p.requestTrackingAuthorization?.();
            }
            catch (e) {
                console.error('izleme izni alınamadı', e);
            }
            try {
                const info = await p.requestConsentInfo?.();
                if (info?.isConsentFormAvailable && info.status === 'REQUIRED')
                    await p.showConsentForm?.(); // AB/KVKK onayı
            }
            catch (e) {
                console.error('onay formu açılamadı', e);
            }
            await p.initialize({ initializeForTesting: TESTING });
        })();
        return ready;
    };
    return {
        kind: 'native',
        showBanner: async (onHeight) => {
            await init();
            await p.addListener('bannerAdSizeChanged', (e) => { if (e.height)
                onHeight(e.height); });
            onHeight(56);
            await p.showBanner({ adId: ids.banner, adSize: 'ADAPTIVE_BANNER', position: 'BOTTOM_CENTER', margin: 0, isTesting: TESTING });
        },
        showRewarded: async () => {
            await init();
            let earned = false;
            const sub = await p.addListener('onRewardedVideoAdReward', () => { earned = true; });
            try {
                await p.prepareRewardVideoAd({ adId: ids.rewarded, isTesting: TESTING });
                await p.showRewardVideoAd();
            }
            finally {
                sub.remove();
            }
            return earned;
        },
    };
}
export function createAds() {
    const w = window;
    const plat = w.Capacitor?.getPlatform?.();
    const admob = w.Capacitor?.Plugins?.AdMob;
    if (admob && (plat === 'ios' || plat === 'android'))
        return native(admob, plat);
    if (['localhost', '127.0.0.1'].includes(location.hostname))
        return dev;
    return none;
}
/** reklam altyapısı olmayan ortamlarda (web) ödüllü reklam yerine 3 sn test reklamı gösterir */
export const testRewarded = () => dev.showRewarded();
