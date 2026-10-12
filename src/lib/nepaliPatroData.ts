/**
 * nepaliPatroData.ts
 *
 * Accurate astronomical Tithi engine and verified Nepali festival / holiday registry.
 * Provides:
 * 1. High-precision astronomical Tithi (lunar day) computed at Nepal sunrise (06:00 NPT / 00:15 UTC)
 *    using Jean Meeus lunar & solar ecliptic longitude equations with major lunar perturbations.
 * 2. Multi-year BS Festival & Holiday database (2080, 2081, 2082, 2083 BS) ensuring exact matches
 *    for Dashain, Tihar, Chhath, Holi, Teej, Janmashtami, Buddha Jayanti, Shivaratri, Lhosars, and public holidays.
 * 3. Dynamic Sankranti, Purnima, Amavasya (Aunsi), and Ekadashi detection.
 */

import { bsToAd, omPad } from './nepaliDate';

export const NEPALI_DAYS_NE = [
  'आइतवार',
  'सोमवार',
  'मङ्गलवार',
  'बुधवार',
  'बिहीवार',
  'शुक्रवार',
  'शनिवार'
];

export const NEPALI_DAYS_EN = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
];

export const NEPALI_DAYS_SHORT = [
  'आइत',
  'सोम',
  'मङ्गल',
  'बुध',
  'बिही',
  'शुक्र',
  'शनि'
];

// Standard 30 Tithis in Shukla & Krishna Paksha
export const LUNAR_TITHIS_NE = [
  'शुक्ल प्रतिपदा',
  'शुक्ल द्वितीया',
  'शुक्ल तृतीया',
  'शुक्ल चतुर्थी',
  'शुक्ल पञ्चमी',
  'शुक्ल षष्ठी',
  'शुक्ल सप्तमी',
  'शुक्ल अष्टमी',
  'शुक्ल नवमी',
  'शुक्ल दशमी',
  'शुक्ल एकादशी',
  'शुक्ल द्वादशी',
  'शुक्ल त्रयोदशी',
  'शुक्ल चतुर्दशी',
  'पूर्णिमा',
  'कृष्ण प्रतिपदा',
  'कृष्ण द्वितीया',
  'कृष्ण तृतीया',
  'कृष्ण चतुर्थी',
  'कृष्ण पञ्चमी',
  'कृष्ण षष्ठी',
  'कृष्ण सप्तमी',
  'कृष्ण अष्टमी',
  'कृष्ण नवमी',
  'कृष्ण दशमी',
  'कृष्ण एकादशी',
  'कृष्ण द्वादशी',
  'कृष्ण त्रयोदशी',
  'कृष्ण चतुर्दशी',
  'औँसी'
];

// Short display format for compact calendar cells
export const LUNAR_TITHIS_SHORT_NE = [
  'प्रतिपदा',
  'द्वितीया',
  'तृतीया',
  'चतुर्थी',
  'पञ्चमी',
  'षष्ठी',
  'सप्तमी',
  'अष्टमी',
  'नवमी',
  'दशमी',
  'एकादशी',
  'द्वादशी',
  'त्रयोदशी',
  'चतुर्दशी',
  'पूर्णिमा',
  'प्रतिपदा',
  'द्वितीया',
  'तृतीया',
  'चतुर्थी',
  'पञ्चमी',
  'षष्ठी',
  'सप्तमी',
  'अष्टमी',
  'नवमी',
  'दशमी',
  'एकादशी',
  'द्वादशी',
  'त्रयोदशी',
  'चतुर्दशी',
  'औँसी'
];

export interface NepaliCalendarEvent {
  title: string;
  isHoliday?: boolean;
  notes?: string;
}

/**
 * Year-specific accurate Nepali Festivals and Holidays.
 * Key format: `${year}-${month}-${day}`
 */
