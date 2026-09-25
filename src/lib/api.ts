/**
 * api.ts
 * ---------------------------------------------------------------------------
 * أدوات مشتركة لمسارات الـ API: توحيد شكل الأخطاء، وتسجيل أحداث التسليم.
 */

import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { ZodError } from 'zod';
import { prisma } from './db';
import { fieldErrors, type DeliveryStatus } from './validation';

export function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return Response.json({ error: message, ...extra }, { status });
}

/**
 * يغلّف معالج المسار ويحوّل الاستثناءات المعروفة إلى ردود عربية واضحة،
 * بدل تسريب رسائل داخلية أو انهيار المسار.
 */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError('البيانات المُرسلة غير صالحة.', 422, { fields: fieldErrors(error) });
    }
    const message = error instanceof Error ? error.message : String(error);
    if (/Can't reach database|ECONNREFUSED|P1001/i.test(message)) {
      return jsonError('تعذّر الاتصال بقاعدة البيانات.', 503);
    }
    console.error('[api]', error);
    return jsonError('حدث خطأ غير متوقّع في الخادم.', 500);
  }
}

/**
 * حراسة المسارات الإدارية برمز ثابت في متغيّرات البيئة.
 *
 * الواجهة العامة لا تستدعي هذه المسارات إطلاقًا: توليد الدعوة وتنزيلها
 * وإرسالها يدويًا كلّها تجري في المتصفح. المسارات الإدارية (الإرسال التلقائي)
 * مخصّصة للتشغيل الخلفي، فيكفيها رمز بدل نظام حسابات كامل.
 */
export function adminAuthorized(request: Request): boolean {
  const expected = process.env.ADMIN_API_TOKEN;
  if (!expected) return false;

  const header = request.headers.get('authorization') ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : '';
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** يسجّل حدث تسليم ويحدّث حالة الدعوة في معاملة واحدة. */
export async function recordStatus(
  invitationId: string,
  status: DeliveryStatus,
  source: 'API' | 'WEBHOOK' | 'USER',
  detail?: string,
  extra?: { waMessageId?: string | null; errorMessage?: string | null; sentAt?: Date | null }
) {
  return prisma.$transaction([
    prisma.invitation.update({
      where: { id: invitationId },
      data: {
        status,
        ...(extra?.waMessageId !== undefined ? { waMessageId: extra.waMessageId } : {}),
        ...(extra?.errorMessage !== undefined ? { errorMessage: extra.errorMessage } : {}),
        ...(extra?.sentAt !== undefined ? { sentAt: extra.sentAt } : {}),
      },
    }),
    prisma.deliveryEvent.create({
      data: { invitationId, status, source, detail: detail?.slice(0, 500) },
    }),
  ]);
}

/** ترتيب الحالات: لا نسمح لحدث متأخر بأن يتراجع بالحالة إلى الخلف. */
const STATUS_RANK: Record<string, number> = {
  DRAFT: 0,
  MANUAL_OPENED: 1,
  QUEUED: 2,
  SENT: 3,
  DELIVERED: 4,
  READ: 5,
  FAILED: 6,
};

export function shouldAdvance(current: string, next: string): boolean {
  if (next === 'FAILED') return true;
  return (STATUS_RANK[next] ?? 0) > (STATUS_RANK[current] ?? 0);
}
