import { createHmac, timingSafeEqual } from 'node:crypto';
import { handle, jsonError, shouldAdvance } from '@/lib/api';
import { prisma } from '@/lib/db';
import { isDeliveryStatus, type DeliveryStatus } from '@/lib/validation';

/**
 * Webhook واتساب — المصدر الوحيد الموثوق لحالتَي «سُلّمت» و«قُرئت».
 *
 * GET  : تحقّق الاشتراك الذي تطلبه Meta عند ربط الـ Webhook.
 * POST : أحداث الحالة. نتحقّق من توقيع Meta قبل قبول أي حدث، وإلا أمكن لأي
 *        طرف أن يزعم أن دعوة سُلّمت.
 */

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!expected) return new Response('WHATSAPP_VERIFY_TOKEN غير مضبوط.', { status: 503 });

  if (mode === 'subscribe' && token === expected && challenge) {
    return new Response(challenge, { status: 200 });
  }
  return new Response('فشل التحقق.', { status: 403 });
}

/** توقيع Meta: sha256=<hex> على الجسم الخام بمفتاح App Secret. */
function signatureValid(rawBody: string, header: string | null): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  // بلا مفتاح لا يمكن التحقق — نرفض بدل أن نثق بغير موثوق.
  if (!appSecret || !header?.startsWith('sha256=')) return false;

  const expected = createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(header.slice('sha256='.length));
  return a.length === b.length && timingSafeEqual(a, b);
}

/** شكل حمولة الـ Webhook بالقدر الذي نقرأه منها. */
type StatusEvent = {
  id?: string;
  status?: string;
  errors?: Array<{ title?: string; message?: string }>;
};
type WebhookPayload = {
  entry?: Array<{
    changes?: Array<{ value?: { statuses?: StatusEvent[] } }>;
  }>;
};

/** تحويل حالة واتساب إلى حالاتنا. */
function mapStatus(waStatus: string): DeliveryStatus | null {
  switch (waStatus) {
    case 'sent':
      return 'SENT';
    case 'delivered':
      return 'DELIVERED';
    case 'read':
      return 'READ';
    case 'failed':
      return 'FAILED';
    default:
      return null;
  }
}

export async function POST(request: Request) {
  return handle(async () => {
    const rawBody = await request.text();

    if (!signatureValid(rawBody, request.headers.get('x-hub-signature-256'))) {
      return jsonError('توقيع الطلب غير صالح.', 401);
    }

    let payload: WebhookPayload;
    try {
      payload = JSON.parse(rawBody) as WebhookPayload;
    } catch {
      return jsonError('جسم الطلب ليس JSON صالحًا.', 400);
    }

    const statuses: StatusEvent[] =
      payload.entry?.flatMap(
        (entry) => entry.changes?.flatMap((change) => change.value?.statuses ?? []) ?? []
      ) ?? [];

    for (const event of statuses) {
      const next = mapStatus(event.status ?? '');
      const messageId = event.id;
      if (!next || !messageId || !isDeliveryStatus(next)) continue;

      const invitation = await prisma.invitation.findUnique({
        where: { waMessageId: messageId },
        select: { id: true, status: true },
      });
      // رسالة لا تخصّنا، أو وصل الحدث قبل أن نحفظ معرّف الرسالة
      if (!invitation) continue;

      // الأحداث قد تصل خارج ترتيبها الزمني؛ لا نتراجع بالحالة إلى الخلف.
      if (!shouldAdvance(invitation.status, next)) continue;

      const detail =
        next === 'FAILED'
          ? (event.errors?.[0]?.title ?? 'فشل التسليم') +
            (event.errors?.[0]?.message ? ` — ${event.errors[0].message}` : '')
          : undefined;

      await prisma.$transaction([
        prisma.invitation.update({
          where: { id: invitation.id },
          data: { status: next, ...(next === 'FAILED' ? { errorMessage: detail } : {}) },
        }),
        prisma.deliveryEvent.create({
          data: { invitationId: invitation.id, status: next, source: 'WEBHOOK', detail },
        }),
      ]);
    }

    // Meta تتوقّع 200 دائمًا وإلا أعادت الإرسال
    return Response.json({ received: true });
  });
}