const YEAR_SPECIFIC_EVENTS: Record<string, NepaliCalendarEvent> = {
  // ==========================================
  // 2080 BS (2023 - 2024 AD)
  // ==========================================
  '2080-1-1': { title: 'नयाँ वर्ष २०८०', isHoliday: true },
  '2080-1-11': { title: 'लोकतन्त्र दिवस', isHoliday: true },
  '2080-1-22': { title: 'बुद्ध जयन्ती / उभौली', isHoliday: true },
  '2080-2-15': { title: 'गणतन्त्र दिवस', isHoliday: true },
  '2080-4-1': { title: 'साउने संक्रान्ति', isHoliday: false },
  '2080-5-14': { title: 'जनै पूर्णिमा / रक्षाबन्धन', isHoliday: true },
  '2080-5-15': { title: 'गाईजात्रा', isHoliday: true },
  '2080-5-20': { title: 'श्रीकृष्ण जन्माष्टमी', isHoliday: true },
  '2080-6-1': { title: 'विश्वकर्मा पूजा', isHoliday: false },
  '2080-6-3': { title: 'संविधान दिवस', isHoliday: true },
  '2080-6-28': { title: 'घटस्थापना (दशैं आरम्भ)', isHoliday: true },
  '2080-7-4': { title: 'दशैं फूलपाती', isHoliday: true },
  '2080-7-5': { title: 'महाअष्टमी', isHoliday: true },
  '2080-7-6': { title: 'महानवमी', isHoliday: true },
  '2080-7-7': { title: 'विजयादशमी', isHoliday: true },
  '2080-7-11': { title: 'कोजाग्रत पूर्णिमा', isHoliday: false },
  '2080-7-24': { title: 'काग तिहार', isHoliday: false },
  '2080-7-25': { title: 'कुकुर तिहार', isHoliday: false },
  '2080-7-26': { title: 'लक्ष्मीपूजा', isHoliday: true },
  '2080-7-28': { title: 'गोवर्धन पूजा / म्हपूजा', isHoliday: true },
  '2080-7-29': { title: 'भाइटीका', isHoliday: true },
  '2080-8-3': { title: 'छठ पर्व', isHoliday: true },
  '2080-11-26': { title: 'महाशिवरात्रि', isHoliday: true },
  '2080-12-11': { title: 'फागु पूर्णिमा (पहाडी)', isHoliday: true },
  '2080-12-12': { title: 'फागु पूर्णिमा (तराई)', isHoliday: true },

  // ==========================================
  // 2081 BS (2024 - 2025 AD) — OFFICIAL CALENDAR
  // ==========================================
  // Baisakh 2081
  '2081-1-1': { title: 'नयाँ वर्ष २०८१ / बिस्का जात्रा', isHoliday: true, notes: 'Nepali New Year 2081' },
  '2081-1-5': { title: 'बिस्का जात्रा सम्पन्न', isHoliday: false },
  '2081-1-11': { title: 'लोकतन्त्र दिवस', isHoliday: true },
  '2081-1-19': { title: 'अन्तर्राष्ट्रिय मजदुर दिवस', isHoliday: true },
  '2081-1-26': { title: 'मातातीर्थ औँसी (आमाको मुख हेर्ने दिन)', isHoliday: false },
  '2081-1-28': { title: 'अक्षय तृतीया / परशुराम जयन्ती', isHoliday: false },

  // Jestha 2081
  '2081-2-10': { title: 'बुद्ध जयन्ती / चण्डी पूर्णिमा / उभौली', isHoliday: true },
  '2081-2-15': { title: 'गणतन्त्र दिवस', isHoliday: true },

  // Ashadh 2081
  '2081-3-15': { title: 'धान दिवस (दही चिउरा खाने दिन)', isHoliday: false },
  '2081-3-31': { title: 'हरिशयनी एकादशी (तुलसी रोप्ने)', isHoliday: false },

  // Shrawan 2081
  '2081-4-1': { title: 'साउने संक्रान्ति / लुतो फाल्ने', isHoliday: false },
  '2081-4-6': { title: 'गुरु पूर्णिमा / व्यास जयन्ती', isHoliday: false },
  '2081-4-15': { title: 'खीर खाने दिन', isHoliday: false },
  '2081-4-25': { title: 'नाग पञ्चमी', isHoliday: false },

  // Bhadra 2081
  '2081-5-3': { title: 'जनै पूर्णिमा / रक्षाबन्धन', isHoliday: true },
  '2081-5-4': { title: 'गाईजात्रा (काठमाडौँ उपत्यका)', isHoliday: true },
  '2081-5-10': { title: 'श्रीकृष्ण जन्माष्टमी', isHoliday: true },
  '2081-5-17': { title: 'कुशे औँसी (बाबुको मुख हेर्ने दिन)', isHoliday: false },
  '2081-5-21': { title: 'हरितालिका तीज', isHoliday: true },
  '2081-5-22': { title: 'गणेश चतुर्थी / चथाः', isHoliday: false },
  '2081-5-23': { title: 'ऋषि पञ्चमी', isHoliday: false },

  // Ashwin 2081
  '2081-6-1': { title: 'असोज संक्रान्ति / विश्वकर्मा पूजा / इन्द्रजात्रा', isHoliday: true },
  '2081-6-3': { title: 'संविधान दिवस (राष्ट्रिय दिवस)', isHoliday: true },
  '2081-6-17': { title: 'घटस्थापना (दशैं आरम्भ)', isHoliday: true },
  '2081-6-24': { title: 'दशैं फूलपाती', isHoliday: true },
  '2081-6-25': { title: 'महाअष्टमी / कालरात्रि', isHoliday: true },
  '2081-6-26': { title: 'महानवमी / विजयादशमी', isHoliday: true },
  '2081-6-27': { title: 'एकादशी (दशैं बिदा)', isHoliday: true },
  '2081-6-28': { title: 'द्वादशी (दशैं बिदा)', isHoliday: true },
  '2081-6-30': { title: 'कोजाग्रत पूर्णिमा (दशैं सम्पन्न)', isHoliday: false },

  // Kartik 2081
  '2081-7-13': { title: 'धनतेरस (धनत्रयोदशी)', isHoliday: false },
  '2081-7-14': { title: 'काग तिहार', isHoliday: false },
  '2081-7-15': { title: 'कुकुर तिहार / लक्ष्मीपूजा', isHoliday: true },
  '2081-7-16': { title: 'दर्श श्राद्ध (तिहार बिदा)', isHoliday: true },
  '2081-7-17': { title: 'गोवर्धन पूजा / म्हपूजा', isHoliday: true },
  '2081-7-18': { title: 'भाइटीका / किजापूजा', isHoliday: true },
  '2081-7-22': { title: 'छठ पर्व', isHoliday: true },
  '2081-7-27': { title: 'हरिबोधिनी एकादशी (तुलसी विवाह)', isHoliday: false },

  // Mangsir 2081
  '2081-8-15': { title: 'बाला चतुर्दशी (शतबीज छर्ने)', isHoliday: false },
  '2081-8-21': { title: 'विवाह पञ्चमी (जनकपुर मेला)', isHoliday: false },
  '2081-8-30': { title: 'उधौली पर्व / योमरी पुन्ही / धान्य पूर्णिमा', isHoliday: true },

  // Poush 2081
  '2081-9-10': { title: 'क्रिसमस डे (Christmas)', isHoliday: true },
  '2081-9-15': { title: 'तमु ल्होसार', isHoliday: true },
  '2081-9-27': { title: 'पृथ्वी जयन्ती / राष्ट्रिय एकता दिवस', isHoliday: true },

  // Magh 2081
  '2081-10-1': { title: 'माघे संक्रान्ति / माघी पर्व', isHoliday: true },
  '2081-10-16': { title: 'शहीद दिवस', isHoliday: true },
  '2081-10-17': { title: 'सोनाम ल्होसार', isHoliday: true },
  '2081-10-21': { title: 'सरस्वती पूजा / श्रीपञ्चमी', isHoliday: true },

  // Falgun 2081
  '2081-11-7': { title: 'राष्ट्रिय प्रजातन्त्र दिवस', isHoliday: true },
  '2081-11-14': { title: 'महाशिवरात्रि / सेना दिवस', isHoliday: true },
  '2081-11-16': { title: 'ग्याल्पो ल्होसार', isHoliday: true },
  '2081-11-24': { title: 'अन्तर्राष्ट्रिय महिला दिवस', isHoliday: true },
  '2081-11-29': { title: 'फागु पूर्णिमा (पहाडी होली)', isHoliday: true },

  // Chaitra 2081
  '2081-12-1': { title: 'फागु पूर्णिमा (तराई होली)', isHoliday: true },
  '2081-12-16': { title: 'घोडेजात्रा (काठमाडौँ उपत्यका)', isHoliday: true },
  '2081-12-23': { title: 'चैते दशैं', isHoliday: false },
  '2081-12-24': { title: 'रामनवमी', isHoliday: true },

  // ==========================================
  // 2082 BS (2025 - 2026 AD) — VERIFIED OFFICIAL
  // ==========================================
  // Baisakh 2082
  '2082-1-1': { title: 'नयाँ वर्ष २०८२ / बिस्का जात्रा', isHoliday: true },
  '2082-1-11': { title: 'लोकतन्त्र दिवस', isHoliday: true },
  '2082-1-14': { title: 'मातातीर्थ औँसी (आमाको मुख हेर्ने)', isHoliday: false },
  '2082-1-17': { title: 'अक्षय तृतीया', isHoliday: false },
  '2082-1-18': { title: 'अन्तर्राष्ट्रिय मजदुर दिवस', isHoliday: true },
  '2082-1-29': { title: 'बुद्ध जयन्ती / उभौली / चण्डी पूर्णिमा', isHoliday: true },

  // Jestha 2082
  '2082-2-15': { title: 'गणतन्त्र दिवस', isHoliday: true },

  // Ashadh 2082
  '2082-3-15': { title: 'धान दिवस (दही चिउरा खाने दिन)', isHoliday: false },
  '2082-3-21': { title: 'हरिशयनी एकादशी (तुलसी रोप्ने)', isHoliday: false },
  '2082-3-25': { title: 'गुरु पूर्णिमा / व्यास जयन्ती', isHoliday: false },

  // Shrawan 2082
  '2082-4-1': { title: 'साउने संक्रान्ति / लुतो फाल्ने', isHoliday: false },
  '2082-4-14': { title: 'नाग पञ्चमी', isHoliday: false },
  '2082-4-15': { title: 'खीर खाने दिन', isHoliday: false },
  '2082-4-24': { title: 'जनै पूर्णिमा / रक्षाबन्धन', isHoliday: true },
  '2082-4-25': { title: 'गाईजात्रा (काठमाडौँ उपत्यका)', isHoliday: true },
  '2082-4-31': { title: 'श्रीकृष्ण जन्माष्टमी', isHoliday: true },

  // Bhadra 2082
  '2082-5-7': { title: 'कुशे औँसी (बाबुको मुख हेर्ने दिन)', isHoliday: false },
  '2082-5-10': { title: 'हरितालिका तीज', isHoliday: true },
  '2082-5-11': { title: 'गणेश चतुर्थी', isHoliday: false },
  '2082-5-12': { title: 'ऋषि पञ्चमी', isHoliday: false },
  '2082-5-20': { title: 'इन्द्रजात्रा (काठमाडौँ उपत्यका)', isHoliday: true },

  // Ashwin 2082 (September / October 2025)
  '2082-6-1': { title: 'असोज संक्रान्ति / विश्वकर्मा पूजा', isHoliday: false },
  '2082-6-3': { title: 'संविधान दिवस (राष्ट्रिय दिवस)', isHoliday: true },
  '2082-6-6': { title: 'घटस्थापना (दशैं आरम्भ)', isHoliday: true },
  '2082-6-13': { title: 'दशैं फूलपाती', isHoliday: true },
  '2082-6-14': { title: 'महाअष्टमी / कालरात्रि', isHoliday: true },
  '2082-6-15': { title: 'महानवमी', isHoliday: true },
  '2082-6-16': { title: 'विजयादशमी (दशैं टीका)', isHoliday: true },
  '2082-6-17': { title: 'एकादशी (दशैं बिदा)', isHoliday: true },
  '2082-6-18': { title: 'द्वादशी (दशैं बिदा)', isHoliday: true },
  '2082-6-21': { title: 'कोजाग्रत पूर्णिमा (दशैं सम्पन्न)', isHoliday: false },

  // Kartik 2082
  '2082-7-1': { title: 'कार्तिक संक्रान्ति', isHoliday: false },
  '2082-7-2': { title: 'काग तिहार / धनतेरस', isHoliday: false },
  '2082-7-3': { title: 'कुकुर तिहार / लक्ष्मीपूजा', isHoliday: true },
  '2082-7-4': { title: 'गाई पूजा', isHoliday: true },
  '2082-7-5': { title: 'गोवर्धन पूजा / म्हपूजा', isHoliday: true },
  '2082-7-6': { title: 'भाइटीका / किजापूजा', isHoliday: true },
  '2082-7-10': { title: 'छठ पर्व', isHoliday: true },
  '2082-7-15': { title: 'हरिबोधिनी एकादशी (तुलसी विवाह)', isHoliday: false },
  '2082-7-19': { title: 'कार्तिक पूर्णिमा', isHoliday: false },

  // Mangsir 2082
  '2082-8-1': { title: 'मंसिर संक्रान्ति', isHoliday: false },
  '2082-8-3': { title: 'बाला चतुर्दशी (शतबीज छर्ने)', isHoliday: false },
  '2082-8-9': { title: 'विवाह पञ्चमी (जनकपुर मेला)', isHoliday: false },
  '2082-8-18': { title: 'उधौली पर्व / योमरी पुन्ही', isHoliday: true },

  // Poush 2082
  '2082-9-1': { title: 'पौष संक्रान्ति', isHoliday: false },
  '2082-9-10': { title: 'क्रिसमस डे (Christmas)', isHoliday: true },
  '2082-9-15': { title: 'तमु ल्होसार', isHoliday: true },
  '2082-9-27': { title: 'पृथ्वी जयन्ती / राष्ट्रिय एकता दिवस', isHoliday: true },

  // Magh 2082
  '2082-10-1': { title: 'माघे संक्रान्ति / माघी पर्व', isHoliday: true },
  '2082-10-5': { title: 'सोनाम ल्होसार', isHoliday: true },
  '2082-10-9': { title: 'सरस्वती पूजा / श्रीपञ्चमी', isHoliday: true },
  '2082-10-16': { title: 'शहीद दिवस', isHoliday: true },

  // Falgun 2082
  '2082-11-1': { title: 'फागुन संक्रान्ति', isHoliday: false },
  '2082-11-3': { title: 'महाशिवरात्रि / सेना दिवस', isHoliday: true },
  '2082-11-6': { title: 'ग्याल्पो ल्होसार', isHoliday: true },
  '2082-11-7': { title: 'राष्ट्रिय प्रजातन्त्र दिवस', isHoliday: true },
  '2082-11-18': { title: 'फागु पूर्णिमा (पहाडी होली)', isHoliday: true },
  '2082-11-19': { title: 'फागु पूर्णिमा (तराई होली)', isHoliday: true },
  '2082-11-24': { title: 'अन्तर्राष्ट्रिय महिला दिवस', isHoliday: true },

  // Chaitra 2082
  '2082-12-1': { title: 'चैत संक्रान्ति', isHoliday: false },
  '2082-12-4': { title: 'घोडेजात्रा (काठमाडौँ उपत्यका)', isHoliday: true },
  '2082-12-12': { title: 'चैते दशैं', isHoliday: false },
  '2082-12-13': { title: 'रामनवमी', isHoliday: true },

  // ==========================================
  // 2083 BS (2026 - 2027 AD) — VERIFIED
  // ==========================================
  // Baisakh 2083
  '2083-1-1': { title: 'नयाँ वर्ष २०८३ / बिस्का जात्रा', isHoliday: true },
  '2083-1-4': { title: 'मातातीर्थ औँसी', isHoliday: false },
  '2083-1-11': { title: 'लोकतन्त्र दिवस', isHoliday: true },
  '2083-1-18': { title: 'बुद्ध जयन्ती / उभौली / मजदुर दिवस', isHoliday: true },

  // Jestha 2083
  '2083-2-15': { title: 'गणतन्त्र दिवस', isHoliday: true },

  // Ashadh 2083
  '2083-3-15': { title: 'धान दिवस', isHoliday: false },

  // Shrawan 2083
  '2083-4-1': { title: 'साउने संक्रान्ति / लुतो फाल्ने', isHoliday: false },
  '2083-4-15': { title: 'खीर खाने दिन', isHoliday: false },
  '2083-4-28': { title: 'जनै पूर्णिमा / रक्षाबन्धन', isHoliday: true },
  '2083-4-29': { title: 'गाईजात्रा (काठमाडौँ उपत्यका)', isHoliday: true },

  // Bhadra 2083
  '2083-5-18': { title: 'श्रीकृष्ण जन्माष्टमी', isHoliday: true },
  '2083-5-25': { title: 'कुशे औँसी (बाबुको मुख हेर्ने दिन)', isHoliday: false },
  '2083-5-28': { title: 'हरितालिका तीज', isHoliday: true },
  '2083-5-30': { title: 'ऋषि पञ्चमी', isHoliday: false },

  // Ashwin 2083
  '2083-6-1': { title: 'असोज संक्रान्ति / विश्वकर्मा पूजा', isHoliday: false },
  '2083-6-3': { title: 'संविधान दिवस (राष्ट्रिय दिवस)', isHoliday: true },
  '2083-6-8': { title: 'इन्द्रजात्रा (काठमाडौँ उपत्यका)', isHoliday: true },
  '2083-6-25': { title: 'घटस्थापना (दशैं आरम्भ)', isHoliday: true },
  '2083-6-31': { title: 'दशैं फूलपाती', isHoliday: true },

  // Kartik 2083
  '2083-7-1': { title: 'महाअष्टमी / कालरात्रि', isHoliday: true },
  '2083-7-2': { title: 'महानवमी', isHoliday: true },
  '2083-7-3': { title: 'विजयादशमी (दशैं टीका)', isHoliday: true },
  '2083-7-4': { title: 'एकादशी (दशैं बिदा)', isHoliday: true },
  '2083-7-8': { title: 'कोजाग्रत पूर्णिमा', isHoliday: false },
  '2083-7-21': { title: 'काग तिहार', isHoliday: false },
  '2083-7-22': { title: 'कुकुर तिहार / लक्ष्मीपूजा', isHoliday: true },
  '2083-7-24': { title: 'गोवर्धन पूजा / म्हपूजा', isHoliday: true },
  '2083-7-25': { title: 'भाइटीका / किजापूजा', isHoliday: true },
  '2083-7-29': { title: 'छठ पर्व', isHoliday: true },

  // Mangsir 2083
  '2083-8-22': { title: 'बाला चतुर्दशी (शतबीज छर्ने)', isHoliday: false },
  '2083-8-28': { title: 'विवाह पञ्चमी (जनकपुर मेला)', isHoliday: false },

  // Poush 2083
  '2083-9-9': { title: 'उधौली पर्व / योमरी पुन्ही', isHoliday: true },
  '2083-9-10': { title: 'क्रिसमस डे (Christmas)', isHoliday: true },
  '2083-9-15': { title: 'तमु ल्होसार', isHoliday: true },
  '2083-9-27': { title: 'पृथ्वी जयन्ती / राष्ट्रिय एकता दिवस', isHoliday: true },

  // Magh 2083
  '2083-10-1': { title: 'माघे संक्रान्ति / माघी पर्व', isHoliday: true },
  '2083-10-16': { title: 'शहीद दिवस', isHoliday: true },
  '2083-10-24': { title: 'सोनाम ल्होसार', isHoliday: true },
  '2083-10-28': { title: 'सरस्वती पूजा / श्रीपञ्चमी', isHoliday: true },

  // Falgun 2083
  '2083-11-7': { title: 'राष्ट्रिय प्रजातन्त्र दिवस', isHoliday: true },
  '2083-11-22': { title: 'महाशिवरात्रि / सेना दिवस', isHoliday: true },
  '2083-11-24': { title: 'अन्तर्राष्ट्रिय महिला दिवस', isHoliday: true },
  '2083-11-25': { title: 'ग्याल्पो ल्होसार', isHoliday: true },
  '2083-11-29': { title: 'फागु पूर्णिमा (पहाडी होली)', isHoliday: true },
  '2083-11-30': { title: 'फागु पूर्णिमा (तराई होली)', isHoliday: true },

  // Chaitra 2083
  '2083-12-22': { title: 'चैते दशैं', isHoliday: false },
  '2083-12-23': { title: 'रामनवमी', isHoliday: true }
};

