import { Game } from './game.js';
import { audio } from './audio.js';
import { N, T } from './i18n.js';
import { changed, loadSettings, settings, vibrate } from './settings.js';
import { BUILD, CODENAME, VERSION } from './version.js';
import { ARCHER, LEVEL_PACKS, PACKS, REBIRTH, SPELL, createBilling } from './billing.js';
import { FightGame } from './fight.js';
import { catFull, fmtWait } from './house.js';
import { TUTORIAL } from './quests.js';
import { ENERGY_MAX, LEVEL_COST, TIGER_SLOTS, tigerItemPct } from './tiger.js';
import { LEGENDS, OUTFITS, RIVAL_HUE, ghostCode, heroLevel, parseGhostCode, weekly } from './meta.js';
import { INTRO, MINE_ENTER, MINE_FOUND, NARRATIVES, hasScene, pageFor } from './story.js';
import { playMine } from './mine.js';
import { TESTING, createAds, testRewarded } from './ads.js';
import { playMini } from './minis.js';
import { CRYSTAL_STATS, DTYPES, DTYPE_NAMES, ENEMIES, statIcon, EQUIP_NAMES, MAX_ENCHANT, MAX_ITEM_LEVEL, MAX_WEAPON_LEVEL, RARITIES, SLOT_NAMES, TIERS, UPGRADES, WEAPONS, ZONES, crystalValue, enchantChance, enchantCost, fmtNum, itemAbility, itemUpgradeCost, itemValue, upgradeCost, } from './data.js';
loadSettings();
const L = (s) => N(T(s));
const canvas = document.getElementById('game');
const game = new Game(canvas);
const panel = document.getElementById('panel');
const essenceEl = document.getElementById('essence');
const masterBtn = document.getElementById('master-btn');
const archerBtn = document.getElementById('archer-btn');
const spellBtn = document.getElementById('spell-btn');
spellBtn.addEventListener('click', () => { const r = game.castSpell(); if (r)
    game.banner = L(r); renderPanel(); });
archerBtn.addEventListener('click', () => game.toggleArcher());
let open = null;
let houseTab = 'home';
let settingsNote = '';
let landingOpen = true;
let note = '';
let trainMaster = 0;
const fmt = (n) => (n < 1000 ? String(Math.floor(n)) : fmtNum(n));
/** simge: görsel yüklenemezse gizlenir */
const ico = (name, size = 22) => `<img class="ico" src="assets/${name}.png" width="${size}" height="${size}" alt="" onerror="this.style.display='none'">`;
/** boyalı yeni simge; yüklenemezse eskisine düşer, o da yoksa gizlenir */
const icoX = (name, fallback, size = 44) => `<img class="ico" src="assets/${name}.png" width="${size}" height="${size}" alt="" data-f="${fallback}" onerror="if(this.dataset.f){this.src='assets/'+this.dataset.f+'.png';this.dataset.f='';}else{this.style.display='none'}">`;
/** takılı / kuşanılı / giyili nesnelerin yanında gösterilen tik */
const TICK = '<b style="color:#7bff9a">✓</b> ';
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
    // panel başlık görseli (varsa): yavaşça kayan/yakınlaşan animasyon
    const art = open === 'house' ? { home: 'house', quests: 'quests', tiger: 'tiger', story: 'story', arena: 'arena', wardrobe: 'wardrobe', explorer: 'explorer', brew: 'brew', mirror: 'story' }[houseTab] : open;
    if (art) {
        const ban = document.createElement('div');
        ban.className = 'banner';
        ban.innerHTML = `<img src="assets/panel_${art}.jpg" alt="" onerror="this.parentElement.style.display='none'">`;
        panel.append(ban);
    }
}
// ---------------- cadı evi ----------------
const chip = (hue) => `<span style="display:inline-block;width:28px;height:28px;border-radius:50%;background:hsl(${(270 + hue) % 360} 65% 52%);border:2px solid #fff6"></span>`;
/** görsel (assets/<ad>.jpg) varsa onu, yoksa emojiyi gösterir */
const emoji = (e, art) => art
    ? `<span style="display:inline-block;width:40px;height:40px;text-align:center;font-size:28px"><img src="assets/${art}.jpg" width="40" height="40" style="border-radius:10px;object-fit:cover" alt="" onerror="this.parentElement.textContent='${e}'"></span>`
    : `<span style="font-size:28px;width:36px;text-align:center;display:inline-block">${e}</span>`;
const hashHue = (id) => { let h = 0; for (const c of id)
    h = (h * 31 + c.charCodeAt(0)) % 360; return Math.abs(h - RIVAL_HUE) < 25 ? (h + 60) % 360 : h; };
