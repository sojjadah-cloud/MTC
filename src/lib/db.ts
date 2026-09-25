/**
 * db.ts
 * ---------------------------------------------------------------------------
 * عميل Prisma وحيد.
 *
 * منذ Prisma 7 يتصل العميل عبر «محوّل تعريف» (driver adapter) بدل قراءة عنوان
 * الاتصال من المخطط. نختار المحوّل من صيغة DATABASE_URL نفسها، فيعمل المشروع
 * على PostgreSQL في الإنتاج وعلى SQLite محليًا بلا تغيير في الكود.
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

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/** هل قاعدة البيانات متاحة فعلًا؟ تُستخدم لعرض تحذير واضح بدل الانهيار. */
export async function databaseReachable(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
