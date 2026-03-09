import { XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

interface Props {
  searchParams: Promise<{ slug?: string }>;
}

export default async function BookingCancelPage({ searchParams }: Props) {
  const t = await getTranslations('public');
  const params = await searchParams;
  const backHref = params.slug ? `/${params.slug}` : '/';

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center space-y-4">
          <XCircle className="h-16 w-16 text-red-400 mx-auto" />
          <h1 className="text-2xl font-bold">{t('cancelledPaymentTitle')}</h1>
          <p className="text-muted-foreground">
            {t('cancelledPaymentDescription')}
          </p>
          <p className="text-sm text-muted-foreground">
            {t('cancelledRetryNote')}
          </p>
          <Button asChild className="w-full">
            <Link href={backHref}>{t('tryAgainBooking')}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
