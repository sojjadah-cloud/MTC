import { InvitationGenerator } from '@/components/InvitationGenerator';

/**
 * صفحة واحدة، مهمّة واحدة: توليد دعوة شخصية وإرسالها.
 * التوليد كلّه في المتصفح، فلا حاجة إلى تصيير ديناميكي على الخادم.
 */
export default function HomePage() {
  return <InvitationGenerator />;
}
