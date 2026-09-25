/**
 * scripts/use-db.mjs
 * ---------------------------------------------------------------------------
 * يبدّل مزوّد قاعدة البيانات في prisma/schema.prisma.
 *
 *   node scripts/use-db.mjs sqlite     تشغيل محلي فوري بلا تثبيت خادم
 *   node scripts/use-db.mjs postgres   الهدف الإنتاجي
 *
 * لماذا سكربت بدل متغيّر بيئة؟ لأن Prisma تشترط أن يكون المزوّد قيمة نصية
 * ثابتة في المخطط ولا تقبل env() في هذا الموضع.
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const target = process.argv[2];
if (!['sqlite', 'postgres', 'postgresql'].includes(target ?? '')) {
  console.error('الاستخدام: node scripts/use-db.mjs sqlite|postgres');
  process.exit(1);
}

const provider = target === 'sqlite' ? 'sqlite' : 'postgresql';
const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');

const original = await readFile(schemaPath, 'utf8');
const updated = original.replace(
  /(datasource\s+db\s*\{[^}]*?provider\s*=\s*)"[^"]+"/s,
  `$1"${provider}"`
);

if (updated === original) {
  console.log(`المزوّد بالفعل "${provider}" — لا تغيير.`);
} else {
  await writeFile(schemaPath, updated, 'utf8');
  console.log(`تم ضبط مزوّد قاعدة البيانات على "${provider}".`);
}

if (provider === 'sqlite') {
  console.log('تذكير: اضبط DATABASE_URL="file:./dev.db" في ملف .env');
} else {
  console.log('تذكير: اضبط DATABASE_URL على عنوان PostgreSQL في ملف .env');
}
