/**
 * invitation-canvas.ts
 * ---------------------------------------------------------------------------
 * توليد صورة الدعوة في المتصفح على لوحة 1080×1920.
 *
 * لماذا في المتصفح لا على الخادم؟ لأن محرّك النصوص في المتصفح يطبّق تشكيل
 * الحروف العربية (اتصال الحروف) واتجاه النص ثنائي الاتجاه تلقائيًا. مكتبات
 * canvas على الخادم تكتب الحروف منفصلة ما لم تُضف طبقة تشكيل يدوية، وهي أكبر
 * مصدر لتشوّه النص العربي في هذا النوع من المشاريع.
 *
 * مع التصميم الرسمي لا نرسم سوى اسم المدعو: بقية النصوص مطبوعة على التصميم.
 * ولأن التصميم يحمل اسمًا نموذجيًا، نعيد بناء شريط الاسم من الخلفية المجاورة
 * قبل الكتابة.
 *
 * الصورة المعروضة في المعاينة هي نفسها المحفوظة والمرسلة: نرسم مرة واحدة
 * بالمقاس الكامل ثم نعرضها مصغّرة بـ CSS فقط.
 */

import {
  BRAND,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  FALLBACK_LAYOUT,
  GUEST_NAME_BLOCK,
  INVITATION_COPY,
  MTC_LOGO_SRC,
  NAME_BAND,
  NAME_FIT,
  TEMPLATE_IMAGE_SRC,
  WEEK_LOGO_SRC,
  type TextBlock,
} from './template-config';

const FONT_FAMILY = 'Tajawal';

/* ------------------------------------------------------------ الخطوط --- */

let fontsPromise: Promise<void> | null = null;

/** تحميل Tajawal المضمّن. بدونه يرسم المتصفح بخط بديل فتختلف المخرجات. */
export function ensureFonts(): Promise<void> {
  if (fontsPromise) return fontsPromise;

  fontsPromise = (async () => {
    if (typeof document === 'undefined' || !('fonts' in document)) return;

    const faces: Array<[string, number]> = [
      ['/fonts/Tajawal-Regular.ttf', 400],
      ['/fonts/Tajawal-Medium.ttf', 500],
      ['/fonts/Tajawal-Bold.ttf', 700],
      ['/fonts/Tajawal-ExtraBold.ttf', 800],
    ];

    await Promise.all(
      faces.map(async ([url, weight]) => {
        try {
          const face = new FontFace(FONT_FAMILY, `url(${url})`, { weight: String(weight) });
          await face.load();
          document.fonts.add(face);
        } catch {
          // وزن مفقود لا يوقف التوليد؛ المتصفح يستخدم أقرب وزن متاح.
        }
      })
    );
    await document.fonts.ready;
  })();

  return fontsPromise;
}

/* ------------------------------------------------------------- الصور --- */

const imageCache = new Map<string, HTMLImageElement | null>();

function loadImage(src: string): Promise<HTMLImageElement | null> {
  if (imageCache.has(src)) return Promise.resolve(imageCache.get(src)!);

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = () => {
      imageCache.set(src, null);
      resolve(null);
    };
    img.src = src;
  });
}

export async function templateAvailable(): Promise<boolean> {
  return (await loadImage(TEMPLATE_IMAGE_SRC)) !== null;
}

/* ------------------------------------------------------------ النصوص --- */

