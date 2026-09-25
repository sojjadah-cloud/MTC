/**
 * scripts/extract-logo.mjs
 * ---------------------------------------------------------------------------
 * يفصل الشعار عن خلفيته الزرقاء في التصميم الرسمي وينتج PNG شفافًا.
 *
 * لماذا لا يكفي المفتاح اللوني (chroma key)؟ لأن الخلفية تدرّج لا لون واحد:
 * لونها يختلف من أعلى الاقتطاع إلى أسفله ومن يمينه إلى يساره. حذف «الأزرق»
 * بعتبة ثابتة إمّا يترك هالة أو يأكل الأجزاء الزرقاء داخل الشعار نفسه.
 *
 * ما نفعله بدلًا من ذلك:
 *   1. نقدّر لون الخلفية لكل صف من أعمدة الحافة (وهي خلفية خالصة بحكم الاقتطاع).
 *   2. الشفافية = المسافة اللونية عن تلك الخلفية، ممدودة بين عتبتين.
 *   3. نزيل صبغة الخلفية من البكسلات شبه الشفافة (un-blend)، وإلا بقيت
 *      حواف الشعار زرقاء على أي خلفية جديدة.
 */

import path from 'node:path';
import sharp from 'sharp';

const [, , source, output, ...rest] = process.argv;
if (!source || !output) {
  console.error('الاستخدام: node scripts/extract-logo.mjs <مدخل> <مخرج> [--t0=n] [--t1=n]');
  process.exit(1);
}

const opt = (name, fallback) => {
  const hit = rest.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split('=')[1]) : fallback;
};

/** أقل من t0 = خلفية خالصة، أكثر من t1 = شعار خالص، وبينهما تدرّج. */
const T0 = opt('t0', 34);
const T1 = opt('t1', 78);
/** عدد أعمدة الحافة المستخدمة في تقدير الخلفية. */
const EDGE = opt('edge', 4);

const { data, info } = await sharp(source)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const { width, height, channels } = info;
const out = Buffer.alloc(width * height * 4);

for (let y = 0; y < height; y++) {
  // خلفية هذا الصف: متوسط أعمدة الحافة على الجانبين
  let br = 0;
  let bg = 0;
  let bb = 0;
  let n = 0;
  for (let e = 0; e < EDGE; e++) {
    for (const x of [e, width - 1 - e]) {
      const i = (y * width + x) * channels;
      br += data[i];
      bg += data[i + 1];
      bb += data[i + 2];
      n++;
    }
  }
  br /= n;
  bg /= n;
  bb /= n;

  for (let x = 0; x < width; x++) {
    const i = (y * width + x) * channels;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const dist = Math.hypot(r - br, g - bg, b - bb);
    let alpha = (dist - T0) / (T1 - T0);
    alpha = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;

    const o = (y * width + x) * 4;
    if (alpha <= 0) {
      out[o] = out[o + 1] = out[o + 2] = out[o + 3] = 0;
      continue;
    }

    // إزالة صبغة الخلفية من الحواف شبه الشفافة:
    //   pixel = alpha*fg + (1-alpha)*bg   =>   fg = (pixel - (1-alpha)*bg) / alpha
    const unblend = (c, bgc) => {
      const v = (c - (1 - alpha) * bgc) / alpha;
      return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
    };

    out[o] = unblend(r, br);
    out[o + 1] = unblend(g, bg);
    out[o + 2] = unblend(b, bb);
    out[o + 3] = Math.round(alpha * 255);
  }
}

// نقتصّ الشفاف الزائد حول الشعار حتى يملأ الصندوق المخصّص له في الترويسة
await sharp(out, { raw: { width, height, channels: 4 } })
  .png({ compressionLevel: 9 })
  .trim({ threshold: 1 })
  .toFile(path.resolve(output));

const meta = await sharp(path.resolve(output)).metadata();
console.log(`✓ ${path.basename(output)}  ${meta.width}×${meta.height}  (شفاف)`);
