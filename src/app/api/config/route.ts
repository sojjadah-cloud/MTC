import { handle } from '@/lib/api';
import { databaseReachable } from '@/lib/db';
import { configSummary } from '@/lib/whatsapp';

/**
 * حالة المنصة: من المسجّل، وهل قاعدة البيانات متاحة، وهل واجهة واتساب مُعدّة.
 * الواجهة تستخدم هذا لتقرر عرض الوضع اليدوي أو التلقائي — بلا ادّعاء.
 */
export async function GET() {
  return handle(async () => {
    return Response.json({
      database: await databaseReachable(),
      whatsapp: configSummary(),
    });
  });
}
