/**
 * rate-limit.ts
 * ---------------------------------------------------------------------------
 * حدّ معدّل بسيط بخوارزمية النافذة المنزلقة، في ذاكرة العملية.
 *
 * حدوده الحقيقية: العدّاد محلي لكل نسخة من التطبيق. لو نُشرت المنصة على أكثر
 * من نسخة (أو على بيئة serverless بلا حالة) فسيصبح الحد فعّالًا لكل نسخة
 * على حدة. للإنتاج الموزّع استبدل الخزن هنا بـ Redis — الواجهة نفسها تكفي.
 */

type Hit = { count: number; resetAt: number };

const buckets = new Map<string, Hit>();

export type RateLimitRule = { limit: number; windowMs: number };

export const RULES = {
  /** إنشاء الدعوات لكل عنوان IP */
  createInvitation: { limit: 60, windowMs: 60 * 60_000 },
  /** الإرسال الفعلي عبر الواجهة الرسمية */
  sendInvitation: { limit: 30, windowMs: 60 * 60_000 },
} satisfies Record<string, RateLimitRule>;

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function rateLimit(key: string, rule: RateLimitRule): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + rule.windowMs });
    return { allowed: true, remaining: rule.limit - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= rule.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: rule.limit - existing.count,
    retryAfterSeconds: 0,
  };
}

/** تنظيف دوري حتى لا تنمو الخريطة بلا حد على خادم طويل العمر. */
if (typeof setInterval === 'function') {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, hit] of buckets) if (hit.resetAt <= now) buckets.delete(key);
  }, 5 * 60_000);
  // لا نمنع إنهاء العملية بسبب هذا المؤقّت
  if (typeof timer === 'object' && 'unref' in timer) timer.unref();
}

/** عنوان العميل خلف عاكس (proxy) إن وُجد. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

export function rateLimitResponse(result: RateLimitResult): Response {
  return Response.json(
    {
      error: `تجاوزت الحد المسموح من المحاولات. حاول بعد ${result.retryAfterSeconds} ثانية.`,
    },
    { status: 429, headers: { 'Retry-After': String(result.retryAfterSeconds) } }
  );
}