/** sayfa içi metin kutusu (tarayıcı prompt() penceresi yerine) */
function askText(title, def, done) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:300;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center';
    const box = document.createElement('div');
    box.style.cssText = 'background:#241a40;color:#fff;border:1px solid #fff4;border-radius:12px;padding:18px;width:min(300px,86vw);text-align:center;font:15px sans-serif';
    box.textContent = L(title);
    const inp = document.createElement('input');
    inp.value = def;
    inp.maxLength = 14;
    inp.style.cssText = 'width:100%;margin-top:10px;padding:9px;border-radius:8px;border:1px solid #fff4;background:#0006;color:#fff;box-sizing:border-box';
    const ok = document.createElement('button');
    ok.textContent = L('Tamam');
    ok.style.cssText = 'margin-top:12px;padding:10px 24px;border-radius:8px;border:0;font:bold 15px sans-serif;background:#d9822b;color:#fff';
    ok.addEventListener('click', () => { wrap.remove(); done(inp.value); });
    box.append(inp, ok);
    wrap.append(box);
    document.body.append(wrap);
    inp.focus();
}
function startDuel(opts, done) {
    if (fight.active)
        return;
    open = null;
    renderPanel();
    fight.start((won) => {
        done(won);
        // sonuç kartı: zafer ya da yenilgi sahnesi
        setTimeout(() => showResultCard(won ? 'arena_win' : 'arena_lose', won ? 'Zafer!' : 'Yenilgi', won ? 'Seyirciler seni alkışlıyor.' : 'Pes etme: bir dahaki sefere daha iyi olacaksın.'), 400);
    }, opts);
}
/** mini oyun sonuç kartı: üstte sahne görseli, altta başlık ve kısa metin; dokununca kapanır */
function showResultCard(img, title, text) {
    if (document.querySelector('.result-ov'))
        return;
    const wrap = document.createElement('div');
    wrap.className = 'result-ov';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:260;background:rgba(6,3,16,.86);display:flex;align-items:center;justify-content:center;padding:14px';
    wrap.innerHTML = `<div style="width:min(94vw,520px);border-radius:16px;overflow:hidden;border:2px solid #ffd86b99;box-shadow:0 0 36px #ffb04a55;background:#140f26;color:#fff;text-align:center;font:15px sans-serif">`
        + `<div style="aspect-ratio:16/9;background:#201838 url(assets/${img}.jpg) center/cover no-repeat"></div>`
        + `<div style="padding:12px 16px 14px"><b style="color:#ffe9a0;font-size:19px">${L(title)}</b><p style="margin:6px 0 8px;line-height:1.4">${L(text)}</p><small style="opacity:.7">${L('Devam etmek için dokun')}</small></div></div>`;
    wrap.addEventListener('click', () => wrap.remove());
    document.body.append(wrap);
}
/** ayna sekmesi: 10 parçalı kırık ayna (her boss bir parça), kalıcı güç bonusu ve yansıma çağırma */
function mirrorSvg(k, tier) {
    const cx = 100;
    const cy = 118;
    const rx = 66;
    const ry = 92;
    const pt = (a, m = 1) => `${(cx + Math.cos(a) * rx * m).toFixed(1)},${(cy + Math.sin(a) * ry * m).toFixed(1)}`;
    let pieces = '';
    for (let i = 0; i < 10; i++) {
        const a0 = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const a1 = ((i + 1) / 10) * Math.PI * 2 - Math.PI / 2;
        const am = (a0 + a1) / 2;
        const ox = Math.cos(am) * 2.2;
        const oy = Math.sin(am) * 2.2; // kırık görünümü: parçalar arasında ince boşluk
        const lit = i < k;
        pieces += `<polygon transform="translate(${ox.toFixed(1)} ${oy.toFixed(1)})" points="${cx},${cy} ${pt(a0)} ${pt(a0 + (a1 - a0) * 0.5, 1.01)} ${pt(a1)}" fill="${lit ? 'url(#mlit)' : 'rgba(18,16,40,.9)'}" stroke="${lit ? '#d9f6ff' : 'rgba(150,140,200,.35)'}" stroke-width="1.2"/>`;
        if (lit)
            pieces += `<polygon transform="translate(${ox.toFixed(1)} ${oy.toFixed(1)})" points="${cx},${cy} ${pt(a0, 0.5)} ${pt(a1, 0.5)}" fill="rgba(255,255,255,.16)"/>`;
    }
    const glow = tier > 0 ? `<ellipse cx="${cx}" cy="${cy}" rx="${rx + 6}" ry="${ry + 6}" fill="none" stroke="#ffd86b" stroke-width="${3 + Math.min(5, tier)}" opacity="${0.4 + Math.min(0.5, tier * 0.1)}" filter="url(#mglow)"/>` : '';
    return `<svg viewBox="0 0 200 236" width="190" height="224" role="img" aria-label="Ayna" style="display:block;margin:4px auto">`
        + `<defs><radialGradient id="mlit" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="#eaffff"/><stop offset="1" stop-color="#5fb8e8"/></radialGradient><filter id="mglow"><feGaussianBlur stdDeviation="3"/></filter></defs>`
        + glow + pieces
        + `<ellipse cx="${cx}" cy="${cy}" rx="${rx + 4}" ry="${ry + 4}" fill="none" stroke="#c9953a" stroke-width="5"/>`
        + `<ellipse cx="${cx}" cy="${cy}" rx="${rx + 9}" ry="${ry + 9}" fill="none" stroke="#7a5420" stroke-width="2"/>`
        + `<rect x="88" y="${cy + ry + 8}" width="24" height="14" rx="3" fill="#7a5420"/></svg>`;
}
function renderMirror() {
    const n = game.mirrorShards();
    const tier = game.mirrorTier();
    const k = n % 10;
    const box = document.createElement('div');
    box.className = 'row mirror-box';
    box.style.cssText = 'display:block;text-align:center';
    box.innerHTML = mirrorSvg(k, tier)
        + `<div style="margin-top:6px"><b>${L('Ayna kırığı')}: ${n}</b> · ${L('Bütünlük')}: ${tier}</div>`
        + `<small style="display:block;margin-top:4px;line-height:1.4">${L('Her boss bir kırık verir. Her 10 kırıkta kalıcı +%2 güç ve bir yansıma hakkı kazanırsın.')}</small>`
        + `<small style="display:block;margin-top:4px">${L('Kalıcı güç')}: <b>+%${(tier * 2).toFixed(0)}</b> · ${L('Sonraki parça')}: <b>${k}/10</b></small>`;
    panel.append(box);
    const due = game.reflDue();
    panel.append(row(emoji('🪞', 'ui_skill'), `${L('Yansıma')} (${due} ${L('hak')})`, `${L('Aynadan senin gücünde bir yansıman çıkar. Yenersen 3 jeod, toz ve ruh kazanırsın.')} ${L('Yenilen')}: ${game.reflDone()}`, btn(game.reflAlive() ? 'Sahada' : 'Çağır', '', due > 0 && !game.reflAlive(), () => {
        const msg = game.summonRefl();
        if (msg) {
            game.say(msg);
            renderPanel();
            return;
        }
        open = null;
        renderPanel();
    })));
}
function renderHouse() {
    setPanelTitle('Cadı Evi', 'home');
    const tabs = [['home', 'Ev'], ['quests', 'Görev'], ['tiger', 'Kaplan'], ['story', 'Günlük'], ['arena', 'Arena'], ['wardrobe', 'Gardırop'], ['explorer', 'Kaşif'], ['brew', 'İksir'], ['mirror', 'Ayna']];
    const tabRow = document.createElement('div');
    tabRow.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:6px 0'; // 9 sekme üç satırda: telefonda yazılar kırpılmaz
    for (const [k, name] of tabs) {
        const b = btn(name, houseTab === k ? 'sel' : '', true, () => { houseTab = k; renderPanel(); });
        b.className = 'tabbtn' + (houseTab === k ? ' sel' : '');
        b.innerHTML = icoX('tab_' + k, 'ui_skill', 26) + `<span style="font-size:11px">${L(name)}</span>`;
        b.style.cssText = 'width:100%;min-width:0;white-space:nowrap;' + (houseTab === k ? 'background:#d9822b;color:#2a1200;box-shadow:0 0 12px #ffb04a88' : '');
        tabRow.append(b);
    }
    panel.append(tabRow);
    const sv = game.save;
    if (houseTab === 'home') {
        const h = sv.house;
        const info = document.createElement('div');
        info.className = 'row';
        info.innerHTML = `<small>${L('Evden kalıcı kazanç')}: <b>+%${h.hp.toFixed(0)}</b> ${L('can')} (${L('en çok')} %100) · <b>+%${h.dmg.toFixed(0)}</b> ${L('hasar')} (${L('en çok')} %200) · ${L('Seri')}: <b>${h.streak}</b></small>`;
        panel.append(info);
        const full = catFull(h, game.now());
        panel.append(row(emoji('🐈', full ? 'cat_fed' : 'cat_hungry'), h.catName, `${full ? 'Tok ve mutlu' : 'Aç olabilir'} · ${L('Mama stoku')}: ${h.food} · ${L('Besleme')}: ${h.feeds}`, btn('Adlandır', '', true, () => askText('Kedinin adı', h.catName, (v) => { game.setCatName(v); renderPanel(); }))));
        for (const t of game.houseTasks()) {
            const icon = { daily: '🎁', pet: '🐈', brew: '⚗️', garden: '🌿', soup: '🍲', buyfood: '🥫', feed: '🍽️' };
            let sub = t.desc;
            if (t.id === 'soup')
                sub += ` ${L('Biriken')}: ${fmt(game.soupReady())} ${L('ruh')}.`;
            const label = t.ready ? t.state : t.waitMs > 0 ? fmtWait(t.waitMs) : t.state;
            panel.append(row(emoji(icon[t.id], 'task_' + t.id), t.name, sub, btn(label, '', t.ready, () => { game.doHouse(t.id); renderPanel(); })));
        }
    }
    else if (houseTab === 'mirror') {
        renderMirror();
    }
    else if (houseTab === 'quests') {
        const tu = game.tutorial();
        const h1 = document.createElement('h3');
        h1.textContent = L('Başlangıç görevleri') + ` ${Math.min(tu.i, TUTORIAL.length)}/${TUTORIAL.length}`;
        panel.append(h1);
        TUTORIAL.forEach((st, i) => {
            const el = document.createElement('div');
            el.className = 'row';
            const done = i < tu.i;
            const cur = i === tu.i;
            el.style.opacity = done ? '0.5' : cur ? '1' : '0.7';
            el.innerHTML = `<div>${done ? '✅' : cur ? '👉' : '⬜'} <b>${L(st.text)}</b>${cur ? `<br><small>${L(st.hint)}</small>` : ''}</div>`;
            panel.append(el);
        });
        const h2 = document.createElement('h3');
        h2.textContent = L('Günlük görevler');
        panel.append(h2);
        game.dailyRoll();
        game.save.daily.goals.forEach((g, i) => {
            const ok = g.have >= g.need;
            panel.append(row(emoji(g.claimed ? '✅' : '📅'), game.dailyText(g.t), `${g.have}/${g.need} · +1 ${L('jeod')}`, btn(g.claimed ? '✓' : ok ? 'Ödülü al' : '…', '', ok && !g.claimed, () => { game.claimDaily(i); renderPanel(); })));
        });
        const col = document.createElement('div');
        col.className = 'row';
        col.innerHTML = `<small>${L('Koleksiyon')}: <b>${Object.keys(sv.seen).length}</b> ${L('tür görüldü')} · ${L('her 5 yeni türde +2 jeod, her 10\'da kalıcı +%1 can')}</small>`;
        panel.append(col);
    }
    else if (houseTab === 'tiger') {
        const tg = sv.tiger;
        const energyTxt = `${Math.floor(tg.energy / 60)}:${String(Math.floor(tg.energy % 60)).padStart(2, '0')} / ${ENERGY_MAX / 60}:00`;
        const c = game.feedCost();
        panel.append(row(ico('tiger', 40), 'Beyaz Kaplan', `⚔ ${fmt(game.tigerPower())} · ${L('Seviye')} ${tg.level} (${tg.kills}/12) · ${L('Sağlık')}: %${Math.round(tg.frac * 100)}${tg.frac < 1 ? ' · ' + L('gücü') + ' %' + Math.round(game.tigerWound() * 100) : ''}`, btn(settings.companion ? 'Açık' : 'Kapalı', settings.companion ? 'sel' : '', true, () => { const r = game.setCompanion(!settings.companion); if (r !== 'ok')
            msgEl.textContent = L(r);
        else
            renderPanel(); })));
        const msgEl = document.createElement('div');
        msgEl.className = 'row';
        msgEl.innerHTML = `<small>${L('Düşman ekrandaysa kendiliğinden saldırır; saldırırken enerji harcar. Canı ana karakterle aynı hızda %75 oranına kadar yenilenir; fazlası için ruh tozu gerekir.')}<br><b>${L('İlk seviye ücretsiz; sonraki her seviye geçişinde Kaplan için ruh tozu')} −${LEVEL_COST}.</b> ${game.tigerPaid() ? L('Bu seviye için ödendi.') : L('Bu seviye için henüz ödenmedi.')}</small>`;
        panel.append(msgEl);
        const canFeed = sv.essence >= c.souls && sv.dust >= c.dust && tg.energy < ENERGY_MAX - 1;
        panel.append(row(emoji('⚡'), `${L('Enerji')}: ${energyTxt}`, `${L('Bir porsiyon: +10 dk')} · ${c.souls} ${L('ruh')} + ${c.dust} ${L('toz')}`, btn('Besle', '', canFeed, () => { const r = game.feedTiger(); if (r !== 'ok')
            msgEl.textContent = L(r);
        else
            renderPanel(); })));
        panel.append(row(emoji('🩹'), 'Yara bakımı', `${L('Yaralı kaplan zayıflar: gücü en çok %60 düşer. Ruh tozuyla iyileştir.')} (${game.tigerHealCost()} ${L('toz')})`, btn('İyileştir', '', tg.frac < 0.99 && sv.dust >= game.tigerHealCost(), () => { const r = game.healTiger(); if (r !== 'ok')
            msgEl.textContent = L(r);
        else
            renderPanel(); })));
        const h6 = document.createElement('h3');
        h6.textContent = L('Kaplan eşyaları');
        panel.append(h6);
        const items = [...tg.items].sort((a, b) => b.rarity - a.rarity || b.level - a.level);
        if (!items.length)
            panel.append(row(emoji('🎒'), 'Henüz eşya yok', 'Ganimetle kaplan için kask, keskin diş ve pençe düşer', null));
        for (const it of items) {
            const sl = TIGER_SLOTS[it.type];
            const eq = tg.eq[it.type] === it.id;
            panel.append(row(`<span class="rar" style="border-color:${RARITIES[it.rarity].color}">${ico(sl.icon, 34)}</span>`, `${eq ? TICK : ''}${L(sl.names[it.rarity])} · ${L('sv.')}${it.level}`, `+%${tigerItemPct(it).toFixed(0)} ${L(sl.stat)}`, btns(btn(eq ? 'Çıkar' : 'Tak', '', true, () => { game.tigerEquip(it.id); renderPanel(); }), btn('Sat', 'danger', true, () => { game.tigerSell(it.id); renderPanel(); }))));
        }
    }
    else if (houseTab === 'story') {
        const open0 = sv.bossDown.map((b, i) => (b ? i : -1)).filter((i) => i >= 0).reverse();
        sv.storyRead = open0.length;
        const info = document.createElement('div');
        info.className = 'row';
        info.innerHTML = `<small>${L('Her ada bossu yeni bir sayfa açar')}: <b>${open0.length}/${ZONES.length}</b></small>`;
        panel.append(info);
        for (const i of open0.slice(0, 30)) {
            const pg = pageFor(i);
            const el = document.createElement('div');
            el.className = 'row page';
            el.innerHTML = `${hasScene(i) ? `<img class="scene" src="assets/story_${i}.jpg" alt="" onerror="this.style.display='none'">` : ''}<div><b>${pg.title}</b><br><small>${pg.text}</small></div>`;
            panel.append(el);
        }
        if (!open0.length)
            panel.append(row(emoji('📖'), 'Günlük boş', 'İlk adanın bossunu yen', null));
    }
    else if (houseTab === 'arena' && game.oldGamesClosed()) {
        panel.append(row(emoji('🥊', 'arena'), L('Arena kapandı'), L('Eski oyuncaklar kapandı: yalnızca iksir kazanı kaldı.'), null));
    }
    else if (houseTab === 'explorer' && game.oldGamesClosed()) {
        panel.append(row(emoji('🧭', 'explorer'), L('Maden kapandı'), L('Eski oyuncaklar kapandı: yalnızca iksir kazanı kaldı.'), null));
    }
    else if (houseTab === 'brew') {
        renderBrew();
    }
    else if (houseTab === 'arena') {
        const lvl = heroLevel(game.bossesDown(), ZONES.length);
        const mine = { name: sv.hero.name, level: lvl, hue: sv.outfit };
        const w = weekly(game.now());
        const won = sv.weekWon === w.week;
        panel.append(row(emoji('🏆'), `${L('Haftalık meydan okuma')}: ${L(w.title)}`, `${w.desc} (${L('Rakip')}: ${w.opp.name})`, btn(won ? '✓ Kazanıldı' : 'Meydan oku', '', !won, () => startDuel({ foeName: w.opp.name, foeHue: w.opp.hue, level: w.opp.level, mod: w.mod, playerHue: sv.outfit, modTitle: w.title }, (r) => { game.finishArena('weekly', w.opp.name, r); renderPanel(); }))));
        const h3 = document.createElement('h3');
        h3.textContent = L('Gölge Arenası: efsane cadılar');
        panel.append(h3);
        LEGENDS.forEach((lg, i) => {
            const open1 = i === 0 || !!sv.arena[LEGENDS[i - 1].name];
            const done = !!sv.arena[lg.name];
            panel.append(row(chip(lg.hue), lg.name, open1 ? lg.tale : 'Önceki efsaneyi yen', btn(done ? '✓ Yine dövüş' : open1 ? 'Dövüş' : '🔒', '', open1, () => startDuel({ foeName: lg.name, foeHue: lg.hue, level: lg.level, mod: 'none', playerHue: sv.outfit }, (r) => { game.finishArena('legend', lg.name, r); renderPanel(); }))));
        });
        const h4 = document.createElement('h3');
        h4.textContent = L('Gölge kodu: arkadaşınla dövüştür');
        panel.append(h4);
        const code = ghostCode(mine);
        const tip = document.createElement('div');
        tip.className = 'row';
        tip.innerHTML = `<small>${L('Kodunu arkadaşına gönder; o yapıştırıp senin gölgenle dövüşür.')}</small>`;
        panel.append(tip);
        panel.append(btns(btn('Gölge kodumu kopyala', '', true, () => { void navigator.clipboard?.writeText(code); const m = document.getElementById('ghost-msg'); if (m)
            m.textContent = L('Kopyalandı') + ': ' + code; })));
        const inp = document.createElement('input');
        inp.placeholder = 'HEX-…';
        inp.style.cssText = 'width:100%;margin:6px 0;padding:8px;border-radius:8px;border:1px solid #fff4;background:#0006;color:#fff';
        panel.append(inp);
        const msg = document.createElement('div');
        msg.id = 'ghost-msg';
        msg.className = 'row';
        msg.style.wordBreak = 'break-all';
        panel.append(msg);
        panel.append(btns(btn('Kodla dövüş', '', true, () => {
            const g = parseGhostCode(inp.value);
            if (!g) {
                msg.textContent = L('Geçersiz gölge kodu');
                return;
            }
            startDuel({ foeName: g.name, foeHue: g.hue === RIVAL_HUE ? 100 : g.hue, level: g.level, mod: 'none', playerHue: sv.outfit }, (r) => { game.finishArena('ghost', g.name, r); renderPanel(); });
        })));
        const others = Game.loadHof().filter((e) => e.id !== sv.hero.id);
        if (others.length) {
            const h5 = document.createElement('h3');
            h5.textContent = L('Bu cihazdaki diğer kahramanlar');
            panel.append(h5);
            for (const e of others.slice(0, 8)) {
                const gl = heroLevel(e.islands, ZONES.length);
                panel.append(row(chip(hashHue(e.id)), e.name, `${e.islands} ${L('ada')} · ⚔ ${fmt(e.power)}`, btn('Dövüş', '', true, () => startDuel({ foeName: e.name, foeHue: hashHue(e.id), level: gl, mod: 'none', playerHue: sv.outfit }, (r) => { game.finishArena('ghost', e.name, r); renderPanel(); }))));
            }
        }
    }
    else if (houseTab === 'explorer') {
        const st = game.explorerState();
        const info = document.createElement('div');
        info.className = 'row';
        info.innerHTML = `<small>${L('Kaşifi keşfe gönder: bulunduğun seviyeden sonraki 3\'ün katı olan adada elmas madeni bulur. Maden bulununca adada görünür; girince canın yenilenir, kalıcı güç ve eşya kazanırsın.')}</small>`;
        panel.append(info);
        const sendMsg = document.createElement('div');
        sendMsg.className = 'row';
        sendMsg.innerHTML = `<small id="exp-msg"></small>`;
        let sub;
        let label;
        let can = false;
        if (st.away) {
            sub = `${L('Yolda')} → ${st.target + 1}. ${L('ada')}`;
            label = fmtWait(st.leftMs);
        }
        else if (st.target < 0) {
            sub = L('Bu seviyeden sonra keşfedilecek maden yok');
            label = '—';
        }
        else if (st.found) {
            sub = `${st.target + 1}. ${L('ada')}: ${L('maden zaten keşfedildi')}`;
            label = '✓';
        }
        else {
            sub = `${L('Hedef')}: ${st.target + 1}. ${L('ada')} · ${L('süre')}: 2 ${L('dk')}`;
            label = L('Keşfe gönder');
            can = true;
        }
        panel.append(row(emoji('🧭', 'explorer'), L('Kaşif'), sub, btn(label, '', can, () => {
            const r = game.sendExplorer();
            const m = document.getElementById('exp-msg');
            if (r !== 'ok' && m)
                m.textContent = L(r);
            renderPanel();
        })));
        panel.append(sendMsg);
        const h = document.createElement('h3');
        h.textContent = L('Bulunan madenler');
        panel.append(h);
        if (!sv.mines.length) {
            const none = document.createElement('div');
            none.className = 'row';
            none.innerHTML = `<small>${L('Henüz maden bulunmadı')}</small>`;
            panel.append(none);
        }
        for (const r of sv.mines) {
            const left = game.mineCdLeftMs(r);
            const stock = game.mineStock(r);
            const lv = game.mineLevel(r);
            const cost = game.mineUpgradeCost(r);
            const acts = document.createElement('div');
            acts.style.cssText = 'display:flex;flex-direction:column;gap:6px';
            acts.append(btn(`${L('Topla')} (${stock.dust}${stock.geodes ? ' +' + stock.geodes + '💎' : ''})`, '', stock.dust > 0 || stock.geodes > 0, () => { game.collectMine(r); renderPanel(); }), btn(lv >= 10 ? L('En üst seviye') : `${L('Geliştir')} (${fmt(cost)} ${L('toz')})`, '', lv < 10 && sv.dust >= cost, () => { game.upgradeMine(r); renderPanel(); }));
            panel.append(row(ico('icon_geode', 36), `${L('Elmas madeni')} · ${r + 1}. ${L('ada')} · ${L('Seviye')} ${lv}`, `${left > 0 ? `${L('Dinleniyor')}: ${Math.ceil(left / 60000)} ${L('dk')}` : L('Oyna: adadaki girişe dokun')} · ${L('Boştayken biriken')}: ${stock.hours.toFixed(1)} ${L('sa')}/8`, acts));
        }
    }
    else {
        const info = document.createElement('div');
        info.className = 'row';
        info.innerHTML = `<small>${L('Her kıyafet giyilirken küçük bir niş bonus verir; güç dengesini bozmaz. Kazanarak aç.')}</small>`;
        panel.append(info);
        for (const o of OUTFITS) {
            const owned = sv.outfits.includes(o.hue);
            const cur = sv.outfit === o.hue;
            panel.append(row(chip(o.hue), (cur ? TICK : '') + L(o.name), (owned ? 'Sahipsin' : o.how) + (o.bonus ? ' · ' + L(o.bonus.label) : ''), btn(cur ? '✓ Giyili' : owned ? 'Giy' : '🔒', '', owned && !cur, () => { game.setOutfit(o.hue); renderPanel(); })));
        }
    }
    const rb = document.createElement('div');
    rb.className = 'row';
    rb.append(btn('Kapat', '', true, () => { open = null; renderPanel(); }));
    panel.append(rb);
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
            panel.append(row(icoX('sk_' + u.id, UP_ICON[u.id] ?? 'ui_skill', 46), `${u.name} ${lvl}/${u.max}`, locked ? ico('ui_lock', 14) + ' önceki yetenek gerekli' : u.desc, btn(maxed ? 'MAX' : ico('ui_soul', 16) + ' ' + fmt(cost), '', !locked && !maxed && game.save.essence >= cost, () => game.buyUpgrade(u.id))));
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
            panel.append(row(icoX('wp_' + w.id, 'icon_' + w.id, 48), `${on ? TICK : ''}${L(w.name)} ${lvl > 0 ? 'sv.' + lvl : ''} ${ico('ui_' + w.dtype, 16)}`, `${L(w.spell)}<br>${ico('ui_power', 13)} ${lvl > 0 ? fmt(game.weaponDmg(i)) : '—'} · ${L('kopya')} ${have}/${need}${on ? ' · <span class="on">' + L('KUŞANILDI') + '</span>' : ''}`, btns(btn(on ? 'Çıkar' : 'Kuşan', '', lvl > 0, () => game.toggleWeapon(i)), btn(maxed ? 'MAX' : lvl === 0 ? 'Aç' : '▲ Yükselt', '', !maxed && have >= need, () => game.upgradeWeapon(i)))));
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
        const ex = document.createElement('div');
        ex.className = 'row';
        ex.innerHTML = `<small>${L('Ek yuva')}: ${game.save.extra.length}/${game.extraSlots()} · ${L('her 10 adada +1 ekipman ve +1 kristal yuvası')}</small>`;
        panel.append(ex);
        const worn = (id) => (game.isWorn(id) ? 1 : 0);
        const list = [...game.save.items].sort((a, b) => worn(b.id) - worn(a.id) || b.rarity - a.rarity || b.level - a.level);
        for (const it of list.slice(0, 40)) {
            const eq = game.isWorn(it.id);
            const val = itemValue(it.type, it.rarity, it.level);
            const ab = itemAbility(it.type, it.rarity);
            const cost = itemUpgradeCost(it.level, it.rarity);
            panel.append(row(`<span class="rar" style="border-color:${RARITIES[it.rarity].color};color:${RARITIES[it.rarity].color}33">${icoX((it.type === 'helmet' ? 'eq_helm_' : 'eq_shield_') + it.rarity, 'icon_' + it.type, 46)}</span>`, `${eq ? TICK : ''}<span style="color:${RARITIES[it.rarity].color}">${L(EQUIP_NAMES[it.type][it.rarity])} sv.${it.level}</span> ${ico('ui_' + it.dtype, 15)}`, `${L(SLOT_NAMES[it.type])}: ${it.type === 'helmet' ? '+%' + val.toFixed(1) + ' ' + ico('ui_heart', 12) : '-%' + val.toFixed(1) + ' ' + L(DTYPE_NAMES[it.dtype]) + ' ' + L('hasarı')}${ab ? ' · ' + L(ab) : ''}`, btns(btn(eq ? 'Çıkar' : 'Tak', '', true, () => game.toggleItem(it.id)), btn(it.level >= MAX_ITEM_LEVEL ? 'MAX' : '▲ ' + ico('ui_soul', 14) + fmt(cost), '', it.level < MAX_ITEM_LEVEL && game.save.essence >= cost, () => game.upgradeItem(it.id)), btn('Sat', 'danger', true, () => game.sellItem(it.id)))));
        }
        if (!list.length)
            panel.append(row(ico('icon_helmet', 30), 'Henüz ekipmanın yok', 'Muhafız kamplarından ve boss\'lardan düşer.', null));
    }
    else if (open === 'crystals') {
        setPanelTitle('Kristaller', 'ui_crystal');
        const info = document.createElement('div');
        info.className = 'row cry-top';
        const noteTxt = game.autoCrystal() && game.autoCrystalNote ? L('Oto') + ': ' + game.autoCrystalNote : note;
        info.innerHTML = `<div class="cry-stats"><span class="cry-stat">${ico('icon_geode', 24)} <b>${game.save.geodes}</b></span><span class="cry-stat">${ico('ui_dust', 24)} <b>${Math.floor(game.save.dust)}</b></span><span class="cry-stat"><small>${L('yuva')}</small> <b>${game.save.equipped.length}/${game.slots()}</b></span></div>${noteTxt ? `<small class="cry-note">${noteTxt}</small>` : ''}`;
        const cb = document.createElement('div');
        cb.className = 'cry-btns';
        cb.append(btn('Jeod aç', '', game.save.geodes >= 1 && !game.autoCrystal(), () => {
            const c = game.openGeode();
            if (c)
                note = L(RARITIES[c.rarity].name) + ' ' + L(CRYSTAL_STATS[c.stat].name) + '!';
            renderPanel();
        }));
        cb.append(btn(game.autoCrystal() ? 'Oto: Açık' : 'Oto: Kapalı', game.autoCrystal() ? '' : 'danger', true, () => { game.setAutoCrystal(!game.autoCrystal()); note = game.autoCrystal() ? L('Oto kristal açık: jeodlar açılır, kristaller gelişir, en güçlüler kuşanılır.') : ''; renderPanel(); }));
        cb.append(btn('Tümünü aç', '', game.save.geodes >= 2 && !game.autoCrystal(), () => {
            const r = game.openAllGeodes();
            if (r.n)
                note = `${r.n} ${L('jeod açıldı')} · ${L('en iyi')}: ${L(RARITIES[r.best].name)}`;
            renderPanel();
        }));
        info.append(cb);
        panel.append(info);
        const list = [...game.save.crystals].sort((a, b) => Number(game.save.equipped.includes(b.id)) - Number(game.save.equipped.includes(a.id)) || b.rarity - a.rarity || b.enchant - a.enchant);
        for (const c of list.slice(0, 40)) {
            const eq = game.save.equipped.includes(c.id);
            const st = CRYSTAL_STATS[c.stat];
            const val = crystalValue(c.stat, c.rarity, c.enchant);
            const cost = enchantCost(c.enchant);
            panel.append(row(`<span class="rar" style="border-color:${RARITIES[c.rarity].color};color:${RARITIES[c.rarity].color}33">${icoX('cr_' + c.stat, statIcon(c.stat), 46)}</span>`, `${eq ? '<b style="color:#7bff9a">✓</b> ' : ''}<span style="color:${RARITIES[c.rarity].color}">${L(RARITIES[c.rarity].name)} ${L(st.name)}</span> +${c.enchant}`, `+${val.toFixed(st.unit === '/sn' ? 2 : 1)}${st.unit} ${L(st.name)}` + (c.enchant < MAX_ENCHANT && game.save.dust < cost ? ` · ${L('Toz yetmiyor')} (${Math.floor(game.save.dust)}/${cost})` : ''), btns(btn(eq ? 'Çıkar' : 'Tak', '', true, () => { if (!game.toggleCrystal(c.id))
                note = L('Boş yuva yok.'); renderPanel(); }), btn(c.enchant >= MAX_ENCHANT ? 'MAX' : `✦ ${cost} · %${Math.round(enchantChance(c.enchant) * 100)}`, '', c.enchant < MAX_ENCHANT && game.save.dust >= cost, () => {
                const r = game.enchantCrystal(c.id);
                note = r === 'ok' ? 'Başarılı!' : r === 'fail' ? 'Başarısız, toz gitti.' : '';
                renderPanel();
            }), btn('Sat', 'danger', true, () => {
                if (eq && !window.confirm(L('Bu kristal kullanımda. Yine de satılsın mı?')))
                    return;
                game.sellCrystal(c.id);
                renderPanel();
            }))));
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
        /** "vurur ⚔ · zayıf ⚔" satırı: vurduğu hasar türü ve en çok zarar gördüğü tür */
        const hitWeak = (atk, weak) => `${L('vurur')} ${ico('ui_' + atk, 14)} ${L(DTYPE_NAMES[atk])} · ${L('zayıf')} ${ico('ui_' + weak, 14)} ${L(DTYPE_NAMES[weak])}`;
        const bossInfo = (reg) => {
            const e = ENEMIES[game.bossKind(reg)];
            const w = DTYPES.reduce((b, t) => (e.resist[t] > e.resist[b] ? t : b), DTYPES[0]);
            return hitWeak(e.atk, w);
        };
        const grid = document.createElement('div');
        grid.className = 'cards';
        const card = (img, name, info, known) => {
            const d = document.createElement('div');
            d.className = 'card' + (known ? '' : ' unknown');
            d.innerHTML = `<img src="assets/${img}.png" alt="" onerror="this.style.visibility='hidden'"><div class="cname">${known ? N(name) : '???'}</div><div class="cinfo">${known ? info : L('Henüz karşılaşmadın')}</div>`;
            return d;
        };
        grid.append(card('card_tiger', 'Beyaz Kaplan', `${ico('ui_power', 14)} Güç ${fmt(game.tigerPower())} · ${L('Seviye')} ${game.save.tiger.level}`, true));
        grid.append(card('card_witch', 'Cadı Çırağı', `${ico('ui_power', 14)} Güç ${fmt(game.power())} · ${ico('ui_heart', 14)} ${fmt(game.maxHp())}`, true));
        for (const id of ['ghost', 'mushroom', 'pumpkin', 'bat', 'scorpion', 'golem', 'wisp', 'snake']) {
            const e = ENEMIES[id];
            const w = DTYPES.reduce((b, t) => (e.resist[t] > e.resist[b] ? t : b), DTYPES[0]);
            grid.append(card('card_' + id, e.name, hitWeak(e.atk, w), !!game.save.seen[id]));
        }
        const bossCard = ['card_boss_owl', 'card_boss_swamp', 'card_boss_frost', 'card_boss_desert', 'card_boss_crystal', 'card_boss_volcano', 'card_boss_sky', 'card_boss_shadow'];
        ZONES.slice(0, 8).forEach((z, i) => grid.append(card(bossCard[i], N(z.bossName), `${L(TIERS.boss.name)} · ${N(z.name)}<br>${bossInfo(i)}`, Object.keys(game.save.seen).some((k) => k.endsWith('_boss' + i) && game.save.seen[k]))));
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
        panel.append(seg('Yönlendirme okları', 'ui_map', [['Açık', true], ['Kapalı', false]], settings.guide, (v) => { settings.guide = v; }));
        panel.append(seg('Yardımcı kaplan', 'icon_fang', [['Açık', true], ['Kapalı', false]], settings.companion, (v) => { const r = game.setCompanion(v); settingsNote = r === 'ok' ? '' : L(r); }));
        if (game.save.archer)
            panel.append(seg('Okçu (arbalet)', 'icon_wand', [['Açık', true], ['Kapalı', false]], settings.archer, (v) => { settings.archer = v; }));
        const hint = document.createElement('div');
        hint.className = 'row';
        hint.innerHTML = `<small>${L('Titreşim yalnızca destekleyen cihazlarda çalışır.')}${settingsNote ? '<br><b>' + settingsNote + '</b>' : ''}</small>`;
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
        const fb = document.createElement('div');
        fb.className = 'row';
        fb.append(btn('Oyun özetini kopyala (geri bildirim için)', '', true, () => { void navigator.clipboard?.writeText(game.feedbackSummary()); fb.append(' ✓'); }));
        panel.append(fb);
        const foot = document.createElement('div');
        foot.className = 'row';
        foot.append(btn('Ana menü', '', true, () => { open = null; renderPanel(); showLanding(); }), btn('Oyuna dön', '', true, () => { open = null; renderPanel(); }));
        panel.append(foot);
        const ver = document.createElement('div');
        ver.className = 'row';
        ver.innerHTML = `<small>Hexling · ${L('Sürüm')} ${VERSION} (${CODENAME}) · ${L('Yapım')} ${BUILD}</small>`;
        panel.append(ver);
    }
    else if (open === 'shop') {
        setPanelTitle('Güç Paketleri', 'ui_power');
        const info = document.createElement('div');
        info.className = 'row';
        info.innerHTML = `<small>${L('Güç paketleri kalıcıdır ve toplanır; ücretsiz ilerlemeyi etkilemez.')} ${L('Şu anki çarpan')}: <b>×${game.shopMul().toFixed(2)}</b></small>`;
        panel.append(info);
        const msg = document.createElement('div');
        msg.className = 'row';
        msg.innerHTML = `<small id="shop-msg">${TESTING ? L('TEST: satın alma 3 sn test reklamıyla yapılır') : billing.kind === 'none' ? L('Mağaza yalnızca mobil uygulamada kullanılabilir.') : billing.kind === 'dev' ? 'GELİŞTİRME MODU: sahte satın alma' : ''}</small>`;
        panel.append(msg);
        // yeniden doğuş: paket almadan devam yolu (seviye sıfırlanır, güç korunur); her sıfırlama mağazadan satın alınır
        const rh = document.createElement('h3');
        rh.textContent = L('Paket almadan devam: Yeniden doğuş');
        panel.append(rh);
        const rbOk = game.canRebirth() && (billing.kind !== 'none' || TESTING);
        panel.append(row(ico('ui_soul', 36), `${L('Yeniden doğuş')} (${game.rebirthCount()})`, `${L('Seviyen 1\'e döner, gücün korunur; adaları baştan yaparak gücün yine artar.')}${Math.max(game.bossesDown(), game.region + 1) < Game.REBIRTH_FROM ? ' · ' + L('40. seviyeye ulaşmalısın') : ''}`, btn(shopPrices[REBIRTH.id] ?? REBIRTH.fallbackPrice, 'danger', rbOk, async () => {
            if (!confirm(L('Seviyen 1\'e döner, gücün korunur. Her yeniden doğuş satın alınır. Devam edilsin mi?')))
                return;
            const r = await buy(REBIRTH.id);
            const mm = document.getElementById('shop-msg');
            if (!r.ok && mm)
                mm.textContent = r.error ?? '';
            if (r.ok)
                open = null;
            renderPanel();
        })));
        // devam paketleri: 40. adadan sonrasını açar (kalıcı, bir kez alınır)
        const lh = document.createElement('h3');
        lh.textContent = L('Devam paketleri (40. adadan sonra)');
        panel.append(lh);
        const capInfo = document.createElement('div');
        capInfo.className = 'row';
        capInfo.innerHTML = `<small>${L('Açık ada sayısı')}: <b>${game.levelCap()}/${ZONES.length}</b></small>`;
        panel.append(capInfo);
        for (const p of LEVEL_PACKS) {
            const owned = !!game.save.lvPacks[p.id];
            const price = shopPrices[p.id] ?? p.fallbackPrice;
            panel.append(row(ico('ui_skill', 36), p.name, owned ? L('Alındı') : `+${p.levels} ${L('ada')}`, btn(owned ? '✓' : price, '', !owned && (billing.kind !== 'none' || TESTING), async () => {
                const r = await buy(p.id);
                const m = document.getElementById('shop-msg');
                if (!r.ok && m)
                    m.textContent = r.error ?? '';
                renderPanel();
            })));
        }
        const ah = document.createElement('h3');
        ah.textContent = L('Özel');
        panel.append(ah);
        const archerOwned = !!game.save.archer;
        panel.append(row(ico('icon_wand', 36), L('Okçu (arbalet)'), archerOwned ? L('Alındı: ayarlardan açılıp kapatılır') : L('Sağ alttaki 🏹 ile seç, basılı tutup nişan al: seri ok. 3 isabet kara deliği 30 sn dondurur'), btn(archerOwned ? '✓' : (shopPrices[ARCHER.id] ?? ARCHER.fallbackPrice), '', !archerOwned && (billing.kind !== 'none' || TESTING), async () => {
            const r = await buy(ARCHER.id);
            const m = document.getElementById('shop-msg');
            if (!r.ok && m)
                m.textContent = r.error ?? '';
            renderPanel();
        })));
        const ph = document.createElement('h3');
        ph.textContent = L('Güç paketleri');
        panel.append(ph);
        for (const p of PACKS) {
            const have = game.save.shop[p.id] ?? 0;
            const price = shopPrices[p.id] ?? p.fallbackPrice;
            panel.append(row(ico('ui_power', 36), `${p.name}${have ? ' ×' + have : ''}`, `${L('Gücü ×')}${p.mul} ${L('artırır')}`, btn(price, '', billing.kind !== 'none' || TESTING, async () => {
                const r = await buy(p.id);
                const m = document.getElementById('shop-msg');
                if (!r.ok && m)
                    m.textContent = r.error ?? '';
                renderPanel();
            })));
        }
        // ücretsiz ödüller: ödüllü reklam izleyerek eşya edin
        if (ads.kind !== 'none') {
            const h = document.createElement('h3');
            h.textContent = L('Ücretsiz ödüller (reklam)');
            panel.append(h);
            const left = game.adDailyLeft();
            const rewards = [
                { kind: 'helmet', name: 'Destansı Miğfer', icon: 'icon_helmet' },
                { kind: 'shield', name: 'Destansı Kalkan', icon: 'icon_shield' },
                { kind: 'geode', name: '2 Jeod', icon: 'icon_geode' },
                { kind: 'souls', name: 'Ruh paketi', icon: 'ui_soul' },
            ];
            for (const r of rewards) {
                const wait = game.adWait(r.kind);
                const ok = left > 0 && wait === 0;
                panel.append(row(ico(r.icon, 36), r.name, wait > 0 ? `${L('Bekleme')}: ${wait} sn` : `${L('Bugün kalan')}: ${left}`, btn(ok ? 'Reklam izle' : wait > 0 ? wait + ' sn' : '—', '', ok, async () => {
                    const done = await ads.showRewarded();
                    if (done)
                        game.claimAd(r.kind);
                    renderPanel();
                })));
            }
        }
        const rb = document.createElement('div');
        rb.className = 'row';
        rb.append(btn('Satın alımları geri yükle', '', billing.kind === 'native', async () => { await billing.restore(); renderPanel(); }));
        panel.append(rb);
    }
    else if (open === 'house') {
        renderHouse();
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
        // ada geçtikçe açılan yeni oyunlar: tuvalli tam ekran; ödül kalıcı güç (aynı günlük eğitim hakkından)
        const extra = [
            { k: 'honey', reward: 'kalıcı MIKNATIS' }, { k: 'cards', reward: 'kalıcı KRİTİK' }, { k: 'broom', reward: 'kalıcı HIZ' },
        ];
        for (const x of extra) {
            const m = Game.MINIS.find((q) => q.k === x.k);
            const open2 = game.miniOpenFor(trainMaster, x.k);
            const thumb = `<img src="assets/mg_${x.k === 'honey' ? 'bee_friend' : x.k === 'cards' ? 'cardback' : 'star'}.png" width="36" height="36" alt="" style="border-radius:8px" onerror="this.outerHTML='<span style=&quot;font-size:28px&quot;>${x.k === 'honey' ? '🐝' : x.k === 'cards' ? '🃏' : '🧹'}</span>'">`;
            const sub = !open2 ? `${L('Kilitli')}: ${m.at}. ${L('adadan sonraki ustalarda açılır')}` : plays > 0 ? `${L(m.desc)} → ${L(x.reward)}` : 'Bugünlük hakkın bitti, yarın gel';
            panel.append(row(thumb, m.name, sub, btn(!open2 ? '🔒' : plays > 0 ? 'Oyna' : 'Yarın', '', open2 && plays > 0, () => {
                if (!game.startTraining(trainMaster)) {
                    renderPanel();
                    return;
                }
                game.paused = true;
                playMini(x.k, L, (r) => {
                    game.paused = false;
                    const frac = Math.min(1, r.stars / 3 + Math.min(0.15, r.score / 400));
                    game.finishTraining(trainMaster, x.k, frac);
                    showResultCard('task_train', m.name, `${r.stars}★ · ${L('skor')}: ${r.score}`);
                    renderPanel();
                });
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
        showResultCard('task_train', 'Eğitim tamam', pct >= 80 ? 'Ustan gurur duydu: harika bir ders oldu.' : pct >= 50 ? 'İyi iş çırak, ustan başını salladı.' : 'Biraz daha çalışmalısın, ama yoldasın.');
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
document.getElementById('btn-map')?.addEventListener('click', () => { open = null; renderPanel(); game.mapMode = 'world'; game.mapOpen = !game.mapOpen; });
masterBtn.addEventListener('click', () => { const m = game.nearMaster(); if (m >= 0)
    game.onMaster(m); });
// ---------------- girdi ----------------
window.addEventListener('keydown', (e) => { game.keys.add(e.key.toLowerCase()); if (e.key.toLowerCase() === 'm') {
    game.mapMode = 'world';
    game.mapOpen = !game.mapOpen;
} });
window.addEventListener('keyup', (e) => game.keys.delete(e.key.toLowerCase()));
let touchStart = null;
let joyId = -1;
let aimId = -1;
canvas.addEventListener('touchstart', (e) => {
    for (const t of Array.from(e.changedTouches)) {
        // okçu seçiliyken ekranın sağ tarafı nişan, sol tarafı yürüme çubuğudur
        if (game.archerSel && t.clientX > window.innerWidth * 0.45 && aimId < 0) {
            aimId = t.identifier;
            game.aim = { x: t.clientX, y: t.clientY };
        }
        else if (joyId < 0) {
            joyId = t.identifier;
            game.joy = { ox: t.clientX, oy: t.clientY, x: t.clientX, y: t.clientY };
            touchStart = { t: performance.now(), x: t.clientX, y: t.clientY };
        }
    }
    e.preventDefault();
}, { passive: false });
canvas.addEventListener('touchmove', (e) => {
    for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === aimId && game.aim) {
            game.aim.x = t.clientX;
            game.aim.y = t.clientY;
        }
        else if (t.identifier === joyId && game.joy) {
            game.joy.x = t.clientX;
            game.joy.y = t.clientY;
        }
    }
    e.preventDefault();
}, { passive: false });
const endTouch = (e) => {
    const ended = e ? Array.from(e.changedTouches) : [];
    if (!e || ended.some((t) => t.identifier === aimId)) {
        aimId = -1;
        game.aimFire();
    }
    if (!e || ended.some((t) => t.identifier === joyId)) {
        joyId = -1;
        game.joy = null;
        if (e && touchStart) {
            const t = ended.find((x) => x.identifier !== aimId) ?? ended[0];
            if (t && performance.now() - touchStart.t < 280 && Math.hypot(t.clientX - touchStart.x, t.clientY - touchStart.y) < 14)
                game.handleTap(t.clientX, t.clientY);
        }
        touchStart = null;
    }
};
canvas.addEventListener('touchend', endTouch);
canvas.addEventListener('touchcancel', () => endTouch());
canvas.addEventListener('mousedown', (e) => {
    if (game.archerSel)
        game.aim = { x: e.clientX, y: e.clientY };
    else
        game.joy = { ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
});
canvas.addEventListener('click', (e) => { game.handleTap(e.clientX, e.clientY); });
window.addEventListener('mousemove', (e) => {
    if (game.aim) {
        game.aim.x = e.clientX;
        game.aim.y = e.clientY;
    }
    if (game.joy) {
        game.joy.x = e.clientX;
        game.joy.y = e.clientY;
    }
});
window.addEventListener('mouseup', () => { game.joy = null; game.aimFire(); });
window.addEventListener('beforeunload', () => game.persist());
document.addEventListener('visibilitychange', () => { if (document.hidden)
    game.persist(); });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
// telefonda çevrimdışı çalışsın (?nosw=1 ile kapatılır)
if ('serviceWorker' in navigator && !location.search.includes('nosw') && !window.Capacitor) {
    navigator.serviceWorker.register('sw.js').catch((e) => console.error('service worker kaydedilemedi', e));
    // yeni sürüm etkinleşince açılış sayfasındaysak sayfa yenilenir (önbellekteki eski sürümde kalınmasın); oyundaysak sonraki açılışta yenilenir
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController || reloaded)
            return;
        if (landingOpen) {
            reloaded = true;
            location.reload();
        }
        else
            pendingReload = true;
    });
}
let pendingReload = false;
// test/denetim kancası: panel doğrudan açılır (tools/audit_yazi.mjs)
window.__open = (p, tab) => { open = p; if (tab)
    houseTab = tab; renderPanel(); };
// web'de yeni sürüm kontrolü: sunucudaki sürüm farklıysa "Güncelle" çubuğu çıkar; servis çalışanı ve önbellek temizlenip sayfa yenilenir (telefonda eski sürümde kalınmasın)
if (!['localhost', '127.0.0.1'].includes(location.hostname) && !window.Capacitor) {
    fetch('dist/version.js?c=' + Date.now(), { cache: 'no-store' })
        .then((r) => r.text())
        .then((t) => {
        const m = /VERSION = '([^']+)'/.exec(t);
        if (!m || m[1] === VERSION)
            return;
        const bar = document.createElement('div');
        bar.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:500;background:#d9822b;color:#2a1200;font:700 14px system-ui;padding:10px 12px;display:flex;gap:10px;align-items:center;justify-content:center';
        bar.textContent = L('Yeni sürüm var') + ': ' + m[1];
        const go = document.createElement('button');
        go.textContent = L('Güncelle');
        go.style.cssText = 'padding:6px 12px;border-radius:8px;border:0;font:800 14px system-ui;background:#2a1200;color:#ffe9a0';
        go.addEventListener('click', async () => {
            try {
                for (const r of await navigator.serviceWorker.getRegistrations())
                    await r.unregister();
                for (const k of await caches.keys())
                    await caches.delete(k);
            }
            catch (e) {
                console.error('önbellek temizlenemedi', e);
            }
            location.reload();
        });
        bar.append(go);
        document.body.append(bar);
    })
        .catch((e) => console.error('sürüm kontrolü yapılamadı', e));
}
// maden bulunduysa Godot dosyaları arka planda ısıtılır: madene girişte beklemeden açılsın
setTimeout(() => {
    if (game.save.mines.length && !location.search.includes('nosw')) {
        fetch('mine/index.pck').catch(() => undefined);
        fetch('mine/index.wasm').catch(() => undefined);
    }
}, 5000);
// yapılabilecek geliştirme varsa ilgili düğme parlar, "Buraya tıkla!" balonu zıplar (oyun kesilmez, dokunma engellenmez)
const hintTip = document.getElementById('hint-tip');
const hintBtns = [['btn-tree', 'tree'], ['btn-weapons', 'weapons'], ['btn-gear', 'gear'], ['btn-crystals', 'crystals']];
let hintAt = 0;
for (const [id] of hintBtns)
    document.getElementById(id)?.addEventListener('click', () => { game.save.first['hintTip'] = 1; });
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
    if (first && !open && !game.save.first['hintTip']) { // "Buraya tıkla!" balonu yalnızca ilk tıklamaya kadar görünür; sonra düğmenin yanıp sönmesi yeterli
        const r = first.getBoundingClientRect();
        hintTip.style.display = 'block';
        const tw = hintTip.offsetWidth || 100;
        const cxTip = Math.max(tw / 2 + 6, Math.min(window.innerWidth - tw / 2 - 6, r.left + r.width / 2)); // balon ekranın dışına taşmaz
        hintTip.style.left = cxTip + 'px';
        hintTip.style.top = r.top - 34 + 'px';
    }
    else
        hintTip.style.display = 'none';
}
let last = performance.now();
function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!fight.active) {
        game.update(dt);
        game.render();
    }
    updateHints(now);
    masterBtn.style.display = !open && game.nearMaster() >= 0 && !game.mapOpen && mini.style.display !== 'flex' ? 'flex' : 'none';
    spellBtn.style.display = game.save.spellOn && game.spellStock() > 0 && !open && !landingOpen && !game.mapOpen && !fight.active && !game.paused ? 'flex' : 'none';
    spellBtn.querySelector('span').textContent = String(game.spellStock());
    archerBtn.style.display = game.archerOn() && !open && !landingOpen && !game.mapOpen && !fight.active ? 'flex' : 'none';
    archerBtn.classList.toggle('sel', game.archerSel);
    requestAnimationFrame(frame);
}
// ---------------- mağaza ----------------
const ads = createAds();
const billing = createBilling((id, receipt) => { game.grantPurchase(id, receipt); renderPanel(); });
/** test aşaması (ads.TESTING): mağaza yok ya da çalışmıyor; 3 sn test reklamı izlenince ürün verilir. Yayın öncesi TESTING=false yapılır */
async function buy(id) {
    if (TESTING) {
        const done = await testRewarded();
        if (!done)
            return { ok: false, error: 'İptal edildi.' };
        game.grantPurchase(id, 'test');
        return { ok: true };
    }
    const r = await billing.purchase(id);
    if (r.ok && billing.kind === 'dev')
        game.grantPurchase(id, r.receipt ?? 'dev');
    return r;
}
// son düello: street fighter tarzı ayrı dövüş oyunu
const fight = new FightGame((n) => game.spr(n), () => ZONES[ZONES.length - 1].bg, () => game.save.hero.name);
game.onDuel = () => {
    if (fight.active || landingOpen || open)
        return;
    fight.start((won) => { game.finishDuel(won); renderPanel(); });
};
// kara delik yuttu: reklam izleyip kurtar ya da adaya baştan başla
game.onHoleTrap = (who) => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:250;background:rgba(10,0,25,.82);display:flex;align-items:center;justify-content:center;padding:16px';
    const box = document.createElement('div');
    box.style.cssText = 'background:#241a40;color:#fff;border:1px solid #b07cff88;border-radius:14px;padding:18px;max-width:320px;text-align:center;font:15px sans-serif';
    box.innerHTML = `<div style="font-size:42px">🕳️</div><b>${L('Kara delik seni yuttu!')}</b><p>${L('%2 can kaybettin. Ne yapmak istersin?')}</p>`;
    const mk = (label, bg, fn, off = false) => {
        const b = document.createElement('button');
        b.textContent = L(label);
        b.disabled = off;
        b.style.cssText = `display:block;width:100%;margin-top:10px;padding:12px;border-radius:9px;border:0;font:bold 15px sans-serif;color:#fff;background:${off ? '#555' : bg}`;
        b.addEventListener('click', fn);
        return b;
    };
    const close = () => { wrap.remove(); renderPanel(); };
    box.append(mk('Reklam izle ve kurtar', '#d9822b', async () => {
        close(); // modal hemen kapanır; reklam izlenir, bitince kurtarılır (izlenmezse seçenekler yeniden açılır)
        const ok = await (ads.kind === 'none' ? testRewarded() : ads.showRewarded());
        if (ok)
            game.holeRescue();
        else
            game.onHoleTrap('hero');
    }), mk('Adaya baştan başla', '#6a3fc4', () => { game.holeRestart(); close(); }));
    wrap.append(box);
    document.body.append(wrap);
};
game.onPaywall = () => { if (!fight.active && !landingOpen) {
    open = 'shop';
    renderPanel();
} };
/**
 * Godot maden oyunu (godot_mine/ projesi, web'e tek iş parçacıklı aktarılmış mine/index.html) tam ekran iframe ile açılır.
 * Oyun hazır olunca 'mine-ready', bitince 'mine-result' mesajı gönderir; 45 sn içinde hazır olmazsa (çevrimdışı, WebGL yok) yedek çalışır.
 */
