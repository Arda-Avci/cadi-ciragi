/** Ses: dosyasız, WebAudio ile üretilen arka plan müziği ve efektler (çevrimdışı çalışır). */
import { onSettingsChange, settings } from './settings.js';
// biyom ruh halleri: kök nota (Hz), gam (yarım ses adımları), tempo
const MOODS = [
    { root: 220.0, scale: [0, 2, 3, 5, 7, 8, 10], bpm: 78, pad: 'triangle' }, // orman: la minör
    { root: 146.8, scale: [0, 2, 3, 5, 7, 8, 10], bpm: 64, pad: 'sine' }, // bataklık: re minör, yavaş
    { root: 329.6, scale: [0, 2, 4, 6, 7, 9, 11], bpm: 72, pad: 'sine' }, // buz: mi lidyen, çan gibi
    { root: 196.0, scale: [0, 1, 4, 5, 7, 8, 10], bpm: 84, pad: 'triangle' }, // çöl: frig
    { root: 261.6, scale: [0, 2, 4, 6, 8, 10], bpm: 70, pad: 'sine' }, // kristal: tam ton
    { root: 110.0, scale: [0, 1, 3, 5, 7, 8, 10], bpm: 92, pad: 'sawtooth' }, // volkan: derin frig
    { root: 261.6, scale: [0, 2, 4, 7, 9], bpm: 88, pad: 'triangle' }, // bulut: do majör pentatonik
    { root: 123.5, scale: [0, 1, 3, 5, 6, 8, 10], bpm: 60, pad: 'sawtooth' }, // gölge: lokriyen
];
class AudioEngine {
    constructor() {
        this.ctx = null;
        this.noise = null;
        this.nextBeat = 0;
        this.beat = 0;
        this.mood = 0;
        this.last = new Map();
        this.started = false;
    }
    /** ilk kullanıcı dokunuşunda çağrılır (tarayıcılar sesi ancak o zaman açar) */
    start() {
        if (this.started) {
            this.ctx?.resume().catch((e) => console.error('ses sürdürülemedi', e));
            return;
        }
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AC();
        }
        catch (e) {
            console.error('ses başlatılamadı', e);
            return;
        }
        const c = this.ctx;
        this.master = c.createGain();
        this.master.gain.value = 0.9;
        this.master.connect(c.destination);
        this.musicBus = c.createGain();
        this.musicBus.connect(this.master);
        this.sfxBus = c.createGain();
        this.sfxBus.connect(this.master);
        const len = c.sampleRate;
        this.noise = c.createBuffer(1, len, c.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++)
            d[i] = Math.random() * 2 - 1;
        this.started = true;
        this.applyVolumes();
        this.nextBeat = c.currentTime + 0.1;
        window.setInterval(() => this.schedule(), 120);
        document.addEventListener('visibilitychange', () => {
            if (!this.ctx)
                return;
            if (document.hidden)
                this.ctx.suspend().catch((e) => console.error('ses durdurulamadı', e));
            else
                this.ctx.resume().catch((e) => console.error('ses sürdürülemedi', e));
        });
    }
    applyVolumes() {
        if (!this.ctx)
            return;
        this.musicBus.gain.setTargetAtTime(settings.music * 0.55, this.ctx.currentTime, 0.05);
        this.sfxBus.gain.setTargetAtTime(settings.sfx, this.ctx.currentTime, 0.05);
    }
    setMood(biome) { this.mood = ((biome % MOODS.length) + MOODS.length) % MOODS.length; }
    // ---- müzik: pad akoru + bas + rastgele arpej, 4 vuruşluk ölçüler ----
    freq(m, degree, oct = 0) {
        const n = m.scale.length;
        const oi = Math.floor(degree / n);
        const si = ((degree % n) + n) % n;
        return m.root * Math.pow(2, (m.scale[si] + 12 * (oi + oct)) / 12);
    }
    schedule() {
        const c = this.ctx;
        if (!c || settings.music <= 0.001) {
            if (c)
                this.nextBeat = Math.max(this.nextBeat, c.currentTime);
            return;
        }
        const m = MOODS[this.mood];
        const spb = 60 / m.bpm;
        while (this.nextBeat < c.currentTime + 0.6) {
            const t = this.nextBeat;
            const bar = Math.floor(this.beat / 4) % 4;
            const inBar = this.beat % 4;
            const prog = [0, 5, 3, 4]; // akor dereceleri
            const deg = prog[bar] % m.scale.length;
            if (inBar === 0) {
                // pad: kök + üçlü + beşli, uzun ve yumuşak
                for (const off of [0, 2, 4])
                    this.pad(this.freq(m, deg + off, 0), t, spb * 4, m.pad);
                this.tone(this.freq(m, deg, -1), t, spb * 3.6, 'sine', 0.16, this.musicBus);
            }
            // arpej: her vuruşta olasılıkla bir nota
            if (Math.random() < 0.7) {
                const d2 = deg + [0, 2, 4, 7, 9][Math.floor(Math.random() * 5)];
                this.tone(this.freq(m, d2, 1), t + (Math.random() < 0.3 ? spb * 0.5 : 0), spb * 1.6, 'triangle', 0.055, this.musicBus, true);
            }
            if (inBar === 2 && Math.random() < 0.35)
                this.tone(this.freq(m, deg + 4, 2), t, spb * 2.5, 'sine', 0.04, this.musicBus, true);
            this.beat++;
            this.nextBeat += spb;
        }
    }
    pad(f, t, dur, type) {
        const c = this.ctx;
        if (!c)
            return;
        for (const det of [-6, 6]) {
            const o = c.createOscillator();
            const g = c.createGain();
            const lp = c.createBiquadFilter();
            o.type = type;
            o.frequency.value = f;
            o.detune.value = det;
            lp.type = 'lowpass';
            lp.frequency.value = 900;
            g.gain.setValueAtTime(0.0001, t);
            g.gain.linearRampToValueAtTime(0.05, t + dur * 0.35);
            g.gain.linearRampToValueAtTime(0.0001, t + dur);
            o.connect(lp);
            lp.connect(g);
            g.connect(this.musicBus);
            o.start(t);
            o.stop(t + dur + 0.05);
        }
    }
    tone(f, t, dur, type, vol, bus, pluck = false, slideTo = 0) {
        const c = this.ctx;
        if (!c)
            return;
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = type;
        o.frequency.setValueAtTime(f, t);
        if (slideTo)
            o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(vol, t + (pluck ? 0.01 : Math.min(0.15, dur * 0.3)));
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g);
        g.connect(bus);
        o.start(t);
        o.stop(t + dur + 0.05);
    }
    burst(t, dur, vol, f0, f1, q = 1.2) {
        const c = this.ctx;
        if (!c || !this.noise)
            return;
        const s = c.createBufferSource();
        s.buffer = this.noise;
        const bp = c.createBiquadFilter();
        bp.type = 'bandpass';
        bp.Q.value = q;
        bp.frequency.setValueAtTime(f0, t);
        bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
        const g = c.createGain();
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(bp);
        bp.connect(g);
        g.connect(this.sfxBus);
        s.start(t);
        s.stop(t + dur + 0.05);
    }
    // ---- efektler ----
    play(name) {
        const c = this.ctx;
        if (!c || settings.sfx <= 0.001)
            return;
        const now = c.currentTime;
        const gap = { cast: 0.06, hit: 0.05, kill: 0.08, hurt: 0.15, gain: 0.12, chest: 0.3, gate: 1, fly: 0.5, heal: 0.9, click: 0.04, boss: 1, chop: 0.08 };
        if (now - (this.last.get(name) ?? -9) < gap[name])
            return;
        this.last.set(name, now);
        const b = this.sfxBus;
        switch (name) {
            case 'cast':
                this.tone(520, now, 0.1, 'sine', 0.13, b, true, 900);
                this.burst(now, 0.08, 0.05, 2500, 5000, 2);
                break;
            case 'hit':
                this.burst(now, 0.05, 0.16, 1800, 700, 1.5);
                this.tone(150, now, 0.07, 'square', 0.05, b, true, 90);
                break;
            case 'chop':
                this.burst(now, 0.07, 0.15, 900, 300, 1);
                this.tone(110, now, 0.08, 'triangle', 0.1, b, true, 70);
                break;
            case 'kill':
                this.tone(520, now, 0.12, 'triangle', 0.14, b, true, 260);
                this.tone(780, now + 0.07, 0.14, 'sine', 0.1, b, true, 1180);
                break;
            case 'hurt':
                this.tone(230, now, 0.2, 'sawtooth', 0.12, b, true, 90);
                this.burst(now, 0.12, 0.1, 600, 200, 0.8);
                break;
            case 'gain':
                [1046, 1318, 1568].forEach((f, i) => this.tone(f, now + i * 0.055, 0.14, 'triangle', 0.09, b, true));
                break;
            case 'chest':
                [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, now + i * 0.07, 0.25, 'triangle', 0.11, b, true));
                break;
            case 'gate':
                this.tone(70, now, 1.4, 'sawtooth', 0.12, b, false, 45);
                [262, 330, 392, 523].forEach((f, i) => this.tone(f, now + 0.2 + i * 0.12, 0.9, 'triangle', 0.1, b));
                this.burst(now, 0.9, 0.08, 200, 1200, 0.7);
                break;
            case 'boss':
                [196, 247, 294, 392, 494].forEach((f, i) => this.tone(f, now + i * 0.09, 1.1, 'triangle', 0.12, b));
                this.tone(98, now, 1.3, 'sine', 0.2, b);
                break;
            case 'fly':
                this.burst(now, 0.6, 0.12, 300, 2600, 0.9);
                this.tone(330, now, 0.5, 'sine', 0.07, b, false, 660);
                break;
            case 'heal':
                this.tone(660, now, 0.35, 'sine', 0.05, b, false, 880);
                break;
            case 'click':
                this.tone(880, now, 0.04, 'square', 0.04, b, true);
                break;
        }
    }
}
export const audio = new AudioEngine();
onSettingsChange(() => audio.applyVolumes());
