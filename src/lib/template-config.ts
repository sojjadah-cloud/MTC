/**
 * template-config.ts
 * ---------------------------------------------------------------------------
 * تخطيط بطاقة الدعوة في مكان واحد.
 *
 * التصميم الرسمي في public/brand/invitation-template.png يحمل كل النصوص
 * الثابتة مطبوعة عليه (دعوة حضور، نص الدعوة، التاريخ، المكان، الفعاليات).
 * لذلك لا يرسم المولّد فوقه سوى شيء واحد: اسم المدعو.
 *
 * الإحداثيات بالبكسل داخل لوحة 1080×1920، الأفقي من اليسار والرأسي من الأعلى.
 * لا تُولَّد الخلفية بالذكاء الاصطناعي ولا يُعاد تصميم الشعارات.
 */

export const CANVAS_WIDTH = 1080;
export const CANVAS_HEIGHT = 1920;

export const TEMPLATE_IMAGE_SRC = '/brand/invitation-template.png';
export const MTC_LOGO_SRC = '/brand/mtc-logo.png';
export const WEEK_LOGO_SRC = '/brand/week-logo.png';

/** ألوان الهوية الرسمية للأسبوع العلمي السابع. */
export const BRAND = {
  purple: '#552e87',
  navy: '#233e7f',
  blue: '#37bced',
  gold: '#f2b031',
  white: '#ffffff',
} as const;

/**
 * شريط اسم المدعو داخل التصميم الرسمي.
 *
 * التصميم المعتمد يحمل اسمًا نموذجيًا مطبوعًا. قبل كتابة اسم الضيف نعيد بناء
 * خلفية هذا الشريط من الصفوف النظيفة أعلاه وأسفله مباشرة — الخلفية هناك تدرّج
 * أملس، فتختفي آثار الاسم القديم بلا أي أثر مرئي.
 *
 * نُبقي الإعادة محصورة أفقيًا بين `left` و`right` حتى لا نمسّ زخارف الدوائر
 * الإلكترونية على حافة التصميم اليسرى.
 */
// الحدود مقيسة من التصميم نفسه: الفاصل الذهبي ينتهي عند y=655، والاسم
// النموذجي يشغل 715–774، وأول سطر من نص الدعوة يبدأ عند y=839. فالفراغ
// الآمن هو 656–838، ونأخذ منه هامشًا من الطرفين.
export const NAME_BAND = {
  top: 664,
  bottom: 834,
  left: 130,
  right: 950,
  /**
   * صفوف نظيفة خارج الشريط تُؤخذ منها الخلفية.
   * الصفّان 657 و658 يحملان الحافة الداكنة أسفل الفاصل الذهبي؛ أخذ العيّنة
   * منهما يمدّ تلك الحافة على كامل الشريط فيظهر مستطيل داكن تحت الفاصل.
   * أول صفّ مستقرّ فعلًا هو 659، ونبدأ من 661 احتياطًا.
   */
  sampleAbove: 661,
  sampleBelow: 836,
  /** تدرّج شفافية على الحافتين يخفي حدود الرقعة */
  feather: 70,
} as const;

export type TextBlock = {
  centerX: number;
  /** أعلى الكتلة — النص يتوسّط الارتفاع المحجوز */
  top: number;
  maxWidth: number;
  fontSize: number;
  /** الارتفاع المحجوز للكتلة، لا تباعد السطر */
  lineHeight: number;
  weight: 400 | 500 | 700 | 800;
  color: string;
};

/**
 * موضع اسم المدعو. مضبوط على التصميم الرسمي: بين الفاصل الذهبي أعلاه ونص
 * الدعوة أسفله. استخدم «شبكة القياس» في صفحة المعاينة لإعادة الضبط لو تغيّر
 * التصميم.
 */
// هامش داخلي: الشريط يُعاد بناؤه كاملًا، لكن النص يبقى داخله بفسحة من
// الطرفين حتى لا يلامس الفاصل الذهبي أعلاه ولا نص الدعوة أسفله.
const NAME_PADDING = 8;

export const GUEST_NAME_BLOCK: TextBlock = {
  centerX: CANVAS_WIDTH / 2,
  top: NAME_BAND.top + NAME_PADDING,
  // عرض أوسع = عدد أقل من الأسماء يضطر للتصغير أو اللف
  maxWidth: 860,
  fontSize: 76,
  lineHeight: NAME_BAND.bottom - NAME_BAND.top - NAME_PADDING * 2,
  weight: 700,
  color: BRAND.gold,
};

/** حدود التصغير التلقائي قبل اللجوء إلى سطرين. */
export const NAME_FIT = {
  maxFontSize: GUEST_NAME_BLOCK.fontSize,
  // لا نُصغّر إلى ما دون هذا: اسم لا يُقرأ أسوأ من اسم على ثلاثة أسطر
  minFontSize: 46,
  maxLines: 3,
} as const;

/**
 * النص الثابت — مطبوع أصلًا على التصميم الرسمي، ويُستخدم هنا لأمرين:
 * القالب الاحتياطي (قبل رفع التصميم)، ونص رسالة واتساب المرافقة.
 */
export const INVITATION_COPY = {
  kicker: 'دعوة حضور',
  body:
    'يسر الكلية العسكرية التقنية دعوتكم لحضور فعاليات الأسبوع العلمي السابع، ' +
    'الذي يجمع الباحثين والمبتكرين والخبراء لاستعراض أحدث الابتكارات والتقنيات ' +
    'المتقدمة وبناء شراكات استراتيجية تدعم المعرفة والبحث العلمي والاقتصاد المعرفي.',
  dates: '4 - 8 أكتوبر 2026م',
  venue: 'الكلية العسكرية التقنية — مسقط',
  closing: 'نأمل تشريفكم بالحضور.',
} as const;

/** تخطيط القالب الاحتياطي فقط — يُستخدم إن غاب التصميم الرسمي. */
export const FALLBACK_LAYOUT: Record<'kicker' | 'body' | 'dates' | 'venue' | 'closing', TextBlock> = {
  kicker: { centerX: CANVAS_WIDTH / 2, top: 600, maxWidth: 820, fontSize: 46, lineHeight: 64, weight: 500, color: BRAND.white },
  body: { centerX: CANVAS_WIDTH / 2, top: 850, maxWidth: 800, fontSize: 38, lineHeight: 62, weight: 400, color: BRAND.white },
  dates: { centerX: CANVAS_WIDTH / 2, top: 1300, maxWidth: 800, fontSize: 50, lineHeight: 72, weight: 700, color: BRAND.blue },
  venue: { centerX: CANVAS_WIDTH / 2, top: 1385, maxWidth: 800, fontSize: 38, lineHeight: 60, weight: 500, color: BRAND.white },
  closing: { centerX: CANVAS_WIDTH / 2, top: 1500, maxWidth: 800, fontSize: 38, lineHeight: 58, weight: 500, color: BRAND.gold },
};

/** اسم ملف آمن وفريد لكل دعوة. */
export function invitationFileName(guestName: string, id: string): string {
  const safe = guestName
    .normalize('NFKC')
    .replace(/[^\p{Script=Arabic}\p{Script=Latin}\d]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `دعوة-${safe || 'مدعو'}-${id.slice(-6)}.png`;
}
