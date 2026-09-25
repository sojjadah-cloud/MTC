/**
 * scripts/remove-white-bg.mjs
 * ---------------------------------------------------------------------------
 * يحوّل شعارًا على خلفية بيضاء إلى PNG شفاف.
 *
 *   node scripts/remove-white-bg.mjs <مدخل> <مخرج>
 *
 * لماذا لا نحذف «كل أبيض»؟ لأن داخل الشعار نفسه مساحات بيضاء (الدرع مثلًا)،
 * وحذفها بعتبة لونية عامة يثقب الشعار. لذلك نستخدم تعبئة فيضية تبدأ من حواف
 * الصورة: لا يُحذف إلا الأبيض **المتّصل بالخلفية**، ويبقى الأبيض المحصور داخل
 * الشعار كما هو.
 *
 * الحواف المنعّمة (anti-aliasing) تُعالَج بتدرّج: البكسل الذي بين الأبيض ولون
 * الشعار يأخذ شفافية جزئية، ثم يُزال عنه بياض الخلفية (un-blend) وإلا ظهرت
 * له هالة بيضاء فوق خلفية داكنة.
 */

import path from 'node:path';
import sharp from 'sharp';

const [, , source, output] = process.argv;
if (!source || !output) {
  console.error('الاستخدام: node scripts/remove-white-bg.mjs <مدخل> <مخرج>');
  process.exit(1);
}

/** أبيض خالص فما فوق = خلفية أكيدة. */
const SOLID = 244;
/** أدنى من هذا = لون شعار أكيد. بينهما تدرّج الحافة. */
const EDGE = 198;

const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height } = info;

const minOf = (i) => Math.min(data[i], data[i + 1], data[i + 2]);

/* ------------------------------ تعبئة فيضية من الحواف ------------------ */

// نمرّ فقط عبر البكسلات التي يُحتمل أنها خلفية (أفتح من EDGE)، فتتوقّف
// التعبئة عند أول لون من الشعار ولا تتسرّب إلى داخله.
const reachable = new Uint8Array(width * height);
const stack = [];

for (let x = 0; x < width; x++) {
  stack.push(x, (height - 1) * width + x);
}
for (let y = 0; y < height; y++) {
  stack.push(y * width, y * width + width - 1);
}

while (stack.length) {
  const p = stack.pop();
  if (reachable[p]) continue;
  if (minOf(p * 4) < EDGE) continue;

  reachable[p] = 1;
  const x = p % width;
  const y = (p - x) / width;
  if (x > 0) stack.push(p - 1);
  if (x < width - 1) stack.push(p + 1);
  if (y > 0) stack.push(p - width);
  if (y < height - 1) stack.push(p + width);
}

/* ------------------------------------ بناء قناة الشفافية --------------- */

const out = Buffer.alloc(width * height * 4);
let cleared = 0;

for (let p = 0; p < width * height; p++) {
  const i = p * 4;
  const o = p * 4;

  if (!reachable[p]) {
    // داخل الشعار — يُنقل كما هو
    out[o] = data[i];
    out[o + 1] = data[i + 1];
    out[o + 2] = data[i + 2];
    out[o + 3] = data[i + 3];
    continue;
  }

  const m = minOf(i);
  // تدرّج الحافة: SOLID فأعلى شفاف تمامًا، وEDGE فأدنى معتم تمامًا
  let alpha = (SOLID - m) / (SOLID - EDGE);
  alpha = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;

  if (alpha <= 0) {
    out[o] = out[o + 1] = out[o + 2] = out[o + 3] = 0;
    cleared++;
    continue;
  }

  // إزالة بياض الخلفية: pixel = a*F + (1-a)*255  =>  F = (pixel - (1-a)*255)/a
  const unblend = (c) => {
    const v = (c - (1 - alpha) * 255) / alpha;
    return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
  };
  out[o] = unblend(data[i]);
  out[o + 1] = unblend(data[i + 1]);
  out[o + 2] = unblend(data[i + 2]);
  out[o + 3] = Math.round(alpha * 255);
}

await sharp(out, { raw: { width, height, channels: 4 } })
  .trim({ threshold: 1 })
  .png({ compressionLevel: 9 })
  .toFile(path.resolve(output));

const meta = await sharp(path.resolve(output)).metadata();
console.log(
  `✓ ${path.basename(output)}  ${meta.width}×${meta.height}  ` +
    `(أُزيل ${cleared} بكسل خلفية من ${width * height})`
);
