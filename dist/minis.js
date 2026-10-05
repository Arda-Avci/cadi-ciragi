const cache = new Map();
function img(name, ext = 'png') {
    let i = cache.get(name);
    if (!i) {
        i = new Image();
        i.src = `assets/${name}.${ext}`;
        cache.set(name, i);
    }
    return i.complete && i.naturalWidth > 0 ? i : null;
}
function sprite(env, name, x, y, size, o = {}, fallback = '⭐') {
    const c = env.c;
    const im = img(name);
    c.save();
    c.translate(x, y);
    if (o.rot)
        c.rotate(o.rot);
    if (o.flip)
        c.scale(o.flip, 1);
    if (o.alpha !== undefined)
        c.globalAlpha = o.alpha;
    if (im)
        c.drawImage(im, -size / 2, -size / 2, size, size);
    else if (!proc(c, name, size, env.t)) {
        c.font = `${Math.round(size * 0.8)}px sans-serif`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(fallback, 0, 0);
    }
    c.restore();
}
/** görsel yüklenmemişse tuvalle çizilen yedek sprite'lar (merkez 0,0; boy size) */
function proc(c, name, size, t) {
    const s = size / 2;
    const bee = (body, stripe, wing, face, crown) => {
        c.fillStyle = wing;
        c.globalAlpha *= 0.85;
        c.beginPath();
        c.ellipse(-s * 0.15, -s * 0.55, s * 0.32, s * 0.5 + Math.sin(t * 40) * s * 0.06, -0.5, 0, Math.PI * 2);
        c.fill();
        c.beginPath();
        c.ellipse(s * 0.3, -s * 0.55, s * 0.32, s * 0.5 + Math.cos(t * 40) * s * 0.06, 0.5, 0, Math.PI * 2);
        c.fill();
        c.globalAlpha /= 0.85;
        c.fillStyle = body;
        c.strokeStyle = '#2a1a05';
        c.lineWidth = 2.5;
        c.beginPath();
        c.ellipse(0, 0, s * 0.7, s * 0.52, 0, 0, Math.PI * 2);
        c.fill();
        c.stroke();
        c.save();
        c.clip();
        c.fillStyle = stripe;
        c.fillRect(-s * 0.35, -s, s * 0.2, s * 2);
        c.fillRect(s * 0.05, -s, s * 0.2, s * 2);
        c.restore();
        c.fillStyle = '#2a1a05';
        c.beginPath();
        c.moveTo(-s * 0.7, 0);
        c.lineTo(-s * 1.0, s * 0.1);
        c.lineTo(-s * 0.7, s * 0.14);
        c.fill();
        c.fillStyle = '#fff';
        c.beginPath();
        c.arc(s * 0.42, -s * 0.12, s * 0.15, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = face;
        c.beginPath();
        c.arc(s * 0.45, -s * 0.12, s * 0.07, 0, Math.PI * 2);
        c.fill();
        if (crown) {
            c.fillStyle = '#ffd86b';
            c.beginPath();
            c.moveTo(s * 0.1, -s * 0.5);
            c.lineTo(s * 0.18, -s * 0.78);
            c.lineTo(s * 0.32, -s * 0.55);
            c.lineTo(s * 0.46, -s * 0.78);
            c.lineTo(s * 0.52, -s * 0.5);
            c.closePath();
            c.fill();
        }
    };
    if (name === 'mg_bee_friend') {
        bee('#ffc83a', '#3a2408', 'rgba(220,240,255,.8)', '#222', false);
        return true;
    }
    if (name === 'mg_bee_gold') {
        const g = c.createRadialGradient(0, 0, 2, 0, 0, s * 1.3);
        g.addColorStop(0, 'rgba(255,240,150,.6)');
        g.addColorStop(1, 'rgba(255,240,150,0)');
        c.fillStyle = g;
        c.fillRect(-s * 1.4, -s * 1.4, s * 2.8, s * 2.8);
        bee('#ffe270', '#a56a00', 'rgba(255,245,200,.9)', '#222', true);
        return true;
    }
    if (name === 'mg_wasp') {
        bee('#e0552e', '#1a0a05', 'rgba(255,220,220,.75)', '#a00', false);
        return true;
    }
    if (name === 'mg_star') {
        const g = c.createRadialGradient(0, 0, 2, 0, 0, s * 1.2);
        g.addColorStop(0, 'rgba(255,240,150,.7)');
        g.addColorStop(1, 'rgba(255,240,150,0)');
        c.fillStyle = g;
        c.fillRect(-s * 1.3, -s * 1.3, s * 2.6, s * 2.6);
        c.beginPath();
        for (let i = 0; i < 10; i++) {
            const a = -Math.PI / 2 + (i * Math.PI) / 5;
            const r = i % 2 ? s * 0.4 : s * 0.95;
            c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        c.closePath();
        c.fillStyle = '#ffd23a';
        c.fill();
        c.strokeStyle = '#b8750a';
        c.lineWidth = 3;
        c.stroke();
        return true;
    }
    if (name === 'mg_orb') {
        const g = c.createRadialGradient(-s * 0.2, -s * 0.2, 2, 0, 0, s);
        g.addColorStop(0, '#7a3ac8');
        g.addColorStop(1, '#14002a');
        c.fillStyle = g;
        c.beginPath();
        c.arc(0, 0, s * 0.85, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#d6ff6a';
        c.beginPath();
        c.ellipse(0, 0, s * 0.4, s * 0.24, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#000';
        c.beginPath();
        c.ellipse(0, 0, s * 0.1, s * 0.22, 0, 0, Math.PI * 2);
        c.fill();
        return true;
    }
    if (name === 'mg_potion') {
        c.fillStyle = '#6ad0ff';
        c.beginPath();
        c.arc(0, s * 0.2, s * 0.6, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = '#fff';
        c.lineWidth = 3;
        c.stroke();
        c.fillStyle = '#cfeeff';
        c.fillRect(-s * 0.15, -s * 0.6, s * 0.3, s * 0.5);
        c.fillStyle = '#8a5a2a';
        c.fillRect(-s * 0.2, -s * 0.8, s * 0.4, s * 0.22);
        c.fillStyle = 'rgba(255,255,255,.7)';
        c.beginPath();
        c.arc(-s * 0.2, 0, s * 0.12, 0, Math.PI * 2);
        c.fill();
        return true;
    }
    if (name === 'mg_cardback') {
        const g = c.createLinearGradient(0, -s, 0, s);
        g.addColorStop(0, '#5a2a9a');
        g.addColorStop(1, '#2a1260');
        c.fillStyle = g;
        c.beginPath();
        c.roundRect(-s * 0.85, -s, s * 1.7, s * 2, 8);
        c.fill();
        c.strokeStyle = '#ffd86b';
        c.lineWidth = 3;
        c.stroke();
        c.fillStyle = '#ffd86b';
        c.beginPath();
        c.arc(0, 0, s * 0.42, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#3a1a7a';
        c.beginPath();
        c.arc(s * 0.15, -s * 0.05, s * 0.36, 0, Math.PI * 2);
        c.fill();
        return true;
    }
    return false;
}
function cover(env, name) {
    const im = img(name, 'jpg');
    const c = env.c;
    if (!im) {
        const g = c.createLinearGradient(0, 0, 0, env.h);
        if (name === 'mg_honey_bg') {
            g.addColorStop(0, '#8fd0ff');
            g.addColorStop(0.6, '#d8f0b0');
            g.addColorStop(1, '#4f9a3a');
        }
        else if (name === 'mg_memory_bg') {
            g.addColorStop(0, '#2a1260');
            g.addColorStop(1, '#5a2a8a');
        }
        else {
            g.addColorStop(0, '#0a0a3a');
            g.addColorStop(0.7, '#3a2a8a');
            g.addColorStop(1, '#8a5ab0');
        }
        c.fillStyle = g;
        c.fillRect(0, 0, env.w, env.h);
        if (name === 'mg_stars_bg') {
            c.fillStyle = 'rgba(255,255,255,.8)';
            for (let i = 0; i < 60; i++)
                c.fillRect((i * 97) % env.w, (i * 211) % env.h, 2, 2);
            c.fillStyle = 'rgba(255,240,200,.9)';
            c.beginPath();
            c.arc(env.w * 0.78, env.h * 0.14, 38, 0, Math.PI * 2);
            c.fill();
        }
        if (name === 'mg_honey_bg') {
            c.fillStyle = 'rgba(70,140,50,.8)';
            c.beginPath();
            c.ellipse(env.w * 0.3, env.h, env.w * 0.7, env.h * 0.18, 0, Math.PI, 0);
            c.fill();
        }
        return;
    }
    const k = Math.max(env.w / im.naturalWidth, env.h / im.naturalHeight);
    const w = im.naturalWidth * k;
    const h = im.naturalHeight * k;
    c.drawImage(im, (env.w - w) / 2, (env.h - h) / 2, w, h);
}
function text(env, s, x, y, size, color = '#fff', align = 'center', stroke = 'rgba(30,10,60,.9)') {
    const c = env.c;
    c.font = `800 ${size}px system-ui, sans-serif`;
    c.textAlign = align;
    c.textBaseline = 'alphabetic';
    c.lineWidth = Math.max(3, size / 5);
    c.strokeStyle = stroke;
    c.lineJoin = 'round';
    c.strokeText(s, x, y);
    c.fillStyle = color;
    c.fillText(s, x, y);
}
function floaters(env, list, dt) {
    for (const f of list) {
        f.t -= dt;
        f.y -= 40 * dt;
    }
    for (let i = list.length - 1; i >= 0; i--)
        if (list[i].t <= 0)
            list.splice(i, 1);
    for (const f of list) {
        env.c.globalAlpha = Math.min(1, f.t * 2);
        text(env, f.s, f.x, f.y, 24, f.col);
    }
    env.c.globalAlpha = 1;
}
// ---------------- Bal Avı ----------------
function honey() {
    const fl = [];
    const fx = [];
    let score = 0;
    let spawn = 0;
    let flash = 0;
    let time = 0;
    return {
        title: 'Bal Avı', rules: 'Altın arılara dokun, kızıl yabanarılarından kaç!\nAltın kraliçe +5, yabanarısı −3', secs: 30,
        update(dt, env) {
            time += dt;
            flash = Math.max(0, flash - dt);
            spawn -= dt;
            if (spawn <= 0) {
                spawn = Math.max(0.26, 0.5 - time * 0.008);
                const r = Math.random();
                const kind = r < 0.66 ? 0 : r < 0.88 ? 1 : 2;
                const dir = Math.random() < 0.5 ? 1 : -1;
                const y0 = 130 + Math.random() * (env.h - 300);
                fl.push({ x: dir > 0 ? -50 : env.w + 50, y: y0, y0, vx: dir * (kind === 2 ? 280 : 120 + Math.random() * 110) * (1 + time * 0.012), ph: Math.random() * 6, amp: 20 + Math.random() * 55, kind, dead: 0 });
            }
            for (const f of fl) {
                if (f.dead > 0) {
                    f.dead -= dt;
                    if (f.dead <= 0)
                        f.dead = -1;
                    continue;
                }
                f.x += f.vx * dt;
                f.y = f.y0 + Math.sin(env.t * 4 + f.ph) * f.amp;
            }
            for (let i = fl.length - 1; i >= 0; i--)
                if (fl[i].x < -80 || fl[i].x > env.w + 80 || fl[i].dead === -1)
                    fl.splice(i, 1);
        },
        draw(env) {
            cover(env, 'mg_honey_bg');
            for (const f of fl) {
                if (f.dead > 0) {
                    env.c.globalAlpha = f.dead / 0.25;
                }
                const name = f.kind === 0 ? 'mg_bee_friend' : f.kind === 1 ? 'mg_wasp' : 'mg_bee_gold';
                const size = f.kind === 2 ? 92 : 72;
                if (f.kind === 2) {
                    const g = env.c.createRadialGradient(f.x, f.y, 4, f.x, f.y, 60);
                    g.addColorStop(0, 'rgba(255,230,120,.7)');
                    g.addColorStop(1, 'rgba(255,230,120,0)');
                    env.c.fillStyle = g;
                    env.c.fillRect(f.x - 60, f.y - 60, 120, 120);
                }
                sprite(env, name, f.x, f.y + (f.dead > 0 ? -20 * (1 - f.dead / 0.25) : 0), size, { flip: f.vx > 0 ? 1 : -1, rot: Math.sin(env.t * 14 + f.ph) * 0.12 }, f.kind === 1 ? '🐝' : '🐝');
                env.c.globalAlpha = 1;
            }
            floaters(env, fx, 1 / 60);
            if (flash > 0) {
                env.c.fillStyle = `rgba(255,40,40,${flash * 1.4})`;
                env.c.fillRect(0, 0, env.w, env.h);
            }
        },
        down(x, y) {
            let best = null;
            let bd = 1e9;
            for (const f of fl) {
                if (f.dead > 0)
                    continue;
                const d = Math.hypot(f.x - x, f.y - y);
                if (d < 52 && d < bd) {
                    bd = d;
                    best = f;
                }
            }
            if (!best)
                return;
            best.dead = 0.25;
            const d = best.kind === 0 ? 1 : best.kind === 2 ? 5 : -3;
            score = Math.max(0, score + d);
            fx.push({ x: best.x, y: best.y - 30, t: 0.8, s: (d > 0 ? '+' : '') + d, col: d > 0 ? '#ffe36b' : '#ff7a7a' });
            if (d < 0)
                flash = 0.35;
        },
        over: () => false,
        result: () => ({ score, stars: score >= 40 ? 3 : score >= 26 ? 2 : score >= 14 ? 1 : 0 }),
        hud: () => String(score),
    };
}
// ---------------- Büyü Kartları ----------------
function cards() {
    const faces = ['sk_hp', 'sk_dmg', 'sk_speed', 'sk_magnet', 'wp_wand', 'wp_potion', 'wp_broom', 'cr_crit'];
    const order = [...faces, ...faces];
    for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
    }
    const cs = order.map((f) => ({ f, flip: 0, up: false, done: false }));
    let first = -1;
    let second = -1;
    let wait = 0;
    let moves = 0;
    let pairs = 0;
    let started = false;
    let lastEnv = null;
    const layout = (env) => {
        const cols = 4;
        const gap = 10;
        const top = 110;
        const w = Math.min(120, (env.w - 24 - gap * (cols - 1)) / cols);
        const h = w * 1.3;
        const x0 = (env.w - (cols * w + gap * (cols - 1))) / 2;
        return cs.map((_, i) => ({ x: x0 + (i % cols) * (w + gap), y: top + Math.floor(i / cols) * (h + gap), w, h }));
    };
    return {
        title: 'Büyü Kartları', rules: 'Aynı simgeli kart çiftlerini bul.\nAz hamle = çok yıldız', secs: 60,
        update(dt) {
            for (const c of cs) {
                const tg = c.up || c.done ? 1 : 0;
                c.flip += Math.sign(tg - c.flip) * Math.min(Math.abs(tg - c.flip), dt * 5);
            }
            if (wait > 0) {
                wait -= dt;
                if (wait <= 0) {
                    if (cs[first].f === cs[second].f) {
                        cs[first].done = true;
                        cs[second].done = true;
                        pairs++;
                    }
                    else {
                        cs[first].up = false;
                        cs[second].up = false;
                    }
                    first = -1;
                    second = -1;
                }
            }
        },
        draw(env) {
            lastEnv = env;
            cover(env, 'mg_memory_bg');
            const L = layout(env);
            cs.forEach((c, i) => {
                const r = L[i];
                const sx = Math.abs(Math.cos(Math.PI * c.flip));
                const cx = r.x + r.w / 2;
                const cy = r.y + r.h / 2;
                env.c.save();
                env.c.translate(cx, cy);
                env.c.scale(Math.max(0.02, sx), 1);
                const face = c.flip > 0.5;
                env.c.fillStyle = face ? '#fdf2d3' : '#3a1f6e';
                env.c.strokeStyle = c.done ? '#7bff9a' : '#ffd86b';
                env.c.lineWidth = 3;
                env.c.beginPath();
                env.c.roundRect(-r.w / 2, -r.h / 2, r.w, r.h, 10);
                env.c.fill();
                env.c.stroke();
                env.c.restore();
                if (face) {
                    env.c.save();
                    env.c.translate(cx, cy);
                    env.c.scale(Math.max(0.02, sx), 1);
                    const im = img(c.f);
                    if (im)
                        env.c.drawImage(im, -r.w * 0.36, -r.w * 0.36, r.w * 0.72, r.w * 0.72);
                    else {
                        env.c.font = '32px sans-serif';
                        env.c.textAlign = 'center';
                        env.c.fillText('✨', 0, 8);
                    }
                    env.c.restore();
                }
                else {
                    env.c.save();
                    env.c.translate(cx, cy);
                    env.c.scale(Math.max(0.02, sx), 1);
                    const im = img('mg_cardback');
                    if (im)
                        env.c.drawImage(im, -r.w * 0.45, -r.h * 0.45, r.w * 0.9, r.h * 0.9);
                    env.c.restore();
                }
            });
            text(env, `${env.L('Hamle')}: ${moves}`, env.w / 2, 96, 20, '#e9d7ff');
        },
        down(x, y, env) {
            if (wait > 0)
                return;
            const L = layout(env);
            for (let i = 0; i < cs.length; i++) {
                const r = L[i];
                if (x < r.x || x > r.x + r.w || y < r.y || y > r.y + r.h || cs[i].up || cs[i].done)
                    continue;
                started = true;
                cs[i].up = true;
                if (first < 0)
                    first = i;
                else {
                    second = i;
                    moves++;
                    wait = 0.7;
                }
                return;
            }
        },
        over: () => pairs === 8,
        result: () => ({ score: pairs * 10 + (pairs === 8 ? Math.max(0, 40 - moves * 2) : 0), stars: pairs < 8 ? 0 : moves <= 11 ? 3 : moves <= 15 ? 2 : 1 }),
        hud: () => `${pairs}/8` + (started && lastEnv ? '' : ''),
    };
}
// ---------------- Süpürge Yarışı ----------------
function broom() {
    const items = [];
    const fx = [];
    let lane = 1;
    let px = 0;
    let score = 0;
    let hearts = 3;
    let spawn = 0;
    let flash = 0;
    let time = 0;
    let inv = 0;
    let sx0 = 0;
    const laneX = (env, l) => env.w / 2 + (l - 1) * Math.min(130, env.w * 0.3);
    return {
        title: 'Süpürge Yarışı', rules: 'Ekrana dokun ya da kaydır: süpürgeyle şeritler arasında geç.\nYıldız +1, iksir +3, lanetli küre can götürür', secs: 45,
        update(dt, env) {
            time += dt;
            flash = Math.max(0, flash - dt);
            inv = Math.max(0, inv - dt);
            if (px === 0)
                px = laneX(env, 1);
            px += (laneX(env, lane) - px) * Math.min(1, dt * 12);
            spawn -= dt;
            const speed = 240 + time * 5;
            if (spawn <= 0) {
                spawn = Math.max(0.32, 0.7 - time * 0.01);
                const r = Math.random();
                items.push({ lane: Math.floor(Math.random() * 3), y: -40, kind: r < 0.58 ? 0 : r < 0.72 ? 1 : 2 });
            }
            const py = env.h * 0.78;
            for (const it of items) {
                it.y += speed * dt;
                if (it.y > py - 40 && it.y < py + 40 && it.lane === lane) {
                    if (it.kind === 2) {
                        if (inv <= 0) {
                            hearts--;
                            inv = 1.2;
                            flash = 0.4;
                            fx.push({ x: laneX(env, lane), y: py - 60, t: 0.9, s: '−♥', col: '#ff7a7a' });
                        }
                    }
                    else {
                        const d = it.kind === 1 ? 3 : 1;
                        score += d;
                        fx.push({ x: laneX(env, lane), y: py - 60, t: 0.7, s: '+' + d, col: it.kind === 1 ? '#8fe8ff' : '#ffe36b' });
                    }
                    it.y = 1e6;
                }
            }
            for (let i = items.length - 1; i >= 0; i--)
                if (items[i].y > env.h + 60)
                    items.splice(i, 1);
        },
        draw(env) {
            cover(env, 'mg_stars_bg');
            // şerit çizgileri
            env.c.fillStyle = 'rgba(160,140,255,.08)';
            for (let l = 0; l < 3; l++)
                env.c.fillRect(laneX(env, l) - 50, 0, 100, env.h);
            for (const it of items) {
                const x = laneX(env, it.lane);
                if (it.kind === 0)
                    sprite(env, 'mg_star', x, it.y, 58, { rot: env.t * 2 }, '⭐');
                else if (it.kind === 1)
                    sprite(env, 'mg_potion', x, it.y, 62, { rot: Math.sin(env.t * 4) * 0.2 }, '🧪');
                else
                    sprite(env, 'mg_orb', x, it.y, 66, { rot: env.t }, '🔮');
            }
            const py = env.h * 0.78;
            env.c.fillStyle = 'rgba(0,0,0,.25)';
            env.c.beginPath();
            env.c.ellipse(px, py + 52, 38, 9, 0, 0, Math.PI * 2);
            env.c.fill();
            if (inv <= 0 || Math.floor(env.t * 16) % 2 === 0)
                sprite(env, 'witch_fly' + (1 + (Math.floor(env.t * 6) % 2)), px, py + Math.sin(env.t * 6) * 4, 112, {}, '🧹');
            floaters(env, fx, 1 / 60);
            text(env, '♥'.repeat(Math.max(0, hearts)), env.w / 2, 100, 26, '#ff8aa8');
            if (flash > 0) {
                env.c.fillStyle = `rgba(255,40,40,${flash * 1.2})`;
                env.c.fillRect(0, 0, env.w, env.h);
            }
        },
        down(x, _y, env) {
            sx0 = x;
            // yan yarıya dokunuş: tek şerit kaydır
            if (x < env.w * 0.4)
                lane = Math.max(0, lane - 1);
            else if (x > env.w * 0.6)
                lane = Math.min(2, lane + 1);
        },
        move(x) { if (Math.abs(x - sx0) > 60) {
            lane = Math.max(0, Math.min(2, lane + (x > sx0 ? 1 : -1)));
            sx0 = x;
        } },
        over: () => hearts <= 0,
        result: () => ({ score, stars: score >= 45 ? 3 : score >= 28 ? 2 : score >= 14 ? 1 : 0 }),
        hud: () => String(score),
    };
}
export function playMini(kind, L, done) {
    const g = kind === 'honey' ? honey() : kind === 'cards' ? cards() : broom();
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:270;background:#000;touch-action:none;user-select:none';
    const cv = document.createElement('canvas');
    cv.style.cssText = 'width:100%;height:100%;display:block';
    wrap.append(cv);
    document.body.append(wrap);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    const c = cv.getContext('2d');
    c.scale(dpr, dpr);
    const env = { c, w, h, L, t: 0 };
    for (const n of ['mg_bee_friend', 'mg_wasp', 'mg_bee_gold', 'mg_star', 'mg_orb', 'mg_potion', 'mg_cardback', 'sk_hp', 'sk_dmg', 'sk_speed', 'sk_magnet', 'wp_wand', 'wp_potion', 'wp_broom', 'cr_crit', 'witch_fly1', 'witch_fly2'])
        img(n);
    for (const n of ['mg_honey_bg', 'mg_memory_bg', 'mg_stars_bg'])
        img(n, 'jpg');
    let phase = 'intro';
    let left = g.secs;
    let last = performance.now();
    let raf = 0;
    let res = { score: 0, stars: 0 };
    let closed = false;
    const pt = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const finish = () => { if (closed)
        return; closed = true; cancelAnimationFrame(raf); wrap.remove(); done(res); };
    cv.addEventListener('pointerdown', (e) => {
        const p = pt(e);
        if (phase === 'intro') {
            phase = 'play';
            last = performance.now();
            return;
        }
        if (phase === 'end') {
            finish();
            return;
        }
        g.down(p.x, p.y, env);
    });
    cv.addEventListener('pointermove', (e) => { if (phase === 'play' && g.move && e.buttons) {
        const p = pt(e);
        g.move(p.x, p.y, env);
    } });
    const frame = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        env.t += dt;
        if (phase === 'play') {
            g.update(dt, env);
            left -= dt;
            if (left <= 0 || g.over()) {
                left = Math.max(0, left);
                phase = 'end';
                res = g.result();
            }
        }
        c.clearRect(0, 0, w, h);
        g.draw(env);
        if (phase !== 'intro') {
            text(env, `${L('Süre')}: ${Math.ceil(left)}`, 16, 44, 22, '#fff', 'left');
            text(env, `${L('Skor')}: ${g.hud()}`, w - 16, 44, 22, '#ffe36b', 'right');
            c.fillStyle = 'rgba(0,0,0,.4)';
            c.fillRect(16, 56, w - 32, 8);
            c.fillStyle = '#ffd86b';
            c.fillRect(16, 56, (w - 32) * Math.max(0, left / g.secs), 8);
        }
        if (phase === 'intro' || phase === 'end') {
            c.fillStyle = 'rgba(15,6,40,.72)';
            c.fillRect(0, 0, w, h);
            text(env, L(g.title), w / 2, h * 0.28, 38, '#ffe9a0');
            if (phase === 'intro') {
                g.rules.split('\n').forEach((ln, i) => text(env, L(ln), w / 2, h * 0.38 + i * 30, 19, '#fff'));
                text(env, L('Başlamak için dokun'), w / 2, h * 0.62 + Math.sin(env.t * 4) * 4, 24, '#9ff0ff');
            }
            else {
                const r = res;
                text(env, `${L('Skor')}: ${r.score}`, w / 2, h * 0.4, 34, '#fff');
                for (let i = 0; i < 3; i++)
                    text(env, '★', w / 2 + (i - 1) * 56, h * 0.52, 54, i < r.stars ? '#ffd86b' : '#5a4a7a');
                text(env, L(r.stars >= 3 ? 'Harika!' : r.stars >= 1 ? 'İyi iş!' : 'Biraz daha dene'), w / 2, h * 0.62, 24, '#9ff0ff');
                text(env, L('Ödülü almak için dokun'), w / 2, h * 0.72 + Math.sin(env.t * 4) * 4, 22, '#ffe9a0');
            }
        }
        if (!closed)
            raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
}
