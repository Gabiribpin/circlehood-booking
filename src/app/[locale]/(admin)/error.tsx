'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('common');

  useEffect(() => {
    console.error('[Admin Error Boundary]', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 p-6">
      <h2 className="text-xl font-semibold text-gray-900">
        {t('errorBoundaryTitle')}
      </h2>
      <p className="text-gray-600 text-center max-w-md">
        {t('errorBoundaryDescription')}
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        {t('tryAgain')}
      </button>
    </div>
  );
}
