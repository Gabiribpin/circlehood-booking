import { redirect } from 'next/navigation';

export default function ContactsRedirect() {
  redirect('/clients?tab=manage');
}
