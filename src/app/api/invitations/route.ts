import { adminAuthorized, handle, jsonError } from '@/lib/api';
import { prisma } from '@/lib/db';
import { clientIp, rateLimit, rateLimitResponse, RULES } from '@/lib/rate-limit';
import { createInvitationSchema, SENT_STATUSES } from '@/lib/validation';

/** أعمدة آمنة للعرض — نعيد الرقم كاملًا للمستخدم المخوّل فقط. */
const SELECT = {
  id: true,
  guestName: true,
  phoneE164: true,
  phoneCountry: true,
  status: true,
  channel: true,
  errorMessage: true,
  imageKey: true,
  createdAt: true,
  sentAt: true,
} as const;

/**
 * GET /api/invitations — سجل الدعوات. إداري فقط: الواجهة العامة لا تعرض أي
 * قائمة، والسجل يحوي أرقام هواتف المدعوين.
 */
export async function GET(request: Request) {
  return handle(async () => {
    if (!adminAuthorized(request)) return jsonError('غير مصرّح.', 401);

    const url = new URL(request.url);
    const q = url.searchParams.get('q')?.trim() ?? '';

    const where = q
      ? {
          OR: [
            { guestName: { contains: q } },
            { phoneE164: { contains: q.replace(/\s/g, '') } },
          ],
        }
      : {};

    const [items, total, sent] = await Promise.all([
      prisma.invitation.findMany({
        where,
        select: SELECT,
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      prisma.invitation.count(),
      prisma.invitation.count({ where: { status: { in: SENT_STATUSES } } }),
    ]);

    return Response.json({ items, stats: { total, sent } });
  });
}

/** POST /api/invitations — إنشاء دعوة جديدة. */
export async function POST(request: Request) {
  return handle(async () => {
    const limit = rateLimit(`create:${clientIp(request)}`, RULES.createInvitation);
    if (!limit.allowed) return rateLimitResponse(limit);

    const body = await request.json().catch(() => ({}));
    const input = createInvitationSchema.parse(body);

    // منع التكرار غير المقصود: نُبلّغ ولا نمنع نهائيًا، لأن إعادة الدعوة
    // لنفس الشخص قد تكون مقصودة. المستخدم يؤكّد صراحةً عبر allowDuplicate.
    if (!input.allowDuplicate) {
      const existing = await prisma.invitation.findFirst({
        where: { phoneE164: input.phoneE164 },
        select: { id: true, guestName: true, createdAt: true, status: true },
        orderBy: { createdAt: 'desc' },
      });
      if (existing) {
        return jsonError('توجد دعوة سابقة لهذا الرقم.', 409, {
          duplicate: existing,
          hint: 'أكّد الإنشاء لإصدار دعوة أخرى لنفس الرقم.',
        });
      }
    }

    const invitation = await prisma.invitation.create({
      data: {
        guestName: input.guestName,
        phoneE164: input.phoneE164,
        phoneCountry: input.phoneCountry,
        status: 'DRAFT',
      },
      select: SELECT,
    });

    await prisma.deliveryEvent.create({
      data: { invitationId: invitation.id, status: 'DRAFT', source: 'USER', detail: 'إنشاء الدعوة' },
    });

    return Response.json({ invitation }, { status: 201 });
  });
}
