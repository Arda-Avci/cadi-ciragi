/**
 * Görevler: yeni oyuncuyu ilk dakikalarda elinden tutan eğitim zinciri + her gün yenilenen 3 günlük görev.
 * Saf veri/mantık; ödülleri Game verir.
 */
import { dayNumber } from './house.js';
const camps = (s) => Object.keys(s.first).filter((k) => k[0] === 's').length;
export const TUTORIAL = [
    { text: 'Bir düşmana yaklaş: büyün otomatik atılır', hint: 'Parmağını sürükleyerek yürü; düşman yaklaşınca büyü kendiliğinden gider.', reward: { essence: 20 }, done: (s) => s.kills >= 1, progress: (s) => `${Math.min(1, s.kills)}/1` },
    { text: 'Bir kampı tamamen temizle', hint: 'Bir kamptaki bütün düşmanları yen. Kamplar bir süre sonra yeniden dolar.', reward: { geodes: 1 }, done: (s) => camps(s) >= 1, progress: (s) => `${Math.min(1, camps(s))}/1` },
    { text: 'Bir sandık aç', hint: 'Sandıklara yaklaşman yeter. Bazıları gizli, bazıları bir kamp temizlenince çıkar.', reward: { geodes: 1 }, done: (s) => s.chests.length >= 1, progress: (s) => `${Math.min(1, s.chests.length)}/1` },
    { text: 'Yetenek ağacından bir geliştirme al', hint: 'Alttaki "Yetenek" düğmesine bas, topladığın ruhla bir yetenek yükselt.', reward: { essence: 30 }, done: (s) => Object.values(s.upgrades).some((v) => v > 0) },
    { text: 'Cadı Evi\'nde kediyi sev', hint: 'Sol üstteki 🏠 düğmesine bas ve kediyi sev: kalıcı +%1 can.', reward: { geodes: 2 }, done: (s) => s.house.pets >= 1 },
    { text: '5 kamp temizle', hint: 'Her kamp kalıcı güç ve kopya kazandırır.', reward: { geodes: 1, item: true }, done: (s) => camps(s) >= 5, progress: (s) => `${Math.min(5, camps(s))}/5` },
    { text: 'İlk adanın bossunu yen', hint: 'Bütün kampları temizleyince boss evinin mührü kalkar. Sonra bossa saldır.', reward: { geodes: 3 }, done: (s) => !!s.bossDown[0] },
    { text: 'Günlüğü oku', hint: '🏠 → Günlük sekmesinde kırık aynanın ilk sayfası seni bekliyor.', reward: { geodes: 2 }, done: (s) => s.storyRead >= 1 },
];
/** her gün verilen görev sayısı */
export const DAILY_COUNT = 5;
const POOL = [
    { t: 'kills', need: 40, text: '40 düşman yen' },
    { t: 'camps', need: 3, text: '3 kamp temizle' },
    { t: 'trees', need: 6, text: '6 ağaç kes' },
    { t: 'house', need: 2, text: 'Evde 2 iş yap' },
    { t: 'combo', need: 8, text: '8 büyü kombosu yap' },
    { t: 'duel', need: 1, text: 'Arenada 1 düello kazan' },
    { t: 'chests', need: 2, text: '2 sandık aç' },
    { t: 'geodes', need: 1, text: '1 jeod aç' },
    { t: 'snakes', need: 6, text: '6 yılan yen' },
];
export const dailyText = (t) => POOL.find((p) => p.t === t)?.text ?? t;
/** gün numarasından deterministik DAILY_COUNT farklı görev */
export function makeDaily(now) {
    const day = dayNumber(now);
    const idx = POOL.map((_, i) => i);
    let seed = day * 2654435761;
    const out = [];
    for (let k = 0; k < DAILY_COUNT; k++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const pick = idx.splice(seed % idx.length, 1)[0];
        out.push({ t: POOL[pick].t, need: POOL[pick].need, have: 0, claimed: false });
    }
    return { day, goals: out };
}
/** eski kayıtta bugünün görev sayısı DAILY_COUNT'tan azsa (3 görevli sürüm), mevcut ilerlemeyi bozmadan eksik görevler eklenir */
export function extendDaily(d) {
    if (d.goals.length >= DAILY_COUNT)
        return;
    const have = new Set(d.goals.map((g) => g.t));
    let seed = (d.day * 2654435761) >>> 0;
    const rest = POOL.filter((p) => !have.has(p.t));
    while (d.goals.length < DAILY_COUNT && rest.length) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const p = rest.splice(seed % rest.length, 1)[0];
        d.goals.push({ t: p.t, need: p.need, have: 0, claimed: false });
    }
}
