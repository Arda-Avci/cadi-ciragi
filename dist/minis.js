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
const AW = 360;
const AH = 560;
const BR = 11;
const HR = 28;
const VMAX = 720;
const ORB_LEVELS = [
    { s: [180, 490], h: [180, 110], w: [] },
    { s: [180, 490], h: [90, 120], w: [{ x: 120, y: 270, w: 120, h: 24, k: 0 }] },
    { s: [180, 490], h: [180, 100], w: [{ x: 100, y: 300, w: 160, h: 22, k: 1 }] },
    { s: [60, 490], h: [300, 110], w: [{ x: 0, y: 300, w: 170, h: 22, k: 0 }] },
    { s: [180, 490], h: [300, 100], w: [{ x: 60, y: 250, w: 140, h: 22, k: 1 }, { x: 330, y: 200, w: 20, h: 200, k: 2 }] },
    { s: [180, 490], h: [180, 90], w: [{ x: 90, y: 200, w: 22, h: 230, k: 1 }, { x: 248, y: 200, w: 22, h: 230, k: 1 }] },
    { s: [300, 490], h: [60, 100], w: [{ x: 0, y: 330, w: 200, h: 22, k: 1 }] },
    { s: [60, 490], h: [300, 80], w: [{ x: 190, y: 260, w: 150, h: 22, k: 1 }, { x: 170, y: 380, w: 22, h: 120, k: 0 }] },
];
/** tek adım: 'run' sürer, 'in' kazana girdi, 'dead' lanetli duvara değdi, 'stop' durdu */
function orbStep(b, dt, lv, flip) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    const d = Math.exp(-1.15 * dt);
    b.vx *= d;
    b.vy *= d;
    if (b.x < BR) {
        b.x = BR;
        b.vx = Math.abs(b.vx) * 0.92;
    }
    if (b.x > AW - BR) {
        b.x = AW - BR;
        b.vx = -Math.abs(b.vx) * 0.92;
    }
    if (b.y < BR) {
        b.y = BR;
        b.vy = Math.abs(b.vy) * 0.92;
    }
    if (b.y > AH - BR) {
        b.y = AH - BR;
        b.vy = -Math.abs(b.vy) * 0.92;
    }
    for (const o of lv.w) {
        const ox = flip ? AW - o.x - o.w : o.x;
        const cx = Math.max(ox, Math.min(ox + o.w, b.x));
        const cy = Math.max(o.y, Math.min(o.y + o.h, b.y));
        let dx = b.x - cx;
        let dy = b.y - cy;
        const dd = Math.hypot(dx, dy);
        if (dd >= BR)
            continue;
        if (o.k === 1)
            return 'dead';
        if (dd < 0.001) {
            dx = 0;
            dy = -1;
        }
        else {
            dx /= dd;
            dy /= dd;
        }
        b.x = cx + dx * BR;
        b.y = cy + dy * BR;
        const dot = b.vx * dx + b.vy * dy;
        if (dot < 0) {
            b.vx -= 1.92 * dot * dx;
            b.vy -= 1.92 * dot * dy;
        }
        if (o.k === 2) {
            const sp = Math.hypot(b.vx, b.vy);
            const k = Math.min(1.3, 900 / Math.max(1, sp));
            b.vx *= k;
            b.vy *= k;
        }
    }
    const hx = flip ? AW - lv.h[0] : lv.h[0];
    const sp = Math.hypot(b.vx, b.vy);
    if (Math.hypot(b.x - hx, b.y - lv.h[1]) < HR * 1.3 && sp < 760)
        return 'in';
    if (sp < 14)
        return 'stop';
    return 'run';
}
/** deneme için: bir atışı baştan sona oynatır */
function orbShoot(lv, flip, ang, pw) {
    const sx = flip ? AW - lv.s[0] : lv.s[0];
    const b = { x: sx, y: lv.s[1], vx: Math.cos(ang) * pw * VMAX, vy: Math.sin(ang) * pw * VMAX };
    for (let i = 0; i < 1500; i++) {
        const r = orbStep(b, 1 / 120, lv, flip);
        if (r !== 'run')
            return r;
    }
    return 'stop';
}
export const orbLab = { levels: ORB_LEVELS, shoot: orbShoot };
function orb() {
    let li = 0;
    let flip = false;
    let tries = 3;
    let score = 0;
    let flash = 0;
    let pause = 0;
    let state = 'aim';
    let msg = '';
    let sink = 0;
    const b = { x: 0, y: 0, vx: 0, vy: 0 };
    let aim = null;
    const fx = [];
    const lv = () => ORB_LEVELS[li % ORB_LEVELS.length];
    const reset = () => { b.x = flip ? AW - lv().s[0] : lv().s[0]; b.y = lv().s[1]; b.vx = 0; b.vy = 0; state = 'aim'; aim = null; };
    const nextLevel = () => { li++; flip = li >= ORB_LEVELS.length && Math.random() < 0.5; tries = 3; reset(); };
    reset();
    // ekran <-> mantıksal alan
    const view = (env) => {
        const s = Math.min(env.w / AW, (env.h - 120) / AH);
        return { s, ox: (env.w - AW * s) / 2, oy: 100 + (env.h - 100 - AH * s) / 2 };
    };
    const toL = (x, y, env) => { const v = view(env); return { x: (x - v.ox) / v.s, y: (y - v.oy) / v.s }; };
    const holeX = () => (flip ? AW - lv().h[0] : lv().h[0]);
    const fail = (dead) => {
        tries--;
        flash = dead ? 0.35 : 0;
        state = 'wait';
        if (tries <= 0) {
            msg = 'Olmadı';
            pause = 0.9;
        }
        else {
            msg = dead ? 'Lanetli duvar!' : 'Kaçırdın';
            pause = 0.5;
        }
    };
    return {
        title: 'Kazan Atışı', rules: 'Topu geriye çek ve bırak: duvarlardan seke seke kazana sok.\nKırmızı dikenli duvar topu bozar, yeşil yastık hızlandırır.\nHer bölümde 3 hakkın var, ilk atışta girersen 3 puan!', secs: 90,
        update(dt) {
            flash = Math.max(0, flash - dt);
            if (state === 'wait' || state === 'sink') {
                if (state === 'sink')
                    sink += dt;
                pause -= dt;
                if (pause <= 0) {
                    if (state === 'sink' || tries <= 0)
                        nextLevel();
                    else
                        reset();
                    msg = '';
                    sink = 0;
                }
                return;
            }
            if (state !== 'fly')
                return;
            for (let i = 0; i < 2; i++) {
                const r = orbStep(b, dt / 2, lv(), flip);
                if (r === 'in') {
                    score += tries;
                    fx.push({ x: b.x, y: b.y, t: 1, s: '+' + tries, col: '#ffe36b' });
                    msg = tries === 3 ? 'Mükemmel!' : 'Girdi!';
                    state = 'sink';
                    pause = 0.7;
                    sink = 0;
                    b.x = holeX();
                    b.y = lv().h[1];
                    b.vx = b.vy = 0;
                    return;
                }
                if (r === 'dead') {
                    fail(true);
                    return;
                }
                if (r === 'stop') {
                    fail(false);
                    return;
                }
            }
        },
        draw(env) {
            const c = env.c;
            const v = view(env);
            cover(env, 'mg_memory_bg');
            c.save();
            c.translate(v.ox, v.oy);
            c.scale(v.s, v.s);
            // zemin
            const fg = c.createLinearGradient(0, 0, 0, AH);
            fg.addColorStop(0, '#2d1a5e');
            fg.addColorStop(1, '#4a2a86');
            c.fillStyle = fg;
            c.beginPath();
            c.roundRect(0, 0, AW, AH, 16);
            c.fill();
            c.strokeStyle = '#ffd86b';
            c.lineWidth = 4;
            c.stroke();
            c.strokeStyle = 'rgba(255,255,255,.05)';
            c.lineWidth = 1;
            for (let x = 30; x < AW; x += 30) {
                c.beginPath();
                c.moveTo(x, 4);
                c.lineTo(x, AH - 4);
                c.stroke();
            }
            for (let y = 30; y < AH; y += 30) {
                c.beginPath();
                c.moveTo(4, y);
                c.lineTo(AW - 4, y);
                c.stroke();
            }
            // duvarlar
            for (const o of lv().w) {
                const ox = flip ? AW - o.x - o.w : o.x;
                if (o.k === 0) {
                    const g = c.createLinearGradient(0, o.y, 0, o.y + o.h);
                    g.addColorStop(0, '#8a7a96');
                    g.addColorStop(1, '#4a3f5a');
                    c.fillStyle = g;
                    c.beginPath();
                    c.roundRect(ox, o.y, o.w, o.h, 6);
                    c.fill();
                    c.strokeStyle = '#cbb8e0';
                    c.lineWidth = 2;
                    c.stroke();
                }
                else if (o.k === 1) {
                    const pulse = 0.6 + 0.4 * Math.sin(env.t * 5);
                    c.shadowColor = '#ff2a7a';
                    c.shadowBlur = 14 * pulse;
                    c.fillStyle = '#ff3a86';
                    c.beginPath();
                    c.roundRect(ox, o.y, o.w, o.h, 5);
                    c.fill();
                    c.shadowBlur = 0;
                    c.fillStyle = '#7a0a3a';
                    const horiz = o.w >= o.h;
                    const n = Math.max(2, Math.floor((horiz ? o.w : o.h) / 18));
                    for (let i = 0; i < n; i++) {
                        const t = (i + 0.5) / n;
                        c.beginPath();
                        if (horiz) {
                            c.moveTo(ox + t * o.w - 6, o.y);
                            c.lineTo(ox + t * o.w, o.y - 8);
                            c.lineTo(ox + t * o.w + 6, o.y);
                        }
                        else {
                            c.moveTo(ox, o.y + t * o.h - 6);
                            c.lineTo(ox - 8, o.y + t * o.h);
                            c.lineTo(ox, o.y + t * o.h + 6);
                        }
                        c.fill();
                    }
                }
                else {
                    c.fillStyle = '#39d46a';
                    c.beginPath();
                    c.roundRect(ox, o.y, o.w, o.h, 10);
                    c.fill();
                    c.strokeStyle = '#c8ffd8';
                    c.lineWidth = 2;
                    c.stroke();
                    c.fillStyle = 'rgba(255,255,255,.7)';
                    for (let i = 0; i < 3; i++) {
                        const q = (env.t * 1.5 + i / 3) % 1;
                        c.beginPath();
                        c.arc(ox + o.w / 2, o.y + o.h / 2 - q * 18, 3, 0, Math.PI * 2);
                        c.fill();
                    }
                }
            }
            // kazan
            const hx = holeX();
            const hy = lv().h[1];
            const hg = c.createRadialGradient(hx, hy, 2, hx, hy, HR + 10);
            hg.addColorStop(0, 'rgba(120,255,160,.55)');
            hg.addColorStop(1, 'rgba(120,255,160,0)');
            c.fillStyle = hg;
            c.fillRect(hx - 40, hy - 40, 80, 80);
            c.fillStyle = '#10061f';
            c.beginPath();
            c.ellipse(hx, hy, HR, HR * 0.8, 0, 0, Math.PI * 2);
            c.fill();
            c.strokeStyle = '#7bff9a';
            c.lineWidth = 3;
            c.stroke();
            c.fillStyle = 'rgba(123,255,154,.5)';
            c.beginPath();
            c.arc(hx + Math.sin(env.t * 3) * 5, hy + Math.cos(env.t * 4) * 3, 4, 0, Math.PI * 2);
            c.fill();
            // nişan: geriye çekme oku ve tahmini yol
            if (aim && state === 'aim') {
                const dx = aim.ax - aim.cx;
                const dy = aim.ay - aim.cy;
                const len = Math.min(190, Math.hypot(dx, dy));
                if (len > 6) {
                    const ang = Math.atan2(dy, dx);
                    const pw = len / 190;
                    c.strokeStyle = `rgba(255,${Math.round(255 - 140 * pw)},${Math.round(160 - 100 * pw)},.95)`;
                    c.lineWidth = 4;
                    c.setLineDash([2, 9]);
                    c.lineCap = 'round';
                    const sim = { x: b.x, y: b.y, vx: Math.cos(ang) * pw * VMAX, vy: Math.sin(ang) * pw * VMAX };
                    c.beginPath();
                    c.moveTo(b.x, b.y);
                    for (let i = 0; i < 36; i++) {
                        const r = orbStep(sim, 1 / 60, lv(), flip);
                        c.lineTo(sim.x, sim.y);
                        if (r !== 'run')
                            break;
                    }
                    c.stroke();
                    c.setLineDash([]);
                    c.strokeStyle = 'rgba(255,255,255,.45)';
                    c.lineWidth = 3;
                    c.beginPath();
                    c.moveTo(b.x, b.y);
                    c.lineTo(b.x - Math.cos(ang) * len * 0.5, b.y - Math.sin(ang) * len * 0.5);
                    c.stroke();
                }
            }
            // top
            const sc = state === 'sink' ? Math.max(0.05, 1 - sink / 0.5) : 1;
            {
                const bg = c.createRadialGradient(b.x - 3, b.y - 3, 1, b.x, b.y, BR + 8);
                bg.addColorStop(0, '#ffffff');
                bg.addColorStop(0.45, '#a8e8ff');
                bg.addColorStop(1, 'rgba(120,80,255,0)');
                c.fillStyle = bg;
                c.beginPath();
                c.arc(b.x, b.y, (BR + 8) * sc, 0, Math.PI * 2);
                c.fill();
                c.fillStyle = '#fff';
                c.beginPath();
                c.arc(b.x, b.y, BR * 0.6 * sc, 0, Math.PI * 2);
                c.fill();
            }
            floaters(env, fx, 1 / 60);
            c.restore();
            // HUD: kalan haklar ve bölüm
            for (let i = 0; i < 3; i++) {
                env.c.globalAlpha = i < tries ? 1 : 0.25;
                text(env, '●', env.w / 2 + (i - 1) * 26, 96, 26, '#bfeaff');
            }
            env.c.globalAlpha = 1;
            text(env, `${env.L('Bölüm')} ${li + 1}`, env.w / 2, 80, 16, '#e9dcff');
            if (msg)
                text(env, env.L(msg), env.w / 2, env.h - 40, 28, msg === 'Mükemmel!' || msg === 'Girdi!' ? '#9fffb0' : '#ff9ab0');
            if (flash > 0) {
                env.c.fillStyle = `rgba(255,40,100,${flash * 0.9})`;
                env.c.fillRect(0, 0, env.w, env.h);
            }
        },
        down(x, y, env) {
            if (state !== 'aim')
                return;
            const p = toL(x, y, env);
            aim = { ax: p.x, ay: p.y, cx: p.x, cy: p.y };
        },
        move(x, y, env) {
            if (!aim || state !== 'aim')
                return;
            const p = toL(x, y, env);
            aim.cx = p.x;
            aim.cy = p.y;
        },
        up() {
            if (!aim || state !== 'aim') {
                aim = null;
                return;
            }
            const dx = aim.ax - aim.cx;
            const dy = aim.ay - aim.cy;
            const len = Math.min(190, Math.hypot(dx, dy));
            aim = null;
            if (len < 14)
                return; // çok kısa çekiş: atış sayılmaz
            const ang = Math.atan2(dy, dx);
            const pw = len / 190;
            b.vx = Math.cos(ang) * pw * VMAX;
            b.vy = Math.sin(ang) * pw * VMAX;
            state = 'fly';
        },
        over: () => false,
        result: () => ({ score, stars: score >= 19 ? 3 : score >= 14 ? 2 : score >= 8 ? 1 : 0 }),
        hud: () => String(score),
    };
}
export function playMini(kind, L, done) {
    const g = kind === 'honey' ? honey() : kind === 'cards' ? cards() : kind === 'orb' ? orb() : broom();
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
    const release = (e) => { if (phase === 'play' && g.up) {
        const p = pt(e);
        g.up(p.x, p.y, env);
    } };
    cv.addEventListener('pointerup', release);
    cv.addEventListener('pointercancel', release);
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
