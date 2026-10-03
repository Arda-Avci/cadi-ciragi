/**
 * Yerel bildirimler (yalnız mobil uygulamada): "iksirin hazır", "kediyi besleme zamanı", "kazan doldu", "günlük ödülün seni bekliyor".
 * Capacitor LocalNotifications eklentisi yoksa (web) sessizce hiçbir şey yapmaz. Cihazda denenmedi.
 */
import { BREW_TIME, FEED_CD, GARDEN_CD, PET_CD, SOUP_CAP, dayNumber } from './house.js';
import { N, T } from './i18n.js';
function plugin() {
    const cap = window.Capacitor;
    return cap?.Plugins?.LocalNotifications ?? null;
}
const ASKED = 'hexling-notif-asked';
let granted = null;
async function allowed(p) {
    if (granted !== null)
        return granted;
    try {
        // izin, ilk bildirim planlanırken bir kez sorulur
        const r = await p.requestPermissions();
        granted = r.display === 'granted';
        try {
            localStorage.setItem(ASKED, '1');
        }
        catch (e) {
            console.error('depolama yazılamadı', e);
        }
    }
    catch (e) {
        console.error('bildirim izni alınamadı', e);
        granted = false;
    }
    return granted;
}
/** ev işleri değiştikçe gelecekteki bildirimleri yeniden planlar (hepsi cihaz saatine göre) */
export function scheduleHouse(h, now) {
    const p = plugin();
    if (!p)
        return;
    const L = (s) => N(T(s));
    const items = [];
    if (h.brewAt > 0)
        items.push({ id: 1, at: h.brewAt + BREW_TIME, title: 'İksirin hazır', body: 'Kazandaki iksir demlendi, gelip topla.' });
    if (h.pet > 0)
        items.push({ id: 2, at: h.pet + PET_CD, title: 'Kedin seni özledi', body: 'Gelip sevebilirsin: kalıcı +%1 can.' });
    if (h.fed > 0 && h.food > 0)
        items.push({ id: 3, at: h.fed + FEED_CD, title: 'Kedi acıktı', body: 'Mama zamanı! Düzenli beslenme serini koru.' });
    if (h.garden > 0)
        items.push({ id: 4, at: h.garden + GARDEN_CD, title: 'Bahçen susadı', body: 'Bahçeyi sula: +%1 can ve 1 jeod.' });
    if (h.soupAt > 0)
        items.push({ id: 5, at: h.soupAt + SOUP_CAP, title: 'Kazan doldu', body: 'Kazanda 8 saatlik ruh seni bekliyor.' });
    // yarın sabah 10:00: günlük ödül
    const tomorrow = new Date((dayNumber(now) + 1) * 86400000 + new Date(now).getTimezoneOffset() * 60000 + 10 * 3600000);
    items.push({ id: 6, at: tomorrow.getTime(), title: 'Günlük ödülün hazır', body: 'Giriş serini koru: bugünün jeodu seni bekliyor.' });
    void (async () => {
        try {
            if (!(await allowed(p)))
                return;
            await p.cancel({ notifications: items.map((i) => ({ id: i.id })) });
            await p.schedule({
                notifications: items.filter((i) => i.at > now + 5000).map((i) => ({ id: i.id, title: L(i.title), body: L(i.body), schedule: { at: new Date(i.at) } })),
            });
        }
        catch (e) {
            console.error('bildirim planlanamadı', e);
        }
    })();
}
