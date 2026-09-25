'use client';

import { forwardRef, useState } from 'react';
import { InvitationCanvas, type InvitationCanvasHandle } from './InvitationCanvas';

type Props = { guestName: string };

/**
 * معاينة الدعوة — أهم عنصر في الواجهة.
 *
 * الحاوية تحفظ نسبة 9:16 بالضبط فلا تُقصّ البطاقة ولا تُمطّ، وتبقى كبيرة
 * بما يكفي للمراجعة على الهاتف.
 */
export const InvitationPreview = forwardRef<InvitationCanvasHandle, Props>(
  function InvitationPreview({ guestName }, ref) {
    const [status, setStatus] = useState<'rendering' | 'ready' | 'error'>('rendering');

    return (
      <section className="preview">
        <div className="preview__head">
          <h2 className="preview__title">معاينة الدعوة</h2>
          <p className="preview__lede">
            راجع الاسم والتصميم قبل إرسال الدعوة إلى المدعو
          </p>
        </div>

        <div className="preview-frame">
          <InvitationCanvas ref={ref} guestName={guestName} onStatusChange={setStatus} />

          {status === 'rendering' && (
            <div className="preview-overlay" role="status" aria-live="polite">
              <span className="spinner" aria-hidden />
              <span>جارٍ تجهيز الدعوة...</span>
            </div>
          )}

          {status === 'error' && (
            <div className="preview-overlay">
              <span>تعذّر تجهيز الدعوة. حدّث الصفحة وأعد المحاولة.</span>
            </div>
          )}
        </div>
      </section>
    );
  }
);
