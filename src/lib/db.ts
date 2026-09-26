/**
 * db.ts
 * ---------------------------------------------------------------------------
 * عميل Prisma وحيد.
 *
 * منذ Prisma 7 يتصل العميل عبر «محوّل تعريف» (driver adapter) بدل قراءة عنوان
 * الاتصال من المخطط. نختار المحوّل من صيغة DATABASE_URL نفسها، فيعمل المشروع
 * على PostgreSQL في الإنتاج وعلى SQLite محليًا بلا تغيير في الكود.
 *
 * الإنشاء مؤجَّل إلى أول استعلام فعلي: مجرّد استيراد الوحدة لا يفتح اتصالًا
 * ولا يشترط وجود DATABASE_URL. هذا ما يسمح لـ `next build` بتحليل مسارات الـ
 * API على خادم النشر قبل ربط قاعدة البيانات، ويُبقي صفحة الدعوة — وهي تعمل
 * في المتصفّح بالكامل ولا تمسّ القاعدة — تعمل ولو لم تُربط قاعدة أصلًا.
 *
 * في وضع التطوير يعيد Next تحميل الوحدات عند كل تعديل، فنحتفظ بالعميل على
 * globalThis حتى لا تتراكم اتصالات قاعدة البيانات.
 */

import 'server-only';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaPg } from '@prisma/adapter-pg';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL غير مضبوط. انسخ .env.example إلى .env واضبط عنوان قاعدة البيانات.'
    );
  }

  // file:./dev.db  ->  SQLite محلي   |   postgresql://…  ->  PostgreSQL
  const adapter = url.startsWith('file:')
    ? new PrismaBetterSqlite3({ url })
    : new PrismaPg(url);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

function client(): PrismaClient {
  if (!globalForPrisma.prisma) globalForPrisma.prisma = createClient();
  return globalForPrisma.prisma;
}

/**
 * واجهة العميل نفسها، لكن الإنشاء يقع عند أول وصول إلى أي خاصية.
 * الاستيراد وحده لا يفعل شيئًا.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    return Reflect.get(client(), property, receiver);
  },
  has: (_target, property) => property in client(),
});

/** هل قاعدة البيانات متاحة فعلًا؟ تُستخدم لعرض تحذير واضح بدل الانهيار. */
export async function databaseReachable(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