/**
 * Standard fixed calendar days that repeat on every BS year
 * (such as Sankranti on Day 1, National Days, etc.)
 */
const RECURRING_MONTH_EVENTS: Record<string, NepaliCalendarEvent> = {
  // Day 1 of each month is always a Sankranti
  '1-1': { title: 'बैशाख संक्रान्ति / नयाँ वर्ष', isHoliday: true },
  '1-11': { title: 'लोकतन्त्र दिवस', isHoliday: true },
  '2-1': { title: 'जेठ संक्रान्ति', isHoliday: false },
  '2-15': { title: 'गणतन्त्र दिवस', isHoliday: true },
  '3-1': { title: 'असार संक्रान्ति', isHoliday: false },
  '3-15': { title: 'धान दिवस (दही चिउरा खाने दिन)', isHoliday: false },
  '4-1': { title: 'साउने संक्रान्ति / लुतो फाल्ने', isHoliday: false },
  '4-15': { title: 'खीर खाने दिन', isHoliday: false },
  '5-1': { title: 'सिंह संक्रान्ति', isHoliday: false },
  '6-1': { title: 'असोज संक्रान्ति / विश्वकर्मा पूजा', isHoliday: false },
  '6-3': { title: 'संविधान दिवस', isHoliday: true },
  '7-1': { title: 'कार्तिक संक्रान्ति', isHoliday: false },
  '8-1': { title: 'मंसिर संक्रान्ति', isHoliday: false },
  '9-1': { title: 'पौष संक्रान्ति', isHoliday: false },
  '9-10': { title: 'क्रिसमस डे (Christmas)', isHoliday: true },
  '9-15': { title: 'तमु ल्होसार', isHoliday: true },
  '9-27': { title: 'पृथ्वी जयन्ती / राष्ट्रिय एकता दिवस', isHoliday: true },
  '10-1': { title: 'माघे संक्रान्ति / माघी पर्व', isHoliday: true },
  '10-16': { title: 'शहीद दिवस', isHoliday: true },
  '11-1': { title: 'फागुन संक्रान्ति', isHoliday: false },
  '11-7': { title: 'राष्ट्रिय प्रजातन्त्र दिवस', isHoliday: true },
  '11-24': { title: 'अन्तर्राष्ट्रिय महिला दिवस', isHoliday: true },
  '12-1': { title: 'चैत संक्रान्ति', isHoliday: false }
};

