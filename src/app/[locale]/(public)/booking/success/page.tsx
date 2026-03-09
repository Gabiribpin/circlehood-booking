import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

interface Props {
  searchParams: Promise<{ slug?: string }>;
}

export default async function BookingSuccessPage({ searchParams }: Props) {
  const t = await getTranslations('public');
  const params = await searchParams;
  const backHref = params.slug ? `/${params.slug}` : '/';

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center space-y-4">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
          <h1 data-testid="success-message" className="text-2xl font-bold">{t('successTitle')}</h1>
          <p data-testid="payment-confirmed" className="text-muted-foreground">
            {t('successDescription')}
          </p>
          <p className="text-sm text-muted-foreground">
            {t('successConfirmationNote')}
          </p>
          <Button asChild variant="outline" className="w-full">
            <Link href={backHref}>{t('backToProfessional')}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
