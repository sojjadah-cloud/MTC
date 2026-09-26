/**
 * prisma.config.ts
 * ---------------------------------------------------------------------------
 * إعدادات أدوات Prisma (التوليد والترحيل والاستكشاف).
 *
 * منذ Prisma 7 لم يعد عنوان قاعدة البيانات يُكتب داخل schema.prisma، بل يُقرأ
 * هنا لأوامر الترحيل، ويُمرَّر إلى العميل عبر محوّل تعريف في src/lib/db.ts.
 *
 * العنوان اختياري هنا عمدًا: `prisma generate` يعمل بلا قاعدة بيانات، وهو ما
 * ينفّذه npm أثناء التثبيت على خادم النشر قبل أن تُربط القاعدة. الأوامر التي
 * تحتاج اتصالًا فعليًا (migrate ،studio) هي التي تشتكي من غيابه.
 */

import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
