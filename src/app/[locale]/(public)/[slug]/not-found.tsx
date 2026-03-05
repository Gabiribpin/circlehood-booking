'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  const t = useTranslations('notFound');

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-2">{t('title')}</h1>
        <p className="text-muted-foreground mb-6">
          {t('professionalNotFound')}
        </p>
        <Button asChild>
          <Link href="/">{t('backHome')}</Link>
        </Button>
      </div>
    </div>
  );
}
