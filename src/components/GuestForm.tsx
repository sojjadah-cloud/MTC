'use client';

import { useMemo } from 'react';
import { DEFAULT_COUNTRY, findCountry, validatePhone } from '@/lib/phone';
import { guestNameSchema } from '@/lib/validation';

export type GuestDraft = { guestName: string; phone: string; countryIso2: string };

type Props = {
  value: GuestDraft;
  onChange: (next: GuestDraft) => void;
  /** تظهر رسائل التحقق بعد أول محاولة فقط، لا أثناء الكتابة الأولى */
  showErrors: boolean;
};

/** نتيجة التحقق تُحسب هنا وتُستهلك في الأعلى — مصدر واحد للصحة. */
export function validateDraft(draft: GuestDraft) {
  const name = guestNameSchema.safeParse(draft.guestName);
  const phone = draft.phone.trim()
    ? validatePhone(draft.phone, draft.countryIso2)
    : ({ ok: false, error: 'الرجاء إدخال رقم الهاتف.' } as const);

  return {
    nameError: name.success ? null : name.error.issues[0].message,
    phoneError: phone.ok ? null : phone.error,
    e164: phone.ok ? phone.e164 : null,
    nameReady: name.success,
  };
}

export function GuestForm({ value, onChange, showErrors }: Props) {
  // الدعوات لمدعوين داخل السلطنة، فرمز عمان ثابت ولا حاجة لقائمة دول.
  const oman = useMemo(() => findCountry(DEFAULT_COUNTRY)!, []);
  const { nameError, phoneError } = useMemo(() => validateDraft(value), [value]);

  const set = (patch: Partial<GuestDraft>) => onChange({ ...value, ...patch });

  return (
    <section className="card">
      <h2 className="card__title">بيانات المدعو</h2>

      {/* ------------------------------------------------ اسم المدعو --- */}
      <div className="field">
        <label className="field-label" htmlFor="guestName">
          اسم المدعو الكامل
        </label>
        <input
          id="guestName"
          className="field-input"
          value={value.guestName}
          onChange={(e) => set({ guestName: e.target.value })}
          placeholder="أدخل اسم المدعو كاملًا"
          aria-invalid={showErrors && !!nameError}
          aria-describedby={showErrors && nameError ? 'guestName-error' : undefined}
          maxLength={80}
          autoComplete="off"
          enterKeyHint="next"
        />
        {showErrors && nameError && (
          <p id="guestName-error" className="field-error">
            {nameError}
          </p>
        )}
      </div>

      {/* ---------------------------------------------- رقم الهاتف --- */}
      <div className="field field--last">
        <label className="field-label" htmlFor="phone">
          رقم هاتف المدعو
        </label>

        {/* الرقم ورمز الدولة كتلة واحدة تُقرأ من اليسار إلى اليمين كالأرقام */}
        <div className="phone-group" data-invalid={showErrors && !!phoneError}>
          <span className="phone-dial" aria-hidden>
            +{oman.dialCode}
          </span>
          <input
            id="phone"
            className="phone-number"
            value={value.phone}
            onChange={(e) => set({ phone: e.target.value })}
            placeholder="أدخل رقم الهاتف"
            inputMode="tel"
            aria-label={`رقم هاتف المدعو، رمز سلطنة عمان +${oman.dialCode}`}
            aria-invalid={showErrors && !!phoneError}
            aria-describedby={showErrors && phoneError ? 'phone-error' : 'phone-hint'}
            autoComplete="off"
            enterKeyHint="done"
          />
        </div>

        {showErrors && phoneError ? (
          <p id="phone-error" className="field-error">
            {phoneError}
          </p>
        ) : (
          <p id="phone-hint" className="field-hint">
            لن يظهر رقم الهاتف على بطاقة الدعوة
          </p>
        )}
      </div>
    </section>
  );
}
