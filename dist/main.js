import { Game } from './game.js';
import { audio } from './audio.js';
import { N, T } from './i18n.js';
import { changed, loadSettings, settings, vibrate } from './settings.js';
import { BUILD, CODENAME, VERSION } from './version.js';
import { CRYSTAL_STATS, DTYPES, DTYPE_NAMES, ENEMIES, EQUIP_NAMES, MAX_ENCHANT, MAX_ITEM_LEVEL, MAX_WEAPON_LEVEL, RARITIES, SLOT_NAMES, TIERS, UPGRADES, WEAPONS, ZONES, crystalValue, enchantChance, enchantCost, fmtNum, itemAbility, itemUpgradeCost, itemValue, upgradeCost, } from './data.js';
loadSettings();
const L = (s) => N(T(s));
const canvas = document.getElementById('game');
const game = new Game(canvas);
const panel = document.getElementById('panel');
const essenceEl = document.getElementById('essence');
const masterBtn = document.getElementById('master-btn');
let open = null;
let landingOpen = true;
let note = '';
let trainMaster = 0;
const fmt = (n) => (n < 1000 ? String(Math.floor(n)) : fmtNum(n));
/** simge: görsel yüklenemezse gizlenir */
const ico = (name, size = 22) => `<img class="ico" src="assets/${name}.png" width="${size}" height="${size}" alt="" onerror="this.style.display='none'">`;
const UP_ICON = {
    hp: 'ui_heart', regen: 'ui_regen', armor: 'icon_shield', dmg: 'ui_power', spin: 'ui_spells', reach: 'ui_pierce',
    magnet: 'ui_magnet', yield: 'ui_yield', speed: 'ui_speed',
};
function btn(text, cls, enabled, onClick) {
    const b = document.createElement('button');
    b.innerHTML = L(text);
    if (cls)
        b.className = cls;
    b.disabled = !enabled;
    b.addEventListener('click', onClick);
    return b;
}
function row(iconHtml, title, sub, right) {
    const el = document.createElement('div');
    el.className = 'row';
    const txt = document.createElement('div');
    txt.className = 'rtxt';
    txt.innerHTML = `${iconHtml}<div><b>${L(title)}</b><br><small>${L(sub)}</small></div>`;
    el.append(txt);
    if (right)
        el.append(right);
    return el;
}
function btns(...b) {
    const d = document.createElement('div');
    d.className = 'btns';
    d.append(...b);
    return d;
}
function setPanelTitle(t, iconName) {
    const head = document.createElement('div');
    head.className = 'head';
    head.innerHTML = `<b>${ico(iconName, 26)} ${L(t)}</b>`;
    head.append(btn('✕', 'x', true, () => { open = null; renderPanel(); }));
    panel.append(head);
}
// ---------------- paneller ----------------
function renderPanel() {
    essenceEl.textContent = fmt(game.save.essence);
    if (!open) {
        panel.style.display = 'none';
        game.paused = landingOpen;
        return;
    }
    game.paused = true;
    panel.style.display = 'block';
    panel.innerHTML = '';
    if (open === 'tree') {
        setPanelTitle('Yetenek Ağacı', 'ui_skill');
        let last = '';
        for (const u of UPGRADES) {
            if (u.branch !== last) {
                last = u.branch;
                const h = document.createElement('h3');
                h.textContent = u.branch;
                panel.append(h);
            }
            const lvl = game.lv(u.id);
            const locked = !!u.requires && game.lv(u.requires) < 1;
            const maxed = lvl >= u.max;
            const cost = upgradeCost(u, lvl);
            panel.append(row(ico(UP_ICON[u.id] ?? 'ui_skill', 30), `${u.name} ${lvl}/${u.max}`, locked ? ico('ui_lock', 14) + ' önceki yetenek gerekli' : u.desc, btn(maxed ? 'MAX' : ico('ui_soul', 16) + ' ' + fmt(cost), '', !locked && !maxed && game.save.essence >= cost, () => game.buyUpgrade(u.id))));
        }
    }
    else if (open === 'weapons') {
        setPanelTitle('Büyüler', 'ui_spells');
        const n = document.createElement('div');
        n.className = 'row';
        n.innerHTML = `<small>${ico('ui_spells', 14)} ${L('Yuva')}: ${game.equippedWeapons().length}/${game.weaponSlots()} ${L('(boss yendikçe artar).')} ${L('Düşmanın zayıf olduğu türden büyü kuşan!')} ${L('Kopyalar kamplardan düşer.')}</small>`;
        panel.append(n);
        const order = WEAPONS.map((_, i) => i).sort((a, b) => Number(game.save.loadout.includes(b)) - Number(game.save.loadout.includes(a)) || a - b);
        order.forEach((i) => {
            const w = WEAPONS[i];
            const lvl = game.save.weapons[i];
            const need = game.weaponNeed(i);
            const have = game.save.copies[i];
            const maxed = lvl >= MAX_WEAPON_LEVEL;
            const on = game.save.loadout.includes(i);
            panel.append(row(ico('icon_' + w.id, 38), `${L(w.name)} ${lvl > 0 ? 'sv.' + lvl : ''} ${ico('ui_' + w.dtype, 16)}`, `${L(w.spell)}<br>${ico('ui_power', 13)} ${lvl > 0 ? fmt(game.weaponDmg(i)) : '—'} · ${L('kopya')} ${have}/${need}${on ? ' · <span class="on">' + L('KUŞANILDI') + '</span>' : ''}`, btns(btn(on ? 'Çıkar' : 'Kuşan', '', lvl > 0, () => game.toggleWeapon(i)), btn(maxed ? 'MAX' : lvl === 0 ? 'Aç' : '▲ Yükselt', '', !maxed && have >= need, () => game.upgradeWeapon(i)))));
        });
    }
    else if (open === 'gear') {
        setPanelTitle('Ekipman', 'ui_gear');
        const slot = (t) => {
            const it = game.item(t);
            return it ? `<span style="color:${RARITIES[it.rarity].color}">${L(EQUIP_NAMES[t][it.rarity])} sv.${it.level}</span> ${ico('ui_' + it.dtype, 14)}` : '<i>boş</i>';
        };
        const top = document.createElement('div');
        top.className = 'row';
        top.innerHTML = `<div class="rtxt">${ico('icon_helmet', 30)} ${slot('helmet')} &nbsp; ${ico('icon_shield', 30)} ${slot('shield')}</div>`
            + `<div>${ico('ui_dust', 20)} ${Math.floor(game.save.dust)}</div>`;
        panel.append(top);
        const worn = (id) => (game.save.eq.helmet === id || game.save.eq.shield === id ? 1 : 0);
        const list = [...game.save.items].sort((a, b) => worn(b.id) - worn(a.id) || b.rarity - a.rarity || b.level - a.level);
        for (const it of list.slice(0, 40)) {
            const eq = game.save.eq[it.type] === it.id;
            const val = itemValue(it.type, it.rarity, it.level);
            const ab = itemAbility(it.type, it.rarity);
            const cost = itemUpgradeCost(it.level, it.rarity);
            panel.append(row(`<span class="rar" style="border-color:${RARITIES[it.rarity].color}">${ico('icon_' + it.type, 34)}</span>`, `<span style="color:${RARITIES[it.rarity].color}">${L(EQUIP_NAMES[it.type][it.rarity])} sv.${it.level}</span> ${ico('ui_' + it.dtype, 15)}`, `${L(SLOT_NAMES[it.type])}: ${it.type === 'helmet' ? '+%' + val.toFixed(1) + ' ' + ico('ui_heart', 12) : '-%' + val.toFixed(1) + ' ' + L(DTYPE_NAMES[it.dtype]) + ' ' + L('hasarı')}${ab ? ' · ' + L(ab) : ''}`, btns(btn(eq ? 'Çıkar' : 'Tak', '', true, () => game.toggleItem(it.id)), btn(it.level >= MAX_ITEM_LEVEL ? 'MAX' : '▲ ' + ico('ui_soul', 14) + fmt(cost), '', it.level < MAX_ITEM_LEVEL && game.save.essence >= cost, () => game.upgradeItem(it.id)), btn('Sat', 'danger', true, () => game.sellItem(it.id)))));
        }
        if (!list.length)
            panel.append(row(ico('icon_helmet', 30), 'Henüz ekipmanın yok', 'Muhafız kamplarından ve boss\'lardan düşer.', null));
    }
    else if (open === 'crystals') {
        setPanelTitle('Kristaller', 'ui_crystal');
        const info = document.createElement('div');
        info.className = 'row';
        info.innerHTML = `<div class="rtxt">${ico('icon_geode', 26)} <b>${game.save.geodes}</b> &nbsp; ${ico('ui_dust', 26)} <b>${Math.floor(game.save.dust)}</b>`
            + ` &nbsp; <small>${L('yuva')} ${game.save.equipped.length}/${game.slots()} · ${note}</small></div>`;
        info.append(btn('Jeod aç', '', game.save.geodes >= 1, () => {
            const c = game.openGeode();
            if (c)
                note = L(RARITIES[c.rarity].name) + ' ' + L(CRYSTAL_STATS[c.stat].name) + '!';
            renderPanel();
        }));
        panel.append(info);
        const list = [...game.save.crystals].sort((a, b) => Number(game.save.equipped.includes(b.id)) - Number(game.save.equipped.includes(a.id)) || b.rarity - a.rarity || b.enchant - a.enchant);
        for (const c of list.slice(0, 40)) {
            const eq = game.save.equipped.includes(c.id);
            const st = CRYSTAL_STATS[c.stat];
            const val = crystalValue(c.stat, c.rarity, c.enchant);
            const cost = enchantCost(c.enchant);
            panel.append(row(`<span class="rar" style="border-color:${RARITIES[c.rarity].color}">${ico('ui_' + c.stat, 34)}</span>`, `<span style="color:${RARITIES[c.rarity].color}">${L(RARITIES[c.rarity].name)} ${L(st.name)}</span> +${c.enchant}`, `+${val.toFixed(st.unit === '/sn' ? 2 : 1)}${st.unit} ${L(st.name)}`, btns(btn(eq ? 'Çıkar' : 'Tak', '', true, () => { if (!game.toggleCrystal(c.id))
                note = L('Boş yuva yok.'); renderPanel(); }), btn(c.enchant >= MAX_ENCHANT ? 'MAX' : `✦ ${cost} · %${Math.round(enchantChance(c.enchant) * 100)}`, '', c.enchant < MAX_ENCHANT && game.save.dust >= cost, () => {
                const r = game.enchantCrystal(c.id);
                note = r === 'ok' ? 'Başarılı!' : r === 'fail' ? 'Başarısız, toz gitti.' : '';
                renderPanel();
            }), btn('Sat', 'danger', true, () => { game.sellCrystal(c.id); renderPanel(); }))));
        }
        if (!list.length)
            panel.append(row(ico('icon_geode', 30), 'Kristalin yok', 'Elit/boss kamplarından ve sandıklardan jeod düşer; jeod açınca kristal çıkar.', null));
    }
    else if (open === 'stats') {
        setPanelTitle('Statlar', 'ui_stats');
        const iconFor = (label) => {
            const m = [['Güç', 'ui_power'], ['Azami can', 'ui_heart'], ['Kritik', 'ui_crit'], ['Yenilenme', 'ui_regen'], ['Hasar çarpanı', 'ui_power'],
                ['Alınan', 'icon_shield'], ['Kesme', 'ui_cut'], ['Delme', 'ui_pierce'], ['Ezme', 'ui_smash'], ['map.normal', 'ui_soul'], ['map.elite', 'ui_crit'], ['map.tree', 'tree_forest']];
            const f = m.find(([k]) => label.startsWith(k));
            return ico(f ? f[1] : 'ui_stats', 24);
        };
        for (const l of game.statLines())
            panel.append(row(iconFor(l.label), l.label, '', (() => { const d = document.createElement('div'); d.innerHTML = `<b>${l.value}</b>`; return d; })()));
        panel.append(row(ico('ui_skill', 24), 'Eğitim (usta cadı)', `+%${game.perm('train.dmg').toFixed(1)} hasar · +%${game.perm('train.hp').toFixed(1)} can · +${game.perm('train.regen').toFixed(2)} yenilenme`, null));
        const h = document.createElement('h3');
        h.textContent = L('Şeref Salonu');
        panel.append(h);
        panel.append(hofList(10));
        const v = document.createElement('div');
        v.className = 'row';
        v.innerHTML = `<small>Hexling · ${L('Sürüm')} ${VERSION} (${CODENAME}) · ${L('Yapım')} ${BUILD}</small>`;
        panel.append(v);
    }
    else if (open === 'cards') {
        setPanelTitle('Karakter Kartları', 'ui_cards');
        const grid = document.createElement('div');
        grid.className = 'cards';
        const card = (img, name, info, known) => {
            const d = document.createElement('div');
            d.className = 'card' + (known ? '' : ' unknown');
            d.innerHTML = `<img src="assets/${img}.png" alt="" onerror="this.style.visibility='hidden'"><div class="cname">${known ? N(name) : '???'}</div><div class="cinfo">${known ? info : L('Henüz karşılaşmadın')}</div>`;
            return d;
        };
        grid.append(card('card_witch', 'Cadı Çırağı', `${ico('ui_power', 14)} Güç ${fmt(game.power())} · ${ico('ui_heart', 14)} ${fmt(game.maxHp())}`, true));
        for (const id of ['ghost', 'mushroom', 'pumpkin', 'bat', 'scorpion', 'golem', 'wisp']) {
            const e = ENEMIES[id];
            const w = DTYPES.reduce((b, t) => (e.resist[t] > e.resist[b] ? t : b), DTYPES[0]);
            grid.append(card('card_' + id, e.name, `vurur ${ico('ui_' + e.atk, 14)} · zayıf ${ico('ui_' + w, 14)}`, !!game.save.seen[id]));
        }
        const bossCard = ['card_boss_owl', 'card_boss_swamp', 'card_boss_frost', 'card_boss_desert', 'card_boss_crystal', 'card_boss_volcano', 'card_boss_sky', 'card_boss_shadow'];
        ZONES.slice(0, 8).forEach((z, i) => grid.append(card(bossCard[i], N(z.bossName), `${L(TIERS.boss.name)} · ${N(z.name)}`, Object.keys(game.save.seen).some((k) => k.endsWith('_boss' + i) && game.save.seen[k]))));
        panel.append(grid);
    }
    else if (open === 'settings') {
        setPanelTitle('Ayarlar', 'ui_settings');
        const slider = (label, icon, get, set) => {
            const d = document.createElement('div');
            d.className = 'set-row';
            const name = document.createElement('div');
            name.className = 'rtxt';
            name.innerHTML = `${ico(icon, 28)} <b>${L(label)}</b>`;
            const r = document.createElement('input');
            r.type = 'range';
            r.min = '0';
            r.max = '100';
            r.value = String(Math.round(get() * 100));
            r.addEventListener('input', () => { audio.start(); set(Number(r.value) / 100); changed(); });
            r.addEventListener('change', () => audio.play('click'));
            d.append(name, r);
            return d;
        };
        panel.append(slider('Müzik', 'ui_spells', () => settings.music, (v) => { settings.music = v; }));
        panel.append(slider('Efekt sesi', 'ui_crit', () => settings.sfx, (v) => { settings.sfx = v; }));
        const seg = (label, icon, opts, cur, on) => {
            const d = document.createElement('div');
            d.className = 'set-row';
            const name = document.createElement('div');
            name.className = 'rtxt';
            name.innerHTML = `${ico(icon, 28)} <b>${L(label)}</b>`;
            const g = document.createElement('div');
            g.className = 'seg';
            for (const [t, v] of opts)
                g.append(btn(t, v === cur ? 'sel' : '', true, () => { on(v); changed(); renderPanel(); }));
            d.append(name, g);
            return d;
        };
        panel.append(seg('Titreşim', 'ui_speed', [['Açık', true], ['Kapalı', false]], settings.vibrate, (v) => { settings.vibrate = v; if (v)
            vibrate(40); }));
        const hint = document.createElement('div');
        hint.className = 'row';
        hint.innerHTML = `<small>${L('Titreşim yalnızca destekleyen cihazlarda çalışır.')}</small>`;
        panel.append(hint);
        const lang = document.createElement('div');
        lang.className = 'set-row';
        lang.innerHTML = `<div class="rtxt">${ico('ui_map', 28)} <b>${L('Dil')}</b></div>`;
        const lg = document.createElement('div');
        lg.className = 'seg';
        for (const [code, name] of [['tr', 'Türkçe'], ['en', 'English']]) {
            const b = document.createElement('button');
            b.textContent = name;
            if (settings.lang === code)
                b.className = 'sel';
            b.addEventListener('click', () => { settings.lang = code; changed(); applyLang(); renderPanel(); });
            lg.append(b);
        }
        lang.append(lg);
        panel.append(lang);
        const foot = document.createElement('div');
        foot.className = 'row';
        foot.append(btn('Ana menü', '', true, () => { open = null; renderPanel(); showLanding(); }), btn('Oyuna dön', '', true, () => { open = null; renderPanel(); }));
        panel.append(foot);
        const ver = document.createElement('div');
        ver.className = 'row';
        ver.innerHTML = `<small>Hexling · ${L('Sürüm')} ${VERSION} (${CODENAME}) · ${L('Yapım')} ${BUILD}</small>`;
        panel.append(ver);
    }
    else if (open === 'hof') {
        setPanelTitle('Şeref Salonu', 'ui_stats');
        panel.append(hofList(20));
    }
    else if (open === 'train') {
        setPanelTitle('Usta Cadı ' + ZONES[trainMaster].master, 'ui_skill');
        const t = document.createElement('div');
        t.className = 'row';
        const plays = game.trainPlaysLeft(trainMaster);
        t.innerHTML = `<small>Mini oyunlarla eğitilip kalıcı güç kazan. Bu seviye için günde 2 eğitim hakkın var. Bugün kalan: <b>${plays}/2</b></small>`;
        panel.append(t);
        const games = [
            { kind: 'timing', name: 'Büyü Zamanlaması', desc: 'Göstergeyi yeşil bölgede durdur → kalıcı HASAR', icon: 'ui_spells' },
            { kind: 'memory', name: 'İksir Karışımı', desc: 'Renk dizisini ezberle → kalıcı CAN', icon: 'icon_potion' },
            { kind: 'stars', name: 'Yıldız Yakalama', desc: 'Düşen yıldızlara dokun → kalıcı YENİLENME', icon: 'ui_dust' },
        ];
        for (const g of games) {
            panel.append(row(ico(g.icon, 36), g.name, plays > 0 ? g.desc : 'Bugünlük hakkın bitti, yarın gel', btn(plays > 0 ? 'Oyna' : 'Yarın', '', plays > 0, () => {
                if (game.startTraining(trainMaster))
                    runMini(g.kind);
                renderPanel();
            })));
        }
    }
}
// ---------------- mini oyunlar ----------------
const mini = document.getElementById('mini');
function endMini(kind, score) {
    const pct = Math.round(score * 100);
    mini.innerHTML = `<div class="mbox"><h3>Eğitim bitti</h3><div class="big">%${pct}</div><p>${pct >= 80 ? 'Harika!' : pct >= 50 ? 'İyi iş!' : 'Biraz daha çalışmalısın.'}</p></div>`;
    const ok = btn('Ödülü al', '', true, () => {
        game.finishTraining(trainMaster, kind, score);
        mini.style.display = 'none';
        renderPanel();
    });
    mini.firstElementChild.append(ok);
}
function runMini(kind) {
    mini.style.display = 'flex';
    if (kind === 'timing') {
        let round = 0;
        let total = 0;
        let pos = 0;
        let dir = 1;
        let raf = 0;
        let running = true;
        mini.innerHTML = `<div class="mbox"><h3>Büyü Zamanlaması</h3><p id="mt">Tur 1/5</p><div class="bar"><div class="zone"></div><div class="mark" id="mk"></div></div><div class="big" id="mr"> </div></div>`;
        const mk = document.getElementById('mk');
        const mr = document.getElementById('mr');
        const fire = btn('Fırlat!', 'big-btn', true, () => {
            if (!running)
                return;
            const acc = Math.max(0, 1 - Math.abs(pos - 0.5) / 0.5);
            const s = Math.pow(acc, 1.6);
            total += s;
            round++;
            mr.textContent = s > 0.85 ? 'Mükemmel!' : s > 0.5 ? 'İyi' : 'Iskaladın';
            if (round >= 5) {
                running = false;
                cancelAnimationFrame(raf);
                setTimeout(() => endMini('timing', total / 5), 500);
            }
            else
                document.getElementById('mt').textContent = `Tur ${round + 1}/5`;
        });
        mini.firstElementChild.append(fire);
        let last = performance.now();
        const tick = (now) => {
            const dt = (now - last) / 1000;
            last = now;
            pos += dir * dt * (0.9 + round * 0.35);
            if (pos > 1) {
                pos = 1;
                dir = -1;
            }
            else if (pos < 0) {
                pos = 0;
                dir = 1;
            }
            mk.style.left = pos * 100 + '%';
            if (running)
                raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
    }
    else if (kind === 'memory') {
        const colors = ['#ff5d8f', '#4ea1ff', '#7bff9a', '#ffd84a'];
        const seq = [];
        let step = 0;
        let rounds = 0;
        let accepting = false;
        mini.innerHTML = `<div class="mbox"><h3>İksir Karışımı</h3><p id="mm">İzle…</p><div class="pads" id="pads"></div></div>`;
        const pads = document.getElementById('pads');
        const mm = document.getElementById('mm');
        const els = colors.map((col, i) => {
            const b = document.createElement('button');
            b.className = 'pad';
            b.style.background = col;
            b.innerHTML = ico('icon_potion', 40);
            b.addEventListener('click', () => {
                if (!accepting)
                    return;
                flash(i);
                if (seq[step] !== i) {
                    accepting = false;
                    endMini('memory', Math.min(1, rounds / 5));
                    return;
                }
                step++;
                if (step === seq.length) {
                    rounds++;
                    accepting = false;
                    if (rounds >= 5)
                        setTimeout(() => endMini('memory', 1), 400);
                    else
                        setTimeout(play, 700);
                }
            });
            pads.append(b);
            return b;
        });
        const flash = (i) => { els[i].classList.add('lit'); setTimeout(() => els[i].classList.remove('lit'), 280); };
        const play = () => {
            seq.push(Math.floor(Math.random() * 4));
            step = 0;
            mm.textContent = 'İzle…';
            seq.forEach((s, k) => setTimeout(() => flash(s), 500 + k * 520));
            setTimeout(() => { accepting = true; mm.textContent = `Sıra sende (${rounds}/5)`; }, 500 + seq.length * 520);
        };
        setTimeout(() => { seq.push(Math.floor(Math.random() * 4), Math.floor(Math.random() * 4)); play(); }, 400);
    }
    else {
        let caught = 0;
        let timeLeft = 12;
        mini.innerHTML = `<div class="mbox"><h3>Yıldız Yakalama</h3><p id="ms">Yakalanan: 0 · 12 sn</p><div class="field" id="field"></div></div>`;
        const field = document.getElementById('field');
        const ms = document.getElementById('ms');
        const spawn = () => {
            const s = document.createElement('div');
            s.className = 'star';
            s.innerHTML = ico('ui_dust', 38);
            s.style.left = Math.random() * 80 + '%';
            s.style.top = Math.random() * 78 + '%';
            s.addEventListener('pointerdown', () => { caught++; s.remove(); ms.textContent = `Yakalanan: ${caught} · ${Math.ceil(timeLeft)} sn`; });
            field.append(s);
            setTimeout(() => s.remove(), 1300);
        };
        const sp = setInterval(spawn, 520);
        const tm = setInterval(() => {
            timeLeft -= 0.25;
            ms.textContent = `Yakalanan: ${caught} · ${Math.ceil(timeLeft)} sn`;
            if (timeLeft <= 0) {
                clearInterval(sp);
                clearInterval(tm);
                endMini('stars', Math.min(1, caught / 14));
            }
        }, 250);
    }
}
game.onChange = renderPanel;
game.onMaster = (i) => { trainMaster = i; open = 'train'; renderPanel(); };
for (const [id, kind] of [['btn-tree', 'tree'], ['btn-weapons', 'weapons'], ['btn-gear', 'gear'], ['btn-crystals', 'crystals'], ['btn-stats', 'stats'], ['btn-cards', 'cards']]) {
    document.getElementById(id)?.addEventListener('click', () => { open = open === kind ? null : kind; renderPanel(); });
}
document.getElementById('btn-map')?.addEventListener('click', () => { open = null; renderPanel(); game.mapOpen = !game.mapOpen; });
masterBtn.addEventListener('click', () => { const m = game.nearMaster(); if (m >= 0)
    game.onMaster(m); });
// ---------------- girdi ----------------
window.addEventListener('keydown', (e) => { game.keys.add(e.key.toLowerCase()); if (e.key.toLowerCase() === 'm')
    game.mapOpen = !game.mapOpen; });
window.addEventListener('keyup', (e) => game.keys.delete(e.key.toLowerCase()));
let touchStart = null;
canvas.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    game.joy = { ox: t.clientX, oy: t.clientY, x: t.clientX, y: t.clientY };
    touchStart = { t: performance.now(), x: t.clientX, y: t.clientY };
    e.preventDefault();
}, { passive: false });
canvas.addEventListener('touchmove', (e) => {
    const t = e.changedTouches[0];
    if (game.joy) {
        game.joy.x = t.clientX;
        game.joy.y = t.clientY;
    }
    e.preventDefault();
}, { passive: false });
const endTouch = (e) => {
    game.joy = null;
    if (e && touchStart) {
        const t = e.changedTouches[0];
        if (performance.now() - touchStart.t < 280 && Math.hypot(t.clientX - touchStart.x, t.clientY - touchStart.y) < 14)
            game.handleTap(t.clientX, t.clientY);
        touchStart = null;
    }
};
canvas.addEventListener('touchend', endTouch);
canvas.addEventListener('touchcancel', () => endTouch());
canvas.addEventListener('mousedown', (e) => { game.joy = { ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY }; });
canvas.addEventListener('click', (e) => { game.handleTap(e.clientX, e.clientY); });
window.addEventListener('mousemove', (e) => { if (game.joy) {
    game.joy.x = e.clientX;
    game.joy.y = e.clientY;
} });
window.addEventListener('mouseup', () => { game.joy = null; });
window.addEventListener('beforeunload', () => game.persist());
document.addEventListener('visibilitychange', () => { if (document.hidden)
    game.persist(); });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
