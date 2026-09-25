import { adminAuthorized, handle, jsonError } from '@/lib/api';
import { prisma } from '@/lib/db';
import { decodePngDataUrl, imageKeyFor, readImage, saveImage } from '@/lib/image-store';
import { invitationImageSchema } from '@/lib/validation';
import { invitationFileName } from '@/lib/template-config';

/**
 * POST — يستقبل صورة الدعوة المولّدة في المتصفح ويحفظها على الخادم.
 * نحفظها لأن الإرسال عبر الواجهة الرسمية يرفع الملف نفسه إلى واتساب،
 * ولأن المستخدم قد يحتاج تنزيلها مجددًا من لوحة المتابعة.
 */
export async function POST(request: Request, ctx: RouteContext<'/api/invitations/[id]/image'>) {
  return handle(async () => {
    const { id } = await ctx.params;

    const invitation = await prisma.invitation.findUnique({ where: { id }, select: { id: true } });
    if (!invitation) return jsonError('الدعوة غير موجودة.', 404);

    const body = await request.json().catch(() => ({}));
    const { dataUrl } = invitationImageSchema.parse(body);

    const bytes = decodePngDataUrl(dataUrl);
    const key = imageKeyFor(id);
    await saveImage(key, bytes);

    await prisma.invitation.update({ where: { id }, data: { imageKey: key } });
    return Response.json({ ok: true, imageKey: key, bytes: bytes.length });
  });
}

/** GET — يعيد صورة الدعوة المحفوظة. محميّ بالجلسة: الصورة تحمل اسم المدعو. */
export async function GET(_request: Request, ctx: RouteContext<'/api/invitations/[id]/image'>) {
  return handle(async () => {
    if (!adminAuthorized(_request)) return jsonError('غير مصرّح.', 401);
    const { id } = await ctx.params;

    const invitation = await prisma.invitation.findUnique({
      where: { id },
      select: { imageKey: true, guestName: true },
    });
    if (!invitation?.imageKey) return jsonError('لا توجد صورة محفوظة لهذه الدعوة.', 404);

    const bytes = await readImage(invitation.imageKey);
    if (!bytes) return jsonError('ملف الصورة غير موجود على الخادم.', 404);

    const fileName = invitationFileName(invitation.guestName, id);
    return new Response(new Uint8Array(bytes), {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        'Cache-Control': 'private, no-store',
      },
    });
  });
}
