'use client';

import { useState } from 'react';
import { MTC_LOGO_SRC, WEEK_LOGO_SRC } from '@/lib/template-config';

function Logo({ src, alt, className }: { src: string; alt: string; className: string }) {
  const [missing, setMissing] = useState(false);
  if (missing) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- أصل محلي بأبعاد متغيّرة
    <img
      src={src}
      alt={alt}
      className={`${className} w-auto shrink-0 object-contain`}
      onError={() => setMissing(true)}
    />
  );
}

/**
 * زخرفة الدوائر الإلكترونية على طرف الترويسة.
 *
 * ثلاثة مسارات بتباعد رأسي منتظم (28 وحدة)، وزواياها كلّها 45° بطول واحد
 * (14 وحدة)، والعلوي والسفلي متناظران حول المسار الأوسط. الانتظام مقصود:
 * مسارات عشوائية الأطوال والزوايا تبدو فوضى لا ثيمة تقنية.
 *
 * نسبة العرض إلى الارتفاع محفوظة (meet لا none)، وإلا تمطّطت العُقد الدائرية
 * إلى أشكال بيضوية واختلفت زوايا الانكسار باختلاف عرض الشاشة.
 */
function CircuitEdge({ side }: { side: 'start' | 'end' }) {
  return (
    <svg
      className={`circuit circuit--${side}`}
      aria-hidden
      viewBox="0 0 120 96"
      preserveAspectRatio="xMidYMid meet"
    >
      <g fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round">
        <path d="M0 20 H34 L48 34 H74" />
        <path d="M0 48 H88" />
        <path d="M0 76 H34 L48 62 H74" />
      </g>
      <g fill="currentColor">
        <circle cx="74" cy="34" r="2.75" />
        <circle cx="88" cy="48" r="2.75" />
        <circle cx="74" cy="62" r="2.75" />
      </g>
    </svg>
  );
}

/**
 * ترويسة الهوية: الشعاران بخلفية شفافة في وسط الترويسة.
 *
 * الشعاران مفصولان عن خلفيتهما في scripts/extract-logo.mjs، فيظهران كعنصرَي
 * هوية على خلفية الموقع لا كرقعتين زرقاوين ملصقتين.
 */
export function ScienceWeekHeader() {
  return (
    <header className="site-header">
      <CircuitEdge side="start" />
      <CircuitEdge side="end" />

      <div className="site-header__inner">
        <Logo src={MTC_LOGO_SRC} alt="شعار الكلية العسكرية التقنية" className="h-14" />
        <span className="site-header__divider" aria-hidden />
        <Logo src={WEEK_LOGO_SRC} alt="شعار الأسبوع العلمي السابع" className="h-9" />
      </div>

      <span className="site-header__rule" aria-hidden />
    </header>
  );
}
