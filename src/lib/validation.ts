/**
 * validation.ts
 * ---------------------------------------------------------------------------
 * مخططات التحقق ومجموعات الحالات. هذا الملف هو المصدر الوحيد لقيم الحالة،
 * لأن قاعدة البيانات تخزّنها كنص (حتى تعمل على SQLite و PostgreSQL معًا).
 */

import { z } from 'zod';
import { COUNTRIES, validatePhone } from './phone';

/* ----------------------------------------------------------- الحالات --- */

export const DELIVERY_STATUSES = [
  'DRAFT',          // أُنشئت الدعوة ولم يُطلب إرسالها
  'MANUAL_OPENED',  // فُتحت محادثة واتساب يدويًا — ليست دليل تسليم
  'QUEUED',         // سُلّمت للواجهة الرسمية وتنتظر التأكيد
  'SENT',           // أكّدت واتساب الاستلام منّا
  'DELIVERED',      // وصلت إلى جهاز المدعو
  'READ',           // قرأها المدعو
  'FAILED',         // فشل الإرسال
] as const;

export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const CHANNELS = ['MANUAL', 'CLOUD_API'] as const;
export type Channel = (typeof CHANNELS)[number];

/** الحالات التي تعني أن الرسالة خرجت فعلًا عبر الواجهة الرسمية. */
export const SENT_STATUSES: DeliveryStatus[] = ['SENT', 'DELIVERED', 'READ'];

/** الحالات التي يُمنع معها إرسال ثانٍ دون إعادة محاولة صريحة. */
export const LOCKED_STATUSES: DeliveryStatus[] = ['QUEUED', 'SENT', 'DELIVERED', 'READ'];

export const STATUS_LABELS_AR: Record<DeliveryStatus, string> = {
  DRAFT: 'مسودة',
  MANUAL_OPENED: 'فُتحت المحادثة',
  QUEUED: 'قيد المعالجة',
  SENT: 'أُرسلت',
  DELIVERED: 'سُلّمت',
  READ: 'قُرئت',
  FAILED: 'فشل الإرسال',
};

export const STATUS_TONES: Record<DeliveryStatus, 'neutral' | 'pending' | 'success' | 'danger'> = {
  DRAFT: 'neutral',
  MANUAL_OPENED: 'neutral',
  QUEUED: 'pending',
  SENT: 'success',
  DELIVERED: 'success',
  READ: 'success',
  FAILED: 'danger',
};

export function isDeliveryStatus(value: unknown): value is DeliveryStatus {
  return typeof value === 'string' && (DELIVERY_STATUSES as readonly string[]).includes(value);
}

/* ---------------------------------------------------------- المخططات --- */

const COUNTRY_CODES = COUNTRIES.map((c) => c.iso2) as [string, ...string[]];

/**
 * الاسم: نسمح بالعربية والإنجليزية والمسافات والنقطة والشرطة والفاصلة العليا،
 * ونمنع الرموز التي قد تُستغل في الحقن أو تُفسد تخطيط البطاقة.
 */
const NAME_PATTERN = /^[\p{Script=Arabic}\p{Script=Latin}\p{Mark}\d\s.'’\-_/()]+$/u;

export const guestNameSchema = z
  .string()
  .trim()
  .min(3, 'الاسم قصير جدًا — الحد الأدنى ٣ أحرف.')
  .max(80, 'الاسم طويل جدًا — الحد الأقصى ٨٠ حرفًا.')
  .regex(NAME_PATTERN, 'الاسم يحتوي على رموز غير مسموحة.')
  // مسافات متعددة تُفسد توسيط النص على البطاقة
  .transform((v) => v.replace(/\s+/g, ' '));

export const createInvitationSchema = z
  .object({
    guestName: guestNameSchema,
    phone: z.string().trim().min(1, 'الرجاء إدخال رقم الهاتف.'),
    countryIso2: z.enum(COUNTRY_CODES, { message: 'الدولة المختارة غير مدعومة.' }),
    /** تأكيد المستخدم بإنشاء دعوة ثانية لنفس الرقم */
    allowDuplicate: z.boolean().optional().default(false),
  })
  .superRefine((value, ctx) => {
    const result = validatePhone(value.phone, value.countryIso2);
    if (!result.ok) {
      ctx.addIssue({ code: 'custom', path: ['phone'], message: result.error });
    }
  })
  .transform((value) => {
    // آمن: superRefine أوقف الطلب لو كان الرقم غير صالح.
    const parsed = validatePhone(value.phone, value.countryIso2);
    if (!parsed.ok) throw new Error(parsed.error);
    return {
      guestName: value.guestName,
      phoneE164: parsed.e164,
      phoneCountry: value.countryIso2,
      allowDuplicate: value.allowDuplicate,
    };
  });

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

export const loginSchema = z.object({
  username: z.string().trim().min(1, 'الرجاء إدخال اسم المستخدم.'),
  password: z.string().min(1, 'الرجاء إدخال كلمة المرور.'),
});

export const markManualSchema = z.object({
  invitationId: z.string().min(1),
});

/** صورة الدعوة المولّدة في المتصفح، بصيغة data URL لـ PNG. */
export const invitationImageSchema = z.object({
  dataUrl: z
    .string()
    .startsWith('data:image/png;base64,', 'صيغة الصورة يجب أن تكون PNG.')
    // 1080×1920 PNG ~ 1–4 ميجابايت؛ نضع سقفًا معقولًا
    .max(12_000_000, 'حجم الصورة أكبر من الحد المسموح.'),
});

/** أخطاء Zod بصيغة { field: message } لعرضها تحت الحقول. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
