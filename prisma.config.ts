/**
 * prisma.config.ts
 * ---------------------------------------------------------------------------
 * إعدادات أدوات Prisma (الترحيل والاستكشاف والبذر).
 *
 * منذ Prisma 7 لم يعد عنوان قاعدة البيانات يُكتب داخل schema.prisma، بل يُقرأ
 * هنا لأوامر الترحيل، ويُمرَّر إلى العميل عبر محوّل تعريف في src/lib/db.ts.
 */

import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL,
  },
  migrations: {
    seed: 'node prisma/seed.mjs',
  },
});
