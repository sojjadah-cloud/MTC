/**
 * scripts/deploy-migrate.mjs
 * ---------------------------------------------------------------------------
 * يُشغّل ترحيلات Prisma أثناء بناء النشر.
 *
 *   npm run deploy:migrate
 *
 * قاعدة البيانات اختيارية في هذا المشروع: صفحة الدعوة تُولّد البطاقة وتُنزّلها
 * في المتصفّح ولا تمسّ القاعدة إطلاقًا، وإنما تحتاجها مسارات الـ API للسجل
 * والإرسال. لذلك غياب DATABASE_URL ليس خطأ بناء — نتخطّى الترحيل ونقول ذلك
 * صراحةً بدل إسقاط النشر كلّه.
 *
 * أما إذا كان العنوان موجودًا وفشل الترحيل فهذا خطأ حقيقي: قاعدة مضبوطة لكن
 * مخطّطها قديم أسوأ من لا قاعدة، فنُخرج برمز فشل ويتوقّف النشر.
 */

import { spawnSync } from 'node:child_process';

const url = process.env.DATABASE_URL?.trim();

if (!url) {
  console.log('DATABASE_URL غير مضبوط — تخطّي الترحيل. مسارات الـ API ستكون معطّلة.');
  process.exit(0);
}

if (url.startsWith('file:')) {
  console.log('قاعدة SQLite محلية — تخطّي `migrate deploy`. استخدم `npm run db:sqlite`.');
  process.exit(0);
}

const result = spawnSync('prisma', ['migrate', 'deploy'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

process.exit(result.status ?? 1);