function playMineGodot(reg, after, fallback, auto = false) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:260;background:#000;color:#fff;font:600 16px system-ui';
    const seed = (reg + 1) * 1000 + Math.floor(Math.random() * 900) + 1;
    const ifr = document.createElement('iframe');
    ifr.src = `mine/index.html?seed=${seed}&lang=${settings.lang}${location.search.includes("mine_test") ? "&auto=1&quota=0" : ""}${auto ? "&bot=1" : ""}`; // mine_test: otomatik oynatma (yalnız test)
    ifr.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;background:#000';
    ifr.allow = 'fullscreen';
    const loading = document.createElement('div');
    loading.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;font-size:18px';
    loading.textContent = L('Maden yükleniyor…');
    const quit = document.createElement('button');
    quit.textContent = '✕';
    quit.style.cssText = 'position:absolute;right:10px;top:10px;width:40px;height:40px;border-radius:50%;border:0;background:rgba(0,0,0,.55);color:#fff;font-size:20px;z-index:2';
    wrap.append(ifr, loading, quit);
    document.body.append(wrap);
    let ready = false;
    let closed = false;
    const close = () => { if (closed)
        return; closed = true; clearTimeout(timer); window.removeEventListener('message', onMsg); wrap.remove(); };
    const timer = window.setTimeout(() => { if (!ready) {
        close();
        fallback();
    } }, 45000);
    const onMsg = (e) => {
        if (e.source !== ifr.contentWindow)
            return;
        const d = e.data;
        if (d?.type === 'mine-ready') {
            ready = true;
            loading.remove();
        }
        else if (d?.type === 'mine-result') {
            close();
            after(d.result?.diamonds ?? 0, !!d.result?.potion, d.result?.reason);
        }
    };
    window.addEventListener('message', onMsg);
    quit.addEventListener('click', () => { close(); after(0, false); });
}
/** madene girerken: elle oyna ya da (ödüllü reklam izleyerek) otomatik oyna */
function askMineMode(go) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:265;background:rgba(5,10,25,.88);display:flex;align-items:center;justify-content:center;padding:16px';
    const box = document.createElement('div');
    box.style.cssText = 'background:#16233a;color:#fff;border:1px solid #8fdcff88;border-radius:14px;padding:18px;max-width:320px;width:100%;text-align:center;font:15px sans-serif';
    box.innerHTML = `<b>${L('Maden')}</b><p style="margin:8px 0 4px">${L('Madene nasıl girmek istersin?')}</p>`;
    const mk = (label, bg, fn) => {
        const b = document.createElement('button');
        b.textContent = label;
        b.style.cssText = `display:block;width:100%;margin-top:10px;padding:12px;border-radius:9px;border:0;font:bold 15px sans-serif;color:#fff;background:${bg}`;
        b.addEventListener('click', fn);
        return b;
    };
    const auto = mk('📺 ' + L('Otomatik oyna (reklam izle)'), '#d9822b', async () => {
        auto.disabled = true;
        wrap.remove(); // modal hemen kapanır; reklam izlenmezse seçenek yeniden açılır
        const ok = await (ads.kind === 'none' ? testRewarded() : ads.showRewarded());
        if (ok)
            go(true);
        else
            askMineMode(go);
    });
    box.append(mk(L('Kendim oynarım'), '#2f7fd1', () => { wrap.remove(); go(false); }), auto);
    const small = document.createElement('small');
    small.style.cssText = 'display:block;margin-top:8px;opacity:.75';
    small.textContent = L('Otomatik oynamada bot elmasları toplar ve çıkışa gider; her seferinde bir reklam izlenir.');
    box.append(small);
    wrap.append(box);
    document.body.append(wrap);
}
// elmas madeni: kaşif ilk madeni bulunca hikâye; madene girince ana oyun duraklar, maden oyunu oynanır, bitince ödül verilir
game.onMineFound = () => setTimeout(() => { if (!landingOpen && !fight.active)
    showIntro(() => undefined, MINE_FOUND); }, 1500);
