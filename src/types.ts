import type { Channel, DeliveryStatus } from '@/lib/validation';

/** شكل الدعوة كما تعيده الـ API — يُستخدم في المسارات الإدارية. */
export type Invitation = {
  id: string;
  guestName: string;
  phoneE164: string;
  phoneCountry: string;
  status: DeliveryStatus;
  channel: Channel | null;
  errorMessage: string | null;
  imageKey: string | null;
  createdAt: string;
  sentAt: string | null;
};

export type InvitationStats = { total: number; sent: number };
