/**
 * Günlük: her ada bossu yenilince bir sayfa açılır (69 sayfa). Tek bir gizem ilerler:
 * Kırk Ada'yı ayıran lanet, kırık bir aynanın parçalarıdır; son sayfada rakip cadının kim olduğu ortaya çıkar.
 */
import { ZONES } from './data.js';
/** önemli dönüm noktaları (ada dizini → sayfa) */
const KEY = {
    0: { title: 'İlk adım', text: 'Ustam Elmira bana eski bir defter verdi: "Adalar eskiden tek bir topraktı. Bir ayna kırıldı ve her parça bir ada oldu. Parçaları toplarsan yol açılır." Bossun düştüğü yerde bir ayna kırığı parladı.' },
    1: { title: 'Kara delik', text: 'İkinci kırık da cebimde, ama ustam Elmira beni uyardı: "Üçüncü adadan itibaren aynanın boşluğu açılıyor: bir kara delik. Adada yirmi saniye durursan ortaya çıkar, yavaş ama durmadan seni ve kaplanı yutmaya çalışır. Yutulursan canından %2 gider; ya bir reklam izleyip kurtulursun ya da adaya baştan başlarsın. İlk bossu yenersen kaybolur. Okçu varsa arbaletle üç isabet atıp deliği otuz saniye dondurabilirsin." Defterime not düştüm: ondan hep uzak dur.' },
    4: { title: 'Kırığın fısıltısı', text: 'Bataklık Kraliçesi yenilince kırık konuştu: "Ben seni tanıyorum." Kimse bana bunu daha önce söylememişti. Defterin kenarına yazdım: Kırıklar bellek taşıyor.' },
    9: { title: 'On ada', text: 'On kırık yan yana gelince ayna kısacık bir görüntü gösterdi: pelerinli bir cadı, bana çok benzeyen. Gözleri yeşildi. Usta Aysel "Bakma" dedi, ben baktım.' },
    19: { title: 'Ustaların sırrı', text: 'Usta cadılar yalnız eğitmen değilmiş: her biri kırıkların bir bekçisiymiş. Biri bana itiraf etti: "Aynayı biz kırdık. Çıraklarımızdan biri çok güçlenmişti ve biz korktuk."' },
    29: { title: 'Gölge adı', text: 'Gölge Diyarı\'nda kendi gölgemin benden bir adım önde yürüdüğünü gördüm. Taklit etmiyordu; yönlendiriyordu.' },
    39: { title: 'Kırkıncı kırık', text: 'Kırk kırık tamam, ayna kapıda duruyor ama yarı saydam: öte yüzünü göremiyorum. Ustam, "Buradan sonrası bedelli," dedi. "Yol uzar, güç ister; zamanını ve sabrını." Kapı yalnız bunu hak edene açılır.' },
    49: { title: 'Öte yüz', text: 'Aynanın öte yüzünde adalar yeşile boyanmış. Her şey bizim dünyamızın tersi: cadılar saklanmıyor, hükmediyor. Bu dünyada bana ne diyorlar? "Gelen."' },
    59: { title: 'Mektup', text: 'Usta Elmira\'nın eski bir mektubunu buldum: "Çırağım güçlendikçe aynadaki yansıması da güçleniyor. Biri diğerini yenmeden ayna bütünlenmez. Üzgünüm."' },
    68: { title: 'Son kırık', text: 'Son bossu yendim ve ayna bütünlendi. Görüntüde yeşil gözlü cadı bana baktı: yarım kalmış, kendi gücümün aynası. "Ben senim," dedi. "Ve sen de bensin. Dövüşelim; kim kalırsa tek olur."' },
};
const FLAVOR = {
    'Mantar Ormanı': ['Mantarlar geceleri fısıldaşıyor. Bir kırığın izini sürüyorlar.', 'Burada hava nemli ve tatlı. Kırığın yakınında mantarlar daha parlak.', 'Ormanın ortasında eski bir rün taşı var. Üzerinde benim adım yazıyor, ama tersinden.'],
    'Karanlık Bataklık': ['Bataklık suyu ayna gibi: yansımam bir an gülümsemedi.', 'Kurbağalar tek bir şarkı söylüyor. Kırığın ritmi bu.', 'Sisin içinde adımı çağıran bir ses var; boss yenilince sustu.'],
    'Buz Mağarası': ['Buzun içinde yüzlerce küçük ayna parçası donmuş. Hepsi bana bakıyor.', 'Kış Cadısı\'nın izleri eski. Ustam onu tanıyormuş.', 'Soğukta bile kırık sıcak. Buz erimeye başlıyor.'],
    'Kızıl Çöl': ['Kum fırtınası kırığı yutmuş. Akrepler onu bekliyor.', 'Çölün ortasında ayna şeklinde bir vaha var. Yaklaştıkça uzaklaşıyor.', 'Kum saatinin tersine akıyor: zaman burada kırık.'],
    'Kristal Vadisi': ['Kristaller kırığın parçalarını çoğaltıyor. Hangisi gerçek?', 'Vadide yankı iki kez geliyor: ikincisi benden bağımsız.', 'Bekçi, "Sen ilk değilsin," dedi ve çöktü.'],
    'Volkan Adası': ['Lav, aynayı eritmeye çalışmış ama olmamış. Kırık kıpkızıl parlıyor.', 'Magma Ejderi kırığın üzerinde uyuyormuş; uyandırmışım.', 'Kül altında eski bir cadı kulesi var. Duvarında ayna kabartması.'],
    'Bulut Sarayı': ['Bulutlar yansıma gibi: aşağıdaki adayı tersine gösteriyor.', 'Fırtına Kartalı ayna kırığını yuvasına taşımış. Kanatlarında yansıma var.', 'Sarayın tavanında bir göz: kırığı gözlüyor.'],
    'Gölge Diyarı': ['Gölgeler burada ışıktan önce geliyor. Biri arkamda hep bir adım geride.', 'Gölge Kraliçe\'nin tacında kırık yok; kendisi bir kırık.', 'Karanlığın içinde kendi sesimi duydum: "Yakında."'],
};
/** görseli ve ara sahnesi olan dönüm noktası sayfası mı */
export const hasScene = (i) => i in KEY;
/** ada dizini için günlük sayfası */
export function pageFor(i) {
    const k = KEY[i];
    if (k)
        return k;
    const z = ZONES[i];
    const biome = Object.keys(FLAVOR).find((b) => z.name.endsWith(b)) ?? 'Mantar Ormanı';
    const lines = FLAVOR[biome];
    const text = lines[Math.floor(i / 8) % lines.length];
    return { title: `Sayfa ${i + 1} · ${z.name}`, text: `${text} (Usta ${z.master} bu adada bana kısa bir not bıraktı.)` };
}