// telefonda çevrimdışı çalışsın (?nosw=1 ile kapatılır)
if ('serviceWorker' in navigator && !location.search.includes('nosw') && !window.Capacitor) {
    navigator.serviceWorker.register('sw.js').catch((e) => console.error('service worker kaydedilemedi', e));
}
// yapılabilecek geliştirme varsa ilgili düğme parlar, "Buraya tıkla!" balonu zıplar (oyun kesilmez, dokunma engellenmez)
const hintTip = document.getElementById('hint-tip');
const hintBtns = [['btn-tree', 'tree'], ['btn-weapons', 'weapons'], ['btn-gear', 'gear'], ['btn-crystals', 'crystals']];
let hintAt = 0;
function updateHints(now) {
    if (now - hintAt < 500)
        return;
    hintAt = now;
    const h = game.upgradeHints();
    let first = null;
    for (const [id, key] of hintBtns) {
        const b = document.getElementById(id);
        if (!b)
            continue;
        const on = h[key] && open !== key && mini.style.display !== 'flex';
        b.classList.toggle('hint', on);
        if (on && !first)
            first = b;
    }
    if (first && !open) {
        const r = first.getBoundingClientRect();
        hintTip.style.display = 'block';
        hintTip.style.left = r.left + r.width / 2 + 'px';
        hintTip.style.top = r.top - 34 + 'px';
    }
    else
        hintTip.style.display = 'none';
}
let last = performance.now();
function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    game.update(dt);
    game.render();
    updateHints(now);
    masterBtn.style.display = !open && game.nearMaster() >= 0 && !game.mapOpen && mini.style.display !== 'flex' ? 'flex' : 'none';
    requestAnimationFrame(frame);
}
// ---------------- Şeref Salonu ----------------
/** bu cihazdaki kahramanların sıralaması: aşılan ada > güç > öldürme */
function hofList(max) {
    const wrap = document.createElement('div');
    const list = Game.hofRanking().slice(0, max);
    if (!list.length) {
        wrap.innerHTML = `<div class="row"><small>${L('Henüz kayıt yok')}</small></div>`;
        return wrap;
    }
    list.forEach((e, i) => {
        const medal = ['🥇', '🥈', '🥉'][i] ?? String(i + 1);
        const me = e.id === game.save.hero.id ? ' style="color:#ffe36b"' : '';
        const d = document.createElement('div');
        d.className = 'hof-row';
        d.innerHTML = `<div class="hof-rank">${medal}</div><div><b${me}>${e.name.replace(/</g, '&lt;')}</b><br><small>${ico('ui_power', 12)} ${fmt(e.power)} · ${ico('ui_heart', 12)} ${fmt(e.maxHp)} · ${e.kills} ${L('öldürme')}</small></div>`
            + `<div style="text-align:right"><b>${e.islands}</b><br><small>${L('ada')}</small></div>`;
        wrap.append(d);
    });
    return wrap;
}
// ---------------- dil ----------------
function applyLang() {
    document.documentElement.lang = settings.lang;
    document.querySelectorAll('[data-t]').forEach((el) => {
        if (!el.dataset.orig)
            el.dataset.orig = el.textContent ?? '';
        el.textContent = L(el.dataset.orig);
    });
    const nameIn = document.getElementById('l-name');
    nameIn.placeholder = L('Kahraman adı');
    document.getElementById('btn-settings').title = L('Ayarlar');
    document.title = 'Hexling';
    refreshLanding();
}
// ---------------- açılış ekranı ----------------
const landing = document.getElementById('landing');
const lName = document.getElementById('l-name');
function refreshLanding() {
    const sv = Game.peekSave();
    const cont = document.getElementById('l-continue');
    cont.style.display = sv ? '' : 'none';
    document.getElementById('l-save').textContent = sv ? `${sv.name} · ${sv.islands}/${ZONES.length} ${L('ada')} · ${sv.kills} ${L('öldürme')}` : '';
    document.getElementById('l-ver').textContent = `${L('Sürüm')} ${VERSION} · ${CODENAME} · ${L('Yapım')} ${BUILD}`;
    if (!lName.value)
        lName.value = sv ? sv.name : '';
}
function showLanding() {
    landingOpen = true;
    game.persist();
    landing.classList.remove('hidden');
    lName.value = '';
    refreshLanding();
    renderPanel();
}
function hideLanding() {
    landingOpen = false;
    landing.classList.add('hidden');
    audio.start();
    audio.setMood(game.region);
    renderPanel();
}
document.getElementById('l-continue')?.addEventListener('click', () => {
    if (lName.value.trim())
        game.setHeroName(lName.value);
    hideLanding();
});
document.getElementById('l-new')?.addEventListener('click', () => {
    const sv = Game.peekSave();
    if (sv && sv.kills > 0 && !confirm(L('Mevcut kahraman Şeref Salonu\'nda kalır. Yeni oyun başlatılsın mı?')))
        return;
    game.newGame(lName.value || L('Çırak'));
    hideLanding();
});
document.getElementById('l-settings')?.addEventListener('click', () => { open = 'settings'; renderPanel(); });
document.getElementById('l-hof')?.addEventListener('click', () => { open = 'hof'; renderPanel(); });
document.getElementById('btn-settings')?.addEventListener('click', () => { open = open === 'settings' ? null : 'settings'; renderPanel(); });
// her düğmeye dokunuşta tık sesi
document.addEventListener('click', (e) => { if (e.target.closest('button')) {
    audio.start();
    audio.play('click');
} }, true);
applyLang();
renderPanel();
requestAnimationFrame(frame);
window.game = game;