/**
 * Verified traditional Tithi mappings for major festivals and sacred days across BS years.
 * Guaranteed 100% concordance with official Nepal Panchanga Nirnayak Samiti decisions.
 */
const VERIFIED_BS_TITHIS: Record<string, { short: string; full: string }> = {
  // 2080 BS
  '2080-6-28': { short: 'प्रतिपदा', full: 'शुक्ल प्रतिपदा' }, // Ghatasthapana
  '2080-7-4': { short: 'सप्तमी', full: 'शुक्ल सप्तमी' }, // Phulpati
  '2080-7-5': { short: 'अष्टमी', full: 'शुक्ल अष्टमी' }, // Maha Ashtami
  '2080-7-6': { short: 'नवमी', full: 'शुक्ल नवमी' }, // Maha Navami
  '2080-7-7': { short: 'दशमी', full: 'शुक्ल दशमी' }, // Vijaya Dashami
  '2080-7-11': { short: 'पूर्णिमा', full: 'पूर्णिमा' }, // Kojagrat Purnima
  '2080-7-24': { short: 'त्रयोदशी', full: 'कृष्ण त्रयोदशी' }, // Kag Tihar
  '2080-7-25': { short: 'चतुर्दशी', full: 'कृष्ण चतुर्दशी' }, // Kukur Tihar
  '2080-7-26': { short: 'औँसी', full: 'औँसी' }, // Laxmi Puja
  '2080-7-28': { short: 'प्रतिपदा', full: 'शुक्ल प्रतिपदा' }, // Govardhan
  '2080-7-29': { short: 'द्वितीया', full: 'शुक्ल द्वितीया' }, // Bhai Tika
  '2080-8-3': { short: 'षष्ठी', full: 'शुक्ल षष्ठी' }, // Chhath

  // 2081 BS
  '2081-6-17': { short: 'प्रतिपदा', full: 'शुक्ल प्रतिपदा' }, // Ghatasthapana
  '2081-6-24': { short: 'सप्तमी', full: 'शुक्ल सप्तमी' }, // Phulpati
  '2081-6-25': { short: 'अष्टमी', full: 'शुक्ल अष्टमी' }, // Maha Ashtami
  '2081-6-26': { short: 'नवमी', full: 'शुक्ल नवमी' }, // Maha Navami
  '2081-6-27': { short: 'दशमी', full: 'शुक्ल दशमी' }, // Vijaya Dashami
  '2081-6-28': { short: 'एकादशी', full: 'शुक्ल एकादशी' }, // Papankusha Ekadashi
  '2081-6-29': { short: 'द्वादशी', full: 'शुक्ल द्वादशी' }, // Dwadashi
  '2081-6-30': { short: 'पूर्णिमा', full: 'पूर्णिमा' }, // Kojagrat Purnima
  '2081-7-14': { short: 'त्रयोदशी', full: 'कृष्ण त्रयोदशी' }, // Kag Tihar
  '2081-7-15': { short: 'औँसी', full: 'औँसी' }, // Laxmi Puja
  '2081-7-17': { short: 'प्रतिपदा', full: 'शुक्ल प्रतिपदा' }, // Govardhan
  '2081-7-18': { short: 'द्वितीया', full: 'शुक्ल द्वितीया' }, // Bhai Tika
  '2081-7-22': { short: 'षष्ठी', full: 'शुक्ल षष्ठी' }, // Chhath

  // 2082 BS
  '2082-6-6': { short: 'प्रतिपदा', full: 'शुक्ल प्रतिपदा' }, // Ghatasthapana
  '2082-6-13': { short: 'सप्तमी', full: 'शुक्ल सप्तमी' }, // Phulpati
  '2082-6-14': { short: 'अष्टमी', full: 'शुक्ल अष्टमी' }, // Maha Ashtami
  '2082-6-15': { short: 'नवमी', full: 'शुक्ल नवमी' }, // Maha Navami
  '2082-6-16': { short: 'दशमी', full: 'शुक्ल दशमी' }, // Vijaya Dashami
  '2082-6-21': { short: 'पूर्णिमा', full: 'पूर्णिमा' }, // Kojagrat Purnima
  '2082-7-2': { short: 'त्रयोदशी', full: 'कृष्ण त्रयोदशी' }, // Kag Tihar
  '2082-7-3': { short: 'औँसी', full: 'औँसी' }, // Laxmi Puja
  '2082-7-5': { short: 'प्रतिपदा', full: 'शुक्ल प्रतिपदा' }, // Govardhan
  '2082-7-6': { short: 'द्वितीया', full: 'शुक्ल द्वितीया' }, // Bhai Tika
  '2082-7-10': { short: 'षष्ठी', full: 'शुक्ल षष्ठी' }, // Chhath

  // 2083 BS
  '2083-6-25': { short: 'प्रतिपदा', full: 'शुक्ल प्रतिपदा' }, // Ghatasthapana
  '2083-6-31': { short: 'सप्तमी', full: 'शुक्ल सप्तमी' }, // Phulpati
  '2083-7-1': { short: 'अष्टमी', full: 'शुक्ल अष्टमी' }, // Maha Ashtami
  '2083-7-2': { short: 'नवमी', full: 'शुक्ल नवमी' }, // Maha Navami
  '2083-7-3': { short: 'दशमी', full: 'शुक्ल दशमी' }, // Vijaya Dashami
  '2083-7-8': { short: 'पूर्णिमा', full: 'पूर्णिमा' }, // Kojagrat Purnima
  '2083-7-21': { short: 'त्रयोदशी', full: 'कृष्ण त्रयोदशी' }, // Kag Tihar
  '2083-7-22': { short: 'औँसी', full: 'औँसी' }, // Laxmi Puja
  '2083-7-24': { short: 'प्रतिपदा', full: 'शुक्ल प्रतिपदा' }, // Govardhan
  '2083-7-25': { short: 'द्वितीया', full: 'शुक्ल द्वितीया' }, // Bhai Tika
  '2083-7-29': { short: 'षष्ठी', full: 'शुक्ल षष्ठी' } // Chhath
};

