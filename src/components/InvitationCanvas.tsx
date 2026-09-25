'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { canvasToBlob, canvasToDataUrl, renderInvitation } from '@/lib/invitation-canvas';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '@/lib/template-config';

export type InvitationCanvasHandle = {
  toBlob: () => Promise<Blob>;
  toDataUrl: () => string;
  ready: boolean;
};

type Props = {
  guestName: string;
  onStatusChange?: (status: 'rendering' | 'ready' | 'error') => void;
};

/**
 * لوحة الدعوة: العنصر المعروض في الصفحة هو نفسه المُصدَّر.
 *
 * نرسم مرة واحدة بالمقاس الكامل 1080×1920 ونعرضه مصغّرًا بـ CSS فقط، فلا
 * يوجد تخطيطان أحدهما للمعاينة والآخر للتصدير — ما تراه هو ما يُنزَّل بالضبط.
 */
export const InvitationCanvas = forwardRef<InvitationCanvasHandle, Props>(
  function InvitationCanvas({ guestName, onStatusChange }, ref) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [ready, setReady] = useState(false);

    useImperativeHandle(
      ref,
      () => ({
        ready,
        toDataUrl: () => {
          const canvas = canvasRef.current;
          if (!canvas) throw new Error('لم تُجهَّز صورة الدعوة بعد.');
          return canvasToDataUrl(canvas);
        },
        toBlob: () => {
          const canvas = canvasRef.current;
          if (!canvas) return Promise.reject(new Error('لم تُجهَّز صورة الدعوة بعد.'));
          return canvasToBlob(canvas);
        },
      }),
      [ready]
    );

    useEffect(() => {
      let cancelled = false;
      setReady(false);
      onStatusChange?.('rendering');

      (async () => {
        const target = canvasRef.current;
        if (!target) return;
        try {
          await renderInvitation({ guestName, canvas: target });
          if (cancelled) return;
          setReady(true);
          onStatusChange?.('ready');
        } catch {
          if (cancelled) return;
          onStatusChange?.('error');
        }
      })();

      return () => {
        cancelled = true;
      };
      // onStatusChange مستقرّة عند المستدعي؛ إدراجها هنا يعيد الرسم بلا داعٍ
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [guestName]);

    return (
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        role="img"
        aria-label={guestName ? `بطاقة دعوة باسم ${guestName}` : 'بطاقة الدعوة'}
        className="block h-auto w-full"
      />
    );
  }
);
