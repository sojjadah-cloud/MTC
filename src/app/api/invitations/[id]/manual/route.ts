import { handle, jsonError, recordStatus } from '@/lib/api';
import { prisma } from '@/lib/db';
import { SENT_STATUSES } from '@/lib/validation';

/**
 * POST — يسجّل أن المستخدم فتح محادثة واتساب يدويًا.
 *
 * هذه ليست دليل تسليم: فتح wa.me لا يعني أن الرسالة أُرسلت، ولذلك تُسجَّل
 * حالة MANUAL_OPENED المنفصلة تمامًا عن SENT، ولا تُحتسب ضمن عدّاد المُرسل.
 */
export async function POST(_request: Request, ctx: RouteContext<'/api/invitations/[id]/manual'>) {
  return handle(async () => {
    const { id } = await ctx.params;

    const invitation = await prisma.invitation.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!invitation) return jsonError('الدعوة غير موجودة.', 404);

    // لا نتراجع بحالة دعوة أُرسلت فعلًا عبر الواجهة الرسمية
    if ((SENT_STATUSES as string[]).includes(invitation.status)) {
      return Response.json({ ok: true, status: invitation.status, unchanged: true });
    }

    await recordStatus(id, 'MANUAL_OPENED', 'USER', 'فُتحت محادثة واتساب يدويًا', {
      errorMessage: null,
    });
    await prisma.invitation.update({ where: { id }, data: { channel: 'MANUAL' } });

    return Response.json({ ok: true, status: 'MANUAL_OPENED' });
  });
}