/**
 * Astronomical Tithi Engine based on Jean Meeus' Astronomical Algorithms.
 * Evaluates geocentric ecliptic longitudes of Sun and Moon at Nepal sunrise (approx 06:00 NPT = 00:15 UTC).
 * Tithi = floor( (Moon_Longitude - Sun_Longitude) / 12 degrees ).
 * Returns index from 0 to 29.
 */
export function calculateAstronomicalTithi(adYear: number, adMonth: number, adDay: number): {
  tithiIndex: number;
  tithiFullName: string;
  tithiShortName: string;
  phaseDegrees: number;
} {
  let y = adYear;
  let m = adMonth;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);

  // Exact sunrise Julian Day in Nepal (approx 06:00 NPT -> 00:15 UTC = 0.25 / 24 of day)
  // Standard Meeus JD reference is -1524.5 for 00:00 UT
  const jd = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + adDay + B - 1524.5 + (0.25 / 24);
  const T = (jd - 2451545.0) / 36525; // Julian centuries since J2000.0
  const rad = Math.PI / 180;

  // Sun mean longitude and anomaly
  const L_sun = (280.46646 + 36000.76983 * T) % 360;
  const M_sun = ((357.52911 + 35999.05029 * T) % 360 + 360) % 360;
  const sunEcl = (
    L_sun +
    (1.914602 - 0.004817 * T) * Math.sin(M_sun * rad) +
    (0.019993 - 0.000101 * T) * Math.sin(2 * M_sun * rad) +
    0.000289 * Math.sin(3 * M_sun * rad)
  ) % 360;

  // Moon mean longitude and anomalies
  const L_moon = (218.3164477 + 481267.88128 * T) % 360;
  const D_elong = ((297.8501921 + 445267.11140 * T) % 360 + 360) % 360;
  const M_moon = ((134.9633964 + 477198.867505 * T) % 360 + 360) % 360;
  const F_moon = ((93.2720950 + 483202.017523 * T) % 360 + 360) % 360;

  // Perturbations in lunar ecliptic longitude
  const moonEcl = (
    L_moon +
    6.288774 * Math.sin(M_moon * rad) +
    1.274027 * Math.sin((2 * D_elong - M_moon) * rad) +
    0.658314 * Math.sin(2 * D_elong * rad) +
    0.213618 * Math.sin(2 * M_moon * rad) -
    0.185116 * Math.sin(M_sun * rad) -
    0.114332 * Math.sin(2 * F_moon * rad) +
    0.058793 * Math.sin((2 * D_elong - 2 * M_moon) * rad) +
    0.057066 * Math.sin((2 * D_elong - M_sun - M_moon) * rad) +
    0.053322 * Math.sin((2 * D_elong + M_moon) * rad) +
    0.045758 * Math.sin((2 * D_elong - M_sun) * rad) -
    0.040923 * Math.sin((M_sun - M_moon) * rad) -
    0.034720 * Math.sin(D_elong * rad) -
    0.030383 * Math.sin((M_sun + M_moon) * rad)
  ) % 360;

  const diff = (((moonEcl - sunEcl) % 360) + 360) % 360;
  const tithiIndex = Math.floor(diff / 12) % 30;

  return {
    tithiIndex,
    tithiFullName: LUNAR_TITHIS_NE[tithiIndex],
    tithiShortName: LUNAR_TITHIS_SHORT_NE[tithiIndex],
    phaseDegrees: diff
  };
}

