/**
 * whatsapp.ts
 * ---------------------------------------------------------------------------
 * تكامل خادمي مع WhatsApp Cloud API الرسمية من Meta.
 *
 * مبدأ أساسي هنا: لا نُظهر نجاحًا لم يحدث. إن لم تُضبط بيانات الربط فإن
 * isConfigured() تعيد false، ويعمل النظام في الوضع اليدوي بوضوح، ولا يُحاكى
 * أي إرسال.
 *
 * المفاتيح تُقرأ من متغيّرات البيئة على الخادم فقط ولا تصل إلى المتصفح.
 *
 * قيد مهم من سياسة واتساب: لا يمكن بدء محادثة برسالة حرّة إلا داخل نافذة
 * خدمة العملاء (٢٤ ساعة من آخر رسالة من المستخدم). خارجها يجب استخدام قالب
 * معتمد. لذلك نرسل القالب أولًا عند الحاجة ثم الصورة.
 */

import 'server-only';

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION ?? 'v21.0';

export type WhatsAppConfig = {
  token: string;
  phoneNumberId: string;
  templateName?: string;
  templateLanguage: string;
};

export function readConfig(): WhatsAppConfig | null {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) return null;

  return {
    token,
    phoneNumberId,
    templateName: process.env.WHATSAPP_TEMPLATE_NAME || undefined,
    templateLanguage: process.env.WHATSAPP_TEMPLATE_LANGUAGE ?? 'ar',
  };
}

export function isConfigured(): boolean {
  return readConfig() !== null;
}

/** ملخّص آمن للعرض في الواجهة — بلا أي مفاتيح. */
export function configSummary() {
  const config = readConfig();
  return {
    configured: config !== null,
    hasTemplate: Boolean(config?.templateName),
    templateLanguage: config?.templateLanguage ?? null,
    graphVersion: GRAPH_VERSION,
  };
}

export class WhatsAppError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown
  ) {
    super(message);
    this.name = 'WhatsAppError';
  }
}

/** شكل ردّ Graph API بالقدر الذي نعتمد عليه فعلًا. */
type GraphResponse = {
  id?: string;
  messages?: Array<{ id?: string }>;
  error?: { message?: string; code?: number; type?: string };
  raw?: string;
};

async function graphFetch(
  config: WhatsAppConfig,
  path: string,
  init: RequestInit
): Promise<GraphResponse> {
  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${config.token}`, ...(init.headers ?? {}) },
    // لا نُبقي الطلب معلّقًا إلى الأبد لو تعطّلت الواجهة
    signal: AbortSignal.timeout(30_000),
  });

  const text = await response.text();
  let payload: GraphResponse = {};
  try {
    payload = text ? (JSON.parse(text) as GraphResponse) : {};
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    const apiMessage = payload?.error?.message ?? `خطأ من واجهة واتساب (${response.status}).`;
    throw new WhatsAppError(apiMessage, response.status, payload?.error);
  }
  return payload;
}

/**
 * رفع صورة الدعوة إلى مخزن وسائط واتساب.
 * نرفع الملف بدل إرسال رابط، حتى لا نحتاج إلى استضافة الصورة على عنوان عام.
 * @returns معرّف الوسائط الصالح ٣٠ يومًا
 */
export async function uploadMedia(imageBytes: Buffer, fileName: string): Promise<string> {
  const config = readConfig();
  if (!config) throw new WhatsAppError('واجهة واتساب غير مُعدّة.', 503);

  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('type', 'image/png');
  form.append('file', new Blob([new Uint8Array(imageBytes)], { type: 'image/png' }), fileName);

  const result = await graphFetch(config, `${config.phoneNumberId}/media`, {
    method: 'POST',
    body: form,
  });

  if (!result?.id) throw new WhatsAppError('لم تُعِد واجهة واتساب معرّف الوسائط.', 502, result);
  return result.id as string;
}

/**
 * إرسال قالب معتمد — مطلوب لبدء المحادثة خارج نافذة الـ ٢٤ ساعة.
 * @param bodyParams القيم التي تُملأ في متغيّرات القالب، مثل اسم المدعو
 */
export async function sendTemplate(
  toE164: string,
  bodyParams: string[]
): Promise<{ messageId: string }> {
  const config = readConfig();
  if (!config) throw new WhatsAppError('واجهة واتساب غير مُعدّة.', 503);
  if (!config.templateName) {
    throw new WhatsAppError('لم يُحدَّد اسم قالب معتمد في WHATSAPP_TEMPLATE_NAME.', 503);
  }

  const result = await graphFetch(config, `${config.phoneNumberId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: toE164.replace(/\D/g, ''),
      type: 'template',
      template: {
        name: config.templateName,
        language: { code: config.templateLanguage },
        components: bodyParams.length
          ? [{ type: 'body', parameters: bodyParams.map((text) => ({ type: 'text', text })) }]
          : [],
      },
    }),
  });

  const messageId = result?.messages?.[0]?.id;
  if (!messageId) throw new WhatsAppError('لم تُعِد واجهة واتساب معرّف الرسالة.', 502, result);
  return { messageId };
}

/** إرسال صورة الدعوة كرسالة وسائط مع نص مختصر. */
export async function sendImage(
  toE164: string,
  mediaId: string,
  caption: string
): Promise<{ messageId: string }> {
  const config = readConfig();
  if (!config) throw new WhatsAppError('واجهة واتساب غير مُعدّة.', 503);

  const result = await graphFetch(config, `${config.phoneNumberId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: toE164.replace(/\D/g, ''),
      type: 'image',
      image: { id: mediaId, caption: caption.slice(0, 1024) },
    }),
  });

  const messageId = result?.messages?.[0]?.id;
  if (!messageId) throw new WhatsAppError('لم تُعِد واجهة واتساب معرّف الرسالة.', 502, result);
  return { messageId };
}

// نص الرسالة ورابط wa.me يعيشان في whatsapp-link.ts حتى يستخدمهما المتصفح أيضًا.
export { invitationCaption, waMeLink } from './whatsapp-link';
