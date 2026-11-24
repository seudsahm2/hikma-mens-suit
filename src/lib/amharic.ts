/**
 * Amharic suggestions for product names and descriptions, from a menswear glossary.
 * Word order follows Amharic (colour/material before the garment). Brand and model names stay as written.
 * It's a starting point the owner can edit — not a full translator.
 */
const WORDS: Record<string, string> = {
  // garments
  suit: 'ሱፍ ልብስ', suits: 'ሱፍ ልብሶች', tuxedo: 'ቱክሲዶ', blazer: 'ብሌዘር', jacket: 'ጃኬት', coat: 'ኮት', vest: 'ሰደርያ', waistcoat: 'ሰደርያ',
  shirt: 'ሸሚዝ', shirts: 'ሸሚዞች', tee: 'ቲሸርት', 't-shirt': 'ቲሸርት', tshirt: 'ቲሸርት', polo: 'ፖሎ', sweater: 'ሹራብ', knit: 'ሹራብ', hoodie: 'ኮፍያ ያለው ሹራብ', cardigan: 'ካርዲጋን',
  trousers: 'ሱሪ', trouser: 'ሱሪ', pants: 'ሱሪ', chinos: 'ቺኖ ሱሪ', jeans: 'ጂንስ', shorts: 'ቁምጣ', tracksuit: 'ትራክሱት', set: 'ሙሉ', jelabiya: 'ጀለቢያ', kaftan: 'ቃፍጣን', thobe: 'ጀለቢያ',
  shoes: 'ጫማ', shoe: 'ጫማ', sneakers: 'ስኒከር', sneaker: 'ስኒከር', loafers: 'ሎፈር', boots: 'ቡትስ', sandals: 'ሳንዳል', slippers: 'ሸበጥ',
  perfume: 'ሽቶ', fragrance: 'ሽቶ', oud: 'ዑድ', watch: 'ሰዓት', belt: 'ቀበቶ', tie: 'ክራቫት', wallet: 'ቦርሳ', cap: 'ኮፍያ', socks: 'ካልሲ',
  // colours
  black: 'ጥቁር', white: 'ነጭ', navy: 'ደማቅ ሰማያዊ', blue: 'ሰማያዊ', grey: 'ግራጫ', gray: 'ግራጫ', charcoal: 'ጥቁር ግራጫ', brown: 'ቡናማ', beige: 'ቢዥ', cream: 'ክሬም',
  khaki: 'ካኪ', green: 'አረንጓዴ', olive: 'የወይራ አረንጓዴ', red: 'ቀይ', burgundy: 'ወይን ጠጅ', maroon: 'ወይን ጠጅ', camel: 'ቡናማ ቢጫ', tan: 'ቀላ ያለ ቡናማ', gold: 'ወርቃማ', silver: 'ብር',
  // fit / style / material
  slim: 'ጠባብ ልክ', regular: 'መደበኛ ልክ', classic: 'ክላሲክ', modern: 'ዘመናዊ', formal: 'የክብር', casual: 'የዘወትር', wedding: 'የሰርግ', office: 'የቢሮ', sport: 'የስፖርት',
  cotton: 'ጥጥ', linen: 'ተልባ', wool: 'ሱፍ', leather: 'ቆዳ', silk: 'ሐር', denim: 'ጂንስ ጨርቅ', 'double-breasted': 'ባለ ሁለት ረድፍ', 'three-piece': 'ባለ ሶስት ቁራጭ', 'two-piece': 'ባለ ሁለት ቁራጭ',
  long: 'ረጅም', short: 'አጭር', sleeve: 'እጅጌ', zip: 'ዚፕ', collar: 'ኮሌታ', mandarin: 'ማንዳሪን', essential: 'መሰረታዊ', premium: 'ፕሪሚየም', original: 'ኦሪጅናል', new: 'አዲስ',
  turkish: 'የቱርክ', italian: 'የጣሊያን', ethiopian: 'የኢትዮጵያ', men: 'የወንዶች', "men's": 'የወንዶች',
};
const COUNTRY: Record<string, string> = { turkey: 'ቱርክ', italy: 'ጣሊያን', china: 'ቻይና', ethiopia: 'ኢትዮጵያ', uae: 'ዱባይ', dubai: 'ዱባይ', india: 'ህንድ', france: 'ፈረንሳይ', usa: 'አሜሪካ', vietnam: 'ቬትናም' };

/** Garment words go last in Amharic ("Navy Slim Suit" → "ደማቅ ሰማያዊ ጠባብ ልክ ሱፍ ልብስ"). */
const GARMENTS = new Set(['suit', 'suits', 'tuxedo', 'blazer', 'jacket', 'coat', 'vest', 'waistcoat', 'shirt', 'shirts', 'tee', 't-shirt', 'tshirt', 'polo', 'sweater', 'knit', 'hoodie', 'cardigan', 'trousers', 'trouser', 'pants', 'chinos', 'jeans', 'shorts', 'tracksuit', 'jelabiya', 'kaftan', 'thobe', 'shoes', 'shoe', 'sneakers', 'sneaker', 'loafers', 'boots', 'sandals', 'slippers', 'perfume', 'fragrance', 'watch', 'belt', 'tie', 'wallet', 'cap', 'socks']);

export function suggestAmharicName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const front: string[] = [];
  const back: string[] = [];
  for (const w of words) {
    const key = w.toLowerCase().replace(/[^a-z'-]/g, '');
    const am = WORDS[key];
    if (!am) front.push(w); // brand / model name: keep as written
    else if (GARMENTS.has(key)) back.push(am);
    else front.push(am);
  }
  return [...front, ...back].join(' ');
}

export function suggestAmharicDescription(p: { nameEn: string; material?: string; fit?: string; origin?: string; categoryAm?: string }): string {
  const parts: string[] = [];
  const name = suggestAmharicName(p.nameEn);
  parts.push(`${name}።`);
  if (p.material) parts.push(`ጨርቅ፦ ${suggestAmharicName(p.material)}።`);
  if (p.fit) parts.push(`ልክ፦ ${suggestAmharicName(p.fit)}።`);
  if (p.origin) parts.push(`የተሰራበት፦ ${COUNTRY[p.origin.trim().toLowerCase()] ?? p.origin}።`);
  parts.push('በአዲስ አበባ ነፃ ማድረስ፤ ቤተል ሱቃችን መጥተው መውሰድም ይችላሉ።');
  return parts.join(' ');
}