game.onMine = (reg) => {
    if (fight.active || landingOpen || open)
        return;
    const enter = () => {
        game.paused = true;
        const after = (d, p, reason) => {
            const r = game.finishMine(reg, d, p);
            const wrap = document.createElement('div');
            wrap.style.cssText = 'position:fixed;inset:0;z-index:270;background:rgba(5,10,25,.88);display:flex;align-items:center;justify-content:center;padding:16px';
            const box = document.createElement('div');
            box.style.cssText = 'background:#16233a;color:#fff;border:1px solid #8fdcff88;border-radius:14px;padding:18px;max-width:320px;text-align:center;font:15px sans-serif';
            box.innerHTML = `<img src="assets/task_mine.jpg" alt="" style="width:100%;border-radius:10px;margin-bottom:8px" onerror="this.outerHTML='<div style=font-size:42px>💎</div>'"><b>${L('Maden bitti')}</b>${reason ? `<br><small>${L(reason === 'dead' ? 'Gücün tükendi' : reason === 'dark' ? 'Süre doldu' : 'Çıkışa ulaştın')}</small>` : ''}<p>${L('Elmas')}: ${r.diamonds} · ${L('Eşya')}: ${r.items} · ${L('Jeod')}: ${r.geodes}<br>${L('Canın doldu')}${r.potion ? ' · 🧪 ' + L('Güç ×10 (1 dk)') : ''}${r.power > 0 ? ' · ⚔ +' + fmt(r.power) : ''}</p>`;
            const ok = document.createElement('button');
            ok.textContent = L('Tamam');
            ok.style.cssText = 'padding:10px 28px;border-radius:8px;border:0;font:bold 15px sans-serif;background:#d9822b;color:#fff';
            ok.addEventListener('click', () => { wrap.remove(); game.paused = false; renderPanel(); });
            box.append(ok);
            wrap.append(box);
            document.body.append(wrap);
        };
        // maden: önce Godot (mine/ klasöründeki web aktarımı, iframe içinde); açılamazsa Three.js, o da olmazsa 2B yedek oyun
        const viaThree = () => {
            import('./mine3d.js').then((m) => m.playMine3d(L, (r) => after(r.diamonds, r.potion))).catch((e) => { console.error('3B maden açılamadı, 2B oyun', e); playMine(L, after); });
        };
        // oyuncu kendisi oynar ya da (reklam izleyerek) botun oynamasını seçer
        askMineMode((auto) => playMineGodot(reg, after, viaThree, auto));
    };
    if (!game.save.first['mineIn']) {
        game.save.first['mineIn'] = 1;
        showIntro(enter, MINE_ENTER);
    }
    else
        enter();
};
let shopPrices = {};
billing.prices().then((p) => { shopPrices = TESTING ? Object.fromEntries([...PACKS, ...LEVEL_PACKS, ARCHER, REBIRTH, SPELL].map((x) => [x.id, 'TEST'])) : p; if (open === 'shop')
    renderPanel(); }).catch((e) => console.error('fiyatlar alınamadı', e));
