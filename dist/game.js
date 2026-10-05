import { BASE_ISLANDS, BOSS_MUL, SOFT_CAP_FROM, softCap, BRIDGE_HALF_WIDTH, CRYSTAL_STATS, CSTAT_KEYS, statIcon, DTYPES, DTYPE_NAMES, ENEMIES, EQUIP_NAMES, MAX_ENCHANT, MAX_ITEM_LEVEL, MAX_WEAPON_LEVEL, RARITIES, TIERS, UPGRADES, WEAPONS, ZONES, crystalValue, enchantChance, enchantCost, fmtNum, itemUpgradeCost, itemValue, upgradeCost, weaponLevelCopies, } from './data.js';
import { VERSION } from './version.js';
import { ARCHER, LEVEL_PACKS, PACKS, REBIRTH, SPELL } from './billing.js';
import { FEED_GAP, HOUSE_DMG_CAP, HOUSE_HP_CAP, dayNumber, freshHouse, soupMs, tasks } from './house.js';
import { TUTORIAL, dailyText, extendDaily, makeDaily } from './quests.js';
import { scheduleHouse } from './notify.js';
import { OUTFITS, weekly } from './meta.js';
import { ENERGY_MAX, FEED_SECONDS, LEVEL_COST, LEVEL_GROWTH, LEVEL_KILLS, MAX_TIGER_ITEM_LEVEL, TIGER_POWER, WOUND_FLOOR, TIGER_REGEN_CAP, TIGER_SLOTS, TIGER_SLOT_LIST, freshTiger, tigerBonus } from './tiger.js';
import { audio } from './audio.js';
import { Ambient, drawBridge, drawGateArt, drawShore, drawVignette, shade } from './scenery.js';
import { N, T } from './i18n.js';
import { CURSE_MUL, CURSE_SEC, CURSE_TEXT, GIANT_STAGES, PROVOKE, PROVOKE_TITLE, TONES, TREMOR_TEXT, arcAt } from './story.js';
import { cachedRemoteHof, fetchRemoteHof, pushHof, pushOldHeroes } from './hof.js';
import { changed as settingsChanged, settings, vibrate } from './settings.js';
const HOF_KEY = 'cadi-ciragi-hof';
/** adaya özel görseller (bellekte yalnızca yüklü adaların görselleri tutulur) */
const BIOME_ART = /^(ground|tree|boss|beast|rock|bld)_/;
/** Evimiz: doğduğumuz yer ve hızlı iyileşme alanı */
export const HOME = { x: 0, y: 40, r: 150 };
const HOME_HEAL = 0.28; // saniyede azami canın oranı
/** bonus tur düşmanlarının kamp kimliği (gerçek kamplarla çakışmaz) */
const BONUS_SP = -777;
const REFL_SP = -999; // ayna yansıması
const RAID_SP = -666; // 50. adadaki devler saldırısı
const BEE_SP = -888;
/** arı türleri: işçi (güç %2-2,9), asker (%3-3,9), kraliçe (%4-5); her birinin kendi görseli var (assets/bee_*.png) */
const BEE_KINDS = [
    { spr: 'bee_worker', label: 'İşçi Arı', frac: [0.02, 0.029], speed: 150, r: 9 },
    { spr: 'bee_soldier', label: 'Asker Arı', frac: [0.03, 0.039], speed: 120, r: 11 },
    { spr: 'bee_queen', label: 'Kraliçe Arı', frac: [0.04, 0.05], speed: 95, r: 15 },
];
const BONUS_COUNT = 400;
const BONUS_SEC = 120;
/** test parametresi: ?level=N oyunu N. adadan başlatır (gücü/canı o seviyeye göre ayarlar, tüm yuvaları 1. seviye eşyalarla doldurur); gerçek kayda dokunmaz */
const TEST_LEVEL = (() => {
    try {
        const v = Math.floor(Number(new URLSearchParams(location.search).get('level')));
        return v >= 1 && v <= ZONES.length ? v : 0;
    }
    catch (e) {
        console.error('test parametresi okunamadı', e);
        return 0;
    }
})();
/** test parametresi: ?level=N&mine=1 madeni başlangıçta keşfedilmiş verir (giriş başlangıç noktasının yanındadır) */
const TEST_MINE = TEST_LEVEL > 0 && location.search.includes("mine=1");
const SAVE_KEY = TEST_LEVEL ? 'cadi-ciragi-test' : 'cadi-ciragi-v6'; // v6: 40 adalık yeni dünya
const TREE_RESPAWN = 120;
/** canavar: boss'a göre can ve hasar ×2 → güç ×2 */
const BEAST_MUL = 2;
/** zor boss: ada bossu yenildikten sonra günde bir kez, güç ×3 */
/** tüm karakterler (düşmanlar, kahraman, kaplan) biraz daha kolay hasar alır: düşmanlar, kahraman ve kaplan +%15 */
const DMG_DEALT = 1.15;
const DMG_TAKEN = 1.15;
const HARD_BOSS_MUL = 2.4; // zor boss: boss'un 2,4 katı (eskiden 3; %20 düşürüldü)
/** bu adadan itibaren (dizin) daha sık kamp: komşu kampların bölgeleri iç içe geçer */
const DENSE_FROM = 10;
/** dev yılanın bir bölümü (can çarpanı bölüme göre değişir) */
const SNAKE_SEG_DEF = { id: 'snake', name: 'Dev Yılan', hp: 1210, speed: 0, dmg: 15, r: 17, atk: 'pierce', resist: { cut: 1.8, pierce: 0.5, smash: 1.2 }, drop: 12 };
const CAMP_WEIGHT = { easy: 1, medium: 2, hard: 3, elite: 5, knight: 5, boss: 15 };
const GATE_GAP = 160; // kapı, bölge kıyısından bu kadar ileride
function rng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
export class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.px = 0;
        this.py = 0;
        this.region = 0;
        this.hp = 100;
        this.invuln = 0;
        this.time = 0;
        this.skew = 0; // test için: gerçek zaman kaydırma (ms)
        this.enemies = [];
        this.projs = [];
        this.orbs = [];
        this.floaters = [];
        this.paused = false;
        this.dead = 0;
        this.banner = '';
        this.bannerT = 0;
        this.keys = new Set();
        this.joy = null;
        this.onChange = () => { };
        /** 40. ada tamamlanınca (devam paketi gerekir) çağrılır: arayüz mağazayı açar */
        this.onPaywall = () => { };
        /** önemli bir ada bossu yenilince hikâye ara sahnesi gösterilir */
        this.onStory = () => { };
        this.idleT = 0;
        this.idleAcc = 0;
        /** dev yılan kahramanı sarmış: yavaşlatır */
        this.wrapT = 0;
        this.paywallT = 0;
        this.questT = 0;
        /** ekran sarsıntısı (piksel): sert vuruşlarda artar, hızla söner */
        this.shake = 0;
        this.rivalT = 0;
        /** son adanın bossu yenilince: rakip cadıyla ayrı dövüş oyunu başlatılır */
        this.onDuel = () => { };
        // animasyon / efekt durumu
        this.face = 0; // bakış yönü (radyan): haritadaki ok bunu gösterir
        this.moving = false;
        this.mapOpen = false;
        /** 'world': Harita düğmesi (çevredeki 10 ada); 'island': sağ üstteki mini harita (bulunulan adanın tamamı, keşfedilmeyen yerler bulutlu) */
        this.mapMode = 'world';
        this.seenT = 0;
        this.seenVer = 0;
        this.fogCache = null;
        this.castPulse = 0;
        /** kamera yakınlığı: nişan mesafesi arttıkça uzaklaşır (1 = normal) */
        this.zoom = 1;
        this.vw = 0;
        this.vh = 0;
        /** süpürge uçuşu: kalan saniye; havadayken düşman zarar veremez */
        this.flyT = 0;
        this.flyMark = new WeakMap();
        this.puffs = [];
        this.puffT = 0;
        this.ambient = new Ambient();
        this.bossHealAcc = 0;
        this.bossHealShow = 0;
        /** kapı açılış animasyonu (bölge numarası, kalan süre) */
        this.gateAnim = null;
        this.exitAnim = null;
        this.hurtFlash = 0;
        this.deathFx = [];
        this.gains = [];
        this.healAcc = 0;
        this.healShow = 0;
        this.nowMs = Date.now();
        this.mini = { x: 0, y: 0, r: 0 };
        this.world = null;
        this.treeHp = new Map();
        this.cast = new Map();
        this.saveT = 0;
        this.w = 0;
        this.h = 0;
        this.sprites = new Map();
        this.tinted = new Map();
        // ---- kayıt ----
        /** test modu hasarı: tipik bir kampın ~30 sn'de temizlenmesi için saniyelik hasar hedeflenir (fazlaysa hasar kısılır, azsa düz hasar eklenir) */
        this.testDmgF = 1;
        this.rests = null;
        this.floorSeen = 0;
        // ---- dünya: yalnızca önceki, şimdiki ve sonraki ada yüklüdür ----
        this.zoneCache = new Map();
        this.loaded = [];
        this.spawnerMap = new Map();
        /** "Yükleniyor…" yazısının kalan süresi */
        this.loadT = 0;
        this.pendingLoads = 0;
        this.loadingNames = new Set();
        this.treeCells = new Map();
        // ---- yılanlar: 3. adadan itibaren bazı kuleler yıkılınca çok sayıda küçük yılan, 5. adadan sonra bazı kulelerden dev yılan çıkar ----
        /** kule bir yılan yuvası mı: küçük (3. adadan) ya da dev (4. adadan; ada dizini ≥ 3) */
        this.nestCache = new Map();
        /** dev yılan: çok bölümlü; her bölümün canı farklı; ana karakterin etrafını sarar; bütün bölümler vurulunca ölür */
        this.snakes = new Map();
        /** dev yılanın tükürdüğü zehir topları (uzaktan saldırı) */
        this.venoms = [];
        this.snakeGid = 0;
        this.snakeDone = new Set();
        /** peş peşe dev yılan: kule kimliği -> kalan yılan sayısı ve çıkış noktası */
        this.snakeQueue = new Map();
        this.snakePending = [];
        /** dev yılan savaşı: yılan yakındayken kamera yaklaşır, diğer düşmanlar/kamplar durur, yalnız yılana odaklanılır */
        this.snakeFight = false;
        this.wrapNoteT = -9;
        // ---- kara delik: 3. adadan itibaren adada 20. saniyede belirir, ilk boss yenilince kaybolur ----
        this.hole = null;
        /** okçu 3 isabetle deliği dondurur: kalan süre (sn); dondurulmuş delik gri durur, yutmaz */
        this.holeFreeze = 0;
        this.holeHits = 0;
        this.holeHitT = 0;
        this.holeBossT = 0;
        this.archerCd = 0;
        /** yakındaki bulunmuş madene dokunuldu: maden oyunu açılır (oyun duraklar, bitince finishMine çağrılır) */
        this.onMine = () => { };
        /** kaşif ilk madeni buldu (hikâye sahnesi için) */
        this.onMineFound = () => { };
        // ---- iksir kazanı: yalnız kalan mini oyun. Karışım karakteri dev, cüce ya da dengeli yapar (5 dk) ----
        this.brewT = 0;
        this.brewKind = 'balanced';
        this.brewS = 0;
        /** iksir başlarken ekranda geçici süre yazan etkiler */
        this.brewInfoT = 0;
        this.brewInfoKind = 'balanced';
        this.brewInfoNote = '';
        /** başlıkta iksir mi mantar mı yazacağı */
        this.brewInfoMush = false;
        this.tremorT = 0;
        this.tremorNext = 25;
        // ---- kışkırtma yayı: boss yenilince rakip cadı 2-3 ada boyunca aynı tonda konuşur ----
        this.onProvoke = () => undefined;
        /** hikâye anlatımı (brew, giant, dwarf, rebirth, closing, curse): her biri bir kez gösterilir */
        this.onNarrate = () => undefined;
        /** usta cadının büyüsü: gücün (can ve hasar) 1 dakikalığına %60 düşer */
        this.curseT = 0;
        /** madende bulunan gizli iksir: kalan süre (sn); süresince can ve hasar ×10 (güç ×10) */
        this.potionT = 0;
        this.hintReg = -1;
        this.mineSpots = new Map();
        this.fogSets = new Map();
        this.fogFade = new Map();
        this.cloudSpr = null;
        /** kara delik küçüldü: kalan süre (sn) */
        this.holeShrinkT = 0;
        /** kara delik ineği öksürüp çıkardıktan sonra hareketsiz: kalan süre (sn) */
        this.holeStill = 0;
        /** deliğin içindeki yoldaş (inek, köylü, tavuk ya da kaplan): 1 sn sonra öksürülüp geri çıkarılır */
        this.holeCow = null;
        /** kara deliğin yolu üzerine dizilmiş zehirli mantarlar: delikle birlikte doğar, delik yok olunca onlar da yok olur */
        this.shrooms = [];
        this.shroomSeq = 0;
        /** deliğe yutulan mantarlar: içeri çekilip küçülerek kaybolur */
        this.shroomEat = [];
        this.sporeFx = [];
        this.mushBrew = false;
        this.pickMush = [];
        this.pickMushReg = -1;
        this.pickMushHint = 0;
        /** delik kimi yuttu: oyun, oyuncu kurtarma ya da baştan başlama seçene kadar durur */
        this.holeTrap = null;
        this.onHoleTrap = () => { };
        this.holeIsle = -1;
        this.holeIsleT = 0;
        this.holeGrace = 0;
        /** okçu seçili mi (sağ alttaki ok düğmesine dokunulunca seçilir; seçiliyken nişan alınır) */
        this.archerSel = false;
        /** nişan noktası (ekran koordinatı); parmak/fare basılıyken dolu */
        this.aim = null;
        this.focus = 0;
        // ---- yardımcı karakter: beyaz kaplan ----
        this.tgStuckT = 0;
        this.tg = null;
        this.novaT = 0;
        this.spellFinishT = 0;
        /** özel büyü: adadaki kampların %80'i temizlenir; boss, canavar ve zor boss ile dev yılanın gücü %80 düşer */
        /** özel büyüyle zayıflatılacak (henüz doğmamış) boss/canavar kamp kimlikleri */
        this.spellWeak = new Set();
        this.autoCrystalT = 0;
        /** son oto kristal turunun özeti (panelde gösterilir) */
        this.autoCrystalNote = '';
        // ---- bonus tur: 5'in katı adalara geçmeden önce 120 sn'de 400 zayıf düşman ----
        this.bonus = null;
        /** bonus düşmanları arası asgari mesafe: 400 düşman adaya sığana kadar 130'dan 70'e indirilir (sprite boyu ~70, üst üste binmez) */
        this.bonusGap = 130;
        // ---- arı sürüsü: 3-10 adada bir, 400-2000 arı (karakter gücünün %2-5'i), dalgalar halinde, birbirinin üstüne binmeden ----
        this.swarmCache = null;
        this.swarm = null;
        this.swarmIsleT = 0;
        this.swarmIsleReg = -1;
        this.beeGapNow = 56;
        this.beeDefCache = [];
        this.mirrorSynced = false;
        this.raidT = 0;
        this.raidIntroT = 0;
        this.raidSpawned = false;
        this.raidWarned = false;
        this.bonusIntroT = 0;
        this.bonusGap0 = 130;
        this.bonusTrack = new Map();
        this.campsOf = new Map();
        this.sealedNudgeT = 0;
        this.houseFlash = new Map();
        /** büyü kombosu: kısa sürede iki farklı hasar türü aynı düşmana vurursa +%30 */
        this.comboMark = new WeakMap();
        this.weightCache = new Map();
        // ---- kale / bina hedefleri: boss kadar canlı, zarar vermez, yıkılınca canın %2'sini verir ----
        this.bldHp = new Map();
        this.bldFlash = new Map();
        /** savaş mesajları (kombo, engel, alınan hasar…) savaş alanının üstünde değil, sağ kenardaki savaş günlüğünde gösterilir */
        this.feed = [];
        this.dealt = { sum: 0, hits: 0, crit: false, t: 0 };
        this.onMaster = () => { };
        this.ck = null;
        this.eggs = [];
        this.ckSpots = new Map();
        this.eggFx = [];
        this.eggCd = 5;
        this.trail = [];
        this.vqCow = null;
        this.vqVil = null;
        this.vqSpots = new Map();
        /** elmasın asaya takılma animasyonu: t sn; 2.2'de güç uygulanır, 3.4'te köylü ve inek uzaklaşır */
        this.gemAnim = null;
        this.vqLeave = 0;
        this.narrGap = 0;
        this.doom = null;
        this.ctx = canvas.getContext('2d');
        // sahne içi bütün yazılar seçili dile çevrilir
        const c2 = this.ctx;
        const ft = c2.fillText.bind(c2);
        const st = c2.strokeText.bind(c2);
        c2.fillText = (t, x, y, w) => ft(N(T(String(t))), x, y, w);
        c2.strokeText = (t, x, y, w) => st(N(T(String(t))), x, y, w);
        this.loadSprites();
        this.save = this.load();
        this.calibrateTest();
        this.px = this.save.x;
        this.py = this.save.y;
        this.hp = this.maxHp();
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }
    // ---- görseller ----
    loadSprites() {
        fetch('assets/manifest.json')
            .then((r) => (r.ok ? r.json() : []))
            .then((names) => {
            // çekirdek görseller hemen; adaya özel görseller ensureLoaded ile, kartlar panelde kendi <img> ile yüklenir
            for (const n of names)
                if (!BIOME_ART.test(n) && !n.startsWith('card_') && n !== 'logo_title')
                    this.loadSprite(n);
        })
            .catch(() => { });
    }
    loadSprite(n) {
        if (this.sprites.has(n) || this.loadingNames.has(n))
            return;
        this.loadingNames.add(n);
        this.pendingLoads++;
        const img = new Image();
        img.onload = () => { this.sprites.set(n, img); this.loadingNames.delete(n); this.pendingLoads--; };
        img.onerror = () => { this.loadingNames.delete(n); this.pendingLoads--; };
        img.src = 'assets/' + n + '.png';
    }
    /** 'ad' ya da 'ad@renk' (renk = ton döndürme derecesi; her çeşit ada farklı renkte görünür) */
    spr(name) {
        const at = name.indexOf('@');
        if (at < 0)
            return this.sprites.get(name) ?? null;
        const hit = this.tinted.get(name);
        if (hit)
            return hit;
        const base = this.sprites.get(name.slice(0, at));
        if (!base)
            return null;
        const cv = document.createElement('canvas');
        cv.width = base.width;
        cv.height = base.height;
        const cx = cv.getContext('2d');
        if (!cx)
            return base;
        cx.drawImage(base, 0, 0);
        const img = cx.getImageData(0, 0, cv.width, cv.height);
        const d = img.data;
        if (name.slice(at + 1) === 'mirror') {
            // ayna yansıması: soğuk camsı mavi-beyaz ton
            for (let i = 0; i < d.length; i += 4) {
                const l = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
                d[i] = Math.min(255, 0.55 * l + 30);
                d[i + 1] = Math.min(255, 0.95 * l + 55);
                d[i + 2] = Math.min(255, 1.05 * l + 90);
            }
            cx.putImageData(img, 0, 0);
            this.tinted.set(name, cv);
            return cv;
        }
        if (name.slice(at + 1) === 'gray') {
            // solmuş görünüm (tükenmiş maden): renk büyük oranda gider, hafif kararır; ctx.filter gerekmez
            for (let i = 0; i < d.length; i += 4) {
                const l = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
                d[i] = (0.85 * l + 0.15 * d[i]) * 0.88;
                d[i + 1] = (0.85 * l + 0.15 * d[i + 1]) * 0.88;
                d[i + 2] = (0.85 * l + 0.15 * d[i + 2]) * 0.88;
            }
            cx.putImageData(img, 0, 0);
            this.tinted.set(name, cv);
            return cv;
        }
        const a = (Number(name.slice(at + 1)) * Math.PI) / 180;
        const cs = Math.cos(a);
        const sn = Math.sin(a);
        // YIQ benzeri ton döndürme matrisi (tarayıcıdan bağımsız, ctx.filter gerekmez)
        const m = [
            0.213 + cs * 0.787 - sn * 0.213, 0.715 - cs * 0.715 - sn * 0.715, 0.072 - cs * 0.072 + sn * 0.928,
            0.213 - cs * 0.213 + sn * 0.143, 0.715 + cs * 0.285 + sn * 0.140, 0.072 - cs * 0.072 - sn * 0.283,
            0.213 - cs * 0.213 - sn * 0.787, 0.715 - cs * 0.715 + sn * 0.715, 0.072 + cs * 0.928 + sn * 0.072,
        ];
        for (let i = 0; i < d.length; i += 4) {
            const r = d[i];
            const g = d[i + 1];
            const b = d[i + 2];
            d[i] = Math.max(0, Math.min(255, r * m[0] + g * m[1] + b * m[2]));
            d[i + 1] = Math.max(0, Math.min(255, r * m[3] + g * m[4] + b * m[5]));
            d[i + 2] = Math.max(0, Math.min(255, r * m[6] + g * m[7] + b * m[8]));
        }
        cx.putImageData(img, 0, 0);
        this.tinted.set(name, cv);
        return cv;
    }
    drawSpr(name, x, y, size, rot = 0) {
        const img = this.spr(name);
        if (!img)
            return false;
        const c = this.ctx;
        c.save();
        c.translate(x, y);
        if (rot)
            c.rotate(rot);
        c.drawImage(img, -size / 2, -size / 2, size, size);
        c.restore();
        return true;
    }
    calibrateTest() {
        if (!TEST_LEVEL)
            return;
        const z = ZONES[TEST_LEVEL - 1];
        const target = (ENEMIES.mushroom.hp * TIERS.easy.hp * z.scale * 3) / 100;
        // güç adanın eğrisinde kalsın (44. seviyede ~180Q): en yüksek ekipmanın ve güç paketlerinin can katkısı elit canından düşülür
        const sv = this.save;
        const full = this.maxHp();
        const gear = { items: sv.items, eq: sv.eq, extra: sv.extra, crystals: sv.crystals, equipped: sv.equipped };
        sv.items = [];
        sv.eq = { helmet: 0, shield: 0 };
        sv.extra = [];
        sv.crystals = [];
        sv.equipped = [];
        const bare = this.maxHp() / this.shopMul();
        Object.assign(sv, gear);
        if (full > bare && bare > 0)
            sv.perm['elite.hp'] = Math.max(0, (100 + (sv.perm['elite.hp'] ?? 0)) * (bare / full) - 100);
        this.testDmgF = 1;
        this.save.perm['elite.dmg'] = 0;
        let s0 = 0;
        let s1 = 0;
        for (const i of this.equippedWeapons()) {
            const k = (this.weaponCopies(i) * this.castSpeed()) / WEAPONS[i].cooldown;
            s0 += WEAPONS[i].baseDmg * (1 + 0.15 * (this.save.weapons[i] - 1)) * k;
            s1 += k;
        }
        const need = target / this.dmgMul();
        if (need >= s0)
            this.save.perm['elite.dmg'] = (need - s0) / s1;
        else
            this.testDmgF = need / s0;
        // güç hedefi: seviyeden bağımsız olarak o adanın boss gücünün 1840 katı (44. seviyede ≈180Q); can ve hasar birlikte ölçeklenir
        const goal = 1840 * this.bossPower(TEST_LEVEL - 1);
        for (let it = 0; it < 6 && TEST_LEVEL >= 40; it++) { // 40. seviyeden önce eski kamp süresi kalibrasyonu geçerli
            const P = this.fullPower();
            if (!(P > 0) || !isFinite(P))
                break;
            const r = goal / P;
            if (Math.abs(r - 1) < 0.01)
                break;
            this.save.perm['elite.hp'] = Math.max(0, (100 + (this.save.perm['elite.hp'] ?? 0)) * r - 100);
            if ((this.save.perm['elite.dmg'] ?? 0) > 0)
                this.save.perm['elite.dmg'] = (this.save.perm['elite.dmg'] ?? 0) * r;
            else
                this.testDmgF *= r;
        }
        this.hp = this.maxHp();
    }
    fresh() {
        const s = this.freshBase();
        return TEST_LEVEL ? this.testSave(s, TEST_LEVEL) : s;
    }
    /** test kaydı: N. adadan başlar; önceki adaların bossları yenik, her yuva 1. seviye eşyayla dolu, can ve hasar adanın ölçeğine göre ayarlı */
    testSave(s, level) {
        const idx = level - 1;
        const bd = idx;
        s.bossDown = ZONES.map((_, i) => i < idx);
        for (const p of LEVEL_PACKS)
            s.lvPacks[p.id] = 1;
        s.tut = TUTORIAL.length;
        s.kills = 25;
        s.geodes = 20;
        s.dust = 5000;
        s.weapons = [MAX_WEAPON_LEVEL, MAX_WEAPON_LEVEL, MAX_WEAPON_LEVEL, MAX_WEAPON_LEVEL]; // test: bütün ekipman en yüksek seviyede takılı
        s.shop['hexling.power.xl'] = 2; // test: x5 güç paketinden iki tane alınmış gibi
        const wslots = Math.min(4, 1 + bd + 1);
        s.loadout = [0, 1, 2, 3].slice(0, wslots);
        const dts = ['cut', 'pierce', 'smash'];
        let id = 1;
        const mk = (type) => ({ id: id++, type, rarity: 4, level: MAX_ITEM_LEVEL, dtype: dts[(id - 1) % 3] });
        const h = mk('helmet');
        const sh = mk('shield');
        s.items = [h, sh];
        s.eq = { helmet: h.id, shield: sh.id };
        for (let k = 0; k < Math.floor(bd / 10); k++) {
            const it = mk(k % 2 ? 'shield' : 'helmet');
            s.items.push(it);
            s.extra.push(it.id);
        }
        s.nextItem = id;
        const nslots = Math.min(4, 2 + bd) + Math.floor(bd / 10);
        const stats = ['hp', 'dmg', 'regen', 'speed', 'crit', 'lifesteal', 'yield', 'magnet', 'evasion'];
        s.crystals = [];
        s.equipped = [];
        for (let k = 0; k < nslots; k++) {
            s.crystals.push({ id: k + 1, rarity: 0, stat: stats[k % stats.length], enchant: MAX_ENCHANT });
            s.equipped.push(k + 1);
        }
        s.nextCrystal = nslots + 1;
        const t = s.tiger;
        t.asked = true;
        t.paid = ZONES.map((_, i) => i);
        t.items = TIGER_SLOT_LIST.map((type, k) => ({ id: k + 1, type, rarity: 4, level: MAX_TIGER_ITEM_LEVEL }));
        t.eq = { helm: 1, fang: 2, claw: 3 };
        t.nextItem = 4;
        // güç: adanın ölçeğine göre (düşman canı ∝ scale, hasarı ∝ dmgScale)
        const z = ZONES[idx];
        s.perm['elite.hp'] = 100 * z.dmgScale * 2;
        s.perm['elite.dmg'] = 0; // gerçek değer calibrateTest() ile kamp süresine göre hesaplanır
        const rp = this.restPoints()[idx];
        s.x = rp.x;
        s.y = rp.y + 70;
        if (TEST_MINE) {
            s.mines = [idx];
            s.first['mineIn'] = 1;
        } // ?mine=1: bu adanın madeni keşfedilmiş, girişi başlangıcın yanında
        return s;
    }
    freshBase() {
        return {
            essence: 0, upgrades: {}, weapons: [1, 0, 0, 0], copies: [0, 0, 0, 0], loadout: [0], x: HOME.x, y: HOME.y + 70,
            bossDown: ZONES.map(() => false), hero: { id: 'h' + Date.now().toString(36), name: 'Çırak', born: Date.now() }, playSec: 0, shop: {}, lvPacks: {}, rivalDown: 0, house: { ...freshHouse(), soupAt: Date.now() }, outfit: 0, outfits: [0], arena: {}, weekWon: -1, storyRead: 0, tut: 0, daily: makeDaily(Date.now()), col: 0, tiger: freshTiger(), ads: { day: 0, n: 0, last: {} }, first: {}, gw: {}, kills: 0, deaths: 0, geodes: 1, dust: 20, crystals: [], equipped: [], nextCrystal: 1,
            chests: [], seen: {}, train: {}, chestBonus: {}, items: [], eq: { helmet: 0, shield: 0 }, extra: [], nextItem: 1, spawn: {}, perm: {}, archer: 0, fog: {}, explorer: { at: 0, target: -1 }, mines: [], mineAt: {}, mineLv: {}, mineIdleAt: {},
        };
    }
    load() {
        if (TEST_LEVEL)
            return this.fresh();
        try {
            const raw = localStorage.getItem(SAVE_KEY);
            if (raw) {
                const s = { ...this.fresh(), ...JSON.parse(raw) };
                while (s.bossDown.length < ZONES.length)
                    s.bossDown.push(false);
                if (!Array.isArray(s.extra))
                    s.extra = [];
                if (!s.shop)
                    s.shop = {};
                if (!s.lvPacks)
                    s.lvPacks = {};
                s.house = { ...freshHouse(), ...(s.house ?? {}) };
                if (!s.house.soupAt)
                    s.house.soupAt = Date.now();
                if (!Array.isArray(s.outfits))
                    s.outfits = [0];
                if (!s.arena)
                    s.arena = {};
                s.tiger = { ...freshTiger(), ...(s.tiger ?? {}) };
                s.tiger.eq = { ...freshTiger().eq, ...(s.tiger.eq ?? {}) };
                if (!Array.isArray(s.tiger.items))
                    s.tiger.items = [];
                if (!Array.isArray(s.tiger.paid))
                    s.tiger.paid = [];
                Game.mergeDuplicates(s);
                Game.mergeCrystals(s);
                if (!s.daily || !Array.isArray(s.daily.goals))
                    s.daily = makeDaily(Date.now());
                else
                    extendDaily(s.daily);
                if (!s.ads)
                    s.ads = { day: 0, n: 0, last: {} };
                return s;
            }
        }
        catch (e) {
            console.error('kayıt okunamadı', e);
        }
        return this.fresh();
    }
    /** kayıtlı bir oyun var mı (açılış sayfası "Devam et" için) */
    static hasSave() {
        try {
            return !!localStorage.getItem(SAVE_KEY);
        }
        catch (e) {
            console.error('kayıt okunamadı', e);
            return false;
        }
    }
    /** kayıt özeti (açılış sayfası için) */
    static peekSave() {
        try {
            const raw = localStorage.getItem(SAVE_KEY);
            if (!raw)
                return null;
            const s = JSON.parse(raw);
            return { name: s.hero?.name ?? 'Çırak', islands: (s.bossDown ?? []).filter(Boolean).length, kills: s.kills ?? 0 };
        }
        catch (e) {
            console.error('kayıt okunamadı', e);
            return null;
        }
    }
    // ---- Şeref Salonu (bu cihazdaki kahramanlar) ----
    static loadHof() {
        try {
            return JSON.parse(localStorage.getItem(HOF_KEY) ?? '[]');
        }
        catch (e) {
            console.error('şeref salonu okunamadı', e);
            return [];
        }
    }
    /** sıralama: önce aşılan ada, sonra güç, sonra öldürme */
    static hofRanking() {
        // sunucudaki kalıcı liste + bu cihazın yerel listesi, kahraman kimliğine göre birleştirilir (aynı kimlikte en yüksek değerler)
        const byId = new Map();
        for (const e of [...Game.remoteHof, ...Game.loadHof()]) {
            const o = byId.get(e.id);
            if (!o) {
                byId.set(e.id, e);
                continue;
            }
            byId.set(e.id, { ...(e.updated >= o.updated ? e : o), islands: Math.max(e.islands, o.islands), power: Math.max(e.power, o.power), kills: Math.max(e.kills, o.kills), deaths: Math.max(e.deaths, o.deaths), maxHp: Math.max(e.maxHp, o.maxHp) });
        }
        return [...byId.values()].sort((a, b) => b.islands - a.islands || b.power - a.power || b.kills - a.kills).slice(0, 50);
    }
    /** sunucudaki listeyi (en çok 20 sn'de bir) yeniler; yenilenince done çağrılır */
    static refreshHof(done) {
        const now = Date.now();
        if (now - Game.hofFetchedAt < 20000)
            return;
        Game.hofFetchedAt = now;
        void fetchRemoteHof().then((list) => { if (list) {
            Game.remoteHof = list;
            done();
        } });
        if (!TEST_LEVEL)
            void pushOldHeroes(Game.loadHof());
    }
    updateHof() {
        if (this.save.kills === 0 && this.bossesDown() === 0)
            return; // hiç oynamayan kayıt listeye girmez
        const list = Game.loadHof();
        const e = {
            id: this.save.hero.id, name: this.save.hero.name, power: Math.max(this.fullPower(), list.find((x) => x.id === this.save.hero.id)?.power ?? 0),
            islands: Math.max(this.bossesDown(), this.save.rebirth?.floor ?? 0, list.find((x) => x.id === this.save.hero.id)?.islands ?? 0), kills: this.save.kills, deaths: this.save.deaths, maxHp: this.maxHp(), born: this.save.hero.born,
            updated: Date.now(), version: VERSION,
        };
        const at = list.findIndex((x) => x.id === e.id);
        if (at >= 0)
            list[at] = e;
        else
            list.push(e);
        try {
            localStorage.setItem(HOF_KEY, JSON.stringify(list.slice(-60)));
        }
        catch (err) {
            console.error('şeref salonu yazılamadı', err);
        }
        if (!TEST_LEVEL)
            pushHof(e); // test modu kahramanları kalıcı listeye girmez
    }
    persist() {
        try {
            this.save.x = this.px;
            this.save.y = this.py;
            localStorage.setItem(SAVE_KEY, JSON.stringify(this.save));
            this.updateHof();
        }
        catch (e) {
            console.error('kayıt yazılamadı', e);
        }
    }
    /** yeni oyun: eski kahraman Şeref Salonu'nda kalır */
    newGame(name) {
        this.persist();
        this.resetSave();
        this.save.hero.name = name.trim().slice(0, 16) || 'Çırak';
        this.persist();
    }
    setHeroName(name) { this.save.hero.name = name.trim().slice(0, 16) || 'Çırak'; this.persist(); }
    resetSave() {
        localStorage.removeItem(SAVE_KEY);
        this.save = this.fresh();
        this.fogSets.clear();
        this.fogFade.clear();
        this.calibrateTest();
        this.tg = null;
        this.enemies = [];
        this.projs = [];
        this.orbs = [];
        this.treeHp.clear();
        this.cast.clear();
        this.gains = [];
        this.deathFx = [];
        this.px = this.save.x;
        this.py = this.save.y;
        this.region = this.regionAt(this.px, this.py);
        this.ensureLoaded(this.region);
        this.hp = this.maxHp();
        this.onChange();
    }
    resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.w = window.innerWidth;
        this.h = window.innerHeight;
        this.canvas.width = Math.floor(this.w * dpr);
        this.canvas.height = Math.floor(this.h * dpr);
        this.canvas.style.width = this.w + 'px';
        this.canvas.style.height = this.h + 'px';
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    now() { return this.nowMs + this.skew; }
    /** ganimet/kazanç yazısı: efektli, sıraya girerek oyuncunun üstünde belirir */
    gain(text, color = '#ffe36b', icon = '', merge) {
        text = N(T(text));
        audio.play('gain');
        if (merge) {
            // aynı türden kısa aralıklı kazançlar tek satırda toplanır (+7, +7, +7 → +21)
            const same = this.gains.find((g) => g.key === merge.key && g.t > 1.0);
            if (same) {
                same.amount = (same.amount ?? 0) + merge.amount;
                same.text = N(T(merge.fmt(same.amount)));
                same.t = 1.9;
                return;
            }
        }
        const pending = this.gains.filter((g) => g.delay > 0).length;
        if (this.gains.length > 10)
            this.gains.shift();
        this.gains.push({ text, color, icon, t: 1.9, delay: pending * 0.14, key: merge?.key, amount: merge?.amount, fmt: merge?.fmt });
    }
    // ---- dünya: bölgeler, köprüler, kapılar ----
    regionCenter(r) {
        const z = ZONES[r];
        return { x: z.cx, y: z.cy, r: z.radius };
    }
    /** köprü i, bölge i ile i+1 arasını bağlar */
    bridge(i) {
        const a = this.regionCenter(i);
        const b = this.regionCenter(i + 1);
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        return { ax: a.x, ay: a.y, bx: b.x, by: b.y, len, tGate: (a.r + GATE_GAP) / len, tExit: (len - b.r - GATE_GAP) / len };
    }
    /** köprü i'nin bekçi bossları (kimlikleri genZone ile aynı formülden): 2–3 tane */
    bridgeGuardIds(i) {
        const b = this.bridge(i);
        const s0 = ZONES[i].radius + 260;
        const s1 = b.len - ZONES[i + 1].radius - 260;
        const n = s1 - s0 < 2200 ? 2 : 3;
        return Array.from({ length: n }, (_, k) => 100000 + i * 3 + k);
    }
    /** köprü bekçileri yenildi mi: köprünün çıkış kapısı ancak o zaman açılır (daha önce geçmiş oyuncular için karşı ada bossu yenilmişse de açık sayılır) */
    bridgeOpen(i) {
        if (i >= ZONES.length - 1)
            return true;
        if (this.save.first['bx' + i] || this.save.bossDown[i + 1])
            return true;
        return this.bridgeGuardIds(i).every((id) => this.isCleared('s' + id));
    }
    /** kalan bekçi sayısı */
    bridgeGuardsLeft(i) { return this.bridgeGuardIds(i).filter((id) => !this.isCleared('s' + id)).length; }
    /** dinlenme noktaları: ada 0'da ev, diğer adalarda giriş kampı (hızlı iyileşme, güvenli bölge, ölünce burada uyanılır) */
    restPoints() {
        if (this.rests)
            return this.rests;
        this.rests = ZONES.map((z, i) => {
            if (i === 0)
                return { x: HOME.x, y: HOME.y, r: HOME.r, reg: 0 };
            const b = this.bridge(i - 1);
            const t = (b.len - z.radius + 300) / b.len;
            return { x: b.ax + (b.bx - b.ax) * t, y: b.ay + (b.by - b.ay) * t, r: HOME.r, reg: i };
        });
        return this.rests;
    }
    restAt() {
        for (const p of this.restPoints())
            if (Math.hypot(this.px - p.x, this.py - p.y) < p.r)
                return p;
        return null;
    }
    inHome() { return this.restAt() !== null; }
    /** erişilebilir son ada sayısı: 40 ücretsiz + satın alınan devam paketleri (en fazla ZONES.length = 250) */
    levelCap() {
        let n = BASE_ISLANDS;
        for (const p of LEVEL_PACKS)
            if (this.save.lvPacks[p.id])
                n += p.levels;
        return Math.min(ZONES.length, n);
    }
    /** boss yenildi ama sonraki ada henüz satın alınmamış */
    paywalled(i) { return i < ZONES.length - 1 && !!this.save.bossDown[i] && i + 1 >= this.levelCap(); }
    gateLocked(i) { return !this.save.bossDown[i] || i + 1 >= this.levelCap(); }
    gatePos(i) {
        const b = this.bridge(i);
        return { x: b.ax + (b.bx - b.ax) * b.tGate, y: b.ay + (b.by - b.ay) * b.tGate };
    }
    /** (x,y) yürünebilir mi (kilitli kapının ötesi hariç) */
    /** kaya/bina engeli mi (oyuncu ve düşmanlar üzerinden geçemez) */
    blocked(x, y, pad = 12) {
        if (!this.world || this.bonus)
            return false; // bonus turunda ada boştur: kaya/bina yok
        for (const o of this.world.obstacles)
            if (Math.hypot(o.x - x, o.y - y) < o.r + pad && !this.bldDown(o))
                return true;
        return false;
    }
    /** 101. adadan sonra ücretsiz güç boss gücünün gerisinde kalır: bir adaya ilk girişte ekipman yetmiyorsa güç paketleri hatırlatılır */
    softCapHint() {
        const r = this.region;
        if (r < SOFT_CAP_FROM || this.save.first['hint' + r])
            return;
        if (this.fullPower() < this.bossPower(r) * 0.8) {
            this.save.first['hint' + r] = 1;
            this.say('Ekipmanların bu adaya yetmiyor: Güç paketleri güçlenmeni sağlar (mağaza)');
        }
    }
    /** çevredeki 10 ada: büyük harita, çizim ve fizik döngüleri yalnızca bunlara bakar (250 adalık dünyada hız için) */
    winRange() {
        const n = ZONES.length;
        const a = Math.max(0, Math.min(n - 10, Math.max(this.region - 1, this.floorReg())));
        return [a, Math.min(n - 1, a + 9)];
    }
    /** geri dönüş sınırı: ulaşılan en yüksek adanın yalnızca bir önceki adasına dönülebilir; ötesi silinir */
    floorReg() { return Math.max(0, (this.save.topReg ?? this.region) - 1); }
    tickFloor() {
        if ((this.save.topReg ?? -1) < this.region)
            this.save.topReg = this.region;
        const f = this.floorReg();
        if (f !== this.floorSeen) {
            this.floorSeen = f;
            if (this.save.mapSeen)
                for (const k of Object.keys(this.save.mapSeen))
                    if (Number(k) < f)
                        delete this.save.mapSeen[Number(k)];
            for (const k of [...this.zoneCache.keys()])
                if (k < f) {
                    this.zoneCache.delete(k);
                    this.campsOf.delete(k);
                }
        }
        if (this.region < f) {
            const rp = this.restPoints()[f];
            if (rp) {
                this.px = rp.x;
                this.py = rp.y;
                this.save.x = rp.x;
                this.save.y = rp.y;
                this.region = this.regionAt(this.px, this.py);
                this.ensureLoaded(this.region);
                this.say('Geri dönüş yalnızca bir önceki adayla sınırlı');
            }
        }
    }
    /** ignoreObstacles: kaya/bina engelleri yok sayılır (yalnız kara ve köprü şartı kalır; kaplan engellere takılmasın diye) */
    walkable(x, y, ignoreGates = false, ignoreObstacles = false) {
        if (!ignoreObstacles && this.blocked(x, y))
            return false;
        const [w0, w1] = this.winRange();
        for (let i = w0; i <= w1; i++) {
            const c = this.regionCenter(i);
            if (Math.hypot(x - c.x, y - c.y) <= c.r - 18)
                return true;
        }
        for (let i = w0; i <= w1 && i < ZONES.length - 1; i++) {
            const b = this.bridge(i);
            const dx = b.bx - b.ax;
            const dy = b.by - b.ay;
            const t = ((x - b.ax) * dx + (y - b.ay) * dy) / (b.len * b.len);
            if (t < 0 || t > 1)
                continue;
            const d = Math.hypot(x - (b.ax + dx * t), y - (b.ay + dy * t));
            if (d > BRIDGE_HALF_WIDTH)
                continue;
            if (!ignoreGates && this.gateLocked(i) && t > b.tGate)
                continue;
            if (!ignoreGates && t > b.tExit && !this.bridgeOpen(i))
                continue; // köprü bekçileri yenilmeden çıkış kapısından geçilmez
            return true;
        }
        return false;
    }
    regionAt(x, y) {
        let best = 0;
        let bd = Infinity;
        const scan = (a, b) => {
            for (let i = a; i <= b; i++) {
                const c = this.regionCenter(i);
                const d = Math.hypot(x - c.x, y - c.y) / c.r;
                if (d < bd) {
                    bd = d;
                    best = i;
                }
            }
        };
        const [w0, w1] = this.winRange();
        scan(w0, w1);
        if (bd > 1.4) {
            bd = Infinity;
            scan(0, ZONES.length - 1);
        } // ışınlanma gibi pencere dışı konumlarda tam tarama
        return best;
    }
    /** adadaki kamp sayısı toplamı: kamp kimlikleri ada sırasına göre sabittir (kayıtla uyumlu) */
    spawnOffset(reg) {
        let n = 0;
        for (let i = 0; i < reg; i++)
            n += Object.values(ZONES[i].layout).reduce((a, b) => a + b, 0);
        return n;
    }
    /** bir adanın dünyasını üretir: kamplar, ağaçlar, sandıklar, engeller (kaya/bina) ve köprü bossları. Kimlikler adadan bağımsızdır. */
    genZone(reg) {
        const zone = ZONES[reg];
        const spawners = [];
        const trees = [];
        const chests = [];
        const lvRange = {
            easy: [0.35, 1.8], medium: [0.5, 3.5], hard: [0.8, 6], elite: [1.2, 9], knight: [1.2, 5], boss: [3, 6],
        };
        const base = this.spawnOffset(reg);
        const R = zone.radius;
        const rnd = rng(reg * 7919 + 13);
        const placed = [];
        const rest = this.restPoints()[reg];
        const clearOfHome = (p) => Math.hypot(p.x - rest.x, p.y - rest.y) > 330;
        const place = (minD, maxD, sep) => {
            for (let tries = 0; tries < 60; tries++) {
                const a = rnd() * Math.PI * 2;
                const d = minD + rnd() * (maxD - minD);
                const p = { x: zone.cx + Math.cos(a) * d, y: zone.cy + Math.sin(a) * d };
                if (clearOfHome(p) && placed.every((q) => Math.hypot(q.x - p.x, q.y - p.y) > sep)) {
                    placed.push(p);
                    return p;
                }
            }
            const a = rnd() * Math.PI * 2;
            const p = { x: zone.cx + Math.cos(a) * maxD, y: zone.cy + Math.sin(a) * maxD };
            placed.push(p);
            return p;
        };
        const band = {
            easy: [240, R * 0.5], medium: [R * 0.3, R * 0.65], hard: [R * 0.5, R * 0.78],
            elite: [R * 0.55, R - 160], knight: [R * 0.4, R - 140], boss: [R * 0.7, R * 0.8],
        };
        Object.keys(zone.layout).forEach((tier) => {
            const count = reg < 2 && tier !== 'boss' ? Math.max(1, Math.round(zone.layout[tier] * 0.8)) : zone.layout[tier]; // ilk iki adada düşman %20 az
            for (let i = 0; i < count; i++) {
                const p = place(band[tier][0], band[tier][1], 190);
                const kind = zone.enemies[Math.floor(rnd() * zone.enemies.length)];
                const [lo, hi] = lvRange[tier];
                spawners.push({
                    id: base + spawners.length, reg, x: p.x, y: p.y, tier, kind, lv: lo * Math.pow(hi / lo, rnd()),
                    tag: tier === 'knight' ? (i % 2 === 0 ? 'helmet' : 'shield') : undefined,
                });
            }
        });
        for (let i = 0; i < zone.resTrees; i++) {
            const p = place(160, R - 100, 120);
            trees.push({ id: reg * 1000 + trees.length, reg, x: p.x, y: p.y, s: 1.4, big: true });
        }
        for (let i = 0; i < 6; i++) {
            const p = place(200, R - 80, 160);
            chests.push({ id: reg * 6 + chests.length, reg, x: p.x, y: p.y, mode: i < 2 ? 'visible' : i < 4 ? 'hidden' : 'drop' });
        }
        // 'drop' sandıkları güçlü bir kampın yerine konur; o kamp ilk kez temizlenince ortaya çıkar
        const guards = spawners.filter((s) => s.tier === 'hard' || s.tier === 'elite' || s.tier === 'knight');
        chests.filter((ch) => ch.mode === 'drop').forEach((ch, k) => {
            const g = guards[(k * 2 + reg) % Math.max(1, guards.length)];
            if (g) {
                ch.x = g.x + 40;
                ch.y = g.y + 30;
                ch.src = g.id;
            }
            else
                ch.mode = 'visible';
        });
        // diğer bütün ağaçlar da kesilebilir (küçük ödül)
        for (let i = 0; i < 80 + Math.min(reg, 10) * 6; i++) {
            const a = rnd() * Math.PI * 2;
            const d = 60 + rnd() * (R - 100);
            const p = { x: zone.cx + Math.cos(a) * d, y: zone.cy + Math.sin(a) * d };
            if (!clearOfHome(p))
                continue;
            trees.push({ id: reg * 1000 + trees.length, reg, x: p.x, y: p.y, s: 0.7 + rnd() * 0.7, big: false });
        }
        // köprü bossları: bu adanın boss'u gibi, köprüde 2–3 tane (bir kez yenilir)
        if (reg < ZONES.length - 1) {
            const b = this.bridge(reg);
            const ux = (b.bx - b.ax) / b.len;
            const uy = (b.by - b.ay) / b.len;
            const s0 = zone.radius + 260;
            const s1 = b.len - ZONES[reg + 1].radius - 260;
            const n = s1 - s0 < 2200 ? 2 : 3;
            for (let k = 0; k < n; k++) {
                const sd = s0 + ((s1 - s0) * (k + 1)) / (n + 1);
                spawners.push({
                    id: 100000 + reg * 3 + k, reg, x: b.ax + ux * sd, y: b.ay + uy * sd, tier: 'boss', kind: zone.enemies[k % zone.enemies.length],
                    lv: 3 + k * 0.4, bridge: reg,
                });
            }
        }
        // engeller: kayalar ve binalar (üzerinden geçilemez, etrafından dolaşılır)
        const orng = rng(reg * 104729 + 7);
        const obstacles = [];
        const segs = [];
        if (reg > 0)
            segs.push({ ax: zone.cx, ay: zone.cy, bx: ZONES[reg - 1].cx, by: ZONES[reg - 1].cy });
        if (reg < ZONES.length - 1)
            segs.push({ ax: zone.cx, ay: zone.cy, bx: ZONES[reg + 1].cx, by: ZONES[reg + 1].cy });
        const nearSeg = (x, y, w) => segs.some((sg) => {
            const dx = sg.bx - sg.ax;
            const dy = sg.by - sg.ay;
            const t = Math.max(0, Math.min(1, ((x - sg.ax) * dx + (y - sg.ay) * dy) / (dx * dx + dy * dy)));
            return Math.hypot(x - (sg.ax + dx * t), y - (sg.ay + dy * t)) < w;
        });
        const nRocks = 16 + Math.floor(reg / 6);
        const nBld = 4 + Math.floor(reg / 10);
        for (let k = 0; k < nRocks + nBld; k++) {
            const bld = k >= nRocks;
            const r = bld ? 58 : 30 + orng() * 14;
            for (let tries = 0; tries < 80; tries++) {
                const a = orng() * Math.PI * 2;
                const d = 120 + orng() * (R - 260);
                const x = zone.cx + Math.cos(a) * d;
                const y = zone.cy + Math.sin(a) * d;
                if (Math.hypot(x - rest.x, y - rest.y) < 380)
                    continue;
                if (nearSeg(x, y, 210))
                    continue;
                if (spawners.some((s) => Math.hypot(s.x - x, s.y - y) < (s.tier === 'boss' ? 300 : 230)))
                    continue;
                if (chests.some((c) => Math.hypot(c.x - x, c.y - y) < 110))
                    continue;
                if (trees.some((t) => t.big && Math.hypot(t.x - x, t.y - y) < 100))
                    continue;
                if (obstacles.some((o) => Math.hypot(o.x - x, o.y - y) < o.r + r + 70))
                    continue;
                obstacles.push({
                    id: reg * 100 + obstacles.length, div: bld ? (k - nRocks) % 5 === 0 ? 1 : 2 + ((k - nRocks) % 4) : 1, x, y, r, kind: bld ? 'bld' : 'rock', art: bld ? zone.art.bld[k % 3] : zone.art.rock, size: bld ? 170 : r * 3.6, flip: orng() < 0.5 ? 1 : -1, brk: !bld && (reg >= 39 || k % 3 === 0),
                });
                break;
            }
        }
        // en uygun nokta: kamplardan, sandıklardan, engellerden ve köprü yollarından uzak; uygun nokta yoksa en az kötü olan
        const spot = (brng) => {
            let best = { x: zone.cx + R * 0.35, y: zone.cy, score: -1e9 };
            for (let tries = 0; tries < 400; tries++) {
                const a = brng() * Math.PI * 2;
                const d = R * (0.15 + brng() * 0.6);
                const x = zone.cx + Math.cos(a) * d;
                const y = zone.cy + Math.sin(a) * d;
                let score = Math.min(...spawners.map((s) => Math.hypot(s.x - x, s.y - y) - 320));
                score = Math.min(score, Math.hypot(x - rest.x, y - rest.y) - 400, ...chests.map((c) => Math.hypot(c.x - x, c.y - y) - 120), ...obstacles.map((o) => Math.hypot(o.x - x, o.y - y) - o.r - 140));
                if (nearSeg(x, y, 230))
                    score = Math.min(score, -1);
                if (score > best.score)
                    best = { x, y, score };
                if (score >= 0)
                    break;
            }
            return best;
        };
        const bossSp = spawners.find((s) => s.tier === 'boss' && s.bridge === undefined);
        // canavar: her 3 adada bir (3., 6., 9. …), boss'un 2 katı güçte; boss yenilmeden de çıkar
        if ((reg + 1) % 3 === 0) {
            const b = spot(rng(reg * 15485863 + 11));
            spawners.push({ id: 200000 + reg, reg, x: b.x, y: b.y, tier: 'boss', kind: bossSp ? bossSp.kind : zone.enemies[0], lv: bossSp ? bossSp.lv : 4, bridge: reg, beast: true });
        }
        // zor boss: ada bossu yenildikten sonra belirir (günde bir kez), 3 kat güçlü, büyük ganimet
        if (bossSp) {
            const h = spot(rng(reg * 32452843 + 5));
            spawners.push({ id: 400000 + reg, reg, x: h.x, y: h.y, tier: 'boss', kind: bossSp.kind, lv: bossSp.lv, bridge: reg, hard: true });
        }
        // yoğun adalar: 10. adadan sonra ek kamplar (ayrı kimlik bloğu: eski kayıtlar bozulmaz). Kamplar sıklaşır; bir düşmanla savaşırken
        // komşu kampın bölgesine girilip birden çok kamp aynı anda tetiklenebilir
        if (reg >= DENSE_FROM) {
            const xr = rng(reg * 5081 + 3);
            const k0 = reg - DENSE_FROM;
            const extra = [['easy', 3 + Math.floor(k0 / 6)], ['medium', 2 + Math.floor(k0 / 8)], ['hard', 1 + Math.floor(k0 / 10)]];
            let k = 0;
            for (const [tier, n] of extra) {
                for (let i = 0; i < n; i++) {
                    let p = null;
                    for (let tries = 0; tries < 80 && !p; tries++) {
                        const a = xr() * Math.PI * 2;
                        const d = R * 0.2 + xr() * (R - 180 - R * 0.2);
                        const c = { x: zone.cx + Math.cos(a) * d, y: zone.cy + Math.sin(a) * d };
                        if (!clearOfHome(c) || nearSeg(c.x, c.y, 200))
                            continue;
                        if (spawners.some((s) => Math.hypot(s.x - c.x, s.y - c.y) < (s.tier === 'boss' ? 300 : 150)))
                            continue;
                        if (obstacles.some((o) => Math.hypot(o.x - c.x, o.y - c.y) < o.r + 70))
                            continue;
                        if (chests.some((ch) => Math.hypot(ch.x - c.x, ch.y - c.y) < 110))
                            continue;
                        p = c;
                    }
                    if (!p)
                        continue;
                    const [lo, hi] = lvRange[tier];
                    spawners.push({ id: 500000 + reg * 40 + k++, reg, x: p.x, y: p.y, tier, kind: zone.enemies[Math.floor(xr() * zone.enemies.length)], lv: lo * Math.pow(hi / lo, xr()) });
                }
            }
        }
        return { spawners, trees, chests, obstacles };
    }
    /** bir adanın dünyası (yüklü değilse geçici üretilir, saklanmaz) */
    zoneWorld(reg) { return this.zoneCache.get(reg) ?? this.genZone(reg); }
    /** merkez adayla birlikte önceki ve sonraki adayı yükler, diğerlerini boşaltır */
    ensureLoaded(center) {
        const lo = Math.max(0, Math.min(center, this.floorReg()));
        const want = [center - 1, center, center + 1].filter((r) => r >= lo && r < ZONES.length);
        if (want.length === this.loaded.length && want.every((r, i) => r === this.loaded[i]))
            return;
        const first = this.loaded.length === 0;
        for (const r of want)
            if (!this.zoneCache.has(r))
                this.zoneCache.set(r, this.genZone(r));
        for (const r of [...this.zoneCache.keys()]) {
            if (!want.includes(r)) {
                this.zoneCache.delete(r);
                this.campsOf.delete(r);
            }
        }
        this.loaded = want;
        this.enemies = this.enemies.filter((e) => want.includes(e.reg));
        this.projs = [];
        const spawners = [];
        const trees = [];
        const chests = [];
        const obstacles = [];
        for (const r of want) {
            const z = this.zoneCache.get(r);
            spawners.push(...z.spawners);
            trees.push(...z.trees);
            chests.push(...z.chests);
            obstacles.push(...z.obstacles);
        }
        this.world = { spawners, trees, chests, obstacles };
        this.spawnerMap = new Map(spawners.map((s) => [s.id, s]));
        this.treeCells.clear();
        for (const t of trees) {
            const k = this.cellKey(t.x, t.y);
            const a = this.treeCells.get(k);
            if (a)
                a.push(t);
            else
                this.treeCells.set(k, [t]);
        }
        // görseller: yalnızca yüklü adaların biyom görselleri bellekte tutulur
        const needed = new Set();
        for (const r of want) {
            const art = ZONES[r].art;
            for (const n of [art.ground, art.tree, art.boss, art.beast, art.rock, ...art.bld])
                needed.add(n.split('@')[0]);
        }
        for (const n of needed)
            this.loadSprite(n);
        for (const n of [...this.sprites.keys()])
            if (BIOME_ART.test(n) && !needed.has(n))
                this.sprites.delete(n);
        for (const n of [...this.tinted.keys()])
            if (!needed.has(n.split('@')[0]))
                this.tinted.delete(n);
        if (!first)
            this.loadT = 1.1;
    }
    getWorld() {
        if (!this.world)
            this.ensureLoaded(this.regionAt(this.px, this.py));
        return this.world;
    }
    cellKey(x, y) { return Math.floor(x / 300) * 4096 + Math.floor(y / 300); }
    /** (x,y) çevresindeki ağaçlar (ızgara ile hızlı arama; 40 adalık dünyada binlerce ağaç var) */
    treesNear(x, y, r) {
        this.getWorld();
        const out = [];
        const x0 = Math.floor((x - r) / 300);
        const x1 = Math.floor((x + r) / 300);
        const y0 = Math.floor((y - r) / 300);
        const y1 = Math.floor((y + r) / 300);
        for (let cx = x0; cx <= x1; cx++)
            for (let cy = y0; cy <= y1; cy++) {
                const a = this.treeCells.get(cx * 4096 + cy);
                if (a)
                    for (const t of a)
                        out.push(t);
            }
        return out;
    }
    isCleared(key) { return (this.save.spawn[key] ?? 0) > this.now(); }
    /** kamp temiz mi: yenilen boss bir daha çıkmaz */
    spCleared(sp) { return this.isCleared('s' + sp.id) || (sp.tier === 'boss' && sp.bridge === undefined && this.save.bossDown[sp.reg]); }
    // ---- statlar ----
    lv(id) { return this.save.upgrades[id] ?? 0; }
    perm(k) { return this.save.perm[k] ?? 0; }
    cb(stat) {
        let v = this.save.chestBonus[stat] ?? 0;
        for (const id of this.save.equipped) {
            const c = this.save.crystals.find((x) => x.id === id);
            if (c && c.stat === stat)
                v += crystalValue(c.stat, c.rarity, c.enchant);
        }
        return v;
    }
    item(type) {
        const id = this.save.eq[type];
        return id ? this.save.items.find((x) => x.id === id) : undefined;
    }
    /** takılı eşyalar: ana yuva + ek yuvalardaki aynı türden eşyalar */
    worn(type) {
        const out = [];
        const main = this.item(type);
        if (main)
            out.push(main);
        for (const id of this.save.extra) {
            const it = this.save.items.find((x) => x.id === id);
            if (it && it.type === type)
                out.push(it);
        }
        return out;
    }
    isWorn(id) { return this.save.eq.helmet === id || this.save.eq.shield === id || this.save.extra.includes(id); }
    /** ekipman ek yuvası: her 10 aşılan adada bir */
    extraSlots() { return Math.floor(this.bdFloor() / 10); }
    helmetHp() { return this.worn('helmet').reduce((a, h) => a + itemValue('helmet', h.rarity, h.level), 0); }
    helmetRegen() { return this.worn('helmet').reduce((a, h) => a + (h.rarity >= 3 ? 1.5 * (h.rarity - 2) : 0), 0); }
    blockChance() { return Math.min(0.6, this.worn('shield').reduce((a, s) => a + (s.rarity >= 3 ? 0.08 * (s.rarity - 2) : 0), 0)); }
    typedReduction(t) {
        let v = 0;
        for (const s of this.worn('shield'))
            v += s.dtype === t ? itemValue('shield', s.rarity, s.level) : itemValue('shield', s.rarity, s.level) * 0.5;
        return v;
    }
    /** bugün kalan reklam hakkı */
    adDailyLeft() { return Math.max(0, Game.AD_DAILY - (this.save.ads.day === this.dayNo() ? this.save.ads.n : 0)); }
    /** ödül için kalan bekleme (sn); 0 = hazır */
    adWait(kind) { return Math.max(0, Math.ceil(((this.save.ads.last[kind] ?? 0) + Game.AD_COOLDOWN * 1000 - this.now()) / 1000)); }
    /** reklam izlenince ödülü verir */
    claimAd(kind) {
        if (this.adDailyLeft() <= 0 || this.adWait(kind) > 0)
            return false;
        if (this.save.ads.day !== this.dayNo()) {
            this.save.ads.day = this.dayNo();
            this.save.ads.n = 0;
        }
        this.save.ads.n++;
        this.save.ads.last[kind] = this.now();
        if (kind === 'helmet' || kind === 'shield')
            this.gainItem(kind, 2);
        else if (kind === 'geode') {
            this.save.geodes += 2;
            this.gain('+2 Jeod', '#7dffb0', 'icon_geode');
        }
        else {
            const v = Math.round(400 * Math.pow(ZONES[this.region].scale, 0.7) * this.yieldMul());
            this.save.essence += v;
            this.gain('+' + this.fmt(v) + ' Ruh', '#8fdcff', 'ui_soul');
        }
        audio.play('chest');
        this.persist();
        this.onChange();
        return true;
    }
    rebirthCount() { return this.save.rebirth?.n ?? 0; }
    canRebirth() { return Math.max(this.bossesDown(), this.region + 1) >= Game.REBIRTH_FROM && this.dead <= 0 && !this.bonus && !this.snakeFight; }
    /** seviyeyi (ada ilerlemesini) sıfırlar, gücü korur; her sıfırlama mağazadan satın alınır (REBIRTH, consumable). Boss/kamp/ağaç ilerlemesi baştan yapılır, bir kez verilen ödüller (sandık, kule, bonus, yılan) tekrar verilmez. */
    rebirth() {
        if (!this.canRebirth())
            return 'Şu an yapılamaz';
        const prev = this.save.rebirth;
        const p0 = Math.max(1, this.fullPower() / this.shopMul());
        this.save.dwarfAt = undefined;
        this.doom = null;
        this.save.doom = false;
        this.save.topReg = 0;
        this.floorSeen = 0;
        this.save.rebirth = { n: (prev?.n ?? 0) + 1, p0: Math.max(p0, prev?.p0 ?? 0), floor: Math.max(this.bossesDown(), prev?.floor ?? 0) };
        this.save.bossDown = ZONES.map(() => false);
        this.save.spawn = {};
        this.save.gw = {};
        this.save.fog = {};
        for (const k of Object.keys(this.save.first))
            if (/^(s|t|bx|bee|pm)\d/.test(k))
                delete this.save.first[k]; // kamp, ağaç ve köprü ilerlemesi; kule/sandık/bonus/yılan ödülleri kalır
        this.save.x = HOME.x;
        this.save.y = HOME.y + 70;
        this.fogSets.clear();
        this.fogFade.clear();
        this.tg = null;
        this.enemies = [];
        this.projs = [];
        this.orbs = [];
        this.treeHp.clear();
        this.bldHp.clear();
        this.cast.clear();
        this.px = this.save.x;
        this.py = this.save.y;
        this.region = this.regionAt(this.px, this.py);
        this.ensureLoaded(this.region);
        this.hp = this.maxHp();
        this.persist();
        this.onChange();
        this.say('Yeniden doğdun: seviyen sıfırlandı, gücün korundu');
        this.narrate('rebirth');
        audio.play('boss');
        vibrate([90, 40, 160]);
        return '';
    }
    /** satın alınan güç paketlerinin toplam çarpanı (can ve hasar ×çarpan → güç ×çarpan) */
    shopMul() {
        let m = 1;
        for (const p of PACKS)
            m *= Math.pow(p.mul, this.save.shop[p.id] ?? 0);
        return m;
    }
    /** mağazadan gelen paket: kalıcı güç çarpanı eklenir */
    grantPack(id, receipt) {
        const p = PACKS.find((x) => x.id === id);
        if (!p)
            return false;
        this.save.shop[id] = (this.save.shop[id] ?? 0) + 1;
        this.hp = this.maxHp();
        audio.play('chest');
        vibrate(80);
        this.gain(p.name + ' etkinleştirildi (×' + p.mul + ' güç)', '#ffe36b', 'ui_power');
        console.info('güç paketi', id, receipt);
        this.persist();
        this.onChange();
        return true;
    }
    // ---- cadı evi ----
    /** bir porsiyon kedi maması: bir buçuk saatlik kazan getirisi kadar ruh (en az 40) */
    foodPrice() { return Math.max(40, this.soupYield(1.5 * 3.6e6)); }
    houseTasks() { return tasks(this.save.house, this.now(), { essence: this.save.essence, foodPrice: this.foodPrice() }); }
    setCatName(n) { this.save.house.catName = n.trim().slice(0, 14) || 'Pamuk'; this.persist(); this.onChange(); }
    /** kazanın o ana kadar biriktirdiği ruh */
    soupReady() { return this.soupYield(soupMs(this.save.house, this.now())); }
    /** saatlik ruh getirisi: son aşılan adanın ölçeğine göre */
    soupRate() {
        const reg = Math.min(this.bdFloor(), ZONES.length - 1);
        return 60 * Math.pow(ZONES[reg].scale, 0.7) * this.yieldMul();
    }
    soupYield(ms) { return Math.floor(this.soupRate() * (ms / 3.6e6)); }
    /** evde bir iş yap: kalıcı, sınırlı kazançlar (can en çok +%100, hasar en çok +%200) */
    doHouse(id) {
        const h = this.save.house;
        const now = this.now();
        const info = this.houseTasks().find((t) => t.id === id);
        if (!info || !info.ready)
            return 'Henüz hazır değil';
        let msg = '';
        if (id === 'daily') {
            const day = dayNumber(now);
            const gap = day - h.streakDay;
            h.streak = h.streakDay === 0 || gap > 2 ? 1 : gap === 2 ? h.streak : h.streak + 1; // bir gün kaçırmak seriyi bozmaz, yalnız durdurur
            h.streakDay = day;
            const geo = Math.min(5, h.streak);
            const ess = this.soupYield(4 * 3.6e6);
            this.save.geodes += geo;
            this.save.dust += 10;
            this.save.tiger.energy = Math.min(ENERGY_MAX, this.save.tiger.energy + 300); // günlük giriş: kaplana +5 dk enerji
            this.save.essence += ess;
            if (h.streak % 7 === 0) {
                this.gainItem('helmet', 3);
                this.gainItem('shield', 3);
            }
            msg = `Günlük ödül: +${geo} jeod, +${this.fmt(ess)} ruh · seri ${h.streak} gün` + (h.streak % 7 === 0 ? ' · büyük ödül!' : '');
            this.unlockOutfits();
        }
        else if (id === 'pet') {
            h.pet = now;
            h.hp = Math.min(HOUSE_HP_CAP, h.hp + 1);
            h.pets++;
            this.hp = Math.min(this.maxHp(), this.hp + this.maxHp() * 0.2);
            msg = 'Kedi mırıldadı: kalıcı +%1 azami can';
        }
        else if (id === 'buyfood') {
            const price = this.foodPrice();
            this.save.essence -= price;
            h.food += 1;
            msg = `Kedi maması alındı (−${this.fmt(price)} ruh)`;
        }
        else if (id === 'feed') {
            h.food -= 1;
            h.fedStreak = h.fed > 0 && now - h.fed <= FEED_GAP ? h.fedStreak + 1 : 1; // düzenli beslenme: 36 saatten uzun ara seriyi sıfırlar
            h.fed = now;
            h.feeds++;
            h.hp = Math.min(HOUSE_HP_CAP, h.hp + 0.5);
            this.hp = Math.min(this.maxHp(), this.hp + this.maxHp() * 0.1);
            msg = `${h.catName} doydu: kalıcı +%0,5 azami can · seri ${h.fedStreak}`;
            if (h.fedStreak % 5 === 0) {
                this.save.geodes += 2;
                msg += ' · +2 jeod';
            }
        }
        else if (id === 'garden') {
            h.garden = now;
            h.hp = Math.min(HOUSE_HP_CAP, h.hp + 1);
            this.save.geodes += 1;
            msg = 'Bahçe sulandı: +%1 azami can, +1 jeod';
        }
        else if (id === 'brew') {
            if (h.brewAt === 0) {
                h.brewAt = now;
                msg = 'İksir demlenmeye başladı (30 dk)';
            }
            else {
                h.brewAt = 0;
                h.dmg = Math.min(HOUSE_DMG_CAP, h.dmg + 2);
                h.brews++;
                msg = 'İksir hazır: kalıcı +%2 hasar';
            }
        }
        else if (id === 'soup') {
            const amt = this.soupYield(soupMs(h, now));
            h.soupAt = now;
            this.save.essence += amt;
            msg = amt > 0 ? `Kazandan +${this.fmt(amt)} ruh topladın` : 'Kazan yeni kuruldu';
        }
        audio.play(id === 'pet' || id === 'feed' ? 'heal' : 'chest');
        if (id !== 'daily' && id !== 'buyfood' && id !== 'soup')
            this.bumpDaily('house');
        scheduleHouse(h, now);
        this.say(msg);
        this.hp = Math.min(this.hp, this.maxHp());
        this.persist();
        this.onChange();
        return msg;
    }
    nestOf(o) {
        if (o.kind !== 'bld')
            return null;
        const reg = Math.floor(o.id / 100);
        let c = this.nestCache.get(reg);
        if (!c) {
            // adanın kuleleri arasından deterministik seçim: 4. adadan itibaren her adada en az bir dev yılan kulesi, 16. adadan sonra iki;
            // 3. adadan itibaren kalan kulelerin yarısı küçük yılan yuvası
            const ids = this.zoneWorld(reg).obstacles.filter((x) => x.kind === 'bld').map((x) => x.id).sort((a, b) => a - b);
            const giant = new Set();
            const small = new Set();
            if (reg >= 39)
                for (const id of ids)
                    giant.add(id); // 40. seviyeden itibaren bütün kulelerden dev yılan çıkar
            if (reg >= 3 && ids.length)
                giant.add(ids[reg % ids.length]);
            if (reg >= 15 && ids.length > 3)
                giant.add(ids[(reg + 2) % ids.length]);
            if (reg >= 2)
                ids.forEach((id, i) => { if (i % 2 === 0 && !giant.has(id))
                    small.add(id); });
            c = { giant, small };
            this.nestCache.set(reg, c);
        }
        return c.giant.has(o.id) ? 'giant' : c.small.has(o.id) ? 'small' : null;
    }
    releaseNest(o) {
        const k = this.nestOf(o);
        if (!k)
            return;
        const reg = Math.floor(o.id / 100);
        if (k === 'giant') {
            this.spawnGiant(o.x, o.y, reg, o.id);
            if (reg >= 49)
                this.snakeQueue.set(o.id, { left: 2, x: o.x, y: o.y, reg }); // 50. seviyeden sonra bir önceki ölünce sıradaki çıkar (toplam 3)
            return;
        }
        const n = 5 + Math.min(9, Math.floor(reg / 3));
        const rr = rng(o.id * 31 + 7);
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + rr();
            const x = o.x + Math.cos(a) * (40 + rr() * 50);
            const y = o.y + Math.sin(a) * (40 + rr() * 50);
            const lv = 0.8 + rr() * 0.8;
            const maxHp = ENEMIES.snake.hp * TIERS.easy.hp * ZONES[reg].scale * lv;
            this.enemies.push({
                def: ENEMIES.snake, tier: 'easy', lv, reg, sp: 600000 + o.id, x, y, hx: x, hy: y, hp: maxHp, maxHp, state: 'chase', hitCd: 0,
                phase: rr() * 6, dashT: 3, dvx: 0, dvy: 0, flip: 1, flash: 0, lunge: 0, moving: true,
            });
        }
        this.say('Kuleden yılanlar çıktı!');
        audio.play('roar');
        this.shake = Math.max(this.shake, 5);
    }
    archerOn() { return this.save.archer === 1 && settings.archer; }
    exploreMs() { return TEST_LEVEL ? 10 * 1000 : Game.EXPLORE_MS; }
    /** 60. adadan sonra maden, usta eğitimi ve arena kapanır; iksir kazanı tek mini oyun kalır */
    oldGamesClosed() { return this.bdFloor() >= Game.OLD_GAMES_END; }
    /** cüce iksiri etkisinde mi (kolaylıklar: gizlenme, +%25 ganimet, +%0,6 can/sn, +%15 kritik) */
    isDwarf() { return this.brewT > 0 && this.brewKind === 'dwarf'; }
    /** aynanın dengesi: cüce olunan adadan sonraki adada dev olmak zorunludur */
    forcedGiant() { return this.save.dwarfAt !== undefined && this.region === this.save.dwarfAt + 1; }
    /** adaya girişte cüce bir önceki adadaysa otomatik dev olunur (5 dk) */
    balanceCheck() {
        if (!this.forcedGiant() || this.save.first['bal' + this.region])
            return;
        this.save.first['bal' + this.region] = 1;
        this.brewKind = 'giant';
        this.brewS = 0.75;
        this.brewT = Game.BREW_SEC;
        this.brewInfoT = 7;
        this.brewInfoKind = 'giant';
        this.brewInfoMush = false;
        this.hp = this.maxHp();
        this.brewInfoNote = 'Aynanın dengesi: cüceden sonra dev olursun';
        audio.play('boss');
        vibrate([60, 40, 120]);
        this.narrate('balance');
    }
    brewReadyInMs() { return Math.max(0, (this.save.brewAt ?? 0) + Game.BREW_CD_MS - Date.now()); }
    /** dev: güç x3 (can ve hasar x3), cüce: güç x0,75 (can ve hasar x0,75); güç = √(can x hasar) olduğundan çarpan güce aynen yansır */
    brewHpMul() { return this.brewT <= 0 ? 1 : this.brewKind === 'giant' ? 3 : this.brewKind === 'dwarf' ? 0.75 : 1 + 0.15 * this.brewS; }
    brewDmgMul() { return this.brewT <= 0 ? 1 : this.brewKind === 'giant' ? 3 : this.brewKind === 'dwarf' ? 0.75 : 1 + 0.15 * this.brewS; }
    brewPowerMul() { return Math.sqrt(this.brewHpMul() * this.brewDmgMul()); }
    brewSpeedMul() { return this.brewT <= 0 ? 1 : this.brewKind === 'giant' ? 0.75 : this.brewKind === 'dwarf' ? 2 : 1; }
    brewEva() { return 0; }
    brewScale() { return this.brewT <= 0 ? 1 : this.brewKind === 'giant' ? 3 : this.brewKind === 'dwarf' ? 0.75 : 1; }
    /** kaplan: dev iksirinde boy x4, güç x4, hız x1,5; cüce iksirinde boy x0,5, güç aynı */
    brewTigerSize() { return this.brewT <= 0 ? 1 : this.brewKind === 'giant' ? 4 : this.brewKind === 'dwarf' ? 0.5 : 1; }
    brewTigerPower() { return this.brewT > 0 && this.brewKind === 'giant' ? 4 : 1; }
    brewTigerSpeed() { return this.brewT > 0 && this.brewKind === 'giant' ? 1.5 : 1; }
    static brewLines(kind, mush = false) {
        if (mush && kind !== 'balanced')
            return [kind === 'giant' ? 'DEV MANTARI' : 'CÜCE MANTARI', ...Game.brewLines(kind).slice(1)];
        if (kind === 'giant')
            return ['DEV İKSİRİ', 'Boyut ×3 · Güç ×3 · Hız −%25', 'Kaplan: boyut ×4 · güç ×4 · hız ×1,5'];
        if (kind === 'dwarf')
            return ['CÜCE İKSİRİ', 'Boyut −%25 · Güç −%25 · Hız ×2', 'Kaplan: boyut −%50 · güç aynı'];
        return ['DENGELİ İKSİR', 'Küçük bir güç artışı', ''];
    }
    /** karışım: sum > 0 dev, sum < 0 cüce (|sum| < 2 dengeli); q 0.4–1 karıştırma ustalığı. Sonuç ve ödül döner. */
    brew(sum, q) {
        if (this.brewReadyInMs() > 0 || this.dead > 0 || this.mushBrew)
            return null; // mantar etkisi sürerken iksir içilmez
        if (this.forcedGiant())
            sum = Math.max(sum, 3); // aynanın dengesi: bu adada dev olmak zorunlu
        const kind = Math.abs(sum) < 2 ? 'balanced' : sum > 0 ? 'giant' : 'dwarf';
        const s = kind === 'balanced' ? q : Math.min(1, Math.max(0.25, Math.abs(sum) / 8)) * q;
        this.brewKind = kind;
        this.brewS = s;
        this.brewT = Game.BREW_SEC;
        this.brewInfoT = 7;
        this.brewInfoKind = kind;
        this.brewInfoNote = '';
        this.brewInfoMush = false;
        if (kind === 'dwarf')
            this.save.dwarfAt = this.region;
        else if (this.save.dwarfAt === this.region - 1)
            this.save.dwarfAt = undefined;
        const geodes = 1 + (q >= 0.85 ? 1 : 0);
        const dust = Math.ceil(q * 20 * (1 + this.bdFloor() / 10));
        this.save.geodes += geodes;
        this.save.dust += dust;
        this.save.brewAt = Date.now();
        this.hp = this.maxHp();
        if (kind !== 'balanced')
            this.narrate(kind);
        this.brewInfoNote = '';
        audio.play('boss');
        vibrate([60, 40, 120]);
        this.persist();
        this.onChange();
        return { kind, s, geodes, dust };
    }
    tickBrew(dt) {
        this.brewInfoT = Math.max(0, this.brewInfoT - dt);
        if (this.brewT <= 0)
            return;
        this.brewT = Math.max(0, this.brewT - dt);
        if (this.brewT <= 0) {
            this.mushBrew = false;
            this.hp = Math.min(this.hp, this.maxHp());
            this.say('İksirin etkisi geçti');
        }
    }
    drawBrewHud() {
        if (this.brewInfoT > 0) {
            // iksir başlarken etkileri geçici süre ekrana yazar
            const ic = this.ctx;
            const lines = [...Game.brewLines(this.brewInfoKind, this.brewInfoMush), this.brewInfoNote].filter(Boolean);
            const a = Math.min(1, this.brewInfoT / 1.2);
            ic.save();
            ic.globalAlpha = a;
            ic.textAlign = 'center';
            const fs = Math.round(15 * this.lk());
            const bh = lines.length * fs * 1.45 + fs * 1.2;
            const bw = Math.min(this.w - 24, 360);
            ic.fillStyle = 'rgba(8,4,24,0.72)';
            ic.beginPath();
            ic.roundRect(this.w / 2 - bw / 2, 14, bw, bh, 12);
            ic.fill();
            ic.strokeStyle = this.brewInfoKind === 'giant' ? '#ffb36b' : this.brewInfoKind === 'dwarf' ? '#7be0ff' : '#c8ffa0';
            ic.lineWidth = 2;
            ic.stroke();
            lines.forEach((ln, i) => {
                ic.font = (i === 0 ? 'bold ' + Math.round(fs * 1.25) : 'bold ' + fs) + 'px sans-serif';
                ic.fillStyle = i === 0 ? '#ffe36b' : '#fff';
                ic.fillText(T(ln), this.w / 2, 14 + fs * 1.6 + i * fs * 1.45);
            });
            ic.restore();
        }
        if (this.brewT <= 0)
            return;
        const c = this.ctx;
        c.textAlign = 'center';
        c.font = 'bold ' + Math.round(14 * this.lk()) + 'px sans-serif';
        c.lineWidth = 4;
        c.strokeStyle = '#000';
        c.fillStyle = this.brewKind === 'giant' ? '#ffb36b' : this.brewKind === 'dwarf' ? '#7be0ff' : '#c8ffa0';
        const txt = (this.mushBrew ? (this.brewKind === 'giant' ? '🍄 DEV MANTARI' : '🍄 CÜCE MANTARI') : this.brewKind === 'giant' ? '⚗️ DEV İKSİRİ' : this.brewKind === 'dwarf' ? '⚗️ CÜCE İKSİRİ' : '⚗️ DENGELİ İKSİR') + ' · ' + Math.ceil(this.brewT) + ' sn';
        c.strokeText(txt, this.w / 2, 138 * this.lk());
        c.fillText(txt, this.w / 2, 138 * this.lk());
    }
    giantK(reg) { return reg >= Game.GIANT_FROM && !this.save.first['ended'] ? 1.5 : 1; } // ayna bütünlenince (final) devler çekilir
    /** düşman yarıçapı (çarpışma ve çizim): 50. adadan sonra devler; dev yılan bölümleri etkilenmez */
    erad(e) { return e.def.r * TIERS[e.tier].size * (e.seg ? 1 : this.giantK(e.reg)) * (e.giant ? 1.7 : 1); }
    tickTremor(dt) {
        const r = this.region;
        if (r < 34 || r >= Game.GIANT_FROM || this.dead > 0)
            return;
        const st = r < 39 ? 0 : r < 44 ? 1 : r < 48 ? 2 : 3;
        if (this.tremorT > 0) {
            this.tremorT -= dt;
            this.shake = Math.max(this.shake, 3.5 + st * 1.8);
            return;
        }
        this.tremorNext -= dt;
        if (this.tremorNext > 0)
            return;
        this.tremorNext = 75 - st * 14 + Math.random() * 25; // devler yaklaştıkça sarsıntılar sıklaşır
        this.tremorT = 2.2 + st * 0.5;
        const lines = TREMOR_TEXT[st];
        this.say(lines[Math.floor(Math.random() * lines.length)]);
        audio.play('gate');
        vibrate([90, 40, 90, 40, 140]);
    }
    /** adaya girişte, ulaşılan en yüksek devler aşaması bir kez hikâye olarak anlatılır (alttakiler atlanır) */
    giantStage() {
        const r = this.region;
        for (let i = GIANT_STAGES.length - 1; i >= 0; i--) {
            const [th, key] = GIANT_STAGES[i];
            if (r < th)
                continue;
            if (this.save.first['nar' + key])
                return;
            for (let j = 0; j < i; j++)
                this.save.first['nar' + GIANT_STAGES[j][1]] = 1;
            this.narrate(key);
            return;
        }
    }
    narrate(key) {
        if (this.save.first['nar' + key])
            return;
        this.save.first['nar' + key] = 1;
        this.onNarrate(key);
    }
    curseMul() { return this.curseT > 0 ? CURSE_MUL : 1; }
    applyCurse() {
        this.curseT = CURSE_SEC;
        this.hp = Math.min(this.hp, this.maxHp());
        audio.play('hurt');
        vibrate([60, 40, 160]);
    }
    tickCurse(dt) {
        if (this.curseT <= 0)
            return;
        this.curseT = Math.max(0, this.curseT - dt);
        if (this.curseT <= 0)
            this.say('Büyü bozuldu: gücün geri geldi');
    }
    drawCurseHud() {
        if (this.curseT <= 0)
            return;
        const c = this.ctx;
        c.textAlign = 'center';
        c.font = 'bold ' + Math.round(14 * this.lk()) + 'px sans-serif';
        c.lineWidth = 4;
        c.strokeStyle = '#000';
        c.fillStyle = '#9dff7a';
        const txt = '🔮 LANET: güç %' + Math.round((1 - CURSE_MUL) * 100) + ' düştü · ' + Math.ceil(this.curseT) + ' sn';
        c.strokeText(txt, this.w / 2, 158 * this.lk());
        c.fillText(txt, this.w / 2, 158 * this.lk());
    }
    toneNow() {
        const reg = this.region;
        if (reg >= ZONES.length - 12)
            return 'final';
        if (this.shopMul() >= 1.5)
            return 'paid';
        if (this.rebirthCount() > 0 && this.bossesDown() < (this.save.rebirth?.floor ?? 0))
            return 'back';
        const r = this.fullPower() / Math.max(1, this.bossPower(reg) * Game.MARGIN);
        return r < 1.2 ? 'weak' : 'strong';
    }
    provoke(reg) {
        // eski oyunların kapandığı an
        if (this.bdFloor() === Game.OLD_GAMES_END && !this.save.first['oldEnd']) {
            this.save.first['oldEnd'] = 1;
            this.narrate('closing');
            return;
        }
        const a = arcAt(reg);
        if (!a)
            return;
        const key = 'tn' + a.arc.start;
        if (a.step === 0 || !this.save.first[key])
            this.save.first[key] = TONES.indexOf(this.toneNow()) + 1;
        const tone = TONES[(this.save.first[key] ?? 1) - 1];
        const curse = a.step === a.arc.len - 1 && a.index % 2 === 0 ? CURSE_TEXT : null; // yayın son adımında (iki yayda bir) usta cadı büyü yapar
        this.onProvoke(PROVOKE_TITLE, PROVOKE[tone][Math.min(a.step, 2)], tone, curse);
    }
    potionMul() { return this.potionT > 0 ? 10 : 1; }
    tickPotion(dt) {
        if (this.potionT <= 0)
            return;
        this.potionT = Math.max(0, this.potionT - dt);
        if (this.potionT <= 0) {
            this.hp = Math.min(this.hp, this.maxHp());
            this.say('İksirin etkisi bitti');
        }
    }
    /** iksir süresince ekranın üstünde kalan süre gösterilir */
    drawPotion() {
        if (this.potionT <= 0)
            return;
        const c = this.ctx;
        c.textAlign = 'center';
        c.font = 'bold ' + Math.round(15 * this.lk()) + 'px sans-serif';
        c.lineWidth = 4;
        c.strokeStyle = '#000';
        c.fillStyle = '#ff9bff';
        const txt = '🧪 GÜÇ ×10 · ' + Math.ceil(this.potionT) + ' sn';
        c.strokeText(txt, this.w / 2, 118 * this.lk());
        c.fillText(txt, this.w / 2, 118 * this.lk());
    }
    /** kaşifin hedefi: bulunulan seviyeden sonraki 3'ün katı olan ada (seviye 4 → 6, seviye 11 → 12); ada dizini (0 tabanlı), yoksa -1 */
    exploreTarget() {
        const t = (Math.floor((this.region + 1) / 3) + 1) * 3;
        return t <= ZONES.length ? t - 1 : -1;
    }
    explorerState() {
        const ex = this.save.explorer;
        if (ex.at > 0)
            return { away: true, target: ex.target, leftMs: Math.max(0, ex.at + this.exploreMs() - Date.now()), found: false };
        const t = this.exploreTarget();
        return { away: false, target: t, leftMs: 0, found: t >= 0 && this.save.mines.includes(t) };
    }
    /** kaşifi keşfe gönderir: 'ok' ya da nedeni */
    sendExplorer() {
        if (this.oldGamesClosed())
            return 'Maden kapandı: yalnızca iksir kazanı kaldı';
        const st = this.explorerState();
        if (st.away)
            return 'Kaşif zaten yolda';
        if (st.target < 0)
            return 'Bu seviyeden sonra keşfedilecek maden yok';
        if (st.found)
            return 'Bu seviyedeki madeni kaşif zaten buldu';
        this.save.explorer = { at: Date.now(), target: st.target };
        this.bumpDaily('explorer');
        this.say('Kaşif ' + (st.target + 1) + '. adaya doğru yola çıktı');
        scheduleHouse(this.save.house, this.now(), this.save.explorer.at + this.exploreMs());
        this.persist();
        this.onChange();
        return 'ok';
    }
    /** kaşif gönderilebilir mi (hedef maden henüz bulunmadı ve kaşif evde): ev düğmesinde rozet için */
    explorerCanSend() {
        const st = this.explorerState();
        return !st.away && st.target >= 0 && !st.found;
    }
    /** yeni adaya girince (ve oyun başında) kaşifi göndermesi önerilir; her hedef için bir kez */
    hintExplorer() {
        if (this.hintReg === this.region)
            return;
        this.hintReg = this.region;
        const t = this.exploreTarget();
        if (!this.explorerCanSend() || this.save.first['xh' + t])
            return;
        this.save.first['xh' + t] = 1;
        this.gain('Kaşifi keşfe gönder: ' + (t + 1) + '. adada elmas madeni olabilir', '#8fdcff', 'icon_geode');
        this.say('Kaşifi keşfe gönder (Cadı Evi → Kaşif): ' + (t + 1) + '. adada elmas madeni olabilir');
    }
    mineLevel(reg) { return this.save.mineLv[reg] ?? 1; }
    /** biriken ödül: toz, jeod (kesirli kısım saklanır) ve geçen saat */
    mineStock(reg) {
        const since = this.save.mineIdleAt[reg] ?? Date.now();
        const h = Math.min(Game.MINE_CAP_H, Math.max(0, (Date.now() - since) / 3.6e6));
        const lv = this.mineLevel(reg);
        return { dust: Math.floor(h * 30 * (1 + reg / 10) * lv), geodes: Math.floor(h * 0.25 * lv), hours: h };
    }
    collectMine(reg) {
        const st = this.mineStock(reg);
        if (st.dust <= 0 && st.geodes <= 0)
            return false;
        this.save.dust += st.dust;
        this.save.geodes += st.geodes;
        this.save.mineIdleAt[reg] = Date.now();
        this.gain('+' + st.dust + ' Toz (maden)', '#ffd1f0', 'ui_dust');
        if (st.geodes > 0)
            this.gain('+' + st.geodes + ' Jeod (maden)', '#7dffb0', 'icon_geode');
        audio.play('chest');
        this.persist();
        this.onChange();
        return true;
    }
    mineUpgradeCost(reg) { return Math.floor(150 * Math.pow(this.mineLevel(reg), 1.6) * (1 + reg / 20)); }
    upgradeMine(reg) {
        const lv = this.mineLevel(reg);
        if (lv >= 10)
            return 'max';
        const cost = this.mineUpgradeCost(reg);
        if (this.save.dust < cost)
            return 'poor';
        this.collectMine(reg); // eski seviyenin kazancı önce teslim alınır
        this.save.dust -= cost;
        this.save.mineLv[reg] = lv + 1;
        this.persist();
        this.onChange();
        return 'ok';
    }
    tickExplorer() {
        this.hintExplorer();
        for (const r of this.save.mines)
            if (this.save.mineIdleAt[r] === undefined)
                this.save.mineIdleAt[r] = Date.now();
        const ex = this.save.explorer;
        if (ex.at <= 0 || Date.now() < ex.at + this.exploreMs())
            return;
        if (!this.save.mines.includes(ex.target)) {
            this.save.mines.push(ex.target);
            this.save.mineIdleAt[ex.target] = Date.now();
        }
        this.save.explorer = { at: 0, target: -1 };
        audio.play('chest');
        vibrate([80, 60, 160]);
        this.gain('Kaşif elmas madeni buldu!', '#8fdcff', 'icon_geode');
        if (this.save.mines.length === 1)
            this.onMineFound(ex.target);
        this.say('Kaşif ' + (ex.target + 1) + '. adada elmas madeni buldu!');
        this.persist();
        this.onChange();
    }
    mineCdLeftMs(reg) {
        return Math.max(0, (this.save.mineAt[reg] ?? 0) + (TEST_LEVEL ? 0 : Game.MINE_CD_MS) - Date.now());
    }
    /** maden girişinin konumu: adanın içinde, engellerden uzak, sabit (ada dizinine bağlı) */
    mineSpot(reg) {
        if (TEST_MINE && reg === TEST_LEVEL - 1) {
            const rp = this.restPoints()[reg];
            return { x: rp.x + 150, y: rp.y + 20 };
        }
        const hit = this.mineSpots.get(reg);
        if (hit)
            return hit;
        const z = ZONES[reg];
        const obs = this.zoneWorld(reg).obstacles;
        let best = { x: z.cx + z.radius * 0.5, y: z.cy };
        for (let k = 0; k < 60; k++) {
            const a = reg * 2.399 + k * 0.7;
            const d = z.radius * (0.42 + (k % 5) * 0.04);
            const x = z.cx + Math.cos(a) * d;
            const y = z.cy + Math.sin(a) * d;
            if (obs.some((o) => Math.hypot(o.x - x, o.y - y) < o.r + 110))
                continue;
            best = { x, y };
            break;
        }
        this.mineSpots.set(reg, best);
        return best;
    }
    /** maden oyunu bitti: kazılan elmasa göre can yenilenir, kalıcı güç ve eşya kazanılır; özet döner */
    finishMine(reg, diamonds, potion = false) {
        this.save.mineAt[reg] = Date.now();
        this.hp = this.maxHp();
        const before = this.fullPower();
        const f = 0.003 * diamonds; // her elmas kalıcı +%0,3 can ve hasar
        this.addPerm('elite.hp', f * this.hpPool());
        this.addPerm('elite.dmg', f * this.dmgPool());
        const power = Math.max(0, this.fullPower() - before);
        const items = Math.floor(diamonds / 5);
        for (let i = 0; i < items; i++)
            this.gainItem(i % 2 ? 'shield' : 'helmet', 1 + (reg >= 12 ? 1 : 0));
        if (diamonds >= 6)
            this.gainTigerItem(1);
        const geodes = Math.floor(diamonds / 3);
        this.save.geodes += geodes;
        if (power > 0)
            this.gain('+' + this.fmt(power) + ' Güç (kalıcı, maden)', '#ffe36b', 'ui_power');
        if (geodes > 0)
            this.gain('+' + geodes + ' Jeod', '#7dffb0', 'icon_geode');
        this.say('Maden bitti: canın doldu!');
        this.persist();
        this.onChange();
        this.invuln = Math.max(this.invuln, 3); // madenden çıkarken cadı kısa süre korunur
        if (potion) {
            this.potionT = 60;
            this.hp = this.maxHp();
            this.gain('Gizli iksir: 1 dk güç ×10!', '#ff9bff', 'icon_potion');
            this.say('Gizli iksir! 1 dakika boyunca gücün 10 katı');
            audio.play('boss');
        }
        return { diamonds, power, items, geodes, potion };
    }
    drawMines(camX, camY) {
        if (this.bonus)
            return;
        const c = this.ctx;
        for (const r of [this.region - 1, this.region, this.region + 1]) {
            if (r < 0 || r >= ZONES.length || !this.save.mines.includes(r))
                continue;
            const p = this.mineSpot(r);
            if (!this.inView(p.x, p.y, 140, camX, camY))
                continue;
            c.fillStyle = 'rgba(0,0,0,0.3)';
            c.beginPath();
            c.ellipse(p.x + 4, p.y + 24, 62, 20, 0, 0, Math.PI * 2);
            c.fill();
            const spent = this.mineCdLeftMs(r) > 0 || this.oldGamesClosed(); // tamamlanan/kapanan maden solar (yok edilen kamplar gibi)
            c.globalAlpha = spent ? 0.8 : 1;
            if (!this.drawSpr(spent ? 'mine@gray' : 'mine', p.x, p.y - 30, 150)) {
                c.fillStyle = '#5a6a7a';
                c.beginPath();
                c.arc(p.x, p.y - 20, 50, 0, Math.PI * 2);
                c.fill();
                c.fillStyle = '#8fdcff';
                c.fillText('💎', p.x, p.y - 14);
            }
            c.globalAlpha = 1;
            if (!spent) { // yalnızca kullanılabilir maden parıldar
                const s = 0.5 + 0.5 * Math.sin(this.time * 3 + r);
                c.fillStyle = `rgba(190,240,255,${0.35 + 0.4 * s})`;
                c.beginPath();
                c.arc(p.x + 30 * Math.cos(this.time + r), p.y - 40 + 14 * Math.sin(this.time * 1.7 + r), 3 + 2 * s, 0, Math.PI * 2);
                c.fill();
            }
            c.font = 'bold 12px sans-serif';
            c.textAlign = 'center';
            c.fillStyle = spent ? '#9aa6ad' : '#c8f4ff';
            const left = this.mineCdLeftMs(r);
            c.fillText(this.oldGamesClosed() ? T('MADEN KAPANDI') : left > 0 ? T('MADEN TÜKENDİ') + ' · ' + Math.ceil(left / 60000) + ' dk' : T('ELMAS MADENİ') + ' · ' + T('dokun'), p.x, p.y + 52);
        }
    }
    fogKey(gx, gy) { return (gx + 6000) * 12000 + (gy + 6000); }
    fogSet(reg) {
        let s = this.fogSets.get(reg);
        if (!s) {
            s = new Set(this.save.fog[reg] ?? []);
            this.fogSets.set(reg, s);
        }
        return s;
    }
    fogActive(reg) { return !this.save.bossDown[reg]; }
    revealFog(dt) {
        for (const [k, t] of this.fogFade) {
            if (t <= dt)
                this.fogFade.delete(k);
            else
                this.fogFade.set(k, t - dt);
        }
        const reg = this.region;
        if (!this.fogActive(reg))
            return;
        const C = Game.FOG_CELL;
        const set = this.fogSet(reg);
        const arr = this.save.fog[reg] ?? (this.save.fog[reg] = []);
        const g0x = Math.floor((this.px - Game.FOG_R) / C);
        const g1x = Math.floor((this.px + Game.FOG_R) / C);
        const g0y = Math.floor((this.py - Game.FOG_R) / C);
        const g1y = Math.floor((this.py + Game.FOG_R) / C);
        for (let gx = g0x; gx <= g1x; gx++) {
            for (let gy = g0y; gy <= g1y; gy++) {
                if (Math.hypot((gx + 0.5) * C - this.px, (gy + 0.5) * C - this.py) > Game.FOG_R)
                    continue;
                const k = this.fogKey(gx, gy);
                if (set.has(k))
                    continue;
                set.add(k);
                arr.push(k);
                this.fogFade.set(k, 1);
            }
        }
    }
    cloudSprite() {
        if (this.cloudSpr)
            return this.cloudSpr;
        const cv = document.createElement('canvas');
        cv.width = cv.height = 160;
        const x = cv.getContext('2d');
        const g = x.createRadialGradient(80, 80, 0, 80, 80, 80);
        g.addColorStop(0, 'rgba(236,240,250,1)');
        g.addColorStop(0.55, 'rgba(214,222,240,0.95)');
        g.addColorStop(1, 'rgba(200,210,235,0)');
        x.fillStyle = g;
        x.fillRect(0, 0, 160, 160);
        this.cloudSpr = cv;
        return cv;
    }
    drawFog(camX, camY) {
        const reg = this.region;
        const C = Game.FOG_CELL;
        const spr = this.cloudSprite();
        const c = this.ctx;
        for (const r of [reg - 1, reg, reg + 1]) {
            if (r < 0 || r >= ZONES.length || !this.fogActive(r))
                continue;
            const z = ZONES[r];
            const cx = z.cx - camX;
            const cy = z.cy - camY;
            if (cx + z.radius < 0 || cx - z.radius > this.vw || cy + z.radius < 0 || cy - z.radius > this.vh)
                continue;
            const set = this.fogSet(r);
            c.save();
            c.beginPath();
            c.arc(z.cx, z.cy, z.radius, 0, Math.PI * 2);
            c.clip(); // dünya koordinatı: çağrı zaten kamera çevirisi içinde
            const g0x = Math.floor(camX / C) - 1;
            const g1x = Math.floor((camX + this.vw) / C) + 1;
            const g0y = Math.floor(camY / C) - 1;
            const g1y = Math.floor((camY + this.vh) / C) + 1;
            for (let gx = g0x; gx <= g1x; gx++) {
                for (let gy = g0y; gy <= g1y; gy++) {
                    const wx = (gx + 0.5) * C;
                    const wy = (gy + 0.5) * C;
                    if (Math.hypot(wx - z.cx, wy - z.cy) > z.radius + C)
                        continue;
                    const k = this.fogKey(gx, gy);
                    const fade = this.fogFade.get(k);
                    if (set.has(k) && fade === undefined)
                        continue;
                    c.globalAlpha = fade !== undefined ? fade : 0.97;
                    const d = Math.sin(this.time * 0.4 + k * 0.7) * 7;
                    c.drawImage(spr, wx - 95 + d, wy - 95 + Math.cos(this.time * 0.35 + k) * 5, 190, 190);
                }
            }
            c.restore();
        }
        c.globalAlpha = 1;
    }
    holeObj(who) {
        return who === 'cow' ? this.vqCow : who === 'vil' ? this.vqVil : who === 'ck' ? this.ck : this.tg;
    }
    makeShrooms() {
        this.shrooms = [];
        const h = this.hole;
        if (!h || this.region < Game.SHROOM_FROM)
            return;
        const dx = this.px - h.x;
        const dy = this.py - h.y;
        const len = Math.max(1, Math.hypot(dx, dy));
        const ux = dx / len;
        const uy = dy / len;
        // mantar sayısı en az seviye (ada) sayısı kadardır; çok olunca yayılım ve aralık genişler
        const n = Math.max(6, this.region + 1);
        const spread = Math.min(700, 220 + n * 4);
        const gap = n > 30 ? 60 : n > 15 ? 80 : 110;
        for (let i = 0; i < n; i++) {
            for (let k = 0; k < 25; k++) {
                const t = 0.12 + Math.random() * 0.8; // delik ile oyuncu arasında ve ötesinde
                const off = (Math.random() - 0.5) * spread;
                const x = h.x + dx * t - uy * off;
                const y = h.y + dy * t + ux * off;
                if (!this.walkable(x, y, true, false) || Math.hypot(x - this.px, y - this.py) < 120)
                    continue;
                if (this.shrooms.every((q) => Math.hypot(q.x - x, q.y - y) > gap)) {
                    this.shrooms.push({ id: ++this.shroomSeq, x, y });
                    break;
                }
            }
        }
        // yer bulunamayanlar için aralık kuralı gevşetilir: sayı en az seviye kadar kalır
        for (let k = 0; k < 400 && this.shrooms.length < n; k++) {
            const x = h.x + (Math.random() - 0.5) * 900;
            const y = h.y + (Math.random() - 0.5) * 900;
            if (this.walkable(x, y, true, false) && Math.hypot(x - this.px, y - this.py) > 100)
                this.shrooms.push({ id: ++this.shroomSeq, x, y });
        }
    }
    tickShrooms(dt) {
        for (const f of this.sporeFx)
            f.t -= dt;
        this.sporeFx = this.sporeFx.filter((f) => f.t > 0);
        for (const e of this.shroomEat)
            e.t += dt;
        this.shroomEat = this.shroomEat.filter((e) => e.t < 0.45);
        const h = this.hole;
        if (!h) {
            if (this.shrooms.length)
                this.shrooms = [];
            this.shroomEat = [];
            return;
        } // delik yok olunca mantarlar da yok olur
        for (const m of [...this.shrooms]) {
            if (Math.hypot(m.x - h.x, m.y - h.y) > Game.HOLE_R * 1.8)
                continue; // yalnızca delik üzerinden geçince etkiler (oyuncuya etkisi yok)
            this.shrooms = this.shrooms.filter((q) => q !== m); // yutulan mantar kaybolur
            this.shroomEat.push({ x: m.x, y: m.y, hx: h.x, hy: h.y, t: 0 });
            this.holeShrinkT = 60;
            this.sporeFx.push({ x: m.x, y: m.y, t: 1.2, big: false });
            this.sporeFx.push({ x: h.x, y: h.y, t: 1.4, big: true });
            this.say('Kara delik zehirli mantarı yuttu: 60 sn küçüldü ve seni yutamaz');
            audio.play('gain');
        }
    }
    drawShrooms(camX, camY) {
        const c = this.ctx;
        for (const e of this.shroomEat) {
            const u = Math.min(1, e.t / 0.45);
            const x = e.x + (e.hx - e.x) * u * u;
            const y = e.y + (e.hy - e.y) * u * u;
            if (!this.inView(x, y, 80, camX, camY))
                continue;
            c.globalAlpha = 1 - u;
            this.drawSprX('shroom_poison', x, y - 6, 54 * (1 - 0.8 * u), { rot: u * 6 });
            c.globalAlpha = 1;
        }
        if (!this.hole)
            return;
        for (const m of this.shrooms) {
            if (!this.inView(m.x, m.y, 80, camX, camY))
                continue;
            const pr = 0.5 + 0.5 * Math.sin(this.time * 3 + m.id);
            const g = c.createRadialGradient(m.x, m.y - 10, 4, m.x, m.y - 10, 46);
            g.addColorStop(0, `rgba(150,255,120,${0.25 + 0.2 * pr})`);
            g.addColorStop(1, 'rgba(150,255,120,0)');
            c.fillStyle = g;
            c.fillRect(m.x - 50, m.y - 60, 100, 100);
            c.fillStyle = 'rgba(0,0,0,0.25)';
            c.beginPath();
            c.ellipse(m.x, m.y + 12, 18, 6, 0, 0, Math.PI * 2);
            c.fill();
            if (!this.drawSprX('shroom_poison', m.x, m.y - 6, 54, { bob: Math.sin(this.time * 2 + m.id) * 1.5 })) {
                c.fillStyle = '#e8e0c8';
                c.fillRect(m.x - 5, m.y - 6, 10, 18);
                c.fillStyle = '#7a3ac8';
                c.beginPath();
                c.ellipse(m.x, m.y - 8, 20, 13, 0, Math.PI, 0);
                c.fill();
                c.fillStyle = '#b8ff7a';
                for (const [dx, dy] of [[-8, -13], [3, -17], [10, -10]]) {
                    c.beginPath();
                    c.arc(m.x + dx, m.y + dy, 3, 0, Math.PI * 2);
                    c.fill();
                }
            }
            for (let i = 0; i < 3; i++) {
                const k = (this.time * 0.5 + i / 3 + m.id * 0.13) % 1;
                c.fillStyle = `rgba(190,255,150,${0.7 * (1 - k)})`;
                c.beginPath();
                c.arc(m.x + Math.sin(k * 6 + i) * 12, m.y - 20 - k * 40, 2.2, 0, Math.PI * 2);
                c.fill();
            }
        }
    }
    /** adaya göre sabit (tohumlu) yerleşim: aynı ada her seferinde aynı yerlerde mantar verir */
    makePickMush(reg) {
        this.pickMush = [];
        this.pickMushReg = reg;
        const c = this.regionCenter(reg);
        let seed = (reg + 1) * 7919;
        const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
        let id = 0;
        for (const kind of ['giant', 'dwarf']) {
            for (let n = 0; n < Game.MUSH_PER_KIND; n++) {
                const key = 'pm' + reg + kind[0] + n;
                for (let k = 0; k < 300; k++) {
                    const a = rnd() * Math.PI * 2;
                    const r = 160 + Math.sqrt(rnd()) * Math.max(0, c.r - 320);
                    const x = c.x + Math.cos(a) * r;
                    const y = c.y + Math.sin(a) * r;
                    if (!this.walkable(x, y, true, false) || this.pickMush.some((q) => Math.hypot(q.x - x, q.y - y) < 260))
                        continue;
                    this.pickMush.push({ id: ++id, x, y, kind, key });
                    break;
                }
            }
        }
    }
    tickPickMush(dt) {
        this.pickMushHint = Math.max(0, this.pickMushHint - dt);
        if (this.bonus || this.dead > 0 || !this.world)
            return;
        if (this.pickMushReg !== this.region)
            this.makePickMush(this.region);
        for (const m of this.pickMush) {
            if (this.save.first[m.key] || Math.hypot(m.x - this.px, m.y - this.py) > 46)
                continue;
            if (this.brewT > 0) { // etki ya da iksir sürerken alınamaz
                if (this.pickMushHint <= 0) {
                    this.say('Bir etki sürerken yeni mantar alınamaz');
                    this.pickMushHint = 3;
                }
                continue;
            }
            this.save.first[m.key] = 1;
            const frac = this.hp / Math.max(1, this.maxHp());
            this.brewKind = m.kind;
            this.brewS = 1;
            this.brewT = Game.MUSH_SEC;
            this.mushBrew = true;
            this.brewInfoT = 4;
            this.brewInfoKind = m.kind;
            this.brewInfoNote = '';
            this.brewInfoMush = true;
            this.hp = Math.max(this.hp, frac * this.maxHp());
            this.sporeFx.push({ x: m.x, y: m.y, t: 1.2, big: false });
            audio.play('gain');
            vibrate([40, 30, 80]);
            this.persist();
            break;
        }
    }
    drawPickMush(camX, camY) {
        if (this.bonus)
            return;
        const c = this.ctx;
        for (const m of this.pickMush) {
            if (this.save.first[m.key] || !this.inView(m.x, m.y, 80, camX, camY))
                continue;
            const giant = m.kind === 'giant';
            const pr = 0.5 + 0.5 * Math.sin(this.time * 3 + m.id);
            const busy = this.brewT > 0;
            c.save();
            c.globalAlpha = busy ? 0.5 : 1;
            const gl = c.createRadialGradient(m.x, m.y - 10, 4, m.x, m.y - 10, 44);
            const gc = giant ? '255,120,90' : '170,230,255';
            gl.addColorStop(0, `rgba(${gc},${0.3 + 0.2 * pr})`);
            gl.addColorStop(1, `rgba(${gc},0)`);
            c.fillStyle = gl;
            c.fillRect(m.x - 50, m.y - 60, 100, 100);
            c.fillStyle = 'rgba(0,0,0,0.25)';
            c.beginPath();
            c.ellipse(m.x, m.y + 12, 17, 6, 0, 0, Math.PI * 2);
            c.fill();
            const by = Math.sin(this.time * 2 + m.id) * 1.5;
            c.fillStyle = '#f1e8cf';
            c.beginPath();
            c.roundRect(m.x - 5, m.y - 6 + by, 10, 18, 3);
            c.fill();
            c.fillStyle = giant ? '#d8302a' : '#f4f4f4';
            c.beginPath();
            c.ellipse(m.x, m.y - 6 + by, 21, 15, 0, Math.PI, 0);
            c.fill();
            c.strokeStyle = 'rgba(0,0,0,0.35)';
            c.lineWidth = 1.5;
            c.stroke();
            c.fillStyle = giant ? '#fff' : '#9fd4ff';
            for (const [dx, dy] of [[-9, -12], [2, -17], [10, -10], [-1, -9]]) {
                c.beginPath();
                c.arc(m.x + dx, m.y + dy + by, 2.6, 0, Math.PI * 2);
                c.fill();
            }
            c.restore();
        }
    }
    drawSpores() {
        const c = this.ctx;
        for (const f of this.sporeFx) {
            const k = 1 - f.t / (f.big ? 1.4 : 1.2);
            const r = (f.big ? 160 : 70) * k;
            c.save();
            c.globalCompositeOperation = 'lighter';
            const g = c.createRadialGradient(f.x, f.y, 2, f.x, f.y, r + 10);
            g.addColorStop(0, `rgba(170,255,130,${0.55 * (1 - k)})`);
            g.addColorStop(1, 'rgba(170,255,130,0)');
            c.fillStyle = g;
            c.beginPath();
            c.arc(f.x, f.y, r + 10, 0, Math.PI * 2);
            c.fill();
            c.restore();
        }
    }
    holeSpawn() {
        const c = this.regionCenter(this.region);
        for (let k = 0; k < 40; k++) {
            const a = Math.random() * Math.PI * 2;
            const d = Math.sqrt(Math.random()) * (c.r - 140);
            const x = c.x + Math.cos(a) * d;
            const y = c.y + Math.sin(a) * d;
            if (Math.hypot(x - this.px, y - this.py) < 600 || !this.walkable(x, y, false, true))
                continue;
            this.hole = { x, y };
            this.makeShrooms();
            return;
        }
    }
    updateHole(dt) {
        this.holeShrinkT = Math.max(0, this.holeShrinkT - dt);
        this.holeStill = Math.max(0, this.holeStill - dt);
        this.tickShrooms(dt);
        if (!this.hole && this.holeCow) { // delik yok olduysa yuttuğu yoldaş geri bırakılır
            const o = this.holeObj(this.holeCow.who);
            this.holeCow = null;
            if (o) {
                if (o.a !== undefined)
                    o.a = 1;
                o.x = this.px - 60;
                o.y = this.py + 24;
            }
        }
        const c = this.regionCenter(this.region);
        const onIsle = Math.hypot(this.px - c.x, this.py - c.y) <= c.r - 18;
        if (this.region !== this.holeIsle) {
            this.holeIsle = this.region;
            this.holeIsleT = 0;
            this.hole = null;
        }
        if (!onIsle || this.region < Game.HOLE_FROM || this.save.bossDown[this.region]) {
            this.hole = null;
            this.holeIsleT = 0;
            this.holeFreeze = 0;
            this.holeHits = 0;
            return;
        }
        if (this.snakeFight) {
            this.hole = null;
            return;
        } // yılan savaşında delik yok
        this.holeIsleT += dt;
        this.holeGrace = Math.max(0, this.holeGrace - dt);
        if (!this.hole) {
            if (this.holeIsleT < Game.HOLE_AFTER)
                return;
            this.holeSpawn();
            if (this.hole) {
                this.say('Kara delik belirdi! Kahramanı ondan uzak tut');
                audio.play('boss');
                vibrate(120);
            }
            return;
        }
        const h = this.hole;
        this.holeFreeze = Math.max(0, this.holeFreeze - dt);
        this.holeHitT = Math.max(0, this.holeHitT - dt);
        if (this.holeHitT <= 0)
            this.holeHits = 0;
        if (this.holeFreeze > 0)
            return; // okçu dondurdu: kımıldamaz, çekmez, yutmaz
        // delik yoldaşları (inek, köylü, tavuk, kaplan) çeker ve yutar: kaçma hızları ne olursa olsun yaklaşırlarsa içeri sürüklenir; 1 sn sonra öksürüp geri çıkarır ve 10 sn hareketsiz kalır
        if (!this.holeCow && this.holeShrinkT <= 0 && this.holeStill <= 0) {
            const PULL_C = 220;
            for (const who of ['cow', 'vil', 'ck', 'tg']) {
                const o = this.holeObj(who);
                if (!o || (who === 'tg' && this.tg?.down))
                    continue;
                const d = Math.hypot(o.x - h.x, o.y - h.y);
                if (d < PULL_C && d > 1) {
                    const f = (300 + 260 * (1 - d / PULL_C)) * dt; // tavuğun, köylünün ve kaplanın kaçış hızından güçlü
                    const nx2 = o.x + ((h.x - o.x) / d) * f;
                    const ny2 = o.y + ((h.y - o.y) / d) * f;
                    if (this.walkable(nx2, ny2, true, true)) {
                        o.x = nx2;
                        o.y = ny2;
                    }
                }
                if (Math.hypot(o.x - h.x, o.y - h.y) < Game.HOLE_R * 0.9) {
                    this.holeCow = { t: 0, who };
                    if (o.a !== undefined)
                        o.a = 0;
                    o.x = h.x;
                    o.y = h.y;
                    this.say(who === 'cow' ? 'Kara delik ineği yuttu!' : who === 'vil' ? 'Kara delik köylüyü yuttu!' : who === 'ck' ? 'Kara delik tavuğu yuttu!' : 'Kara delik kaplanı yuttu!');
                    audio.play('boss');
                    break;
                }
            }
        }
        if (this.holeCow) {
            const held = this.holeObj(this.holeCow.who);
            if (!held)
                this.holeCow = null;
            else {
                this.holeCow.t += dt;
                held.x = h.x;
                held.y = h.y;
                if (this.holeCow.t >= 1) {
                    this.holeCow = null;
                    const ux = this.px - h.x;
                    const uy = this.py - h.y;
                    const ul = Math.max(1, Math.hypot(ux, uy));
                    held.x = h.x + (ux / ul) * (Game.HOLE_R + 50);
                    held.y = h.y + (uy / ul) * (Game.HOLE_R + 50);
                    if (held.a !== undefined)
                        held.a = 1;
                    const fl = held;
                    if (fl.atkT !== undefined || 'combo' in fl)
                        fl.atkT = 0.5;
                    this.holeStill = 10;
                    this.sporeFx.push({ x: h.x, y: h.y, t: 1.4, big: true });
                    this.float(h.x, h.y - 70, 'ÖKSS!', '#c8ff9a');
                    this.say('Kara delik öksürdü ve 10 sn sersemledi');
                    this.shake = Math.max(this.shake, 6);
                    audio.play('hit');
                }
            }
        }
        if (this.holeStill > 0)
            return; // sersemledi: kımıldamaz, çekmez, yutmaz
        // delik bossa zarar verir: yakınındaki ada bossu 0,5 sn'de bir azami canının %1'ini kaybeder
        this.holeBossT -= dt;
        if (this.holeBossT <= 0) {
            this.holeBossT = 0.5;
            for (const e of this.enemies) {
                if (e.tier !== 'boss' || e.hp <= 0 || e.seg)
                    continue;
                if (Math.hypot(e.x - h.x, e.y - h.y) < 260)
                    this.hitEnemy(e, e.maxHp * 0.01, 'smash');
            }
        }
        // yavaşça kahramana süzülür
        const tx = this.px; // delik yalnız kahramanı kovalar: kaplan savaşırken kaçırılamadığı için deliğe karışmaz
        const ty = this.py;
        const dx = tx - h.x;
        const dy = ty - h.y;
        const dl = Math.max(1, Math.hypot(dx, dy));
        const sp = Math.max(40, this.speed() * 0.28);
        const nx = h.x + (dx / dl) * sp * dt;
        const ny = h.y + (dy / dl) * sp * dt;
        if (Math.hypot(nx - c.x, ny - c.y) <= c.r - 60) {
            h.x = nx;
            h.y = ny;
        }
        // kara delik evlere (dinlenme noktası) giremez: eve yaklaşırsa dışarı itilir
        const home = this.restPoints()[Math.min(this.region, this.restPoints().length - 1)];
        const keep = home.r + Game.HOLE_R + 40;
        const hd = Math.hypot(h.x - home.x, h.y - home.y);
        if (hd < keep) {
            const ux = hd > 0.01 ? (h.x - home.x) / hd : 1;
            const uy = hd > 0.01 ? (h.y - home.y) / hd : 0;
            h.x = home.x + ux * keep;
            h.y = home.y + uy * keep;
        }
        // çekim alanı: kahramanı yavaşça içeri çeker (kaçmak mümkün: çekim hızdan zayıf)
        const PULL = 180;
        const pull = (x, y, ign) => {
            const d = Math.hypot(h.x - x, h.y - y);
            if (d >= PULL || d < 1)
                return { x, y };
            const f = this.speed() * 0.5 * (1 - d / PULL) * dt;
            const px2 = x + ((h.x - x) / d) * f;
            const py2 = y + ((h.y - y) / d) * f;
            return this.walkable(px2, py2, false, ign) ? { x: px2, y: py2 } : { x, y };
        };
        if (this.flyT > 0 || this.inHome() || this.holeShrinkT > 0 || (this.brewT > 0 && this.brewKind === 'giant'))
            return; // dev kara delik tarafından çekilmez ve yutulmaz; // küçülmüş delik çekmez; süpürgeyle uçarken ya da evdeyken kara delik çekemez ve yutamaz
        const hp = pull(this.px, this.py, false);
        this.px = hp.x;
        this.py = hp.y;
        if (this.holeGrace > 0 || this.holeShrinkT > 0)
            return; // küçülmüş delik yutamaz
        if (Math.hypot(h.x - this.px, h.y - this.py) < Game.HOLE_R * 0.6)
            this.holeSwallow('hero');
    }
    toggleArcher() {
        this.archerSel = !this.archerSel && this.archerOn();
        this.aim = null;
        this.say(this.archerSel ? 'Okçu seçili: basılı tuttukça arbalet seri ok atar' : 'Okçu bırakıldı');
    }
    aimWorld() {
        const a = this.aim;
        return a ? { x: this.px + (a.x - this.w / 2) / this.zoom, y: this.py + (a.y - this.h / 2) / this.zoom } : null;
    }
    /** parmak/fare bırakıldı: seri atış durur */
    aimFire() { this.aim = null; }
    /** okçunun oku: nişan noktasına doğru atar (nişanı oyuncu alır, otomatik atış yok; cadı ve kaplan kendi kendine saldırmaya devam eder) */
    archerShoot(wx, wy) {
        if (!this.archerOn() || this.archerCd > 0 || this.dead > 0 || this.holeTrap)
            return;
        const ox = this.px;
        const oy = this.py - 10;
        const a = Math.atan2(wy - oy, wx - ox);
        this.archerCd = 0.16;
        const p = this.newProj('arrow', ox, oy, this.arrowDmg(), 'pierce');
        p.vx = Math.cos(a) * 760;
        p.vy = Math.sin(a) * 760;
        p.max = 1.1;
        p.pierce = 3;
        p.a = a;
        this.projs.push(p);
        audio.play('cast');
    }
    /** arbalet okunun hasarı: kuşanılan büyülerin ortalama hasarının 1,5 katı (yalnız asa değil; ilerledikçe birlikte büyür) */
    arrowDmg() {
        const eq = this.equippedWeapons();
        if (!eq.length)
            return this.weaponDmg(0) * 1.5;
        return (eq.reduce((a, i) => a + this.weaponDmg(i), 0) / eq.length) * 1.5;
    }
    /** ok deliğe değdiyse true (ok söner); 3 isabet = 30 sn dondurma */
    arrowHitsHole(p) {
        const h = this.hole;
        if (!h || Math.hypot(p.x - h.x, p.y - h.y) > Game.HOLE_R + 8)
            return false;
        if (this.holeFreeze > 0)
            return true;
        this.holeHits++;
        this.holeHitT = 10;
        audio.play('hit');
        if (this.holeHits >= 3) {
            this.holeHits = 0;
            this.holeFreeze = 30;
            this.say('Okçu kara deliği 30 saniyeliğine dondurdu!');
            vibrate(80);
        }
        else
            this.say(this.holeHits === 1 ? 'Kara delik vuruldu 1/3' : 'Kara delik vuruldu 2/3');
        return true;
    }
    holeSwallow(who) {
        this.hp = Math.max(1, this.hp - this.maxHp() * 0.02);
        this.holeTrap = who;
        this.hurtFlash = 0.5;
        this.shake = Math.max(this.shake, 10);
        vibrate([100, 50, 200]);
        audio.play('hurt');
        this.say('Kara delik seni yuttu! −%2 can');
        this.onHoleTrap(who);
    }
    /** reklam izlendi: yutulan kurtarılır, delik uzakta yeniden belirir */
    holeRescue() {
        const who = this.holeTrap;
        const h = this.hole;
        this.holeTrap = null;
        if (!who || !h)
            return;
        const c = this.regionCenter(this.region);
        const ang = Math.atan2(c.y - h.y, c.x - h.x);
        const sx = h.x + Math.cos(ang) * 420;
        const sy = h.y + Math.sin(ang) * 420;
        if (who === 'hero') {
            if (this.walkable(sx, sy)) {
                this.px = sx;
                this.py = sy;
            }
            else {
                const rp = this.restPoints()[this.region];
                this.px = rp.x;
                this.py = rp.y + 70;
            }
        }
        if (this.tg) {
            this.tg.x = this.px - 40;
            this.tg.y = this.py + 20;
        }
        this.hole = null;
        this.holeSpawn();
        this.holeGrace = 4;
        this.say(who === 'hero' ? 'Kurtuldun!' : 'Kaplan kurtuldu!');
    }
    /** adaya baştan başla: kamplar yenilenir, kahraman ve kaplan başlangıca döner, delik 20 sn sonra yine gelir */
    holeRestart() {
        const reg = this.region;
        this.holeTrap = null;
        for (const sp of this.getWorld().spawners)
            if (sp.reg === reg && sp.tier !== 'boss' && sp.bridge === undefined && !sp.hard)
                delete this.save.spawn['s' + sp.id];
        this.enemies = [];
        this.projs = [];
        const rp = this.restPoints()[reg];
        this.px = rp.x;
        this.py = rp.y + 70;
        if (this.tg) {
            this.tg.x = this.px - 40;
            this.tg.y = this.py + 20;
        }
        this.hole = null;
        this.holeIsleT = 0;
        this.holeGrace = 0;
        this.hp = Math.max(this.hp, this.maxHp() * 0.5);
        this.say('Ada baştan başladı: kamplar yenilendi');
        this.persist();
        this.onChange();
    }
    drawHole() {
        const h = this.hole;
        if (!h)
            return;
        const c = this.ctx;
        const frozen = this.holeFreeze > 0;
        const R = Game.HOLE_R * (this.holeShrinkT > 0 ? 0.42 : 1) * (frozen || this.holeStill > 0 ? 1 : 1 + 0.04 * Math.sin(this.time * 5));
        const halo = c.createRadialGradient(h.x, h.y, R * 0.6, h.x, h.y, R * 3.2);
        halo.addColorStop(0, frozen ? 'rgba(150,150,150,0.35)' : 'rgba(150,60,255,0.45)');
        halo.addColorStop(1, frozen ? 'rgba(150,150,150,0)' : 'rgba(150,60,255,0)');
        c.fillStyle = halo;
        c.beginPath();
        c.arc(h.x, h.y, R * 3.2, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = frozen ? 'rgba(170,170,170,0.3)' : 'rgba(190,120,255,0.35)';
        c.lineWidth = 2;
        c.setLineDash([8, 10]);
        c.beginPath();
        c.arc(h.x, h.y, 180, 0, Math.PI * 2);
        c.stroke();
        c.setLineDash([]);
        for (let k = 0; k < 3; k++) {
            const a0 = (frozen ? 0 : this.time * 2.2) + (k * Math.PI * 2) / 3;
            c.strokeStyle = frozen ? 'rgba(170,170,170,0.55)' : 'rgba(210,150,255,0.6)';
            c.lineWidth = 4;
            c.beginPath();
            c.arc(h.x, h.y, R * 1.15, a0, a0 + 1.3);
            c.stroke();
        }
        const core = c.createRadialGradient(h.x, h.y, 2, h.x, h.y, R);
        if (frozen) {
            core.addColorStop(0, '#2a2a2a');
            core.addColorStop(0.75, '#3a3a3a');
            core.addColorStop(1, 'rgba(120,120,120,0.9)');
        }
        else {
            core.addColorStop(0, '#000');
            core.addColorStop(0.75, '#0a0014');
            core.addColorStop(1, 'rgba(40,0,80,0.9)');
        }
        c.fillStyle = core;
        c.beginPath();
        c.arc(h.x, h.y, R, 0, Math.PI * 2);
        c.fill();
        if (frozen) {
            c.textAlign = 'center';
            c.textBaseline = 'middle';
            c.font = 'bold ' + Math.round(30 * this.lk()) + 'px sans-serif';
            c.lineWidth = 5;
            c.strokeStyle = '#000';
            c.fillStyle = '#fff';
            const txt = String(Math.ceil(this.holeFreeze));
            c.strokeText(txt, h.x, h.y);
            c.fillText(txt, h.x, h.y);
            c.textBaseline = 'alphabetic';
        }
        else if (this.holeShrinkT > 0 || this.holeStill > 0) {
            c.textAlign = 'center';
            c.font = 'bold ' + Math.round(14 * this.lk()) + 'px sans-serif';
            c.lineWidth = 4;
            c.strokeStyle = '#000';
            c.fillStyle = this.holeStill > 0 ? '#c8ff9a' : '#9aff9a';
            const txt = (this.holeStill > 0 ? '😵 ' : '🍄 ') + Math.ceil(this.holeStill > 0 ? this.holeStill : this.holeShrinkT) + 'sn';
            c.strokeText(txt, h.x, h.y - R - 12);
            c.fillText(txt, h.x, h.y - R - 12);
        }
        else if (this.holeHits > 0) {
            c.textAlign = 'center';
            c.font = 'bold ' + Math.round(14 * this.lk()) + 'px sans-serif';
            c.lineWidth = 4;
            c.strokeStyle = '#000';
            c.fillStyle = '#ffe36b';
            const txt = this.holeHits + '/3';
            c.strokeText(txt, h.x, h.y - R - 12);
            c.fillText(txt, h.x, h.y - R - 12);
        }
    }
    drawAim() {
        const t = this.aimWorld();
        if (!t || !this.archerSel)
            return;
        const c = this.ctx;
        const a = Math.atan2(t.y - (this.py - 10), t.x - this.px);
        // elde arbalet: gövde, yatay yay kolları ve nişan yönünde ok
        c.save();
        c.translate(this.px, this.py - 10);
        c.rotate(a);
        c.strokeStyle = '#6b4423';
        c.lineWidth = 5;
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(-6, 0);
        c.lineTo(26, 0);
        c.stroke();
        c.strokeStyle = '#3b2a1a';
        c.lineWidth = 4;
        c.beginPath();
        c.moveTo(20, -16);
        c.quadraticCurveTo(30, 0, 20, 16);
        c.stroke();
        c.strokeStyle = 'rgba(255,255,255,0.8)';
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(20, -16);
        c.lineTo(8, 0);
        c.lineTo(20, 16);
        c.stroke();
        c.restore();
        c.strokeStyle = this.archerCd > 0 ? 'rgba(255,255,255,0.35)' : 'rgba(255,227,107,0.9)';
        c.lineWidth = 2;
        c.setLineDash([10, 8]);
        c.beginPath();
        c.moveTo(this.px, this.py - 10);
        c.lineTo(this.px + Math.cos(a) * 520, this.py - 10 + Math.sin(a) * 520);
        c.stroke();
        c.setLineDash([]);
        c.beginPath();
        c.arc(t.x, t.y, 14, 0, Math.PI * 2);
        c.stroke();
        c.beginPath();
        c.moveTo(t.x - 20, t.y);
        c.lineTo(t.x + 20, t.y);
        c.moveTo(t.x, t.y - 20);
        c.lineTo(t.x, t.y + 20);
        c.stroke();
    }
    updateFocus(dt) {
        let on = false;
        if (this.dead <= 0) {
            for (const gid of this.snakes.keys()) {
                const head = this.enemies.find((e) => e.seg && e.seg.gid === gid && e.hp > 0);
                if (head && Math.hypot(head.x - this.px, head.y - this.py) < 720) {
                    on = true;
                    break;
                }
            }
        }
        if (on && !this.snakeFight)
            this.say('Dev yılan savaşı! Her şey durdu: yılana odaklan');
        this.snakeFight = on;
        this.focus += ((on ? 1 : 0) - this.focus) * Math.min(1, dt * 2.5);
    }
    /** odak sırasında ekran kenarları kararır (dikkat yılanda) */
    drawFocusVignette() {
        if (this.focus < 0.02)
            return;
        const c = this.ctx;
        const g = c.createRadialGradient(this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.25, this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.75);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, `rgba(5,0,15,${0.6 * this.focus})`);
        c.fillStyle = g;
        c.fillRect(0, 0, this.w, this.h);
    }
    spawnGiant(x, y, reg, nest) {
        const gid = ++this.snakeGid;
        const rr = rng(gid * 7919 + reg);
        const n = Math.min(36, 14 + Math.floor((reg - 3) * 0.9)); // ilerledikçe uzar
        const pw = 1 + 0.1 * (reg - 3); // ilerledikçe güçlenir: can ×pw, hasar ×√pw
        const z = ZONES[reg];
        for (let i = 0; i < n; i++) {
            const f = i === 0 ? 2.4 : i === n - 1 ? 0.5 : 0.55 + rr() * 0.95; // baş en güçlü, kuyruk en zayıf, aradakiler farklı
            const maxHp = SNAKE_SEG_DEF.hp * TIERS.hard.hp * z.scale * f * pw;
            this.enemies.push({
                def: SNAKE_SEG_DEF, tier: 'hard', lv: pw, reg, sp: 700000 + gid, x: x - i * 8, y, hx: x, hy: y, hp: maxHp, maxHp, state: 'chase', hitCd: 0,
                phase: 0, dashT: 0, dvx: 0, dvy: 0, flip: 1, flash: 0, lunge: 0, moving: true, seg: { gid, idx: i, f }, rot: 0,
            });
        }
        this.snakes.set(gid, { reg, trail: [{ x, y }], ang: Math.atan2(y - this.py, x - this.px), ringR: 170, phase: 'chase', tick: 0, hdx: 1, hdy: 0, wrapped: false, age: 0, spit: 1.2, nest });
        this.say('Dev yılan kuleden çıktı!');
        audio.play('roar');
        vibrate([90, 40, 160]);
        this.shake = Math.max(this.shake, 8);
    }
    updateSnakes(dt) {
        this.wrapT = Math.max(0, this.wrapT - dt);
        for (const q of this.snakePending) {
            q.t -= dt;
            if (q.t <= 0)
                this.spawnGiant(q.x, q.y, q.reg, q.nest);
        }
        this.snakePending = this.snakePending.filter((q) => q.t > 0);
        for (const v of this.venoms) {
            v.t -= dt;
            v.x += v.vx * dt;
            v.y += v.vy * dt;
            if (v.t > 0 && Math.hypot(v.x - this.px, v.y - this.py) < 24) {
                v.t = 0;
                if (this.invuln <= 0 && this.flyT <= 0 && this.dead <= 0) {
                    const hit = v.dmg * this.armor() * (1 - Math.min(0.9, this.typedReduction('pierce') / 100)) * DMG_TAKEN;
                    this.hp -= hit;
                    this.hurtFlash = 0.25;
                    this.invuln = 0.35;
                    this.shake = Math.max(this.shake, 4);
                    audio.play('hurt');
                    vibrate(30);
                    this.float(0, 0, '-' + this.fmt(hit) + ' zehir', '#9dff7a');
                    if (this.hp <= 0)
                        this.die();
                }
            }
        }
        this.venoms = this.venoms.filter((v) => v.t > 0);
        for (const [gid, S] of this.snakes) {
            const segs = this.enemies.filter((e) => e.seg && e.seg.gid === gid && e.hp > 0).sort((a, b) => a.seg.idx - b.seg.idx);
            if (!segs.length) {
                this.snakes.delete(gid);
                continue;
            }
            const head = segs[0];
            const dx = this.px - head.x;
            const dy = this.py - head.y;
            const d = Math.hypot(dx, dy) || 1;
            S.age += dt;
            const rage = 1 + Math.min(1, S.age / 60); // zamanla hızlanır ve sertleşir
            if (S.phase === 'chase' && d < 280)
                S.phase = 'coil';
            else if (S.phase === 'coil' && d > 520) {
                S.phase = 'chase';
                S.ringR = 170;
            }
            let tx = this.px;
            let ty = this.py;
            let sp = 140 * rage;
            if (S.phase === 'coil') {
                S.ang += 1.5 * dt * (0.7 + 0.3 * rage);
                S.ringR = Math.max(64, S.ringR - 11 * dt); // halka yavaşça daralır
                tx = this.px + Math.cos(S.ang) * S.ringR;
                ty = this.py + Math.sin(S.ang) * S.ringR;
                sp = 280 * (0.8 + 0.2 * rage);
            }
            S.wrapped = S.phase === 'coil' && S.ringR < 135; // halka kapanana (kahramanı sarana) kadar zırhlıdır
            const hx = tx - head.x;
            const hy = ty - head.y;
            const hd = Math.hypot(hx, hy) || 1;
            const step = Math.min(hd, sp * dt);
            // kıvrılarak ilerler (Snake Shooter gibi dalgalı yol): kavisli hareket, gövde başın izini takip eder
            const lat = S.phase === 'chase' ? Math.sin(S.age * 2.4) * 0.9 : 0;
            let mx = hx / hd + lat * (-hy / hd);
            let my = hy / hd + lat * (hx / hd);
            const ml = Math.hypot(mx, my) || 1;
            mx /= ml;
            my /= ml;
            head.x += mx * step;
            head.y += my * step;
            if (step > 0.01) {
                S.hdx = mx;
                S.hdy = my;
            }
            // uzaktan zehir tükürür (aralıkla; zamanla sıklaşır)
            S.spit -= dt;
            if (S.phase === 'chase' && d > 240 && d < 560 && S.spit <= 0 && this.dead <= 0) {
                S.spit = Math.max(1.2, 3.6 - S.age / 40 - Math.min(1.2, S.reg * 0.03));
                this.venoms.push({ x: head.x, y: head.y, vx: (dx / d) * 320, vy: (dy / d) * 320, t: 2.2, dmg: this.enemyDmg(head) * 0.2 });
                audio.play('cast');
            }
            const last = S.trail[0];
            if (!last || Math.hypot(head.x - last.x, head.y - last.y) > 4) {
                S.trail.unshift({ x: head.x, y: head.y });
                if (S.trail.length > 700)
                    S.trail.length = 700;
            }
            // gövde: baş izini 30 px aralıkla izler (yaşayan bölümler sıkışır)
            const SP = 42; // bölümler birbirine değen boncuklar gibi dizilir
            let acc = 0;
            let need = SP;
            let rank = 1;
            let px0 = head.x;
            let py0 = head.y;
            for (let k = 0; k < S.trail.length && rank < segs.length; k++) {
                const p = S.trail[k];
                const len = Math.hypot(p.x - px0, p.y - py0);
                while (rank < segs.length && acc + len >= need) {
                    const t = len > 0 ? (need - acc) / len : 0;
                    segs[rank].x = px0 + (p.x - px0) * t;
                    segs[rank].y = py0 + (p.y - py0) * t;
                    rank++;
                    need += SP;
                }
                acc += len;
                px0 = p.x;
                py0 = p.y;
            }
            for (; rank < segs.length; rank++) {
                segs[rank].x = px0;
                segs[rank].y = py0;
            }
            segs[0].rot = Math.atan2(S.hdy, S.hdx);
            for (let i = 1; i < segs.length; i++)
                segs[i].rot = Math.atan2(segs[i - 1].y - segs[i].y, segs[i - 1].x - segs[i].x);
            // dev yılana her temas (bölüm gövdesine değmek) azami sağlığın %10'unu götürür; zırh ve seviye etkilemez
            if (this.dead <= 0 && this.invuln <= 0 && this.flyT <= 0) {
                for (const s of segs) {
                    if (Math.hypot(s.x - this.px, s.y - this.py) < this.erad(s) + 14) {
                        const hit = this.maxHp() * 0.1;
                        this.hp -= hit;
                        this.invuln = 0.6;
                        this.hurtFlash = 0.25;
                        this.shake = Math.max(this.shake, 6);
                        audio.play('hurt');
                        vibrate(35);
                        this.float(this.px, this.py - 20, '-' + this.fmt(hit), '#ff6b6b');
                        if (this.hp <= 0) {
                            this.die();
                            return;
                        }
                        break;
                    }
                }
            }
            // sarma: halka daralınca yakındaki bölümler can götürür, kahraman yavaşlar; bölümler vurulunca azalır
            S.tick -= dt;
            if (S.phase === 'coil' && S.ringR < 110 && this.dead <= 0) {
                this.wrapT = 0.4;
                if (S.tick <= 0) {
                    S.tick = 0.5;
                    let dmg = 0;
                    for (const s of segs)
                        if (Math.hypot(s.x - this.px, s.y - this.py) < 130)
                            dmg += this.enemyDmg(s) * 0.12;
                    if (dmg > 0 && this.invuln <= 0 && this.flyT <= 0) {
                        const hit = dmg * this.armor() * (1 - Math.min(0.9, this.typedReduction('pierce') / 100)) * DMG_TAKEN;
                        this.hp -= hit;
                        this.hurtFlash = 0.2;
                        this.shake = Math.max(this.shake, 3);
                        audio.play('hurt');
                        vibrate(25);
                        this.float(this.px, this.py - 20, '-' + this.fmt(hit), '#ff6b6b');
                        if (this.hp <= 0)
                            this.die();
                    }
                }
            }
        }
    }
    /** dev yılanın bir bölümü öldü: sonuncusuysa yılan ölür ve iyi bir ödül düşer */
    snakeSegDied(e) {
        const seg = e.seg;
        if (!seg || this.snakeDone.has(seg.gid))
            return;
        if (this.enemies.some((x) => x.seg && x.seg.gid === seg.gid && x.hp > 0)) {
            // parça koptu: küçük toz ve can, ekran sarsılır; yılan kısalır
            const d = Math.max(1, Math.round(2 * (1 + e.reg / 10)));
            this.save.dust += d;
            this.hp = Math.min(this.maxHp(), this.hp + this.maxHp() * 0.02);
            this.shake = Math.max(this.shake, 5);
            this.floaters.push({ x: e.x, y: e.y - 20, t: 0.9, text: '+' + d, color: '#ffd1f0' });
            audio.play('beastdie');
            return;
        }
        this.snakeDone.add(seg.gid);
        const q = this.snakeQueue.get(this.snakes.get(seg.gid)?.nest ?? -1);
        if (q && q.left > 0) {
            q.left--;
            this.snakePending.push({ t: 2.5, x: q.x, y: q.y, reg: q.reg, nest: this.snakes.get(seg.gid)?.nest ?? -1 });
        }
        const tigerHelped = this.enemies.some((x) => x.seg && x.seg.gid === seg.gid && x.tg);
        // dev yılan büyük ödül verir: bol jeod/toz/ruh, destansı eşyalar ve (her kule için ilk yenişte) kalıcı güç artışı
        const nest = this.snakes.get(seg.gid)?.nest ?? -1;
        const ess = this.soupYield(24 * 3.6e6);
        const dust = Math.round(60 * (1 + e.reg / 10));
        this.save.geodes += 8;
        this.save.dust += dust;
        this.save.essence += ess;
        this.gain('+8 Jeod', '#7dffb0', 'icon_geode');
        this.gain('+' + dust + ' Toz', '#ffd1f0', 'ui_dust');
        this.gain('+' + this.fmt(ess) + ' Ruh', '#8fdcff', 'ui_soul');
        this.gainItem('helmet', 3);
        this.gainItem('shield', 3);
        this.gainItem('helmet', 2);
        this.gainItem('shield', 2);
        this.gainTigerItem(3);
        this.gainTigerItem(2);
        const firstSnake = nest >= 0 && !this.save.first['sn' + nest];
        if (firstSnake) {
            this.save.first['sn' + nest] = 1;
            const before = this.fullPower();
            const f = Math.max(this.grantFraction(e.reg, 8), 0.08); // en az +%8 can ve hasar (kalıcı)
            this.addPerm('elite.hp', f * this.hpPool());
            this.addPerm('elite.dmg', f * this.dmgPool());
            this.hp = this.maxHp();
            const gain = this.fullPower() - before;
            if (gain > 0)
                this.gain('+' + this.fmt(gain) + ' Güç (kalıcı, dev yılan)', '#ffe36b', 'ui_power');
        }
        if (tigerHelped) {
            this.tigerCredit(LEVEL_KILLS);
            this.save.tiger.frac = Math.min(1, this.save.tiger.frac + 0.5);
        } // kaplan dev yılanı yenmeye katıldıysa bir seviye atlar, +50 sağlık
        this.say('Dev yılan öldü! Büyük ödül');
        audio.play('beastdie');
        vibrate([120, 60, 240]);
        this.shake = Math.max(this.shake, 12);
        this.snakes.delete(seg.gid);
        this.persist();
        this.onChange();
    }
    drawVenoms() {
        const c = this.ctx;
        for (const v of this.venoms) {
            const g = c.createRadialGradient(v.x, v.y, 2, v.x, v.y, 20);
            g.addColorStop(0, 'rgba(230,255,200,0.95)');
            g.addColorStop(0.5, 'rgba(110,230,80,0.6)');
            g.addColorStop(1, 'rgba(110,230,80,0)');
            c.fillStyle = g;
            c.beginPath();
            c.arc(v.x, v.y, 20, 0, Math.PI * 2);
            c.fill();
        }
    }
    drawSegment(e) {
        const seg = e.seg;
        if (!seg)
            return;
        const c = this.ctx;
        let lo = 99;
        let hi = -1;
        for (const x of this.enemies)
            if (x.seg && x.seg.gid === seg.gid && x.hp > 0) {
                lo = Math.min(lo, x.seg.idx);
                hi = Math.max(hi, x.seg.idx);
            }
        const role = seg.idx === lo ? 'head' : seg.idx === hi ? 'tail' : 'body';
        const size = role === 'head' ? 90 : role === 'tail' ? 60 : 48 + seg.f * 12;
        c.fillStyle = 'rgba(0,0,0,0.25)';
        c.beginPath();
        c.ellipse(e.x, e.y + 8, size * 0.38, size * 0.16, 0, 0, Math.PI * 2);
        c.fill();
        c.save();
        if (e.flash > 0 && 'filter' in c)
            c.filter = 'brightness(2.2) saturate(0.6)';
        if (!this.drawSpr('snake_' + role, e.x, e.y, size, e.rot ?? 0)) {
            c.fillStyle = role === 'head' ? '#2f9f58' : '#3fbf6a';
            c.beginPath();
            c.arc(e.x, e.y, size * 0.36, 0, Math.PI * 2);
            c.fill();
            c.strokeStyle = '#7b3fb0';
            c.lineWidth = 3;
            c.stroke();
            if (role === 'head') {
                c.fillStyle = '#ff4a4a';
                c.fillRect(e.x - 6, e.y - 5, 4, 4);
                c.fillRect(e.x + 2, e.y - 5, 4, 4);
            }
        }
        c.restore();
        const shielded = !this.snakeWrapped(e);
        if (shielded) {
            c.strokeStyle = 'rgba(200,170,255,0.85)';
            c.lineWidth = 3;
            c.beginPath();
            c.arc(e.x, e.y, size * 0.46 + Math.sin(this.time * 6) * 2, 0, Math.PI * 2);
            c.stroke();
        }
        const r = size * 0.4;
        // bölümün dayanıklılığı: üzerinde büyük sayı; kalan cana göre yeşilden kırmızıya
        const hf = Math.max(0, e.hp) / e.maxHp;
        const num = this.fmt(Math.max(1, e.hp));
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.font = `bold ${Math.round(Math.max(11, size * (num.length > 5 ? 0.24 : 0.3)) * this.lk())}px sans-serif`;
        c.lineWidth = 4;
        c.strokeStyle = 'rgba(0,0,0,0.85)';
        c.fillStyle = hf <= 0.3 ? '#ff8a8a' : hf <= 0.6 ? '#ffe36b' : '#ffffff';
        const ny = e.y + (role === 'head' ? size * 0.08 : 0);
        c.strokeText(num, e.x, ny);
        c.fillText(num, e.x, ny);
        c.textBaseline = 'alphabetic';
        c.lineWidth = 3;
        c.strokeStyle = 'rgba(0,0,0,0.7)';
        c.font = 'bold ' + Math.round(13 * this.lk()) + 'px sans-serif';
        if (role === 'head') {
            const lab = T(shielded ? 'ZIRHLI — sarmasını bekle' : 'DEV YILAN');
            c.fillStyle = shielded ? '#c8b6ff' : '#ffb347';
            c.strokeText(lab, e.x, e.y - r - 26);
            c.fillText(lab, e.x, e.y - r - 26);
        }
    }
    /** bu seviye (ada) için kaplan bedeli ödendi mi (ya da ücretsiz mi) */
    tigerPaid(reg = this.region) { return this.save.tiger.paid.includes(reg); }
    tigerEnterRegion(reg) {
        const t = this.save.tiger;
        if (!settings.companion || !t.asked || t.paid.includes(reg))
            return;
        if (reg < Game.TIGER_FREE_ISLANDS) {
            t.paid.push(reg);
            this.persist();
            return;
        }
        if (this.save.dust >= LEVEL_COST) {
            this.save.dust -= LEVEL_COST;
            t.paid.push(reg);
            this.gain('Kaplan için ruh tozu −' + LEVEL_COST, '#ffd1f0', 'ui_dust');
            this.float(this.px, this.py - 50, '−' + LEVEL_COST + ' toz', '#ffd1f0');
        }
        else {
            settings.companion = false;
            settingsChanged();
            this.say('Ruh tozu yetmedi: kaplan kapatıldı');
        }
        this.persist();
        this.onChange();
    }
    /** ilk açılış sorusunun cevabı: kullanılsın mı; bulunulan seviye ücretsizdir */
    answerTiger(use) {
        const t = this.save.tiger;
        t.asked = true;
        if (!t.paid.includes(this.region))
            t.paid.push(this.region);
        settings.companion = use;
        settingsChanged();
        this.persist();
        this.onChange();
    }
    /** kaplanı aç/kapat; açarken bu seviye ödenmemişse 40 ruh tozu gerekir ('ok' ya da hata metni döner) */
    setCompanion(on) {
        const t = this.save.tiger;
        if (!on) {
            settings.companion = false;
            settingsChanged();
            this.onChange();
            return 'ok';
        }
        if (!t.paid.includes(this.region) && this.region < Game.TIGER_FREE_ISLANDS)
            t.paid.push(this.region); // ilk 10 ada ücretsiz
        if (!t.paid.includes(this.region)) {
            if (this.save.dust < LEVEL_COST)
                return 'Ruh tozu yetmiyor (40)';
            this.save.dust -= LEVEL_COST;
            t.paid.push(this.region);
            this.gain('Kaplan için ruh tozu −' + LEVEL_COST, '#ffd1f0', 'ui_dust');
        }
        settings.companion = true;
        settingsChanged();
        this.persist();
        this.onChange();
        return 'ok';
    }
    /** ilk kez ana karakterin %80'i ile başlar; sonra kendi seviyesiyle büyür (her 12 öldürmede ×1.07) */
    tigerInit() {
        const t = this.save.tiger;
        if (t.hpBase > 0 && t.dpsBase > 0)
            return;
        t.hpBase = TIGER_POWER * this.maxHp();
        t.dpsBase = TIGER_POWER * Math.max(1, this.dps());
    }
    /** yara: güç, seviyesinin en çok %40'ına kadar düşer */
    tigerWound() { return WOUND_FLOOR + (1 - WOUND_FLOOR) * this.save.tiger.frac; }
    /** kaplanın ham can ve hasarı (eşya bonuslu, taban çarpansız) */
    tigerRawHp() { this.tigerInit(); return this.save.tiger.hpBase * (1 + tigerBonus(this.save.tiger, 'helm') / 100); }
    tigerRawDps() { this.tigerInit(); return this.save.tiger.dpsBase * (1 + tigerBonus(this.save.tiger, 'fang') / 100); }
    /** kaplanın gücü ana karakterin %80'inin altına düşmez: gerekiyorsa can ve hasar birlikte yükseltilir (güç = √(can × hasar)) */
    tigerFloor() {
        const eff = Math.sqrt(this.tigerRawHp() * Math.max(1, this.tigerRawDps())) * 10 * this.tigerWound();
        const want = 0.8 * (this.fullPower() / this.brewPowerMul()); // kahramanın iksirsiz gücüne göre; iksir çarpanı kaplana ayrıca uygulanır
        return eff > 0 && eff < want ? want / eff : 1;
    }
    tigerMaxHp() { return this.tigerRawHp() * this.tigerFloor() * this.brewTigerPower() * this.gemTigerMul(); }
    tigerDps() { return this.tigerRawDps() * this.tigerFloor() * this.tigerWound() * this.brewTigerPower() * this.gemTigerMul(); }
    /** ruh tozuyla iyileştirme bedeli: yara ne kadar derinse o kadar */
    tigerHealCost() { return Math.max(1, Math.ceil((1 - this.save.tiger.frac) * (2 + this.bossesDown() / 4))); }
    healTiger() {
        const t = this.save.tiger;
        if (t.frac >= 0.99)
            return 'Kaplan sağlıklı';
        const cost = this.tigerHealCost();
        if (this.save.dust < cost)
            return 'Toz yetmiyor';
        this.save.dust -= cost;
        t.frac = 1;
        audio.play('heal');
        this.say('Kaplan iyileşti');
        this.persist();
        this.onChange();
        return 'ok';
    }
    /** kaplan öldürdüğü her düşmandan sağlık kazanır: kolay +5, orta +10, zor/elit/muhafız +20, boss/canavar +50 (dev yılan bölümü +10) */
    tigerKillHeal(e) {
        const pts = e.beast || e.hard || e.tier === 'boss' ? 50 : e.seg ? 10 : e.tier === 'hard' || e.tier === 'elite' || e.tier === 'knight' ? 20 : e.tier === 'medium' ? 10 : 5;
        const t = this.save.tiger;
        t.frac = Math.min(1, t.frac + pts / 100);
        this.float(0, 0, '+' + pts + ' Kaplan sağlığı', '#8fe8ff');
    }
    /** kaplanın vurduğu bir düşman öldü: her 12'de bir kaplan seviye atlar */
    tigerCredit(weight = 1) {
        const t = this.save.tiger;
        t.kills += weight;
        while (t.kills >= LEVEL_KILLS) {
            t.kills -= LEVEL_KILLS;
            t.level++;
            t.hpBase *= LEVEL_GROWTH;
            t.dpsBase *= LEVEL_GROWTH;
            t.energy = Math.min(ENERGY_MAX, t.energy + 300); // seviye atlayınca +5 dk enerji
            this.gain('Kaplan seviye atladı: sv.' + t.level, '#8fe8ff', 'ui_power');
            audio.play('chest');
        }
    }
    tigerInterval() { return 0.6 / (1 + tigerBonus(this.save.tiger, 'claw') / 100); }
    /** güç = √(can × saniyelik hasar) × 10: ana karakterin %80'i, eşyalarla biraz fazlası */
    tigerPower() { return Math.floor(Math.sqrt(this.tigerMaxHp() * this.tigerWound() * Math.max(1, this.tigerDps())) * 10); }
    tigerDown() { return !!this.tg && this.tg.down; }
    /** ana karakter iyileşirken kaplan da aynı oranda iyileşir (can oranı ortak yenilenir) */
    tigerHeal(frac) {
        const t = this.save.tiger;
        // ana karakterle aynı hızda (aynı oranda) yenilenir ama yalnızca %75'e kadar; gerisi ruh tozuyla iyileştirilir
        if (t.frac < TIGER_REGEN_CAP)
            t.frac = Math.min(TIGER_REGEN_CAP, t.frac + frac);
    }
    /** bir porsiyon: ruh + toz harcar, 10 dk saldırı enerjisi verir */
    feedCost() { return { souls: Math.max(30, this.soupYield(0.4 * 3.6e6)), dust: 1 + Math.floor(this.bossesDown() / 8) }; }
    feedTiger() {
        const t = this.save.tiger;
        const c = this.feedCost();
        if (t.energy >= ENERGY_MAX - 1)
            return 'Enerji dolu';
        if (this.save.essence < c.souls || this.save.dust < c.dust)
            return 'Ruh ya da toz yetmiyor';
        this.save.essence -= c.souls;
        this.save.dust -= c.dust;
        t.energy = Math.min(ENERGY_MAX, t.energy + FEED_SECONDS);
        t.feeds++;
        audio.play('heal');
        this.say('Kaplan beslendi: +10 dk enerji');
        this.persist();
        this.onChange();
        return 'ok';
    }
    updateTiger(dt) {
        if (!settings.companion) {
            this.tg = null;
            return;
        }
        const t = this.save.tiger;
        if (!this.tg)
            this.tg = { x: this.px - 50, y: this.py + 20, face: 1, atkT: 0, cd: 0.5, inv: 0, flash: 0, t: 0, moving: false, down: t.frac <= 0, dry: false };
        const g = this.tg;
        g.t += dt;
        g.cd = Math.max(0, g.cd - dt);
        g.inv = Math.max(0, g.inv - dt);
        g.flash = Math.max(0, g.flash - dt);
        g.atkT = Math.max(0, g.atkT - dt);
        g.moving = false;
        if (Math.hypot(g.x - this.px, g.y - this.py) > 1000) {
            g.x = this.px - 40;
            g.y = this.py + 20;
        }
        // hedef: ekrandaki en yakın canlı düşman
        let target = null;
        let tHouse = null;
        let td = 650;
        const houses = this.bossHouses();
        for (const e of this.enemies) {
            if (e.hp <= 0 || !this.visible(e.x, e.y))
                continue;
            if (e.seg && !this.snakeWrapped(e))
                continue; // zırhlı yılana vurmak boşa; saran yılana saldırır
            if (this.snakeFight && !e.seg)
                continue; // yılan savaşında kaplan yalnız yılana saldırır
            // ada bosslarının kendisine değil evlerine saldırır (ev vuruşları bossa %60 zarar verir)
            const hs = e.tier === 'boss' ? houses.find((s) => s.id === e.sp) : undefined;
            const cand = hs ? { ...e, x: hs.x, y: hs.y } : e;
            const d = Math.hypot(cand.x - g.x, cand.y - g.y) * (e.def.id === 'snake' ? 0.6 : 1); // yılanlara öncelik verir
            if (d < td) {
                td = d;
                target = cand;
                tHouse = hs ?? null;
            }
        }
        const realTarget = target && tHouse ? this.enemies.find((x) => x.sp === tHouse.id) ?? target : target;
        let gx;
        let gy;
        let speed;
        if (target && t.energy > 0) {
            g.dry = false;
            const reach = this.erad(target) + 26;
            const dx = target.x - g.x;
            const dy = target.y - g.y;
            const d = Math.hypot(dx, dy) || 1;
            if (Math.abs(dx) > 4)
                g.face = dx > 0 ? 1 : -1;
            if (d <= reach) {
                gx = g.x;
                gy = g.y;
                speed = 0;
                if (g.cd <= 0) {
                    g.cd = this.tigerInterval();
                    g.atkT = 0.25;
                    t.energy = Math.max(0, t.energy - g.cd * 0.5); // enerji yalnızca vururken azalır
                    audio.play('tigerhit');
                    if (realTarget && !realTarget.tg)
                        realTarget.tgFirst = this.time + 3; // ilk vuruştan sonra 3 sn kaplan yalnız mücadele eder
                    if (realTarget)
                        realTarget.tg = true;
                    if (tHouse)
                        this.hitHouse(tHouse, this.tigerDps() * g.cd, 'cut');
                    else
                        this.hitEnemy(target, this.tigerDps() * g.cd, 'cut'); // saniyelik hasar = tigerDps
                }
            }
            else {
                gx = target.x;
                gy = target.y;
                speed = 250 * this.brewTigerSpeed();
            }
        }
        else {
            if (target && t.energy <= 0 && !g.dry) {
                g.dry = true;
                this.say('Kaplanın enerjisi bitti: besle');
            }
            // ana karakterin yanında takip
            const behind = Math.cos(this.face) >= 0 ? -1 : 1;
            gx = this.px + behind * 62 * Math.max(1, this.brewScale(), this.brewTigerSize() * 0.75);
            gy = this.py + 16;
            speed = Math.min(260, 70 + Math.hypot(gx - g.x, gy - g.y) * 2) * this.brewTigerSpeed();
            if (Math.abs(gx - g.x) > 6)
                g.face = gx > g.x ? 1 : -1;
        }
        const dx = gx - g.x;
        const dy = gy - g.y;
        const d = Math.hypot(dx, dy);
        if (speed > 0 && d > 8) {
            const nx = g.x + (dx / d) * speed * dt;
            const ny = g.y + (dy / d) * speed * dt;
            const gx0 = g.x;
            const gy0 = g.y;
            if (this.walkable(nx, ny, true, true)) {
                g.x = nx;
                g.y = ny;
            }
            else if (this.walkable(nx, g.y, true, true))
                g.x = nx;
            else if (this.walkable(g.x, ny, true, true))
                g.y = ny;
            g.moving = true;
            // takıldıysa (hedefe giden yol suyla kesik, köprüde kaldı): 1,2 sn sonra oyuncunun yanına gelir
            this.tgStuckT = Math.hypot(g.x - gx0, g.y - gy0) < speed * dt * 0.2 ? this.tgStuckT + dt : 0;
            if (this.tgStuckT > 1.2) {
                this.tgStuckT = 0;
                g.x = this.px - 40;
                g.y = this.py + 20;
            }
        }
        else
            this.tgStuckT = 0;
        // düşman teması: kaplan da hasar alır (ana karakterin dayanıklılığının %60'ı kadar yumuşak)
        if (g.inv <= 0) {
            for (const e of this.enemies) {
                if (e.hp <= 0 || e.state === 'return')
                    continue;
                if (Math.hypot(e.x - g.x, e.y - g.y) > this.erad(e) + 16)
                    continue;
                // ana karakterin zırhını ve hasar türü direncini miras alır, üstüne %70 daha az hasar yer
                const hit = this.enemyDmg(e) * this.armor() * (1 - Math.min(0.9, this.typedReduction(e.def.atk) / 100)) * 0.3 * DMG_TAKEN;
                t.frac = Math.max(0, t.frac - hit / this.tigerMaxHp());
                g.inv = 0.8;
                g.flash = 0.2;
                this.float(g.x, g.y - 30, '-' + this.fmt(hit), '#ffb0b0');
                break;
            }
        }
    }
    drawTiger() {
        const g = this.tg;
        if (!g || !settings.companion || this.holeCow?.who === 'tg')
            return; // delik yuttuysa görünmez
        const c = this.ctx;
        const t = this.save.tiger;
        c.fillStyle = 'rgba(0,0,0,0.25)';
        c.beginPath();
        c.ellipse(g.x, g.y + 17, 26.5, 7.8, 0, 0, Math.PI * 2);
        c.fill();
        const has = (n) => !!this.spr(n);
        let frame = 'tiger_walk1';
        if (g.down)
            frame = has('tiger_down1') ? 'tiger_down1' : 'tiger';
        else if (g.atkT > 0 && has('tiger_atk2'))
            frame = g.atkT > 0.12 ? 'tiger_atk2' : 'tiger_atk1';
        else if (g.moving && has('tiger_walk4'))
            frame = 'tiger_walk' + (1 + (Math.floor(g.t * 9) % 4));
        else if (!has('tiger_walk1'))
            frame = 'tiger';
        const bob = g.moving ? -Math.abs(Math.sin(g.t * 10)) * 3 : Math.sin(g.t * 2) * 1;
        if (!this.drawSprX(frame, g.x, g.y - 4, 83.8 * this.brewTigerSize(), { flip: g.face, bob, flash: g.flash > 0, alpha: g.down ? 0.7 : 1 })) {
            c.fillStyle = '#f4f4f4';
            c.beginPath();
            c.ellipse(g.x, g.y, 18, 12, 0, 0, Math.PI * 2);
            c.fill();
            c.fillStyle = '#222';
            c.fillRect(g.x - 10, g.y - 6, 4, 10);
            c.fillRect(g.x + 2, g.y - 6, 4, 10);
        }
        // can çubuğu ve enerji durumu
        c.fillStyle = 'rgba(0,0,0,0.55)';
        c.fillRect(g.x - 23, g.y - 55, 46, 6);
        c.fillStyle = t.frac <= 0.25 ? '#ff7a7a' : '#8fe8ff';
        c.fillRect(g.x - 22, g.y - 54, 44 * Math.max(0, t.frac), 4);
        // gücü üstünde yazar (düşman etiketleri gibi)
        c.font = `bold ${Math.round(12 * this.lk())}px sans-serif`;
        c.textAlign = 'center';
        c.lineWidth = 3;
        c.strokeStyle = 'rgba(0,0,0,0.7)';
        const pt = '⚔ ' + this.fmt(this.tigerPower());
        c.strokeText(pt, g.x, g.y - 59);
        c.fillStyle = '#8fe8ff';
        c.fillText(pt, g.x, g.y - 59);
        if (t.energy <= 0 || g.down) {
            c.font = `bold ${Math.round(11 * this.lk())}px sans-serif`;
            c.fillStyle = '#cfd8ff';
            c.fillText(g.down ? 'Zzz' : T('enerji yok'), g.x, g.y - 73);
        }
    }
    /** kaplanın eşyası düşer (kask, keskin diş, pençe): aynı tür + nadirlik birleşir, en iyisi otomatik kuşanılır */
    gainTigerItem(minRarity = 0) {
        const t = this.save.tiger;
        const w = [60, 25, 10, 4, 1];
        let roll = Math.random() * 100;
        let r = 0;
        for (let i = 0; i < w.length; i++) {
            roll -= w[i];
            if (roll <= 0) {
                r = i;
                break;
            }
        }
        r = Math.max(minRarity, r);
        const type = TIGER_SLOT_LIST[Math.floor(Math.random() * TIGER_SLOT_LIST.length)];
        const slot = TIGER_SLOTS[type];
        const twin = t.items.find((x) => x.type === type && x.rarity === r);
        if (twin) {
            if (twin.level < MAX_TIGER_ITEM_LEVEL)
                twin.level++;
            else
                this.save.dust += 4 * (1 + r);
            this.gain('Kaplan: ' + slot.names[r] + ' birleştirildi (sv.' + twin.level + ')', RARITIES[r].color, slot.icon);
            return;
        }
        const it = { id: t.nextItem++, type, rarity: r, level: 1 };
        t.items.push(it);
        const cur = t.items.find((x) => x.id === t.eq[type]);
        if (!cur || r * 100 + 1 > cur.rarity * 100 + cur.level) {
            t.eq[type] = it.id;
            this.gain('Kaplan: ' + slot.names[r] + ' kuşanıldı', RARITIES[r].color, slot.icon);
        }
        else
            this.gain('Kaplan eşyası bulundu: ' + slot.names[r], RARITIES[r].color, slot.icon);
    }
    tigerEquip(id) {
        const t = this.save.tiger;
        const it = t.items.find((x) => x.id === id);
        if (!it)
            return;
        t.eq[it.type] = t.eq[it.type] === id ? 0 : id;
        this.persist();
        this.onChange();
    }
    tigerSell(id) {
        const t = this.save.tiger;
        const it = t.items.find((x) => x.id === id);
        if (!it)
            return;
        this.save.dust += 4 * (1 + it.rarity) * it.level;
        t.items = t.items.filter((x) => x.id !== id);
        if (t.eq[it.type] === id)
            t.eq[it.type] = 0;
        this.persist();
        this.onChange();
    }
    // ---- eğitim zinciri + günlük görevler ----
    tutorial() { return { i: this.save.tut, step: TUTORIAL[this.save.tut] ?? null }; }
    /** eski oyunlar kapanınca kaşif ve arena görevleri verilmez */
    dailyExclude() { return this.oldGamesClosed() ? ['explorer', 'duel'] : []; }
    dailyRoll() { if (this.save.daily.day !== dayNumber(this.now()))
        this.save.daily = makeDaily(this.now(), this.dailyExclude());
    else
        extendDaily(this.save.daily, this.dailyExclude()); }
    bumpDaily(t, n = 1) {
        this.dailyRoll();
        for (const g of this.save.daily.goals)
            if (g.t === t && g.have < g.need)
                g.have = Math.min(g.need, g.have + n);
    }
    dailyText(t) { return dailyText(t); }
    claimDaily(i) {
        this.dailyRoll();
        const g = this.save.daily.goals[i];
        if (!g || g.claimed || g.have < g.need)
            return false;
        g.claimed = true;
        this.save.geodes += 1;
        this.save.dust += 3;
        this.gain('Günlük görev tamamlandı: +1 jeod, +3 toz', '#7dffb0', 'icon_geode');
        if (this.save.daily.goals.every((x) => x.claimed)) {
            const ess = this.soupYield(3 * 3.6e6);
            this.save.geodes += 2;
            this.save.essence += ess;
            this.say(`Bugünün tüm görevleri bitti! +2 jeod, +${this.fmt(ess)} ruh`);
        }
        audio.play('chest');
        this.persist();
        this.onChange();
        return true;
    }
    questTick(dt) {
        this.questT -= dt;
        if (this.questT > 0)
            return;
        this.questT = 1;
        this.dailyRoll();
        const st = TUTORIAL[this.save.tut];
        if (!st || !st.done(this.save))
            return;
        const r = st.reward;
        if (r.geodes)
            this.save.geodes += r.geodes;
        if (r.essence)
            this.save.essence += r.essence;
        if (r.item)
            this.gainItem('helmet', 2);
        this.save.tut++;
        this.gain('Görev tamamlandı: ' + st.text, '#ffe9a0', 'ui_skill');
        if (r.geodes)
            this.gain('+' + r.geodes + ' Jeod', '#7dffb0', 'icon_geode');
        if (r.essence)
            this.gain('+' + r.essence + ' Ruh', '#8fdcff', 'ui_soul');
        audio.play('chest');
        this.persist();
        this.onChange();
    }
    // ---- düşman koleksiyonu: her 5 yeni tür +2 jeod, her 10'da kalıcı +%1 can ----
    checkCollection() {
        const n = Object.keys(this.save.seen).length;
        while ((this.save.col + 1) * 5 <= n) {
            this.save.col++;
            this.save.geodes += 2;
            this.gain('Koleksiyon ödülü: +2 jeod', '#ffe9a0', 'icon_geode');
            if (this.save.col % 2 === 0) {
                this.addPerm('col.hp', 1);
                this.gain('Koleksiyon: kalıcı +%1 can', '#7bff9a', 'ui_heart');
            }
        }
    }
    /** testçilerden geri bildirim alırken paylaşılacak kısa oyun özeti (kişisel veri içermez) */
    feedbackSummary() {
        const s = this.save;
        const t = this.tutorial();
        return [
            `Hexling ${VERSION} geri bildirim özeti`,
            `Oynama süresi: ${Math.round(s.playSec / 60)} dk · ölüm: ${s.deaths} · öldürme: ${s.kills}`,
            `Aşılan ada: ${this.bossesDown()}/${ZONES.length} · açık ada sınırı: ${this.levelCap()} · güç: ${this.fmt(this.fullPower())}`,
            `Eğitim adımı: ${t.i}/${TUTORIAL.length}${t.step ? ' (' + t.step.text + ')' : ' (bitti)'}`,
            `Ev: kedi ${s.house.pets}x sevildi, ${s.house.feeds}x beslendi, iksir ${s.house.brews}x · seri ${s.house.streak} gün`,
            `Arena: ${Object.keys(s.arena).length}/12 efsane · kıyafet: ${s.outfits.length}`,
        ].join('\n');
    }
    // ---- gardırop (kozmetik + küçük niş bonus) ----
    outfitBonus(key) {
        const o = OUTFITS.find((x) => x.hue === this.save.outfit);
        return o?.bonus?.key === key ? o.bonus.v : 0;
    }
    unlockOutfits() {
        const own = new Set(this.save.outfits);
        const add = (hue) => {
            if (own.has(hue))
                return;
            own.add(hue);
            this.gain('Yeni kıyafet: ' + (OUTFITS.find((o) => o.hue === hue)?.name ?? ''), '#ffd1f0', 'ui_skill');
        };
        if (this.save.bossDown[9])
            add(40);
        if (this.save.bossDown[19])
            add(90);
        if (this.save.house.streak >= 7)
            add(190);
        if (this.save.house.streak >= 30)
            add(350);
        if (this.save.arena.Pelin && this.save.arena['Ayça'])
            add(320);
        if (this.save.weekWon >= 0)
            add(230);
        this.save.outfits = [...own];
    }
    setOutfit(hue) {
        if (!this.save.outfits.includes(hue))
            return false;
        this.save.outfit = hue;
        this.persist();
        this.onChange();
        return true;
    }
    // ---- gölge arenası / haftalık meydan okuma ----
    finishArena(kind, id, won) {
        if (!won)
            return;
        this.bumpDaily('duel');
        if (kind === 'legend') {
            const first = !this.save.arena[id];
            this.save.arena[id] = 1;
            this.save.geodes += first ? 3 : 0;
            this.say(first ? `${id} yenildi! +3 jeod` : `${id} yine yenildi!`);
        }
        else if (kind === 'weekly') {
            const w = weekly(this.now());
            if (this.save.weekWon !== w.week) {
                this.save.weekWon = w.week;
                this.save.geodes += 5;
                this.say('Haftalık meydan okuma kazanıldı! +5 jeod');
            }
            else
                this.say('Bu haftanın ödülünü zaten aldın');
        }
        else {
            const amt = this.soupYield(2 * 3.6e6);
            this.save.essence += amt;
            this.say(`Gölge yenildi! +${this.fmt(amt)} ruh`);
        }
        this.unlockOutfits();
        audio.play('boss');
        this.persist();
        this.onChange();
    }
    /** devam paketi: ücretsiz 40 adanın ötesini açar (tekrar edilirse etkisiz: geri yükleme güvenli) */
    grantLevelPack(id, receipt) {
        const p = LEVEL_PACKS.find((x) => x.id === id);
        if (!p)
            return false;
        if (this.doom || this.save.doom)
            this.endDoom();
        if (!this.save.lvPacks[id]) {
            this.save.lvPacks[id] = 1;
            audio.play('gate');
            vibrate([80, 60, 200]);
            this.gain(p.name + ' etkinleştirildi', '#ffe36b', 'ui_skill');
            this.say('Yeni adalar açıldı! Kapıdan geçebilirsin.');
            for (let i = 0; i < ZONES.length - 1; i++)
                if (this.save.bossDown[i] && i + 1 < this.levelCap() && i + 1 >= this.levelCap() - p.levels) {
                    this.gateAnim = { i, t: 3.6 };
                    break;
                }
            console.info('devam paketi', id, receipt);
            this.persist();
            this.onChange();
        }
        return true;
    }
    /** mağazadan gelen herhangi bir ürün (güç ya da devam paketi) */
    grantPurchase(id, receipt) {
        if (id === ARCHER.id) {
            if (!this.save.archer) {
                this.save.archer = 1;
                this.say('Okçu artık yanında! Sağ alttaki 🏹 ile seç');
                console.info('okçu', receipt);
                this.persist();
                this.onChange();
            }
            return true;
        }
        if (id === SPELL.id) {
            this.save.spells = (this.save.spells ?? 0) + 1;
            this.say('Özel büyü eklendi');
            this.persist();
            this.onChange();
            return true;
        }
        if (id === REBIRTH.id) {
            console.info('yeniden doğuş', receipt);
            return this.rebirth() === '';
        }
        return LEVEL_PACKS.some((x) => x.id === id) ? this.grantLevelPack(id, receipt) : this.grantPack(id, receipt);
    }
    maxHp() {
        return (TEST_LEVEL ? 0.5 : 1) * this.potionMul() * this.brewHpMul() * this.curseMul() * this.shopMul() * this.gemMul() * this.mirrorMul() * (100 + this.perm('normal.hp') + this.perm('elite.hp') + this.perm('tree.hp')) * (1 + 0.2 * this.lv('hp'))
            * (1 + (this.cb('hp') + this.helmetHp() + this.perm('elite.hpPct') + this.perm('train.hp') + this.save.house.hp + this.perm('col.hp')) / 100);
    }
    regen() { return 0.6 * this.lv('regen') + this.cb('regen') + this.helmetRegen() + this.perm('tree.regen') + this.perm('train.regen') + (this.isDwarf() ? 0.006 * this.maxHp() : 0); }
    armor() { return Math.max(0.2, 1 - 0.04 * this.lv('armor')); }
    dmgMul() { return this.testDmgF * this.potionMul() * this.brewDmgMul() * this.curseMul() * this.shopMul() * this.gemMul() * this.mirrorMul() * (1 + 0.12 * this.lv('dmg')) * (1 + (this.cb('dmg') + this.perm('elite.dmgPct') + this.perm('train.dmg') + this.save.house.dmg) / 100); }
    castSpeed() { return 1 + 0.08 * this.lv('spin'); }
    reachMul() { return 1 + 0.06 * this.lv('reach') + this.outfitBonus('reach') / 100; }
    magnet() { return 70 + 25 * this.lv('magnet') + this.cb('magnet') + this.perm('train.magnet'); }
    yieldMul() { return (this.isDwarf() ? 1.25 : 1) * (1 + 0.1 * this.lv('yield')) * (1 + this.cb('yield') / 100) * (1 + this.outfitBonus('yield') / 100); }
    speed() { return 150 * (1 + 0.04 * this.lv('speed')) * (1 + (this.cb('speed') + this.perm('train.speed')) / 100) * (1 + this.outfitBonus('speed') / 100) * (this.flyT > 0 ? 1.35 : 1) * (this.wrapT > 0 ? 0.55 : 1) * this.brewSpeedMul(); }
    critChance() { return Math.min(0.75, (this.cb('crit') + this.perm('train.crit') + this.outfitBonus('crit')) / 100 + (this.isDwarf() ? 0.15 : 0)); }
    lifesteal() { return Math.min(0.5, (this.cb('lifesteal') + this.outfitBonus('lifesteal')) / 100); }
    evasion() { return Math.min(0.6, (this.cb('evasion') + this.outfitBonus('evasion')) / 100 + this.brewEva()); }
    weaponDmg(i) {
        return (WEAPONS[i].baseDmg * (1 + 0.15 * (this.save.weapons[i] - 1)) + this.perm('normal.dmg') + this.perm('elite.dmg')) * this.dmgMul();
    }
    weaponCopies(i) { return 1 + Math.min(3, Math.floor((this.save.weapons[i] - 1) / 5)); }
    zone() { return ZONES[this.region]; }
    /** adanın bossunun düşman türü (kartta vurduğu/zayıf olduğu tür için) */
    bossKind(reg) {
        return this.zoneWorld(reg).spawners.find((x) => x.tier === 'boss' && x.bridge === undefined)?.kind ?? ZONES[reg].enemies[0];
    }
    bossesDown() { return this.save.bossDown.filter(Boolean).length; }
    /** yeniden doğuştan sonra da korunan "aşılan ada" tabanı: yuva sayıları ve gelir buna göre (güç korunsun) */
    bdFloor() { return Math.max(this.bossesDown(), this.save.rebirth?.floor ?? 0); }
    /** kristal yuvası: 2'den başlar, boss'larla 4'e çıkar, her 10 adada bir yenisi eklenir */
    slots() { return Math.min(4, 2 + this.bdFloor()) + Math.floor(this.bdFloor() / 10); }
    weaponSlots() { return Math.min(4, 1 + this.bdFloor() + (this.save.kills >= 25 ? 1 : 0)); }
    chestsOpened(reg = this.region) {
        return this.getWorld().chests.filter((c) => c.reg === reg && this.save.chests.includes(c.id)).length;
    }
    equippedWeapons() {
        return this.save.loadout.filter((i) => this.save.weapons[i] > 0).slice(0, this.weaponSlots());
    }
    toggleWeapon(i) {
        const at = this.save.loadout.indexOf(i);
        if (at >= 0) {
            if (this.save.loadout.length > 1)
                this.save.loadout.splice(at, 1);
            else
                return false;
        }
        else if (this.save.weapons[i] > 0 && this.save.loadout.length < this.weaponSlots())
            this.save.loadout.push(i);
        else
            return false;
        this.persist();
        this.onChange();
        return true;
    }
    autoEquip(i) {
        if (!this.save.loadout.includes(i) && this.save.loadout.length < this.weaponSlots())
            this.save.loadout.push(i);
    }
    /** Güç: kuşanılan büyülerin saniyelik hasarı ile savunma düzeltmeli canın geometrik ortalaması. */
    /** tam canla güç (sıralama için) */
    fullPower() { return this.power(this.maxHp()); }
    /** kuşanılan büyülerin toplam saniyelik hasarı */
    dps() {
        let dps = 0;
        for (const i of this.equippedWeapons())
            dps += (this.weaponDmg(i) * this.weaponCopies(i) * this.castSpeed()) / WEAPONS[i].cooldown;
        return dps;
    }
    power(hpNow = this.hp) {
        const dps = this.dps();
        const red = (this.typedReduction('cut') + this.typedReduction('pierce') + this.typedReduction('smash')) / 3 / 100;
        // can azaldıkça güç de azalır: mevcut can esas alınır
        const effHp = Math.max(1, Math.min(hpNow, this.maxHp())) / (this.armor() * (1 - Math.min(0.9, red)));
        return Math.floor(Math.sqrt(effHp * Math.max(1, dps)) * 10);
    }
    enemyDmg(e) { return e.def.dmg * TIERS[e.tier].dmg * ZONES[e.reg].dmgScale * Math.sqrt(e.lv) * (e.gmul ?? (e.beast ? BEAST_MUL : e.hard ? (e.hmul ?? HARD_BOSS_MUL) : 1)); }
    enemyPower(e) { return Math.floor(Math.sqrt(Math.max(1, e.hp) * (this.enemyDmg(e) / 0.6)) * 10); }
    weakness(e) { return DTYPES.reduce((b, t) => (e.def.resist[t] > e.def.resist[b] ? t : b), DTYPES[0]); }
    statLines() {
        const f = (n) => (n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : n.toFixed(1));
        const out = [
            { label: 'Güç', value: this.fmt(this.power()) },
            { label: 'Azami can', value: f(this.maxHp()) },
            { label: T('Kritik / Can çalma / Kaçınma'), value: `%${(this.critChance() * 100).toFixed(1)} / %${(this.lifesteal() * 100).toFixed(1)} / %${(this.evasion() * 100).toFixed(1)}` },
            { label: 'Yenilenme', value: f(this.regen()) + '/sn' },
            { label: 'Hasar çarpanı', value: '×' + this.dmgMul().toFixed(2) },
            { label: 'Alınan hasar çarpanı', value: '×' + this.armor().toFixed(2) },
        ];
        for (const t of DTYPES)
            out.push({ label: T(DTYPE_NAMES[t]) + ' ' + T('savunması'), value: '%' + this.typedReduction(t).toFixed(1) });
        out.push({ label: 'map.normal_mob', value: `+${f(this.perm('normal.hp'))} ${T('can')}, +${f(this.perm('normal.dmg'))} ${T('hasar')}` });
        out.push({ label: 'map.elite', value: `+${f(this.perm('elite.hp'))} ${T('can')}, +${f(this.perm('elite.dmg'))} ${T('hasar')}` });
        out.push({ label: 'map.tree', value: `+${f(this.perm('tree.hp'))} ${T('can')}, +${f(this.perm('tree.regen'))} ${T('yenilenme')}` });
        return out;
    }
    // ---- satın alma / yükseltme ----
    buyUpgrade(id) {
        const def = UPGRADES.find((u) => u.id === id);
        if (!def)
            return false;
        const lvl = this.lv(id);
        if (lvl >= def.max)
            return false;
        if (def.requires && this.lv(def.requires) < 1)
            return false;
        const cost = upgradeCost(def, lvl);
        if (this.save.essence < cost)
            return false;
        this.save.essence -= cost;
        this.save.upgrades[id] = lvl + 1;
        this.persist();
        this.onChange();
        return true;
    }
    weaponNeed(i) {
        return this.save.weapons[i] === 0 ? WEAPONS[i].unlockCopies : weaponLevelCopies(this.save.weapons[i]);
    }
    upgradeWeapon(i) {
        const lvl = this.save.weapons[i];
        const need = this.weaponNeed(i);
        if (lvl >= MAX_WEAPON_LEVEL || this.save.copies[i] < need)
            return false;
        this.save.copies[i] -= need;
        this.save.weapons[i] = lvl + 1;
        if (lvl === 0)
            this.autoEquip(i);
        this.persist();
        this.onChange();
        return true;
    }
    /** hangi paneller için yapılabilecek bir geliştirme var (oyunu kesmeyen "buraya tıkla" uyarısı için) */
    upgradeHints() {
        const s = this.save;
        const tree = UPGRADES.some((u) => {
            const l = this.lv(u.id);
            return l < u.max && (!u.requires || this.lv(u.requires) >= 1) && s.essence >= upgradeCost(u, l);
        });
        // yalnızca kullanılan (takılı) eşyalar için öneri: takılı olmayan büyü/ekipman/kristal geliştirme ipucu vermez; yeni büyü açmak serbest
        const weapons = WEAPONS.some((_, i) => s.weapons[i] < MAX_WEAPON_LEVEL && s.copies[i] >= this.weaponNeed(i) && (s.weapons[i] === 0 || s.loadout.includes(i)));
        const gear = s.items.some((it) => this.isWorn(it.id) && it.level < MAX_ITEM_LEVEL && s.essence >= itemUpgradeCost(it.level, it.rarity));
        const crystals = s.geodes >= 1 || (s.crystals.length > s.equipped.length && s.equipped.length < this.slots())
            || s.crystals.some((c) => s.equipped.includes(c.id) && c.enchant < MAX_ENCHANT && s.dust >= enchantCost(c.enchant));
        return { tree, weapons, gear, crystals };
    }
    // ---- kristaller ----
    openGeode() {
        if (this.save.geodes < 1)
            return null;
        this.save.geodes--;
        this.bumpDaily('geodes');
        const total = RARITIES.reduce((s, r) => s + r.w, 0);
        let roll = Math.random() * total;
        let rarity = 0;
        for (let i = 0; i < RARITIES.length; i++) {
            roll -= RARITIES[i].w;
            if (roll <= 0) {
                rarity = i;
                break;
            }
        }
        const c = {
            id: this.save.nextCrystal++, rarity, stat: CSTAT_KEYS[Math.floor(Math.random() * CSTAT_KEYS.length)], enchant: 0,
        };
        this.save.crystals.push(c);
        // aynı türden kristal varsa otomatik birleşir (+1 gelişim)
        if (Game.mergeCrystals(this.save) > 0) {
            this.say('Aynı tür kristal birleştirildi: gelişim arttı');
            this.hp = Math.min(this.hp, this.maxHp());
            this.persist();
            this.onChange();
            return this.save.crystals.find((x) => x.stat === c.stat && x.rarity === c.rarity) ?? c;
        }
        this.persist();
        this.onChange();
        return c;
    }
    // ---- özel büyü: kazanda hazırlanır, maden dışında her an kullanılır ----
    /** ilk arı sürüsünden bir önceki adada açılır; açılırken 2 adet hazır verilir */
    spellUnlockReg() { return Math.max(0, Math.min(...this.swarmRegs()) - 1); }
    spellStock() { return this.save.spells ?? 0; }
    /** bileşenler: 3 jeod + toz + ruh (ilerledikçe artar) */
    spellCost() {
        return { geodes: 3, dust: Math.round(25 * (1 + this.bdFloor() / 12)), essence: Math.max(50, this.soupYield(2 * 3.6e6)) };
    }
    spellCanCraft() {
        const c = this.spellCost();
        return !!this.save.spellOn && this.save.geodes >= c.geodes && this.save.dust >= c.dust && this.save.essence >= c.essence;
    }
    craftSpell() {
        if (!this.spellCanCraft())
            return false;
        const c = this.spellCost();
        this.save.geodes -= c.geodes;
        this.save.dust -= c.dust;
        this.save.essence -= c.essence;
        this.save.spells = this.spellStock() + 1;
        audio.play('chest');
        this.say('Özel büyü hazırlandı');
        this.persist();
        this.onChange();
        return true;
    }
    tickSpellUnlock() {
        if (this.save.spellOn || this.region < this.spellUnlockReg())
            return;
        this.save.spellOn = true;
        this.save.spells = this.spellStock() + 2;
        this.say('Özel büyü açıldı: 2 adet hazır!');
        audio.play('boss');
        this.narrate('spell');
        this.persist();
        this.onChange();
    }
    /** özel büyü ikinci aşaması: adadaki bütün sandıklar bulunup açılır, bulunan en iyi eşyalar anında kuşanılır */
    tickSpellFinish(dt) {
        if (this.spellFinishT <= 0)
            return;
        this.spellFinishT -= dt;
        if (this.spellFinishT > 0)
            return;
        const reg = this.region;
        let n = 0;
        for (const c of this.getWorld().chests)
            if (c.reg === reg && !this.save.chests.includes(c.id)) {
                this.openChest(c);
                n++;
            }
        const eq = this.autoEquipBest();
        if (n)
            this.gain(n + ' sandık bulundu ve açıldı', '#ffd84a', 'icon_geode');
        if (eq)
            this.gain('En iyi eşyalar kuşanıldı', '#7bff9a', 'ui_gear');
        this.persist();
        this.onChange();
    }
    /** her türün en iyi eşyasını (nadirlik, seviye) takar; ekstra yuvalara kalanların en iyilerini koyar; kaplan eşyaları için de aynısı */
    autoEquipBest() {
        const s = this.save;
        let changed = false;
        const better = (a, b) => b.rarity - a.rarity || b.level - a.level;
        for (const type of ['helmet', 'shield']) {
            const list = s.items.filter((i) => i.type === type).sort(better);
            if (list.length && s.eq[type] !== list[0].id) {
                s.eq[type] = list[0].id;
                changed = true;
            }
        }
        const used = new Set([s.eq.helmet, s.eq.shield]);
        const ex = s.items.filter((i) => !used.has(i.id)).sort(better).slice(0, this.extraSlots()).map((i) => i.id);
        if (ex.join(',') !== s.extra.join(',')) {
            s.extra = ex;
            changed = true;
        }
        const tg = s.tiger;
        for (const slot of ['helm', 'fang', 'claw']) {
            const list = tg.items.filter((i) => i.type === slot).sort(better);
            if (list.length && tg.eq[slot] !== list[0].id) {
                tg.eq[slot] = list[0].id;
                changed = true;
            }
        }
        if (changed)
            this.hp = Math.min(this.hp, this.maxHp());
        return changed;
    }
    castSpell() {
        if (!this.save.spellOn)
            return 'Özel büyü henüz açılmadı';
        if (this.spellStock() <= 0)
            return 'Özel büyü stoğun yok';
        if (this.dead > 0 || this.novaT > 0 || this.doom)
            return 'Şu an yapılamaz';
        this.save.spells = this.spellStock() - 1;
        const reg = this.region;
        const strong = (e) => e.tier === 'boss' || !!e.beast || !!e.hard || !!e.seg;
        let cleared = 0;
        let weakened = 0;
        // köprü bekçileri/bossu başka adanın kaydında olabilir: bulunulan adanın köprüleri de kapsanır
        const near = (r, bridge) => r === reg || (bridge !== undefined && (bridge === reg || bridge === reg - 1));
        // boss ve canavarlar: güç %80 düşer (can ve hasar x0,2)
        for (const e of this.enemies) {
            if (e.hp <= 0 || !strong(e) || !near(e.reg, this.spawnerMap.get(e.sp)?.bridge))
                continue;
            e.hp *= 0.2;
            e.lv *= 0.04; // hasar ∝ √lv
            e.flash = 0.6;
            weakened++;
        }
        // kamplar: %80'i tamamen temizlenir (yüklü olanlar anında ölür, uzaktakiler doğrudan tamamlanır)
        const world = this.getWorld();
        const liveIds = new Set(this.enemies.filter((e) => e.hp > 0).map((e) => e.sp));
        for (const sp of world.spawners) {
            if (!near(sp.reg, sp.bridge) || this.spCleared(sp) || this.bossSealed(sp))
                continue;
            // henüz sahaya çıkmamış boss/canavar/zor boss: doğduğunda zayıflamış doğar
            if ((sp.tier === 'boss' || sp.beast || sp.hard) && !liveIds.has(sp.id) && !this.hardHidden(sp)) {
                this.spellWeak.add(sp.id);
                weakened++;
                continue;
            }
            if (sp.tier === 'boss' || sp.hard)
                continue;
            if (Math.random() >= 0.8)
                continue;
            const live = this.enemies.filter((e) => e.sp === sp.id && e.hp > 0);
            if (live.length) {
                for (const e of live) {
                    e.hp = 0;
                    cleared++;
                }
            }
            else {
                this.completeSpawner(sp.id);
                cleared += TIERS[sp.tier].count;
            }
        }
        // kule, ev ve kırılabilir kayalar: %80'i yıkılır (normal yıkım ödülleri verilir)
        let broken = 0;
        for (const o of this.liveBlds()) {
            if (Math.floor(o.id / 100) !== reg || Math.random() >= 0.8)
                continue;
            this.hitBld(o, this.bldHp.get(o.id) ?? this.bldMaxHp(o));
            broken++;
        }
        // bonus tur ve arı sürüsü düşmanları: %80'i ölür
        for (const e of this.enemies)
            if ((e.sp === BONUS_SP || e.sp === BEE_SP) && e.hp > 0 && Math.random() < 0.8) {
                e.hp = 0;
                cleared++;
            }
        this.novaT = Game.NOVA_SEC;
        this.spellFinishT = 0.9; // kamplar ölünce sandıklar açılır ve eşyalar kuşanılır
        this.shake = Math.max(this.shake, 14);
        audio.play('boss');
        vibrate([120, 60, 240]);
        this.say('ÖZEL BÜYÜ! Adanın %80\'i temizlendi, boss ve canavarların gücü %80 düştü');
        if (broken)
            this.gain(broken + ' kule, ev ve kaya yıkıldı', '#ffb36b', 'ui_power');
        this.gain(cleared + ' düşman temizlendi' + (weakened ? ' · ' + weakened + ' güçlü düşman %80 zayıfladı' : ''), '#ffe36b', 'ui_power');
        this.persist();
        this.onChange();
        return '';
    }
    drawNova() {
        if (this.novaT <= 0)
            return;
        const c = this.ctx;
        const k = 1 - this.novaT / Game.NOVA_SEC; // 0 -> 1
        const cx = this.w / 2;
        const cy = this.h / 2;
        const R = Math.max(this.w, this.h) * 1.15 * Math.min(1, k * 1.4);
        c.save();
        // mor-altın sis ve ilk parlama
        c.fillStyle = 'rgba(70,30,140,' + (0.28 * Math.sin(Math.min(1, k * 1.2) * Math.PI)) + ')';
        c.fillRect(0, 0, this.w, this.h);
        c.globalCompositeOperation = 'lighter';
        if (k < 0.18) {
            c.fillStyle = 'rgba(255,245,200,' + (0.6 * (1 - k / 0.18)) + ')';
            c.fillRect(0, 0, this.w, this.h);
        }
        // iki dalga halkası
        for (let w = 0; w < 2; w++) {
            const kk = Math.max(0, Math.min(1, (k - w * 0.12) * 1.5));
            if (kk <= 0 || kk >= 1)
                continue;
            const r = R * kk;
            const g = c.createRadialGradient(cx, cy, Math.max(1, r * 0.8), cx, cy, r + 28);
            g.addColorStop(0, 'rgba(255,225,120,0)');
            g.addColorStop(0.55, 'rgba(255,240,190,' + (0.85 * (1 - kk)) + ')');
            g.addColorStop(1, 'rgba(180,120,255,0)');
            c.fillStyle = g;
            c.beginPath();
            c.arc(cx, cy, r + 28, 0, Math.PI * 2);
            c.fill();
            c.strokeStyle = 'rgba(255,255,255,' + (0.8 * (1 - kk)) + ')';
            c.lineWidth = 5 * (1 - kk) + 1;
            c.beginPath();
            c.arc(cx, cy, r, 0, Math.PI * 2);
            c.stroke();
        }
        // merkezden saçılan yıldız ışıltıları ve ışık huzmeleri
        for (let i = 0; i < 80; i++) {
            const ang = i * 2.399 + this.time * 0.6;
            const dist = R * Math.min(1, k * 1.4) * (0.15 + ((i * 37) % 100) / 118);
            const x = cx + Math.cos(ang) * dist;
            const y = cy + Math.sin(ang) * dist;
            const tw = 0.5 + 0.5 * Math.sin(this.time * 14 + i);
            const a = Math.max(0, 1 - k) * tw;
            c.fillStyle = (i % 3 === 0 ? 'rgba(255,230,140,' : i % 3 === 1 ? 'rgba(200,170,255,' : 'rgba(255,255,255,') + a + ')';
            const sz = 2 + (i % 4);
            c.fillRect(x - sz / 2, y - sz / 2, sz, sz);
            if (i % 5 === 0) {
                c.strokeStyle = 'rgba(255,240,200,' + a * 0.6 + ')';
                c.lineWidth = 1.5;
                c.beginPath();
                c.moveTo(x - sz * 3, y);
                c.lineTo(x + sz * 3, y);
                c.moveTo(x, y - sz * 3);
                c.lineTo(x, y + sz * 3);
                c.stroke();
            }
        }
        for (let i = 0; i < 12; i++) {
            const ang = (i / 12) * Math.PI * 2 + k * 1.2;
            c.strokeStyle = 'rgba(255,235,170,' + 0.35 * (1 - k) + ')';
            c.lineWidth = 3;
            c.beginPath();
            c.moveTo(cx + Math.cos(ang) * R * 0.2, cy + Math.sin(ang) * R * 0.2);
            c.lineTo(cx + Math.cos(ang) * R * 0.9, cy + Math.sin(ang) * R * 0.9);
            c.stroke();
        }
        c.restore();
        // "özel büyü çalışıyor" yazısı
        c.save();
        c.textAlign = 'center';
        const pulse = 1 + 0.06 * Math.sin(this.time * 10);
        const fs = Math.round(24 * this.lk() * pulse);
        c.font = '900 ' + fs + 'px sans-serif';
        c.lineWidth = 6;
        c.strokeStyle = 'rgba(40,10,80,0.9)';
        const txt = '✨ ' + T('ÖZEL BÜYÜ ÇALIŞIYOR') + ' ✨';
        const ty = this.h * 0.22;
        c.strokeText(txt, cx, ty);
        const tg = c.createLinearGradient(0, ty - fs, 0, ty + 6);
        tg.addColorStop(0, '#fff6b0');
        tg.addColorStop(1, '#ffb02a');
        c.fillStyle = tg;
        c.globalAlpha = Math.min(1, this.novaT / 0.6);
        c.fillText(txt, cx, ty);
        c.restore();
    }
    // ---- oto kristal ----
    autoCrystal() { return !!this.save.autoCrystal; }
    setAutoCrystal(on) {
        this.save.autoCrystal = on;
        this.autoCrystalT = 0;
        if (on)
            this.runAutoCrystal();
        this.persist();
        this.onChange();
    }
    tickAutoCrystal(dt) {
        if (!this.save.autoCrystal)
            return;
        this.autoCrystalT -= dt;
        if (this.autoCrystalT > 0)
            return;
        this.autoCrystalT = 1.5;
        this.runAutoCrystal();
    }
    /** kristalin gücü: nadirlik çarpanı x gelişim; eşitlikte can, hasar ve kritik öne geçer */
    crystalPower(c) {
        const tie = { hp: 9, dmg: 8, crit: 7, lifesteal: 6, regen: 5, evasion: 4, speed: 3, yield: 2, magnet: 1 };
        return RARITIES[c.rarity].mul * (1 + 0.15 * c.enchant) + (tie[c.stat] ?? 0) * 1e-6;
    }
    /** jeodları açar, kristalleri toz yettikçe geliştirir (en güçlü olanlardan başlayarak) ve en güçlüleri kuşanır */
    runAutoCrystal() {
        const s = this.save;
        let opened = 0;
        let tries = 0;
        let ok = 0;
        if (s.geodes >= 1)
            opened = this.openAllGeodes().n;
        const slots = this.slots();
        for (let guard = 0; guard < 60; guard++) {
            const ranked = [...s.crystals].sort((a, b) => this.crystalPower(b) - this.crystalPower(a));
            const top = ranked.slice(0, slots);
            // önce kuşanılacak (en güçlü) kristaller, yetmezse diğerleri
            const cand = [...top, ...ranked.slice(slots)].find((c) => c.enchant < MAX_ENCHANT && s.dust >= enchantCost(c.enchant));
            if (!cand)
                break;
            tries++;
            if (this.enchantCrystal(cand.id) === 'ok')
                ok++;
        }
        const best = [...s.crystals].sort((a, b) => this.crystalPower(b) - this.crystalPower(a)).slice(0, slots).map((c) => c.id);
        const same = best.length === s.equipped.length && best.every((id) => s.equipped.includes(id));
        if (!same) {
            s.equipped = best;
            this.hp = Math.min(this.hp, this.maxHp());
        }
        if (opened || tries || !same) {
            this.autoCrystalNote = `${opened ? opened + ' jeod açıldı · ' : ''}${tries ? ok + '/' + tries + ' gelişim' : ''}`.replace(/ · $/, '');
            this.persist();
            this.onChange();
        }
        return { opened, tries, ok };
    }
    /** bütün jeodları açar; açılan sayıyı ve en nadir çıkan nadirliği döner */
    openAllGeodes() {
        let n = 0;
        let best = -1;
        while (this.save.geodes >= 1) {
            const c = this.openGeode();
            if (!c)
                break;
            n++;
            best = Math.max(best, c.rarity);
        }
        return { n, best };
    }
    /** aynı türden (özellik + nadirlik) kristaller otomatik birleştirilir: gelişim seviyeleri toplanır, azami aşan kısım ruh tozuna döner; birleştirilen sayıyı döner */
    static mergeCrystals(s) {
        const keep = new Map();
        const gone = new Map(); // silinen kimlik → kalan kimlik
        const worn = new Set(s.equipped);
        const ordered = [...s.crystals].sort((a, b) => Number(worn.has(b.id)) - Number(worn.has(a.id)));
        for (const c of ordered) {
            const k = c.stat + '|' + c.rarity;
            const base = keep.get(k);
            if (!base) {
                keep.set(k, c);
                continue;
            }
            const total = base.enchant + c.enchant + 1;
            base.enchant = Math.min(MAX_ENCHANT, total);
            if (total > MAX_ENCHANT)
                s.dust += 6 * (1 + c.rarity) * (total - MAX_ENCHANT);
            gone.set(c.id, base.id);
        }
        if (!gone.size)
            return 0;
        s.crystals = s.crystals.filter((x) => !gone.has(x.id));
        s.equipped = [...new Set(s.equipped.map((x) => gone.get(x) ?? x))];
        return gone.size;
    }
    toggleCrystal(id) {
        const eq = this.save.equipped;
        const at = eq.indexOf(id);
        if (at >= 0)
            eq.splice(at, 1);
        else if (eq.length < this.slots())
            eq.push(id);
        else
            return false;
        this.hp = Math.min(this.hp, this.maxHp());
        this.persist();
        this.onChange();
        return true;
    }
    enchantCrystal(id) {
        const c = this.save.crystals.find((x) => x.id === id);
        if (!c)
            return 'poor';
        if (c.enchant >= MAX_ENCHANT)
            return 'max';
        const cost = enchantCost(c.enchant);
        if (this.save.dust < cost)
            return 'poor';
        this.save.dust -= cost;
        const ok = Math.random() < enchantChance(c.enchant);
        if (ok)
            c.enchant++;
        this.persist();
        this.onChange();
        return ok ? 'ok' : 'fail';
    }
    sellCrystal(id) {
        const c = this.save.crystals.find((x) => x.id === id);
        if (!c)
            return;
        this.save.dust += 6 * (1 + c.rarity) * (1 + c.enchant);
        this.save.crystals = this.save.crystals.filter((x) => x.id !== id);
        this.save.equipped = this.save.equipped.filter((x) => x !== id);
        this.persist();
        this.onChange();
    }
    // ---- miğfer / kalkan ----
    gainItem(type, minRarity = 0) {
        if (Math.random() < 0.45)
            this.gainTigerItem(Math.max(0, minRarity - 1)); // her ganimetle kaplan için de eşya düşebilir
        const w = [60, 25, 10, 4, 1];
        const total = w.reduce((s, x) => s + x, 0);
        let roll = Math.random() * total;
        let r = 0;
        for (let i = 0; i < w.length; i++) {
            roll -= w[i];
            if (roll <= 0) {
                r = i;
                break;
            }
        }
        const it = {
            id: this.save.nextItem++, type, rarity: Math.max(minRarity, r), level: 1, dtype: DTYPES[Math.floor(Math.random() * 3)],
        };
        // aynı türden (tür + nadirlik + hasar türü) eşya otomatik birleştirilir: eldekinin seviyesi artar
        const twin = this.save.items.find((x) => x.type === type && x.rarity === it.rarity && x.dtype === it.dtype);
        if (twin) {
            if (twin.level < MAX_ITEM_LEVEL)
                twin.level++;
            else
                this.save.dust += 8 * (1 + twin.rarity) * twin.level;
            this.save.nextItem--;
            this.gain(RARITIES[twin.rarity].name + ' ' + EQUIP_NAMES[type][twin.rarity] + ' birleştirildi (sv.' + twin.level + ')', RARITIES[twin.rarity].color, 'icon_' + type);
            this.persist();
            this.onChange();
            return twin;
        }
        this.save.items.push(it);
        this.gain(RARITIES[it.rarity].name + ' ' + EQUIP_NAMES[type][it.rarity] + ' (' + DTYPE_NAMES[it.dtype] + ') bulundu!', RARITIES[it.rarity].color, 'icon_' + type);
        // hemen kullanılabilir: yuva boşsa ya da yeni eşya daha güçlüyse anında kuşanılır
        const cur = this.save.items.find((x) => x.id === this.save.eq[type]);
        const freeExtra = this.save.extra.length < this.extraSlots();
        if (!cur || it.rarity * 100 + it.level > cur.rarity * 100 + cur.level) {
            if (cur && freeExtra)
                this.save.extra.push(cur.id); // eski ana eşya ek yuvaya geçer
            this.save.eq[type] = it.id;
            this.gain(EQUIP_NAMES[type][it.rarity] + ' kuşanıldı', '#ffe36b', 'icon_' + type);
        }
        else if (freeExtra) {
            this.save.extra.push(it.id);
            this.gain(EQUIP_NAMES[type][it.rarity] + ' kuşanıldı (ek yuva)', '#ffe36b', 'icon_' + type);
        }
        this.persist();
        this.onChange();
        return it;
    }
    /** aynı türden (tür + nadirlik + hasar türü) eşyaları tek eşyada toplar: eski kayıtlardaki kopyalar da birleşir */
    static mergeDuplicates(s) {
        const keep = new Map();
        const gone = new Map(); // silinen kimlik → kalan kimlik
        const equipped = new Set([s.eq.helmet, s.eq.shield, ...s.extra]);
        // kuşanılanlar önce: kalan eşya onlardan biri olsun
        const ordered = [...s.items].sort((a, b) => Number(equipped.has(b.id)) - Number(equipped.has(a.id)));
        for (const it of ordered) {
            const k = it.type + '|' + it.rarity + '|' + it.dtype;
            const base = keep.get(k);
            if (!base) {
                keep.set(k, it);
                continue;
            }
            const total = base.level + it.level;
            base.level = Math.min(MAX_ITEM_LEVEL, total);
            if (total > MAX_ITEM_LEVEL)
                s.dust += 8 * (1 + it.rarity) * (total - MAX_ITEM_LEVEL);
            gone.set(it.id, base.id);
        }
        if (!gone.size)
            return;
        s.items = s.items.filter((x) => !gone.has(x.id));
        for (const t of ['helmet', 'shield'])
            if (gone.has(s.eq[t]))
                s.eq[t] = gone.get(s.eq[t]);
        s.extra = [...new Set(s.extra.map((x) => gone.get(x) ?? x))].filter((x) => x !== s.eq.helmet && x !== s.eq.shield);
    }
    toggleItem(id) {
        const it = this.save.items.find((x) => x.id === id);
        if (!it)
            return;
        if (this.save.eq[it.type] === id)
            this.save.eq[it.type] = 0;
        else if (this.save.extra.includes(id))
            this.save.extra = this.save.extra.filter((x) => x !== id);
        else if (!this.save.eq[it.type])
            this.save.eq[it.type] = id;
        else if (this.save.extra.length < this.extraSlots())
            this.save.extra.push(id);
        else
            this.save.eq[it.type] = id;
        this.hp = Math.min(this.hp, this.maxHp());
        this.persist();
        this.onChange();
    }
    upgradeItem(id) {
        const it = this.save.items.find((x) => x.id === id);
        if (!it || it.level >= MAX_ITEM_LEVEL)
            return false;
        const cost = itemUpgradeCost(it.level, it.rarity);
        if (this.save.essence < cost)
            return false;
        this.save.essence -= cost;
        it.level++;
        this.persist();
        this.onChange();
        return true;
    }
    sellItem(id) {
        const it = this.save.items.find((x) => x.id === id);
        if (!it)
            return;
        this.save.dust += 8 * (1 + it.rarity) * it.level;
        this.save.items = this.save.items.filter((x) => x.id !== id);
        if (this.save.eq[it.type] === id)
            this.save.eq[it.type] = 0;
        this.save.extra = this.save.extra.filter((x) => x !== id);
        this.persist();
        this.onChange();
    }
    // ---- simülasyon ----
    update(dt) {
        if (this.paused || this.mapOpen || this.holeTrap)
            return;
        this.nowMs = Date.now();
        this.time += dt;
        this.bannerT = Math.max(0, this.bannerT - dt);
        this.castPulse = Math.max(0, this.castPulse - dt);
        this.hurtFlash = Math.max(0, this.hurtFlash - dt);
        this.shake = Math.max(0, this.shake - dt * 22);
        this.tickFloor();
        if (this.tickDoom(dt))
            return;
        if (this.bonusIntroT > 0) {
            this.bonusIntroT -= dt;
            if (this.bonusIntroT < Game.BONUS_INTRO - 0.1 && this.bonusIntroT > Game.BONUS_INTRO - 0.5)
                this.shake = Math.max(this.shake, 8);
            return;
        }
        this.loadT = Math.max(0, this.loadT - dt);
        for (const [k, v] of this.bldFlash) {
            if (v <= dt)
                this.bldFlash.delete(k);
            else
                this.bldFlash.set(k, v - dt);
        }
        for (const g of this.gains) {
            if (g.delay > 0)
                g.delay -= dt;
            else
                g.t -= dt;
        }
        this.gains = this.gains.filter((g) => g.t > 0);
        for (const d of this.deathFx)
            d.t -= dt;
        this.deathFx = this.deathFx.filter((d) => d.t > 0);
        if (this.dead > 0) {
            this.dead -= dt;
            if (this.dead <= 0)
                this.respawn();
            return;
        }
        this.save.playSec += dt;
        this.flyT = Math.max(0, this.flyT - dt);
        if (this.gateAnim) {
            this.gateAnim.t -= dt;
            if (this.gateAnim.t <= 0)
                this.gateAnim = null;
        }
        if (this.exitAnim) {
            this.exitAnim.t -= dt;
            if (this.exitAnim.t <= 0)
                this.exitAnim = null;
        }
        this.movePlayer(dt);
        // bekleme geliri: oyun açık ve kahraman duruyorsa kazan, çalışırken kazandığının dörtte biri kadar ruh üretir
        if (!this.moving && this.castPulse <= 0) {
            this.idleT += dt;
            this.idleAcc += (this.soupRate() * dt * 1000 * 0.25) / 3.6e6;
            if (this.idleT >= 10 && this.idleAcc >= 1) {
                const amt = Math.floor(this.idleAcc);
                this.idleAcc -= amt;
                this.idleT = 0;
                this.save.essence += amt;
                this.gain('+' + this.fmt(amt) + ' Ruh (dinlenirken)', '#8fdcff', 'ui_soul', { key: 'idle', amount: amt, fmt: (n) => '+' + this.fmt(n) + ' Ruh (dinlenirken)' });
            }
        }
        else
            this.idleT = 0;
        if (!this.walkable(this.px, this.py))
            this.snapToLand();
        this.updatePuffs(dt);
        this.updateZoom(dt);
        const reg0 = this.region;
        this.region = this.regionAt(this.px, this.py);
        if (this.region !== reg0) {
            audio.setMood(this.region);
            this.ensureLoaded(this.region);
            this.tigerEnterRegion(this.region);
            this.softCapHint();
            this.giantStage();
            this.balanceCheck();
        }
        const calm = !this.enemies.some((e) => e.state === 'chase');
        const atHome = this.inHome();
        const before = this.hp;
        this.hp = Math.min(this.maxHp(), this.hp + (this.regen() + (calm ? 0.03 * this.maxHp() : 0) + (atHome ? HOME_HEAL * this.maxHp() : 0)) * dt);
        this.tigerHeal(((this.regen() + (calm ? 0.03 * this.maxHp() : 0) + (atHome ? HOME_HEAL * this.maxHp() : 0)) * dt) / this.maxHp());
        if (atHome && this.hp > before) {
            this.healAcc += this.hp - before;
            this.healShow -= dt;
            if (this.healShow <= 0 && this.healAcc >= 1) {
                this.gain('+' + this.fmt(this.healAcc) + ' Can iyileşti (ev)', '#7bff9a', 'ui_heart');
                this.healAcc = 0;
                this.healShow = 1.1;
            }
        }
        if (this.inBossHouse()) {
            // boss evinin içi: hızlı iyileşme
            const b4 = this.hp;
            this.hp = Math.min(this.maxHp(), this.hp + 0.12 * this.maxHp() * dt);
            this.tigerHeal(0.12 * dt);
            this.bossHealAcc += this.hp - b4;
            this.bossHealShow -= dt;
            if (this.bossHealShow <= 0 && this.bossHealAcc >= 1) {
                this.gain('+' + this.fmt(this.bossHealAcc) + ' Can iyileşti (boss evi)', '#7bff9a', 'ui_heart');
                this.bossHealAcc = 0;
                this.bossHealShow = 1.1;
            }
        }
        for (const [k, v] of this.houseFlash) {
            if (v <= dt)
                this.houseFlash.delete(k);
            else
                this.houseFlash.set(k, v - dt);
        }
        this.invuln = Math.max(0, this.invuln - dt);
        this.updateFocus(dt);
        if (!this.snakeFight && !this.bonus)
            this.syncSpawners(); // yılan savaşında yeni kamp çıkmaz
        this.syncRival(dt);
        this.updateEnemies(dt);
        this.checkPaywall(dt);
        this.tickBonus(dt);
        this.tickRaid(dt);
        this.tickMirror();
        this.questTick(dt);
        this.updateTiger(dt);
        this.tickVillager(dt);
        this.tickChicken(dt);
        this.archerCd = Math.max(0, this.archerCd - dt);
        this.tickExplorer();
        this.tickPotion(dt);
        this.tickBrew(dt);
        this.tickPickMush(dt);
        this.tickAutoCrystal(dt);
        this.tickSpellUnlock();
        this.tickSpellFinish(dt);
        this.tickSeen(dt);
        this.novaT = Math.max(0, this.novaT - dt);
        this.tickSwarm(dt);
        this.tickTremor(dt);
        this.tickCurse(dt);
        if (this.archerSel && !this.archerOn()) {
            this.archerSel = false;
            this.aim = null;
        }
        if (this.archerSel && this.aim) {
            const t = this.aimWorld();
            if (t)
                this.archerShoot(t.x, t.y);
        } // basılı tutuldukça seri atış
        this.updateHole(dt);
        this.revealFog(dt);
        this.updateSnakes(dt);
        this.castSpells(dt);
        this.updateProjs(dt);
        this.removeDead();
        this.checkChests();
        for (const f of this.floaters) {
            f.t -= dt;
            f.y -= 28 * dt;
        }
        this.floaters = this.floaters.filter((f) => f.t > 0);
        for (const f of this.feed)
            f.t -= dt;
        this.feed = this.feed.filter((f) => f.t > 0);
        this.dealt.t -= dt;
        this.saveT += dt;
        if (this.saveT > 5) {
            this.saveT = 0;
            this.persist();
        }
    }
    /** yürüyüş tozu / uçuş parıltısı izi */
    updatePuffs(dt) {
        for (const p of this.puffs)
            p.t -= dt;
        this.puffs = this.puffs.filter((p) => p.t > 0);
        this.puffT -= dt;
        if (this.moving && this.puffT <= 0 && this.puffs.length < 40) {
            const fly = this.flyT > 0;
            this.puffT = fly ? 0.05 : 0.13;
            const bx = -Math.cos(this.face);
            const by = -Math.sin(this.face);
            this.puffs.push({ x: this.px + bx * 12 + (Math.random() - 0.5) * 8, y: this.py + (fly ? 22 : 16) + by * 6 + (Math.random() - 0.5) * 4, t: fly ? 0.5 : 0.45, fly });
        }
    }
    /** karakter asla oyun alanının dışında kalmaz: denizde, kilitli kapının ötesinde ya da engelin içindeyse en yakın yürünebilir noktaya alınır */
    snapToLand() {
        for (let r = 20; r <= 1200; r += 20) {
            for (let k = 0; k < 16; k++) {
                const a = (k / 16) * Math.PI * 2;
                const x = this.px + Math.cos(a) * r;
                const y = this.py + Math.sin(a) * r;
                if (this.walkable(x, y)) {
                    this.px = x;
                    this.py = y;
                    return;
                }
            }
        }
        const rp = this.restPoints()[this.regionAt(this.px, this.py)];
        this.px = rp.x;
        this.py = rp.y + 70;
    }
    /** boss/canavar/zor bossun oyuncuya en çok yaklaşabileceği mesafe (saldırı menzili erad+14'ün içinde kalır) */
    bossStand(e) { return Math.min(90, Math.max(30, this.erad(e) * 0.6)); }
    /** oyuncu hareket etmiyorsa ve boss/canavar saldırı mesafesine girdiyse karakter ondan otomatik uzaklaşır; yürünebilir bir yön aranır */
    autoFlee() {
        let near = null;
        let nd = Infinity;
        for (const e of this.enemies) {
            if (e.tier !== 'boss' || e.hp <= 0 || e.state !== 'chase' || e.fly || e.seg)
                continue;
            const d = Math.hypot(this.px - e.x, this.py - e.y);
            if (d < this.erad(e) + 70 && d < nd) {
                nd = d;
                near = e;
            }
        }
        if (!near)
            return null;
        const base = Math.atan2(this.py - near.y, this.px - near.x);
        const step = Math.max(40, this.speed() * 0.3);
        for (const da of [0, 0.6, -0.6, 1.2, -1.2, 1.9, -1.9]) {
            const a = base + da;
            if (this.walkable(this.px + Math.cos(a) * step, this.py + Math.sin(a) * step))
                return { x: Math.cos(a), y: Math.sin(a) };
        }
        return null;
    }
    movePlayer(dt) {
        let mx = 0;
        let my = 0;
        if (this.keys.has('a') || this.keys.has('arrowleft'))
            mx -= 1;
        if (this.keys.has('d') || this.keys.has('arrowright'))
            mx += 1;
        if (this.keys.has('w') || this.keys.has('arrowup'))
            my -= 1;
        if (this.keys.has('s') || this.keys.has('arrowdown'))
            my += 1;
        if (this.joy) {
            const dx = this.joy.x - this.joy.ox;
            const dy = this.joy.y - this.joy.oy;
            const d = Math.hypot(dx, dy);
            if (d > 8) {
                mx = dx / Math.max(d, 50);
                my = dy / Math.max(d, 50);
            }
        }
        // dev yılan halkayı tamamen kapatınca (sardığında) yılan ölene kadar kımıldanılamaz; halka kapanmadan hareket serbesttir
        if ([...this.snakes.values()].some((S) => S.wrapped)) {
            this.moving = false;
            if (Math.hypot(mx, my) > 0.05 && this.time - this.wrapNoteT > 3) {
                this.wrapNoteT = this.time;
                this.float(this.px, this.py - 40, 'Yılan sardı: hareket edemezsin', '#9dff7a');
            }
            return;
        }
        let len = Math.hypot(mx, my);
        if (len <= 0.05 && this.dead <= 0 && !this.inHome() && this.flyT <= 0) {
            const f = this.autoFlee();
            if (f) {
                mx = f.x;
                my = f.y;
                len = 1;
            }
        }
        if (len > 1) {
            mx /= len;
            my /= len;
        }
        this.moving = len > 0.05;
        if (this.moving)
            this.face = Math.atan2(my, mx);
        const nx = this.px + mx * this.speed() * dt;
        const ny = this.py + my * this.speed() * dt;
        if (this.walkable(nx, ny)) {
            this.px = nx;
            this.py = ny;
        }
        else if (this.walkable(nx, this.py))
            this.px = nx;
        else if (this.walkable(this.px, ny))
            this.py = ny;
    }
    /** Temizlenmemiş kampları sahada tutar. Dalga yok: kamp yalnızca temizlenip süresi dolunca yeniden dolar. */
    syncSpawners() {
        // 40 adalık dünyada yalnızca yakındaki kamplar sahada tutulur; uzaklaşılan (dokunulmamış) kamplar kaldırılıp tam canla yeniden doğar
        const NEAR = 2400;
        const FAR = 3400;
        this.enemies = this.enemies.filter((e) => e.state !== 'idle' || e.hp < e.maxHp || Math.hypot(e.x - this.px, e.y - this.py) < FAR);
        const live = new Set();
        for (const e of this.enemies)
            live.add(e.sp);
        for (const sp of this.getWorld().spawners) {
            if (live.has(sp.id) || this.spCleared(sp) || this.bossSealed(sp) || this.hardHidden(sp))
                continue;
            if (Math.abs(sp.x - this.px) > NEAR || Math.abs(sp.y - this.py) > NEAR || Math.hypot(sp.x - this.px, sp.y - this.py) > NEAR)
                continue;
            this.spawnGroup(sp);
        }
    }
    /** zor boss, ada bossu yenilene kadar yoktur */
    hardHidden(sp) { return !!sp.hard && !this.save.bossDown[sp.reg]; }
    /** zor boss çarpanı: kahramanın gücüne göre ayarlanır (üst sınır HARD_BOSS_MUL, alt sınır 0,8); güçlenemeyen oyuncuyu çıkmaza sokmaz */
    hardMul(sp) {
        const r = this.fullPower() / Math.max(1, this.spawnerPower(sp));
        return Math.min(HARD_BOSS_MUL, Math.max(0.8, 1.3 * r));
    }
    spawnGroup(sp) {
        const zone = ZONES[sp.reg];
        const tier = TIERS[sp.tier];
        const def = ENEMIES[sp.kind];
        const hm = sp.hard ? this.hardMul(sp) : 1;
        for (let i = 0; i < tier.count; i++) {
            const a = (i / tier.count) * Math.PI * 2 + sp.id;
            const x = sp.x + (tier.count > 1 ? Math.cos(a) * 46 : 0);
            const y = sp.y + (tier.count > 1 ? Math.sin(a) * 46 : 0);
            const maxHp = def.hp * tier.hp * zone.scale * sp.lv * (sp.beast ? BEAST_MUL : sp.hard ? hm : 1);
            this.enemies.push({ beast: sp.beast, hard: sp.hard, hmul: sp.hard ? hm : undefined,
                def, tier: sp.tier, lv: sp.lv, reg: sp.reg, sp: sp.id, x, y, hx: x, hy: y, hp: maxHp, maxHp, state: 'idle', hitCd: 0,
                phase: Math.random() * 6, dashT: 3, dvx: 0, dvy: 0, flip: Math.random() < 0.5 ? 1 : -1, flash: 0, lunge: 0, moving: false,
            });
        }
        if (this.spellWeak.delete(sp.id)) {
            for (const e of this.enemies)
                if (e.sp === sp.id) {
                    e.hp *= 0.2;
                    e.lv *= 0.04;
                } // özel büyü etkisi (can ve hasar ×0,2)
        }
    }
    updateEnemies(dt) {
        for (const e of this.enemies) {
            if (e.seg) {
                e.flash = Math.max(0, e.flash - dt);
                continue;
            } // dev yılan bölümlerini updateSnakes yönetir
            if (e.fly) {
                e.fly.t += dt;
                e.flash = Math.max(0, e.flash - dt);
                const nx = e.x + e.fly.vx * dt;
                const ny = e.y + e.fly.vy * dt;
                if (this.walkable(nx, ny, true, true)) {
                    e.x = nx;
                    e.y = ny;
                }
                if (e.fly.t >= e.fly.dur) {
                    e.fly = undefined;
                    this.shake = Math.max(this.shake, 3);
                    audio.play('hit');
                }
                continue;
            }
            if (this.snakeFight)
                continue; // yılan savaşında diğer düşmanlar donar
            const dx = this.px - e.x;
            const dy = this.py - e.y;
            const d = Math.hypot(dx, dy) || 1;
            if (d > 1500 && e.state === 'idle')
                continue; // uzaktaki kamplar uyur
            e.hitCd = Math.max(0, e.hitCd - dt);
            e.flash = Math.max(0, e.flash - dt);
            e.lunge = Math.max(0, e.lunge - dt);
            e.phase += dt;
            const big = e.tier === 'boss';
            const aggro = (big ? 400 : 250 + (e.tier === 'elite' || e.tier === 'knight' ? 40 : 0)) * (this.isDwarf() ? 0.6 : 1); // cüce fark edilmez: düşmanlar %40 daha geç görür
            const leash = big ? 1000 : 480;
            const home = Math.hypot(e.hx - e.x, e.hy - e.y);
            if (d < 320 && !this.save.seen[e.def.id + (big ? '_boss' + e.reg : '')]) {
                this.save.seen[e.def.id + (big ? '_boss' + e.reg : '')] = 1;
                this.checkCollection();
                this.onChange();
            }
            const safe = this.inHome(); // ev güvenli bölge: düşmanlar içeri girmez
            if (safe && e.state === 'chase')
                e.state = 'return';
            if (e.state === 'idle' && d < aggro && !safe) {
                e.state = 'chase';
                if (e.beast) {
                    audio.play('roar');
                    vibrate([90, 40, 160]);
                }
            }
            else if (e.state === 'chase' && (home > leash || d > aggro * 2.2))
                e.state = 'return';
            else if (e.state === 'return' && home < 8) {
                e.state = 'idle';
                e.stuckN = 0;
                e.noHeal = false;
                e.stuckT = 0;
            }
            if (e.sp === BONUS_SP || e.sp === BEE_SP || e.sp === RAID_SP || e.sp === REFL_SP)
                e.state = 'chase'; // bonus turunda, arı sürüsünde ve dev saldırısında düşmanlar sürekli saldırır
            let sp = e.def.speed;
            if (e.def.id === 'bat')
                sp *= 1 + 0.5 * Math.sin(e.phase * 5);
            let vx = 0;
            let vy = 0;
            if (e.state === 'chase') {
                if (big) {
                    e.dashT -= dt;
                    if (e.dashT < 0) {
                        e.dashT = 3.2;
                        e.dvx = (dx / d) * 360;
                        e.dvy = (dy / d) * 360;
                    }
                    if (e.dashT > 2.6) {
                        vx = e.dvx;
                        vy = e.dvy;
                    }
                    else {
                        vx = (dx / d) * sp;
                        vy = (dy / d) * sp;
                    }
                }
                else {
                    vx = (dx / d) * sp;
                    vy = (dy / d) * sp;
                }
            }
            else if (e.state === 'return') {
                vx = ((e.hx - e.x) / home) * sp * 1.6;
                vy = ((e.hy - e.y) / home) * sp * 1.6;
            }
            else {
                vx = Math.cos(e.phase * 0.8 + e.sp) * 6;
                vy = Math.sin(e.phase * 0.7 + e.sp) * 6;
            }
            // ada bossu kara delikten kaçar (dondurulmuş delikten kaçmaz)
            const hl = this.hole;
            if (big && hl && this.holeFreeze <= 0) {
                const hx = e.x - hl.x;
                const hy = e.y - hl.y;
                const hd = Math.hypot(hx, hy) || 1;
                if (hd < 380) {
                    const fs = Math.max(sp * 1.2, 130);
                    vx = (hx / hd) * fs;
                    vy = (hy / hd) * fs;
                }
            }
            let nx = e.x + vx * dt;
            let ny = e.y + vy * dt;
            if (e.sp === BONUS_SP || e.sp === BEE_SP) {
                const gapE = this.groupGap(e.sp);
                // bonus düşmanı kendi adasından çıkmaz (köprüye / sonraki adaya geçmez)
                const bc = this.regionCenter(e.reg);
                if (Math.hypot(nx - bc.x, ny - bc.y) > bc.r - 40) {
                    nx = e.x;
                    ny = e.y;
                }
                // bonus düşmanı, bir komşusuna bonusGap'ten fazla yaklaşacaksa o yöne ilerlemez (yan yana kayabilir)
                for (const o of this.enemies) {
                    if (gapE <= 0 || o === e || o.sp !== e.sp)
                        continue;
                    const dOld = Math.hypot(o.x - e.x, o.y - e.y);
                    if (dOld > 400)
                        continue;
                    const dNew = Math.hypot(o.x - nx, o.y - ny);
                    if (dNew < gapE && dNew < dOld) {
                        const ux = (o.x - e.x) / (dOld || 1);
                        const uy = (o.y - e.y) / (dOld || 1);
                        const along = Math.max(0, (nx - e.x) * ux + (ny - e.y) * uy); // komşuya doğru bileşen çıkarılır
                        nx -= ux * along;
                        ny -= uy * along;
                    }
                }
            }
            if (big && !e.fly) {
                // boss, canavar ve zor boss oyuncunun üstüne çıkamaz: en az STAND mesafesinde durur, içeri girmişse dışarı itilir
                const stand = this.bossStand(e);
                const nd = Math.hypot(this.px - nx, this.py - ny) || 1;
                if (nd < stand) {
                    nx = this.px - ((this.px - nx) / nd) * stand;
                    ny = this.py - ((this.py - ny) / nd) * stand;
                }
            }
            const ox0 = e.x;
            const oy0 = e.y;
            if (this.walkable(nx, ny, true)) {
                e.x = nx;
                e.y = ny;
            }
            else if (this.walkable(nx, e.y, true))
                e.x = nx;
            else if (this.walkable(e.x, ny, true))
                e.y = ny;
            // iyileşme yalnızca gerçekten eve doğru ilerlerken olur (takılıp iyileşme yok)
            if (e.state === 'return' && !e.noHeal && Math.hypot(e.x - ox0, e.y - oy0) > 0.05)
                e.hp = Math.min(e.maxHp, e.hp + e.maxHp * (big ? 0.005 : 0.05) * dt);
            if (e.state === 'return') {
                // engele takıldı mı? 1.2 sn ilerleyemezse eve ışınlanır; tekrar olursa iyileşmesi durdurulur
                e.stuckT = (e.stuckT ?? 0) + dt;
                if (e.stuckT > 1.2) {
                    const moved = Math.hypot(e.x - (e.chkX ?? e.x), e.y - (e.chkY ?? e.y));
                    e.stuckT = 0;
                    e.chkX = e.x;
                    e.chkY = e.y;
                    if (moved < 20) {
                        e.stuckN = (e.stuckN ?? 0) + 1;
                        if (e.stuckN >= 2)
                            e.noHeal = true;
                        if (this.walkable(e.hx, e.hy, true)) {
                            e.x = e.hx;
                            e.y = e.hy;
                        }
                    }
                }
            }
            else {
                e.stuckT = 0;
                e.chkX = e.x;
                e.chkY = e.y;
            }
            e.moving = Math.abs(vx) + Math.abs(vy) > 14;
            if (Math.abs(vx) > 4)
                e.flip = vx > 0 ? 1 : -1;
            if (d < this.erad(e) + 14 && this.invuln <= 0 && this.flyT <= 0) {
                e.lunge = 0.25;
                if (Math.random() < this.blockChance()) {
                    this.invuln = 0.6;
                    this.float(this.px, this.py - 20, 'ENGEL', '#9be7ff');
                    continue;
                }
                if (Math.random() < this.evasion()) {
                    this.invuln = 0.6;
                    this.float(this.px, this.py - 20, 'KAÇTI', '#c8b6ff');
                    continue;
                }
                const hit = this.enemyDmg(e) * this.armor() * (1 - Math.min(0.9, this.typedReduction(e.def.atk) / 100)) * DMG_TAKEN;
                this.hp -= hit;
                this.hurtFlash = 0.25;
                this.shake = Math.max(this.shake, e.tier === 'boss' ? 9 : 4);
                audio.play('hurt');
                vibrate(35);
                this.invuln = 0.6;
                this.float(this.px, this.py - 20, '-' + this.fmt(hit), '#ff6b6b');
                if (this.hp <= 0) {
                    this.die();
                    return;
                }
            }
        }
    }
    // ---- son düello: yapay zekanın yönettiği, oyuncuyla aynı güçte rakip cadı ----
    /** 40. ada kapısına yaklaşan oyuncuya (devam paketi yoksa) mağaza hatırlatılır */
    checkPaywall(dt) {
        this.paywallT = Math.max(0, this.paywallT - dt);
        if (this.paywallT > 0)
            return;
        const i = this.region;
        if (!this.paywalled(i))
            return;
        const g = this.gatePos(i);
        if (Math.hypot(g.x - this.px, g.y - this.py) > 260)
            return;
        this.paywallT = 120;
        this.startDoom();
    }
    separateBonus() { this.separateGroup(BONUS_SP); }
    /** bir grubun (bonus tur, arı sürüsü) düşmanları birbirine en az grup aralığı kadar yaklaşamaz: ızgarayla komşular itilir */
    separateGroup(sp) {
        const MIN = this.groupGap(sp);
        if (MIN <= 0)
            return;
        const grid = new Map();
        const list = this.enemies.filter((e) => e.sp === sp && e.hp > 0);
        const key = (cx, cy) => cx * 100003 + cy;
        for (const e of list) {
            const k = key(Math.floor(e.x / MIN), Math.floor(e.y / MIN));
            const g = grid.get(k);
            if (g)
                g.push(e);
            else
                grid.set(k, [e]);
        }
        for (const a of list) {
            const cx = Math.floor(a.x / MIN);
            const cy = Math.floor(a.y / MIN);
            for (let ox = -1; ox <= 1; ox++)
                for (let oy = -1; oy <= 1; oy++) {
                    for (const b of grid.get(key(cx + ox, cy + oy)) ?? []) {
                        if (b === a || b.x < a.x || (b.x === a.x && b.y <= a.y))
                            continue; // her çift bir kez
                        let dx = b.x - a.x;
                        let dy = b.y - a.y;
                        let d = Math.hypot(dx, dy);
                        if (d >= MIN)
                            continue;
                        if (d < 0.01) {
                            const t = Math.random() * 6.283;
                            dx = Math.cos(t);
                            dy = Math.sin(t);
                            d = 1;
                        }
                        const push = (MIN - d) / 2 + 0.5;
                        const ux = (dx / d) * push;
                        const uy = (dy / d) * push;
                        const bc = this.regionCenter(a.reg);
                        if (this.walkable(a.x - ux, a.y - uy, true) && Math.hypot(a.x - ux - bc.x, a.y - uy - bc.y) <= bc.r - 40) {
                            a.x -= ux;
                            a.y -= uy;
                        }
                        if (this.walkable(b.x + ux, b.y + uy, true) && Math.hypot(b.x + ux - bc.x, b.y + uy - bc.y) <= bc.r - 40) {
                            b.x += ux;
                            b.y += uy;
                        }
                    }
                }
        }
    }
    /** arı sürüsü gelen adalar (ada dizini): 3 ile 10 ada arayla, bonus tur adalarına denk gelirse bir kaydırılır */
    swarmRegs() {
        if (this.swarmCache)
            return this.swarmCache;
        const out = new Set();
        const rnd = rng(20261004);
        let r = 3;
        while (r < ZONES.length - 1) {
            if ((r + 2) % 5 === 0)
                r++;
            out.add(r);
            r += 3 + Math.floor(rnd() * 8);
        }
        this.swarmCache = out;
        return out;
    }
    /** zorluğa (ada dizinine) bağlı sürü büyüklüğü: 400 -> 2000 */
    swarmCount(reg) {
        const rnd = rng(reg * 977 + 13);
        return Math.max(400, Math.min(2000, Math.round((400 + (1600 * reg) / Math.max(1, ZONES.length - 1)) * (0.9 + 0.2 * rnd()))));
    }
    beeDef(k) {
        return this.beeDefCache[k] ?? (this.beeDefCache[k] = { ...ENEMIES.bat, name: BEE_KINDS[k].label, speed: BEE_KINDS[k].speed, r: BEE_KINDS[k].r, atk: 'pierce' });
    }
    groupGap(sp) { return sp === BONUS_SP ? this.bonusGap : sp === BEE_SP ? this.beeGapNow : 0; }
    tickSwarm(dt) {
        const sw = this.swarm;
        if (!sw) {
            if (this.region !== this.swarmIsleReg) {
                this.swarmIsleReg = this.region;
                this.swarmIsleT = 0;
            }
            if (!this.swarmRegs().has(this.region) || this.save.first['bee' + this.region] || this.bonus || this.snakeFight || this.dead > 0 || this.inHome())
                return;
            this.swarmIsleT += dt;
            if (this.swarmIsleT >= 45)
                this.startSwarm(this.region);
            return;
        }
        sw.t += dt;
        sw.age += dt;
        if (this.region !== sw.reg || this.dead > 0) {
            this.endSwarm(false);
            return;
        }
        if (sw.warn > 0) {
            sw.warn -= dt;
            return;
        }
        const alive = this.enemies.filter((e) => e.sp === BEE_SP && e.hp > 0);
        // dalga: ilk dalga uyarıdan sonra; sonrakiler öncekinin çoğu ölünce ya da 35 sn sonra
        if (sw.spawned < sw.total && (sw.wave === 0 || alive.length <= Math.max(10, sw.lastSize * 0.15) || sw.t > 35))
            this.spawnBeeWave(alive);
        this.beeGapNow = alive.length > 25 ? 56 : 0; // son arılar aralık kuralına takılıp uzakta kalmasın
        for (let pass = 0; pass < 3; pass++)
            this.separateGroup(BEE_SP);
        if ((sw.spawned >= sw.total && alive.length === 0) || sw.age > 420)
            this.endSwarm(true);
    }
    startSwarm(reg) {
        this.save.first['bee' + reg] = 1;
        const total = this.swarmCount(reg);
        this.swarm = { reg, total, spawned: 0, wave: 0, waves: Math.ceil(total / 200), t: 0, warn: 6, lastSize: 0, age: 0 };
        this.say('ARI SÜRÜSÜ geliyor! Dalgalar halinde saldıracaklar');
        audio.play('roar');
        vibrate([90, 40, 160]);
        this.shake = Math.max(this.shake, 6);
        this.narrate('swarm');
    }
    spawnBeeWave(alive) {
        const sw = this.swarm;
        if (!sw)
            return;
        const size = Math.min(200, sw.total - sw.spawned);
        const P = Math.max(1, this.fullPower());
        const dps = Math.max(1e-9, this.dps());
        const stats = BEE_KINDS.map((k, i) => {
            const def = this.beeDef(i);
            const probe = { def, tier: 'easy', lv: 1, reg: sw.reg, sp: BEE_SP, x: 0, y: 0, hx: 0, hy: 0, hp: 1, maxHp: 1, state: 'chase', hitCd: 0, phase: 0, dashT: 3, dvx: 0, dvy: 0, flip: 1, flash: 0, lunge: 0, moving: false };
            const frac = (k.frac[0] + k.frac[1]) / 2;
            const hp = Math.max(1, dps * 0.2 * (frac / 0.03));
            const dmgE = (0.6 * ((frac * P) / 10) ** 2) / hp; // güç = √(can x hasar / 0,6) x 10 = karakter gücünün %2-5'i
            return { def, hp, lv: Math.max(1, (dmgE / Math.max(1e-6, this.enemyDmg(probe))) ** 2) };
        });
        const c = this.regionCenter(sw.reg);
        const spots = alive.map((e) => ({ x: e.x, y: e.y }));
        const gap = 56;
        const queenP = 0.04 + 0.12 * (sw.wave / Math.max(1, sw.waves)); // sonraki dalgalarda daha çok asker ve kraliçe
        const soldierP = 0.25 + 0.25 * (sw.wave / Math.max(1, sw.waves));
        let placed = 0;
        for (let k = 0; k < 30000 && placed < size; k++) {
            const a = Math.random() * Math.PI * 2;
            const r = 420 + Math.random() * 700;
            const x = this.px + Math.cos(a) * r;
            const y = this.py + Math.sin(a) * r;
            if (Math.hypot(x - c.x, y - c.y) > c.r - 60 || !this.walkable(x, y, true))
                continue;
            if (spots.some((q) => Math.hypot(q.x - x, q.y - y) < gap))
                continue;
            spots.push({ x, y });
            const roll = Math.random();
            const kind = roll < queenP ? 2 : roll < queenP + soldierP ? 1 : 0;
            const st = stats[kind];
            const hp = st.hp * (0.85 + Math.random() * 0.3);
            this.enemies.push({ def: st.def, tier: 'easy', lv: st.lv, reg: sw.reg, sp: BEE_SP, bee: kind, x, y, hx: x, hy: y, hp, maxHp: hp, state: 'chase', hitCd: 0,
                phase: Math.random() * 6, dashT: 3, dvx: 0, dvy: 0, flip: Math.random() < 0.5 ? 1 : -1, flash: 0, lunge: 0, moving: true });
            placed++;
        }
        sw.wave++;
        sw.t = 0;
        sw.spawned += placed > 0 ? placed : size; // yer bulunamazsa sonsuz döngüye girme
        sw.lastSize = placed;
        this.say('Arı dalgası ' + sw.wave + '/' + sw.waves + ' (' + placed + ' arı)');
        audio.play('roar');
    }
    endSwarm(done) {
        const sw = this.swarm;
        if (!sw)
            return;
        this.swarm = null;
        const left = this.enemies.filter((e) => e.sp === BEE_SP && e.hp > 0).length;
        this.enemies = this.enemies.filter((e) => e.sp !== BEE_SP);
        const killed = Math.max(0, sw.spawned - left);
        if (!done || killed <= 0) {
            if (!done)
                this.say('Arılar dağıldı');
            return;
        }
        const geodes = 1 + Math.floor(killed / 500);
        const dust = Math.max(1, Math.floor(killed / 8));
        const ess = this.soupYield((0.5 * 3.6e6 * killed) / 400);
        this.save.geodes += geodes;
        this.save.dust += dust;
        this.save.essence += ess;
        this.gain('Arı sürüsü yenildi: ' + killed + ' arı', '#ffd84a', 'icon_geode');
        this.gain('+' + geodes + ' Jeod · +' + dust + ' Toz', '#7dffb0', 'icon_geode');
        this.gain('+' + this.fmt(ess) + ' Ruh', '#8fdcff', 'ui_soul');
        this.say('Arı sürüsü yenildi!');
        audio.play('boss');
        this.persist();
        this.onChange();
    }
    /** 5, 10, 15… numaralı adaya geçilecek köprü kapısına yaklaşınca (köprü açıksa) bonus tur bir kez başlar */
    tickBonus(dt) {
        const b = this.bonus;
        if (b) {
            b.t -= dt;
            if (this.region !== b.reg) {
                this.endBonus();
                return;
            } // sonraki adaya geçilince bonus tur biter
            const alive = this.enemies.filter((e) => e.sp === BONUS_SP && e.hp > 0);
            const left = alive.length;
            // son düşmanlar aralık kuralına takılıp uzakta kalmasın: az kaldığında aralık kuralı kapanır
            this.bonusGap = left > 30 ? this.bonusGap0 : 0;
            for (let pass = 0; pass < 6; pass++)
                this.separateBonus();
            this.unstickBonus(alive, dt);
            b.kills = b.total - left; // sayaç kalan düşmandan hesaplanır: ölen hiçbir düşman atlanmaz
            if (b.t <= 0 || left === 0)
                this.endBonus();
            return;
        }
        if (this.snakeFight || this.dead > 0)
            return;
        // köprü bekçileri yenilince oyuncu köprünün çıkış kapısına yakındır (bölge bu ada ya da karşı ada sayılır): ikisine de bakılır
        for (const i of [this.region, this.region - 1]) {
            if (i < 0 || (i + 2) % 5 !== 0 || i >= ZONES.length - 1 || this.save.first['bonus' + i] || !this.bridgeOpen(i))
                continue;
            const br = this.bridge(i);
            const near = (t) => Math.hypot(br.ax + (br.bx - br.ax) * t - this.px, br.ay + (br.by - br.ay) * t - this.py) < 650;
            if (near(br.tGate) || near(br.tExit)) {
                this.startBonus(i);
                return;
            }
        }
    }
    mirrorShards() { return this.save.mirror?.n ?? 0; }
    mirrorTier() { return Math.floor(this.mirrorShards() / Game.MIRROR_STEP); }
    mirrorMul() { return 1 + Game.MIRROR_BONUS * this.mirrorTier(); }
    reflDone() { return this.save.mirror?.refl ?? 0; }
    reflDue() { return Math.max(0, this.mirrorTier() - this.reflDone()); }
    reflAlive() { return this.enemies.some((e) => e.sp === REFL_SP && e.hp > 0); }
    /** eski kayıtlar: yenilmiş her boss bir kırık sayılır */
    mirrorSync() {
        const m = this.save.mirror ?? (this.save.mirror = { n: 0, refl: 0 });
        for (let r = 0; r < this.save.bossDown.length; r++) {
            if (this.save.bossDown[r] && !this.save.first['ms' + r]) {
                this.save.first['ms' + r] = 1;
                m.n++;
            }
        }
    }
    addMirrorShard(reg) {
        const m = this.save.mirror ?? (this.save.mirror = { n: 0, refl: 0 });
        if (this.save.first['ms' + reg])
            return;
        this.save.first['ms' + reg] = 1;
        m.n++;
        this.gain('🪞 Ayna kırığı +1 (' + m.n + ')', '#9fe8ff', 'ui_skill');
        if (m.n % Game.MIRROR_STEP === 0) {
            this.gain('Ayna güçleniyor: kalıcı güç +%' + Math.round(Game.MIRROR_BONUS * 100), '#9fe8ff', 'ui_power');
            this.say('Ayna parladı! Kalıcı güç arttı; Ev → Ayna sekmesinden yansımanı çağırabilirsin');
            audio.play('gate');
            vibrate([60, 40, 120]);
        }
    }
    tickMirror() {
        if (!this.mirrorSynced) {
            this.mirrorSynced = true;
            this.mirrorSync();
        }
        // yansıma yalnızca çağrıldığı adada kalır
        if (this.enemies.some((e) => e.sp === REFL_SP && e.reg !== this.region))
            this.enemies = this.enemies.filter((e) => e.sp !== REFL_SP || e.reg === this.region);
    }
    /** aynadan yansımayı çağırır; boş dönerse başarılı, doluysa gösterilecek ileti */
    summonRefl() {
        if (this.reflDue() <= 0)
            return 'Yansıma hakkın yok: her 10 ayna kırığında bir hak kazanılır';
        if (this.reflAlive())
            return 'Yansıman zaten sahada';
        if (this.dead > 0 || this.inHome() || this.bonus || this.snakeFight || this.doom)
            return 'Yansımayı evden, savaş ve bonus tur dışında bir yerde çağır';
        let x = this.px;
        let y = this.py;
        for (let k = 0; k < 40; k++) {
            const a = Math.random() * Math.PI * 2;
            const r = 340 + Math.random() * 100;
            const tx = this.px + Math.cos(a) * r;
            const ty = this.py + Math.sin(a) * r;
            if (this.walkable(tx, ty, true, false)) {
                x = tx;
                y = ty;
                break;
            }
        }
        const e = { refl: true, def: ENEMIES.ghost, tier: 'elite', lv: 6, reg: this.region, sp: REFL_SP, gmul: 1, x, y, hx: x, hy: y, hp: 1, maxHp: 1, state: 'chase', hitCd: 0,
            phase: Math.random() * 6, dashT: 3, dvx: 0, dvy: 0, flip: x < this.px ? 1 : -1, flash: 0, lunge: 0, moving: false };
        // güç = √(can × hasar/0,6) × 10: hedef kahramanın gücünün 0,95 katı; can ≈ kahramanın 40 sn'lik hasarı
        const P = Math.max(1, this.fullPower()) * 0.95;
        const hp = Math.max(1, this.dps()) * 40;
        const dmgWant = (0.6 * Math.pow(P / 10, 2)) / hp;
        e.gmul = dmgWant / Math.max(1e-9, this.enemyDmg(e));
        e.maxHp = hp;
        e.hp = hp;
        this.enemies.push(e);
        this.shake = Math.max(this.shake, 6);
        audio.play('roar');
        vibrate([60, 40, 100]);
        this.say('Aynadan yansıman çıktı: senin kadar güçlü');
        return '';
    }
    reflDefeated(e) {
        const m = this.save.mirror ?? (this.save.mirror = { n: 0, refl: 0 });
        m.refl++;
        const t = Math.max(1, this.mirrorTier());
        const ess = this.soupYield(2 * 3.6e6);
        this.save.geodes += 3;
        this.save.dust += 40 * t;
        this.save.essence += ess;
        this.deathFx.push({ x: e.x, y: e.y, t: 0.45, name: 'witch@mirror', size: 86, flip: e.flip });
        this.shake = Math.max(this.shake, 8);
        audio.play('boss');
        vibrate([80, 60, 200]);
        this.gain('Yansıma yenildi: +3 jeod, +' + 40 * t + ' toz, +' + this.fmt(ess) + ' ruh', '#9fe8ff', 'icon_geode');
        this.say('Yansıma dağıldı');
        this.persist();
        this.onChange();
    }
    drawReflection(e) {
        const c = this.ctx;
        const t = this.time + e.phase;
        const bob = e.moving ? -Math.abs(Math.sin(t * 11)) * 5 : Math.sin(t * 2) * 1.6;
        const gl = c.createRadialGradient(e.x, e.y - 20, 6, e.x, e.y - 20, 74);
        gl.addColorStop(0, 'rgba(150,230,255,0.38)');
        gl.addColorStop(1, 'rgba(150,230,255,0)');
        c.fillStyle = gl;
        c.fillRect(e.x - 80, e.y - 100, 160, 160);
        c.fillStyle = 'rgba(0,0,0,0.25)';
        c.beginPath();
        c.ellipse(e.x, e.y + 18, 21, 7.4, 0, 0, Math.PI * 2);
        c.fill();
        c.globalAlpha = 0.92;
        if (!this.drawSprX('witch@mirror', e.x, e.y - 8, 85.7, { flip: e.flip, bob, flash: e.flash > 0 })) {
            c.fillStyle = 'rgba(150,230,255,0.85)';
            c.beginPath();
            c.arc(e.x, e.y - 10, 16, 0, Math.PI * 2);
            c.fill();
        }
        c.globalAlpha = 1;
        const bw = 62;
        const by = e.y - 73;
        c.fillStyle = 'rgba(0,0,0,0.55)';
        c.fillRect(e.x - bw / 2 - 1, by - 1, bw + 2, 8);
        const f = Math.max(0, Math.min(1, e.hp / e.maxHp));
        c.fillStyle = '#7fe0ff';
        c.fillRect(e.x - bw / 2, by, bw * f, 6);
        c.font = `bold ${Math.round(12 * this.lk())}px sans-serif`;
        c.textAlign = 'center';
        c.lineWidth = 3;
        c.strokeStyle = 'rgba(0,0,0,0.7)';
        const txt = '🪞 ' + T('YANSIMA') + ' ⚔ ' + this.fmt(this.enemyPower(e));
        c.strokeText(txt, e.x, by - 4);
        c.fillStyle = '#bff0ff';
        c.fillText(txt, e.x, by - 4);
    }
    tickRaid(dt) {
        if (this.region !== Game.RAID_REG || this.save.first['raid49'] || this.save.first['ended']) {
            if (this.raidSpawned || this.raidT > 0) {
                this.enemies = this.enemies.filter((e) => e.sp !== RAID_SP);
                this.raidSpawned = false;
                this.raidT = 0;
                this.raidWarned = false;
                this.raidIntroT = 0;
            }
            return;
        }
        if (this.snakeFight || this.bonus || this.dead > 0 || this.doom)
            return;
        if (!this.raidSpawned) {
            if (this.raidIntroT <= 0) {
                this.raidT += dt;
                if (!this.raidWarned && this.raidT >= Game.RAID_AFTER - 10) {
                    this.raidWarned = true;
                    this.say('Yer sarsılıyor… devler yaklaşıyor');
                    this.shake = Math.max(this.shake, 6);
                    audio.play('roar');
                    vibrate([60, 40, 60]);
                }
                if (this.raidT >= Game.RAID_AFTER) {
                    this.raidIntroT = 2.4;
                    audio.play('boss');
                    vibrate([120, 60, 240]);
                }
            }
            else {
                this.raidIntroT -= dt;
                this.shake = Math.max(this.shake, 8);
                if (this.raidIntroT <= 0)
                    this.spawnRaid();
            }
            return;
        }
        if (!this.enemies.some((e) => e.sp === RAID_SP && e.hp > 0))
            this.completeRaid();
    }
    spawnRaid() {
        this.raidSpawned = true;
        const zone = ZONES[Game.RAID_REG];
        const a0 = Math.random() * Math.PI * 2;
        for (let i = 0; i < 3; i++) {
            let x = this.px;
            let y = this.py;
            for (let k = 0; k < 30; k++) {
                const a = a0 + (i / 3) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
                const r = 380 + Math.random() * 140;
                const tx = this.px + Math.cos(a) * r;
                const ty = this.py + Math.sin(a) * r;
                if (this.walkable(tx, ty, true, false)) {
                    x = tx;
                    y = ty;
                    break;
                }
            }
            const def = ENEMIES[zone.enemies[i % zone.enemies.length]];
            const e = { giant: true, gmul: 1, def, tier: 'elite', lv: 6, reg: Game.RAID_REG, sp: RAID_SP, x, y, hx: x, hy: y, hp: 1, maxHp: 1, state: 'chase', hitCd: 0,
                phase: Math.random() * 6, dashT: 3, dvx: 0, dvy: 0, flip: x < this.px ? 1 : -1, flash: 0, lunge: 0, moving: false };
            // güç = √(can × hasar/0,6) × 10 hedefe oturur: hedef, kahramanın gücünün 1,5-2 katı; can ≈ kahramanın 50 sn'lik hasarı
            const P = this.fullPower() * (1.5 + Math.random() * 0.5);
            const hp = Math.max(1, this.dps()) * 50;
            const dmgWant = (0.6 * Math.pow(P / 10, 2)) / hp;
            e.gmul = dmgWant / Math.max(1e-9, this.enemyDmg(e));
            e.maxHp = hp;
            e.hp = hp;
            this.enemies.push(e);
        }
        this.say('Devler saldırıyor! Üç dev, her biri senden güçlü');
        this.save.first['narraid'] = this.save.first['narraid'] ?? 0;
    }
    completeRaid() {
        this.raidSpawned = false;
        this.save.first['raid49'] = 1;
        const ess = this.soupYield(3 * 3.6e6);
        this.save.geodes += 5;
        this.save.essence += ess;
        this.shake = Math.max(this.shake, 10);
        audio.play('boss');
        vibrate([80, 60, 200]);
        this.say('Devler yenildi! +5 jeod');
        this.gain('Devler yenildi: +5 jeod, +' + this.fmt(ess) + ' ruh', '#ffd84a', 'icon_geode');
        this.persist();
        this.onChange();
    }
    drawRaidIntro() {
        if (this.raidIntroT <= 0)
            return;
        const c = this.ctx;
        const t = 2.4 - this.raidIntroT;
        c.save();
        c.fillStyle = 'rgba(60,10,0,' + Math.min(0.35, t * 0.5) + ')';
        c.fillRect(0, 0, this.w, this.h);
        c.textAlign = 'center';
        const k = Math.min(1, t / 0.4);
        const sc = 1.8 - 0.8 * (1 - Math.pow(1 - k, 3));
        c.translate(this.w / 2, this.h * 0.3);
        c.scale(sc, sc);
        let fs = Math.round(34 * this.lk());
        c.font = '900 ' + fs + 'px sans-serif';
        const txt = '🌋 ' + T('DEVLER SALDIRIYOR!') + ' 🌋';
        const mw = c.measureText(txt).width;
        if (mw > (this.w - 24) / sc) {
            fs = Math.max(12, Math.floor(fs * (this.w - 24) / sc / mw));
            c.font = '900 ' + fs + 'px sans-serif';
        }
        c.lineWidth = 7;
        c.strokeStyle = 'rgba(70,15,0,0.95)';
        c.strokeText(txt, 0, 0);
        const g = c.createLinearGradient(0, -fs, 0, 8);
        g.addColorStop(0, '#fff0b0');
        g.addColorStop(1, '#ff7a2a');
        c.fillStyle = g;
        c.globalAlpha = Math.min(1, k * 1.4);
        c.fillText(txt, 0, 0);
        c.restore();
    }
    drawBonusIntro() {
        if (this.bonusIntroT <= 0)
            return;
        const c = this.ctx;
        const w = this.w;
        const h = this.h;
        const t = Game.BONUS_INTRO - this.bonusIntroT;
        const cx = w / 2;
        const cy = h * 0.42;
        c.save();
        c.fillStyle = 'rgba(40,10,0,' + Math.min(0.55, t * 0.9) + ')';
        c.fillRect(0, 0, w, h);
        if (t < 0.25) {
            c.fillStyle = 'rgba(255,230,160,' + 0.7 * (1 - t / 0.25) + ')';
            c.fillRect(0, 0, w, h);
        }
        c.globalCompositeOperation = 'lighter';
        // şok dalgaları
        for (let i = 0; i < 3; i++) {
            const k = ((t * 0.9 - i * 0.3) % 1 + 1) % 1;
            if (t * 0.9 - i * 0.3 < 0)
                continue;
            c.strokeStyle = `rgba(255,150,40,${0.75 * (1 - k)})`;
            c.lineWidth = 8 * (1 - k) + 1;
            c.beginPath();
            c.arc(cx, cy, Math.max(w, h) * 0.75 * k, 0, Math.PI * 2);
            c.stroke();
        }
        // hız çizgileri
        for (let i = 0; i < 28; i++) {
            const a = (i / 28) * Math.PI * 2 + t * 0.3;
            const r0 = Math.max(w, h) * (0.18 + 0.1 * ((i * 7) % 5) / 5);
            const r1 = r0 + 90 + 80 * Math.sin(t * 6 + i);
            c.strokeStyle = 'rgba(255,200,120,0.28)';
            c.lineWidth = 2;
            c.beginPath();
            c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
            c.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
            c.stroke();
        }
        c.restore();
        // başlık
        const k = Math.min(1, Math.max(0, (t - 0.1) / 0.45));
        const sc = 2.2 - 1.2 * (1 - Math.pow(1 - k, 3)) + 0.04 * Math.sin(t * 9);
        c.save();
        c.translate(cx, cy);
        c.scale(sc, sc);
        c.globalAlpha = Math.min(1, k * 1.5);
        c.textAlign = 'center';
        c.font = '900 ' + Math.round(40 * this.lk()) + 'px sans-serif';
        c.lineWidth = 8;
        c.strokeStyle = 'rgba(80,20,0,0.95)';
        c.strokeText('⚔ ' + T('BONUS TUR') + ' ⚔', 0, 0);
        const g = c.createLinearGradient(0, -34, 0, 10);
        g.addColorStop(0, '#fff3b0');
        g.addColorStop(1, '#ff9a2a');
        c.fillStyle = g;
        c.fillText('⚔ ' + T('BONUS TUR') + ' ⚔', 0, 0);
        c.restore();
        c.save();
        c.textAlign = 'center';
        c.globalAlpha = Math.min(1, Math.max(0, (t - 0.5) / 0.4));
        const l1 = T('120 sn içinde ne kadar çok düşman yenersen');
        const l2 = T('o kadar büyük kalıcı ödül kazanırsın');
        let fs = Math.round(17 * this.lk());
        c.font = 'bold ' + fs + 'px sans-serif';
        const wide = Math.max(c.measureText(l1).width, c.measureText(l2).width);
        if (wide > w - 28) {
            fs = Math.max(10, Math.floor(fs * (w - 28) / wide));
            c.font = 'bold ' + fs + 'px sans-serif';
        }
        c.lineWidth = 5;
        c.strokeStyle = 'rgba(40,10,0,0.9)';
        c.fillStyle = '#ffe9c0';
        c.strokeText(l1, cx, cy + 46 * this.lk());
        c.fillText(l1, cx, cy + 46 * this.lk());
        c.strokeText(l2, cx, cy + 70 * this.lk());
        c.fillText(l2, cx, cy + 70 * this.lk());
        c.restore();
        // geri sayım
        const steps = [[0.8, '3'], [1.4, '2'], [2.0, '1'], [2.5, T('BAŞLA!')]];
        for (let i = steps.length - 1; i >= 0; i--) {
            if (t < steps[i][0])
                continue;
            const u = Math.min(1, (t - steps[i][0]) / 0.5);
            const s2 = 1 + 0.8 * (1 - u);
            c.save();
            c.translate(cx, h * 0.72);
            c.scale(s2, s2);
            c.globalAlpha = i === 3 ? 1 : 1 - u * 0.4;
            c.textAlign = 'center';
            c.font = '900 ' + Math.round((i === 3 ? 44 : 64) * this.lk()) + 'px sans-serif';
            c.lineWidth = 7;
            c.strokeStyle = 'rgba(40,10,0,0.95)';
            c.strokeText(steps[i][1], 0, 0);
            c.fillStyle = i === 3 ? '#9aff9a' : '#ffffff';
            c.fillText(steps[i][1], 0, 0);
            c.restore();
            break;
        }
    }
    /** 2 sn boyunca kıpırdamayan ve uzakta kalan bonus düşmanı oyuncunun yakınına (300-450 px) alınır: hiçbiri kaybolup kalmaz */
    unstickBonus(alive, dt) {
        const b = this.bonus;
        if (!b)
            return;
        const c = this.regionCenter(b.reg);
        for (const e of alive) {
            const tr = this.bonusTrack.get(e);
            if (!tr) {
                this.bonusTrack.set(e, { x: e.x, y: e.y, t: 0 });
                continue;
            }
            tr.t += dt;
            if (tr.t < 2)
                continue;
            const moved = Math.hypot(e.x - tr.x, e.y - tr.y);
            tr.x = e.x;
            tr.y = e.y;
            tr.t = 0;
            if (moved > 25 || Math.hypot(e.x - this.px, e.y - this.py) < 450)
                continue;
            for (let k = 0; k < 40; k++) {
                const a = Math.random() * Math.PI * 2;
                const r = 300 + Math.random() * 150;
                const x = this.px + Math.cos(a) * r;
                const y = this.py + Math.sin(a) * r;
                if (Math.hypot(x - c.x, y - c.y) > c.r - 60 || !this.walkable(x, y, true))
                    continue;
                e.x = x;
                e.y = y;
                e.hx = x;
                e.hy = y;
                tr.x = x;
                tr.y = y;
                break;
            }
        }
    }
    startBonus(i) {
        this.save.first['bonus' + i] = 1;
        const zone = ZONES[i];
        const def = ENEMIES[zone.enemies[0]];
        const probe = { def, tier: 'easy', lv: 1, reg: i, sp: BONUS_SP, x: 0, y: 0, hx: 0, hy: 0, hp: 1, maxHp: 1, state: 'chase', hitCd: 0, phase: 0, dashT: 3, dvx: 0, dvy: 0, flip: 1, flash: 0, lunge: 0, moving: false };
        const dmg0 = Math.max(1e-6, this.enemyDmg(probe));
        const target = 0.04 * Math.max(1, this.fullPower()); // her düşman karakter gücünün %4'ü
        const maxHp = Math.max(1, this.dps() * 0.25); // karakterin saniyelik hasarının dörtte biri: kısa sürede ölür, can ve hasar karakterin %4 gücünü verir
        const dmgE = (0.6 * (target / 10) ** 2) / maxHp;
        const lvB = Math.max(1, (dmgE / dmg0) ** 2); // enemyDmg ∝ √lv
        // oyuncu adanın ortasına alınır, bütün düşmanlar aynı adada doğar
        const c = this.regionCenter(i);
        this.px = c.x;
        this.py = c.y;
        if (!this.walkable(this.px, this.py))
            this.snapToLand();
        this.ensureLoaded(i);
        this.enemies = this.enemies.filter((e) => e.sp === BONUS_SP); // normal düşmanlar kalkar
        if (this.tg) {
            this.tg.x = this.px - 40;
            this.tg.y = this.py + 20;
        } // kaplan köprüde takılı kalmasın: oyuncunun yanına gelir
        let placed = 0;
        let spots = [];
        for (const gap of [130, 115, 100, 90, 80, 70]) {
            this.bonusGap = gap;
            this.bonusGap0 = gap;
            spots = [];
            for (let k = 0; k < 40000 && spots.length < BONUS_COUNT; k++) {
                const a = Math.random() * Math.PI * 2;
                const r = 200 + Math.sqrt(Math.random()) * Math.max(0, c.r - 260);
                const x = c.x + Math.cos(a) * r;
                const y = c.y + Math.sin(a) * r;
                if (!this.walkable(x, y, true))
                    continue;
                if (spots.some((q) => Math.hypot(q.x - x, q.y - y) < gap))
                    continue;
                spots.push({ x, y });
            }
            if (spots.length >= BONUS_COUNT)
                break;
        }
        for (const q of spots) {
            this.enemies.push({ def, tier: 'easy', lv: lvB, reg: i, sp: BONUS_SP, x: q.x, y: q.y, hx: q.x, hy: q.y, hp: maxHp, maxHp, state: 'chase', hitCd: 0,
                phase: Math.random() * 6, dashT: 3, dvx: 0, dvy: 0, flip: Math.random() < 0.5 ? 1 : -1, flash: 0, lunge: 0, moving: false });
            placed++;
        }
        this.bonus = { t: BONUS_SEC, kills: 0, total: placed, reg: i };
        audio.play('roar');
        vibrate([90, 40, 160]);
        this.bonusIntroT = Game.BONUS_INTRO;
        this.narrate('bonus');
    }
    endBonus() {
        const b = this.bonus;
        if (!b)
            return;
        this.bonus = null;
        this.bonusTrack.clear();
        this.enemies = this.enemies.filter((e) => e.sp !== BONUS_SP);
        const n = b.kills;
        if (n > 0) {
            this.addPerm('elite.hp', n * 0.0002 * this.hpPool()); // yenilen düşman başına kalıcı +%0,02 can
            this.tigerInit();
            this.save.tiger.hpBase *= 1 + n * 0.0004; // kaplana iki kat oran
            this.save.dust += n;
        }
        this.gain('Bonus tur: ' + n + ' düşman', '#ffd84a', 'icon_geode');
        if (n > 0) {
            this.gain('+%' + (n * 0.02).toFixed(1) + ' Can (kalıcı)', '#7bff9a', 'ui_heart');
            this.gain('+%' + (n * 0.04).toFixed(1) + ' Kaplan canı (kalıcı)', '#ffb36b', 'ui_heart');
            this.gain('+' + n + ' Ruh tozu', '#ffd1f0', 'ui_dust');
        }
        this.nextIslandAfterBonus(b.reg);
        this.persist();
        this.onChange();
    }
    /** bonus tur bitince oyuncu sıradaki adanın ortasına geçer */
    nextIslandAfterBonus(i) {
        if (i + 1 >= ZONES.length)
            return;
        const c = this.regionCenter(i + 1);
        this.px = c.x;
        this.py = c.y;
        this.ensureLoaded(i + 1);
        if (!this.walkable(this.px, this.py))
            this.snapToLand();
        this.region = this.regionAt(this.px, this.py);
        if (this.tg) {
            this.tg.x = this.px - 40;
            this.tg.y = this.py + 20;
        }
        this.save.x = this.px;
        this.save.y = this.py;
        audio.setMood(this.region);
        this.tigerEnterRegion(this.region);
        this.say('Bonus tur bitti: sıradaki adaya geçildi');
    }
    /** son adanın bossu yenilince rakip cadıyla düello (street fighter tarzı ayrı oyun, src/fight.ts) önerilir */
    syncRival(dt) {
        this.rivalT -= dt;
        if (this.rivalT > 0)
            return;
        this.rivalT = 2;
        const last = ZONES.length - 1;
        if (this.region === last && this.save.bossDown[last] && !this.save.rivalDown && this.dead <= 0) {
            this.rivalT = 45;
            this.onDuel();
        }
    }
    /** düello bitti: kazanılırsa kalıcı olarak kaydedilir */
    finishDuel(won) {
        if (!won)
            return;
        this.save.rivalDown = 1;
        this.save.geodes += 10;
        this.gain('+10 Jeod', '#7dffb0', 'icon_geode');
        this.save.first['ended'] = 1; // ayna bütünlendi: devler çekilir
        this.narrate('ending');
        this.say('Rakip cadıyı yendin! Hexling efsanesi oldun!');
        audio.play('beastdie');
        vibrate([120, 60, 240]);
        this.persist();
        this.onChange();
    }
    // ---- büyüler ----
    /** en uzak kuşanılan büyünün nişan mesafesi */
    aimRange() {
        let r = 0;
        for (const i of this.equippedWeapons())
            r = Math.max(r, WEAPONS[i].range * this.reachMul());
        return r;
    }
    /** nişan mesafesi ekrana sığacak kadar kamera uzaklaşır (en fazla 0.5) */
    updateZoom(dt) {
        const half = Math.min(this.w, this.h) / 2;
        const target = Math.max(0.5, Math.min(1, (half * 0.94) / (this.aimRange() + 40)));
        const goal = target + (1.3 - target) * this.focus; // yılan savaşında yakınlaşır
        this.zoom += (goal - this.zoom) * Math.min(1, dt * 3);
    }
    /** (x,y) şu an ekranda mı (atış yalnızca ekrandaki hedeflere) */
    visible(x, y) {
        const hw = this.w / this.zoom / 2 - 24;
        const hh = this.h / this.zoom / 2 - 24;
        return Math.abs(x - this.px) < hw && Math.abs(y - this.py) < hh;
    }
    /** yazı boyu telafisi: kamera uzaklaşınca etiketler küçülmesin */
    lk() { return 1 / Math.sqrt(this.zoom); }
    nearestTarget(range) {
        let best = null;
        let bd = range;
        for (const e of this.enemies) {
            const d = Math.hypot(e.x - this.px, e.y - this.py);
            if (this.snakeFight && (!e.seg || !this.snakeWrapped(e)))
                continue; // yılan savaşında yalnız saran yılanın bölümleri hedeflenir
            if (e.tgFirst && this.time < e.tgFirst && this.hp > this.maxHp() * 0.5)
                continue; // kaplan önce mücadele eder (can azsa yine yardım)
            if (d < bd && this.visible(e.x, e.y)) {
                bd = d;
                best = { x: e.x, y: e.y };
            }
        }
        if (this.snakeFight)
            return best;
        for (const s of this.bossHouses()) {
            const d = Math.hypot(s.x - this.px, s.y - this.py);
            if (d < bd && this.visible(s.x, s.y)) {
                bd = d;
                best = { x: s.x, y: s.y };
            }
        }
        if (best)
            return best;
        for (const o of this.liveBlds()) {
            const d = Math.hypot(o.x - this.px, o.y - this.py);
            if (d < bd && this.visible(o.x, o.y)) {
                bd = d;
                best = { x: o.x, y: o.y };
            }
        }
        if (best)
            return best;
        for (const t of this.treesNear(this.px, this.py, range)) {
            if (this.isCleared('t' + t.id))
                continue;
            const d = Math.hypot(t.x - this.px, t.y - this.py);
            if (d < Math.min(bd, range * 0.8) && this.visible(t.x, t.y)) {
                bd = d;
                best = { x: t.x, y: t.y };
            }
        }
        return best;
    }
    newProj(kind, x, y, dmg, dtype) {
        return { kind, x, y, vx: 0, vy: 0, sx: x, sy: y, tx: x, ty: y, dmg, dtype, life: 0, max: 1, phase: 0, pierce: 0, r: 0, a: 0, hit: new Set() };
    }
    castSpells(dt) {
        for (const i of this.equippedWeapons()) {
            const cd = (this.cast.get(i) ?? 0) - dt;
            if (cd > 0) {
                this.cast.set(i, cd);
                continue;
            }
            const w = WEAPONS[i];
            const t = this.nearestTarget(w.range * this.reachMul());
            if (!t) {
                this.cast.set(i, 0.1);
                continue;
            }
            this.fire(i, t);
            this.cast.set(i, w.cooldown / this.castSpeed());
        }
    }
    fire(i, t) {
        const w = WEAPONS[i];
        const dmg = this.weaponDmg(i);
        const n = this.weaponCopies(i);
        const ang = Math.atan2(t.y - this.py, t.x - this.px);
        this.castPulse = 0.28;
        audio.play('cast');
        if (!this.moving)
            this.face = ang;
        const reach = this.reachMul();
        if (w.id === 'wand') {
            for (let k = 0; k < n; k++) {
                const a = ang + (k - (n - 1) / 2) * 0.2;
                const p = this.newProj('bolt', this.px, this.py - 10, dmg, w.dtype);
                p.vx = Math.cos(a) * 560;
                p.vy = Math.sin(a) * 560;
                p.max = (w.range * reach + 60) / 560;
                p.pierce = 3;
                p.a = a;
                this.projs.push(p);
            }
        }
        else if (w.id === 'broom') {
            for (let k = 0; k < n; k++) {
                const a = ang + (k - (n - 1) / 2) * 0.55;
                const p = this.newProj('broom', this.px, this.py - 6, dmg, w.dtype);
                p.vx = Math.cos(a) * 440;
                p.vy = Math.sin(a) * 440;
                p.max = 5;
                p.r = w.range * reach;
                p.a = a;
                this.projs.push(p);
            }
        }
        else if (w.id === 'potion') {
            for (let k = 0; k < n; k++) {
                const off = k === 0 ? { x: 0, y: 0 } : { x: Math.cos(k * 2.4) * 60, y: Math.sin(k * 2.4) * 60 };
                const p = this.newProj('potion', this.px, this.py - 10, dmg, w.dtype);
                p.tx = t.x + off.x;
                p.ty = t.y + off.y;
                p.max = 0.6;
                p.r = 82 * reach;
                this.projs.push(p);
            }
        }
        else {
            const p = this.newProj('slash', this.px, this.py, dmg * (1 + 0.25 * (n - 1)), w.dtype);
            p.a = ang;
            p.r = 112 * reach;
            p.max = 0.22;
            this.projs.push(p);
            this.areaHit(p, true);
        }
    }
    /** boss evinin mührü: o adadaki diğer kampların hepsi (ilk kez) temizlenmeden boss ortaya çıkmaz */
    sealProgress(reg) {
        let list = this.campsOf.get(reg);
        if (!list) {
            list = this.getWorld().spawners.filter((x) => x.reg === reg && x.tier !== 'boss');
            this.campsOf.set(reg, list);
        }
        return { done: list.filter((x) => this.save.first['s' + x.id]).length, need: list.length };
    }
    bossSealed(sp) {
        if (sp.tier !== 'boss' || sp.bridge !== undefined || this.save.bossDown[sp.reg])
            return false;
        const p = this.sealProgress(sp.reg);
        return p.done < p.need;
    }
    /** canlı boss'un evi (kampı): vurulabilir, vuruşlar boss'a zarar verir */
    bossHouses() {
        return this.getWorld().spawners.filter((s) => s.tier === 'boss' && (s.bridge === undefined || !!s.hard) && !this.spCleared(s) && this.enemies.some((e) => e.sp === s.id));
    }
    /** mühürlü (henüz açılmamış) boss evleri */
    sealedHouses() {
        return this.getWorld().spawners.filter((s) => s.tier === 'boss' && s.bridge === undefined && this.bossSealed(s));
    }
    /** mühürlü eve vurulunca nedenini söyler (sessizce hasar yememesin) */
    sealedNudge(sp) {
        if (this.time < this.sealedNudgeT)
            return;
        this.sealedNudgeT = this.time + 2;
        const pr = this.sealProgress(sp.reg);
        this.say('Boss evi mühürlü: önce adadaki diğer kampları temizle (' + pr.done + '/' + pr.need + ')');
        this.houseFlash.set(sp.id, 0.15);
    }
    hitHouse(sp, raw, dtype) {
        const boss = this.enemies.find((e) => e.sp === sp.id);
        if (!boss)
            return;
        this.houseFlash.set(sp.id, 0.15);
        this.hitEnemy(boss, raw * 0.6, dtype);
        this.float(sp.x, sp.y - 50, 'EV', '#ffb36b');
    }
    /** boss evinin içindeyken sağlık kazanılır */
    inBossHouse() {
        return this.bossHouses().some((s) => Math.hypot(s.x - this.px, s.y - this.py) < 130);
    }
    /** Alan hasarı: ring (iksir patlaması) ya da slash (kepçe, ön koni) */
    areaHit(p, cone) {
        const apply = (ex, ey, er) => {
            const d = Math.hypot(ex - p.x, ey - p.y);
            if (d > p.r + er)
                return false;
            if (!cone)
                return true;
            let da = Math.atan2(ey - p.y, ex - p.x) - p.a;
            while (da > Math.PI)
                da -= Math.PI * 2;
            while (da < -Math.PI)
                da += Math.PI * 2;
            return Math.abs(da) < 1.0;
        };
        for (const e of this.enemies) {
            if (apply(e.x, e.y, this.erad(e)))
                this.hitEnemy(e, p.dmg, p.dtype);
        }
        for (const t of this.treesNear(p.x, p.y, p.r + 40)) {
            if (!this.isCleared('t' + t.id) && apply(t.x, t.y, 24))
                this.hitTree(t, p.dmg);
        }
        for (const s of this.bossHouses())
            if (apply(s.x, s.y, 56))
                this.hitHouse(s, p.dmg, p.dtype);
        for (const s of this.sealedHouses())
            if (apply(s.x, s.y, 56))
                this.sealedNudge(s);
        for (const o of this.liveBlds())
            if (apply(o.x, o.y, o.r))
                this.hitBld(o, p.dmg);
    }
    updateProjs(dt) {
        const keep = [];
        const enemies = this.enemies;
        const trees = this.getWorld().trees;
        for (const p of this.projs) {
            p.life += dt;
            if (p.kind === 'bolt' || p.kind === 'arrow') {
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                if (p.kind === 'arrow' && this.arrowHitsHole(p))
                    continue;
                if (p.kind === 'arrow')
                    this.arrowCollide(p, enemies);
                else
                    this.projCollide(p, enemies, trees, 12);
                if (p.life < p.max && p.pierce >= 0)
                    keep.push(p);
            }
            else if (p.kind === 'broom') {
                const sp = 440;
                if (p.phase === 0) {
                    p.x += p.vx * dt;
                    p.y += p.vy * dt;
                    if (Math.hypot(p.x - p.sx, p.y - p.sy) >= p.r) {
                        p.phase = 1;
                        p.hit.clear();
                    }
                }
                else {
                    const dx = this.px - p.x;
                    const dy = this.py - p.y;
                    const d = Math.hypot(dx, dy) || 1;
                    p.x += (dx / d) * sp * dt;
                    p.y += (dy / d) * sp * dt;
                    if (d < 22)
                        continue;
                }
                this.projCollide(p, enemies, trees, 12.2, true); // süpürge toplam %32 küçültüldü (%20 + %15)
                if (p.life < p.max)
                    keep.push(p);
            }
            else if (p.kind === 'potion') {
                const k = Math.min(1, p.life / p.max);
                p.x = p.sx + (p.tx - p.sx) * k;
                p.y = p.sy + (p.ty - p.sy) * k - Math.sin(k * Math.PI) * 70;
                if (p.life >= p.max) {
                    const ring = this.newProj('ring', p.tx, p.ty, p.dmg, p.dtype);
                    ring.r = p.r;
                    ring.max = 0.35;
                    this.areaHit(ring, false);
                    keep.push(ring);
                }
                else
                    keep.push(p);
            }
            else if (p.life < p.max)
                keep.push(p); // ring / slash: yalnızca görsel
        }
        this.projs = keep;
    }
    /** arbalet oku ağaç, kaya ve yapılara takılmaz: yalnız yaratıklara ve boss evlerine vurur (3 hedefi delip geçer) */
    arrowCollide(p, enemies) {
        for (const e of enemies) {
            if (p.hit.has(e) || e.hp <= 0)
                continue;
            if (Math.hypot(e.x - p.x, e.y - p.y) < this.erad(e) + 14) {
                p.hit.add(e);
                // boss ve zor bosslara ok daha çok işler (zırh deliciliği)
                this.hitEnemy(e, p.dmg * (e.tier === 'boss' ? 2 : 1), p.dtype);
                p.pierce--;
                if (p.pierce < 0)
                    return;
            }
        }
        for (const s of this.bossHouses()) {
            if (p.hit.has(s))
                continue;
            if (Math.hypot(s.x - p.x, s.y - p.y) < 56 + 14) {
                p.hit.add(s);
                this.hitHouse(s, p.dmg * 2, p.dtype);
                p.pierce--;
                if (p.pierce < 0)
                    return;
            }
        }
    }
    projCollide(p, enemies, trees, r, once = false) {
        for (const e of enemies) {
            if (p.hit.has(e))
                continue;
            if (Math.hypot(e.x - p.x, e.y - p.y) < this.erad(e) + r) {
                p.hit.add(e);
                this.hitEnemy(e, p.dmg, p.dtype);
                if (!once) {
                    p.pierce--;
                    if (p.pierce < 0)
                        return;
                }
            }
        }
        for (const t of this.treesNear(p.x, p.y, r + 40)) {
            if (p.hit.has(t) || this.isCleared('t' + t.id))
                continue;
            if (Math.hypot(t.x - p.x, t.y - p.y) < 26 + r) {
                p.hit.add(t);
                this.hitTree(t, p.dmg);
                if (!once) {
                    p.pierce--;
                    if (p.pierce < 0)
                        return;
                }
            }
        }
        for (const s of this.sealedHouses())
            if (!p.hit.has(s) && Math.hypot(s.x - p.x, s.y - p.y) < 56 + r) {
                p.hit.add(s);
                this.sealedNudge(s);
            }
        for (const s of this.bossHouses()) {
            if (p.hit.has(s))
                continue;
            if (Math.hypot(s.x - p.x, s.y - p.y) < 56 + r) {
                p.hit.add(s);
                this.hitHouse(s, p.dmg, p.dtype);
                if (!once) {
                    p.pierce--;
                    if (p.pierce < 0)
                        return;
                }
            }
        }
        for (const o of this.liveBlds()) {
            if (p.hit.has(o))
                continue;
            if (Math.hypot(o.x - p.x, o.y - p.y) < o.r + r) {
                p.hit.add(o);
                this.hitBld(o, p.dmg);
                if (!once) {
                    p.pierce--;
                    if (p.pierce < 0)
                        return;
                }
            }
        }
    }
    comboName(a, b) {
        const k = [a, b].sort().join('+');
        return k === 'cut+smash' ? 'Yanan Bumerang' : k === 'cut+pierce' ? 'Yıldızlı Dilim' : 'Delici Patlama';
    }
    /** dev yılan kahramanı sarmış mı (sarana kadar bölümleri vurulamaz) */
    snakeWrapped(e) {
        if (!e.seg)
            return true;
        const S = this.snakes.get(e.seg.gid);
        return !!S && S.wrapped;
    }
    hitEnemy(e, raw, dtype) {
        if (e.seg && !this.snakeWrapped(e)) {
            this.float(0, 0, 'Zırhlı: sarmasını bekle', '#c8b6ff');
            return;
        }
        const crit = Math.random() < this.critChance();
        const cm = this.comboMark.get(e);
        const combo = !!cm && cm.d !== dtype && this.time - cm.t < 1.2;
        this.comboMark.set(e, { d: dtype, t: this.time });
        if (combo && cm) {
            this.float(e.x, e.y - this.erad(e) - 44, 'KOMBO ' + T(this.comboName(cm.d, dtype)), '#ffb347');
            audio.play('gain');
            this.shake = Math.max(this.shake, 2.5);
            this.bumpDaily('combo');
        }
        const rs = e.tier === 'boss' ? Math.max(0.4, e.def.resist[dtype]) : e.def.resist[dtype]; // bosslarda direnç çarpanı en az 0,4: yanlış türle savaş uzamasın
        const dmg = Math.max(1, raw * rs * DMG_DEALT * (crit ? 3 : 1) * (combo ? 1.3 : 1));
        e.hp -= dmg;
        e.flash = 0.14;
        audio.play('hit');
        if ((e.tier === 'boss' || e.tier === 'hard') && !e.seg) {
            // her %10'luk zararda 5 sn süpürge uçuşu
            const bucket = Math.min(10, Math.floor((1 - Math.max(0, e.hp) / e.maxHp) * 10));
            const prev = this.flyMark.get(e) ?? 0;
            this.flyMark.set(e, bucket);
            if (bucket > prev) {
                this.flyT = 5;
                audio.play('fly');
                this.gain('Süpürge uçuşu! 5 sn dokunulmazsın', '#c8b6ff', 'icon_broom');
            }
        }
        if (this.lifesteal() > 0)
            this.hp = Math.min(this.maxHp(), this.hp + dmg * this.lifesteal());
        if (e.state === 'idle')
            e.state = 'chase';
        this.feedDealt(dmg, crit);
    }
    treeMaxHp(t) { return (t.big ? 30 : 9) * ZONES[t.reg].scale * t.s; }
    hitTree(t, raw) {
        if (this.bonus)
            return;
        const maxHp = this.treeMaxHp(t);
        const hp = (this.treeHp.get(t.id) ?? maxHp) - raw;
        this.feedDealt(raw, false);
        audio.play('chop');
        if (hp <= 0)
            this.chopTree(t);
        else
            this.treeHp.set(t.id, hp);
    }
    removeDead() {
        const alive = [];
        const finished = new Set();
        for (const e of this.enemies) {
            if (e.hp > 0) {
                alive.push(e);
                continue;
            }
            this.killEnemy(e);
            finished.add(e.sp);
        }
        if (finished.size === 0)
            return;
        this.enemies = alive;
        for (const id of finished) {
            if (!this.enemies.some((e) => e.sp === id))
                this.completeSpawner(id);
        }
    }
    fmt(n) {
        return n < 1e4 ? String(Math.ceil(n)) : fmtNum(n);
    }
    addPerm(k, v) { this.save.perm[k] = (this.save.perm[k] ?? 0) + v; }
    /** can havuzu: yüzde kazançlar bunun üzerine eklenir */
    hpPool() { return 100 + this.perm('normal.hp') + this.perm('elite.hp') + this.perm('tree.hp'); }
    /** hasar havuzu: kuşanılan büyülerin (seviyeli) taban hasarı + kalıcı hasar ortalaması */
    dmgPool() {
        const eq = this.equippedWeapons();
        if (!eq.length)
            return 40;
        let t = 0;
        for (const i of eq)
            t += WEAPONS[i].baseDmg * (1 + 0.15 * (this.save.weapons[i] - 1)) + this.perm('normal.dmg') + this.perm('elite.dmg');
        return t / eq.length;
    }
    /** bir adadaki bütün kalıcı kazanç kaynaklarının (kamp + ağaç) toplam ağırlığı */
    regionWeight(reg) {
        const hit = this.weightCache.get(reg);
        if (hit !== undefined)
            return hit;
        const L = ZONES[reg].layout;
        const camps = Object.keys(L).reduce((a, t) => a + CAMP_WEIGHT[t] * L[t], 0);
        const total = camps + ZONES[reg].resTrees * 0.3 + (80 + Math.min(reg, 10) * 6) * 0.02;
        this.weightCache.set(reg, total);
        return total;
    }
    /** bir adanın boss'unun gücü (kalıcı kazancın hedefi bunun MARGIN katıdır) */
    bossPower(reg) {
        const sp = this.zoneWorld(reg).spawners.find((x) => x.reg === reg && x.tier === 'boss' && x.bridge === undefined);
        if (!sp)
            return 1e9;
        const def = ENEMIES[sp.kind];
        const maxHp = def.hp * TIERS.boss.hp * ZONES[reg].scale * sp.lv;
        const dmg = def.dmg * TIERS.boss.dmg * ZONES[reg].dmgScale * Math.sqrt(sp.lv);
        return (Math.sqrt(maxHp * (dmg / 0.6)) * 10) / BOSS_MUL; // kazanç hedefi eski boss gücüne göre: boss 2 kat zorlaşır, oyuncu onunla büyümez
    }
    /** bu adadaki boss'un azami canı: binalar da bu kadar candır */
    bldMaxHp(o) {
        const reg = Math.floor(o.id / 100);
        const sp = this.zoneWorld(reg).spawners.find((x) => x.reg === reg && x.tier === 'boss' && x.bridge === undefined);
        if (!sp)
            return 1e9;
        return (ENEMIES[sp.kind].hp * TIERS.boss.hp * ZONES[reg].scale * sp.lv) / ((o.kind === 'rock' ? 8 : o.div) * BOSS_MUL); // yapı canı değişmedi; kırılabilir kaya boss/8
    }
    bldDown(o) { return (o.kind === 'bld' || !!o.brk) && this.isCleared('o' + o.id); }
    liveBlds() {
        return this.world && !this.bonus ? this.world.obstacles.filter((o) => (o.kind === 'bld' || !!o.brk) && !this.bldDown(o)) : [];
    }
    hitBld(o, raw) {
        if (this.bonus)
            return;
        const max = this.bldMaxHp(o);
        const hp = (this.bldHp.get(o.id) ?? max) - raw;
        this.bldFlash.set(o.id, 0.12);
        audio.play('hit');
        this.feedDealt(raw, false);
        if (hp > 0) {
            this.bldHp.set(o.id, hp);
            return;
        }
        this.bldHp.delete(o.id);
        if (o.kind === 'rock') {
            // kırılabilir kaya: parçalanır, küçük toz ve can verir, 3 dk sonra yeniden belirir (kalıcı kazanç yok)
            this.save.spawn['o' + o.id] = this.now() + (this.noRespawn(this.region) ? 1e12 : 180 * 1000);
            const dust = Math.max(1, Math.round(2 * (1 + o.id / 100 / 10)));
            this.save.dust += dust;
            this.hp = Math.min(this.maxHp(), this.hp + this.maxHp() * 0.01);
            audio.play('kill');
            this.deathFx.push({ x: o.x, y: o.y, t: 0.45, name: o.art, size: o.size, flip: o.flip });
            // ilk parçalanışta kaplana kalıcı saldırı gücü (yeniden doğan kaya tekrar vermez: tarlacılık yok)
            const firstRock = !this.save.first['o' + o.id];
            this.save.first['o' + o.id] = 1;
            if (firstRock) {
                this.tigerInit();
                this.save.tiger.dpsBase *= 1.02;
                this.gain('+%2 Kaplan saldırı gücü (kalıcı, kaya)', '#ffb36b', 'ui_dust');
            }
            this.gain('+' + dust + ' Toz (kaya parçalandı)', '#ffd1f0', 'ui_dust');
            this.persist();
            this.onChange();
            return;
        }
        this.save.spawn['o' + o.id] = this.now() + (this.noRespawn(this.region) ? 1e12 : 600 * 1000); // 10 dk sonra yeniden kurulur (21. adadan sonra bir daha kurulmaz)
        const firstDown = !this.save.first['o' + o.id];
        this.save.first['o' + o.id] = 1;
        if (firstDown)
            this.addPerm('elite.hp', 0.02 * this.hpPool()); // ilk yıkışta kalıcı +%2 can
        const h = Math.min(this.maxHp() - this.hp, this.maxHp() * 0.02);
        this.hp += h;
        audio.play('kill');
        this.deathFx.push({ x: o.x, y: o.y, t: 0.45, name: o.art, size: o.size, flip: o.flip });
        this.releaseNest(o);
        this.gain('+' + this.fmt(this.maxHp() * 0.02) + (firstDown ? ' Can kazanıldı (kalıcı, yapı)' : ' Can iyileşti (yıkılan yapı)'), '#7bff9a', 'ui_heart');
        this.persist();
        this.onChange();
    }
    /**
     * Kalıcı harita kazancı: adadaki kalan kazanç kaynakları arasında, güç o adanın boss gücünün MARGIN katına ulaşacak
     * şekilde paylaştırılır. Oyuncu zaten güçlüyse (yetenek/silah/kristal yüzünden) kazanç 0'dır; bu yüzden hiçbir yol
     * oyuncuyu adanın zorluğundan fazla ileri taşımaz ve her ada 1.2–1.8 kat daha zordur.
     */
    grantFraction(reg, w) {
        const total = this.regionWeight(reg);
        const done = this.save.gw[reg] ?? 0;
        const rem = Math.max(w, total - done);
        this.save.gw[reg] = done + w;
        let cap = this.bossPower(reg) * Game.MARGIN * softCap(reg); // 101. adadan sonra tavan düşer: fark güç paketleriyle kapanır
        const rb = this.save.rebirth;
        // yeniden doğuş turunda tavan, sıfırlama anındaki güçten (p0) 3 katına yumuşakça yükselir: eski adaları baştan yaparak güç yine artar
        if (rb && rb.n > 0)
            cap = Math.max(cap, rb.p0 * Math.pow(Game.RB_G, Math.min(1, (reg + 1) / Math.max(1, rb.floor))));
        const P = Math.max(1, this.fullPower() / this.shopMul()); // satın alınan güç, ücretsiz ilerleme kazancını etkilemez
        if (P >= cap)
            return 0;
        return Math.pow(cap / P, Math.min(1, w / rem)) - 1;
    }
    chopTree(t) {
        this.bumpDaily('trees');
        this.save.spawn['t' + t.id] = this.now() + (t.big ? TREE_RESPAWN * 2 : TREE_RESPAWN) * 1000;
        this.treeHp.delete(t.id);
        const before = this.maxHp();
        const first = !this.save.first['t' + t.id];
        this.save.first['t' + t.id] = 1;
        // ağaç yalnızca can ve yenilenme verir: ilk kesim tam, tekrarlar çok az (sonsuz çiftlik yok)
        const f = first ? this.grantFraction(t.reg, t.big ? 0.3 : 0.02) : 0;
        this.addPerm('tree.hp', f * this.hpPool());
        this.addPerm('tree.regen', (t.big ? 0.0004 : 0.00008) * this.maxHp() * (first ? 1 : 0.2));
        const dh = this.maxHp() - before;
        if (dh > 0)
            this.gain('+' + this.fmt(dh) + ' Can kazanıldı', '#7bff9a', 'ui_heart', { key: 'hp', amount: dh, fmt: (n) => '+' + this.fmt(n) + ' Can kazanıldı' });
        this.persist();
        this.onChange();
    }
    killEnemy(e) {
        if (e.sp === REFL_SP) {
            this.reflDefeated(e);
            return;
        }
        if (e.sp === BEE_SP) {
            audio.play('kill');
            this.deathFx.push({ x: e.x, y: e.y, t: 0.3, name: BEE_KINDS[e.bee ?? 0].spr, size: this.erad(e) * 3.3, flip: e.flip });
            return;
        }
        if (e.sp === BONUS_SP) {
            audio.play('kill');
            this.deathFx.push({ x: e.x, y: e.y, t: 0.3, name: e.def.id, size: e.def.r * 3, flip: e.flip });
            return;
        }
        this.save.kills++;
        this.bumpDaily('kills');
        if (e.def.id === 'snake' && !e.seg)
            this.bumpDaily('snakes');
        if (e.seg)
            this.snakeSegDied(e);
        // kaplan yılan öldürerek daha hızlı güçlenir: küçük yılan 2, dev yılan bölümü 3 sayılır
        if (e.tg) {
            audio.play('tigerroar');
            this.tigerCredit(e.def.id === 'snake' ? (e.seg ? 3 : 2) : 1);
            this.tigerKillHeal(e);
        }
        this.shake = Math.max(this.shake, e.tier === 'boss' ? 10 : 1.5);
        audio.play(e.beast ? 'beastdie' : e.tier === 'boss' ? 'boss' : 'kill');
        if (e.tier === 'boss')
            vibrate([60, 40, 120]);
        const value = Math.max(1, Math.round(e.def.drop * TIERS[e.tier].soul * Math.pow(ZONES[e.reg].scale, 0.7) * Math.sqrt(e.lv) * this.yieldMul() * Game.YIELD));
        // ganimet otomatik toplanır, etkisi yazıyla gösterilir
        this.save.essence += value;
        this.gain('+' + this.fmt(value) + ' Ruh', '#8fdcff', 'ui_soul', { key: 'soul', amount: value, fmt: (n) => '+' + this.fmt(n) + ' Ruh' });
        this.deathFx.push({ x: e.x, y: e.y, t: 0.45, name: e.beast && this.spr(ZONES[e.reg].art.beast) ? ZONES[e.reg].art.beast : e.tier === 'boss' ? ZONES[e.reg].art.boss : e.def.id,
            size: this.erad(e) * 3.3, flip: e.flip });
        this.onChange();
    }
    completeSpawner(id) {
        this.getWorld();
        const sp = this.spawnerMap.get(id);
        if (!sp)
            return;
        const tier = TIERS[sp.tier];
        this.save.spawn['s' + id] = this.now() + (sp.hard ? 24 * 3600 * 1000 : sp.tier === 'boss' || this.noRespawn(sp.reg) ? 1e12 : tier.respawn * 1000); // ada bossu bir daha çıkmaz; zor boss günde bir
        if (sp.bridge === undefined && sp.tier !== 'boss')
            this.bumpDaily('camps');
        if (sp.id >= 100000 && sp.id < 200000 && sp.bridge !== undefined && !this.save.first['bx' + sp.bridge] && this.bridgeOpen(sp.bridge)) {
            this.save.first['bx' + sp.bridge] = 1;
            this.exitAnim = { i: sp.bridge, t: 3.6 };
            audio.play('gate');
            vibrate([80, 60, 200]);
            this.say('Köprü bekçileri yenildi: köprü kapısı açıldı');
        }
        const lvK = Math.sqrt(sp.lv);
        const hp0 = this.maxHp();
        const eq0 = this.equippedWeapons();
        const dmg0 = eq0.length ? this.weaponDmg(eq0[0]) : 0;
        // kalıcı güç: bir adanın bütün kampları temizlenince güç, sonraki adanın zorluk artışını (×1.2–1.8) karşılayacak kadar artar.
        // İlk temizleme tam kazanç verir; kampın tekrar temizlenmesi çok az (çiftlik yapılamaz). Kazanç, mevcut canın/hasarın yüzdesidir.
        const first = !this.save.first['s' + id];
        const wasSealed = this.getWorld().spawners.some((x) => x.reg === sp.reg && this.bossSealed(x));
        this.save.first['s' + id] = 1;
        if (first && this.getWorld().chests.some((ch) => ch.mode === 'drop' && ch.src === id)) {
            this.say('Bir sandık belirdi!');
            audio.play('chest');
        }
        if (wasSealed && !this.getWorld().spawners.some((x) => x.reg === sp.reg && this.bossSealed(x))) {
            this.say('Boss evinin mührü kalktı!');
            audio.play('gate');
        }
        const f = first && sp.bridge === undefined ? this.grantFraction(sp.reg, CAMP_WEIGHT[sp.tier]) : 0;
        this.addPerm(sp.tier === 'boss' || tier.permanent === 'elite' ? 'elite.hp' : 'normal.hp', f * this.hpPool());
        this.addPerm(sp.tier === 'boss' || tier.permanent === 'elite' ? 'elite.dmg' : 'normal.dmg', f * this.dmgPool());
        if (this.maxHp() > hp0) {
            const dh = this.maxHp() - hp0;
            this.gain('+' + this.fmt(dh) + ' Can kazanıldı', '#7bff9a', 'ui_heart', { key: 'hp', amount: dh, fmt: (n) => '+' + this.fmt(n) + ' Can kazanıldı' });
        }
        if (eq0.length && this.weaponDmg(eq0[0]) > dmg0) {
            const dd = this.weaponDmg(eq0[0]) - dmg0;
            this.gain('+' + this.fmt(dd) + ' Hasar kazanıldı', '#ffb36b', 'ui_power', { key: 'dmg', amount: dd, fmt: (n) => '+' + this.fmt(n) + ' Hasar kazanıldı' });
        }
        const pool = sp.tier === 'easy' ? [0, 1] : sp.tier === 'medium' ? [1, 2] : sp.tier === 'hard' ? [2, 3] : [0, 1, 2, 3];
        const wi = pool[Math.floor(Math.random() * pool.length)];
        const n = Math.max(1, Math.round(tier.weaponCopies * (1 + sp.reg) * lvK));
        this.save.copies[wi] += n;
        if (this.save.weapons[wi] === 0 && this.save.copies[wi] >= WEAPONS[wi].unlockCopies) {
            this.save.copies[wi] -= WEAPONS[wi].unlockCopies;
            this.save.weapons[wi] = 1;
            this.autoEquip(wi);
            this.say(WEAPONS[wi].name + ' açıldı!');
        }
        this.gain(`+${n} ${WEAPONS[wi].name} kopyası`, '#ffd84a', 'icon_' + WEAPONS[wi].id);
        if (Math.random() < 0.12) {
            const h = Math.min(this.maxHp() - this.hp, this.maxHp() * 0.15);
            this.hp += h;
            if (h > 0)
                this.gain('+' + this.fmt(h) + ' Can iyileşti', '#7bff9a', 'ui_heart');
        }
        if (sp.tag)
            this.gainItem(sp.tag, Math.min(4, 1 + sp.reg));
        if (sp.tier === 'elite') {
            this.save.geodes++;
            this.gain('+1 Jeod', '#7dffb0', 'icon_geode');
        }
        // toz: kristal geliştirmenin yakıtı; elit/muhafız/boss kamplarından ve canavarlardan düşer
        const dustBase = { easy: 0, medium: 0, hard: 1, elite: 3, knight: 3, boss: 10 }[sp.tier] * (sp.beast ? 2 : 1) * (sp.hard ? 2 : 1);
        const dustGain = Math.round(dustBase * (1 + sp.reg / 10));
        if (dustGain > 0) {
            this.save.dust += dustGain;
            this.gain('+' + dustGain + ' Toz', '#ffd1f0', 'ui_dust', { key: 'dust', amount: dustGain, fmt: (n) => '+' + n + ' Toz' });
        }
        if (sp.hard) {
            const ess = this.soupYield(6 * 3.6e6);
            this.save.geodes += 5;
            this.save.essence += ess;
            this.gain('+5 Jeod', '#7dffb0', 'icon_geode');
            this.gain('+' + this.fmt(ess) + ' Ruh', '#8fdcff', 'ui_soul');
            this.gainItem('helmet', 4);
            this.gainItem('shield', 4);
            this.say('Zor boss yenildi! Yarın yine çıkar.');
        }
        else if (sp.beast) {
            this.save.geodes += 3;
            this.gain('+3 Jeod', '#7dffb0', 'icon_geode');
            this.gainItem('helmet', Math.min(4, 3));
            this.gainItem('shield', Math.min(4, 3));
            this.say('Canavar yenildi!');
        }
        else if (sp.tier === 'boss' && sp.bridge !== undefined) {
            // köprü bossu: ganimet verir, kapıyı etkilemez
            this.save.geodes += 2;
            this.gain('+2 Jeod', '#7dffb0', 'icon_geode');
            this.gainItem(sp.reg % 2 === 0 ? 'helmet' : 'shield', Math.min(4, 2 + Math.floor(sp.reg / 12)));
            this.say('Köprü bekçisi yenildi!');
        }
        else if (sp.tier === 'boss') {
            this.save.geodes += 3;
            this.gain('+3 Jeod', '#7dffb0', 'icon_geode');
            this.gainItem('helmet', 2);
            this.gainItem('shield', 2);
            if (!this.save.bossDown[sp.reg]) {
                this.save.bossDown[sp.reg] = true;
                this.addMirrorShard(sp.reg);
                this.gain('Günlüğe yeni sayfa eklendi', '#ffe9a0', 'ui_skill');
                this.onStory(sp.reg);
                this.provoke(sp.reg);
                this.unlockOutfits();
                this.mgUnlockCheck();
                if (this.bossesDown() % 10 === 0) {
                    this.gain('Yeni kristal yuvası kazanıldı!', '#c8b6ff', 'ui_crystal');
                    this.gain('Yeni ekipman yuvası kazanıldı!', '#ffe36b', 'ui_gear');
                }
                const lastIsland = sp.reg >= ZONES.length - 1;
                if (!lastIsland && !this.paywalled(sp.reg)) {
                    this.gateAnim = { i: sp.reg, t: 3.6 };
                    audio.play('gate');
                    vibrate([80, 60, 200]);
                }
                if (lastIsland)
                    this.say(ZONES[sp.reg].bossName + ' yenildi! Ama bir gölge seni bekliyor…');
                else if (this.paywalled(sp.reg)) {
                    this.say(ZONES[sp.reg].bossName + ' yenildi!');
                    this.paywallT = 120;
                    this.startDoom();
                }
                else
                    this.say(ZONES[sp.reg].bossName + ' yenildi! Sonraki bölgenin kapısı açıldı.');
            }
            else
                this.say(ZONES[sp.reg].bossName + ' yenildi!');
        }
        this.persist();
        this.onChange();
    }
    /** sandık şu an görünür mü (haritada ve sahnede) */
    chestShown(c, near = 170) {
        if (this.bonus)
            return false;
        if (this.save.chests.includes(c.id))
            return true;
        if (c.mode === 'visible')
            return true;
        if (c.mode === 'drop')
            return !!(c.src !== undefined && this.save.first['s' + c.src]);
        return Math.hypot(c.x - this.px, c.y - this.py) < near; // hidden
    }
    checkChests() {
        for (const c of this.getWorld().chests) {
            if (this.save.chests.includes(c.id))
                continue;
            if (c.mode === 'drop' && !this.chestShown(c))
                continue;
            if (Math.hypot(c.x - this.px, c.y - this.py) < 28)
                this.openChest(c);
        }
    }
    /** sandığı açar: kalıcı özellik, ruh ve jeod verir (yakınlık şartı yok; özel büyü de bunu kullanır) */
    openChest(c) {
        if (this.save.chests.includes(c.id))
            return;
        this.save.chests.push(c.id);
        this.bumpDaily('chests');
        audio.play('chest');
        vibrate(60);
        const stat = CSTAT_KEYS[Math.floor(Math.random() * CSTAT_KEYS.length)];
        const amt = CRYSTAL_STATS[stat].base * 0.6;
        this.save.chestBonus[stat] = (this.save.chestBonus[stat] ?? 0) + amt;
        const souls = Math.round(40 * Math.pow(ZONES[c.reg].scale, 0.7) * this.yieldMul());
        this.save.essence += souls;
        this.save.geodes += 1;
        this.say('Gizli sandık bulundu! (' + this.chestsOpened(c.reg) + '/6)');
        this.gain('+' + amt.toFixed(1) + CRYSTAL_STATS[stat].unit + ' ' + CRYSTAL_STATS[stat].name + ' kazanıldı (kalıcı)', '#ffd84a', statIcon(stat));
        this.gain('+' + this.fmt(souls) + ' Ruh', '#8fdcff', 'ui_soul');
        this.gain('+1 Jeod', '#7dffb0', 'icon_geode');
        this.persist();
        this.onChange();
    }
    die() {
        this.endBonus();
        this.endSwarm(false);
        this.novaT = 0;
        this.dead = 2.5;
        vibrate(250);
        this.save.deaths++;
        this.persist();
        this.say('Bayıldın… düşmanlar kamplarına döndü.');
    }
    respawn() {
        this.hp = this.maxHp();
        const rp = this.restPoints()[Math.min(this.region, this.restPoints().length - 1)]; // bulunduğumuz adanın dinlenme noktasında uyanırız
        this.px = rp.x;
        this.py = rp.y + 70;
        for (const e of this.enemies)
            e.state = 'return';
        this.projs = [];
        this.invuln = 2;
    }
    say(text) { this.banner = N(T(text)); this.bannerT = 4; }
    float(_x, _y, text, color) {
        const last = this.feed[this.feed.length - 1];
        if (last && last.text === text && last.t > 1.8) {
            last.n++;
            last.t = 2.2;
            return;
        }
        this.feed.push({ text, color, t: 2.2, n: 1 });
        if (this.feed.length > 6)
            this.feed.shift();
    }
    /** verilen hasar tek satırda toplanır (her vuruş için ayrı sayı çıkmaz) */
    feedDealt(dmg, crit) {
        const d = this.dealt;
        if (d.t <= 0) {
            d.sum = 0;
            d.hits = 0;
            d.crit = false;
        }
        d.sum += dmg;
        d.hits++;
        d.crit = d.crit || crit;
        d.t = 1.4;
    }
    campProgress(reg = this.region) {
        const sps = this.getWorld().spawners.filter((s) => s.reg === reg && !s.hard);
        return { done: sps.filter((s) => this.spCleared(s)).length, total: sps.length };
    }
    // ---- usta cadılar (kapı başında eğitim) ----
    masterPos(i) {
        const g = this.gatePos(i);
        const b = this.bridge(i);
        const ang = Math.atan2(b.by - b.ay, b.bx - b.ax);
        // kapının bu bölge tarafında, köprünün kenarında
        return { x: g.x - Math.cos(ang) * 150 - Math.sin(ang) * 150, y: g.y - Math.sin(ang) * 150 + Math.cos(ang) * 150 };
    }
    /** yakındaki usta cadının numarası, yoksa -1 */
    nearMaster() {
        const [m0, m1] = this.winRange();
        for (let i = m0; i <= m1 && i < ZONES.length - 1; i++) {
            if (!this.masterOpen(i))
                continue;
            const m = this.masterPos(i);
            if (Math.hypot(m.x - this.px, m.y - this.py) < 130)
                return i;
        }
        return -1;
    }
    /** usta cadı yalnızca o seviyenin boss'u yenilince ortaya çıkar */
    masterOpen(i) { return !this.oldGamesClosed() && !!this.save.bossDown[i] && this.trainPlaysLeft(i) > 0; }
    dayNo() { return Math.floor((this.now() - new Date().getTimezoneOffset() * -60000) / 86400000); }
    /** bugün bu usta için kalan eğitim hakkı (her seviye için günde 2) */
    trainPlaysLeft(master) {
        const used = this.save.train['d' + master] === this.dayNo() ? (this.save.train['n' + master] ?? 0) : 0;
        return Math.max(0, Game.TRAIN_PER_DAY - used);
    }
    /** hakkı harcar; hak yoksa false */
    startTraining(master) {
        if (!this.masterOpen(master) || this.trainPlaysLeft(master) <= 0)
            return false;
        const n = Game.TRAIN_PER_DAY - this.trainPlaysLeft(master) + 1;
        this.save.train['d' + master] = this.dayNo();
        this.save.train['n' + master] = n;
        this.persist();
        return true;
    }
    /** mini oyun bitti: puana göre kalıcı güç kazanılır (0..1) */
    finishTraining(master, kind, score) {
        const k = Math.max(0, Math.min(1, score)) * (1 + master * 0.1);
        if (kind === 'timing') {
            const eq = this.equippedWeapons();
            const d0 = eq.length ? this.weaponDmg(eq[0]) : 0;
            this.addPerm('train.dmg', 4 * k);
            if (eq.length)
                this.gain('+' + this.fmt(this.weaponDmg(eq[0]) - d0) + ' Hasar kazanıldı (eğitim)', '#ffb36b', 'ui_power');
        }
        else if (kind === 'memory') {
            const h0 = this.maxHp();
            this.addPerm('train.hp', 5 * k);
            this.gain('+' + this.fmt(this.maxHp() - h0) + ' Can kazanıldı (eğitim)', '#7bff9a', 'ui_heart');
        }
        else if (kind === 'honey') {
            this.addPerm('train.magnet', 6 * k);
            this.gain('+' + (6 * k).toFixed(1) + ' Mıknatıs menzili kazanıldı (eğitim)', '#ffe36b', 'ui_magnet');
        }
        else if (kind === 'cards') {
            this.addPerm('train.crit', 0.5 * k);
            this.gain('+%' + (0.5 * k).toFixed(2) + ' Kritik şansı kazanıldı (eğitim)', '#ffb36b', 'ui_power');
        }
        else if (kind === 'broom') {
            this.addPerm('train.speed', 1.2 * k);
            this.gain('+%' + (1.2 * k).toFixed(2) + ' Hız kazanıldı (eğitim)', '#9be7ff', 'ui_speed');
        }
        else {
            this.addPerm('train.regen', 0.4 * k);
            this.gain('+' + (0.4 * k).toFixed(2) + ' Yenilenme/sn kazanıldı (eğitim)', '#9be7ff', 'ui_regen');
        }
        this.persist();
        this.onChange();
    }
    /** Ekrana dokunma: minimap → büyük harita, büyük harita → kapat, usta cadı → eğitim */
    handleTap(x, y) {
        if (this.doom && this.doom.t >= Game.DOOM_FALL) {
            this.onPaywall();
            return true;
        }
        if (this.mapOpen) {
            this.mapOpen = false;
            return true;
        }
        if (Math.hypot(x - this.mini.x, y - this.mini.y) <= this.mini.r) {
            this.mapMode = 'island';
            this.mapOpen = true;
            return true;
        }
        const [m0, m1] = this.winRange();
        for (let i = m0; i <= m1 && i < ZONES.length - 1; i++) {
            if (!this.masterOpen(i))
                continue;
            const m = this.masterPos(i);
            const sx = this.w / 2 + (m.x - this.px) * this.zoom;
            const sy = this.h / 2 + (m.y - this.py) * this.zoom;
            if (Math.hypot(x - sx, y - sy) < 60 && Math.hypot(m.x - this.px, m.y - this.py) < 220) {
                this.onMaster(i);
                return true;
            }
        }
        // bulunmuş elmas madeni: yakındayken dokununca maden oyunu açılır
        for (const r of this.save.mines) {
            if (Math.abs(r - this.region) > 1)
                continue;
            const m = this.mineSpot(r);
            const sx = this.w / 2 + (m.x - this.px) * this.zoom;
            const sy = this.h / 2 + (m.y - this.py) * this.zoom;
            if (Math.hypot(x - sx, y - (sy - 30 * this.zoom)) < 80 * this.zoom + 20) {
                if (Math.hypot(m.x - this.px, m.y - this.py) > 260) {
                    this.say('Madene yaklaş, sonra dokun');
                    return true;
                }
                if (this.oldGamesClosed()) {
                    this.say('Maden kapandı: yalnızca iksir kazanı kaldı');
                    return true;
                }
                const left = this.mineCdLeftMs(r);
                if (left > 0) {
                    this.say('Maden dinleniyor: ' + Math.ceil(left / 60000) + ' dk sonra yeniden girilir');
                    return true;
                }
                this.onMine(r);
                return true;
            }
        }
        return false;
    }
    // ---- çizim ----
    render() {
        const c = this.ctx;
        this.vw = this.w / this.zoom;
        this.vh = this.h / this.zoom;
        const camX = this.px - this.vw / 2 + (this.shake > 0.3 ? (Math.random() - 0.5) * this.shake : 0);
        const camY = this.py - this.vh / 2 + (this.shake > 0.3 ? (Math.random() - 0.5) * this.shake : 0);
        c.save();
        c.scale(this.zoom, this.zoom); // sanal ekran (vw×vh) gerçek ekrana sığdırılır
        c.fillStyle = '#0c2742';
        c.fillRect(0, 0, this.vw, this.vh);
        this.drawSeaWaves(camX, camY);
        this.drawLand(camX, camY);
        c.save();
        c.translate(-camX, -camY);
        this.drawWorldObjects(camX, camY);
        this.drawHome(camX, camY);
        this.drawShrooms(camX, camY);
        this.drawPickMush(camX, camY);
        this.drawObstacles(camX, camY, false);
        {
            const [m0, m1] = this.winRange();
            for (let i = m0; i <= m1 && i < ZONES.length - 1; i++)
                this.drawMaster(i, camX, camY);
        }
        for (const d of this.deathFx)
            this.drawDeath(d);
        for (const e of this.enemies)
            if (this.inView(e.x, e.y, 140, camX, camY))
                this.drawEnemy(e);
        this.drawMines(camX, camY);
        this.drawHole();
        this.drawSpores();
        this.drawTiger();
        this.drawVillagerQuest(false);
        this.drawChicken();
        this.drawVenoms();
        this.drawPlayer();
        this.drawVillagerQuest(true);
        this.drawAim();
        this.drawObstacles(camX, camY, true);
        for (const p of this.projs)
            this.drawProj(p);
        this.drawFog(camX, camY);
        c.font = `bold ${Math.round(13 * this.lk())}px sans-serif`;
        c.textAlign = 'center';
        for (const f of this.floaters) {
            c.globalAlpha = Math.min(1, f.t * 2);
            c.fillStyle = f.color;
            c.fillText(f.text, f.x, f.y);
        }
        c.globalAlpha = 1;
        c.restore();
        c.restore();
        this.drawDoom();
        this.ambient.update(0.016, this.w, this.h);
        this.ambient.draw(c, this.w, this.h, this.region, this.time);
        drawVignette(c, this.w, this.h);
        this.drawFocusVignette();
        this.drawPotion();
        this.drawBrewHud();
        this.drawCurseHud();
        this.drawNova();
        this.drawBonusIntro();
        this.drawRaidIntro();
        this.drawGains();
        this.drawFeed();
        this.drawGateBanner();
        this.drawHud();
        this.drawMinimap();
        this.drawGuide();
        this.drawLoading();
        if (this.mapOpen) {
            if (this.mapMode === 'island')
                this.drawIslandMap();
            else
                this.drawFullMap();
        }
    }
    inView(x, y, m, camX, camY) {
        return x > camX - m && x < camX + this.vw + m && y > camY - m && y < camY + this.vh + m;
    }
    /** animasyonlu sprite: ayak noktasından döner/ezilir, yön çevirir, vurulunca parlar */
    drawSprX(name, x, y, size, o = {}) {
        const img = this.spr(name);
        if (!img)
            return false;
        const c = this.ctx;
        c.save();
        c.translate(x, y + size * 0.32 + (o.bob ?? 0));
        if (o.rot)
            c.rotate(o.rot);
        c.scale((o.flip ?? 1) * (o.sx ?? 1), o.sy ?? 1);
        if (o.alpha !== undefined)
            c.globalAlpha = o.alpha;
        if (o.flash && 'filter' in c)
            c.filter = 'brightness(2.4) saturate(0.6)';
        c.drawImage(img, -size / 2, -size * 0.82, size, size);
        c.restore();
        return true;
    }
    drawSeaWaves(camX, camY) {
        const c = this.ctx;
        c.strokeStyle = 'rgba(120,180,255,0.10)';
        c.lineWidth = 2;
        const s = 120;
        for (let x = Math.floor(camX / s) * s; x < camX + this.vw + s; x += s) {
            for (let y = Math.floor(camY / s) * s; y < camY + this.vh + s; y += s) {
                const o = Math.sin(this.time * 1.2 + x * 0.05 + y * 0.03) * 6;
                c.beginPath();
                c.moveTo(x - camX, y - camY + o);
                c.quadraticCurveTo(x - camX + 20, y - camY + o - 8, x - camX + 40, y - camY + o);
                c.stroke();
            }
        }
    }
    drawLand(camX, camY) {
        const c = this.ctx;
        const [w0, w1] = this.winRange();
        ZONES.slice(w0, w1 + 1).forEach((zone) => {
            const cx = zone.cx - camX;
            const cy = zone.cy - camY;
            if (cx + zone.radius + 60 < 0 || cx - zone.radius - 60 > this.vw || cy + zone.radius + 60 < 0 || cy - zone.radius - 60 > this.vh)
                return;
            drawShore(c, cx, cy, zone.radius, this.time, shade(zone.dot, 1.45));
        });
        for (let i = w0; i <= w1 && i < ZONES.length - 1; i++)
            drawBridge(c, this.bridge(i), i, camX, camY, this.vw, this.vh, this.time, this.gateLocked(i), !this.bridgeOpen(i));
        ZONES.slice(w0, w1 + 1).forEach((zone, zi) => {
            const reg = w0 + zi;
            const cx = zone.cx - camX;
            const cy = zone.cy - camY;
            if (cx + zone.radius < 0 || cx - zone.radius > this.vw || cy + zone.radius < 0 || cy - zone.radius > this.vh)
                return;
            c.save();
            c.beginPath();
            c.arc(cx, cy, zone.radius, 0, Math.PI * 2);
            c.fillStyle = zone.bg;
            c.fill();
            c.clip();
            this.drawGround(camX, camY, zone.dot, reg);
            c.restore();
            c.strokeStyle = 'rgba(255,255,255,0.18)';
            c.lineWidth = 6;
            c.beginPath();
            c.arc(cx, cy, zone.radius, 0, Math.PI * 2);
            c.stroke();
        });
    }
    drawGround(camX, camY, dot, reg) {
        const c = this.ctx;
        const tile = this.spr(ZONES[reg].art.ground);
        if (tile) {
            const T = 256;
            c.globalAlpha = 0.9; // ada zemini %10 daha saydam: üstündeki nesneler net seçilir
            for (let x = Math.floor(camX / T) * T; x < camX + this.vw + T; x += T) {
                for (let y = Math.floor(camY / T) * T; y < camY + this.vh + T; y += T)
                    c.drawImage(tile, x - camX, y - camY, T, T);
            }
            c.globalAlpha = 1;
            return;
        }
        const s = 70;
        c.fillStyle = dot;
        for (let x = Math.floor(camX / s) * s; x < camX + this.vw + s; x += s) {
            for (let y = Math.floor(camY / s) * s; y < camY + this.vh + s; y += s) {
                const hsh = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
                const r = hsh - Math.floor(hsh);
                c.beginPath();
                c.arc(x - camX + r * s, y - camY + ((r * 7) % 1) * s, 2 + r * 3, 0, Math.PI * 2);
                c.fill();
            }
        }
    }
    drawTreeSprite(t, camTime) {
        const c = this.ctx;
        const size = (t.big ? 84 : 60) * t.s * (t.big ? 1 : 1);
        const sway = Math.sin(camTime * 1.3 + t.id) * 0.03;
        if (t.big) {
            const g = c.createRadialGradient(t.x, t.y, 4, t.x, t.y, 52);
            g.addColorStop(0, 'rgba(255,216,74,0.35)');
            g.addColorStop(1, 'rgba(255,216,74,0)');
            c.fillStyle = g;
            c.beginPath();
            c.arc(t.x, t.y, 52, 0, Math.PI * 2);
            c.fill();
        }
        const name = ZONES[t.reg].art.tree;
        if (this.drawSprX(name, t.x, t.y - 10, size, { rot: sway }))
            return;
        const s = size / 64;
        c.fillStyle = '#4a3320';
        c.fillRect(t.x - 4 * s, t.y, 8 * s, 16 * s);
        c.fillStyle = t.reg === 2 ? '#a7d8e8' : t.reg === 1 ? '#3b5a52' : '#2f7a45';
        c.beginPath();
        c.arc(t.x, t.y - 4 * s, 20 * s, 0, Math.PI * 2);
        c.fill();
    }
    drawWorldObjects(camX, camY) {
        const c = this.ctx;
        const world = this.getWorld();
        if (this.bonus) {
            const [g0, g1] = this.winRange();
            for (let i = g0; i <= g1 && i < ZONES.length - 1; i++) {
                this.drawGate(i, camX, camY);
                this.drawExitGate(i, camX, camY);
            }
            return;
        }
        for (const sp of world.spawners) {
            if (!this.inView(sp.x, sp.y, 90, camX, camY) || this.hardHidden(sp))
                continue;
            const cleared = this.spCleared(sp);
            if (!cleared) {
                // kamp çemberi: evin etrafı (düşmanların kampı) renkli halkayla işaretli
                const col = TIERS[sp.tier].color;
                c.save();
                c.strokeStyle = col;
                c.globalAlpha = 0.55;
                c.lineWidth = 3;
                c.beginPath();
                c.arc(sp.x, sp.y, sp.tier === 'boss' ? 130 : 76, 0, Math.PI * 2);
                c.stroke();
                c.globalAlpha = 0.18;
                c.setLineDash([10, 10]);
                c.beginPath();
                c.arc(sp.x, sp.y, sp.tier === 'boss' ? 400 : 250, 0, Math.PI * 2);
                c.stroke();
                c.restore();
                if (sp.tier === 'boss' && this.bossSealed(sp)) {
                    const pr = this.sealProgress(sp.reg);
                    c.fillStyle = 'rgba(255,80,80,0.18)';
                    c.beginPath();
                    c.arc(sp.x, sp.y, 130, 0, Math.PI * 2);
                    c.fill();
                    this.drawSpr('ui_lock', sp.x, sp.y - 46, 38);
                    c.font = 'bold 12px sans-serif';
                    c.textAlign = 'center';
                    c.fillStyle = '#ffb0b0';
                    c.fillText(`MÜHÜRLÜ · kamp ${pr.done}/${pr.need}`, sp.x, sp.y + 78);
                }
                else if (sp.tier === 'boss' && (sp.bridge === undefined || !!sp.hard)) {
                    // boss evi: içi iyileştirir (yeşil alan), vurulabilir
                    const pulse = 0.5 + 0.5 * Math.sin(this.time * 2.2);
                    const gr = c.createRadialGradient(sp.x, sp.y, 10, sp.x, sp.y, 130);
                    gr.addColorStop(0, `rgba(120,255,170,${0.2 + 0.1 * pulse})`);
                    gr.addColorStop(1, 'rgba(120,255,170,0)');
                    c.fillStyle = gr;
                    c.beginPath();
                    c.arc(sp.x, sp.y, 130, 0, Math.PI * 2);
                    c.fill();
                    c.font = 'bold 12px sans-serif';
                    c.textAlign = 'center';
                    c.fillStyle = '#c8ffd8';
                    c.fillText('BOSS EVİ · vur / iyileş', sp.x, sp.y + 78);
                }
            }
            c.globalAlpha = cleared ? 0.45 : 1;
            if (sp.bridge === undefined && !this.drawSpr('camp', sp.x, sp.y, 120)) {
                c.strokeStyle = 'rgba(0,0,0,0.4)';
                c.lineWidth = 5;
                c.beginPath();
                c.arc(sp.x, sp.y, 50, 0, Math.PI * 2);
                c.stroke();
            }
            c.globalAlpha = 1;
            const hf = this.houseFlash.get(sp.id);
            if (hf) {
                c.fillStyle = `rgba(255,255,255,${Math.min(0.6, hf * 4)})`;
                c.beginPath();
                c.arc(sp.x, sp.y, 52, 0, Math.PI * 2);
                c.fill();
            }
            if (cleared && sp.tier === 'boss') {
                c.fillStyle = '#b8ffcc';
                c.font = 'bold 13px sans-serif';
                c.textAlign = 'center';
                c.fillText('YENİLDİ', sp.x, sp.y + 5);
            }
            else if (cleared) {
                const left = Math.max(0, Math.ceil(((this.save.spawn['s' + sp.id] ?? 0) - this.now()) / 1000));
                c.fillStyle = '#fff';
                c.font = 'bold 14px sans-serif';
                c.textAlign = 'center';
                if (left > 1e8)
                    c.fillText(T('YOK EDİLDİ'), sp.x, sp.y + 5);
                else
                    c.fillText(left >= 60 ? Math.floor(left / 60) + 'dk ' + (left % 60) + 'sn' : left + 'sn', sp.x, sp.y + 5);
            }
        }
        // ağaçlar: hepsi kesilebilir; y'ye göre sıralı çizmeye gerek yok, ayak izi küçük
        for (const t of world.trees) {
            if (!this.inView(t.x, t.y, 90, camX, camY))
                continue;
            if (this.isCleared('t' + t.id)) {
                c.fillStyle = '#4a3320';
                c.beginPath();
                c.ellipse(t.x, t.y + 4, 9 * t.s + 3, 5 * t.s + 2, 0, 0, Math.PI * 2);
                c.fill();
                continue;
            }
            this.drawTreeSprite(t, this.time);
            const maxHp = this.treeMaxHp(t);
            const hp = this.treeHp.get(t.id) ?? maxHp;
            if (hp < maxHp) {
                c.fillStyle = '#400';
                c.fillRect(t.x - 20, t.y - 56 * t.s, 40, 4);
                c.fillStyle = '#5f5';
                c.fillRect(t.x - 20, t.y - 56 * t.s, (40 * hp) / maxHp, 4);
            }
        }
        for (const ch of world.chests) {
            if (!this.inView(ch.x, ch.y, 40, camX, camY))
                continue;
            const open = this.save.chests.includes(ch.id);
            if (!this.chestShown(ch)) {
                // gizli sandık: yakında solgun bir parıltı ipucu
                if (ch.mode === 'hidden' && Math.hypot(ch.x - this.px, ch.y - this.py) < 330) {
                    const a = 0.25 + 0.2 * Math.sin(this.time * 4 + ch.id);
                    c.fillStyle = `rgba(255,230,140,${a})`;
                    c.beginPath();
                    c.arc(ch.x, ch.y, 5 + 2 * Math.sin(this.time * 3), 0, Math.PI * 2);
                    c.fill();
                }
                continue;
            }
            if (this.spr('chest')) {
                c.globalAlpha = open ? 0.4 : 1;
                this.drawSprX('chest', ch.x, ch.y, 44, { bob: open ? 0 : Math.sin(this.time * 3 + ch.id) * 1.5 });
                c.globalAlpha = 1;
                continue;
            }
            c.fillStyle = open ? '#555' : '#8a5a2b';
            c.fillRect(ch.x - 14, ch.y - 9, 28, 18);
            c.fillStyle = open ? '#777' : '#ffd84a';
            c.fillRect(ch.x - 14, ch.y - 9, 28, 5);
            if (!open)
                c.fillRect(ch.x - 3, ch.y - 4, 6, 7);
        }
        {
            const [g0, g1] = this.winRange();
            for (let i = g0; i <= g1 && i < ZONES.length - 1; i++) {
                this.drawGate(i, camX, camY);
                this.drawExitGate(i, camX, camY);
            }
        }
    }
    /** Evimiz: doğduğumuz yer ve hızlı iyileşme alanı */
    /** kaya ve binalar; oyuncunun arkasında kalanlar önce, önünde kalanlar sonra çizilir */
    drawObstacles(camX, camY, front) {
        if (!this.world || this.bonus)
            return;
        const c = this.ctx;
        for (const o of this.world.obstacles) {
            if ((o.y > this.py) !== front)
                continue;
            if (!this.inView(o.x, o.y, o.size, camX, camY))
                continue;
            if (this.bldDown(o))
                continue;
            c.fillStyle = 'rgba(0,0,0,0.3)';
            c.beginPath();
            c.ellipse(o.x + 4, o.y + o.r * 0.5, o.r * 1.15, o.r * 0.42, 0, 0, Math.PI * 2);
            c.fill();
            const fl = (o.kind === 'bld' || !!o.brk) && (this.bldFlash.get(o.id) ?? 0) > 0;
            if (!this.drawSprX(o.art, o.x, o.y - o.size * 0.3, o.size, { flip: o.flip, flash: fl })) {
                c.fillStyle = o.kind === 'bld' ? '#7a5a3a' : '#6e7480';
                c.beginPath();
                c.arc(o.x, o.y - o.r * 0.3, o.r, 0, Math.PI * 2);
                c.fill();
            }
            if (o.kind === 'bld') {
                const nest = this.nestOf(o);
                if (nest) { // yılan yuvası işareti
                    c.font = `${nest === 'giant' ? 30 : 22}px sans-serif`;
                    c.textAlign = 'center';
                    c.fillText(nest === 'giant' ? '🐍' : '🐍', o.x, o.y - o.size * 1.05 + Math.sin(this.time * 3 + o.id) * 3);
                }
                const cur = this.bldHp.get(o.id);
                if (cur !== undefined) {
                    const f = Math.max(0, cur / this.bldMaxHp(o));
                    const bw = 70;
                    c.fillStyle = 'rgba(0,0,0,0.55)';
                    c.fillRect(o.x - bw / 2 - 1, o.y - o.size * 0.95 - 1, bw + 2, 8);
                    c.fillStyle = f <= 0.2 ? '#ff5a5a' : f <= 0.5 ? '#ffd84a' : '#5fe07a';
                    c.fillRect(o.x - bw / 2, o.y - o.size * 0.95, bw * f, 6);
                }
            }
            if (o.brk) { // kırılabilir kaya: çatlak işareti ve can çubuğu
                c.strokeStyle = 'rgba(255,230,160,0.85)';
                c.lineWidth = 2;
                c.lineCap = 'round';
                const cy0 = o.y - o.r * 0.5;
                c.beginPath();
                c.moveTo(o.x - o.r * 0.4, cy0 - o.r * 0.3);
                c.lineTo(o.x - o.r * 0.1, cy0);
                c.lineTo(o.x - o.r * 0.3, cy0 + o.r * 0.25);
                c.moveTo(o.x - o.r * 0.1, cy0);
                c.lineTo(o.x + o.r * 0.3, cy0 + o.r * 0.1);
                c.stroke();
                const cur = this.bldHp.get(o.id);
                if (cur !== undefined) {
                    const f = Math.max(0, cur / this.bldMaxHp(o));
                    const bw = 50;
                    c.fillStyle = 'rgba(0,0,0,0.55)';
                    c.fillRect(o.x - bw / 2 - 1, o.y - o.size * 0.7 - 1, bw + 2, 8);
                    c.fillStyle = f <= 0.2 ? '#ff5a5a' : f <= 0.5 ? '#ffd84a' : '#5fe07a';
                    c.fillRect(o.x - bw / 2, o.y - o.size * 0.7, bw * f, 6);
                }
            }
        }
    }
    /** bir kampın düşman gücü (güç = √(can × hasar), ekrandaki ⚔ sayısıyla aynı formül) */
    spawnerPower(sp) {
        const def = ENEMIES[sp.kind];
        const t = TIERS[sp.tier];
        const z = ZONES[sp.reg];
        const maxHp = def.hp * t.hp * z.scale * sp.lv;
        const dmg = def.dmg * t.dmg * z.dmgScale * Math.sqrt(sp.lv);
        return Math.floor(Math.sqrt(maxHp * (dmg / 0.6)) * 10);
    }
    /** oyuncu bu adanın kapısını geçip köprüye girdi mi */
    passedGate(reg) {
        const b = this.bridge(reg);
        const t = ((this.px - b.ax) * (b.bx - b.ax) + (this.py - b.ay) * (b.by - b.ay)) / (b.len * b.len);
        return t > b.tGate;
    }
    /** oyuncuya sıradaki hedefi gösterir: boss açıldıysa boss evi, boss yenildiyse kapı, değilse en yakın temizlenmemiş kamp */
    guideTarget() {
        const vt = this.vqTarget() ?? this.ckTarget();
        if (vt)
            return { x: vt.x, y: vt.y, label: vt.label, color: '#ffd1f0' };
        const reg = this.region;
        const last = ZONES.length - 1;
        const boss = this.getWorld().spawners.find((s) => s.reg === reg && s.tier === 'boss' && s.bridge === undefined);
        if (!this.save.bossDown[reg]) {
            if (boss && !this.bossSealed(boss) && !this.spCleared(boss))
                return { x: boss.x, y: boss.y, label: 'Boss evi', color: '#ff8a5a' };
            // sıradaki düşman: ilk kez temizlenmemiş kamplardan, gücüne göre rahatça yenilebilecek (≤ %60) en yakın olanı; yoksa en zayıfı
            const pw = Math.max(1, this.fullPower());
            let best = null;
            let bd = Infinity;
            let weak = null;
            let wp = Infinity;
            for (const s of this.getWorld().spawners) {
                if (s.reg !== reg || s.tier === 'boss' || this.save.first['s' + s.id] || this.spCleared(s))
                    continue;
                const sp = this.spawnerPower(s);
                if (sp < wp) {
                    wp = sp;
                    weak = s;
                }
                if (sp > pw * 0.6)
                    continue;
                const d = Math.hypot(s.x - this.px, s.y - this.py);
                if (d < bd) {
                    bd = d;
                    best = s;
                }
            }
            const pick = best ?? weak;
            if (!pick)
                return null;
            // okun gösterdiği yer kampın evi değil, kampın canlı düşmanının kendisi (en yakını); henüz sahaya çıkmadıysa kamp noktası
            let tx = pick.x;
            let ty = pick.y;
            let ed = Infinity;
            for (const e of this.enemies) {
                if (e.sp !== pick.id || e.hp <= 0)
                    continue;
                const d = Math.hypot(e.x - this.px, e.y - this.py);
                if (d < ed) {
                    ed = d;
                    tx = e.x;
                    ty = e.y;
                }
            }
            return { x: tx, y: ty, label: 'Sıradaki düşman', color: best ? '#7bff9a' : '#ffb36b' };
        }
        // boss yenildi: önce zor boss evi, sonra (varsa) canavar; ikisi de yoksa kapı/maden
        for (const [pred, label, color] of [
            [(s) => !!s.hard, 'Zor Boss evi', '#ff5a3c'],
            [(s) => !!s.beast, 'Canavar', '#ff7a7a'],
        ]) {
            let hs = null;
            let hd = Infinity;
            for (const s of this.getWorld().spawners) {
                if (s.reg !== reg || !pred(s) || this.spCleared(s) || this.hardHidden(s) || this.bossSealed(s))
                    continue;
                const d = Math.hypot(s.x - this.px, s.y - this.py);
                if (d < hd) {
                    hd = d;
                    hs = s;
                }
            }
            if (hs) {
                let tx = hs.x;
                let ty = hs.y;
                let ed = Infinity;
                for (const e of this.enemies) {
                    if (e.sp !== hs.id || e.hp <= 0)
                        continue;
                    const d = Math.hypot(e.x - this.px, e.y - this.py);
                    if (d < ed) {
                        ed = d;
                        tx = e.x;
                        ty = e.y;
                    }
                }
                return { x: tx, y: ty, label, color };
            }
        }
        if (reg < last) {
            if (this.passedGate(reg)) {
                // kapı geçildi: köprü bekçileri sağ kalmışsa en yakın bekçi gösterilir, yoksa ok kalkar
                if (this.bridgeOpen(reg))
                    return null;
                let bs = null;
                let bd2 = Infinity;
                for (const s of this.getWorld().spawners) {
                    if (s.id < 100000 || s.id >= 200000 || s.reg !== reg || this.spCleared(s))
                        continue;
                    const dd = Math.hypot(s.x - this.px, s.y - this.py);
                    if (dd < bd2) {
                        bd2 = dd;
                        bs = s;
                    }
                }
                return bs ? { x: bs.x, y: bs.y, label: 'Köprü bekçisi', color: '#ff8a5a' } : null;
            }
            // adada keşfedilmiş ve kullanılabilir (dinlenmiş) maden varsa kapı yerine madene yönlendirilir
            if (this.save.mines.includes(reg) && !this.oldGamesClosed() && this.mineCdLeftMs(reg) <= 0) {
                const m = this.mineSpot(reg);
                return { x: m.x, y: m.y, label: 'Maden', color: '#8fdcff' };
            }
            const g = this.gatePos(reg);
            if (this.paywalled(reg))
                return { x: g.x, y: g.y, label: 'Devam paketi gerekli', color: '#ffd84a' };
            // kapıya yaklaşan oyuncuya eğitim hakkı varsa usta cadı işaret edilir
            if (this.masterOpen(reg) && Math.hypot(g.x - this.px, g.y - this.py) < 900) {
                const m = this.masterPos(reg);
                return { x: m.x, y: m.y, label: 'Usta Cadı', color: '#9ff0ff' };
            }
            return { x: g.x, y: g.y, label: 'Kapı', color: '#7bff9a' };
        }
        return null;
    }
    /** hedef ekrandaysa üstünde zıplayan ok, ekran dışındaysa kenarda hedefe dönük ok + mesafe */
    drawGuide() {
        if (!settings.guide || this.dead > 0 || this.mapOpen)
            return;
        const t = this.guideTarget();
        if (!t)
            return;
        const c = this.ctx;
        const sx = this.w / 2 + (t.x - this.px) * this.zoom;
        const sy = this.h / 2 + (t.y - this.py) * this.zoom;
        const dist = Math.hypot(t.x - this.px, t.y - this.py);
        const bob = Math.sin(this.time * 6) * 5;
        const pulse = 0.6 + 0.4 * Math.sin(this.time * 4);
        c.save();
        c.textAlign = 'center';
        c.font = 'bold 13px sans-serif';
        c.lineWidth = 4;
        c.strokeStyle = 'rgba(0,0,0,0.75)';
        const label = T(t.label) + ' · ' + Math.round(dist / 10) + ' m';
        const onScreen = sx > 40 && sx < this.w - 40 && sy > 130 && sy < this.h - 110;
        if (onScreen) {
            const ay = sy - 70 + bob;
            c.fillStyle = t.color;
            c.beginPath();
            c.moveTo(sx, ay + 22);
            c.lineTo(sx - 15, ay);
            c.lineTo(sx + 15, ay);
            c.closePath();
            c.fill();
            c.strokeStyle = 'rgba(0,0,0,0.6)';
            c.lineWidth = 2;
            c.stroke();
            c.lineWidth = 4;
            c.strokeStyle = 'rgba(0,0,0,0.75)';
            c.strokeText(label, sx, ay - 8);
            c.fillStyle = '#fff';
            c.fillText(label, sx, ay - 8);
        }
        else {
            // ekran kenarına yaslı ok
            const cx = this.w / 2;
            const cy = this.h / 2;
            const dx = sx - cx;
            const dy = sy - cy;
            const k = Math.min((cx - 44) / Math.max(1, Math.abs(dx)), (cy - 130) / Math.max(1, Math.abs(dy)), (cy - 110) / Math.max(1, Math.abs(dy)));
            const ex = cx + dx * k;
            const ey = cy + dy * k;
            const ang = Math.atan2(dy, dx);
            c.translate(ex, ey);
            c.rotate(ang);
            c.fillStyle = `rgba(0,0,0,${0.35 * pulse})`;
            c.beginPath();
            c.arc(0, 0, 26, 0, Math.PI * 2);
            c.fill();
            c.fillStyle = t.color;
            c.beginPath();
            c.moveTo(20 + bob * 0.5, 0);
            c.lineTo(-10, -16);
            c.lineTo(-4, 0);
            c.lineTo(-10, 16);
            c.closePath();
            c.fill();
            c.strokeStyle = 'rgba(0,0,0,0.6)';
            c.lineWidth = 2;
            c.stroke();
            c.rotate(-ang);
            c.lineWidth = 4;
            c.strokeStyle = 'rgba(0,0,0,0.75)';
            const ty = ey < cy ? 44 : -34;
            c.strokeText(label, 0, ty);
            c.fillStyle = '#fff';
            c.fillText(label, 0, ty);
        }
        c.restore();
    }
    /** köprüde yeni ada yüklenirken küçük bir "Yükleniyor…" rozeti */
    drawLoading() {
        if (this.loadT <= 0 && this.pendingLoads <= 0)
            return;
        const c = this.ctx;
        const w = 150;
        const x = this.w / 2 - w / 2;
        const y = 58;
        c.fillStyle = 'rgba(10,6,30,0.78)';
        c.beginPath();
        c.roundRect(x, y, w, 30, 15);
        c.fill();
        c.strokeStyle = 'rgba(190,160,255,0.5)';
        c.lineWidth = 1.5;
        c.stroke();
        c.strokeStyle = '#ffe36b';
        c.lineWidth = 3;
        c.lineCap = 'round';
        c.beginPath();
        c.arc(x + 20, y + 15, 7, this.time * 6, this.time * 6 + 4.2);
        c.stroke();
        c.font = 'bold 13px sans-serif';
        c.textAlign = 'left';
        c.fillStyle = '#fff';
        c.fillText('Yükleniyor…', x + 36, y + 20);
        c.textAlign = 'center';
    }
    drawHome(camX, camY) {
        const c = this.ctx;
        const pulse = 0.5 + 0.5 * Math.sin(this.time * 2);
        for (const rp of this.restPoints()) {
            if (!this.inView(rp.x, rp.y, rp.r + 120, camX, camY))
                continue;
            const g = c.createRadialGradient(rp.x, rp.y, 10, rp.x, rp.y, rp.r);
            g.addColorStop(0, `rgba(120,255,170,${0.22 + 0.1 * pulse})`);
            g.addColorStop(1, 'rgba(120,255,170,0)');
            c.fillStyle = g;
            c.beginPath();
            c.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
            c.fill();
            const size = rp.reg === 0 ? 150 : 110;
            if (!this.drawSprX('home', rp.x, rp.y - size * 0.47, size)) {
                c.fillStyle = '#7a5a3a';
                c.fillRect(rp.x - 34, rp.y - 80, 68, 50);
                c.fillStyle = '#b04a4a';
                c.beginPath();
                c.moveTo(rp.x - 44, rp.y - 80);
                c.lineTo(rp.x, rp.y - 118);
                c.lineTo(rp.x + 44, rp.y - 80);
                c.fill();
            }
            c.font = 'bold 12px sans-serif';
            c.textAlign = 'center';
            c.fillStyle = '#c8ffd8';
            c.fillText(rp.reg === 0 ? 'EV · hızlı iyileşme' : 'KAMP · hızlı iyileşme', rp.x, rp.y + 34);
        }
        if (this.inHome()) {
            for (let k = 0; k < 6; k++) {
                const ph = (this.time * 0.7 + k / 6) % 1;
                c.fillStyle = `rgba(160,255,190,${1 - ph})`;
                c.font = 'bold 16px sans-serif';
                c.fillText('+', this.px + Math.sin(k * 2.1) * 40, this.py - 20 - ph * 50);
            }
        }
    }
    drawMaster(i, camX, camY) {
        if (!this.masterOpen(i))
            return;
        const m = this.masterPos(i);
        if (!this.inView(m.x, m.y, 120, camX, camY))
            return;
        const c = this.ctx;
        const near = Math.hypot(m.x - this.px, m.y - this.py) < 130;
        if (!this.drawSprX('master', m.x, m.y, 84, { bob: Math.sin(this.time * 2) * 2, flip: this.px < m.x ? -1 : 1, sy: 1 + 0.015 * Math.sin(this.time * 2.5) })) {
            c.fillStyle = '#2f8a8a';
            c.beginPath();
            c.arc(m.x, m.y, 18, 0, Math.PI * 2);
            c.fill();
        }
        c.font = 'bold 12px sans-serif';
        c.textAlign = 'center';
        c.fillStyle = '#9ff0ff';
        c.fillText('Usta Cadı ' + ZONES[i].master, m.x, m.y - 64);
        if (near) {
            c.fillStyle = '#ffe36b';
            c.fillText('Eğitim için dokun!', m.x, m.y - 80 + Math.sin(this.time * 5) * 2);
        }
    }
    /** köprünün çıkışındaki kapı: köprü bekçileri yenilince açılır */
    drawExitGate(i, camX, camY) {
        const b = this.bridge(i);
        const gx = b.ax + (b.bx - b.ax) * b.tExit;
        const gy = b.ay + (b.by - b.ay) * b.tExit;
        if (!this.inView(gx, gy, 200, camX, camY))
            return;
        const c = this.ctx;
        const ang = Math.atan2(b.by - b.ay, b.bx - b.ax);
        const locked = !this.bridgeOpen(i);
        const ea = this.exitAnim && this.exitAnim.i === i ? this.exitAnim : null;
        const open = locked ? 0 : ea ? Math.min(1, (3.6 - ea.t) / 1.4) : 1;
        drawGateArt(c, gx, gy, -Math.sin(ang), Math.cos(ang), locked, open, this.time, this.spr('ui_lock'));
        c.font = 'bold 12px sans-serif';
        c.textAlign = 'center';
        c.fillStyle = locked ? '#ffd0a0' : '#b8ffcc';
        c.fillText(locked ? T('KİLİTLİ — köprü bekçileri yenilmeli') + ` (${this.bridgeGuardsLeft(i)})` : T('Köprü kapısı açık'), gx, gy - 130);
    }
    drawGate(i, camX, camY) {
        const c = this.ctx;
        const g = this.gatePos(i);
        if (!this.inView(g.x, g.y, 200, camX, camY))
            return;
        const b = this.bridge(i);
        const ang = Math.atan2(b.by - b.ay, b.bx - b.ax);
        const locked = this.gateLocked(i);
        const ga = this.gateAnim && this.gateAnim.i === i ? this.gateAnim : null;
        const open = locked ? 0 : ga ? Math.min(1, (3.6 - ga.t) / 1.4) : 1;
        drawGateArt(c, g.x, g.y, -Math.sin(ang), Math.cos(ang), locked, open, this.time, this.spr('ui_lock'));
        if (ga) {
            for (let r = 0; r < 3; r++) {
                const ph = ((3.6 - ga.t) * 0.9 + r / 3) % 1;
                c.strokeStyle = `rgba(150,255,190,${1 - ph})`;
                c.lineWidth = 5;
                c.beginPath();
                c.arc(g.x, g.y, 20 + ph * 130, 0, Math.PI * 2);
                c.stroke();
            }
        }
        c.font = 'bold 12px sans-serif';
        c.textAlign = 'center';
        c.fillStyle = locked ? '#ffd0a0' : '#b8ffcc';
        c.fillText(locked ? 'KİLİTLİ — ' + ZONES[i].bossName + ' yenilmeli' : 'Kapı açık', g.x, g.y - 130);
    }
    drawPlayer() {
        const c = this.ctx;
        const blink = this.invuln > 0 && Math.floor(this.time * 20) % 2 === 0;
        const flip = Math.cos(this.face) < 0 ? -1 : 1;
        const t = this.time;
        const cast = this.castPulse > 0 ? this.castPulse / 0.28 : 0;
        const o = this.moving
            ? { bob: -Math.abs(Math.sin(t * 11)) * 5, rot: Math.sin(t * 11) * 0.06, sy: 1 + 0.04 * Math.sin(t * 22), sx: 1 }
            : { bob: Math.sin(t * 2) * 1.6, rot: 0, sy: 1 + 0.018 * Math.sin(t * 2.5), sx: 1 };
        const sc = 1 + 0.12 * cast;
        const helm = this.item('helmet');
        const shield = this.item('shield');
        c.globalAlpha = blink ? 0.5 : 1;
        const flying = this.flyT > 0;
        // yürüyüş tozu / uçuş parıltısı
        for (const p of this.puffs) {
            const k = p.t / (p.fly ? 0.5 : 0.45);
            c.fillStyle = p.fly ? `rgba(200,170,255,${0.7 * k})` : `rgba(215,200,170,${0.5 * k})`;
            c.beginPath();
            c.arc(p.x, p.y, (p.fly ? 3 : 4) + (1 - k) * (p.fly ? 6 : 8), 0, Math.PI * 2);
            c.fill();
        }
        // gölge (uçarken küçülür)
        c.fillStyle = flying ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.25)';
        c.beginPath();
        c.ellipse(this.px, this.py + 18, flying ? 14.7 : 21, flying ? 5.3 : 7.4, 0, 0, Math.PI * 2);
        c.fill();
        const lift = flying ? -30 + Math.sin(t * 4) * 3 : 0;
        // animasyon karesi: uçuş > büyü > yürüyüş (iki kare) > duruş
        let frame = 'witch';
        const has = (n) => !!this.spr(n);
        if (flying && has('witch_fly1') && has('witch_fly2'))
            frame = Math.floor(t * 4) % 2 === 0 ? 'witch_fly1' : 'witch_fly2';
        else if (flying && has('witch_fly'))
            frame = 'witch_fly';
        else if (cast > 0 && has('witch_cast1') && has('witch_cast2'))
            frame = cast > 0.5 ? 'witch_cast2' : 'witch_cast1';
        else if (cast > 0 && has('witch_cast'))
            frame = 'witch_cast';
        else if (this.moving && has('witch_walk4'))
            frame = 'witch_walk' + (1 + (Math.floor(t * 9) % 4));
        const drawn = this.drawSprX(this.save.outfit ? frame + '@' + this.save.outfit : frame, this.px, this.py - 8, (flying ? 99.5 : 85.7) * this.brewScale(), {
            flip, rot: o.rot + cast * 0.12 * flip, sx: o.sx * sc, sy: o.sy * sc, bob: o.bob + lift, flash: this.hurtFlash > 0,
        });
        if (!drawn) {
            c.fillStyle = '#6d3fc0';
            c.beginPath();
            c.arc(this.px, this.py + 4, 13, 0, Math.PI * 2);
            c.fill();
            c.fillStyle = '#f2c9a0';
            c.beginPath();
            c.arc(this.px, this.py - 4, 9, 0, Math.PI * 2);
            c.fill();
            c.fillStyle = '#2a1a55';
            c.beginPath();
            c.moveTo(this.px - 15, this.py - 8);
            c.lineTo(this.px + 15, this.py - 8);
            c.lineTo(this.px + 2, this.py - 32);
            c.closePath();
            c.fill();
        }
        if (helm) {
            c.fillStyle = RARITIES[helm.rarity].color;
            c.beginPath();
            c.arc(this.px + 2 * flip, this.py - 44 + o.bob, 3.5, 0, Math.PI * 2);
            c.fill();
        }
        if (shield) {
            c.fillStyle = RARITIES[shield.rarity].color;
            const sx = this.px - 30 * flip;
            c.beginPath();
            c.moveTo(sx - 6, this.py - 2);
            c.lineTo(sx + 6, this.py - 2);
            c.lineTo(sx + 6, this.py + 6);
            c.quadraticCurveTo(sx, this.py + 16, sx - 6, this.py + 6);
            c.closePath();
            c.fill();
        }
        c.globalAlpha = 1;
        // karakterin üstünde can ve güç
        const bw = 62;
        const by = this.py - 73 + (flying ? -30 : 0);
        if (flying) {
            c.fillStyle = 'rgba(0,0,0,0.55)';
            c.fillRect(this.px - bw / 2 - 1, by + 9, bw + 2, 6);
            c.fillStyle = '#c8b6ff';
            c.fillRect(this.px - bw / 2, by + 10, (bw * this.flyT) / 5, 4);
        }
        c.fillStyle = 'rgba(0,0,0,0.55)';
        c.fillRect(this.px - bw / 2 - 1, by - 1, bw + 2, 8);
        const f = Math.max(0, Math.min(1, this.hp / this.maxHp()));
        c.fillStyle = f > 0.5 ? '#5fe07a' : f > 0.2 ? '#ffd84a' : '#ff5a5a';
        c.fillRect(this.px - bw / 2, by, bw * f, 6);
        c.font = `bold ${Math.round(12 * this.lk())}px sans-serif`;
        c.textAlign = 'center';
        c.lineWidth = 3;
        c.strokeStyle = 'rgba(0,0,0,0.7)';
        c.strokeText('⚔ ' + this.fmt(this.power()), this.px, by - 4);
        c.fillStyle = '#ffe36b';
        c.fillText('⚔ ' + this.fmt(this.power()), this.px, by - 4);
    }
    drawDeath(d) {
        const k = 1 - d.t / 0.45;
        this.drawSprX(d.name, d.x, d.y, d.size * (1 - 0.5 * k), { flip: d.flip, alpha: 1 - k, rot: k * 0.8 * d.flip, sy: 1 - 0.4 * k, flash: k < 0.4 });
    }
    drawEnemy(e) {
        if (e.seg) {
            this.drawSegment(e);
            return;
        }
        if (e.refl) {
            this.drawReflection(e);
            return;
        }
        const c = this.ctx;
        const r = this.erad(e);
        const t = e.phase;
        const boss = e.tier === 'boss';
        const size = e.def.id === 'snake' ? r * 6.4 : r * 3.3; // yılan görseli ince ve uzun: büyük çizilir
        const o = { flip: e.flip, rot: 0, sx: 1, sy: 1, alpha: 1, bob: 0, flash: e.flash > 0 };
        switch (e.def.id) {
            case 'ghost':
                o.bob = Math.sin(t * 3) * 6 - 6;
                o.alpha = 0.88 + 0.1 * Math.sin(t * 4);
                o.rot = Math.sin(t * 2) * 0.08 + (e.moving ? 0.1 * e.flip : 0);
                break;
            case 'mushroom':
                o.rot = e.moving ? Math.sin(t * 9) * 0.13 : Math.sin(t * 1.5) * 0.03;
                o.sy = 1 + (e.moving ? 0.05 * Math.sin(t * 18) : 0.02 * Math.sin(t * 2));
                break;
            case 'pumpkin':
                o.bob = e.moving ? -Math.abs(Math.sin(t * 7)) * 9 : Math.sin(t * 2) * 1.5;
                o.sy = e.moving ? 1 + 0.08 * Math.cos(t * 7) : 1;
                o.sx = 2 - o.sy;
                break;
            case 'bat':
                o.sx = 0.72 + 0.28 * Math.abs(Math.sin(t * 17));
                o.bob = Math.sin(t * 6) * 7 - 10;
                break;
        }
        if (boss) {
            o.sy = 1 + 0.03 * Math.sin(t * 2);
            o.bob = 0;
            o.rot = e.moving ? Math.sin(t * 6) * 0.04 : 0;
        }
        if (e.lunge > 0) {
            const k = e.lunge / 0.25;
            o.sx *= 1 + 0.18 * k;
            o.sy *= 1 - 0.1 * k;
        }
        if (e.fly) {
            const k = Math.min(1, e.fly.t / e.fly.dur);
            o.bob -= Math.sin(Math.PI * k) * 78;
            o.rot = k * Math.PI * 4 * e.fly.dir;
        }
        c.fillStyle = 'rgba(0,0,0,0.22)';
        c.beginPath();
        c.ellipse(e.x, e.y + r * 0.7, r * 0.9, r * 0.32, 0, 0, Math.PI * 2);
        c.fill();
        // canavarın kendi görseli vardır; yüklenmediyse boss görseline düşer
        const sprName = e.bee !== undefined ? BEE_KINDS[e.bee].spr : e.beast && this.spr(ZONES[e.reg].art.beast) ? ZONES[e.reg].art.beast : boss ? ZONES[e.reg].art.boss : e.def.id;
        if (e.beast) {
            const pr = 0.5 + 0.5 * Math.sin(this.time * 4);
            const gr = c.createRadialGradient(e.x, e.y, 10, e.x, e.y, r * 3);
            gr.addColorStop(0, `rgba(255,60,60,${0.35 + 0.2 * pr})`);
            gr.addColorStop(1, 'rgba(255,60,60,0)');
            c.fillStyle = gr;
            c.beginPath();
            c.arc(e.x, e.y, r * 3, 0, Math.PI * 2);
            c.fill();
        }
        if (!this.drawSprX(sprName, e.x, e.y, e.beast ? size * 1.7 : size, o)) {
            const fallback = { ghost: '#e8e8ff', mushroom: '#e0576a', pumpkin: '#ff9a3c', bat: '#8a6bd1', scorpion: '#d9a24a', golem: '#8a7a74', wisp: '#7be0ff', snake: '#3fbf6a' };
            c.fillStyle = boss ? '#7a4fd0' : fallback[e.def.id];
            c.beginPath();
            c.arc(e.x, e.y, r, 0, Math.PI * 2);
            c.fill();
        }
        if (e.beast) {
            c.font = `bold ${Math.round(12 * this.lk())}px sans-serif`;
            c.textAlign = 'center';
            c.fillStyle = '#ff7a7a';
            c.fillText('CANAVAR', e.x, e.y - r - 60);
        }
        if (e.hard) {
            c.font = `bold ${Math.round(12 * this.lk())}px sans-serif`;
            c.textAlign = 'center';
            c.fillStyle = '#ffb347';
            c.fillText(T('ZOR BOSS'), e.x, e.y - r - 60);
        }
        const sp = this.spawnerMap.get(e.sp);
        if (sp && sp.tag)
            this.drawSpr('icon_' + sp.tag, e.x, e.y - r - 44, 22);
        c.fillStyle = 'rgba(0,0,0,0.55)';
        c.fillRect(e.x - r - 1, e.y - r - 15, r * 2 + 2, 8);
        const hf = Math.max(0, e.hp) / e.maxHp;
        c.fillStyle = hf <= 0.2 ? '#ff5a5a' : hf <= 0.5 ? '#ffd84a' : '#5fe07a';
        c.fillRect(e.x - r, e.y - r - 14, r * 2 * hf, 6);
        if (e.sp === BEE_SP || e.sp === BONUS_SP)
            return; // kalabalık gruplarda güç yazısı ve tür simgeleri çizilmez (okunurluk)
        const ratio = this.enemyPower(e) / Math.max(1, this.power());
        const col = ratio < 0.6 ? '#7bff9a' : ratio < 1.6 ? '#ffe36b' : '#ff6b6b';
        c.font = `bold ${Math.round(13 * this.lk())}px sans-serif`;
        c.textAlign = 'center';
        c.lineWidth = 3;
        c.strokeStyle = 'rgba(0,0,0,0.7)';
        c.strokeText('⚔ ' + this.fmt(this.enemyPower(e)), e.x, e.y - r - 19);
        c.fillStyle = col;
        c.fillText('⚔ ' + this.fmt(this.enemyPower(e)), e.x, e.y - r - 19);
        if (Math.hypot(e.x - this.px, e.y - this.py) < 200) {
            const a = this.spr('ui_' + e.def.atk);
            const w = this.spr('ui_' + this.weakness(e));
            if (a && w) {
                c.drawImage(a, e.x - 26, e.y + r + 4, 18, 18);
                c.drawImage(w, e.x + 8, e.y + r + 4, 18, 18);
                c.fillStyle = '#e9e4ff';
                c.font = `${Math.round(11 * this.lk())}px sans-serif`;
                c.fillText('›', e.x, e.y + r + 17);
            }
            else {
                c.font = `${Math.round(11 * this.lk())}px sans-serif`;
                c.fillStyle = '#e9e4ff';
                c.fillText(DTYPE_NAMES[e.def.atk] + ' vurur · ' + DTYPE_NAMES[this.weakness(e)] + ' zayıf', e.x, e.y + r + 14);
            }
        }
    }
    drawProj(p) {
        const c = this.ctx;
        if (p.kind === 'arrow') {
            // arbalet oku: kısa kalın ok, uçta metal, kuyrukta tüy
            c.save();
            c.translate(p.x, p.y);
            c.rotate(p.a);
            c.strokeStyle = '#5b3b1e';
            c.lineWidth = 3;
            c.lineCap = 'round';
            c.beginPath();
            c.moveTo(-14, 0);
            c.lineTo(10, 0);
            c.stroke();
            c.fillStyle = '#d8dde6';
            c.beginPath();
            c.moveTo(16, 0);
            c.lineTo(8, -4);
            c.lineTo(8, 4);
            c.closePath();
            c.fill();
            c.fillStyle = '#ff6a4a';
            c.beginPath();
            c.moveTo(-14, 0);
            c.lineTo(-19, -4);
            c.lineTo(-10, 0);
            c.lineTo(-19, 4);
            c.closePath();
            c.fill();
            c.restore();
        }
        else if (p.kind === 'bolt') {
            c.strokeStyle = 'rgba(255,216,74,0.45)';
            c.lineWidth = 5;
            c.lineCap = 'round';
            c.beginPath();
            c.moveTo(p.x - Math.cos(p.a) * 26, p.y - Math.sin(p.a) * 26);
            c.lineTo(p.x, p.y);
            c.stroke();
            if (!this.drawSpr('icon_wand', p.x, p.y, 34, this.time * 12)) {
                c.fillStyle = '#ffd84a';
                c.beginPath();
                c.arc(p.x, p.y, 8, 0, Math.PI * 2);
                c.fill();
            }
        }
        else if (p.kind === 'broom') {
            if (!this.drawSpr('icon_broom', p.x, p.y, 39.4, this.time * 14)) {
                c.fillStyle = '#c98a4b';
                c.fillRect(p.x - 18, p.y - 3, 36, 6);
            }
        }
        else if (p.kind === 'potion') {
            if (!this.drawSpr('icon_potion', p.x, p.y, 36, this.time * 8)) {
                c.fillStyle = '#7bdcff';
                c.beginPath();
                c.arc(p.x, p.y, 9, 0, Math.PI * 2);
                c.fill();
            }
            c.fillStyle = 'rgba(0,0,0,0.25)';
            c.beginPath();
            c.ellipse(p.sx + (p.tx - p.sx) * Math.min(1, p.life / p.max), p.sy + (p.ty - p.sy) * Math.min(1, p.life / p.max), 10, 5, 0, 0, Math.PI * 2);
            c.fill();
        }
        else if (p.kind === 'ring') {
            const k = p.life / p.max;
            c.strokeStyle = `rgba(123,220,255,${1 - k})`;
            c.lineWidth = 6;
            c.beginPath();
            c.arc(p.x, p.y, p.r * (0.3 + 0.7 * k), 0, Math.PI * 2);
            c.stroke();
            c.fillStyle = `rgba(123,220,255,${0.25 * (1 - k)})`;
            c.fill();
        }
        else {
            const k = p.life / p.max;
            c.strokeStyle = `rgba(210,180,255,${1 - k})`;
            c.lineWidth = 10;
            c.lineCap = 'round';
            c.beginPath();
            c.arc(p.x, p.y, p.r * 0.8, p.a - 1.0, p.a - 1.0 + 2.0 * Math.min(1, k * 1.6));
            c.stroke();
        }
    }
    /** ganimet / kazanç yazıları: karakterin üstünde, sıralı, efektli ("+30 Can kazanıldı") */
    /** kapı açılınca ekranda büyüyüp sönen yazı + ışık patlaması */
    drawGateBanner() {
        const ga = this.gateAnim;
        if (!ga)
            return;
        const c = this.ctx;
        const age = 3.6 - ga.t;
        const pop = 1 + 0.6 * Math.exp(-age * 5);
        const alpha = Math.min(1, ga.t / 0.8, age / 0.15);
        const cx = this.w / 2;
        const cy = this.h * 0.7;
        c.save();
        c.globalAlpha = alpha * 0.35;
        const g = c.createRadialGradient(cx, cy, 10, cx, cy, 220);
        g.addColorStop(0, 'rgba(150,255,190,0.9)');
        g.addColorStop(1, 'rgba(150,255,190,0)');
        c.fillStyle = g;
        c.fillRect(cx - 220, cy - 220, 440, 440);
        c.globalAlpha = alpha;
        c.translate(cx, cy);
        c.scale(pop, pop);
        c.font = 'bold 30px sans-serif';
        c.textAlign = 'center';
        c.lineWidth = 6;
        c.strokeStyle = 'rgba(0,40,20,0.85)';
        c.strokeText('KAPI AÇILDI!', 0, 0);
        c.fillStyle = '#b8ffcc';
        c.fillText('KAPI AÇILDI!', 0, 0);
        c.font = 'bold 15px sans-serif';
        const sub = ZONES[ga.i + 1].name + ' yolu açık';
        c.strokeText(sub, 0, 26);
        c.fillStyle = '#fff';
        c.fillText(sub, 0, 26);
        c.restore();
    }
    /** sağ kenar (mini haritanın altı): toplam verilen hasar ve savaş mesajları */
    drawFeed() {
        const c = this.ctx;
        const x = this.w - 10;
        let y = 222;
        c.textAlign = 'right';
        c.lineJoin = 'round';
        c.lineWidth = 3;
        c.strokeStyle = 'rgba(0,0,0,0.75)';
        const d = this.dealt;
        if (d.t > 0 && d.sum > 0) {
            c.globalAlpha = Math.min(1, d.t / 0.4);
            c.font = 'bold 14px sans-serif';
            const txt = '⚔ ' + this.fmt(d.sum) + (d.hits > 1 ? ' ×' + d.hits : '');
            c.strokeText(txt, x, y);
            c.fillStyle = d.crit ? '#ffd84a' : '#ffffff';
            c.fillText(txt, x, y);
            y += 17;
        }
        c.font = 'bold 12px sans-serif';
        for (let i = this.feed.length - 1; i >= 0; i--) {
            const f = this.feed[i];
            c.globalAlpha = Math.min(1, f.t / 0.5);
            const txt = f.n > 1 ? f.text + ' ×' + f.n : f.text;
            c.strokeText(txt, x, y);
            c.fillStyle = f.color;
            c.fillText(txt, x, y);
            y += 15;
        }
        c.globalAlpha = 1;
    }
    drawGains() {
        const c = this.ctx;
        const active = this.gains.filter((g) => g.delay <= 0);
        const baseY = this.h - 150; // kazanımlar sol altta (savaşın olduğu ekran ortasında değil)
        c.textAlign = 'left';
        active.forEach((g, i) => {
            const age = 1.9 - g.t;
            const slot = active.length - 1 - i; // en yeni altta
            const pop = 1 + 0.45 * Math.exp(-age * 9);
            const alpha = Math.min(1, g.t / 0.45, age / 0.08 + 0.2);
            const y = baseY - slot * 20 - Math.min(age, 0.6) * 10;
            c.save();
            c.globalAlpha = alpha;
            c.font = 'bold 14px sans-serif';
            const tw = c.measureText(g.text).width;
            const iw = g.icon && this.spr(g.icon) ? 24 : 0;
            const total = tw + iw;
            c.translate(12 + total / 2, y);
            c.scale(1 + (pop - 1) * 0.5, 1 + (pop - 1) * 0.5);
            c.shadowColor = g.color;
            c.shadowBlur = 10;
            c.lineWidth = 4;
            c.strokeStyle = 'rgba(0,0,0,0.75)';
            c.lineJoin = 'round';
            c.strokeText(g.text, -total / 2 + iw, 6);
            c.fillStyle = g.color;
            c.fillText(g.text, -total / 2 + iw, 6);
            c.shadowBlur = 0;
            if (iw)
                c.drawImage(this.spr(g.icon), -total / 2, -12, 22, 22);
            c.restore();
        });
    }
    drawHud() {
        const c = this.ctx;
        const zone = this.zone();
        const bw = Math.min(230, this.w - 150);
        c.fillStyle = 'rgba(0,0,0,0.55)';
        c.fillRect(12, 12, bw, 16);
        c.fillStyle = '#e0445a';
        c.fillRect(12, 12, (bw * Math.max(0, this.hp)) / this.maxHp(), 16);
        c.fillStyle = '#fff';
        c.font = '12px sans-serif';
        c.textAlign = 'left';
        this.drawSpr('ui_heart', 24, 20, 20);
        c.fillText(this.fmt(Math.max(0, this.hp)) + ' / ' + this.fmt(this.maxHp()), 38, 25);
        if (!this.drawSpr('ui_power', 24, 46, 22)) {
            c.fillStyle = '#ffe36b';
            c.fillText('⚔', 14, 50);
        }
        c.font = 'bold 14px sans-serif';
        c.fillStyle = '#ffe36b';
        c.fillText(this.fmt(this.power()), 38, 51);
        c.font = '12px sans-serif';
        c.fillStyle = '#fff';
        const cp = this.campProgress();
        c.fillText(zone.name, 12, 72);
        this.drawSpr('ui_home', 20, 88, 18);
        c.fillText('kamp ' + cp.done + '/' + cp.total + ' · sandık ' + this.chestsOpened() + '/6', 32, 92);
        if (this.bannerT > 0 && this.brewInfoT <= 0) { // iksir bilgi kutusu açıkken ipucu yazısı gizlenir
            c.textAlign = 'center';
            c.font = this.w < 700 ? 'bold 14px sans-serif' : 'bold 18px sans-serif';
            c.globalAlpha = Math.min(1, this.bannerT);
            c.lineWidth = 4;
            c.strokeStyle = 'rgba(0,0,0,0.7)';
            c.strokeText(this.banner, this.w / 2, this.h * 0.3);
            c.fillStyle = '#fff';
            c.fillText(this.banner, this.w / 2, this.h * 0.3);
            c.globalAlpha = 1;
        }
        if (this.swarm) {
            c.textAlign = 'center';
            c.font = 'bold 18px sans-serif';
            c.lineWidth = 5;
            c.strokeStyle = 'rgba(0,0,0,0.75)';
            const alive = this.enemies.filter((e) => e.sp === BEE_SP && e.hp > 0).length;
            const t = '🐝 ' + T('ARI SÜRÜSÜ') + ' ' + this.swarm.wave + '/' + this.swarm.waves + ' · ' + T('kalan') + ' ' + (alive + this.swarm.total - this.swarm.spawned);
            c.strokeText(t, this.w / 2, this.bonus ? 60 : 34);
            c.fillStyle = '#ffd84a';
            c.fillText(t, this.w / 2, this.bonus ? 60 : 34);
        }
        if (this.bonus) {
            c.textAlign = 'center';
            c.font = 'bold 20px sans-serif';
            c.lineWidth = 5;
            c.strokeStyle = 'rgba(0,0,0,0.75)';
            const t = T('BONUS TUR') + ' ' + Math.ceil(this.bonus.t) + ' sn · ' + this.bonus.kills + '/' + this.bonus.total;
            c.strokeText(t, this.w / 2, 34);
            c.fillStyle = '#ffd84a';
            c.fillText(t, this.w / 2, 34);
        }
        if (this.joy) {
            c.strokeStyle = 'rgba(255,255,255,0.35)';
            c.lineWidth = 2;
            c.beginPath();
            c.arc(this.joy.ox, this.joy.oy, 50, 0, Math.PI * 2);
            c.stroke();
            c.fillStyle = 'rgba(255,255,255,0.35)';
            const dx = this.joy.x - this.joy.ox;
            const dy = this.joy.y - this.joy.oy;
            const d = Math.min(50, Math.hypot(dx, dy));
            const a = Math.atan2(dy, dx);
            c.beginPath();
            c.arc(this.joy.ox + Math.cos(a) * d, this.joy.oy + Math.sin(a) * d, 20, 0, Math.PI * 2);
            c.fill();
        }
        if (this.dead > 0) {
            c.fillStyle = 'rgba(0,0,0,0.5)';
            c.fillRect(0, 0, this.w, this.h);
            c.fillStyle = '#fff';
            c.textAlign = 'center';
            c.font = 'bold 26px sans-serif';
            c.fillText('Bayıldın… evde uyanıyorsun', this.w / 2, this.h / 2);
        }
    }
    arrow(cx, cy, ang, s) {
        const c = this.ctx;
        c.save();
        c.translate(cx, cy);
        c.rotate(ang);
        c.beginPath();
        c.moveTo(s, 0);
        c.lineTo(-s * 0.8, s * 0.72);
        c.lineTo(-s * 0.35, 0);
        c.lineTo(-s * 0.8, -s * 0.72);
        c.closePath();
        c.fillStyle = '#fff';
        c.fill();
        c.lineWidth = 1.5;
        c.strokeStyle = '#3a2a8a';
        c.stroke();
        c.restore();
    }
    /** küçük harita: bulunduğumuz alan; dokununca büyük harita */
    drawMinimap() {
        const c = this.ctx;
        const rad = Math.min(64, this.w * 0.17);
        const cx = this.w - rad - 12;
        const cy = 58 + rad;
        this.mini = { x: cx, y: cy, r: rad };
        const view = 700; // dünya birimi: ekranda yarıçap
        const k = rad / view;
        const X = (x) => cx + (x - this.px) * k;
        const Y = (y) => cy + (y - this.py) * k;
        c.save();
        c.beginPath();
        c.arc(cx, cy, rad, 0, Math.PI * 2);
        c.clip();
        c.fillStyle = '#0c2742';
        c.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
        const [n0, n1] = this.winRange();
        for (let i = n0; i <= n1 && i < ZONES.length - 1; i++) {
            const b = this.bridge(i);
            c.strokeStyle = '#6b5436';
            c.lineWidth = BRIDGE_HALF_WIDTH * 2 * k;
            c.beginPath();
            c.moveTo(X(b.ax), Y(b.ay));
            c.lineTo(X(b.bx), Y(b.by));
            c.stroke();
        }
        ZONES.slice(n0, n1 + 1).forEach((z) => { c.fillStyle = z.bg; c.beginPath(); c.arc(X(z.cx), Y(z.cy), z.radius * k, 0, Math.PI * 2); c.fill(); });
        for (const sp of this.getWorld().spawners) {
            if (Math.abs(sp.x - this.px) > view || Math.abs(sp.y - this.py) > view || this.hardHidden(sp))
                continue;
            c.fillStyle = this.spCleared(sp) ? 'rgba(160,160,160,0.7)' : TIERS[sp.tier].color;
            const s = sp.tier === 'boss' ? 6 : sp.tier === 'elite' || sp.tier === 'knight' ? 4.5 : 3.2;
            c.fillRect(X(sp.x) - s / 2, Y(sp.y) - s / 2, s, s);
        }
        c.fillStyle = '#fff';
        for (const ch of this.getWorld().chests) {
            if (this.save.chests.includes(ch.id) || !this.chestShown(ch, 0) || Math.hypot(ch.x - this.px, ch.y - this.py) > 520)
                continue;
            c.fillRect(X(ch.x) - 2, Y(ch.y) - 2, 4, 4);
        }
        this.drawSpr('ui_home', X(HOME.x), Y(HOME.y), 16);
        {
            const vt = this.vqTarget() ?? this.ckTarget();
            if (vt) {
                c.fillStyle = '#ffd1f0';
                c.beginPath();
                c.arc(X(vt.x), Y(vt.y), 4, 0, Math.PI * 2);
                c.fill();
            }
        }
        for (let i = n0; i <= n1 && i < ZONES.length - 1; i++) {
            const g = this.gatePos(i);
            c.fillStyle = this.gateLocked(i) ? '#ff8a5a' : '#7bff9a';
            c.fillRect(X(g.x) - 2, Y(g.y) - 4, 4, 8);
            const m = this.masterPos(i);
            if (!this.masterOpen(i))
                continue;
            c.fillStyle = '#9ff0ff';
            c.beginPath();
            c.arc(X(m.x), Y(m.y), 3, 0, Math.PI * 2);
            c.fill();
        }
        c.restore();
        this.arrow(cx, cy, this.face, 7);
        c.strokeStyle = 'rgba(255,255,255,0.65)';
        c.lineWidth = 2.5;
        c.beginPath();
        c.arc(cx, cy, rad, 0, Math.PI * 2);
        c.stroke();
        c.font = '10px sans-serif';
        c.fillStyle = 'rgba(255,255,255,0.8)';
        c.textAlign = 'center';
        c.fillText('dokun: harita', cx, cy + rad + 12);
    }
    /** büyük harita: bütün dünya, ok bakış yönünü gösterir */
    drawFullMap() {
        const c = this.ctx;
        c.fillStyle = 'rgba(4,12,24,0.88)';
        c.fillRect(0, 0, this.w, this.h);
        const [f0, f1] = this.winRange(); // büyük haritada yalnızca çevredeki 10 seviye görünür
        const win = ZONES.slice(f0, f1 + 1);
        const minX = Math.min(...win.map((z) => z.cx - z.radius)) - 80;
        const maxX = Math.max(...win.map((z) => z.cx + z.radius)) + 80;
        const minY = Math.min(...win.map((z) => z.cy - z.radius)) - 80;
        const maxY = Math.max(...win.map((z) => z.cy + z.radius)) + 80;
        const k = Math.min((this.w * 0.94) / (maxX - minX), (this.h * 0.6) / (maxY - minY));
        const mw = (maxX - minX) * k;
        const mh = (maxY - minY) * k;
        const mx = (this.w - mw) / 2;
        const my = (this.h - mh) / 2 - 10;
        const X = (x) => mx + (x - minX) * k;
        const Y = (y) => my + (y - minY) * k;
        c.fillStyle = '#0c2742';
        c.fillRect(mx, my, mw, mh);
        c.strokeStyle = 'rgba(255,255,255,0.5)';
        c.lineWidth = 2;
        c.strokeRect(mx, my, mw, mh);
        for (let i = f0; i < f1; i++) {
            const b = this.bridge(i);
            c.strokeStyle = '#6b5436';
            c.lineWidth = Math.max(3, BRIDGE_HALF_WIDTH * 2 * k);
            c.beginPath();
            c.moveTo(X(b.ax), Y(b.ay));
            c.lineTo(X(b.bx), Y(b.by));
            c.stroke();
        }
        win.forEach((z, wi) => {
            const zi = f0 + wi;
            c.fillStyle = z.bg;
            c.beginPath();
            c.arc(X(z.cx), Y(z.cy), z.radius * k, 0, Math.PI * 2);
            c.fill();
            c.strokeStyle = zi === this.region ? '#ffe36b' : this.save.bossDown[zi] ? 'rgba(120,255,160,0.7)' : 'rgba(255,255,255,0.25)';
            c.lineWidth = zi === this.region ? 3 : 2;
            c.stroke();
            c.font = `bold ${Math.max(9, Math.min(15, z.radius * k * 0.6))}px sans-serif`;
            c.textAlign = 'center';
            c.fillStyle = '#fff';
            c.fillText(String(zi + 1), X(z.cx), Y(z.cy) + 4);
        });
        for (const sp of this.getWorld().spawners) {
            if (this.hardHidden(sp))
                continue;
            c.fillStyle = this.spCleared(sp) ? 'rgba(160,160,160,0.7)' : TIERS[sp.tier].color;
            const s = sp.tier === 'boss' ? 9 : sp.tier === 'elite' || sp.tier === 'knight' ? 6 : 4;
            c.fillRect(X(sp.x) - s / 2, Y(sp.y) - s / 2, s, s);
        }
        c.fillStyle = '#fff';
        for (const ch of this.getWorld().chests) {
            if (this.save.chests.includes(ch.id) || !this.chestShown(ch, 0))
                continue;
            if (Math.hypot(ch.x - this.px, ch.y - this.py) < 900)
                c.fillRect(X(ch.x) - 2.5, Y(ch.y) - 2.5, 5, 5);
        }
        this.drawSpr('ui_home', X(HOME.x), Y(HOME.y), 24);
        for (let i = f0; i <= f1 && i < ZONES.length - 1; i++) {
            const g = this.gatePos(i);
            if (!this.drawSpr(this.gateLocked(i) ? 'ui_lock' : 'ui_skill', X(g.x), Y(g.y), 24)) {
                c.fillStyle = this.gateLocked(i) ? '#ff8a5a' : '#7bff9a';
                c.fillRect(X(g.x) - 3, Y(g.y) - 6, 6, 12);
            }
            const m = this.masterPos(i);
            if (!this.masterOpen(i))
                continue;
            c.fillStyle = '#9ff0ff';
            c.beginPath();
            c.arc(X(m.x), Y(m.y), 5, 0, Math.PI * 2);
            c.fill();
        }
        this.arrow(X(this.px), Y(this.py), this.face, 11);
        c.font = 'bold 16px sans-serif';
        c.textAlign = 'center';
        c.fillStyle = '#ffe36b';
        c.fillText(`Ada ${this.region + 1}/${ZONES.length} · ${ZONES[this.region].name} · aşılan: ${this.bossesDown()}`, this.w / 2, 28);
        // açıklama
        const items = [['Kolay', TIERS.easy.color], ['Orta', TIERS.medium.color], ['Zor', TIERS.hard.color], ['Elit', TIERS.elite.color],
            ['Muhafız', TIERS.knight.color], ['Boss', TIERS.boss.color], ['Temiz', '#a0a0a0'], ['Usta', '#9ff0ff'], ['Sandık', '#ffffff']];
        c.font = '12px sans-serif';
        c.textAlign = 'left';
        const names = items.map(([n]) => T(n));
        const widths = names.map((n) => 14 + c.measureText(n).width + 12);
        // satırlara böl (taşan açıklama alt satıra iner, üst üste binmez)
        const maxW = this.w - 24;
        const rows = [[]];
        let rw = 0;
        widths.forEach((w, i) => {
            if (rw + w > maxW && rows[rows.length - 1].length) {
                rows.push([]);
                rw = 0;
            }
            rows[rows.length - 1].push(i);
            rw += w;
        });
        let ly = my + mh + 22;
        for (const row of rows) {
            let lx = (this.w - row.reduce((a, i) => a + widths[i], 0) + 12) / 2;
            for (const i of row) {
                c.fillStyle = items[i][1];
                c.fillRect(lx, ly - 9, 10, 10);
                c.fillStyle = '#fff';
                c.fillText(names[i], lx + 14, ly);
                lx += widths[i];
            }
            ly += 18;
        }
        c.textAlign = 'center';
        c.fillStyle = '#ffe36b';
        c.font = 'bold 14px sans-serif';
        c.fillText(T('Ok: bakış yönün · Kapatmak için dokun'), this.w / 2, ly + 14);
    }
    /** usta cadının eğitiminde yeni oyun açık mı: usta dizini + 1 ≥ gereken ada sayısı */
    miniOpenFor(master, k) { const m = Game.MINIS.find((x) => x.k === k); return !!m && master + 1 >= m.at; }
    /** yeni mini oyun açıldığında bir kez haber verir */
    mgUnlockCheck() {
        for (const m of Game.MINIS) {
            if (this.bossesDown() >= m.at && !this.save.first['mg' + m.k]) {
                this.save.first['mg' + m.k] = 1;
                this.say('Yeni mini oyun açıldı: ' + m.name);
                this.gain('Yeni mini oyun: ' + m.name, '#9ff0ff', 'ui_spells');
            }
        }
    }
    /** tavuk seviyesi: bulunan tavuk sayısı 1→sv1, 2→sv2, 4→sv3, 8→sv4, 16→sv5… */
    chickenLevel() { const n = this.save.ck?.n ?? 0; return n <= 0 ? 0 : 1 + Math.floor(Math.log2(n)); }
    /** her aşılan adada atış süresi 2 sn kısalır (en az 10 sn) */
    eggCooldown() { return Math.max(10, Game.EGG_COOLDOWN - 2 * this.bossesDown()); }
    eggTier() { return Math.min(Game.EGGS.length, Math.max(1, this.chickenLevel())) - 1; }
    /** yumurta hasarı: cadının saniyelik hasarı × tür çarpanı (otomatik ayarlanır) */
    eggDmg() { const t = Game.EGGS[this.eggTier()]; return Math.max(1, this.dps()) * (t.secs + Math.max(0, this.chickenLevel() - Game.EGGS.length) * 10); }
    ckHasSpot(reg) { return reg >= Game.CK_FIRST && (reg - Game.CK_FIRST) % Game.CK_STEP === 0 && !this.save.first['ck' + reg]; }
    ckSpot(reg) {
        const hit = this.ckSpots.get(reg);
        if (hit)
            return hit;
        const z = ZONES[reg];
        const rnd = rng(reg * 997 + 5);
        const rest = this.restPoints()[reg];
        let out = { x: rest.x + 260, y: rest.y };
        for (let k = 0; k < 60; k++) {
            const a = rnd() * Math.PI * 2;
            const d = (0.25 + rnd() * 0.4) * z.radius;
            const x = z.cx + Math.cos(a) * d;
            const y = z.cy + Math.sin(a) * d;
            if (Math.hypot(x - rest.x, y - rest.y) > 280 && this.walkable(x, y, true, false)) {
                out = { x, y };
                break;
            }
        }
        this.ckSpots.set(reg, out);
        return out;
    }
    ckTarget() {
        if (!this.ckHasSpot(this.region))
            return null;
        return { ...this.ckSpot(this.region), label: 'Tavuk' };
    }
    tickChicken(dt) {
        this.eggFx = this.eggFx.filter((f) => (f.t -= dt) > 0);
        // kayıp tavuğu bul
        if (this.ckHasSpot(this.region)) {
            const p = this.ckSpot(this.region);
            if (Math.hypot(p.x - this.px, p.y - this.py) < 60) {
                this.save.first['ck' + this.region] = 1;
                const before = this.chickenLevel();
                this.save.ck = { n: (this.save.ck?.n ?? 0) + 1 };
                const lv = this.chickenLevel();
                if (!this.ck)
                    this.ck = { x: p.x, y: p.y, face: 1, t: 0, moving: false, cd: 1, throwT: 0 };
                this.say(lv > before && before > 0 ? `Tavuk bulundu: seviye atladı (Sv.${lv})` : 'Tavuk bulundu! Düşmanlara yumurta atacak');
                this.gain(`Tavuk bulundu (Sv.${lv})`, '#fff4c0', 'icon_geode');
                audio.play('chest');
                vibrate(50);
                this.persist();
                this.onChange();
            }
        }
        if ((this.save.ck?.n ?? 0) <= 0)
            return;
        if (!this.ck)
            this.ck = { x: this.px - 40, y: this.py + 20, face: 1, t: 0, moving: false, cd: 1, throwT: 0 };
        const k = this.ck;
        k.t += dt;
        k.throwT = Math.max(0, k.throwT - dt);
        this.eggCd = Math.max(0, this.eggCd - dt);
        // oyuncunun yanında dolaşır
        const tg = this.trailAt(0.45);
        const dx = tg.x - k.x + (Math.cos(this.face) >= 0 ? -34 : 34);
        const dy = tg.y - k.y - 22;
        const d = Math.hypot(dx, dy);
        if (d > 800) {
            k.x = tg.x;
            k.y = tg.y;
        }
        const sp = Math.min(d, (30 + d * 3) * dt);
        k.moving = d > 6 && sp / Math.max(dt, 1e-3) > 20;
        if (d > 3) {
            k.x += (dx / d) * sp;
            k.y += (dy / d) * sp;
        }
        if (Math.abs(dx) > 5)
            k.face = dx > 0 ? 1 : -1;
        // hedef: yakındaki en yakın canlı düşman
        if (this.eggCd <= 0 && this.dead <= 0) {
            // hedef: etrafında en çok düşman olan düşman (bomba gibi alan hasarı)
            const tier = Game.EGGS[this.eggTier()];
            let tgt = null;
            let best = 0;
            const live = this.enemies.filter((e) => e.hp > 0 && !e.fly && this.visible(e.x, e.y) && e.state !== 'return' && !(e.seg && !this.snakeWrapped(e)));
            for (const e of live) {
                if (Math.hypot(e.x - k.x, e.y - k.y) > 480)
                    continue;
                let n = 0;
                for (const o of live)
                    if (Math.hypot(o.x - e.x, o.y - e.y) < tier.radius)
                        n += o.tier === 'boss' ? 3 : 1;
                if (n > best) {
                    best = n;
                    tgt = e;
                }
            }
            if (tgt) {
                this.eggCd = this.eggCooldown();
                k.throwT = 0.4;
                k.face = tgt.x >= k.x ? 1 : -1;
                this.eggs.push({ sx: k.x, sy: k.y - 20, tx: tgt.x, ty: tgt.y, t: 0, dur: 0.8, e: tgt, dmg: this.eggDmg(), lv: this.eggTier() });
                this.say(`${T(tier.name)} fırlatıldı!`);
                audio.play('boss');
            }
        }
        for (const g of this.eggs) {
            g.t += dt;
            if (g.e.hp > 0) {
                g.tx = g.e.x;
                g.ty = g.e.y;
            }
            if (g.t >= g.dur) {
                this.eggFx.push({ x: g.tx, y: g.ty, t: 0.9, lv: g.lv });
                const rad = Game.EGGS[g.lv].radius;
                for (const o of [...this.enemies]) {
                    if (o.hp <= 0 || Math.hypot(o.x - g.tx, o.y - g.ty) > rad)
                        continue;
                    this.hitEnemy(o, g.dmg, 'smash');
                }
                this.shake = Math.max(this.shake, 6 + 2 * g.lv);
                audio.play('hit');
                vibrate(60);
            }
        }
        this.eggs = this.eggs.filter((g) => g.t < g.dur);
    }
    drawChicken() {
        if (this.holeCow?.who === 'ck')
            return;
        const k = this.ck;
        const c = this.ctx;
        // bulunacak tavuk
        const ct = this.ckTarget();
        if (ct)
            this.drawChickenAt(ct.x, ct.y, 1, this.time, false, 0, true);
        if (ct) {
            c.font = 'bold 13px sans-serif';
            c.textAlign = 'center';
            c.lineWidth = 3;
            c.strokeStyle = 'rgba(0,0,0,0.7)';
            const yy = ct.y - 52 + Math.sin(this.time * 4) * 3;
            c.strokeText('🐔 ' + T('Tavuk'), ct.x, yy);
            c.fillStyle = '#fff4c0';
            c.fillText('🐔 ' + T('Tavuk'), ct.x, yy);
        }
        if (k && (this.save.ck?.n ?? 0) > 0) {
            this.drawChickenAt(k.x, k.y, k.face, k.t, k.moving, k.throwT, false);
            c.font = 'bold 11px sans-serif';
            c.textAlign = 'center';
            c.lineWidth = 3;
            c.strokeStyle = 'rgba(0,0,0,0.7)';
            const lt = 'Sv.' + this.chickenLevel() + ' · ' + (this.eggCd > 0 ? '🥚 ' + Math.ceil(this.eggCd) + 'sn' : '🥚 hazır');
            c.strokeText(lt, k.x, k.y - 40);
            c.fillStyle = this.eggCd > 0 ? '#fff4c0' : '#9aff9a';
            c.fillText(lt, k.x, k.y - 40);
        }
        for (const g of this.eggs) {
            const u = Math.min(1, g.t / g.dur);
            const x = g.sx + (g.tx - g.sx) * u;
            const y = g.sy + (g.ty - g.sy) * u - Math.sin(Math.PI * u) * 60;
            const tr = Game.EGGS[g.lv];
            const sz = 1.3 + 0.35 * g.lv;
            c.save();
            c.translate(x, y);
            c.rotate(u * 9);
            c.scale(sz, sz);
            if (g.lv >= 2) {
                c.shadowColor = tr.fill;
                c.shadowBlur = 12;
            }
            c.fillStyle = tr.fill;
            c.strokeStyle = tr.edge;
            c.lineWidth = 1.5;
            c.beginPath();
            c.ellipse(0, 0, 6, 8, 0, 0, Math.PI * 2);
            c.fill();
            c.stroke();
            c.restore();
        }
        for (const f of this.eggFx) {
            const u = 1 - f.t / 0.9;
            const tr = Game.EGGS[f.lv];
            const R = tr.radius;
            c.save();
            c.globalCompositeOperation = 'lighter';
            const g = c.createRadialGradient(f.x, f.y, 4, f.x, f.y, R * (0.4 + 0.8 * u));
            g.addColorStop(0, `rgba(255,255,230,${0.9 * (1 - u)})`);
            g.addColorStop(0.6, tr.fill + '88');
            g.addColorStop(1, 'rgba(255,200,80,0)');
            c.globalAlpha = Math.max(0, 1 - u * 0.9);
            c.fillStyle = g;
            c.beginPath();
            c.arc(f.x, f.y, R * (0.4 + 0.8 * u), 0, Math.PI * 2);
            c.fill();
            c.globalAlpha = 1;
            c.strokeStyle = `rgba(255,255,255,${0.9 * (1 - u)})`;
            c.lineWidth = 6 * (1 - u) + 1;
            c.beginPath();
            c.arc(f.x, f.y, R * u, 0, Math.PI * 2);
            c.stroke();
            c.restore();
            c.fillStyle = tr.fill;
            for (let i = 0; i < 8; i++) {
                const a = i * 0.785 + 0.3;
                const rr = R * 0.9 * u;
                c.beginPath();
                c.ellipse(f.x + Math.cos(a) * rr, f.y + Math.sin(a) * rr * 0.6 - 30 * Math.sin(u * Math.PI), 4, 3, a, 0, Math.PI * 2);
                c.fill();
            }
        }
    }
    drawChickenAt(x, y, face, t, moving, thr, idle) {
        const c = this.ctx;
        c.fillStyle = 'rgba(0,0,0,0.22)';
        c.beginPath();
        c.ellipse(x, y + 12, 13, 4.5, 0, 0, Math.PI * 2);
        c.fill();
        const name = moving ? 'chicken_walk' + (1 + (Math.floor(t * 10) % 4)) : thr > 0 && this.spr('chicken_throw1') ? 'chicken_throw1' : 'chicken_walk1';
        const bob = moving ? -Math.abs(Math.sin(t * 12)) * 4 : idle ? Math.abs(Math.sin(t * 3)) * -3 : 0;
        if (this.spr(name) && this.drawSprX(name, x, y - 2, 46, { flip: face, bob }))
            return;
        // yedek: tuvalle çizilmiş tavuk
        c.save();
        c.translate(x, y + bob);
        c.scale(face, 1);
        const lean = thr > 0 ? -0.35 : 0;
        c.rotate(lean);
        c.strokeStyle = '#e08a2a';
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(-3, 6);
        c.lineTo(-3, 13);
        c.moveTo(4, 6);
        c.lineTo(4, 13);
        c.stroke();
        c.fillStyle = '#fffaf0';
        c.strokeStyle = '#b89a6a';
        c.lineWidth = 1.5;
        c.beginPath();
        c.ellipse(0, 0, 13, 10, 0, 0, Math.PI * 2);
        c.fill();
        c.stroke();
        c.beginPath();
        c.arc(11, -9, 6.5, 0, Math.PI * 2);
        c.fill();
        c.stroke();
        c.fillStyle = '#e84a3a';
        c.beginPath();
        c.arc(9, -15, 2.4, 0, Math.PI * 2);
        c.arc(12.5, -15.5, 2.4, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#f2a21a';
        c.beginPath();
        c.moveTo(16.5, -9);
        c.lineTo(22, -7.5);
        c.lineTo(16.5, -6);
        c.fill();
        c.fillStyle = '#222';
        c.beginPath();
        c.arc(13, -10, 1.3, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#f3e4c4';
        c.beginPath();
        c.ellipse(-3, 1, 7, 5, 0.3 + (thr > 0 ? -0.8 : Math.sin(t * 6) * 0.1), 0, Math.PI * 2);
        c.fill();
        c.stroke();
        c.fillStyle = '#fffaf0';
        c.beginPath();
        c.moveTo(-12, -3);
        c.lineTo(-19, -9);
        c.lineTo(-14, 2);
        c.fill();
        c.restore();
    }
    gemMul() { return this.save.gemMul ?? 1; }
    gemTigerMul() { return this.save.gemTiger ?? 1; }
    /** adada görevin durağı: giriş kampı ile ada merkezi arasında, yürünebilir bir nokta */
    vqSpot(reg) {
        const hit = this.vqSpots.get(reg);
        if (hit)
            return hit;
        const rp = this.restPoints()[reg];
        const c = this.regionCenter(reg);
        const bx = rp.x + (c.x - rp.x) * 0.32;
        const by = rp.y + (c.y - rp.y) * 0.32;
        let out = { x: bx, y: by };
        search: for (let r = 0; r <= 360; r += 40) {
            for (let a = 0; a < 8; a++) {
                const x = bx + Math.cos(a * 0.785) * r;
                const y = by + Math.sin(a * 0.785) * r;
                if (this.walkable(x, y, true, false) && Math.hypot(x - rp.x, y - rp.y) > 190) {
                    out = { x, y };
                    break search;
                }
            }
        }
        this.vqSpots.set(reg, out);
        return out;
    }
    /** şu an gidilecek yer: inek ya da köylü */
    vqTarget() {
        const s = this.save.vq?.s ?? 0;
        if (s === 1 && this.region >= Game.VQ_COW)
            return { ...this.vqSpot(this.region), label: 'İnek' };
        if (s === 2 && this.region >= Game.VQ_VIL) {
            const p = this.vqSpot(this.region);
            return { x: p.x + 70, y: p.y, label: 'Köylü' };
        }
        return null;
    }
    trailAt(delay) {
        const want = this.time - delay;
        for (const p of this.trail)
            if (p.t >= want)
                return p;
        return { x: this.px, y: this.py };
    }
    stepFollower(f, delay, dt) {
        const tg = this.trailAt(delay);
        const dx = tg.x - f.x;
        const dy = tg.y - f.y;
        const d = Math.hypot(dx, dy);
        if (d > 700) {
            f.x = tg.x;
            f.y = tg.y;
            return;
        }
        const sp = Math.min(d, (40 + d * 3.2) * dt);
        if (d > 1.5) {
            f.x += (dx / d) * sp;
            f.y += (dy / d) * sp;
        }
        f.moving = sp / Math.max(dt, 1e-3) > 22;
        if (Math.abs(dx) > 3)
            f.face = dx > 0 ? 1 : -1;
        f.t += dt;
    }
    newFollower(x, y) { return { x, y, face: 1, t: Math.random() * 3, moving: false, a: 1 }; }
    tickVillager(dt) {
        const q = this.save.vq ?? (this.save.vq = { s: 0, w: 0 });
        this.trail.push({ x: this.px, y: this.py, t: this.time });
        while (this.trail.length > 1 && this.trail[0].t < this.time - 4)
            this.trail.shift();
        if (q.s === 0 && this.region >= Game.VQ_ASK) {
            q.s = 1;
            this.save.first['seenvq1'] = 1;
            this.persist();
            this.narrate('vq1');
        }
        // kart eski sürümde görünmeden tüketilmiş olabilir: inek hâlâ aranıyorsa bir kez daha gösterilir
        if (q.s === 1 && !this.save.first['seenvq1']) {
            this.save.first['seenvq1'] = 1;
            this.persist();
            this.onNarrate('vq1');
        }
        if (q.s === 1 && this.region >= Game.VQ_COW) {
            const p = this.vqSpot(this.region);
            if (Math.hypot(p.x - this.px, p.y - this.py) < 80) {
                q.s = 2;
                this.vqCow = this.newFollower(p.x, p.y);
                this.say('İneği buldun! Seni takip ediyor');
                this.gain('İnek bulundu', '#ffd1f0', 'ui_skill');
                audio.play('chest');
                vibrate(60);
                this.persist();
                this.onChange();
            }
        }
        if (q.s === 2 && this.region >= Game.VQ_VIL && this.vqCow) {
            const p = this.vqSpot(this.region);
            const vx = p.x + 70;
            if (Math.hypot(vx - this.px, p.y - this.py) < 130 && Math.hypot(this.vqCow.x - vx, this.vqCow.y - p.y) < 230) {
                q.s = 3;
                q.w = 0;
                this.vqVil = this.newFollower(vx, p.y);
                this.say('Köylü ineğine kavuştu! Artık seninle yürüyor');
                audio.play('chest');
                vibrate([60, 40, 60]);
                this.persist();
                this.onChange();
                this.narrate('vq2');
            }
        }
        // sayfa yenilenince takipçiler bellekten silinir: kayıttaki aşamaya göre yeniden oluşturulur
        if ((q.s === 2 || q.s === 3) && !this.vqCow)
            this.vqCow = this.newFollower(this.px - 60, this.py + 24);
        if (q.s === 3 && !this.vqVil)
            this.vqVil = this.newFollower(this.px - 110, this.py + 24);
        if (q.s === 4 && !this.gemAnim && !this.save.gemMul && !this.save.gemTiger)
            this.startGem(); // elmas verilmeden yenilenmişse tamamlanır
        if (q.s === 2 || q.s === 3) {
            if (this.vqCow && this.holeCow?.who !== 'cow') {
                this.stepFollower(this.vqCow, 1.0, dt);
                this.tickCowKick(dt);
            }
            if (this.vqVil && this.holeCow?.who !== 'vil') {
                if (q.s === 3)
                    this.tickVillagerFight(this.vqVil, dt);
                else
                    this.stepFollower(this.vqVil, 1.9, dt);
            }
        }
        if (q.s === 3) {
            q.w += dt;
            if (this.region >= Game.VQ_END && q.w >= 25) {
                q.s = 4;
                this.persist();
                if (this.save.first['narvq3'])
                    this.startGem();
                else
                    this.narrate('vq3');
            }
        }
        if (q.s === 4 && this.gemAnim)
            this.tickGem(dt);
    }
    /** güç: cadı ile kaplanın ortası; can ve hasar cadınınkilerle aynı oranda ölçeklenir */
    villagerPower() { return Math.floor((this.fullPower() + this.tigerPower()) / 2); }
    villagerK() { return this.villagerPower() / Math.max(1, this.fullPower()); }
    villagerHp() { return this.maxHp() * this.villagerK(); }
    villagerDps() { return this.dps() * this.villagerK(); }
    /** köylü kaplan gibi davranır: yakındaki düşmana, boss evine, kuleye/binaya ve kırılabilir kayaya yürüyüp sopayla vurur.
     * Yürüyüşü kaplandan yavaştır (140 / 250) ama vuruşu kaplandan hızlıdır (aralık kaplanınkinin %55'i); yaralanmaz. */
    villagerInterval() { return Math.max(0.25, this.tigerInterval() * 0.55); }
    tickVillagerFight(v, dt) {
        v.cd = Math.max(0, (v.cd ?? 0) - dt);
        v.atkT = Math.max(0, (v.atkT ?? 0) - dt);
        v.t += dt;
        let best = null;
        let bd = 560;
        // köylü oyuncudan uzaklaşmaz: oyuncu başka adaya/uzağa geçtiyse savaşı bırakıp peşinden gelir; yalnızca oyuncunun çevresindeki hedeflere saldırır
        const LEASH = 520;
        if (Math.hypot(v.x - this.px, v.y - this.py) > LEASH + 120) {
            v.moving = true;
            this.stepFollower(v, 1.2, dt);
            return;
        }
        const key = (t) => (t.kind === 'enemy' ? t.e : t.kind === 'house' ? t.sp : t.o);
        if (!v.skip)
            v.skip = new Map();
        const consider = (t, w) => { if ((v.skip?.get(key(t)) ?? 0) > this.time || Math.hypot(t.x - this.px, t.y - this.py) > LEASH)
            return; const d = Math.hypot(t.x - v.x, t.y - v.y) * w; if (d < bd) {
            bd = d;
            best = t;
        } };
        for (const e of this.enemies) {
            if (e.hp <= 0 || !this.visible(e.x, e.y) || e.state === 'return')
                continue;
            if (e.seg && !this.snakeWrapped(e))
                continue;
            if (this.snakeFight && !e.seg)
                continue;
            consider({ kind: 'enemy', e, x: e.x, y: e.y, reach: this.erad(e) + 34 }, 0.8); // canlı düşman öncelikli
        }
        if (!this.snakeFight) {
            for (const sp of this.bossHouses())
                consider({ kind: 'house', sp, x: sp.x, y: sp.y, reach: 80 }, 1);
            for (const o of this.liveBlds()) {
                if (Math.abs(o.x - v.x) < 480 && Math.abs(o.y - v.y) < 480)
                    consider({ kind: 'bld', o, x: o.x, y: o.y, reach: o.r + 34 }, 1.05);
            }
        }
        const tg = best;
        if (!tg) {
            this.stepFollower(v, 1.9, dt);
            return;
        }
        const dx = tg.x - v.x;
        const dy = tg.y - v.y;
        const d = Math.hypot(dx, dy) || 1;
        if (Math.abs(dx) > 4)
            v.face = dx > 0 ? 1 : -1;
        if (d <= tg.reach) {
            v.moving = false;
            if (v.cd <= 0) {
                const iv = this.villagerInterval();
                v.cd = iv;
                v.atkT = 0.3;
                v.combo = (v.combo ?? 0) + 1;
                audio.play('tigerhit');
                const dmg = this.villagerDps() * iv;
                if (tg.kind === 'enemy')
                    this.hitEnemy(tg.e, dmg, 'smash');
                else if (tg.kind === 'house')
                    this.hitHouse(tg.sp, dmg, 'smash');
                else
                    this.hitBld(tg.o, dmg);
            }
            return;
        }
        const nx = v.x + (dx / d) * 140 * dt;
        const ny = v.y + (dy / d) * 140 * dt;
        const x0 = v.x;
        const y0 = v.y;
        if (this.walkable(nx, ny, true, true)) {
            v.x = nx;
            v.y = ny;
        }
        else if (this.walkable(nx, v.y, true, true))
            v.x = nx;
        else if (this.walkable(v.x, ny, true, true))
            v.y = ny;
        v.moving = true;
        // yol kesikse (su, boşluk) bu hedef 8 sn atlanır: köylü ulaşılamayan hedefte takılıp kalmasın
        v.stuck = Math.hypot(v.x - x0, v.y - y0) < 140 * dt * 0.3 ? (v.stuck ?? 0) + dt : 0;
        if ((v.stuck ?? 0) > 0.7) {
            v.skip.set(key(tg), this.time + 8);
            v.stuck = 0;
        }
    }
    /** kart kapanınca (main.ts) çağrılır */
    afterNarrate(key) { if (key === 'vq3')
        this.startGem(); }
    startGem() { if (!this.gemAnim)
        this.gemAnim = { t: 0, applied: false }; }
    tickGem(dt) {
        const g = this.gemAnim;
        if (!g)
            return;
        g.t += dt;
        if (this.vqVil && this.vqVil.moving)
            g.t = Math.min(g.t, 0.3); // elmas verilirken köylü yerinde durur
        if (this.vqVil)
            this.stepFollowerStill(this.vqVil, dt);
        if (this.vqCow)
            this.stepFollowerStill(this.vqCow, dt);
        if (g.t >= 2.2 && !g.applied) {
            g.applied = true;
            this.applyGem();
        }
        if (g.t >= 3.4) {
            this.vqLeave += dt;
            const k = Math.min(1, this.vqLeave / 3.2);
            for (const f of [this.vqVil, this.vqCow])
                if (f) {
                    f.x -= 38 * dt * (1 + k);
                    f.y -= 8 * dt;
                    f.face = -1;
                    f.moving = true;
                    f.a = 1 - k;
                    f.t += dt;
                }
            if (k >= 1) {
                this.vqVil = null;
                this.vqCow = null;
                this.gemAnim = null;
                this.say('Köylü ve ineği köye döndü');
                this.persist();
            }
        }
    }
    /** inek çiftesi: arkasındaki düşmana tekme atar; düşman havalanıp uçar, canının %40-50'sini kaybeder (boss ve canavarlar yalnızca %4) */
    tickCowKick(dt) {
        const cow = this.vqCow;
        if (!cow)
            return;
        cow.atkT = Math.max(0, (cow.atkT ?? 0) - dt);
        cow.cd = Math.max(0, (cow.cd ?? 0) - dt);
        if (cow.cd > 0)
            return;
        for (const e of this.enemies) {
            if (e.hp <= 0 || e.seg || e.fly || e.state === 'return' || !this.visible(e.x, e.y))
                continue;
            const dx = e.x - cow.x;
            const dy = e.y - cow.y;
            if (dx * cow.face >= 0 || Math.abs(dx) > 95 + this.erad(e) * 0.5 || Math.abs(dy) > 60)
                continue; // yalnızca inek arkasındakilere
            const tough = e.tier === 'boss' || e.tier === 'hard' || !!e.beast;
            const pct = tough ? 0.04 : 0.4 + Math.random() * 0.1;
            cow.cd = 3.5;
            cow.atkT = 0.5;
            e.hp -= e.maxHp * pct;
            e.flash = 0.25;
            if (e.state === 'idle')
                e.state = 'chase';
            const dir = dx >= 0 ? 1 : -1;
            e.fly = { t: 0, dur: 0.9, vx: dir * 210, vy: (dy >= 0 ? 1 : -1) * 40, dir };
            this.float(e.x, e.y - this.erad(e) - 30, '-%' + Math.round(pct * 100), '#ffb36b');
            this.say('İnek çifte attı!');
            audio.play('tigerhit');
            this.shake = Math.max(this.shake, 5);
            return;
        }
    }
    stepFollowerStill(f, dt) { f.moving = false; f.t += dt; }
    /** elmas: boss gücüne göre güç artışı. Hedef güç/boss oranı 1.8–4 aralığında kalır; karakter zaten ≥4 kat güçlüyse elmas kaplana gider */
    applyGem() {
        const reg = Math.min(this.region, ZONES.length - 1);
        const boss = Math.max(1, this.bossPower(reg));
        const r = this.fullPower() / boss;
        audio.play('boss');
        vibrate([60, 40, 160]);
        this.shake = Math.max(this.shake, 9);
        if (r >= 4) {
            this.save.gemTiger = 2;
            this.say('Elmas asana takıldı: kaplanın güçlendi (×2)');
            this.gain('Elmas: kaplanın gücü ×2', '#8fe8ff', 'ui_power');
        }
        else {
            const want = Math.min(4, Math.max(1.8, r * 1.5));
            this.save.gemMul = Math.max(1, Math.round((want / Math.max(r, 1e-6)) * 100) / 100);
            // gerçek gücü ölçüp hedef orana oturt (zırh ve direnç doğrusal değil)
            for (let i = 0; i < 3; i++) {
                const r2 = this.fullPower() / boss;
                if (Math.abs(r2 - want) / want < 0.02)
                    break;
                this.save.gemMul = Math.max(1, Math.round(this.save.gemMul * (want / Math.max(r2, 1e-6)) * 100) / 100);
            }
            this.hp = this.maxHp();
            this.say('Elmas asana takıldı: gücün ×' + this.save.gemMul.toFixed(2));
            this.gain('Elmas: güç ×' + this.save.gemMul.toFixed(2), '#9ad7ff', 'ui_power');
        }
        this.persist();
        this.onChange();
    }
    drawVillagerQuest(top) {
        const c = this.ctx;
        const q = this.save.vq;
        if (!q)
            return;
        const has = (n) => !!this.spr(n);
        const drawNpc = (kind, f, joy = false) => {
            c.globalAlpha = f.a;
            c.fillStyle = 'rgba(0,0,0,0.25)';
            c.beginPath();
            c.ellipse(f.x, f.y + 15, kind === 'cow' ? 24 : 16, 6.5, 0, 0, Math.PI * 2);
            c.fill();
            let name = kind === 'cow' ? 'cow_walk2' : 'villager_walk2';
            const fa = f;
            if (kind === 'vil' && (fa.atkT ?? 0) > 0 && has('villager_atk1'))
                name = fa.atkT > 0.15 ? 'villager_atk1' : (fa.combo ?? 0) % 2 === 0 ? 'villager_atk2' : 'villager_atk3';
            else if (f.moving)
                name = (kind === 'cow' ? 'cow_walk' : 'villager_walk') + (1 + (Math.floor(f.t * 9) % 4));
            else if (joy && kind === 'vil')
                name = 'villager_joy' + (1 + (Math.floor(f.t * 3) % 2));
            const bob = f.moving ? -Math.abs(Math.sin(f.t * 10)) * 3 : Math.sin(f.t * 2) * 1.2;
            const size = kind === 'cow' ? 72 : 80;
            if (!has(name) || !this.drawSprX(name, f.x, f.y - 4, size, { flip: f.face, bob: bob - (kind === 'cow' && (fa.atkT ?? 0) > 0 ? 8 : 0), rot: kind === 'cow' && (fa.atkT ?? 0) > 0 ? 0.55 * f.face : f.moving ? Math.sin(f.t * 10) * 0.05 : 0 })) {
                c.fillStyle = kind === 'cow' ? '#f2e6d6' : '#6a9a52';
                c.beginPath();
                c.ellipse(f.x, f.y - 6, 16, 12, 0, 0, Math.PI * 2);
                c.fill();
            }
            c.globalAlpha = 1;
        };
        if (!top) {
            const tg = this.vqTarget();
            if (tg) {
                const near = Math.hypot(tg.x - this.px, tg.y - this.py) < 320;
                const f = { x: tg.x, y: tg.y, face: this.px < tg.x ? -1 : 1, t: this.time, moving: false, a: 1 };
                drawNpc(tg.label === 'İnek' ? 'cow' : 'vil', f, near);
                c.font = 'bold 13px sans-serif';
                c.textAlign = 'center';
                c.lineWidth = 3;
                c.strokeStyle = 'rgba(0,0,0,0.7)';
                const txt = (tg.label === 'İnek' ? '❓ ' : '❗ ') + T(tg.label);
                const yy = tg.y - 62 + Math.sin(this.time * 4) * 3;
                c.strokeText(txt, tg.x, yy);
                c.fillStyle = '#ffe9a0';
                c.fillText(txt, tg.x, yy);
            }
            if (this.vqVil) {
                drawNpc('vil', this.vqVil, !!this.gemAnim && this.gemAnim.t < 2.2);
                c.font = 'bold ' + Math.round(12 * this.lk()) + 'px sans-serif';
                c.textAlign = 'center';
                c.lineWidth = 3;
                c.strokeStyle = 'rgba(0,0,0,0.7)';
                const pt = '⚔ ' + this.fmt(this.villagerPower());
                c.strokeText(pt, this.vqVil.x, this.vqVil.y - 62);
                c.fillStyle = '#ffe9a0';
                c.fillText(pt, this.vqVil.x, this.vqVil.y - 62);
            }
            if (this.vqCow)
                drawNpc('cow', this.vqCow);
            return;
        }
        const g = this.gemAnim;
        if (!g)
            return;
        const flip = Math.cos(this.face) < 0 ? -1 : 1;
        const tipX = this.px + 24 * flip;
        const tipY = this.py - 40;
        const v = this.vqVil;
        if (g.t < 2.2 && v) {
            const u = Math.max(0, Math.min(1, (g.t - 0.4) / 1.8));
            const e = u * u * (3 - 2 * u);
            const sx = v.x;
            const sy = v.y - 40;
            const x = sx + (tipX - sx) * e;
            const y = sy + (tipY - sy) * e - Math.sin(e * Math.PI) * 60;
            for (let i = 0; i < 8; i++) {
                const k = Math.max(0, e - i * 0.03);
                const tx = sx + (tipX - sx) * k;
                const ty = sy + (tipY - sy) * k - Math.sin(k * Math.PI) * 60;
                c.fillStyle = 'rgba(160,210,255,' + (0.5 - i * 0.06) + ')';
                c.beginPath();
                c.arc(tx, ty, 6 - i * 0.5, 0, Math.PI * 2);
                c.fill();
            }
            if (!this.drawSpr('gem_star', x, y, 34 + 8 * Math.sin(this.time * 12), this.time * 2)) {
                c.fillStyle = '#9ad7ff';
                c.beginPath();
                c.arc(x, y, 8, 0, Math.PI * 2);
                c.fill();
            }
        }
        else {
            // asaya takıldı: parıltı halkaları
            const k = Math.min(1, (g.t - 2.2) / 1.2);
            c.save();
            c.globalCompositeOperation = 'lighter';
            for (let i = 0; i < 3; i++) {
                const kk = Math.max(0, k - i * 0.18);
                if (kk <= 0)
                    continue;
                c.strokeStyle = 'rgba(150,210,255,' + (0.9 * (1 - kk)) + ')';
                c.lineWidth = 4 * (1 - kk) + 1;
                c.beginPath();
                c.arc(tipX, tipY, 12 + kk * 70, 0, Math.PI * 2);
                c.stroke();
            }
            const gg = c.createRadialGradient(tipX, tipY, 1, tipX, tipY, 46);
            gg.addColorStop(0, 'rgba(200,235,255,' + (0.9 * (1 - k * 0.6)) + ')');
            gg.addColorStop(1, 'rgba(120,170,255,0)');
            c.fillStyle = gg;
            c.fillRect(tipX - 50, tipY - 50, 100, 100);
            c.restore();
            this.drawSpr('gem_star', tipX, tipY, 22 + 4 * Math.sin(this.time * 9));
        }
    }
    noRespawn(reg) { return reg >= Game.NORESPAWN_FROM; }
    startDoom() {
        if (this.doom)
            return;
        this.doom = { t: 0, shop: 0, seed: Math.random() * 1000 };
        this.save.doom = true;
        this.enemies = [];
        this.projs = [];
        this.say('Usta Cadı: "Yeter, çırak. Burası senin adan değil."');
        audio.play('boss');
        this.persist();
        this.onChange();
    }
    endDoom() {
        this.doom = null;
        this.save.doom = false;
        this.shake = Math.max(this.shake, 8);
        this.say('Usta Cadı\'nın büyüsü bozuldu: adaya döndün');
        this.persist();
    }
    /** true = doom sürüyor, oyunun geri kalanı durur */
    tickDoom(dt) {
        if (!this.doom) {
            if (this.save.doom) {
                if (this.paywalled(this.region))
                    this.doom = { t: Game.DOOM_FALL, shop: 0, seed: Math.random() * 1000 };
                else
                    this.save.doom = false;
            }
            else {
                this.narrGap -= dt;
                if (this.narrGap <= 0) {
                    if (this.region >= Game.NORESPAWN_FROM && !this.save.first['narnorespawn']) {
                        this.narrate('norespawn');
                        this.narrGap = 12;
                    }
                    else if (this.region === BASE_ISLANDS - 1 && !this.save.first['narwall40']) {
                        this.narrate('wall40');
                        this.narrGap = 12;
                    }
                }
            }
            if (!this.doom)
                return false;
        }
        const d = this.doom;
        const before = d.t;
        d.t += dt;
        if (d.t > 1.4 && d.t < 3.4)
            this.shake = Math.max(this.shake, 11);
        if (before < 2.8 && d.t >= 2.8) {
            audio.play('boss');
            vibrate([120, 60, 240]);
        }
        if (before < Game.DOOM_FALL && d.t >= Game.DOOM_FALL)
            this.narrate('fall40');
        if (d.t >= Game.DOOM_FALL) {
            d.shop += dt;
            if (d.shop > 2.4 && d.shop < 1000) {
                d.shop = 1000;
                this.onPaywall();
            }
        }
        return true;
    }
    drawDoom() {
        const d = this.doom;
        if (!d)
            return;
        const c = this.ctx;
        const w = this.w;
        const h = this.h;
        const t = d.t;
        const cx = w / 2;
        const cy = h * 0.46;
        if (t < Game.DOOM_FALL) {
            c.save();
            c.fillStyle = 'rgba(30,10,60,' + Math.min(0.6, t * 0.5) + ')';
            c.fillRect(0, 0, w, h);
            // usta cadı: sağ üstte belirir
            const wx = w * 0.74;
            const wy = h * 0.2;
            c.globalAlpha = Math.min(1, t * 1.5);
            c.globalCompositeOperation = 'lighter';
            const g = c.createRadialGradient(wx, wy, 4, wx, wy, 150);
            g.addColorStop(0, 'rgba(190,120,255,0.8)');
            g.addColorStop(1, 'rgba(190,120,255,0)');
            c.fillStyle = g;
            c.fillRect(wx - 160, wy - 160, 320, 320);
            c.globalCompositeOperation = 'source-over';
            this.drawSprX('master', wx, wy, 130, { bob: Math.sin(this.time * 3) * 3, flip: -1 });
            c.globalAlpha = 1;
            c.font = 'bold 14px sans-serif';
            c.textAlign = 'center';
            c.fillStyle = '#e8d2ff';
            c.fillText(T('Usta Cadı') + ' ' + ZONES[Math.min(this.region, ZONES.length - 1)].master, wx, wy - 84);
            // yıldırım
            if (t > 1.4 && t < 3.2) {
                c.globalCompositeOperation = 'lighter';
                for (let b = 0; b < 3; b++) {
                    c.strokeStyle = b === 0 ? 'rgba(255,255,255,0.95)' : 'rgba(190,120,255,0.8)';
                    c.lineWidth = b === 0 ? 3 : 6;
                    c.beginPath();
                    c.moveTo(wx, wy + 20);
                    const steps = 9;
                    for (let i = 1; i <= steps; i++) {
                        const k = i / steps;
                        c.lineTo(wx + (cx - wx) * k + (Math.random() - 0.5) * 46 * (1 - k * 0.4), wy + 20 + (cy - wy - 20) * k + (Math.random() - 0.5) * 24);
                    }
                    c.stroke();
                }
                // zemin çatlakları
                c.strokeStyle = 'rgba(255,230,255,0.85)';
                c.lineWidth = 2;
                const grow = Math.min(1, (t - 1.4) / 1.4);
                for (let i = 0; i < 12; i++) {
                    const a = (i / 12) * Math.PI * 2 + d.seed;
                    c.beginPath();
                    c.moveTo(cx, cy + 40);
                    let x = cx;
                    let y = cy + 40;
                    for (let s = 0; s < 5; s++) {
                        x += Math.cos(a + (Math.random() - 0.5) * 0.6) * 38 * grow;
                        y += Math.sin(a + (Math.random() - 0.5) * 0.6) * 24 * grow;
                        c.lineTo(x, y);
                    }
                    c.stroke();
                }
                c.globalCompositeOperation = 'source-over';
            }
            // yıkım parlaması ve gökyüzüne geçiş
            if (t > 2.8) {
                const fl = t < 3.2 ? (t - 2.8) / 0.4 : Math.max(0, 1 - (t - 3.2) / 1.0);
                c.fillStyle = 'rgba(255,245,255,' + 0.9 * Math.max(0, Math.min(1, fl)) + ')';
                c.fillRect(0, 0, w, h);
                const cover = Math.min(1, (t - 3.2) / 1.0);
                if (cover > 0) {
                    this.drawDoomSky(cover);
                }
            }
            c.restore();
            return;
        }
        this.drawDoomSky(1);
    }
    /** sonsuz düşüş: gökyüzü, yukarı akan bulutlar, kaya parçaları ve takla atan cadı */
    drawDoomSky(alpha) {
        const d = this.doom;
        if (!d)
            return;
        const c = this.ctx;
        const w = this.w;
        const h = this.h;
        const tt = this.time;
        c.save();
        c.globalAlpha = alpha;
        const g = c.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#1a0f45');
        g.addColorStop(0.55, '#4a2a8a');
        g.addColorStop(1, '#e9a0c8');
        c.fillStyle = g;
        c.fillRect(0, 0, w, h);
        // yıldızlar
        c.fillStyle = 'rgba(255,255,255,0.7)';
        for (let i = 0; i < 40; i++) {
            const sx = (i * 97 + d.seed * 13) % w;
            const sy = ((i * 53 + tt * (60 + (i % 5) * 30)) % h);
            c.fillRect(sx, h - sy, 2, 4 + (i % 3) * 3);
        }
        // yukarı akan bulutlar
        for (let i = 0; i < 16; i++) {
            const sp = 380 + (i % 5) * 120;
            const x = (i * 131 + d.seed * 7) % w;
            const y = h + 120 - ((tt * sp + i * 211) % (h + 320));
            const r = 40 + (i % 4) * 22;
            const cg = c.createRadialGradient(x, y, 2, x, y, r);
            cg.addColorStop(0, 'rgba(255,255,255,0.55)');
            cg.addColorStop(1, 'rgba(255,255,255,0)');
            c.fillStyle = cg;
            c.save();
            c.translate(x, y);
            c.scale(1, 2.4);
            c.translate(-x, -y);
            c.beginPath();
            c.arc(x, y, r, 0, Math.PI * 2);
            c.fill();
            c.restore();
        }
        // yıkılan adadan kaya parçaları
        for (let i = 0; i < 9; i++) {
            const sp = 260 + (i % 4) * 90;
            const x = (i * 173 + d.seed * 3) % w;
            const y = h + 80 - ((tt * sp + i * 157) % (h + 220));
            const r = 12 + (i % 3) * 9;
            c.fillStyle = i % 2 ? '#6b5436' : '#4d3c28';
            c.save();
            c.translate(x, y);
            c.rotate(tt * (0.6 + i * 0.13));
            c.beginPath();
            for (let k = 0; k < 6; k++) {
                const a = (k / 6) * Math.PI * 2;
                const rr = r * (0.7 + 0.3 * ((k * 7 + i) % 3) / 2);
                c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
            }
            c.closePath();
            c.fill();
            c.restore();
        }
        // takla atan cadı
        const px = w / 2 + Math.sin(tt * 1.3) * w * 0.08;
        const py = h * 0.4 + Math.sin(tt * 2.1) * 10;
        c.strokeStyle = 'rgba(255,255,255,0.35)';
        c.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
            const ox = (i - 3.5) * 16;
            c.beginPath();
            c.moveTo(px + ox, py + 40);
            c.lineTo(px + ox, py + 120 + (i % 3) * 30);
            c.stroke();
        }
        c.globalAlpha = alpha;
        this.drawSprX('witch', px, py, 118, { rot: Math.sin(tt * 1.7) * 0.7 + Math.sin(tt * 0.6) * 0.5, flip: Math.sin(tt * 0.9) > 0 ? 1 : -1 });
        c.restore();
        if (d.t >= Game.DOOM_FALL) {
            c.save();
            c.textAlign = 'center';
            c.font = '900 ' + Math.round(26 * this.lk()) + 'px sans-serif';
            c.lineWidth = 6;
            c.strokeStyle = 'rgba(20,5,50,0.9)';
            const tx = T('Düşüyorsun…');
            c.strokeText(tx, w / 2, h * 0.72);
            c.fillStyle = '#ffe9a0';
            c.fillText(tx, w / 2, h * 0.72);
            c.font = 'bold ' + Math.round(15 * this.lk()) + 'px sans-serif';
            const sub = T('Devam paketi al · dokun');
            c.strokeText(sub, w / 2, h * 0.72 + 28 * this.lk());
            c.fillStyle = '#fff';
            c.fillText(sub, w / 2, h * 0.72 + 28 * this.lk());
            c.restore();
        }
    }
    seenRow(reg) {
        if (!this.save.mapSeen)
            this.save.mapSeen = {};
        const n = Game.SEEN_N;
        let r = this.save.mapSeen[reg];
        if (!r || r.length !== n * n) {
            r = '0'.repeat(n * n);
            this.save.mapSeen[reg] = r;
        }
        return r;
    }
    /** (x,y) çevresindeki hücreleri açar; değişen hücre sayısını döndürür */
    revealAround(reg, x, y, rad) {
        const z = ZONES[reg];
        const n = Game.SEEN_N;
        const cell = (z.radius * 2) / n;
        const arr = this.seenRow(reg).split('');
        let ch = 0;
        const gx0 = Math.max(0, Math.floor((x - rad - (z.cx - z.radius)) / cell));
        const gx1 = Math.min(n - 1, Math.floor((x + rad - (z.cx - z.radius)) / cell));
        const gy0 = Math.max(0, Math.floor((y - rad - (z.cy - z.radius)) / cell));
        const gy1 = Math.min(n - 1, Math.floor((y + rad - (z.cy - z.radius)) / cell));
        for (let gy = gy0; gy <= gy1; gy++)
            for (let gx = gx0; gx <= gx1; gx++) {
                const wx = z.cx - z.radius + (gx + 0.5) * cell;
                const wy = z.cy - z.radius + (gy + 0.5) * cell;
                if (Math.hypot(wx - x, wy - y) > rad)
                    continue;
                const i = gy * n + gx;
                if (arr[i] === '0') {
                    arr[i] = '1';
                    ch++;
                }
            }
        if (ch) {
            this.save.mapSeen[reg] = arr.join('');
            this.seenVer++;
        }
        return ch;
    }
    /** oyuncunun çevresini keşfeder (adım adım) */
    tickSeen(dt) {
        this.seenT -= dt;
        if (this.seenT > 0 || this.paused || this.dead > 0)
            return;
        this.seenT = 0.25;
        this.revealAround(this.region, this.px, this.py, 330);
    }
    /** ada haritasını açarken: temizlenen kamplar, açılan sandıklar ve ev çevresi de bilinen yer sayılır */
    revealKnown(reg) {
        for (const sp of this.getWorld().spawners)
            if (sp.reg === reg && this.spCleared(sp))
                this.revealAround(reg, sp.x, sp.y, 220);
        for (const ch of this.getWorld().chests)
            if (ch.reg === reg && this.save.chests.includes(ch.id))
                this.revealAround(reg, ch.x, ch.y, 160);
        if (reg === 0)
            this.revealAround(reg, HOME.x, HOME.y, 300);
    }
    /** bulut katmanı: keşfedilmeyen hücrelere yumuşak bulut kabarcıkları (değişince bir kez üretilir) */
    fogCanvas(reg, size) {
        if (this.fogCache && this.fogCache.reg === reg && this.fogCache.ver === this.seenVer && this.fogCache.cv.width === size)
            return this.fogCache.cv;
        const n = Game.SEEN_N;
        const row = this.seenRow(reg);
        const cv = document.createElement('canvas');
        cv.width = cv.height = size;
        const g = cv.getContext('2d');
        const cs = size / n;
        for (let pass = 0; pass < 2; pass++) {
            for (let gy = 0; gy < n; gy++)
                for (let gx = 0; gx < n; gx++) {
                    if (row[gy * n + gx] === '1')
                        continue;
                    const h = Math.sin(gx * 12.9898 + gy * 78.233 + pass * 3.1) * 43758.5453;
                    const jit = h - Math.floor(h);
                    const px = (gx + 0.5 + (jit - 0.5) * 0.7) * cs;
                    const py = (gy + 0.5 + (((jit * 7) % 1) - 0.5) * 0.7) * cs;
                    const r = cs * (pass === 0 ? 1.9 : 1.3) * (0.85 + jit * 0.4);
                    const grad = g.createRadialGradient(px, py, 0, px, py, r);
                    const a = pass === 0 ? 0.95 : 0.7;
                    grad.addColorStop(0, `rgba(${pass ? 255 : 226},${pass ? 255 : 232},${pass ? 255 : 244},${a})`);
                    grad.addColorStop(0.6, `rgba(214,224,240,${a * 0.7})`);
                    grad.addColorStop(1, 'rgba(214,224,240,0)');
                    g.fillStyle = grad;
                    g.beginPath();
                    g.arc(px, py, r, 0, Math.PI * 2);
                    g.fill();
                }
        }
        this.fogCache = { reg, ver: this.seenVer, cv };
        return cv;
    }
    /** ada haritası: bulunulan adanın tamamı; keşfedilmeyen yerler bulutla örtülü */
    drawIslandMap() {
        const c = this.ctx;
        const reg = this.region;
        const z = ZONES[reg];
        this.revealAround(reg, this.px, this.py, 330);
        this.revealKnown(reg);
        c.fillStyle = 'rgba(4,12,24,0.9)';
        c.fillRect(0, 0, this.w, this.h);
        const size = Math.floor(Math.min(this.w * 0.94, this.h * 0.7));
        const mx = (this.w - size) / 2;
        const my = Math.max(44, (this.h - size) / 2 - 8);
        const k = size / (z.radius * 2);
        const X = (x) => mx + (x - (z.cx - z.radius)) * k;
        const Y = (y) => my + (y - (z.cy - z.radius)) * k;
        c.save();
        c.beginPath();
        c.arc(mx + size / 2, my + size / 2, size / 2, 0, Math.PI * 2);
        c.clip();
        c.fillStyle = '#0c2742';
        c.fillRect(mx, my, size, size);
        c.fillStyle = z.bg;
        c.beginPath();
        c.arc(X(z.cx), Y(z.cy), z.radius * k, 0, Math.PI * 2);
        c.fill();
        for (const ob of this.getWorld().obstacles) {
            if (ob.kind === 'bld') {
                c.fillStyle = 'rgba(30,20,10,0.55)';
                c.fillRect(X(ob.x) - ob.r * k * 0.7, Y(ob.y) - ob.r * k * 0.7, ob.r * k * 1.4, ob.r * k * 1.4);
            }
        }
        for (const sp of this.getWorld().spawners) {
            if (sp.reg !== reg || this.hardHidden(sp))
                continue;
            c.fillStyle = this.spCleared(sp) ? 'rgba(160,160,160,0.7)' : TIERS[sp.tier].color;
            const sz = sp.tier === 'boss' ? 11 : sp.tier === 'elite' || sp.tier === 'knight' ? 7.5 : 5;
            c.fillRect(X(sp.x) - sz / 2, Y(sp.y) - sz / 2, sz, sz);
        }
        c.fillStyle = '#fff';
        for (const ch of this.getWorld().chests) {
            if (ch.reg !== reg || this.save.chests.includes(ch.id) || !this.chestShown(ch, 0))
                continue;
            c.fillRect(X(ch.x) - 3, Y(ch.y) - 3, 6, 6);
        }
        if (reg === 0)
            this.drawSpr('ui_home', X(HOME.x), Y(HOME.y), 28);
        for (let i = Math.max(0, reg - 1); i <= reg && i < ZONES.length - 1; i++) {
            const g = this.gatePos(i);
            if (Math.hypot(g.x - z.cx, g.y - z.cy) > z.radius + 60)
                continue;
            if (!this.drawSpr(this.gateLocked(i) ? 'ui_lock' : 'ui_skill', X(g.x), Y(g.y), 26)) {
                c.fillStyle = this.gateLocked(i) ? '#ff8a5a' : '#7bff9a';
                c.fillRect(X(g.x) - 3, Y(g.y) - 6, 6, 12);
            }
            if (!this.masterOpen(i))
                continue;
            const m = this.masterPos(i);
            c.fillStyle = '#9ff0ff';
            c.beginPath();
            c.arc(X(m.x), Y(m.y), 6, 0, Math.PI * 2);
            c.fill();
        }
        // bulutlar: keşfedilmemiş yerler
        c.drawImage(this.fogCanvas(reg, size), mx, my);
        c.restore();
        c.strokeStyle = 'rgba(255,255,255,0.6)';
        c.lineWidth = 3;
        c.beginPath();
        c.arc(mx + size / 2, my + size / 2, size / 2, 0, Math.PI * 2);
        c.stroke();
        this.arrow(X(this.px), Y(this.py), this.face, 12);
        const row = this.seenRow(reg);
        let seenN = 0;
        for (let i = 0; i < row.length; i++)
            if (row[i] === '1')
                seenN++;
        const pct = Math.min(100, Math.round((seenN / row.length) * 100 / 0.785));
        c.font = 'bold 16px sans-serif';
        c.textAlign = 'center';
        c.fillStyle = '#ffe36b';
        c.fillText(`${T('Ada')} ${reg + 1} · ${T('keşfedilen')}: %${pct}`, this.w / 2 - 20, 28);
        c.font = 'bold 14px sans-serif';
        c.fillText(T('Ok: bakış yönün · Kapatmak için dokun'), this.w / 2, my + size + 28);
    }
}
Game.remoteHof = cachedRemoteHof();
Game.hofFetchedAt = 0;
// ---- ödüllü reklam ödülleri ----
Game.AD_DAILY = 10;
Game.AD_COOLDOWN = 180; // sn, ödül türü başına
// ---- yeniden doğuş: paket almadan devam yolu ----
Game.RB_G = 3;
/** yeniden doğuş 40. seviyeden itibaren (40. seviyeye ulaşıldığında) satın alınabilir */
Game.REBIRTH_FROM = 40;
// ---- kaşif ve elmas madeni ----
Game.EXPLORE_MS = 2 * 60 * 1000;
Game.MINE_CD_MS = 6 * 3600 * 1000;
Game.BREW_SEC = 300;
Game.BREW_CD_MS = 120 * 1000;
Game.OLD_GAMES_END = 60;
// ---- devlerin gelişi: 35. adadan itibaren sarsıntılar, 50. adada devler gelir (düşmanlar 1,5 kat büyür) ----
Game.GIANT_FROM = 49;
// ---- madenin boştayken kazancı: bulunan her maden saatte toz ve ara sıra jeod biriktirir (en çok 8 saat), seviyesi toz ile yükseltilir ----
Game.MINE_CAP_H = 8;
// ---- sis/bulut: ada ilk girişte bulutlarla kaplıdır; oyuncu gezdikçe çevresindeki 500 px çaplı daire açılır (haritada değil, oyun ekranında) ----
Game.FOG_CELL = 100;
Game.FOG_R = 600;
// ---- zehirli mantarlar (10. adadan itibaren): bize etkisi yok; dokununca kara delik 60 sn küçülür ve yutamaz ----
Game.SHROOM_FROM = 9;
// ---- toplanan mantarlar: her adada 2 dev (kırmızı) ve 2 cüce (beyaz); etkisi 10 sn, etki ya da iksir sürerken yenisi alınamaz ----
Game.MUSH_SEC = 10;
Game.MUSH_PER_KIND = 2;
Game.HOLE_FROM = 2;
Game.HOLE_AFTER = 20;
Game.HOLE_R = 56;
/** yeni bir seviyeye geçildi: kaplan açıksa 40 ruh tozu düşer; yetmezse kaplan kapatılır */
/** ilk 10 adada kaplan ücretsizdir (erken oyunda ruh tozu azdır: kaplan kapanıp kalıyordu) */
Game.TIGER_FREE_ISLANDS = 10;
Game.NOVA_SEC = 2.6;
// ---- ayna: her boss bir kırık verir; 10 kırıkta kalıcı +%2 güç ve bir yansıma hakkı; yansıma kahramanın gücünde bir düşmandır ----
Game.MIRROR_STEP = 10;
Game.MIRROR_BONUS = 0.02;
// ---- 50. adada devler saldırısı: ada başlayınca değil bir süre sonra, 3 dev, her biri kahramanın gücünün 1,5-2 katı ----
Game.RAID_REG = 49;
Game.RAID_AFTER = 75;
// ---- bonus tur geçişi: özel kart (ilk seferde), şok dalgası ve geri sayım; bu sürede oyun durur ----
Game.BONUS_INTRO = 2.8;
Game.TRAIN_PER_DAY = 2;
/** denge: kalıcı kazanç ve ruh çarpanları (tools/bot.js ile ölçülür) */
Game.YIELD = 1;
/** bir adayı bitirince oyuncunun gücü, o adanın boss gücünün kaç katı olsun */
Game.MARGIN = 1.3;
// ---- yeni mini oyunlar: usta cadının eğitiminde, ada geçtikçe açılır; ödül kalıcı güçtür ----
Game.MINIS = [
    { k: 'honey', at: 4, name: 'Bal Avı', desc: 'Altın arılara dokun, yabanarılarından kaç' },
    { k: 'cards', at: 9, name: 'Büyü Kartları', desc: 'Aynı simgeli kart çiftlerini bul' },
    { k: 'broom', at: 14, name: 'Süpürge Yarışı', desc: 'Süpürgeyle şeritler arasında geç, yıldız topla' },
];
// ---- tavuk: 2. adada bulunur, sonra her 3 adada bir yeni tavuk bulunur; sayı artmaz, seviye 2/4/8/16 bulguda atlar; yumurta atar ----
Game.CK_FIRST = 1;
Game.CK_STEP = 3;
/** yumurta türleri: tavuk seviyesine göre. Bomba gibi alan hasarı verir; tavuk dakikada bir yumurta atar */
Game.EGGS = [
    { name: 'Yumurta', fill: '#fffaf0', edge: '#b89a6a', secs: 6, radius: 120 },
    { name: 'Gezen tavuk yumurtası', fill: '#e8c79a', edge: '#8a5a2a', secs: 10, radius: 140 },
    { name: 'Gümüş yumurta', fill: '#dfe6f0', edge: '#8a97ad', secs: 16, radius: 165 },
    { name: 'Altın yumurta', fill: '#ffd23a', edge: '#b8750a', secs: 25, radius: 195 },
    { name: 'Platin yumurta', fill: '#b8f0ff', edge: '#4a9ac8', secs: 40, radius: 230 },
];
Game.EGG_COOLDOWN = 60;
// ---- köylü ve inek görevi ----
// 3. adaya varınca köylü yardım ister; inek 5. adada bulunur ve gecikmeli takip eder; 10. adada köylüye teslim edilir ve köylü de eşlik eder;
// 20. adada köylü yorulup ayrılır, elması asaya takılır: güç artar (boss gücüne göre 1.8x–4x aralığı), güçlüyse kaplana verilir.
Game.VQ_ASK = 2;
Game.VQ_COW = 4;
Game.VQ_VIL = 9;
Game.VQ_END = 19;
// ---- 40. ada sonu: usta cadının büyüsü, yıkım ve düşüş ----
/** doom.t: 0–1.4 büyü hazırlığı, 1.4–2.8 yıldırım, 2.8–4.2 yıkım ve gökyüzüne geçiş, 4.2+ sonsuz düşüş */
Game.DOOM_FALL = 4.2;
/** 21. adadan itibaren (dizin 20) yenilen kamp, kule ve kayalar bir daha çıkmaz */
Game.NORESPAWN_FROM = 20;
// ---- ada haritası (keşif sisi) ----
Game.SEEN_N = 36;
