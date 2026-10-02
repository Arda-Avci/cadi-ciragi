import { BRIDGE_HALF_WIDTH, CRYSTAL_STATS, CSTAT_KEYS, DTYPES, DTYPE_NAMES, ENEMIES, EQUIP_NAMES, MAX_ENCHANT, MAX_ITEM_LEVEL, MAX_WEAPON_LEVEL, RARITIES, TIERS, UPGRADES, WEAPONS, ZONES, crystalValue, enchantChance, enchantCost, itemUpgradeCost, itemValue, upgradeCost, weaponLevelCopies, } from './data.js';
const SAVE_KEY = 'cadi-ciragi-v4';
const TREE_RESPAWN = 120;
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
        this.world = null;
        this.treeHp = new Map();
        this.cast = new Map();
        this.saveT = 0;
        this.w = 0;
        this.h = 0;
        this.sprites = new Map();
        this.ctx = canvas.getContext('2d');
        this.loadSprites();
        this.save = this.load();
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
            for (const n of names) {
                const img = new Image();
                img.onload = () => this.sprites.set(n, img);
                img.src = 'assets/' + n + '.png';
            }
        })
            .catch(() => { });
    }
    spr(name) { return this.sprites.get(name) ?? null; }
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
    // ---- kayıt ----
    fresh() {
        return {
            essence: 0, upgrades: {}, weapons: [1, 0, 0, 0], copies: [0, 0, 0, 0], loadout: [0], x: 0, y: 0,
            bossDown: [false, false, false], kills: 0, deaths: 0, geodes: 1, dust: 20, crystals: [], equipped: [], nextCrystal: 1,
            chests: [], chestBonus: {}, items: [], eq: { helmet: 0, shield: 0 }, nextItem: 1, spawn: {}, perm: {},
        };
    }
    load() {
        try {
            const raw = localStorage.getItem(SAVE_KEY);
            if (raw)
                return { ...this.fresh(), ...JSON.parse(raw) };
        }
        catch (e) {
            console.error('kayıt okunamadı', e);
        }
        return this.fresh();
    }
    persist() {
        try {
            this.save.x = this.px;
            this.save.y = this.py;
            localStorage.setItem(SAVE_KEY, JSON.stringify(this.save));
        }
        catch (e) {
            console.error('kayıt yazılamadı', e);
        }
    }
    resetSave() {
        localStorage.removeItem(SAVE_KEY);
        this.save = this.fresh();
        this.enemies = [];
        this.projs = [];
        this.orbs = [];
        this.treeHp.clear();
        this.cast.clear();
        this.px = 0;
        this.py = 0;
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
    now() { return Date.now() + this.skew; }
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
        return { ax: a.x, ay: a.y, bx: b.x, by: b.y, len, tGate: (a.r + GATE_GAP) / len };
    }
    gateLocked(i) { return !this.save.bossDown[i]; }
    gatePos(i) {
        const b = this.bridge(i);
        return { x: b.ax + (b.bx - b.ax) * b.tGate, y: b.ay + (b.by - b.ay) * b.tGate };
    }
    /** (x,y) yürünebilir mi (kilitli kapının ötesi hariç) */
    walkable(x, y, ignoreGates = false) {
        for (let i = 0; i < ZONES.length; i++) {
            const c = this.regionCenter(i);
            if (Math.hypot(x - c.x, y - c.y) <= c.r - 18)
                return true;
        }
        for (let i = 0; i < ZONES.length - 1; i++) {
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
            return true;
        }
        return false;
    }
    regionAt(x, y) {
        let best = 0;
        let bd = Infinity;
        for (let i = 0; i < ZONES.length; i++) {
            const c = this.regionCenter(i);
            const d = Math.hypot(x - c.x, y - c.y) / c.r;
            if (d < bd) {
                bd = d;
                best = i;
            }
        }
        return best;
    }
    getWorld() {
        if (this.world)
            return this.world;
        const spawners = [];
        const trees = [];
        const chests = [];
        const decor = [];
        const lvRange = {
            easy: [0.35, 1.8], medium: [0.5, 3.5], hard: [0.8, 6], elite: [1.2, 9], knight: [1.2, 5], boss: [3, 6],
        };
        ZONES.forEach((zone, reg) => {
            const R = zone.radius;
            const rnd = rng(reg * 7919 + 13);
            const placed = [];
            const place = (minD, maxD, sep) => {
                for (let tries = 0; tries < 60; tries++) {
                    const a = rnd() * Math.PI * 2;
                    const d = minD + rnd() * (maxD - minD);
                    const p = { x: zone.cx + Math.cos(a) * d, y: zone.cy + Math.sin(a) * d };
                    if (placed.every((q) => Math.hypot(q.x - p.x, q.y - p.y) > sep)) {
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
                for (let i = 0; i < zone.layout[tier]; i++) {
                    const p = place(band[tier][0], band[tier][1], 190);
                    const kind = zone.enemies[Math.floor(rnd() * zone.enemies.length)];
                    const [lo, hi] = lvRange[tier];
                    spawners.push({
                        id: spawners.length, reg, x: p.x, y: p.y, tier, kind, lv: lo * Math.pow(hi / lo, rnd()),
                        tag: tier === 'knight' ? (i % 2 === 0 ? 'helmet' : 'shield') : undefined,
                    });
                }
            });
            for (let i = 0; i < zone.resTrees; i++) {
                const p = place(160, R - 100, 120);
                trees.push({ id: trees.length, reg, x: p.x, y: p.y });
            }
            for (let i = 0; i < 6; i++) {
                const p = place(200, R - 80, 160);
                chests.push({ id: chests.length, reg, x: p.x, y: p.y });
            }
            for (let i = 0; i < 90 + reg * 20; i++) {
                const a = rnd() * Math.PI * 2;
                const d = 60 + rnd() * (R - 80);
                decor.push({ x: zone.cx + Math.cos(a) * d, y: zone.cy + Math.sin(a) * d, s: 0.7 + rnd() * 0.7, reg });
            }
        });
        this.world = { spawners, trees, chests, decor };
        return this.world;
    }
    isCleared(key) { return (this.save.spawn[key] ?? 0) > this.now(); }
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
    helmetHp() { const h = this.item('helmet'); return h ? itemValue('helmet', h.rarity, h.level) : 0; }
    helmetRegen() { const h = this.item('helmet'); return h && h.rarity >= 3 ? 1.5 * (h.rarity - 2) : 0; }
    blockChance() { const s = this.item('shield'); return s && s.rarity >= 3 ? 0.08 * (s.rarity - 2) : 0; }
    typedReduction(t) {
        const s = this.item('shield');
        if (!s)
            return 0;
        const v = itemValue('shield', s.rarity, s.level);
        return s.dtype === t ? v : v * 0.5;
    }
    maxHp() {
        return (100 + this.perm('normal.hp') + this.perm('elite.hp') + this.perm('tree.hp')) * (1 + 0.2 * this.lv('hp'))
            * (1 + (this.cb('hp') + this.helmetHp() + this.perm('elite.hpPct')) / 100);
    }
    regen() { return 0.6 * this.lv('regen') + this.cb('regen') + this.helmetRegen() + this.perm('tree.regen'); }
    armor() { return Math.max(0.2, 1 - 0.04 * this.lv('armor')); }
    dmgMul() { return (1 + 0.12 * this.lv('dmg')) * (1 + (this.cb('dmg') + this.perm('elite.dmgPct')) / 100); }
    castSpeed() { return 1 + 0.08 * this.lv('spin'); }
    reachMul() { return 1 + 0.06 * this.lv('reach'); }
    magnet() { return 70 + 25 * this.lv('magnet') + this.cb('magnet'); }
    yieldMul() { return (1 + 0.1 * this.lv('yield')) * (1 + this.cb('yield') / 100); }
    speed() { return 150 * (1 + 0.04 * this.lv('speed')) * (1 + this.cb('speed') / 100); }
    critChance() { return Math.min(0.75, this.cb('crit') / 100); }
    lifesteal() { return Math.min(0.5, this.cb('lifesteal') / 100); }
    evasion() { return Math.min(0.6, this.cb('evasion') / 100); }
    weaponDmg(i) {
        return (WEAPONS[i].baseDmg * (1 + 0.15 * (this.save.weapons[i] - 1)) + this.perm('normal.dmg')) * this.dmgMul();
    }
    weaponCopies(i) { return 1 + Math.min(3, Math.floor((this.save.weapons[i] - 1) / 5)); }
    zone() { return ZONES[this.region]; }
    bossesDown() { return this.save.bossDown.filter(Boolean).length; }
    slots() { return Math.min(4, 2 + this.bossesDown()); }
    weaponSlots() { return Math.min(4, 1 + this.bossesDown() + (this.save.kills >= 25 ? 1 : 0)); }
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
    power() {
        let dps = 0;
        for (const i of this.equippedWeapons())
            dps += (this.weaponDmg(i) * this.weaponCopies(i) * this.castSpeed()) / WEAPONS[i].cooldown;
        const red = (this.typedReduction('cut') + this.typedReduction('pierce') + this.typedReduction('smash')) / 3 / 100;
        const effHp = this.maxHp() / (this.armor() * (1 - Math.min(0.9, red)));
        return Math.floor(Math.sqrt(effHp * Math.max(1, dps)) * 10);
    }
    enemyDmg(e) { return e.def.dmg * TIERS[e.tier].dmg * ZONES[e.reg].dmgScale * Math.sqrt(e.lv); }
    enemyPower(e) { return Math.floor(Math.sqrt(e.maxHp * (this.enemyDmg(e) / 0.6)) * 10); }
    weakness(e) { return DTYPES.reduce((b, t) => (e.def.resist[t] > e.def.resist[b] ? t : b), DTYPES[0]); }
    statLines() {
        const f = (n) => (n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : n.toFixed(1));
        const out = [
            { label: 'Güç', value: this.fmt(this.power()) },
            { label: 'Azami can', value: f(this.maxHp()) },
            { label: 'Kritik / Can çalma / Kaçınma', value: `%${(this.critChance() * 100).toFixed(1)} / %${(this.lifesteal() * 100).toFixed(1)} / %${(this.evasion() * 100).toFixed(1)}` },
            { label: 'Yenilenme', value: f(this.regen()) + '/sn' },
            { label: 'Hasar çarpanı', value: '×' + this.dmgMul().toFixed(2) },
            { label: 'Alınan hasar çarpanı', value: '×' + this.armor().toFixed(2) },
        ];
        for (const t of DTYPES)
            out.push({ label: DTYPE_NAMES[t] + ' savunması', value: '%' + this.typedReduction(t).toFixed(1) });
        out.push({ label: 'map.normal_mob', value: `+${f(this.perm('normal.hp'))} can, +${f(this.perm('normal.dmg'))} hasar` });
        out.push({ label: 'map.elite', value: `+${f(this.perm('elite.hp'))} can, +%${this.perm('elite.hpPct').toFixed(1)} can, +%${this.perm('elite.dmgPct').toFixed(1)} hasar` });
        out.push({ label: 'map.tree', value: `+${f(this.perm('tree.hp'))} can, +${this.perm('tree.regen').toFixed(2)} yenilenme` });
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
    // ---- kristaller ----
    openGeode() {
        if (this.save.geodes < 1)
            return null;
        this.save.geodes--;
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
        this.persist();
        this.onChange();
        return c;
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
        this.save.items.push(it);
        this.say(RARITIES[it.rarity].name + ' ' + EQUIP_NAMES[type][it.rarity] + ' (' + DTYPE_NAMES[it.dtype] + ') buldun!');
        this.persist();
        this.onChange();
        return it;
    }
    toggleItem(id) {
        const it = this.save.items.find((x) => x.id === id);
        if (!it)
            return;
        this.save.eq[it.type] = this.save.eq[it.type] === id ? 0 : id;
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
        this.persist();
        this.onChange();
    }
    // ---- simülasyon ----
    update(dt) {
        if (this.paused)
            return;
        this.time += dt;
        this.bannerT = Math.max(0, this.bannerT - dt);
        if (this.dead > 0) {
            this.dead -= dt;
            if (this.dead <= 0)
                this.respawn();
            return;
        }
        this.movePlayer(dt);
        this.region = this.regionAt(this.px, this.py);
        const calm = !this.enemies.some((e) => e.state === 'chase');
        this.hp = Math.min(this.maxHp(), this.hp + (this.regen() + (calm ? 0.03 * this.maxHp() : 0)) * dt);
        this.invuln = Math.max(0, this.invuln - dt);
        this.syncSpawners();
        this.updateEnemies(dt);
        this.castSpells(dt);
        this.updateProjs(dt);
        this.removeDead();
        this.updateOrbs(dt);
        this.checkChests();
        for (const f of this.floaters) {
            f.t -= dt;
            f.y -= 28 * dt;
        }
        this.floaters = this.floaters.filter((f) => f.t > 0);
        this.saveT += dt;
        if (this.saveT > 5) {
            this.saveT = 0;
            this.persist();
        }
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
        const len = Math.hypot(mx, my);
        if (len > 1) {
            mx /= len;
            my /= len;
        }
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
        const live = new Set();
        for (const e of this.enemies)
            live.add(e.sp);
        for (const sp of this.getWorld().spawners) {
            if (live.has(sp.id) || this.isCleared('s' + sp.id))
                continue;
            this.spawnGroup(sp);
        }
    }
    spawnGroup(sp) {
        const zone = ZONES[sp.reg];
        const tier = TIERS[sp.tier];
        const def = ENEMIES[sp.kind];
        for (let i = 0; i < tier.count; i++) {
            const a = (i / tier.count) * Math.PI * 2 + sp.id;
            const x = sp.x + (tier.count > 1 ? Math.cos(a) * 46 : 0);
            const y = sp.y + (tier.count > 1 ? Math.sin(a) * 46 : 0);
            const maxHp = def.hp * tier.hp * zone.scale * sp.lv;
            this.enemies.push({
                def, tier: sp.tier, lv: sp.lv, reg: sp.reg, sp: sp.id, x, y, hx: x, hy: y, hp: maxHp, maxHp, state: 'idle', hitCd: 0,
                phase: Math.random() * 6, dashT: 3, dvx: 0, dvy: 0,
            });
        }
    }
    updateEnemies(dt) {
        for (const e of this.enemies) {
            const dx = this.px - e.x;
            const dy = this.py - e.y;
            const d = Math.hypot(dx, dy) || 1;
            if (d > 1500 && e.state === 'idle')
                continue; // uzaktaki kamplar uyur
            e.hitCd = Math.max(0, e.hitCd - dt);
            e.phase += dt;
            const big = e.tier === 'boss';
            const aggro = big ? 400 : 250 + (e.tier === 'elite' || e.tier === 'knight' ? 40 : 0);
            const leash = big ? 700 : 480;
            const home = Math.hypot(e.hx - e.x, e.hy - e.y);
            if (e.state === 'idle' && d < aggro)
                e.state = 'chase';
            else if (e.state === 'chase' && (home > leash || d > aggro * 2.2))
                e.state = 'return';
            else if (e.state === 'return' && home < 8)
                e.state = 'idle';
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
                e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.25 * dt);
            }
            else {
                vx = Math.cos(e.phase * 0.8 + e.sp) * 6;
                vy = Math.sin(e.phase * 0.7 + e.sp) * 6;
            }
            const nx = e.x + vx * dt;
            const ny = e.y + vy * dt;
            if (this.walkable(nx, ny, true)) {
                e.x = nx;
                e.y = ny;
            }
            if (d < e.def.r * TIERS[e.tier].size + 14 && this.invuln <= 0) {
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
                const hit = this.enemyDmg(e) * this.armor() * (1 - Math.min(0.9, this.typedReduction(e.def.atk) / 100));
                this.hp -= hit;
                this.invuln = 0.6;
                this.float(this.px, this.py - 20, '-' + this.fmt(hit), '#ff6b6b');
                if (this.hp <= 0) {
                    this.die();
                    return;
                }
            }
        }
    }
    // ---- büyüler ----
    nearestTarget(range) {
        let best = null;
        let bd = range;
        for (const e of this.enemies) {
            const d = Math.hypot(e.x - this.px, e.y - this.py);
            if (d < bd) {
                bd = d;
                best = { x: e.x, y: e.y };
            }
        }
        if (best)
            return best;
        for (const t of this.getWorld().trees) {
            if (this.isCleared('t' + t.id))
                continue;
            const d = Math.hypot(t.x - this.px, t.y - this.py);
            if (d < Math.min(bd, range * 0.8)) {
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
            if (apply(e.x, e.y, e.def.r * TIERS[e.tier].size))
                this.hitEnemy(e, p.dmg, p.dtype);
        }
        for (const t of this.getWorld().trees) {
            if (!this.isCleared('t' + t.id) && apply(t.x, t.y, 24))
                this.hitTree(t, p.dmg);
        }
    }
    updateProjs(dt) {
        const keep = [];
        const enemies = this.enemies;
        const trees = this.getWorld().trees;
        for (const p of this.projs) {
            p.life += dt;
            if (p.kind === 'bolt') {
                p.x += p.vx * dt;
                p.y += p.vy * dt;
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
                this.projCollide(p, enemies, trees, 18, true);
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
    projCollide(p, enemies, trees, r, once = false) {
        for (const e of enemies) {
            if (p.hit.has(e))
                continue;
            if (Math.hypot(e.x - p.x, e.y - p.y) < e.def.r * TIERS[e.tier].size + r) {
                p.hit.add(e);
                this.hitEnemy(e, p.dmg, p.dtype);
                if (!once) {
                    p.pierce--;
                    if (p.pierce < 0)
                        return;
                }
            }
        }
        for (const t of trees) {
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
    }
    hitEnemy(e, raw, dtype) {
        const crit = Math.random() < this.critChance();
        const dmg = Math.max(1, raw * e.def.resist[dtype] * (crit ? 3 : 1));
        e.hp -= dmg;
        if (this.lifesteal() > 0)
            this.hp = Math.min(this.maxHp(), this.hp + dmg * this.lifesteal());
        if (e.state === 'idle')
            e.state = 'chase';
        this.float(e.x, e.y - e.def.r * TIERS[e.tier].size - 22, (crit ? '!' : '') + this.fmt(dmg), crit ? '#ffd84a' : '#ffffff');
    }
    hitTree(t, raw) {
        const maxHp = 30 * ZONES[t.reg].scale;
        const hp = (this.treeHp.get(t.id) ?? maxHp) - raw;
        this.float(t.x, t.y - 34, this.fmt(raw), '#c8ffc8');
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
        return n >= 1e9 ? (n / 1e9).toFixed(1) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1) + 'K' : String(Math.ceil(n));
    }
    addPerm(k, v) { this.save.perm[k] = (this.save.perm[k] ?? 0) + v; }
    chopTree(t) {
        const z = ZONES[t.reg].scale;
        this.save.spawn['t' + t.id] = this.now() + TREE_RESPAWN * 1000;
        this.treeHp.delete(t.id);
        this.addPerm('tree.hp', 2.5 * z);
        this.addPerm('tree.regen', 0.02 * Math.sqrt(z));
        this.say('Kaynak ağacı kesildi: kalıcı can ve yenilenme kazandın.');
        this.persist();
        this.onChange();
    }
    killEnemy(e) {
        this.save.kills++;
        const value = Math.max(1, Math.round(e.def.drop * TIERS[e.tier].soul * Math.pow(ZONES[e.reg].scale, 0.7) * Math.sqrt(e.lv) * this.yieldMul()));
        this.orbs.push({ x: e.x, y: e.y, v: value, kind: 'ess' });
    }
    completeSpawner(id) {
        const sp = this.getWorld().spawners[id];
        if (!sp)
            return;
        const tier = TIERS[sp.tier];
        const z = ZONES[sp.reg].scale;
        this.save.spawn['s' + id] = this.now() + tier.respawn * 1000;
        const lvK = Math.sqrt(sp.lv);
        const FAST = 0.9; // kalıcı kazanç çarpanı (orijinale göre yine hızlı: haritada boss'a kadar ~10 dk)
        if (tier.permanent === 'normal') {
            const rank = sp.tier === 'easy' ? 1 : sp.tier === 'medium' ? 2 : 3;
            this.addPerm('normal.hp', 4 * z * rank * lvK * FAST);
            this.addPerm('normal.dmg', 0.5 * z * rank * lvK * FAST);
        }
        else {
            const k = (sp.tier === 'boss' ? 5 : 1) * lvK * FAST;
            this.addPerm('elite.hp', 15 * z * k);
            this.addPerm('elite.hpPct', 0.4 * k);
            this.addPerm('elite.dmgPct', 0.4 * k);
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
        this.float(sp.x, sp.y - 40, `+${n} ${WEAPONS[wi].name} kopyası`, '#ffd84a');
        if (Math.random() < 0.08)
            this.orbs.push({ x: sp.x + 10, y: sp.y, v: 15, kind: 'heal' });
        if (sp.tag)
            this.gainItem(sp.tag, Math.min(4, 1 + sp.reg));
        if (sp.tier === 'elite')
            this.orbs.push({ x: sp.x - 10, y: sp.y, v: 1, kind: 'geode' });
        if (sp.tier === 'boss') {
            for (let i = 0; i < 3; i++)
                this.orbs.push({ x: sp.x + i * 14, y: sp.y + 10, v: 1, kind: 'geode' });
            this.gainItem('helmet', 2);
            this.gainItem('shield', 2);
            if (!this.save.bossDown[sp.reg]) {
                this.save.bossDown[sp.reg] = true;
                this.say(ZONES[sp.reg].bossName + ' yenildi! ' + (sp.reg < ZONES.length - 1 ? 'Sonraki bölgenin kapısı açıldı.' : 'Dünyayı tamamladın!'));
            }
            else
                this.say(ZONES[sp.reg].bossName + ' yenildi!');
        }
        this.persist();
        this.onChange();
    }
    updateOrbs(dt) {
        const range = this.magnet();
        const keep = [];
        for (const o of this.orbs) {
            const dx = this.px - o.x;
            const dy = this.py - o.y;
            const d = Math.hypot(dx, dy) || 1;
            if (d < range) {
                const pull = 260 + (range - d) * 4;
                o.x += (dx / d) * pull * dt;
                o.y += (dy / d) * pull * dt;
            }
            if (d < 16) {
                if (o.kind === 'heal')
                    this.hp = Math.min(this.maxHp(), this.hp + this.maxHp() * 0.15);
                else if (o.kind === 'geode') {
                    this.save.geodes++;
                    this.float(this.px, this.py - 30, '+1 jeod', '#7dffb0');
                }
                else {
                    this.save.essence += o.v;
                    this.float(this.px, this.py - 30, '+' + this.fmt(o.v), '#9be7ff');
                }
                this.onChange();
                continue;
            }
            keep.push(o);
        }
        this.orbs = keep;
    }
    checkChests() {
        for (const c of this.getWorld().chests) {
            if (this.save.chests.includes(c.id))
                continue;
            if (Math.hypot(c.x - this.px, c.y - this.py) < 28) {
                this.save.chests.push(c.id);
                const stat = CSTAT_KEYS[Math.floor(Math.random() * CSTAT_KEYS.length)];
                const amt = CRYSTAL_STATS[stat].base * 0.6;
                this.save.chestBonus[stat] = (this.save.chestBonus[stat] ?? 0) + amt;
                this.save.essence += Math.round(40 * Math.pow(ZONES[c.reg].scale, 0.7) * this.yieldMul());
                this.save.geodes += 1;
                this.say('Gizli sandık! Kalıcı ' + CRYSTAL_STATS[stat].name + ' +' + amt.toFixed(1) + CRYSTAL_STATS[stat].unit
                    + ' (' + this.chestsOpened(c.reg) + '/6)');
                this.persist();
                this.onChange();
            }
        }
    }
    die() {
        this.dead = 2.5;
        this.save.deaths++;
        this.persist();
        this.say('Bayıldın… düşmanlar kamplarına döndü.');
    }
    respawn() {
        this.hp = this.maxHp();
        const c = this.regionCenter(this.region);
        this.px = c.x;
        this.py = c.y;
        for (const e of this.enemies)
            e.state = 'return';
        this.projs = [];
        this.invuln = 2;
    }
    say(text) { this.banner = text; this.bannerT = 4; }
    float(x, y, text, color) {
        if (this.floaters.length < 60)
            this.floaters.push({ x, y, t: 0.8, text, color });
    }
    campProgress(reg = this.region) {
        const sps = this.getWorld().spawners.filter((s) => s.reg === reg);
        return { done: sps.filter((s) => this.isCleared('s' + s.id)).length, total: sps.length };
    }
    // ---- çizim ----
    render() {
        const c = this.ctx;
        const camX = this.px - this.w / 2;
        const camY = this.py - this.h / 2;
        c.fillStyle = '#0c2742';
        c.fillRect(0, 0, this.w, this.h);
        this.drawSeaWaves(camX, camY);
        this.drawLand(camX, camY);
        c.save();
        c.translate(-camX, -camY);
        this.drawWorldObjects(camX, camY);
        for (const o of this.orbs)
            this.drawOrb(o);
        for (const e of this.enemies)
            if (this.inView(e.x, e.y, 120, camX, camY))
                this.drawEnemy(e);
        this.drawPlayer();
        for (const p of this.projs)
            this.drawProj(p);
        c.font = 'bold 13px sans-serif';
        c.textAlign = 'center';
        for (const f of this.floaters) {
            c.globalAlpha = Math.min(1, f.t * 2);
            c.fillStyle = f.color;
            c.fillText(f.text, f.x, f.y);
        }
        c.globalAlpha = 1;
        c.restore();
        this.drawHud();
        this.drawMinimap();
    }
    inView(x, y, m, camX, camY) {
        return x > camX - m && x < camX + this.w + m && y > camY - m && y < camY + this.h + m;
    }
    drawSeaWaves(camX, camY) {
        const c = this.ctx;
        c.strokeStyle = 'rgba(120,180,255,0.10)';
        c.lineWidth = 2;
        const s = 120;
        for (let x = Math.floor(camX / s) * s; x < camX + this.w + s; x += s) {
            for (let y = Math.floor(camY / s) * s; y < camY + this.h + s; y += s) {
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
        // köprüler
        for (let i = 0; i < ZONES.length - 1; i++) {
            const b = this.bridge(i);
            c.strokeStyle = 'rgba(0,0,0,0.25)';
            c.lineWidth = BRIDGE_HALF_WIDTH * 2 + 10;
            c.lineCap = 'butt';
            c.beginPath();
            c.moveTo(b.ax - camX, b.ay - camY);
            c.lineTo(b.bx - camX, b.by - camY);
            c.stroke();
            c.strokeStyle = '#6b5436';
            c.lineWidth = BRIDGE_HALF_WIDTH * 2;
            c.beginPath();
            c.moveTo(b.ax - camX, b.ay - camY);
            c.lineTo(b.bx - camX, b.by - camY);
            c.stroke();
            c.strokeStyle = 'rgba(255,230,180,0.18)';
            c.lineWidth = 6;
            c.setLineDash([22, 18]);
            c.beginPath();
            c.moveTo(b.ax - camX, b.ay - camY);
            c.lineTo(b.bx - camX, b.by - camY);
            c.stroke();
            c.setLineDash([]);
        }
        ZONES.forEach((zone, reg) => {
            const cx = zone.cx - camX;
            const cy = zone.cy - camY;
            if (cx + zone.radius < 0 || cx - zone.radius > this.w || cy + zone.radius < 0 || cy - zone.radius > this.h)
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
        const tile = this.spr(['ground_forest', 'ground_swamp', 'ground_ice'][reg]);
        if (tile) {
            const T = 256;
            for (let x = Math.floor(camX / T) * T; x < camX + this.w + T; x += T) {
                for (let y = Math.floor(camY / T) * T; y < camY + this.h + T; y += T)
                    c.drawImage(tile, x - camX, y - camY, T, T);
            }
            return;
        }
        const s = 70;
        c.fillStyle = dot;
        for (let x = Math.floor(camX / s) * s; x < camX + this.w + s; x += s) {
            for (let y = Math.floor(camY / s) * s; y < camY + this.h + s; y += s) {
                const hsh = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
                const r = hsh - Math.floor(hsh);
                c.beginPath();
                c.arc(x - camX + r * s, y - camY + ((r * 7) % 1) * s, 2 + r * 3, 0, Math.PI * 2);
                c.fill();
            }
        }
    }
    drawTree(x, y, size, reg) {
        const c = this.ctx;
        if (this.drawSpr(['tree_forest', 'tree_swamp', 'tree_ice'][reg], x, y - 10, size))
            return;
        const s = size / 64;
        c.fillStyle = '#4a3320';
        c.fillRect(x - 4 * s, y, 8 * s, 16 * s);
        c.fillStyle = reg === 2 ? '#a7d8e8' : reg === 1 ? '#3b5a52' : '#2f7a45';
        c.beginPath();
        c.arc(x, y - 4 * s, 20 * s, 0, Math.PI * 2);
        c.fill();
    }
    drawWorldObjects(camX, camY) {
        const c = this.ctx;
        const world = this.getWorld();
        for (const t of world.decor)
            if (this.inView(t.x, t.y, 60, camX, camY))
                this.drawTree(t.x, t.y, 60 * t.s, t.reg);
        for (const sp of world.spawners) {
            if (!this.inView(sp.x, sp.y, 90, camX, camY))
                continue;
            const cleared = this.isCleared('s' + sp.id);
            c.globalAlpha = cleared ? 0.45 : 1;
            if (!this.drawSpr('camp', sp.x, sp.y, 120)) {
                c.strokeStyle = 'rgba(0,0,0,0.4)';
                c.lineWidth = 5;
                c.beginPath();
                c.arc(sp.x, sp.y, 50, 0, Math.PI * 2);
                c.stroke();
            }
            c.globalAlpha = 1;
            c.strokeStyle = TIERS[sp.tier].color;
            c.lineWidth = 3;
            c.beginPath();
            c.arc(sp.x, sp.y, 58, 0, Math.PI * 2);
            c.stroke();
            if (cleared) {
                const left = Math.max(0, Math.ceil(((this.save.spawn['s' + sp.id] ?? 0) - this.now()) / 1000));
                c.fillStyle = '#fff';
                c.font = 'bold 14px sans-serif';
                c.textAlign = 'center';
                c.fillText(left >= 60 ? Math.floor(left / 60) + 'dk ' + (left % 60) + 'sn' : left + 'sn', sp.x, sp.y + 5);
            }
        }
        for (const t of world.trees) {
            if (!this.inView(t.x, t.y, 80, camX, camY))
                continue;
            if (this.isCleared('t' + t.id)) {
                c.fillStyle = '#4a3320';
                c.beginPath();
                c.arc(t.x, t.y, 9, 0, Math.PI * 2);
                c.fill();
                continue;
            }
            c.strokeStyle = 'rgba(255,216,74,0.8)';
            c.lineWidth = 3;
            c.beginPath();
            c.arc(t.x, t.y, 30, 0, Math.PI * 2);
            c.stroke();
            this.drawTree(t.x, t.y, 84, t.reg);
            const maxHp = 30 * ZONES[t.reg].scale;
            const hp = this.treeHp.get(t.id) ?? maxHp;
            if (hp < maxHp) {
                c.fillStyle = '#400';
                c.fillRect(t.x - 20, t.y - 52, 40, 4);
                c.fillStyle = '#5f5';
                c.fillRect(t.x - 20, t.y - 52, (40 * hp) / maxHp, 4);
            }
        }
        for (const ch of world.chests) {
            if (!this.inView(ch.x, ch.y, 40, camX, camY))
                continue;
            const open = this.save.chests.includes(ch.id);
            if (this.spr('chest')) {
                c.globalAlpha = open ? 0.4 : 1;
                this.drawSpr('chest', ch.x, ch.y, 44);
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
        for (let i = 0; i < ZONES.length - 1; i++)
            this.drawGate(i, camX, camY);
    }
    drawGate(i, camX, camY) {
        const c = this.ctx;
        const g = this.gatePos(i);
        if (!this.inView(g.x, g.y, 200, camX, camY))
            return;
        const b = this.bridge(i);
        const ang = Math.atan2(b.by - b.ay, b.bx - b.ax);
        const locked = this.gateLocked(i);
        c.save();
        c.translate(g.x, g.y);
        c.rotate(ang);
        c.fillStyle = '#5a5a66';
        c.fillRect(-14, -BRIDGE_HALF_WIDTH - 16, 28, 34);
        c.fillRect(-14, BRIDGE_HALF_WIDTH - 18, 28, 34);
        if (locked) {
            c.fillStyle = '#8a5a2b';
            c.fillRect(-10, -BRIDGE_HALF_WIDTH + 14, 20, BRIDGE_HALF_WIDTH * 2 - 28);
            c.fillStyle = '#d9c25a';
            c.fillRect(-6, -8, 12, 16);
        }
        else {
            c.strokeStyle = 'rgba(120,255,160,0.55)';
            c.lineWidth = 4;
            c.setLineDash([8, 8]);
            c.beginPath();
            c.moveTo(0, -BRIDGE_HALF_WIDTH + 14);
            c.lineTo(0, BRIDGE_HALF_WIDTH - 14);
            c.stroke();
            c.setLineDash([]);
        }
        c.restore();
        c.font = 'bold 12px sans-serif';
        c.textAlign = 'center';
        c.fillStyle = locked ? '#ffd0a0' : '#b8ffcc';
        c.fillText(locked ? 'KİLİTLİ — ' + ZONES[i].bossName + ' yenilmeli' : 'Kapı açık', g.x, g.y - BRIDGE_HALF_WIDTH - 24);
    }
    drawPlayer() {
        const c = this.ctx;
        const blink = this.invuln > 0 && Math.floor(this.time * 20) % 2 === 0;
        c.globalAlpha = blink ? 0.45 : 1;
        const helm = this.item('helmet');
        const shield = this.item('shield');
        if (this.drawSpr('witch', this.px, this.py - 8, 70)) {
            if (helm) {
                c.fillStyle = RARITIES[helm.rarity].color;
                c.beginPath();
                c.arc(this.px + 2, this.py - 40, 3.5, 0, Math.PI * 2);
                c.fill();
            }
        }
        else {
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
            c.fillStyle = helm ? RARITIES[helm.rarity].color : '#ffd84a';
            c.fillRect(this.px - 14, this.py - 10, 28, 3);
        }
        if (shield) {
            c.fillStyle = RARITIES[shield.rarity].color;
            c.beginPath();
            c.moveTo(this.px - 28, this.py - 2);
            c.lineTo(this.px - 16, this.py - 2);
            c.lineTo(this.px - 16, this.py + 6);
            c.quadraticCurveTo(this.px - 22, this.py + 16, this.px - 28, this.py + 6);
            c.closePath();
            c.fill();
        }
        c.globalAlpha = 1;
    }
    drawEnemy(e) {
        const c = this.ctx;
        const tier = TIERS[e.tier];
        const r = e.def.r * tier.size;
        if (e.tier !== 'easy' && e.tier !== 'medium' && e.tier !== 'hard') {
            c.strokeStyle = tier.color;
            c.lineWidth = 3;
            c.beginPath();
            c.arc(e.x, e.y, r + 4, 0, Math.PI * 2);
            c.stroke();
        }
        const sprName = e.tier === 'boss' ? ['boss_owl', 'boss_swamp', 'boss_frost'][e.reg] : e.def.id;
        if (!this.drawSpr(sprName, e.x, e.y, r * 3.3)) {
            const fallback = { ghost: '#e8e8ff', mushroom: '#e0576a', pumpkin: '#ff9a3c', bat: '#8a6bd1' };
            c.fillStyle = e.tier === 'boss' ? '#7a4fd0' : fallback[e.def.id];
            c.beginPath();
            c.arc(e.x, e.y, r, 0, Math.PI * 2);
            c.fill();
            c.fillStyle = '#111';
            c.fillRect(e.x - r * 0.4, e.y - 2, 3, 4);
            c.fillRect(e.x + r * 0.2, e.y - 2, 3, 4);
        }
        const sp = this.getWorld().spawners[e.sp];
        if (sp && sp.tag) {
            c.fillStyle = '#ffd84a';
            c.fillRect(e.x - 5, e.y - r - 36, 10, 8);
        }
        c.fillStyle = '#400';
        c.fillRect(e.x - r, e.y - r - 12, r * 2, 5);
        c.fillStyle = '#5f5';
        c.fillRect(e.x - r, e.y - r - 12, (r * 2 * e.hp) / e.maxHp, 5);
        const ratio = this.enemyPower(e) / Math.max(1, this.power());
        c.font = 'bold 13px sans-serif';
        c.textAlign = 'center';
        c.fillStyle = ratio < 0.6 ? '#7bff9a' : ratio < 1.6 ? '#ffe36b' : '#ff6b6b';
        c.fillText('⚔ ' + this.fmt(this.enemyPower(e)), e.x, e.y - r - 18);
        if (Math.hypot(e.x - this.px, e.y - this.py) < 200) {
            c.font = '11px sans-serif';
            c.fillStyle = '#e9e4ff';
            c.fillText(DTYPE_NAMES[e.def.atk] + ' vurur · ' + DTYPE_NAMES[this.weakness(e)] + ' zayıf', e.x, e.y + r + 14);
        }
    }
    drawOrb(o) {
        const c = this.ctx;
        const pulse = 1 + 0.15 * Math.sin(this.time * 8 + o.x);
        if (o.kind === 'geode' && this.drawSpr('icon_geode', o.x, o.y, 26 * pulse))
            return;
        c.fillStyle = o.kind === 'heal' ? '#ff7bd0' : o.kind === 'geode' ? '#7dffb0' : '#9be7ff';
        c.beginPath();
        if (o.kind === 'geode') {
            c.moveTo(o.x, o.y - 8 * pulse);
            c.lineTo(o.x + 7 * pulse, o.y);
            c.lineTo(o.x, o.y + 8 * pulse);
            c.lineTo(o.x - 7 * pulse, o.y);
            c.closePath();
        }
        else {
            c.arc(o.x, o.y, (o.kind === 'ess' ? 5 : 7) * pulse, 0, Math.PI * 2);
        }
        c.fill();
        c.fillStyle = 'rgba(255,255,255,0.7)';
        c.beginPath();
        c.arc(o.x - 1.5, o.y - 1.5, 1.8, 0, Math.PI * 2);
        c.fill();
    }
    drawProj(p) {
        const c = this.ctx;
        if (p.kind === 'bolt') {
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
            if (!this.drawSpr('icon_broom', p.x, p.y, 58, this.time * 14)) {
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
    drawHud() {
        const c = this.ctx;
        const zone = this.zone();
        const bw = Math.min(230, this.w - 130);
        c.fillStyle = 'rgba(0,0,0,0.55)';
        c.fillRect(12, 12, bw, 16);
        c.fillStyle = '#e0445a';
        c.fillRect(12, 12, (bw * Math.max(0, this.hp)) / this.maxHp(), 16);
        c.fillStyle = '#fff';
        c.font = '12px sans-serif';
        c.textAlign = 'left';
        c.fillText(this.fmt(Math.max(0, this.hp)) + ' / ' + this.fmt(this.maxHp()), 18, 25);
        c.font = 'bold 13px sans-serif';
        c.fillStyle = '#ffe36b';
        c.fillText('⚔ Güç ' + this.fmt(this.power()), 12, 46);
        c.font = '12px sans-serif';
        c.fillStyle = '#fff';
        const cp = this.campProgress();
        c.fillText(zone.name, 12, 64);
        c.fillText('kamp ' + cp.done + '/' + cp.total + ' · sandık ' + this.chestsOpened() + '/6', 12, 80);
        if (this.bannerT > 0) {
            c.textAlign = 'center';
            c.font = this.w < 700 ? 'bold 14px sans-serif' : 'bold 18px sans-serif';
            c.globalAlpha = Math.min(1, this.bannerT);
            c.fillStyle = '#fff';
            c.fillText(this.banner, this.w / 2, this.h * 0.3);
            c.globalAlpha = 1;
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
            c.fillText('Bayıldın…', this.w / 2, this.h / 2);
        }
    }
    drawMinimap() {
        const c = this.ctx;
        const minX = ZONES[0].cx - ZONES[0].radius - 80;
        const maxX = ZONES[ZONES.length - 1].cx + ZONES[ZONES.length - 1].radius + 80;
        const minY = Math.min(...ZONES.map((z) => z.cy - z.radius)) - 80;
        const maxY = Math.max(...ZONES.map((z) => z.cy + z.radius)) + 80;
        const mw = Math.min(190, this.w * 0.38);
        const k = mw / (maxX - minX);
        const mh = (maxY - minY) * k;
        const mx = this.w - mw - 10;
        const my = 56;
        c.save();
        c.fillStyle = 'rgba(8,24,44,0.78)';
        c.fillRect(mx, my, mw, mh);
        const X = (x) => mx + (x - minX) * k;
        const Y = (y) => my + (y - minY) * k;
        for (let i = 0; i < ZONES.length - 1; i++) {
            const b = this.bridge(i);
            c.strokeStyle = '#6b5436';
            c.lineWidth = BRIDGE_HALF_WIDTH * 2 * k;
            c.beginPath();
            c.moveTo(X(b.ax), Y(b.ay));
            c.lineTo(X(b.bx), Y(b.by));
            c.stroke();
        }
        ZONES.forEach((z) => { c.fillStyle = z.bg; c.beginPath(); c.arc(X(z.cx), Y(z.cy), z.radius * k, 0, Math.PI * 2); c.fill(); });
        for (const sp of this.getWorld().spawners) {
            c.fillStyle = this.isCleared('s' + sp.id) ? 'rgba(160,160,160,0.6)' : TIERS[sp.tier].color;
            const s = sp.tier === 'boss' ? 4 : 2;
            c.fillRect(X(sp.x) - s / 2, Y(sp.y) - s / 2, s, s);
        }
        c.fillStyle = '#fff';
        for (const ch of this.getWorld().chests) {
            if (this.save.chests.includes(ch.id))
                continue;
            if (Math.hypot(ch.x - this.px, ch.y - this.py) < 520)
                c.fillRect(X(ch.x) - 1.5, Y(ch.y) - 1.5, 3, 3);
        }
        for (let i = 0; i < ZONES.length - 1; i++) {
            const g = this.gatePos(i);
            c.fillStyle = this.gateLocked(i) ? '#ff8a5a' : '#7bff9a';
            c.fillRect(X(g.x) - 2, Y(g.y) - 3, 4, 6);
        }
        c.fillStyle = '#fff';
        c.beginPath();
        c.arc(X(this.px), Y(this.py), 3, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = 'rgba(255,255,255,0.4)';
        c.lineWidth = 1;
        c.strokeRect(mx, my, mw, mh);
        c.restore();
    }
}
