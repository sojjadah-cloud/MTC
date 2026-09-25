'use client';

import { useEffect, useRef, useState } from 'react';
import { ScienceWeekHeader } from './ScienceWeekHeader';
import { GuestForm, validateDraft, type GuestDraft } from './GuestForm';
import { InvitationPreview } from './InvitationPreview';
import { ActionButtons } from './ActionButtons';
import type { InvitationCanvasHandle } from './InvitationCanvas';
import { DEFAULT_COUNTRY } from '@/lib/phone';
import { invitationFileName } from '@/lib/template-config';

const EMPTY: GuestDraft = { guestName: '', phone: '', countryIso2: DEFAULT_COUNTRY };

/** الاسم المعروض على البطاقة قبل أن يكتب المستخدم شيئًا. */
const NAME_PLACEHOLDER = 'اسم المدعو';

/**
 * الأداة كاملة في صفحة واحدة:
 *   الاسم ← الهاتف ← المعاينة تتحدّث فورًا ← تنزيل الصورة.
 *
 * لا يوجد زر «إنشاء الدعوة»: البطاقة تتشخصن أثناء الكتابة. نؤخّر إعادة الرسم
 * قليلًا بعد آخر ضغطة مفتاح، فرسم لوحة 1080×1920 عند كل حرف يُهدر المعالج بلا
 * فائدة يراها المستخدم.
 */
export function InvitationGenerator() {
  const [draft, setDraft] = useState<GuestDraft>(EMPTY);
  const [debouncedName, setDebouncedName] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const canvasRef = useRef<InvitationCanvasHandle>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const savedFor = useRef<string | null>(null);

  const { nameError, phoneError, e164, nameReady } = validateDraft(draft);

  useEffect(() => {
    const trimmed = draft.guestName.trim().replace(/\s+/g, ' ');
    const id = window.setTimeout(() => setDebouncedName(trimmed), 350);
    return () => window.clearTimeout(id);
  }, [draft.guestName]);

  function flash(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 3500);
  }

  /**
   * تسجيل الدعوة في السجل الخلفي. لا يعطّل الواجهة ولا يمنع التنزيل: التوليد
   * والتنزيل والمشاركة كلّها تجري في المتصفح، والسجل إضافة إدارية.
   */
  async function logInvitation(): Promise<string | null> {
    if (!nameReady || !e164) return null;
    const key = `${debouncedName}|${e164}`;
    if (savedFor.current === key) return null;
    savedFor.current = key;

    try {
      const response = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...draft, guestName: debouncedName, allowDuplicate: true }),
      });
      if (!response.ok) return null;
      const data = await response.json();
      const id: string = data.invitation.id;

      // نحفظ الصورة كي يتمكّن الإرسال التلقائي لاحقًا من رفع الملف نفسه
      try {
        const dataUrl = canvasRef.current?.toDataUrl();
        if (dataUrl) {
          await fetch(`/api/invitations/${id}/image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dataUrl }),
          });
        }
      } catch {
        // الصورة موجودة في المتصفح على أي حال
      }
      return id;
    } catch {
      return null;
    }
  }

  function requireValid(): boolean {
    if (nameError || phoneError) {
      setShowErrors(true);
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return false;
    }
    return true;
  }

  async function handleDownload() {
    if (!requireValid()) return;
    setBusy(true);
    try {
      const blob = await canvasRef.current!.toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = invitationFileName(debouncedName, String(Date.now()));
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      flash('تم تنزيل صورة الدعوة');
      void logInvitation();
    } catch {
      flash('تعذّر تنزيل الصورة. أعد المحاولة.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <ScienceWeekHeader />

      <main className="page">
        <div className="page__intro">
          <h1 className="page__title">
            نظام الدعوات الرقمية
          </h1>
          <p className="page__lede">
            أنشئ دعوة شخصية وأرسلها مباشرة إلى ضيفك
          </p>
        </div>

        <div ref={formRef} className="page__form">
          <GuestForm value={draft} onChange={setDraft} showErrors={showErrors} />
        </div>

        <InvitationPreview ref={canvasRef} guestName={debouncedName || NAME_PLACEHOLDER} />

        <ActionButtons busy={busy} onDownload={handleDownload} />

        {toast && (
          <p className="page__toast" role="status">
            {toast}
          </p>
        )}
      </main>
    </>
  );
}