/** hikâye ara sahnesi: tam ekran, yavaş yakınlaşan illüstrasyon + yazı (dokununca kapanır) */
function showScene(i) {
    if (!hasScene(i))
        return;
    const pg = pageFor(i);
    const wrap = document.createElement('div');
    wrap.className = 'scene-ov';
    wrap.innerHTML = `<div class="scene-img"><img src="assets/story_${i}.jpg" alt="" onerror="this.parentElement.style.display='none'"></div><div class="scene-txt"><b>${L(pg.title)}</b><p>${pg.text}</p><small>${L('Devam etmek için dokun')}</small></div>`;
    wrap.addEventListener('click', () => { wrap.classList.add('out'); setTimeout(() => wrap.remove(), 500); game.paused = false; });
    document.body.append(wrap);
    game.paused = true;
}
game.onStory = (i) => setTimeout(() => showScene(i), 1800);
/** rakip cadının kışkırtma mesajı: güzel arka plan + cadı portresi (assets/rival_<ton>.jpg); hikâye sahnesi kapandıktan sonra, dokununca kapanır.
 *  büyü varsa (curse) ikinci bir sahne (story_curse) ve ardından gücün 1 dk alınması gösterilir. */
function showProvoke(title, text, tone, curse) {
    if (document.querySelector('.scene-ov') || document.querySelector('.provoke-ov')) {
        setTimeout(() => showProvoke(title, text, tone, curse), 2500);
        return;
    }
    const wrap = document.createElement('div');
    wrap.className = 'provoke-ov';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:240;background:radial-gradient(circle at 50% 30%,#1b3a26,#050a07);display:flex;align-items:center;justify-content:center;padding:12px';
    let stage = 0;
    const render = () => {
        const cursing = stage === 1 && !!curse;
        const img = cursing ? 'assets/story_curse.jpg' : `assets/rival_${tone}.jpg`;
        const body = cursing ? curse : text;
        // yatay ekranda görsel solda, metin sağda (yüz metinle örtülmesin); dikey ekranda görsel üstte, metin altta
        const land = window.innerWidth > window.innerHeight;
        const pos = cursing ? 'center' : 'top';
        wrap.innerHTML = `<div style="display:flex;flex-direction:${land ? 'row' : 'column'};width:min(94vw,${land ? 760 : 420}px);height:min(92vh,${land ? 360 : 600}px);border-radius:16px;overflow:hidden;border:2px solid #6fe06f99;box-shadow:0 0 40px #3fdc6f66;background:#07120a">`
            + `<div style="flex:${land ? '0 0 44%' : '1 1 62%'};background:#0a1a10 url(${img}) center ${pos}/cover no-repeat"></div>`
            + `<div style="flex:1 1 auto;display:flex;flex-direction:column;justify-content:center;padding:14px 16px;background:linear-gradient(${land ? '90deg' : '180deg'},rgba(5,15,8,.55),rgba(5,15,8,.97) 30%);color:#e8ffe8;text-align:center;font:15px sans-serif">`
            + `<b style="color:#9dff9d;font-size:17px">${cursing ? L('Cadının büyüsü') : L(title)}</b><p style="margin:8px 0 10px;line-height:1.35">“${L(body ?? '')}”</p>`
            + `<small style="opacity:.75">${L('Devam etmek için dokun')}</small></div></div>`;
    };
    wrap.addEventListener('click', () => {
        if (stage === 0 && curse) {
            stage = 1;
            render();
            return;
        }
        wrap.remove();
        game.paused = false;
        if (curse)
            game.applyCurse();
    });
    render();
    document.body.append(wrap);
    game.paused = true;
}
game.onProvoke = (title, text, tone, curse) => setTimeout(() => showProvoke(title, text, tone, curse), 4500);
/** yeni sistemlerin hikâye anlatımı: kazan, dev, cüce, yeniden doğuş, eski oyunların kapanışı */
/** hikâye kartları sırayla gösterilir: başlangıç ekranı, başka bir kart, düello ya da panel açıkken beklenir (üst üste binip görünmez kalmasın) */
game.onNarrate = (key) => {
    const pages = NARRATIVES[key];
    if (!pages)
        return;
    const wait = key === 'closing' ? 4500 : key === 'ending' ? 2500 : 1200;
    const tryShow = () => {
        if (landingOpen || fight.active || document.querySelector('.scene-ov, .provoke-ov') || game.mapOpen) {
            setTimeout(tryShow, 900);
            return;
        }
        showIntro(() => game.afterNarrate(key), pages);
    };
    setTimeout(tryShow, wait);
};
/** yeni oyunun açılış hikâyesi: sırayla birkaç sahne, her dokunuşta bir sonrakine geçer */
function showIntro(done, pages = INTRO) {
    let n = 0;
    const wrap = document.createElement('div');
    wrap.className = 'scene-ov';
    const render = () => {
        const pg = pages[n];
        wrap.innerHTML = `<div class="scene-img"><img src="assets/story_${pg.img}.jpg" alt="" onerror="this.parentElement.style.display='none'"></div><div class="scene-txt"><b>${L(pg.title)}</b><p>${L(pg.text)}</p><small>${L(n < pages.length - 1 ? 'Devam etmek için dokun' : 'Başlamak için dokun')}</small></div>`;
    };
    wrap.addEventListener('click', () => {
        n++;
        if (n < pages.length) {
            render();
            return;
        }
        wrap.classList.add('out');
        setTimeout(() => wrap.remove(), 500);
        game.paused = false;
        done();
    });
    render();
    document.body.append(wrap);
    game.paused = true;
}
const houseBtn = document.getElementById('btn-house');
houseBtn.addEventListener('click', () => { open = open === 'house' ? null : 'house'; renderPanel(); });
// ev düğmesindeki rozet: hazır iş ya da yeni günlük sayfası varsa; ev açıkken geri sayımlar tazelenir
const questEl = document.getElementById('quest');
questEl.addEventListener('click', () => { open = 'house'; houseTab = 'quests'; renderPanel(); });
function updateQuest() {
    if (landingOpen || open || fight.active) {
        questEl.style.display = 'none';
        return;
    }
    const tu = game.tutorial();
    let text;
    if (tu.step)
        text = `📜 ${L(tu.step.text)}${tu.step.progress ? ' ' + tu.step.progress(game.save) : ''}`;
    else {
        const g = game.save.daily.goals;
        const done = g.filter((x) => x.have >= x.need).length;
        const unclaimed = g.filter((x) => x.have >= x.need && !x.claimed).length;
        if (g.every((x) => x.claimed)) {
            questEl.style.display = 'none';
            return;
        } // hepsi bitti ve ödülleri alındı: ipucu gizlenir
        text = `📅 ${L('Günlük görevler')} ${done}/${g.length}${unclaimed ? ' · ' + L('ödül hazır') : ''}`;
    }
    questEl.textContent = text;
    questEl.style.display = 'block';
}
setInterval(() => {
    updateQuest();
    const ready = game.houseTasks().some((t) => t.ready && t.id !== 'soup') || game.save.bossDown.filter(Boolean).length > game.save.storyRead || game.save.daily.goals.some((g) => g.have >= g.need && !g.claimed); // kırmızı nokta yalnızca bir iş hazırsa, yeni günlük sayfası ya da alınacak görev ödülü varsa
    houseBtn.dataset.badge = ready ? '1' : '0';
    if (open === 'house' && (houseTab === 'home' || houseTab === 'explorer'))
        renderPanel();
}, 1000);
document.getElementById('btn-shop')?.addEventListener('click', () => { open = open === 'shop' ? null : 'shop'; renderPanel(); });
// ---------------- iksir kazanı ----------------
const BREW_ING = [
    { id: 'dev', icon: '🍄', name: 'Dev Mantarı', tilt: 2, spark: 0, hint: 'Devleştirir' },
    { id: 'cuce', icon: '🌸', name: 'Cüce Çiçeği', tilt: -2, spark: 0, hint: 'Cüceleştirir' },
    { id: 'ay', icon: '💧', name: 'Ay Suyu', tilt: 0, spark: 0, hint: 'Dengeler (eğilimi sıfıra çeker)' },
    { id: 'kivilcim', icon: '✨', name: 'Kıvılcım', tilt: 0, spark: 1, hint: 'Karıştırma alanını genişletir' },
];
const brewUI = { n: 0, sum: 0, sparks: 0, stage: 'pick', msg: '' };
let brewRaf = 0;
function renderBrew() {
    cancelAnimationFrame(brewRaf);
    if (!game.save.first['narbrew']) {
        game.save.first['narbrew'] = 1;
        showIntro(() => renderPanel(), NARRATIVES.brew);
    }
    const wait = game.brewReadyInMs();
    const info = document.createElement('div');
    info.className = 'row';
    info.innerHTML = `<small><b>🍄 ${L('Dev iksiri')}:</b> ${L('Boyut ×3 · Güç ×3 · Hız −%25')}<br>${L('Kaplan: boyut ×4 · güç ×4 · hız ×1,5')}<br>`
        + `<b>🌸 ${L('Cüce iksiri')}:</b> ${L('Boyut −%25 · Güç −%25 · Hız ×2')}<br>${L('Kaplan: boyut −%50 · güç aynı')}<br>`
        + `${L('Cüce olunca fark edilmezsin, +%25 ganimet, can yenilenir, +%15 kritik. Ama cüceden sonraki adada dev olmak zorundasın.')}</small>`;
    panel.append(info);
    const info2 = document.createElement('div');
    info2.className = 'row';
    info2.innerHTML = `<small>${L('En fazla 8 malzeme ekle, sonra karıştır. Dev Mantarı seni dev, Cüce Çiçeği cüce yapar; eşit karışım dengeli bırakır.')} ${game.oldGamesClosed() ? L('Artık tek mini oyun bu.') : ''}</small>`;
    panel.append(info2);
    // özel büyü: hazırlama ve satın alma
    const sh = document.createElement('h3');
    sh.textContent = L('Özel büyü');
    panel.append(sh);
    if (!game.save.spellOn) {
        panel.append(row(emoji('🌟', 'explorer'), L('Özel büyü'), `${L('İlk arı sürüsünden önceki seviyede açılır')}: ${game.spellUnlockReg() + 1}. ${L('seviye')}`, null));
    }
    else {
        const c = game.spellCost();
        const have = (a, b) => `<span style="color:${a >= b ? '#7bff9a' : '#ff8a8a'}">${fmt(a)}/${fmt(b)}</span>`;
        panel.append(row(emoji('🌟', 'explorer'), `${L('Özel büyü')} ×${game.spellStock()}`, `${L('Adanın %80\'ini temizler, boss ve canavarların gücünü %80 düşürür; maden hariç her an kullanılır.')}<br>${L('Bileşenler')}: 💎 ${have(game.save.geodes, c.geodes)} · ✦ ${have(Math.floor(game.save.dust), c.dust)} · 🔮 ${have(Math.floor(game.save.essence), c.essence)}`, btns(btn('Hazırla', '', game.spellCanCraft(), () => { game.craftSpell(); renderPanel(); }), btn(`${L('Satın al')} ${shopPrices[SPELL.id] ?? SPELL.fallbackPrice}`, '', billing.kind !== 'none' || TESTING, async () => { const r = await buy(SPELL.id); if (!r.ok && r.error)
            game.banner = r.error; renderPanel(); }))));
    }
    if (game.brewT > 0) {
        const kind = game.brewKind === 'giant' ? L('Dev') : game.brewKind === 'dwarf' ? L('Cüce') : L('Dengeli');
        panel.append(row(emoji('🧪', 'explorer'), `${L('Etki')}: ${kind}`, `${Math.ceil(game.brewT)} ${L('sn kaldı')}`, null));
    }
    if (brewUI.stage === 'done') {
        if (game.brewKind !== 'balanced') {
            const ban = document.createElement('div');
            ban.className = 'banner';
            ban.style.height = '170px';
            ban.innerHTML = `<img src="assets/story_${game.brewKind === 'giant' ? 'giant' : 'dwarf'}.jpg" alt="" onerror="this.parentElement.style.display='none'">`;
            panel.append(ban);
        }
        panel.append(row(emoji('⚗️', 'explorer'), L('İksir hazır'), brewUI.msg, btn('Yeni karışım', '', wait <= 0, () => { brewUI.n = 0; brewUI.sum = 0; brewUI.sparks = 0; brewUI.stage = 'pick'; brewUI.msg = ''; renderPanel(); })));
        if (wait > 0) {
            const w = document.createElement('div');
            w.className = 'row';
            w.innerHTML = `<small>${L('Yeni iksir için bekle')}: ${Math.ceil(wait / 1000)} ${L('sn')}</small>`;
            panel.append(w);
        }
        return;
    }
    if (wait > 0) {
        const w = document.createElement('div');
        w.className = 'row';
        w.innerHTML = `<small>${L('Kazan dinleniyor')}: ${Math.ceil(wait / 1000)} ${L('sn')}</small>`;
        panel.append(w);
        return;
    }
    // eğilim göstergesi: cüce ◀ ● ▶ dev
    const pos = Math.max(0, Math.min(1, (brewUI.sum + 12) / 24));
    const gauge = document.createElement('div');
    gauge.className = 'row';
    gauge.innerHTML = `<div style="width:100%"><div style="display:flex;justify-content:space-between;font-size:12px"><span>🌸 ${L('Cüce')}</span><span>⚖️</span><span>${L('Dev')} 🍄</span></div>`
        + `<div style="position:relative;height:14px;border-radius:7px;background:linear-gradient(90deg,#4aa8ff,#7be07b 50%,#ff9a3c)"><div style="position:absolute;top:-3px;left:calc(${(pos * 100).toFixed(1)}% - 10px);width:20px;height:20px;border-radius:50%;background:#fff;border:2px solid #000"></div></div>`
        + `<small>${L('Malzeme')}: ${brewUI.n}/8 · ${L('Kıvılcım')}: ${brewUI.sparks}</small></div>`;
    panel.append(gauge);
    if (brewUI.stage === 'pick') {
        for (const ing of BREW_ING) {
            const locked = ing.id === 'cuce' && game.forcedGiant();
            panel.append(row(emoji(ing.icon, 'explorer'), L(ing.name), locked ? L('Aynanın dengesi: bu adada dev olmalısın') : L(ing.hint), btn('Ekle', '', brewUI.n < 8 && !locked, () => {
                brewUI.n++;
                if (ing.id === 'ay')
                    brewUI.sum -= Math.sign(brewUI.sum) * Math.min(Math.abs(brewUI.sum), 2);
                else
                    brewUI.sum += ing.tilt;
                brewUI.sparks += ing.spark;
                renderPanel();
            })));
        }
        const go = document.createElement('div');
        go.className = 'row';
        go.append(btn('Karıştırmaya başla', '', brewUI.n >= 3, () => { brewUI.stage = 'stir'; renderPanel(); }), btn('Boşalt', 'danger', brewUI.n > 0, () => { brewUI.n = 0; brewUI.sum = 0; brewUI.sparks = 0; renderPanel(); }));
        panel.append(go);
        return;
    }
    // karıştırma: işaretçi gidip gelir, yeşil alana denk gelince bas (kıvılcım alanı genişletir)
    const zone = Math.min(0.5, 0.22 + 0.06 * brewUI.sparks);
    const bar = document.createElement('div');
    bar.className = 'row';
    bar.innerHTML = `<div style="width:100%"><div id="stir-bar" style="position:relative;height:26px;border-radius:13px;background:#2a1f45;border:1px solid #b07cff88;overflow:hidden">`
        + `<div style="position:absolute;top:0;bottom:0;left:${((0.5 - zone / 2) * 100).toFixed(1)}%;width:${(zone * 100).toFixed(1)}%;background:rgba(123,224,123,.55)"></div>`
        + `<div id="stir-mark" style="position:absolute;top:2px;bottom:2px;width:8px;border-radius:4px;background:#fff;left:0"></div></div></div>`;
    panel.append(bar);
    const mark = bar.querySelector('#stir-mark');
    const t0 = performance.now();
    let p = 0;
    const loop = () => {
        const tt = (performance.now() - t0) / 1000;
        p = 0.5 + 0.5 * Math.sin(tt * (2.4 + 0.15 * brewUI.n));
        mark.style.left = `calc(${(p * 100).toFixed(1)}% - 4px)`;
        brewRaf = requestAnimationFrame(loop);
    };
    loop();
    panel.append(btn('Şimdi karıştır!', '', true, () => {
        cancelAnimationFrame(brewRaf);
        const q = Math.max(0.4, Math.min(1, 1 - Math.abs(p - 0.5) * 1.2 + (Math.abs(p - 0.5) <= zone / 2 ? 0.1 : 0)));
        const r = game.brew(brewUI.sum, q);
        brewUI.stage = 'done';
        brewUI.msg = r ? `${r.kind === 'giant' ? L('Dev') : r.kind === 'dwarf' ? L('Cüce') : L('Dengeli')} · ${L('kalite')} %${Math.round(q * 100)} · +${r.geodes} ${L('jeod')} · +${r.dust} ${L('toz')}` : L('Kazan hazır değil');
        renderPanel();
    }));
}
// ---------------- Şeref Salonu ----------------
/** bu cihazdaki kahramanların sıralaması: aşılan ada > güç > öldürme */
function hofList(max) {
    const wrap = document.createElement('div');
    Game.refreshHof(() => { if (open === 'hof' || open === 'stats')
        renderPanel(); }); // sunucudaki kalıcı liste gelince panel yenilenir
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
    if (pendingReload) {
        location.reload();
        return;
    }
    landing.classList.remove('hidden');
    lName.value = '';
    refreshLanding();
    renderPanel();
}
/** ilk açılışta: yardımcı kaplan kullanılsın mı? (ön tanımlı seçili; ilk seviye ücretsiz) */
function askTiger() {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:300;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center';
    const box = document.createElement('div');
    box.style.cssText = 'background:#241a40;color:#fff;border:1px solid #fff4;border-radius:14px;padding:18px;width:min(320px,88vw);text-align:center;font:15px sans-serif';
    box.innerHTML = `${ico('tiger', 72)}<div style="font-weight:700;font-size:17px;margin:6px 0">${L('Beyaz Kaplan yardımcın seninle savaşsın mı?')}</div>`
        + `<div style="font-size:13px;opacity:.85;line-height:1.4">${L('İlk seviye ücretsiz. Sonraki her seviye geçişinde Kaplan için ruh tozu')} −${LEVEL_COST}. ${L('Ruh tozu yetmezse kaplan kapatılır.')}</div>`;
    const lab = document.createElement('label');
    lab.style.cssText = 'display:flex;gap:8px;align-items:center;justify-content:center;margin:12px 0;font-weight:700';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = true;
    lab.append(cb, L('Kaplan yardımcıyı kullan'));
    const ok = document.createElement('button');
    ok.textContent = L('Tamam');
    ok.style.cssText = 'padding:10px 28px;border-radius:8px;border:0;font:bold 15px sans-serif;background:#d9822b;color:#fff';
    ok.addEventListener('click', () => { game.answerTiger(cb.checked); wrap.remove(); });
    box.append(lab, ok);
    wrap.append(box);
    document.body.append(wrap);
}
function hideLanding(intro = false) {
    landingOpen = false;
    const afterIntro = () => { if (!game.save.tiger.asked)
        setTimeout(askTiger, 300); };
    // alt barın altındaki sürekli banner (yalnızca reklam destekli ortamlarda); bar banner yüksekliği kadar yukarı kayar
    ads.showBanner((px) => document.documentElement.style.setProperty('--ad-h', px + 'px')).catch((e) => console.error('banner gösterilemedi', e));
    landing.classList.add('hidden');
    audio.start();
    audio.setMood(game.region);
    renderPanel();
    if (intro && !location.search.includes('level='))
        showIntro(afterIntro);
    else
        afterIntro();
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
    hideLanding(true);
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
