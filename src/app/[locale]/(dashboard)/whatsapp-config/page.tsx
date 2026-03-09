import { redirect } from 'next/navigation';

export default function WhatsAppConfigPage() {
  redirect('/settings?tab=whatsapp');
}
