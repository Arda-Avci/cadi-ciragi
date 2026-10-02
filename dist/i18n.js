/** Dil desteği: Türkçe metin anahtardır; İngilizce çeviri sözlükten ya da kalıplardan gelir. */
import { settings } from './settings.js';
const EN = {
    // oyun adı ve açılış
    'Devam et': 'Continue', 'Yeni oyun': 'New game', 'Ayarlar': 'Settings', 'Şeref Salonu': 'Hall of Fame', 'Kahraman adı': 'Hero name',
    'Oyuna başla': 'Start playing', 'Çırak': 'Apprentice', 'Kırk Ada': 'Forty Isles', 'Sürüm': 'Version', 'Yapım': 'Build',
    'Hareket: ekrana basılı tutup sürükle. Büyüler kendiliğinden atılır.': 'Move: press and drag on the screen. Spells cast automatically.',
    'Henüz kayıt yok': 'No records yet', 'Kayıt': 'Save', 'ada': 'islands', 'öldürme': 'kills',
    // alt çubuk / paneller
    'Yetenek': 'Skills', 'Büyüler': 'Spells', 'Ekipman': 'Gear', 'Kristal': 'Crystals', 'Stat': 'Stats', 'Kartlar': 'Cards', 'Harita': 'Map',
    'Yetenek Ağacı': 'Skill Tree', 'Kristaller': 'Crystals', 'Statlar': 'Stats', 'Karakter Kartları': 'Character Cards',
    'Buraya tıkla!': 'Tap here!', 'Usta Cadı: Eğitim': 'Master Witch: Training', 'dokun: harita': 'tap: map',
    'Kuşan': 'Equip', 'Çıkar': 'Unequip', 'Tak': 'Wear', 'Sat': 'Sell', 'Aç': 'Unlock', '▲ Yükselt': '▲ Upgrade', 'Oyna': 'Play', 'Yarın': 'Tomorrow',
    'KUŞANILDI': 'EQUIPPED', 'Jeod aç': 'Open geode', 'boş': 'empty', 'Kapat': 'Close', 'Ödülü al': 'Claim reward',
    'Güç': 'Power', 'Azami can': 'Max health', 'Yenilenme': 'Regen', 'Hasar çarpanı': 'Damage multiplier', 'Alınan hasar çarpanı': 'Damage taken multiplier',
    'Eğitim (usta cadı)': 'Training (master witch)', 'Kesme': 'Cut', 'Delme': 'Pierce', 'Ezme': 'Smash',
    'Sağlam Pelerin': 'Sturdy Cloak', 'Şifalı Çay': 'Healing Tea', 'Tılsımlı Broş': 'Charm Brooch', 'Parlak Büyü': 'Bright Spell', 'Hızlı Büyü': 'Quick Cast',
    'Geniş Menzil': 'Wide Reach', 'Ruh Mıknatısı': 'Soul Magnet', 'Bereketli Kazan': 'Bountiful Cauldron', 'Çevik Ayaklar': 'Nimble Feet',
    'Dayanıklılık': 'Endurance', 'Toplayıcı': 'Gatherer',
    'Yıldız Değneği': 'Star Wand', 'Uçan Süpürge': 'Flying Broom', 'Kaynar İksir': 'Boiling Potion', 'Büyülü Kepçe': 'Enchanted Ladle',
    'Sıradan': 'Common', 'Nadir': 'Rare', 'Destansı': 'Epic', 'Efsanevi': 'Legendary', 'Mitik': 'Mythic',
    // ayarlar
    'Müzik': 'Music', 'Efekt sesi': 'Sound effects', 'Titreşim': 'Vibration', 'Dil': 'Language', 'Açık': 'On', 'Kapalı': 'Off', 'Türkçe': 'Turkish',
    'İngilizce': 'English', 'Titreşim yalnızca destekleyen cihazlarda çalışır.': 'Vibration only works on supported devices.',
    'Ana menü': 'Main menu', 'Oyuna dön': 'Back to game',
    // oyun içi metinler
    'Boss evinin mührü kalktı!': 'The boss house seal is broken!', 'KİLİTLİ': 'LOCKED', 'Kapı açık': 'Gate open', 'KAPI AÇILDI!': 'GATE OPENED!', 'yolu açık': 'path is open', 'YENİLDİ': 'DEFEATED',
    'BOSS EVİ · vur / iyileş': 'BOSS HOUSE · hit / heal', 'EV · hızlı iyileşme': 'HOME · fast healing', 'KAMP · hızlı iyileşme': 'CAMP · fast healing',
    'Eğitim için dokun!': 'Tap to train!', 'ENGEL': 'BLOCK', 'KAÇTI': 'DODGE', 'Süpürge uçuşu! 5 sn dokunulmazsın': 'Broom flight! Invulnerable for 5s',
    'Bayıldın… düşmanlar kamplarına döndü.': 'You fainted… the enemies returned to their camps.', 'Bayıldın… evde uyanıyorsun': 'You fainted… waking up at camp',
    'Sonraki bölgenin kapısı açıldı.': 'The next island\'s gate is open.', 'Dünyayı tamamladın!': 'You completed the world!', 'yenildi!': 'defeated!',
    '+3 Jeod': '+3 Geode', '+1 Jeod': '+1 Geode', 'Gizli sandık bulundu!': 'Secret chest found!',
    'Bugünlük hakkın bitti, yarın gel': 'No attempts left today, come back tomorrow',
    'Büyü Zamanlaması': 'Spell Timing', 'İksir Karışımı': 'Potion Mix', 'Yıldız Yakalama': 'Star Catch', 'Eğitim bitti': 'Training complete',
    'Harika!': 'Great!', 'İyi iş!': 'Nice work!', 'Biraz daha çalışmalısın.': 'You need a bit more practice.',
    'Sivri Şapka': 'Pointy Hat', 'Mantar Külahı': 'Mushroom Cap', 'Yarasa Başlığı': 'Bat Hood', 'Ay Tacı': 'Moon Crown', 'Yıldız Taçlı Şapka': 'Star-Crowned Hat',
    'Tencere Kapağı': 'Pot Lid', 'Büyü Kitabı': 'Spellbook', 'Tılsımlı Kalkan': 'Charmed Shield', 'Ay Kalkanı': 'Moon Shield', 'Kozmik Kalkan': 'Cosmic Shield',
    'Miğfer': 'Helmet', 'Kalkan': 'Shield', 'Can': 'Health', 'Hasar': 'Damage', 'Menzil': 'Reach', 'Hız': 'Speed', 'Ruh': 'Soul', 'Kritik': 'Crit',
    'Can Çalma': 'Life Steal', 'Kaçınma': 'Evasion', 'kopya': 'copies', 'hasarı': 'damage',
    'Yıldız Oku (delip geçer)': 'Star Bolt (pierces)', 'Bumerang Süpürge (gidip gelir)': 'Boomerang Broom (returns)',
    'Patlayan İksir (alan hasarı)': 'Exploding Potion (area damage)', 'Kepçe Darbesi (yakın menzil)': 'Ladle Strike (close range)',
    'Kolay': 'Easy', 'Orta': 'Medium', 'Zor': 'Hard', 'Elit': 'Elite', 'Muhafız': 'Guardian', 'Boss': 'Boss',
    'Kritik / Can çalma / Kaçınma': 'Crit / Life steal / Evasion', 'savunması': 'defense', 'can': 'health', 'hasar': 'damage', 'yenilenme': 'regen',
    'Yuva': 'Slots', 'yuva': 'slots', '(boss yendikçe artar).': '(grows as you defeat bosses).', 'Düşmanın zayıf olduğu türden büyü kuşan!': 'Equip spells of the type the enemy is weak to!',
    'Kopyalar kamplardan düşer.': 'Copies drop from camps.', 'Boş yuva yok.': 'No free slot.', 'Başarılı!': 'Success!', 'Başarısız, toz gitti.': 'Failed, dust lost.',
    'Yükleniyor…': 'Loading…', 'Köprü bekçisi yenildi!': 'Bridge guardian defeated!', 'Henüz karşılaşmadın': 'Not encountered yet',
    'Mevcut kahraman Şeref Salonu\'nda kalır. Yeni oyun başlatılsın mı?': 'Your current hero stays in the Hall of Fame. Start a new game?',
    'Mini oyunlarla eğitilip kalıcı güç kazan. Bu seviye için günde 2 eğitim hakkın var.': 'Train with mini-games to gain permanent power. You get 2 training sessions per island per day.',
    'Bugün': 'Today',
    'Henüz ekipmanın yok': 'You have no gear yet', 'Kristalin yok': 'You have no crystals',
};
/** değişken içeren metinler için kalıplar (Türkçe → İngilizce) */
const RULES = [
    [/^\+(.+) Can kazanıldı \(eğitim\)$/, '+$1 Health gained (training)'],
    [/^\+(.+) Hasar kazanıldı \(eğitim\)$/, '+$1 Damage gained (training)'],
    [/^\+(.+) Yenilenme\/sn kazanıldı \(eğitim\)$/, '+$1 Regen/s gained (training)'],
    [/^\+(.+) Can kazanıldı$/, '+$1 Health gained'],
    [/^\+(.+) Hasar kazanıldı$/, '+$1 Damage gained'],
    [/^\+(.+) Ruh$/, '+$1 Souls'],
    [/^\+(.+) Can iyileşti \((.+)\)$/, '+$1 Health restored ($2)'],
    [/^\+(.+) Can iyileşti$/, '+$1 Health restored'],
    [/^\+(\d+) (.+) kopyası$/, '+$1 $2 copy'],
    [/^(.+) kuşanıldı$/, '$1 equipped'],
    [/^(.+) bulundu!$/, '$1 found!'],
    [/^(.+) açıldı!$/, '$1 unlocked!'],
    [/^(.+) yenildi! (.+)$/, '$1 defeated! $2'],
    [/^(.+) yenildi!$/, '$1 defeated!'],
    [/^Gizli sandık bulundu! \((.+)\)$/, 'Secret chest found! ($1)'],
    [/^Bugün kalan: (.+)$/, 'Remaining today: $1'],
    [/^KİLİTLİ — (.+) yenilmeli$/, 'LOCKED — defeat $1'],
    [/^Usta Cadı (.+)$/, 'Master Witch $1'],
    [/^(.+) yolu açık$/, '$1 path is open'],
    [/^kamp (.+) · sandık (.+)$/, 'camps $1 · chests $2'],
    [/^MÜHÜRLÜ · kamp (.+)$/, 'SEALED · camps $1'],
    [/^\+(.+) can\/sn$/, '+$1 health/s'],
    [/^%(.+) ihtimalle darbeyi engeller$/, 'blocks hits with $1% chance'],
    [/^Ada (.+) · (.+) · aşılan: (.+)$/, 'Island $1 · $2 · cleared: $3'],
];
export function T(s) {
    if (settings.lang !== 'en')
        return s;
    const hit = EN[s];
    if (hit)
        return hit;
    for (const [re, to] of RULES)
        if (re.test(s))
            return s.replace(re, to).replace(/\$(\d)/g, '');
    return s;
}
/** sahne içi addan (ada, boss, düşman, usta) İngilizce karşılık: basit sözlük */
const NAMES_EN = {
    'Mantar Ormanı': 'Mushroom Forest', 'Karanlık Bataklık': 'Dark Swamp', 'Buz Mağarası': 'Ice Cave', 'Kızıl Çöl': 'Crimson Desert',
    'Kristal Vadisi': 'Crystal Valley', 'Volkan Adası': 'Volcano Isle', 'Bulut Sarayı': 'Cloud Palace', 'Gölge Diyarı': 'Shadow Realm',
    'Dev Baykuş': 'Giant Owl', 'Bataklık Kraliçesi': 'Swamp Queen', 'Kış Cadısı': 'Winter Witch', 'Çöl Akrep Kralı': 'Scorpion King',
    'Kristal Bekçi': 'Crystal Warden', 'Magma Ejderi': 'Magma Drake', 'Fırtına Kartalı': 'Storm Eagle', 'Gölge Kraliçe': 'Shadow Queen',
    'Hayalet Kedi': 'Ghost Cat', 'Mantar Cücesi': 'Mushroom Gnome', 'Balkabağı Cin': 'Pumpkin Imp', 'Gece Yarasası': 'Night Bat',
    'Çöl Akrebi': 'Desert Scorpion', 'Taş Golem': 'Stone Golem', 'Fırtına Cini': 'Storm Wisp',
    'Kadim ': 'Ancient ', 'Altın ': 'Golden ', 'Buzul ': 'Glacial ', 'Efsanevi ': 'Legendary ',
};
export function N(name) {
    if (settings.lang !== 'en')
        return name;
    let out = name;
    for (const [tr, en] of Object.entries(NAMES_EN))
        out = out.split(tr).join(en);
    return out;
}
