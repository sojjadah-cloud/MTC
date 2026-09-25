/**
 * scripts/prepare-brand.mjs
 * ---------------------------------------------------------------------------
 * يجهّز أصول الهوية من التصميم الرسمي المعتمد:
 *
 *   node scripts/prepare-brand.mjs "<مسار التصميم الرسمي>"
 *
 * ماذا يفعل؟
 *   1. يعيد قياس التصميم إلى 1080×1920 ويحفظه قالبًا للدعوة.
 *   2. يقتطع الشعارين ويفصلهما عن خلفيتهما الزرقاء إلى PNG شفاف.
 *   3. يطبع ألوان الخلفية عند شريط الاسم، لأن المولّد يعيد بناء هذا الشريط
 *      قبل كتابة اسم المدعو الجديد.
 *
 * لا يعيد تصميم أي شيء ولا يولّد خلفية — يقتطع ويعيد القياس فقط.
 */

import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import sharp from 'sharp';

const TARGET_W = 1080;
const TARGET_H = 1920;

const source = process.argv[2];
if (!source) {
  console.error('الاستخدام: node scripts/prepare-brand.mjs "<مسار التصميم>"');
  process.exit(1);
}

const outDir = path.join(process.cwd(), 'public', 'brand');
await mkdir(outDir, { recursive: true });

const image = sharp(source);
const meta = await image.metadata();
console.log(`المصدر: ${meta.width}×${meta.height}`);

/* ------------------------------------------------- قالب الدعوة ----- */

await sharp(source)
  .resize(TARGET_W, TARGET_H, { fit: 'fill' })
  .png({ compressionLevel: 9 })
  .toFile(path.join(outDir, 'invitation-template.png'));
console.log(`✓ invitation-template.png  (${TARGET_W}×${TARGET_H})`);

/* ----------------------------------------------------- الشعارات ----- */

/**
 * حدود عناصر الشعار في التصميم، مقيسة بكشف البكسلات الفاتحة لا بالتخمين.
 * نقتطع بهامش حولها كي تبقى أعمدة الحافة خلفية خالصة — يحتاجها فاصل الشفافية
 * لتقدير لون الخلفية في كل صف.
 */
const PAD = 14;
// شعار الكلية لا يُقتطع من التصميم: النسخة الرسمية المعتمدة موجودة في
// brand-src/mtc-logo-source.png وتُعالَج بسكربت إزالة الخلفية البيضاء.
// ما يُقتطع من التصميم هو شعار الأسبوع العلمي وحده.
const LOGOS = {
  'week-logo.png': { left: 254, top: 315, width: 454, height: 102 },
};

const CREST_SOURCE = path.join(process.cwd(), 'brand-src', 'mtc-logo-source.png');

for (const [name, box] of Object.entries(LOGOS)) {
  const scaleX = meta.width / 941;
  const scaleY = meta.height / 1672;
  const region = {
    left: Math.round((box.left - PAD) * scaleX),
    top: Math.round((box.top - PAD) * scaleY),
    width: Math.round((box.width + PAD * 2) * scaleX),
    height: Math.round((box.height + PAD * 2) * scaleY),
  };

  const cropped = path.join(outDir, `.tmp-${name}`);
  await sharp(source).extract(region).png().toFile(cropped);

  // الفصل عن الخلفية يجري في سكربت مستقل ليبقى قابلًا للضبط وحده
  execFileSync(process.execPath, [
    path.join('scripts', 'extract-logo.mjs'), cropped, path.join(outDir, name),
  ], { stdio: 'inherit' });

  await rm(cropped, { force: true });
}

// شعار الكلية من ملفه الرسمي
if (existsSync(CREST_SOURCE)) {
  execFileSync(process.execPath, [
    path.join('scripts', 'remove-white-bg.mjs'), CREST_SOURCE, path.join(outDir, 'mtc-logo.png'),
  ], { stdio: 'inherit' });
} else {
  console.warn('! لم يوجد brand-src/mtc-logo-source.png — تُرك mtc-logo.png كما هو.');
}

/* ------------------------------------- ألوان شريط الاسم ----- */

// نقرأ لونين: أعلى شريط الاسم وأسفله. المولّد يتدرّج بينهما ليعيد بناء
// الخلفية قبل كتابة الاسم الجديد، فيختفي الاسم المطبوع في التصميم.
const resized = sharp(source).resize(TARGET_W, TARGET_H, { fit: 'fill' });
const { data } = await resized.raw().toBuffer({ resolveWithObject: true });

function sampleRow(y) {
  // متوسط ألوان الشريط الأوسط من الصف، بعيدًا عن زخارف الحواف
  let r = 0, g = 0, b = 0, n = 0;
  for (let x = Math.round(TARGET_W * 0.25); x < Math.round(TARGET_W * 0.75); x += 4) {
    const i = (y * TARGET_W + x) * 3;
    r += data[i]; g += data[i + 1]; b += data[i + 2];
    n++;
  }
  const hex = (v) => Math.round(v / n).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

console.log('\nألوان الخلفية حول شريط الاسم (للصقها في NAME_BAND):');
for (const y of [690, 700, 710, 720, 760, 800, 810, 820]) {
  console.log(`  y=${y}  ${sampleRow(y)}`);
}
