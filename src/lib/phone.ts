/**
 * phone.ts
 * ---------------------------------------------------------------------------
 * التحقق من أرقام الهواتف وتحويلها إلى الصيغة الدولية E.164.
 *
 * الدولة الافتراضية سلطنة عمان (+968). لكل دولة مدعومة نعرف طول الرقم الوطني
 * والبادئات الصحيحة، فلا نقبل رقمًا لا يطابق قواعد دولته.
 *
 * هذا الملف مشترك بين المتصفح والخادم: التحقق يجري في الواجهة لتجربة أفضل،
 * ويُعاد على الخادم لأن تحقق الواجهة وحده لا يُعتمد عليه أمنيًا.
 */

export type Country = {
  iso2: string;
  nameAr: string;
  dialCode: string;
  /** الأطوال المقبولة للرقم الوطني بعد إزالة الصفر الأول */
  nationalLengths: number[];
  /** البادئات المسموحة للرقم الوطني (فارغ = أي بادئة) */
  mobilePrefixes: string[];
  example: string;
};

/** الدول المدعومة — عمان أولًا لأنها الافتراضية. */
export const COUNTRIES: Country[] = [
  { iso2: 'OM', nameAr: 'سلطنة عمان', dialCode: '968', nationalLengths: [8], mobilePrefixes: ['7', '9'], example: '91234567' },
  { iso2: 'AE', nameAr: 'الإمارات', dialCode: '971', nationalLengths: [9], mobilePrefixes: ['5'], example: '501234567' },
  { iso2: 'SA', nameAr: 'السعودية', dialCode: '966', nationalLengths: [9], mobilePrefixes: ['5'], example: '501234567' },
  { iso2: 'QA', nameAr: 'قطر', dialCode: '974', nationalLengths: [8], mobilePrefixes: ['3', '5', '6', '7'], example: '33123456' },
  { iso2: 'BH', nameAr: 'البحرين', dialCode: '973', nationalLengths: [8], mobilePrefixes: ['3'], example: '36123456' },
  { iso2: 'KW', nameAr: 'الكويت', dialCode: '965', nationalLengths: [8], mobilePrefixes: ['5', '6', '9'], example: '51234567' },
  { iso2: 'YE', nameAr: 'اليمن', dialCode: '967', nationalLengths: [9], mobilePrefixes: ['7'], example: '712345678' },
  { iso2: 'JO', nameAr: 'الأردن', dialCode: '962', nationalLengths: [9], mobilePrefixes: ['7'], example: '791234567' },
  { iso2: 'EG', nameAr: 'مصر', dialCode: '20', nationalLengths: [10], mobilePrefixes: ['1'], example: '1012345678' },
  { iso2: 'IQ', nameAr: 'العراق', dialCode: '964', nationalLengths: [10], mobilePrefixes: ['7'], example: '7712345678' },
  { iso2: 'GB', nameAr: 'المملكة المتحدة', dialCode: '44', nationalLengths: [10], mobilePrefixes: ['7'], example: '7400123456' },
  { iso2: 'US', nameAr: 'الولايات المتحدة', dialCode: '1', nationalLengths: [10], mobilePrefixes: [], example: '2025550123' },
  { iso2: 'IN', nameAr: 'الهند', dialCode: '91', nationalLengths: [10], mobilePrefixes: ['6', '7', '8', '9'], example: '9812345678' },
  { iso2: 'PK', nameAr: 'باكستان', dialCode: '92', nationalLengths: [10], mobilePrefixes: ['3'], example: '3001234567' },
  { iso2: 'TR', nameAr: 'تركيا', dialCode: '90', nationalLengths: [10], mobilePrefixes: ['5'], example: '5301234567' },
];

export const DEFAULT_COUNTRY = 'OM';

export function findCountry(iso2: string): Country | undefined {
  return COUNTRIES.find((c) => c.iso2 === iso2);
}

/** يحوّل الأرقام العربية-الهندية (٠١٢…) إلى أرقام لاتينية. */
export function normalizeDigits(input: string): string {
  const arabicIndic = '٠١٢٣٤٥٦٧٨٩';
  const easternArabic = '۰۱۲۳۴۵۶۷۸۹';
  return input.replace(/[٠-٩۰-۹]/g, (ch) => {
    const a = arabicIndic.indexOf(ch);
    if (a >= 0) return String(a);
    return String(easternArabic.indexOf(ch));
  });
}

export type PhoneResult =
  | { ok: true; e164: string; national: string; country: Country }
  | { ok: false; error: string };

/**
 * يتحقق من رقم وطني ضمن دولة محددة ويعيده بصيغة E.164.
 * @param raw   ما كتبه المستخدم (قد يحوي مسافات أو شرطات أو صفرًا في البداية)
 * @param iso2  رمز الدولة المختارة
 */
export function validatePhone(raw: string, iso2: string): PhoneResult {
  const country = findCountry(iso2);
  if (!country) return { ok: false, error: 'الدولة المختارة غير مدعومة.' };

  const digitsOnly = normalizeDigits(raw).replace(/\D/g, '');
  if (!digitsOnly) return { ok: false, error: 'الرجاء إدخال رقم الهاتف.' };

  // نتسامح مع إدخال رمز الدولة أو صفر وطني في البداية ثم نزيلهما.
  let national = digitsOnly;
  if (national.startsWith(country.dialCode) && national.length > country.dialCode.length) {
    national = national.slice(country.dialCode.length);
  }
  national = national.replace(/^0+/, '');

  if (!country.nationalLengths.includes(national.length)) {
    const expected = country.nationalLengths.join(' أو ');
    return {
      ok: false,
      error: `رقم ${country.nameAr} يجب أن يتكوّن من ${expected} أرقام. مثال: ${country.example}`,
    };
  }

  if (country.mobilePrefixes.length > 0 && !country.mobilePrefixes.some((p) => national.startsWith(p))) {
    return {
      ok: false,
      error: `رقم الجوال في ${country.nameAr} يبدأ بـ ${country.mobilePrefixes.join(' أو ')}. مثال: ${country.example}`,
    };
  }

  return { ok: true, e164: `+${country.dialCode}${national}`, national, country };
}

/** صيغة wa.me — أرقام فقط بلا علامة زائد. */
export function toWaMeNumber(e164: string): string {
  return e164.replace(/\D/g, '');
}

/** إخفاء جزئي للعرض العام: +9689****567 */
export function maskPhone(e164: string): string {
  if (e164.length < 7) return '•••';
  return `${e164.slice(0, 5)}${'•'.repeat(Math.max(0, e164.length - 8))}${e164.slice(-3)}`;
}
