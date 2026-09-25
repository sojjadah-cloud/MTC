import { adminAuthorized, handle, jsonError, recordStatus } from '@/lib/api';
import { prisma } from '@/lib/db';
import { readImage } from '@/lib/image-store';
import { rateLimit, rateLimitResponse, RULES } from '@/lib/rate-limit';
import { invitationFileName } from '@/lib/template-config';
import { LOCKED_STATUSES } from '@/lib/validation';
import {
  invitationCaption,
  isConfigured,
  sendImage,
  sendTemplate,
  uploadMedia,
  WhatsAppError,
} from '@/lib/whatsapp';

/**
 * POST /api/invitations/[id]/send — إرسال فعلي عبر WhatsApp Cloud API.
 *
 * منع الإرسال المزدوج: نحجز الدعوة بتحديث شرطي ذرّي (updateMany) يشترط ألّا
 * تكون الحالة ضمن الحالات المقفلة. لو وصل طلبان في اللحظة نفسها، ينجح واحد
 * فقط في الحجز ويُرفض الآخر — بلا حاجة إلى قفل خارجي.
 */
export async function POST(request: Request, ctx: RouteContext<'/api/invitations/[id]/send'>) {
  return handle(async () => {
    if (!adminAuthorized(request)) return jsonError('غير مصرّح.', 401);
    const { id } = await ctx.params;

    if (!isConfigured()) {
      return jsonError(
        'الإرسال التلقائي غير مُفعّل: لم تُضبط بيانات WhatsApp Cloud API. استخدم الإرسال اليدوي.',
        503,
        { manualOnly: true }
      );
    }

    const limit = rateLimit('send:admin', RULES.sendInvitation);
    if (!limit.allowed) return rateLimitResponse(limit);

    const url = new URL(request.url);
    const isRetry = url.searchParams.get('retry') === 'true';

    const invitation = await prisma.invitation.findUnique({ where: { id } });
    if (!invitation) return jsonError('الدعوة غير موجودة.', 404);
    if (!invitation.imageKey) {
      return jsonError('لم تُحفظ صورة الدعوة بعد. أنشئ الدعوة ثم أعد المحاولة.', 409);
    }

    // إعادة المحاولة مسموحة بعد الفشل فقط؛ ما نجح لا يُعاد إرساله.
    const blocked = isRetry
      ? LOCKED_STATUSES.filter((s) => s !== 'QUEUED')
      : LOCKED_STATUSES;

    const claim = await prisma.invitation.updateMany({
      where: { id, status: { notIn: blocked } },
      data: { status: 'QUEUED', channel: 'CLOUD_API', errorMessage: null },
    });

    if (claim.count === 0) {
      return jsonError('هذه الدعوة أُرسلت بالفعل أو قيد الإرسال الآن.', 409, {
        status: invitation.status,
      });
    }

    await prisma.deliveryEvent.create({
      data: { invitationId: id, status: 'QUEUED', source: 'API', detail: 'بدء الإرسال' },
    });

    try {
      const bytes = await readImage(invitation.imageKey);
      if (!bytes) throw new Error('ملف صورة الدعوة غير موجود على الخادم.');

      // قالب معتمد أولًا عند توفّره: خارج نافذة الـ ٢٤ ساعة لا تقبل واتساب
      // رسالة حرّة لبدء المحادثة.
      if (process.env.WHATSAPP_TEMPLATE_NAME) {
        await sendTemplate(invitation.phoneE164, [invitation.guestName]);
      }

      const mediaId = await uploadMedia(
        bytes,
        invitationFileName(invitation.guestName, invitation.id)
      );
      const { messageId } = await sendImage(
        invitation.phoneE164,
        mediaId,
        invitationCaption(invitation.guestName)
      );

      // SENT فقط: التسليم والقراءة يؤكّدهما الـ Webhook لاحقًا، لا نحن.
      await recordStatus(id, 'SENT', 'API', `معرّف الرسالة ${messageId}`, {
        waMessageId: messageId,
        errorMessage: null,
        sentAt: new Date(),
      });

      return Response.json({ ok: true, status: 'SENT', messageId });
    } catch (error) {
      const message =
        error instanceof WhatsAppError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'خطأ غير معروف أثناء الإرسال.';

      await recordStatus(id, 'FAILED', 'API', message, { errorMessage: message });
      return jsonError(`فشل الإرسال: ${message}`, 502, { status: 'FAILED', retryable: true });
    }
  });
}
