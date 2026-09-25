/**
 * image-store.ts
 * ---------------------------------------------------------------------------
 * تخزين صور الدعوات المولّدة على قرص الخادم.
 *
 * الصور تُحفظ خارج مجلد public عمدًا: صورة الدعوة تحمل اسم المدعو، ولا يصحّ
 * أن تكون قابلة للتخمين عبر عنوان عام. الوصول إليها يمرّ عبر مسار محميّ
 * بالجلسة في /api/invitations/[id]/image.
 */

import 'server-only';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';

const STORAGE_DIR = process.env.INVITATION_STORAGE_DIR
  ? path.resolve(process.env.INVITATION_STORAGE_DIR)
  : path.join(process.cwd(), '.data', 'invitations');

/** يمنع أي محاولة للخروج من مجلد التخزين عبر اسم ملف ملفّق. */
function resolveSafe(key: string): string {
  if (!/^[A-Za-z0-9_-]+\.png$/.test(key)) {
    throw new Error('اسم ملف الصورة غير صالح.');
  }
  const full = path.join(STORAGE_DIR, key);
  if (!full.startsWith(STORAGE_DIR + path.sep)) {
    throw new Error('مسار الصورة خارج مجلد التخزين.');
  }
  return full;
}

export function imageKeyFor(invitationId: string): string {
  // معرّف cuid آمن للاستخدام كاسم ملف
  return `${invitationId.replace(/[^A-Za-z0-9_-]/g, '')}.png`;
}

/** يفكّ data URL إلى بايتات PNG مع رفض أي محتوى آخر. */
export function decodePngDataUrl(dataUrl: string): Buffer {
  const prefix = 'data:image/png;base64,';
  if (!dataUrl.startsWith(prefix)) throw new Error('صيغة الصورة يجب أن تكون PNG.');

  const bytes = Buffer.from(dataUrl.slice(prefix.length), 'base64');

  // توقيع PNG — لا نثق في نوع المحتوى المعلن وحده
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (bytes.length < 8 || !bytes.subarray(0, 8).equals(signature)) {
    throw new Error('الملف المرسل ليس صورة PNG صالحة.');
  }
  return bytes;
}

export async function saveImage(key: string, bytes: Buffer): Promise<void> {
  await mkdir(STORAGE_DIR, { recursive: true });
  await writeFile(resolveSafe(key), bytes);
}

export async function readImage(key: string): Promise<Buffer | null> {
  try {
    return await readFile(resolveSafe(key));
  } catch {
    return null;
  }
}

export async function deleteImage(key: string): Promise<void> {
  try {
    await unlink(resolveSafe(key));
  } catch {
    // الملف غير موجود أصلًا — لا شيء نفعله
  }
}