function setFont(ctx: CanvasRenderingContext2D, size: number, weight: number): void {
  ctx.font = `${weight} ${size}px "${FONT_FAMILY}", "Segoe UI", sans-serif`;
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawBlock(ctx: CanvasRenderingContext2D, text: string, block: TextBlock): void {
  setFont(ctx, block.fontSize, block.weight);
  ctx.fillStyle = block.color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.direction = 'rtl';

  wrapLines(ctx, text, block.maxWidth).forEach((line, index) => {
    ctx.fillText(line, block.centerX, block.top + index * block.lineHeight);
  });
}

/**
 * يعيد بناء خلفية شريط الاسم من الصفوف النظيفة أعلاه وأسفله، فيمحو الاسم
 * النموذجي المطبوع على التصميم الرسمي دون المساس ببقية البطاقة.
 */
function rebuildNameBand(ctx: CanvasRenderingContext2D, template: HTMLImageElement): void {
  const { top, bottom, left, right, sampleAbove, sampleBelow, feather } = NAME_BAND;
  const width = right - left;
  const height = bottom - top;

  // الاقتطاع يجري بإحداثيات المصدر، فنحتاج مقياس التصميم إلى اللوحة
  const sx = template.naturalWidth / CANVAS_WIDTH;
  const sy = template.naturalHeight / CANVAS_HEIGHT;
  const srcLeft = left * sx;
  const srcWidth = width * sx;

  const patch = document.createElement('canvas');
  patch.width = width;
  patch.height = height;
  const pctx = patch.getContext('2d');
  if (!pctx) return;

  // الصف النظيف الأعلى ممدودًا على كامل ارتفاع الشريط
  pctx.drawImage(template, srcLeft, sampleAbove * sy, srcWidth, 2 * sy, 0, 0, width, height);

  // ثم الصف الأسفل فوقه بتدرّج رأسي، فيتكوّن انتقال أملس بين الطرفين
  const lower = document.createElement('canvas');
  lower.width = width;
  lower.height = height;
  const lctx = lower.getContext('2d');
  if (lctx) {
    lctx.drawImage(template, srcLeft, sampleBelow * sy, srcWidth, 2 * sy, 0, 0, width, height);
    const vertical = lctx.createLinearGradient(0, 0, 0, height);
    vertical.addColorStop(0, 'rgba(0,0,0,0)');
    vertical.addColorStop(1, 'rgba(0,0,0,1)');
    lctx.globalCompositeOperation = 'destination-in';
    lctx.fillStyle = vertical;
    lctx.fillRect(0, 0, width, height);
    pctx.drawImage(lower, 0, 0);
  }

  // تمويه الحافتين الجانبيتين حتى لا يظهر حدّ للرقعة
  const horizontal = pctx.createLinearGradient(0, 0, width, 0);
  horizontal.addColorStop(0, 'rgba(0,0,0,0)');
  horizontal.addColorStop(feather / width, 'rgba(0,0,0,1)');
  horizontal.addColorStop(1 - feather / width, 'rgba(0,0,0,1)');
  horizontal.addColorStop(1, 'rgba(0,0,0,0)');
  pctx.globalCompositeOperation = 'destination-in';
  pctx.fillStyle = horizontal;
  pctx.fillRect(0, 0, width, height);

  ctx.drawImage(patch, left, top);
}

/**
 * اسم المدعو: يُصغَّر الخط تدريجيًا ليتّسع في سطر، فإن لم يكفِ يُلفّ على
 * سطرين بحد أقصى. الأسماء الطويلة لا تُقصّ ولا تخرج عن الإطار.
 */
function drawGuestName(ctx: CanvasRenderingContext2D, name: string, onTemplate: boolean): void {
  const block = GUEST_NAME_BLOCK;
  const lineFactor = 1.28;
  let size = NAME_FIT.maxFontSize;
  let lines: string[] = [name];

  // نبحث عن أكبر حجم يحقّق شرطين معًا: العرض ضمن الحد، والارتفاع الكلّي داخل
  // الشريط المُعاد بناؤه. إغفال شرط الارتفاع يجعل الاسم ذا السطرين يتجاوز
  // الشريط فيصطدم بالفاصل الذهبي أعلاه أو بنص الدعوة أسفله.
  for (; size >= NAME_FIT.minFontSize; size -= 2) {
    setFont(ctx, size, block.weight);
    const candidate =
      ctx.measureText(name).width <= block.maxWidth
        ? [name]
        : wrapLines(ctx, name, block.maxWidth);

    if (candidate.length > NAME_FIT.maxLines) continue;
    if (candidate.length * Math.round(size * lineFactor) > block.lineHeight) continue;

    lines = candidate;
    break;
  }

  if (size < NAME_FIT.minFontSize) {
    size = NAME_FIT.minFontSize;
    setFont(ctx, size, block.weight);
    lines = wrapLines(ctx, name, block.maxWidth).slice(0, NAME_FIT.maxLines);
  }

  const lineHeight = Math.round(size * lineFactor);
  const total = lines.length * lineHeight;
  // يتوسّط الشريط المحجوز مهما كان عدد الأسطر، فلا يزحف على ما حوله
  const startY = block.top + (block.lineHeight - total) / 2;

  setFont(ctx, size, block.weight);
  ctx.fillStyle = block.color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.direction = 'rtl';

  ctx.save();
  // ظل خفيف فوق القالب الاحتياطي فقط؛ التصميم الرسمي لا يحتاجه
  if (!onTemplate) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 3;
  }
  lines.forEach((line, index) => {
    ctx.fillText(line, block.centerX, startY + index * lineHeight);
  });
  ctx.restore();
}

/* ------------------------------------------------ القالب الاحتياطي --- */

