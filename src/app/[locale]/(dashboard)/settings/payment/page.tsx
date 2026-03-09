import { redirect } from 'next/navigation';

interface PageProps {
  searchParams: Promise<{ connect?: string }>;
}

export default async function PaymentSettingsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const connectParam = params.connect ? `&connect=${params.connect}` : '';
  redirect(`/settings?tab=pagamentos${connectParam}`);
}
