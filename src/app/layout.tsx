import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'منصة الدعوات الرقمية | الأسبوع العلمي السابع',
  description:
    'أنشئ دعوة شخصية لحضور فعاليات الأسبوع العلمي السابع بالكلية العسكرية التقنية وأرسلها مباشرة إلى ضيفك.',
};

export const viewport: Viewport = {
  themeColor: '#0e1430',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    // الواجهة عربية بالكامل، والاتجاه من اليمين إلى اليسار
    <html lang="ar" dir="rtl" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