/** خلفية بألوان الهوية، تُستخدم فقط ما لم يوضع التصميم الرسمي. */
function drawFallbackBackground(ctx: CanvasRenderingContext2D): void {
  const gradient = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  gradient.addColorStop(0, BRAND.purple);
  gradient.addColorStop(0.55, BRAND.navy);
  gradient.addColorStop(1, '#101a3d');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.strokeStyle = 'rgba(242, 176, 49, 0.55)';
  ctx.lineWidth = 3;
  ctx.strokeRect(46, 46, CANVAS_WIDTH - 92, CANVAS_HEIGHT - 92);

  ctx.fillStyle = BRAND.gold;
  ctx.fillRect(CANVAS_WIDTH / 2 - 90, NAME_BAND.top - 30, 180, 4);
}

async function drawFallbackLogos(ctx: CanvasRenderingContext2D): Promise<void> {
  const [mtc, week] = await Promise.all([loadImage(MTC_LOGO_SRC), loadImage(WEEK_LOGO_SRC)]);

  /** يحافظ على نسبة الشعار الأصلية داخل ارتفاع محدّد. */
  const fit = (img: HTMLImageElement, cy: number, boxH: number) => {
    const w = boxH * (img.naturalWidth / img.naturalHeight);
    ctx.drawImage(img, CANVAS_WIDTH / 2 - w / 2, cy - boxH / 2, w, boxH);
  };

  if (mtc) fit(mtc, 250, 200);
  if (week) fit(week, 430, 110);
}

/* ------------------------------------------------------------- الرسم --- */

export type RenderOptions = {
  guestName: string;
  /** شبكة قياس تساعد على إعادة ضبط الإحداثيات */
  showGrid?: boolean;
  /**
   * اللوحة التي يُرسم عليها. تمريرها يجعل العنصر المعروض هو نفسه المُصدَّر،
   * فتتطابق المعاينة مع الملف حتمًا.
   */
  canvas?: HTMLCanvasElement;
};

export async function renderInvitation(
  options: RenderOptions
): Promise<{ canvas: HTMLCanvasElement; usedOfficialTemplate: boolean }> {
  await ensureFonts();

  const canvas = options.canvas ?? document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('المتصفح لا يدعم Canvas.');
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const template = await loadImage(TEMPLATE_IMAGE_SRC);
  const usedOfficialTemplate = template !== null;

  if (template) {
    // التصميم الرسمي كما هو، ثم اسم المدعو وحده فوقه
    ctx.drawImage(template, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    rebuildNameBand(ctx, template);
  } else {
    drawFallbackBackground(ctx);
    await drawFallbackLogos(ctx);
    drawBlock(ctx, INVITATION_COPY.kicker, FALLBACK_LAYOUT.kicker);
    drawBlock(ctx, INVITATION_COPY.body, FALLBACK_LAYOUT.body);
    drawBlock(ctx, INVITATION_COPY.dates, FALLBACK_LAYOUT.dates);
    drawBlock(ctx, INVITATION_COPY.venue, FALLBACK_LAYOUT.venue);
    drawBlock(ctx, INVITATION_COPY.closing, FALLBACK_LAYOUT.closing);
  }

  drawGuestName(ctx, options.guestName, usedOfficialTemplate);

  if (options.showGrid) drawMeasurementGrid(ctx);

  return { canvas, usedOfficialTemplate };
}

/** شبكة كل ١٠٠ بكسل مع أرقام، لضبط الإحداثيات على أي تصميم جديد. */
function drawMeasurementGrid(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 0, 128, 0.35)';
  ctx.fillStyle = 'rgba(255, 0, 128, 0.9)';
  ctx.lineWidth = 1;
  ctx.font = '500 20px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.direction = 'ltr';

  for (let y = 0; y <= CANVAS_HEIGHT; y += 100) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CANVAS_WIDTH, y);
    ctx.stroke();
    ctx.fillText(String(y), 8, y + 4);
  }
  for (let x = 0; x <= CANVAS_WIDTH; x += 100) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CANVAS_HEIGHT);
    ctx.stroke();
  }

  // حدود شريط الاسم المُعاد بناؤه
  ctx.strokeStyle = 'rgba(0, 255, 170, 0.85)';
  ctx.lineWidth = 2;
  ctx.strokeRect(
    NAME_BAND.left,
    NAME_BAND.top,
    NAME_BAND.right - NAME_BAND.left,
    NAME_BAND.bottom - NAME_BAND.top
  );
  ctx.restore();
}

export function canvasToDataUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png');
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('تعذّر إنشاء ملف الصورة.'))),
      'image/png'
    );
  });
}