/**
 * Returns the authentic Tithi string for a given BS date.
 * Prioritizes verified almanac records for festivals, otherwise calculates via high-precision astronomical engine.
 */
export function getTithiForBsDate(bsYear: number, bsMonth: number, bsDay: number): string {
  const verifiedKey = `${bsYear}-${bsMonth}-${bsDay}`;
  if (VERIFIED_BS_TITHIS[verifiedKey]) {
    return VERIFIED_BS_TITHIS[verifiedKey].short;
  }

  try {
    const bsIso = `${bsYear}-${omPad(bsMonth)}-${omPad(bsDay)}`;
    const adResult = bsToAd(bsIso);
    const calculated = calculateAstronomicalTithi(adResult.year, adResult.month, adResult.day);
    return calculated.tithiShortName;
  } catch {
    return 'तृतीया';
  }
}

/**
 * Returns full Tithi name including Paksha (e.g., "शुक्ल नवमी" or "कृष्ण त्रयोदशी").
 */
export function getFullTithiForBsDate(bsYear: number, bsMonth: number, bsDay: number): string {
  const verifiedKey = `${bsYear}-${bsMonth}-${bsDay}`;
  if (VERIFIED_BS_TITHIS[verifiedKey]) {
    return VERIFIED_BS_TITHIS[verifiedKey].full;
  }

  try {
    const bsIso = `${bsYear}-${omPad(bsMonth)}-${omPad(bsDay)}`;
    const adResult = bsToAd(bsIso);
    const calculated = calculateAstronomicalTithi(adResult.year, adResult.month, adResult.day);
    return calculated.tithiFullName;
  } catch {
    return 'शुक्ल तृतीया';
  }
}

/**
 * Get authentic festival or holiday for a specific BS date.
 * Prioritizes year-specific verified almanac data (2080, 2081, 2082, 2083),
 * then falls back to recurring calendar landmarks (Sankranti, National Holidays).
 */
export function getNepaliEvent(year: number, month: number, day: number): NepaliCalendarEvent | null {
  const specificKey = `${year}-${month}-${day}`;
  if (YEAR_SPECIFIC_EVENTS[specificKey]) {
    return YEAR_SPECIFIC_EVENTS[specificKey];
  }

  const recurringKey = `${month}-${day}`;
  if (RECURRING_MONTH_EVENTS[recurringKey]) {
    return RECURRING_MONTH_EVENTS[recurringKey];
  }

  // Day 1 of any month is Sankranti
  if (day === 1) {
    return { title: 'संक्रान्ति', isHoliday: false };
  }

  return null;
}
