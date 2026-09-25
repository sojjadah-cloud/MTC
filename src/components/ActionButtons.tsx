'use client';

type Props = {
  busy: boolean;
  onDownload: () => void;
};

/**
 * إجراء واحد: تحميل صورة الدعوة، بالذهبي من هوية الأسبوع العلمي.
 *
 * لا يُعطَّل الزر عند نقص البيانات، فالتعطيل يترك المستخدم بلا طريق: لا يضغط
 * ولا يعرف السبب. يبقى فعّالًا، وعند الضغط تظهر رسالة التحقق تحت الحقل الناقص
 * وتُمرَّر الصفحة إليه.
 */
export function ActionButtons({ busy, onDownload }: Props) {
  return (
    <div className="actions">
      <button type="button" className="btn btn-gold" onClick={onDownload} disabled={busy}>
        {busy ? (
          <>
            <span className="spinner" aria-hidden />
            جارٍ التحضير...
          </>
        ) : (
          'تحميل الصورة'
        )}
      </button>
    </div>
  );
}
