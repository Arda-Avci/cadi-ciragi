export const HOF_API = 'https://hexling-hof.ai-publisher.ai';
const KEY_STORE = 'cadi-ciragi-hofkey';
const REMOTE_STORE = 'cadi-ciragi-hof-remote';
const PUSHED_STORE = 'cadi-ciragi-hof-pushed';
/** bu cihazın gizli anahtarı: kahraman kayıtlarını yalnız bu cihaz güncelleyebilir */
function deviceKey() {
    try {
        let k = localStorage.getItem(KEY_STORE);
        if (!k || k.length < 16) {
            const a = new Uint8Array(24);
            crypto.getRandomValues(a);
            k = [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
            localStorage.setItem(KEY_STORE, k);
        }
        return k;
    }
    catch (e) {
        console.error('cihaz anahtarı yok', e);
        return 'yerel-anahtar-yok-' + Math.random().toString(36).slice(2);
    }
}
export function cachedRemoteHof() {
    try {
        return JSON.parse(localStorage.getItem(REMOTE_STORE) ?? '[]');
    }
    catch (e) {
        console.error('uzak liste okunamadı', e);
        return [];
    }
}
export async function fetchRemoteHof() {
    try {
        const r = await fetch(HOF_API + '/hof', { cache: 'no-store' });
        if (!r.ok)
            return null;
        const j = (await r.json());
        if (!Array.isArray(j.list))
            return null;
        try {
            localStorage.setItem(REMOTE_STORE, JSON.stringify(j.list));
        }
        catch (e) {
            console.error('uzak liste yazılamadı', e);
        }
        return j.list;
    }
    catch (e) {
        console.warn('şeref salonu sunucusuna ulaşılamadı', e);
        return null;
    }
}
let lastSig = '';
let lastAt = 0;
/** kendi kaydını gönderir: değişmediyse ya da 45 sn dolmadıysa göndermez */
export function pushHof(e, force = false) {
    const sig = [e.name, e.islands, e.kills, e.deaths, Math.round(e.power)].join('|');
    const now = Date.now();
    if (!force && (sig === lastSig || now - lastAt < 45000))
        return;
    lastSig = sig;
    lastAt = now;
    post(e);
}
function post(e) {
    return fetch(HOF_API + '/hof', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
        body: JSON.stringify({ id: e.id, key: deviceKey(), name: e.name, power: e.power, islands: e.islands, kills: e.kills, deaths: e.deaths, maxHp: e.maxHp, born: e.born, version: e.version }),
    }).then((r) => r.ok).catch((err) => { console.warn('şeref salonuna yazılamadı', err); return false; });
}
/** eski kahramanlar (bu cihazdaki liste) bir kez sunucuya taşınır: her çağrıda en çok 3 tane (hız sınırı) */
export async function pushOldHeroes(local) {
    let pushed = [];
    try {
        pushed = JSON.parse(localStorage.getItem(PUSHED_STORE) ?? '[]');
    }
    catch (e) {
        console.error('gönderilen liste okunamadı', e);
    }
    const todo = local.filter((x) => !pushed.includes(x.id)).slice(0, 3);
    for (const e of todo) {
        if (await post(e))
            pushed.push(e.id);
    }
    try {
        localStorage.setItem(PUSHED_STORE, JSON.stringify(pushed));
    }
    catch (e) {
        console.error('gönderilen liste yazılamadı', e);
    }
}
